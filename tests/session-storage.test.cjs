const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/auth/sessionStorage.ts'), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const loaded = { exports: {} };
const localRequire = name => name === 'react-native' ? { Platform: { OS: 'web' } } : require(name);
new Function('require', 'module', 'exports', javascript)(localRequire, loaded, loaded.exports);
const { parseStoredSession } = loaded.exports;
const token = claims => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const now = 1800000000000;
function saved(claims) {
  return { accessToken: token(claims), refreshToken: 'refresh', user: { id: 42, name: '학생', role: 'STUDENT', profileImageUrl: '/uploads/photo.jpg' } };
}
test('stored session restores only an unexpired token for the same user and role', () => {
  const valid = saved({ userId: 42, role: 'STUDENT', exp: now / 1000 + 60 });
  assert.deepEqual(parseStoredSession(JSON.stringify(valid), now), valid);
  for (const claims of [
    { userId: 42, role: 'STUDENT', exp: now / 1000 },
    { userId: 43, role: 'STUDENT', exp: now / 1000 + 60 },
    { userId: 42, role: 'TEACHER', exp: now / 1000 + 60 },
    { userId: 42, role: 'STUDENT' },
  ]) assert.equal(parseStoredSession(JSON.stringify(saved(claims)), now), null);
  assert.equal(parseStoredSession('not json', now), null);
  assert.equal(parseStoredSession(JSON.stringify({ ...valid, refreshToken: '' }), now), null);
});
