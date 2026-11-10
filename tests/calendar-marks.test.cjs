const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/calendarMarks.ts'), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', javascript)(loaded, loaded.exports);
const { attendanceCalendarMarks, latestAbsenceLabel } = loaded.exports;

test('calendar marks reflect status, avoid duplicates, and respect the student', () => {
  const requests = [
    { student: '민지', date: '2026-08-01', kind: 'absence', status: 'pending' },
    { student: '민지', date: '2026-08-02', kind: 'makeup', status: 'pending' },
    { student: '민지', date: '2026-08-03', kind: 'absence', status: 'approved' },
    { student: '민지', date: '2026-08-04', kind: 'makeup', status: 'rejected' },
    { student: '다른 학생', date: '2026-08-05', kind: 'makeup', status: 'approved' },
  ];
  const attendance = [
    { student: '민지', date: '2026-08-03', status: 'absent' },
    { student: '민지', date: '2026-08-06', status: 'present' },
  ];
  assert.deepEqual(attendanceCalendarMarks(requests, attendance, false, '민지'), {
    '2026-08-02': ['pending'], '2026-08-03': ['absence'], '2026-08-06': ['attendance'],
  });
  assert.deepEqual(attendanceCalendarMarks(requests, attendance, true, '선생님')['2026-08-05'], ['makeup']);
});

test('latest absence uses the latest eligible date rather than request order', () => {
  const requests = [
    { student: '민지', date: '2026-08-20', kind: 'absence', status: 'approved' },
    { student: '민지', date: '2026-08-10', kind: 'absence', status: 'approved' },
    { student: '민지', date: '2026-08-26', kind: 'absence', status: 'pending' },
    { student: '민지', date: '2026-08-25', kind: 'absence', status: 'rejected' },
    { student: '민지', date: '2026-09-01', kind: 'absence', status: 'approved' },
  ];
  const attendance = [{ student: '민지', date: '2026-08-23', status: 'absent' }];
  assert.equal(latestAbsenceLabel(requests, attendance, '민지', '2026-08-27'), '8.23');
  assert.equal(latestAbsenceLabel(requests, attendance, '다른 학생', '2026-08-27'), '—');
});
