import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { jsonBody, request } from './http';

dayjs.extend(customParseFormat);
export const serverDateFormat = 'YYYY-MM-DD HH:mm:ss';
export const parseServerDate = (value: string) => dayjs(value, serverDateFormat, true);
export type Schedule = { scheduleId: number; classId: number; studentId: number; startTime: string; endTime: string };
export type ScheduleInput = { studentId: number; startTime: string; endTime: string };
export function validateScheduleList(value: unknown, classId: number): Schedule[] {
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object'
    && Number.isSafeInteger(item.scheduleId) && item.scheduleId > 0 && item.classId === classId
    && Number.isSafeInteger(item.studentId) && item.studentId > 0
    && typeof item.startTime === 'string' && typeof item.endTime === 'string')) {
    throw new Error('수업 일정을 확인할 수 없어요.');
  }
  return value as Schedule[];
}
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
export async function scheduleRequest<T>(path: string, options: RequestInit, token: string, timeoutMs = 20000): Promise<T | undefined> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try { return await request<T>(path, { ...options, signal: controller.signal }, token); }
  catch (error) {
    if (timedOut) throw new Error(options.method && options.method !== 'GET'
      ? '요청 결과를 확인하지 못했어요. 시간표를 확인한 후 다시 시도해주세요.'
      : '시간표 조회가 지연되고 있어요. 잠시 후 다시 시도해주세요.');
    throw error;
  } finally { clearTimeout(timer); }
}
export const scheduleApi = {
  list: (classId: number, token: string) => scheduleRequest<Schedule[]>(`/api/class/schedule/${classId}`, {}, token),
  calendar: (classId: number, year: number, month: number, token: string) => scheduleRequest<Schedule[]>(`/api/class/calendar/${classId}?year=${year}&month=${month}`, {}, token),
  create: (classId: number, input: ScheduleInput, token: string) => scheduleRequest<number>(`/api/class/schedule/${classId}`, { method: 'POST', ...jsonBody({ student_id: input.studentId, start_time: input.startTime, end_time: input.endTime }) }, token),
  update: (classId: number, scheduleId: number, input: Omit<ScheduleInput, 'studentId'>, token: string) => scheduleRequest<void>(`/api/class/schedule/${classId}/${scheduleId}`, { method: 'PATCH', ...jsonBody({ start_time: input.startTime, end_time: input.endTime }) }, token),
  remove: (classId: number, scheduleId: number, token: string) => scheduleRequest<void>(`/api/class/schedule/${classId}/${scheduleId}`, { method: 'DELETE' }, token),
};
