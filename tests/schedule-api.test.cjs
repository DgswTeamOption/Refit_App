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
const { scheduleApi, parseServerDate } = loadTypeScript('src/services/schedule.ts', { './http': http });

test('server dates are parsed strictly without assuming a timezone', () => {
  assert.equal(parseServerDate('2026-08-27 16:00:00').format('YYYY-MM-DD HH:mm:ss'), '2026-08-27 16:00:00');
  assert.equal(parseServerDate('2026-02-30 16:00:00').isValid(), false);
  assert.equal(parseServerDate('2026-08-27T16:00:00Z').isValid(), false);
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
  } finally { global.fetch = originalFetch; }
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
