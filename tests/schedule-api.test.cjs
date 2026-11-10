const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScript(file, overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  new Function('require', 'module', 'exports', '__DEV__', javascript)(localRequire, module, module.exports, true);
  return module.exports;
}
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
delete process.env.EXPO_PUBLIC_API_URL;
const http = loadTypeScript('src/services/http.ts', { 'react-native': { Platform: { OS: 'ios' } } });
if (originalApiUrl !== undefined) process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
const schedule = loadTypeScript('src/services/schedule.ts', { './http': http });
const { scheduleApi, scheduleRequest, parseServerDate, scheduleDates, studentScheduleDates, scheduleAccessibility, validateScheduleList } = schedule;
const { emailApi } = loadTypeScript('src/services/email.ts', { './http': http });
const { notificationApi, validateNotificationPage, mergeNotificationItems } = loadTypeScript('src/services/notification.ts', { './http': http });
const { absenceApi, absenceRequest, absenceStatusLabel, isPastAbsenceDate, validateAbsenceList } = loadTypeScript('src/services/absence.ts', { './http': http });
const { classroomApi, classroomRequest, classroomCalendarDates, loadClassCalendarDates, ClassroomTimeoutError } = loadTypeScript('src/services/classroom.ts', { './http': http, './schedule': schedule });
const { userApi } = loadTypeScript('src/services/user.ts', { './http': http, 'react-native': { Platform: { OS: 'ios' } } });
const fakeProfile = { id: 42, name: '민지', role: 'STUDENT', profileImageUrl: null };
const fakeUserApi = { get: async (id, token) => { assert.equal(id, 42); assert.ok(token); return fakeProfile; } };
const { authApi, emailSession, googleRequest, googleSession, GoogleUserNotRegistered } = loadTypeScript('src/services/auth.ts', { './http': http, './user': { userApi: fakeUserApi } });

test('server dates are parsed strictly without assuming a timezone', () => {
  assert.equal(parseServerDate('2026-08-27 16:00:00').format('YYYY-MM-DD HH:mm:ss'), '2026-08-27 16:00:00');
  assert.equal(parseServerDate('2026-02-30 16:00:00').isValid(), false);
  assert.equal(parseServerDate('2026-08-27T16:00:00Z').isValid(), false);
});

test('calendar dates are local, deduplicated and exclude malformed values', () => {
  const item = startTime => ({ scheduleId: 1, classId: 7, studentId: 3, startTime, endTime: startTime });
  assert.deepEqual(scheduleDates([item('2026-08-27 00:00:00'), item('2026-08-27 23:30:00'), item('invalid')]), ['2026-08-27']);
});

test('student calendar includes only the selected student’s schedules', () => {
  const schedules = [
    { studentId: 1, startTime: '2026-08-01 09:00:00' },
    { studentId: 2, startTime: '2026-08-02 09:00:00' },
  ];
  assert.deepEqual(studentScheduleDates(schedules, 1), ['2026-08-01']);
  assert.deepEqual(studentScheduleDates(schedules, undefined), []);
});

test('schedule lists reject malformed responses and schedules from another class', () => {
  const item = { scheduleId: 1, classId: 7, studentId: 3, startTime: '2026-11-10 09:00:00', endTime: '2026-11-10 10:00:00' };
  assert.deepEqual(validateScheduleList([item], 7), [item]);
  assert.deepEqual(validateScheduleList([], 7), []);
  assert.throws(() => validateScheduleList(undefined, 7));
  assert.throws(() => validateScheduleList([{ ...item, classId: 8 }], 7));
  assert.throws(() => validateScheduleList([{ ...item, studentId: null }], 7));
});

test('class calendar validates its class and only shows the student’s schedules', () => {
  const item = { scheduleId: 1, classId: 7, studentId: 3, startTime: '2026-11-10 09:00:00', endTime: '2026-11-10 10:00:00' };
  const home = { classroomId: 7, calendar: [item, { ...item, scheduleId: 2, studentId: 4, startTime: '2026-11-11 09:00:00' }] };
  assert.deepEqual(classroomCalendarDates(home, 7), ['2026-11-10', '2026-11-11']);
  assert.deepEqual(classroomCalendarDates(home, 7, 3), ['2026-11-10']);
  assert.throws(() => classroomCalendarDates(home, 8));
  assert.throws(() => classroomCalendarDates({ ...home, calendar: null }, 7));
  assert.throws(() => classroomCalendarDates({ ...home, calendar: [{ ...item, classId: 8 }] }, 7));
});

test('class calendar publishes fast responses without waiting for slower classes', async () => {
  let finishSlow;
  const slow = new Promise(resolve => { finishSlow = resolve; });
  const updates = [];
  const loading = loadClassCalendarDates([1, 2, 3], id => id === 1 ? slow : id === 2 ? Promise.resolve(['2026-11-10']) : Promise.reject(new Error('offline')), result => updates.push(result));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(updates.at(-1), { dates: { 2: ['2026-11-10'] }, failed: true, complete: false });
  finishSlow(['2026-11-11']);
  await loading;
  assert.deepEqual(updates.at(-1), { dates: { 1: ['2026-11-11'], 2: ['2026-11-10'] }, failed: true, complete: true });
});

test('schedule timeouts allow retry and identify uncertain writes', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  try {
    await assert.rejects(scheduleRequest('/api/class/schedule/7', {}, 'token', 5), /조회가 지연/);
    await assert.rejects(scheduleRequest('/api/class/schedule/7', { method: 'POST' }, 'token', 5), /시간표를 확인/);
  } finally { global.fetch = originalFetch; }
});

test('schedule requests use bearer authentication and server field names', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: 42 }), { status: 200 });
  };
  try {
    const result = await scheduleApi.create(7, { studentId: 3, startTime: '2026-08-27 16:00:00', endTime: '2026-08-27 17:00:00' }, 'test-token');
    assert.equal(result, 42);
    assert.equal(calls[0].url, 'http://localhost:8080/api/class/schedule/7');
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer test-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { student_id: 3, start_time: '2026-08-27 16:00:00', end_time: '2026-08-27 17:00:00' });
    await scheduleApi.calendar(7, 2026, 8, 'test-token');
    assert.equal(calls[1].url, 'http://localhost:8080/api/class/calendar/7?year=2026&month=8');
    await scheduleApi.update(7, 42, { startTime: '2026-08-28 16:00:00', endTime: '2026-08-28 17:00:00' }, 'test-token');
    assert.equal(calls[2].options.method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[2].options.body), { start_time: '2026-08-28 16:00:00', end_time: '2026-08-28 17:00:00' });
    await scheduleApi.remove(7, 42, 'test-token');
    assert.equal(calls[3].url, 'http://localhost:8080/api/class/schedule/7/42');
    assert.equal(calls[3].options.method, 'DELETE');
  } finally { global.fetch = originalFetch; }
});

test('email verification and profile changes use the documented server fields', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: { is_verification: true } }), { status: 200 });
  };
  try {
    await emailApi.sendCode('student@example.com');
    await emailApi.verifyCode('student@example.com', '123456');
    await userApi.updateName('새 이름', 'profile-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { email_id: 'student@example.com' });
    assert.deepEqual(JSON.parse(calls[1].options.body), { email_id: 'student@example.com', verification_code: '123456' });
    assert.equal(calls[2].url, 'http://localhost:8080/api/setting/username');
    assert.equal(calls[2].options.method, 'PATCH');
    assert.equal(calls[2].options.headers.get('Authorization'), 'Bearer profile-token');
    assert.deepEqual(JSON.parse(calls[2].options.body), { name: '새 이름' });
  } finally { global.fetch = originalFetch; }
});

test('profile updates expose the saved server profile', async () => {
  const originalFetch = global.fetch;
  const updated = { id: 42, name: '새 이름', profileImageUrl: '/uploads/new.jpg', role: 'STUDENT' };
  global.fetch = async () => new Response(JSON.stringify({ success: true, data: updated }), { status: 200 });
  try {
    assert.deepEqual(await userApi.updateName('새 이름', 'token'), updated);
    assert.deepEqual(await userApi.updateImage('/uploads/new.jpg', 'token'), updated);
  } finally { global.fetch = originalFetch; }
});

test('Google registration and login use an ID token and obtain the server profile', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const accessToken = `e30.${Buffer.from(JSON.stringify({ userId: 42, role: 'STUDENT' })).toString('base64url')}.signature`;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: url.endsWith('/register') ? { id: 42 } : { accessToken, refreshToken: 'refresh' } }), { status: 200 });
  };
  try {
    await authApi.registerGoogle('google-id-token', 'STUDENT');
    const session = await googleSession('google-id-token');
    assert.equal(calls[0].url, 'http://localhost:8080/api/auth/google/register');
    assert.deepEqual(JSON.parse(calls[0].options.body), { idToken: 'google-id-token', role: 'STUDENT' });
    assert.equal(calls[1].url, 'http://localhost:8080/api/auth/google/login');
    assert.deepEqual(JSON.parse(calls[1].options.body), { idToken: 'google-id-token' });
    assert.equal(calls[1].options.headers.has('Authorization'), false);
    assert.deepEqual(session, { accessToken, refreshToken: 'refresh', user: fakeProfile });
  } finally { global.fetch = originalFetch; }
});

test('Google server requests time out with a retry message', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  try {
    await assert.rejects(googleRequest('/api/auth/google/login', 'id-token', { idToken: 'id-token' }, 5), /서버 응답이 지연/);
  } finally { global.fetch = originalFetch; }
});

test('Google profile lookup timeout does not become a signup request', async () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;
  const accessToken = `e30.${Buffer.from(JSON.stringify({ userId: 42, role: 'STUDENT' })).toString('base64url')}.signature`;
  const delayedUserApi = { get: (_id, _token, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }) };
  const delayedAuth = loadTypeScript('src/services/auth.ts', { './http': http, './user': { userApi: delayedUserApi } });
  global.setTimeout = (callback, ms, ...args) => originalSetTimeout(callback, Math.min(ms, 5), ...args);
  global.fetch = async () => new Response(JSON.stringify({ success: true, data: { accessToken, refreshToken: 'refresh' } }), { status: 200 });
  try {
    await assert.rejects(delayedAuth.googleSession('google-id-token'), error => !(error instanceof delayedAuth.GoogleUserNotRegistered) && /프로필 조회가 지연/.test(error.message));
  } finally { global.fetch = originalFetch; global.setTimeout = originalSetTimeout; }
});

test('email registration and login submit the verification code directly to auth', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const accessToken = `e30.${Buffer.from(JSON.stringify({ userId: 42, role: 'STUDENT' })).toString('base64url')}.signature`;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: url.endsWith('/register') ? { id: 42 } : { accessToken, refreshToken: 'refresh' } }), { status: 200 });
  };
  try {
    await authApi.registerEmail('student@example.com', '민지', 'STUDENT', '123456');
    const session = await emailSession('student@example.com', '654321');
    assert.equal(calls[0].url, 'http://localhost:8080/api/auth/register');
    assert.deepEqual(JSON.parse(calls[0].options.body), { email_id: 'student@example.com', name: '민지', role: 'STUDENT', verificationToken: '123456' });
    assert.equal(calls[1].url, 'http://localhost:8080/api/auth/login');
    assert.deepEqual(JSON.parse(calls[1].options.body), { email_id: 'student@example.com', verificationToken: '654321' });
    assert.equal(calls[1].options.headers.has('Authorization'), false);
    assert.deepEqual(session.user, fakeProfile);
  } finally { global.fetch = originalFetch; }
});

test('only a Google login 404 is treated as an unregistered user', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ status: 404, message: '가입되지 않은 사용자' }), { status: 404 });
  try { await assert.rejects(googleSession('google-id-token'), GoogleUserNotRegistered); }
  finally { global.fetch = originalFetch; }
});

test('Google 401 exposes the audience and server message without the ID token', async () => {
  const originalFetch = global.fetch;
  const token = `e30.${Buffer.from(JSON.stringify({ aud: 'client.apps.googleusercontent.com' })).toString('base64url')}.signature`;
  global.fetch = async () => new Response(JSON.stringify({ status: 401, message: '유효하지 않은 Google 인증 정보' }), { status: 401 });
  try {
    for (const action of [() => authApi.loginGoogle(token), () => authApi.registerGoogle(token, 'STUDENT')]) {
      await assert.rejects(action(), error => error instanceof http.ApiError && error.status === 401 && error.message.includes('유효하지 않은 Google 인증 정보') && error.message.includes('client.apps.googleusercontent.com') && !error.message.includes(token));
    }
    await assert.rejects(authApi.loginGoogle('invalid'), error => error instanceof http.ApiError && error.message === '유효하지 않은 Google 인증 정보');
  } finally { global.fetch = originalFetch; }
});

test('Google login 403 and registration 409 preserve the server error', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response(JSON.stringify({ status: 403, message: '탈퇴하거나 정지된 계정입니다' }), { status: 403 });
    await assert.rejects(googleSession('google-id-token'), error => error instanceof http.ApiError && error.status === 403 && error.message === '탈퇴하거나 정지된 계정입니다');
    global.fetch = async () => new Response(JSON.stringify({ status: 409, message: '이미 가입된 이메일입니다' }), { status: 409 });
    await assert.rejects(authApi.registerGoogle('google-id-token', 'STUDENT'), error => error instanceof http.ApiError && error.status === 409 && error.message === '이미 가입된 이메일입니다');
  } finally { global.fetch = originalFetch; }
});

test('a missing profile does not start Google registration', async () => {
  const originalFetch = global.fetch;
  const accessToken = `e30.${Buffer.from(JSON.stringify({ userId: 42, role: 'STUDENT' })).toString('base64url')}.signature`;
  const { googleSession: login } = loadTypeScript('src/services/auth.ts', { './http': http, './user': { userApi: { get: async () => { throw new http.ApiError(404, '프로필 없음'); } } } });
  global.fetch = async () => new Response(JSON.stringify({ success: true, data: { accessToken, refreshToken: 'refresh' } }), { status: 200 });
  try { await assert.rejects(login('google-id-token'), error => error instanceof http.ApiError && error.status === 404); }
  finally { global.fetch = originalFetch; }
});

test('email login allows a new code when profile loading fails after code consumption', async () => {
  const originalFetch = global.fetch;
  const accessToken = `e30.${Buffer.from(JSON.stringify({ userId: 42, role: 'STUDENT' })).toString('base64url')}.signature`;
  const { emailSession: login, EmailLoginCompletionError } = loadTypeScript('src/services/auth.ts', { './http': http, './user': { userApi: { get: async () => { throw new http.ApiError(503, '프로필 조회 실패'); } } } });
  global.fetch = async () => new Response(JSON.stringify({ success: true, data: { accessToken, refreshToken: 'refresh' } }), { status: 200 });
  try { await assert.rejects(login('student@example.com', '123456'), error => error instanceof EmailLoginCompletionError && error.message.includes('프로필 조회 실패') && error.message.includes('인증코드를 새로 받아')); }
  finally { global.fetch = originalFetch; }
});

test('unwrapped server errors retain their message', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ status: 403, message: '권한이 없습니다' }), { status: 403 });
  try { await assert.rejects(scheduleApi.list(7, 'test-token'), error => error.status === 403 && error.message === '권한이 없습니다'); }
  finally { global.fetch = originalFetch; }
});


test('HTTP status remains available for non-JSON errors', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('Unauthorized', { status: 401 });
  try { await assert.rejects(scheduleApi.list(7, 'test-token'), error => error.status === 401); }
  finally { global.fetch = originalFetch; }
});

test('unexpected JSON error bodies preserve HTTP status and a usable message', async () => {
  const originalFetch = global.fetch;
  try {
    for (const body of ['null', '[]', '"failure"', '{"message":42}']) {
      global.fetch = async () => new Response(body, { status: 503 });
      await assert.rejects(scheduleApi.list(7, 'test-token'), error => error instanceof http.ApiError && error.status === 503 && error.message === '요청을 처리하지 못했어요.');
    }
    global.fetch = async () => new Response('null', { status: 200 });
    await assert.rejects(scheduleApi.list(7, 'test-token'), { message: '서버 응답을 읽을 수 없어요.' });
  } finally { global.fetch = originalFetch; }
});

test('only authenticated 401 responses notify the session handler', async () => {
  const originalFetch = global.fetch;
  const tokens = [];
  const unsubscribe = http.onUnauthorized(token => tokens.push(token));
  global.fetch = async () => new Response(JSON.stringify({ status: 401, message: '인증 실패' }), { status: 401 });
  try {
    await assert.rejects(emailApi.verifyCode('student@example.com', '123456'), { status: 401 });
    await assert.rejects(scheduleApi.list(7, 'expired-token'), { status: 401 });
    assert.deepEqual(tokens, ['expired-token']);
    unsubscribe();
    await assert.rejects(scheduleApi.list(7, 'another-token'), { status: 401 });
    assert.deepEqual(tokens, ['expired-token']);
  } finally { unsubscribe(); global.fetch = originalFetch; }
});


test('classroom endpoints accept direct JSON and empty leave responses', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/leave')) return new Response(null, { status: 200 });
    const data = options.method === 'POST' || url.includes('?') ? { id: 7, classroomId: 7, name: '수학', calendar: [] } : [{ id: 7, name: '수학' }];
    return new Response(JSON.stringify(data), { status: 200 });
  };
  try {
    assert.equal((await classroomApi.list('token'))[0].id, 7);
    await classroomApi.create('수학', 'token');
    await classroomApi.join('AB12CD34', 'token');
    assert.equal((await classroomApi.home(7, 2026, 11, 'token')).name, '수학');
    assert.equal(await classroomApi.leave(7, 'token'), undefined);
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token');
    assert.deepEqual(JSON.parse(calls[1].options.body), { name: '수학' });
    assert.deepEqual(JSON.parse(calls[2].options.body), { classCode: 'AB12CD34' });
    assert.equal(calls[3].url, 'http://localhost:8080/api/class/7?year=2026&month=11');
    assert.equal(calls[4].options.method, 'DELETE');
  } finally { global.fetch = originalFetch; }
});


test('classroom requests stop waiting and distinguish unknown write outcomes', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  try {
    await assert.rejects(classroomRequest('/api/class', {}, 'token', 5), error => error instanceof ClassroomTimeoutError && error.message.includes('서버 응답'));
    await assert.rejects(classroomRequest('/api/class', { method: 'POST' }, 'token', 5), error => error instanceof ClassroomTimeoutError && error.message.includes('수업 목록'));
  } finally { global.fetch = originalFetch; }
});


test('absence timeout distinguishes list loading from an uncertain write', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  try {
    await assert.rejects(absenceRequest('/api/class/absences/7/me', {}, 'token', 5), /조회가 지연/);
    await assert.rejects(absenceRequest('/api/class/absences/7', { method: 'POST' }, 'token', 5), /신청 내역을 확인/);
  } finally { global.fetch = originalFetch; }
});

test('absence requests use the server date field and authenticated action endpoints', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const result = { id: 10, class_id: 7, student_id: 3, absence_date: '2026-11-12', reason: '병원', status: 'PENDING' };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: result }), { status: options.method === 'POST' ? 201 : 200 });
  };
  try {
    assert.deepEqual(await absenceApi.create(7, '2026-11-12', '병원', 'token'), result);
    await absenceApi.approve(10, 'token');
    await absenceApi.reject(10, 'token');
    await absenceApi.cancel(10, 'token');
    assert.equal(calls[0].url, 'http://localhost:8080/api/class/absences/7');
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { absence_date: '2026-11-12', reason: '병원' });
    assert.equal(calls[1].url, 'http://localhost:8080/api/class/absences/10/approve');
    assert.equal(calls[1].options.method, 'PATCH');
    assert.equal(calls[2].url, 'http://localhost:8080/api/class/absences/10/reject');
    assert.equal(calls[3].options.method, 'DELETE');
    assert.equal(calls[3].url, 'http://localhost:8080/api/class/absences/10');
  } finally { global.fetch = originalFetch; }
});


test('notification lists reject malformed items and pagination', () => {
  const page = { content: [{ notificationId: 8, message: '새 알림', isRead: false }], number: 0, last: true };
  assert.deepEqual(validateNotificationPage(page), page);
  assert.throws(() => validateNotificationPage({ ...page, number: -1 }));
  assert.throws(() => validateNotificationPage({ ...page, content: [{ ...page.content[0], isRead: 'false' }] }));
  assert.throws(() => validateNotificationPage({ ...page, content: [{ ...page.content[0], message: null }] }));
  assert.throws(() => validateNotificationPage(page, 1));
  assert.deepEqual(mergeNotificationItems([{ id: '1' }], [{ id: '1' }, { id: '2' }, { id: '2' }]), [{ id: '1' }, { id: '2' }]);
});

test('notifications use authenticated pagination and server deletion', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const page = { content: [{ notificationId: 8, message: '새 알림', isRead: false }], number: 1, last: true };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: options.method === 'DELETE' ? null : page }), { status: 200 });
  };
  try {
    assert.deepEqual(await notificationApi.list('token', 1), page);
    await notificationApi.remove(8, 'token');
    assert.equal(calls[0].url, 'http://localhost:8080/notifications?page=1&size=20');
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer token');
    assert.equal(calls[1].url, 'http://localhost:8080/notifications/8');
    assert.equal(calls[1].options.method, 'DELETE');
  } finally { global.fetch = originalFetch; }
});


test('schedule accessibility preserves full start and end dates', () => {
  assert.equal(scheduleAccessibility('2026-11-12 23:30:00', '2026-11-13 00:30:00'), '시작 2026년 11월 12일 23:30, 종료 2026년 11월 13일 00:30');
  assert.match(scheduleAccessibility('2026-11-12 23:30:00', 'invalid'), /종료 시간을 확인할 수 없어요/);
});


test('notification loading can recover when the server does not respond', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  try {
    await assert.rejects(notificationApi.list('token', 0, 5), { message: '알림 조회가 지연되고 있어요. 잠시 후 다시 시도해주세요.' });
  } finally { global.fetch = originalFetch; }
});


test('network failures are understandable without masking cancellation', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => { throw new TypeError('Network request failed'); };
    await assert.rejects(scheduleApi.list(7, 'token'), { message: '서버에 연결하지 못했어요. 네트워크 연결을 확인해주세요.' });
    const cancelled = new Error('aborted');
    cancelled.name = 'AbortError';
    global.fetch = async () => { throw cancelled; };
    await assert.rejects(scheduleApi.list(7, 'token'), error => error === cancelled);
  } finally { global.fetch = originalFetch; }
});


test('absence lists use separate student and teacher endpoints', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const entries = [{ id: 12, class_id: 7, student_id: 3, student_name: '학생', absence_date: '2026-11-12', reason: '병원', status: 'PENDING' }];
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ success: true, data: entries }), { status: 200 }); };
  try {
    assert.deepEqual(await absenceApi.listMine(7, 'student-token'), entries);
    assert.deepEqual(await absenceApi.listClass(7, 'teacher-token'), entries);
    assert.equal(calls[0].url, 'http://localhost:8080/api/class/absences/7/me');
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer student-token');
    assert.equal(calls[1].url, 'http://localhost:8080/api/class/absences/7');
    assert.equal(calls[1].options.headers.get('Authorization'), 'Bearer teacher-token');
    await absenceApi.listClass(7, 'teacher-token', { status: 'PENDING', year: 2026, month: 11 });
    assert.equal(calls[2].url, 'http://localhost:8080/api/class/absences/7?status=PENDING&year=2026&month=11');
    await absenceApi.listClass(7, 'teacher-token', { month: 11 });
    assert.equal(calls[3].url, 'http://localhost:8080/api/class/absences/7?month=11');
  } finally { global.fetch = originalFetch; }
});

test('absence dates before the local current day are rejected', () => {
  const now = new Date(2026, 10, 10, 23, 59);
  assert.equal(isPastAbsenceDate('2026-11-09', now), true);
  assert.equal(isPastAbsenceDate('2026-11-10', now), false);
  assert.equal(isPastAbsenceDate('2026-11-11', now), false);
});


test('absence statuses distinguish pending, approval, rejection and cancellation', () => {
  assert.deepEqual(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'].map(absenceStatusLabel), ['승인 대기', '수락됨', '거절됨', '취소됨']);
});


test('absence lists reject records for another class or student', () => {
  const own = { id: 12, class_id: 7, student_id: 3, student_name: '학생', absence_date: '2026-11-12', reason: '병원', status: 'CANCELED' };
  assert.deepEqual(validateAbsenceList([own], 7, 3), [own]);
  assert.deepEqual(validateAbsenceList([own], 7), [own]);
  assert.throws(() => validateAbsenceList([{ ...own, class_id: 8 }], 7, 3));
  assert.throws(() => validateAbsenceList([{ ...own, student_id: 4 }], 7, 3));
  assert.throws(() => validateAbsenceList([{ ...own, status: 'UNKNOWN' }], 7, 3));
});
