import { jsonBody, requestRaw, withRequestTimeout } from './http';
import { scheduleDates, studentScheduleDates, validateScheduleList, type Schedule } from './schedule';

export type Classroom = { id: number; name: string; classCode: string | null; teacherName: string; createdAt: string };
export type ClassroomHome = { classroomId: number; name: string; classCode: string | null; teacherName: string; memberCount: number; createdAt: string; calendar: Schedule[] };
export function classroomCalendarDates(home: ClassroomHome | undefined, classId: number, studentId?: number): string[] {
  if (!home || home.classroomId !== classId) throw new Error('수업 일정을 확인할 수 없어요.');
  const schedules = validateScheduleList(home.calendar, classId);
  return studentId === undefined ? scheduleDates(schedules) : studentScheduleDates(schedules, studentId);
}
export async function loadClassCalendarDates(
  classIds: number[],
  load: (id: number) => Promise<string[]>,
  onUpdate: (result: { dates: Record<number, string[]>; failed: boolean; complete: boolean }) => void,
): Promise<void> {
  const dates: Record<number, string[]> = {};
  let remaining = classIds.length;
  let failed = false;
  await Promise.all(classIds.map(async id => {
    try { dates[id] = await load(id); }
    catch { failed = true; }
    finally {
      remaining -= 1;
      onUpdate({ dates: { ...dates }, failed, complete: remaining === 0 });
    }
  }));
}
export class ClassroomTimeoutError extends Error {
  constructor(write: boolean) {
    super(write ? '요청 결과를 확인하지 못했어요. 수업 목록을 확인한 후 다시 시도해주세요.' : '서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.');
    this.name = 'ClassroomTimeoutError';
  }
}
export async function classroomRequest<T>(path: string, options: RequestInit, token: string, timeoutMs = 20000): Promise<T | undefined> {
  return withRequestTimeout(signal => requestRaw<T>(path, { ...options, signal }, token), timeoutMs,
    () => new ClassroomTimeoutError(!!options.method && options.method !== 'GET'));
}
export const classroomApi = {
  list: (token: string) => classroomRequest<Classroom[]>('/api/class', {}, token),
  create: (name: string, token: string) => classroomRequest<Classroom>('/api/class', { method: 'POST', ...jsonBody({ name }) }, token),
  join: (classCode: string, token: string) => classroomRequest<Classroom>('/api/class/join', { method: 'POST', ...jsonBody({ classCode }) }, token),
  leave: (id: number, token: string) => classroomRequest<void>(`/api/class/${id}/leave`, { method: 'DELETE' }, token),
  home: (id: number, year: number, month: number, token: string) => classroomRequest<ClassroomHome>(`/api/class/${id}?year=${year}&month=${month}`, {}, token),
};
