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
const { scheduleApi, parseServerDate, scheduleDates, studentScheduleDates } = loadTypeScript('src/services/schedule.ts', { './http': http });
const { emailApi } = loadTypeScript('src/services/email.ts', { './http': http });
const { userApi } = loadTypeScript('src/services/user.ts', { './http': http, 'react-native': { Platform: { OS: 'ios' } } });
const fakeProfile = { id: 42, name: '민지', role: 'STUDENT' };
const fakeUserApi = { get: async (id, token) => { assert.equal(id, 42); assert.ok(token); return fakeProfile; } };
const { authApi, emailSession, googleSession, GoogleUserNotRegistered } = loadTypeScript('src/services/auth.ts', { './http': http, './user': { userApi: fakeUserApi } });

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

test('a missing profile does not start Google registration', async () => {
  const originalFetch = global.fetch;
  const accessToken = `e30.${Buffer.from(JSON.stringify({ userId: 42, role: 'STUDENT' })).toString('base64url')}.signature`;
  const { googleSession: login } = loadTypeScript('src/services/auth.ts', { './http': http, './user': { userApi: { get: async () => { throw new http.ApiError(404, '프로필 없음'); } } } });
  global.fetch = async () => new Response(JSON.stringify({ success: true, data: { accessToken, refreshToken: 'refresh' } }), { status: 200 });
  try { await assert.rejects(login('google-id-token'), error => error instanceof http.ApiError && error.status === 404); }
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
