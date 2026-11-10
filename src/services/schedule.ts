import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { jsonBody, request } from './http';

dayjs.extend(customParseFormat);
export const serverDateFormat = 'YYYY-MM-DD HH:mm:ss';
export const parseServerDate = (value: string) => dayjs(value, serverDateFormat, true);
export type Schedule = { scheduleId: number; classId: number; studentId: number; startTime: string; endTime: string };
export type ScheduleInput = { studentId: number; startTime: string; endTime: string };
export function scheduleAccessibility(startTime: string, endTime: string): string {
  const start = parseServerDate(startTime);
  const end = parseServerDate(endTime);
  if (!start.isValid()) return '시작 시간을 확인할 수 없어요.';
  return `시작 ${start.format('YYYY년 M월 D일 HH:mm')}, ${end.isValid() ? `종료 ${end.format('YYYY년 M월 D일 HH:mm')}` : '종료 시간을 확인할 수 없어요.'}`;
}
export function scheduleDates(schedules: Schedule[]): string[] {
  return [...new Set(schedules.map(item => parseServerDate(item.startTime)).filter(date => date.isValid()).map(date => date.format('YYYY-MM-DD')))];
}
export function studentScheduleDates(schedules: Schedule[], studentId: number | undefined): string[] {
  return studentId === undefined ? [] : scheduleDates(schedules.filter(item => item.studentId === studentId));
}
export const scheduleApi = {
  list: (classId: number, token: string) => request<Schedule[]>(`/api/class/schedule/${classId}`, {}, token),
  calendar: (classId: number, year: number, month: number, token: string) => request<Schedule[]>(`/api/class/calendar/${classId}?year=${year}&month=${month}`, {}, token),
  create: (classId: number, input: ScheduleInput, token: string) => request<number>(`/api/class/schedule/${classId}`, { method: 'POST', ...jsonBody({ student_id: input.studentId, start_time: input.startTime, end_time: input.endTime }) }, token),
  update: (classId: number, scheduleId: number, input: Omit<ScheduleInput, 'studentId'>, token: string) => request<void>(`/api/class/schedule/${classId}/${scheduleId}`, { method: 'PATCH', ...jsonBody({ start_time: input.startTime, end_time: input.endTime }) }, token),
  remove: (classId: number, scheduleId: number, token: string) => request<void>(`/api/class/schedule/${classId}/${scheduleId}`, { method: 'DELETE' }, token),
};
