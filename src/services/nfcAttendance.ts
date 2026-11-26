import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { Makeup } from './makeup';
import { parseServerDate, type Schedule } from './schedule';

dayjs.extend(customParseFormat);
export type NfcAttendanceChoice = { key: string; scheduleId: number; label: string };

export function validateNfcMakeups(value: unknown, classId: number, studentId: number): Makeup[] {
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object' && Number.isSafeInteger(item.id) && item.id > 0 && item.class_id === classId && item.student_id === studentId && Number.isSafeInteger(item.schedule_id) && item.schedule_id > 0 && [0, 1, 2, 3].includes(item.approval_status) && typeof item.makeup_time === 'string' && dayjs(item.makeup_time, 'YYYY-MM-DDTHH:mm:ss', true).isValid())) throw new Error('보강 일정을 확인할 수 없어요.');
  return value as Makeup[];
}

export function nfcAttendanceChoices(schedules: Schedule[], makeups: Makeup[], classId: number, studentId: number, now = new Date()): NfcAttendanceChoice[] {
  const day = dayjs(now);
  const relevant = (start: dayjs.Dayjs, end: dayjs.Dayjs) => start.isValid() && end.isValid() && (start.isSame(day, 'day') || end.isSame(day, 'day') || (day.hour() === 23 && start.isSame(day.add(1, 'day'), 'day')));
  const mine = schedules.filter(item => item.classId === classId && item.studentId === studentId && Number.isSafeInteger(item.scheduleId) && item.scheduleId > 0);
  const choices: { key: string; scheduleId: number; label: string; sort: number }[] = [];
  for (const schedule of mine) {
    const start = parseServerDate(schedule.startTime);
    const end = parseServerDate(schedule.endTime);
    if (end.isAfter(start) && relevant(start, end)) choices.push({ key: `regular-${schedule.scheduleId}`, scheduleId: schedule.scheduleId, label: `정규 수업 · ${start.format('M월 D일 HH:mm')} ~ ${end.format('HH:mm')}`, sort: start.valueOf() });
    const duration = end.diff(start, 'millisecond');
    if (!start.isValid() || !end.isValid() || duration <= 0) continue;
    for (const makeup of makeups) {
      if (makeup.class_id !== classId || makeup.student_id !== studentId || makeup.schedule_id !== schedule.scheduleId || makeup.approval_status !== 1 || !Number.isSafeInteger(makeup.id) || makeup.id <= 0) continue;
      const makeupStart = dayjs(makeup.makeup_time, 'YYYY-MM-DDTHH:mm:ss', true);
      const makeupEnd = makeupStart.add(duration, 'millisecond');
      if (relevant(makeupStart, makeupEnd)) choices.push({ key: `makeup-${makeup.id}`, scheduleId: schedule.scheduleId, label: `보강 수업 · ${makeupStart.format('M월 D일 HH:mm')} ~ ${makeupEnd.format('HH:mm')}`, sort: makeupStart.valueOf() });
    }
  }
  return choices.sort((a, b) => a.sort - b.sort).map(({ key, scheduleId, label }) => ({ key, scheduleId, label }));
}
