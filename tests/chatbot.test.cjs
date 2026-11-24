const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', code)(name => overrides[name] ?? require(name), module, module.exports, true);
  return module.exports;
}
const http = load('src/services/http.ts', { 'react-native': { Platform: { OS: 'ios' } } });
const { queryChatbot, validateChatbotResponse, chatbotApi } = load('src/services/chatbot.ts', { './http': http });

test('chatbot validates each response type including empty and omitted null data', () => {
  const student = { studentId: 2, classId: 4, name: '학생', className: '수학', absenceCount: 3, makeupCount: 1 };
  assert.equal(validateChatbotResponse({ type: 'STUDENT', message: '찾았어요', data: [student] }).data[0].name, '학생');
  assert.equal(validateChatbotResponse({ type: 'GUIDE', message: '안내' }).type, 'GUIDE');
  assert.deepEqual(validateChatbotResponse({ type: 'RECOMMEND_TIME', message: '없어요', data: [] }).data, []);
  assert.equal(validateChatbotResponse({ type: 'MONTHLY_STATUS', message: '현황', data: { year: 2026, month: 11, absenceCount: 1, makeupCount: 2, pendingMakeupCount: 0 } }).data.month, 11);
  assert.throws(() => validateChatbotResponse({ type: 'STUDENT', message: 'x', data: [{ name: '학생' }] }));
  assert.throws(() => validateChatbotResponse({ type: 'UNKNOWN', message: 'x', data: [] }));
});

test('chatbot sends trimmed question and optional class scope with bearer token', async () => {
  const oldFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: { type: 'GUIDE', message: '안내' } }) }; };
  try {
    await queryChatbot(' 이번달 현황 ', 'secret');
    await queryChatbot('보강 추천', 'secret', 9);
    assert.equal(new URL(calls[0].url).pathname, '/api/chatbot/query');
    assert.deepEqual(JSON.parse(calls[0].options.body), { message: '이번달 현황' });
    assert.deepEqual(JSON.parse(calls[1].options.body), { message: '보강 추천', classId: 9 });
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer secret');
    await assert.rejects(queryChatbot('  ', 'secret'));
    await assert.rejects(queryChatbot('a'.repeat(201), 'secret'));
    await assert.rejects(queryChatbot('추천', 'secret', -1));
  } finally { global.fetch = oldFetch; }
});

test('chatbot errors retain nested server message and legacy endpoints stay available', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ success: false, error: { message: '선생님만 이용할 수 있습니다', code: 'FORBIDDEN' } }) });
  try {
    await assert.rejects(queryChatbot('현황', 'secret'), error => error.status === 403 && error.message === '선생님만 이용할 수 있습니다' && error.code === 'FORBIDDEN');
    assert.equal(typeof chatbotApi.students, 'function');
    assert.equal(typeof chatbotApi.monthlyStatus, 'function');
  } finally { global.fetch = oldFetch; }
});

test('cancelling a slow chatbot request aborts the network request', async () => {
  const originalFetch = global.fetch;
  let requestSignal;
  global.fetch = async (_url, options) => {
    requestSignal = options.signal;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => { const error = new Error('cancelled'); error.name = 'AbortError'; reject(error); }, { once: true });
    });
  };
  try {
    const controller = new AbortController();
    const pending = queryChatbot('이번달 현황', 'secret', undefined, controller.signal);
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(requestSignal.aborted, true);
  } finally { global.fetch = originalFetch; }
});

test('an already cancelled request never reaches the server', async () => {
  const oldFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error('unexpected request'); };
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(queryChatbot('현황', 'secret', undefined, controller.signal), error => error.name === 'AbortError');
    assert.equal(calls, 0);
  } finally { global.fetch = oldFetch; }
});
