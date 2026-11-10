import { jsonBody, requestRaw } from './http';
import { scheduleDates, studentScheduleDates, validateScheduleList, type Schedule } from './schedule';

export type Classroom = { id: number; name: string; classCode: string | null; teacherName: string; createdAt: string };
export type ClassroomHome = { classroomId: number; name: string; classCode: string | null; teacherName: string; memberCount: number; createdAt: string; calendar: Schedule[] };
export function classroomCalendarDates(home: ClassroomHome | undefined, classId: number, studentId?: number): string[] {
  if (!home || home.classroomId !== classId) throw new Error('수업 일정을 확인할 수 없어요.');
  const schedules = validateScheduleList(home.calendar, classId);
  return studentId === undefined ? scheduleDates(schedules) : studentScheduleDates(schedules, studentId);
}
export class ClassroomTimeoutError extends Error {
  constructor(write: boolean) {
    super(write ? '요청 결과를 확인하지 못했어요. 수업 목록을 확인한 후 다시 시도해주세요.' : '서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.');
    this.name = 'ClassroomTimeoutError';
  }
}
export async function classroomRequest<T>(path: string, options: RequestInit, token: string, timeoutMs = 20000): Promise<T | undefined> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await requestRaw<T>(path, { ...options, signal: controller.signal }, token);
  } catch (error) {
    if (timedOut) throw new ClassroomTimeoutError(!!options.method && options.method !== 'GET');
    throw error;
  } finally { clearTimeout(timer); }
}
export const classroomApi = {
  list: (token: string) => classroomRequest<Classroom[]>('/api/class', {}, token),
  create: (name: string, token: string) => classroomRequest<Classroom>('/api/class', { method: 'POST', ...jsonBody({ name }) }, token),
  join: (classCode: string, token: string) => classroomRequest<Classroom>('/api/class/join', { method: 'POST', ...jsonBody({ classCode }) }, token),
  leave: (id: number, token: string) => classroomRequest<void>(`/api/class/${id}/leave`, { method: 'DELETE' }, token),
  home: (id: number, year: number, month: number, token: string) => classroomRequest<ClassroomHome>(`/api/class/${id}?year=${year}&month=${month}`, {}, token),
};
