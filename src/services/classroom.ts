import { jsonBody, requestRaw } from './http';
import type { Schedule } from './schedule';

export type Classroom = { id: number; name: string; classCode: string | null; teacherName: string; createdAt: string };
export type ClassroomHome = { classroomId: number; name: string; classCode: string | null; teacherName: string; memberCount: number; createdAt: string; calendar: Schedule[] };
export const classroomApi = {
  list: (token: string) => requestRaw<Classroom[]>('/api/class', {}, token),
  create: (name: string, token: string) => requestRaw<Classroom>('/api/class', { method: 'POST', ...jsonBody({ name }) }, token),
  join: (classCode: string, token: string) => requestRaw<Classroom>('/api/class/join', { method: 'POST', ...jsonBody({ classCode }) }, token),
  leave: (id: number, token: string) => requestRaw<void>(`/api/class/${id}/leave`, { method: 'DELETE' }, token),
  home: (id: number, year: number, month: number, token: string) => requestRaw<ClassroomHome>(`/api/class/${id}?year=${year}&month=${month}`, {}, token),
};
