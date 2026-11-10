const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/store/scopedState.ts'), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', javascript)(loaded, loaded.exports);
const { updateScopedState } = loaded.exports;

test('account-scoped state retains each account and isolates delayed updates', () => {
  const initial = [];
  let states = updateScopedState({}, 'server:1', initial, ['수업 A']);
  states = updateScopedState(states, 'server:2', initial, ['수업 B']);
  states = updateScopedState(states, 'server:1', initial, previous => [...previous, '수업 C']);
  assert.deepEqual(states['server:1'], ['수업 A', '수업 C']);
  assert.deepEqual(states['server:2'], ['수업 B']);
  assert.deepEqual(states.guest ?? initial, []);
  assert.deepEqual(initial, []);
});
