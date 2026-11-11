import { jsonBody, request } from './http';

export type ServerNotice = { noticeId: number; classId: number; writerId: number; title: string; content: string; createdAt: string };
export type Attendance = { id: number; class_id: number; schedule_id: number; student_id: number; attendance_date: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'NOT_CHECKED' };
export type AttendanceRow = { schedule_id: number; student_id: number; student_name: string; status: Attendance['status'] };
export type AttendanceStats = { student_id: number; present_count: number; absent_count: number; late_count: number };
export const noticeApi = {
  list: (id: number, token: string) => request<ServerNotice[]>(`/api/class/notice/${id}`, {}, token),
  create: (id: number, title: string, content: string, token: string) => request<number>(`/api/class/notice/${id}`, { method: 'POST', ...jsonBody({ title, content }) }, token),
  update: (id: number, noticeId: string, title: string, content: string, token: string) => request<void>(`/api/class/notice/${id}/${noticeId}`, { method: 'PATCH', ...jsonBody({ title, content }) }, token),
  remove: (id: number, noticeId: string, token: string) => request<void>(`/api/class/notice/${id}/${noticeId}`, { method: 'DELETE' }, token),
};
export const attendanceApi = {
  mine: (id: number, year: number, month: number, token: string) => request<Attendance[]>(`/api/class/attendance/${id}/me?year=${year}&month=${month}`, {}, token),
  list: (id: number, date: string, token: string) => request<AttendanceRow[]>(`/api/class/attendance/${id}?date=${date}`, {}, token),
  stats: (id: number, year: number, month: number, token: string) => request<AttendanceStats[]>(`/api/class/attendance/stats/${id}?year=${year}&month=${month}`, {}, token),
  set: (id: number, scheduleId: number, status: 'PRESENT' | 'ABSENT', token: string) => request<Attendance>(`/api/class/attendance/${id}/${scheduleId}`, { method: 'PATCH', ...jsonBody({ status }) }, token),
};
