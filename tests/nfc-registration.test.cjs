const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), mod, mod.exports);
  return mod.exports;
}

function nativeFixture(status = { status: 2, capacity: 128 }, detected = 'Ndef') {
  const calls = [];
  const manager = {
    async start() { calls.push('start'); }, async isSupported() { return true; }, async isEnabled() { return true; },
    async requestTechnology(tech, options) { calls.push(['request', tech, options]); return detected; },
    async cancelTechnologyRequest() { calls.push('cancel'); },
    async getTag() { return { ndefMessage: [{ tnf: 1, type: 'U', payload: [1] }] }; },
    async setAlertMessageIOS() {},
    ndefHandler: {
      async getNdefStatus() { calls.push('status'); return status; },
      async writeNdefMessage(bytes) { calls.push(['write', bytes]); },
    },
    ndefFormatableHandlerAndroid: { async formatNdef(bytes) { calls.push(['format', bytes]); } },
  };
  const nfc = { __esModule: true, default: manager, NfcTech: { Ndef: 'Ndef', NdefFormatable: 'NdefFormatable' }, NdefStatus: { ReadWrite: 2 }, NfcAdapter: { FLAG_READER_NFC_A: 1, FLAG_READER_NFC_B: 2, FLAG_READER_NFC_F: 4, FLAG_READER_NFC_V: 8 }, Ndef: { uriRecord: url => ({ url }), encodeMessage: records => [1, 2, records[0].url.length], TNF_WELL_KNOWN: 1, RTD_TEXT: 'T', RTD_URI: 'U', isType: (record, tnf, type) => record.tnf === tnf && record.type === type, uri: { decodePayload: () => 'https://refit.team/nfc/attendance?token=abc' } } };
  return { calls, manager, service: load('src/services/nfc.native.ts', { 'react-native': { Platform: { OS: 'android' } }, 'react-native-nfc-manager': nfc }) };
}

test('NFC registration writes the issued URL and closes the NFC session', async () => {
  const { service, calls } = nativeFixture();
  await service.writeAttendanceUrl('https://refit.team/nfc/attendance?token=abc');
  assert.deepEqual(calls.find(call => Array.isArray(call) && call[0] === 'request'), ['request', ['Ndef', 'NdefFormatable'], { isReaderModeEnabled: true, readerModeFlags: 15 }]);
  assert.deepEqual(calls.slice(-3), ['status', ['write', [1, 2, 43]], 'cancel']);
});

test('Android formats an NDEF-formatable tag with the issued URL', async () => {
  const { service, calls } = nativeFixture({ status: 2, capacity: 128 }, 'NdefFormatable');
  await service.writeAttendanceUrl('https://refit.team/nfc/attendance?token=abc');
  assert.deepEqual(calls.slice(-2), [['format', [1, 2, 43]], 'cancel']);
  assert.equal(calls.includes('status'), false);
});

test('unsupported detected tags show an error instead of attempting a write', async () => {
  const { service, calls } = nativeFixture({ status: 2, capacity: 128 }, null);
  await assert.rejects(service.writeAttendanceUrl('https://refit.team/nfc/attendance?token=abc'), /기록할 수 없어요/);
  assert.equal(calls.at(-1), 'cancel');
  assert.equal(calls.some(call => Array.isArray(call) && (call[0] === 'write' || call[0] === 'format')), false);
});

test('an undetected tag stops waiting and releases the NFC session', async () => {
  const { service, calls } = nativeFixture({ status: 2, capacity: 128 }, new Promise(() => {}));
  const original = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => original(fn, ms === 30000 ? 5 : ms, ...args);
  try {
    await assert.rejects(service.writeAttendanceUrl('https://refit.team/nfc/attendance?token=abc'), /태그를 찾지 못했어요/);
    assert.equal(calls.at(-1), 'cancel');
  } finally { global.setTimeout = original; }
});

test('read-only or too-small tags are not overwritten and sessions close', async () => {
  for (const [status, expected] of [[{ status: 3, capacity: 128 }, /쓰기 가능한/], [{ status: 2, capacity: 2 }, /저장 공간/]]) {
    const { service, calls } = nativeFixture(status);
    await assert.rejects(service.writeAttendanceUrl('https://refit.team/nfc/attendance?token=abc'), expected);
    assert.equal(calls.at(-1), 'cancel');
    assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'write'), false);
  }
});

test('a cancelled registration does not start a tag session', async () => {
  const { service, calls } = nativeFixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.writeAttendanceUrl('https://refit.team/nfc/attendance?token=abc', controller.signal), /취소/);
  assert.equal(calls.length, 0);
});

test('student attendance reads the issued token in Android reader mode', async () => {
  const { service, calls } = nativeFixture();
  assert.equal(await service.readAttendanceToken(), 'abc');
  assert.deepEqual(calls.find(call => Array.isArray(call) && call[0] === 'request'), ['request', 'Ndef', { isReaderModeEnabled: true, readerModeFlags: 15 }]);
  assert.equal(calls.at(-1), 'cancel');
});

test('cancelling an active NFC scan closes the reader only once', async () => {
  const { service, calls, manager } = nativeFixture();
  let rejectRequest;
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  manager.requestTechnology = async () => { started(); return new Promise((_, reject) => { rejectRequest = reject; }); };
  manager.cancelTechnologyRequest = async () => { calls.push('cancel'); rejectRequest(new Error('cancelled')); };
  const controller = new AbortController();
  const reading = service.readAttendanceToken(controller.signal);
  await startedPromise;
  controller.abort();
  await assert.rejects(reading, /취소/);
  assert.equal(calls.filter(item => item === 'cancel').length, 1);
});

test('attendance offers only the student’s regular and approved makeup sessions', () => {
  const schedule = load('src/services/schedule.ts', { './http': {} });
  const { nfcAttendanceChoices, validateNfcMakeups } = load('src/services/nfcAttendance.ts', { './schedule': schedule });
  const now = new Date(2026, 10, 25, 15, 0);
  const schedules = [
    { scheduleId: 10, classId: 1, studentId: 7, startTime: '2026-11-25 15:00:00', endTime: '2026-11-25 16:00:00' },
    { scheduleId: 11, classId: 1, studentId: 7, startTime: '2026-11-20 14:00:00', endTime: '2026-11-20 15:00:00' },
    { scheduleId: 12, classId: 1, studentId: 8, startTime: '2026-11-25 15:00:00', endTime: '2026-11-25 16:00:00' },
  ];
  const makeups = [
    { id: 1, class_id: 1, student_id: 7, schedule_id: 11, approval_status: 1, makeup_time: '2026-11-25T17:00:00' },
    { id: 2, class_id: 1, student_id: 7, schedule_id: 11, approval_status: 0, makeup_time: '2026-11-25T18:00:00' },
    { id: 3, class_id: 1, student_id: 8, schedule_id: 11, approval_status: 1, makeup_time: '2026-11-25T19:00:00' },
  ];
  const choices = nfcAttendanceChoices(schedules, makeups, 1, 7, now);
  assert.deepEqual(choices.map(item => item.scheduleId), [10, 11]);
  assert.match(choices[1].label, /보강 수업.*17:00.*18:00/);
  assert.throws(() => validateNfcMakeups([null], 1, 7), /확인할 수 없어요/);
  assert.throws(() => validateNfcMakeups([makeups[2]], 1, 7), /확인할 수 없어요/);
  assert.deepEqual(validateNfcMakeups(makeups.slice(0, 2), 1, 7), makeups.slice(0, 2));
});

test('issued registration survives restart and is isolated by teacher and class', async () => {
  const values = new Map();
  const store = { async isAvailableAsync() { return true; }, async getItemAsync(key) { return values.get(key) ?? null; }, async setItemAsync(key, value) { values.set(key, value); }, async deleteItemAsync(key) { values.delete(key); } };
  const service = load('src/services/nfcRegistration.ts', { 'react-native': { Platform: { OS: 'ios' } }, 'expo-modules-core': { requireOptionalNativeModule: () => ({}) }, 'expo-secure-store': store });
  const pending = { id: 9, name: '교실 태그', url: 'https://refit.team/nfc/attendance?token=abc', written: false };
  await service.savePendingNfcRegistration(1, 7, pending);
  assert.deepEqual(await service.loadPendingNfcRegistration(1, 7), pending);
  assert.equal(await service.loadPendingNfcRegistration(2, 7), null);
  assert.equal(await service.loadPendingNfcRegistration(1, 8), null);
  await service.savePendingNfcRegistration(1, 7, { ...pending, written: true });
  assert.equal((await service.loadPendingNfcRegistration(1, 7)).written, true);
  await service.clearPendingNfcRegistration(1, 7);
  assert.equal(await service.loadPendingNfcRegistration(1, 7), null);
  await assert.rejects(service.savePendingNfcRegistration(1, 7, { ...pending, url: 'https://example.com/no-token' }), /등록 정보/);
});

test('failed NFC writing keeps the issued registration without linking', async () => {
  const service = load('src/services/nfcRegistration.ts', { 'react-native': { Platform: { OS: 'ios' } } });
  const item = { id: 9, name: '교실 태그', url: 'https://refit.team/nfc/attendance?token=abc', written: false };
  const calls = [];
  const ops = { save: async value => calls.push(['save', value.written]), linkedId: async () => undefined, write: async () => { throw new Error('사용자 취소'); }, link: async () => calls.push('link'), clear: async () => calls.push('clear'), onWritten: () => calls.push('written') };
  await assert.rejects(service.completeNfcRegistration(item, ops), /사용자 취소/);
  assert.deepEqual(calls, [['save', false]]);
});

test('registration resumes after linking failure without rewriting a tag', async () => {
  const service = load('src/services/nfcRegistration.ts', { 'react-native': { Platform: { OS: 'ios' } } });
  let saved;
  let writes = 0;
  let links = 0;
  let cleared = 0;
  const item = { id: 9, name: '교실 태그', url: 'https://refit.team/nfc/attendance?token=abc', written: false };
  const ops = { save: async value => { saved = value; }, linkedId: async () => undefined, write: async () => { writes++; }, link: async () => { if (++links === 1) throw new Error('연결 실패'); }, clear: async () => { cleared++; }, onWritten: () => {} };
  await assert.rejects(service.completeNfcRegistration(item, ops), /연결 실패/);
  assert.equal(saved.written, true);
  assert.equal(cleared, 0);
  await service.completeNfcRegistration(saved, ops);
  assert.equal(writes, 1);
  assert.equal(links, 2);
  assert.equal(cleared, 1);
});

test('a lost link response is reconciled and conflicting classes are not overwritten', async () => {
  const service = load('src/services/nfcRegistration.ts', { 'react-native': { Platform: { OS: 'ios' } } });
  const item = { id: 9, name: '교실 태그', url: 'https://refit.team/nfc/attendance?token=abc', written: true };
  let linked;
  let cleared = false;
  const ops = { save: async () => {}, linkedId: async () => linked, write: async () => assert.fail('already written'), link: async () => { linked = 9; throw new Error('lost response'); }, clear: async () => { cleared = true; }, onWritten: () => {} };
  await service.completeNfcRegistration(item, ops);
  assert.equal(cleared, true);
  linked = 7; cleared = false;
  await assert.rejects(service.completeNfcRegistration({ ...item, written: false }, ops), /이미 다른 태그/);
  assert.equal(cleared, false);
});
