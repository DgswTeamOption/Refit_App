import { jsonBody, request } from './http';

export type Absence = {
  id: number;
  class_id: number;
  student_id: number;
  absence_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  created_at: string;
  updated_at: string;
};
export type AbsenceListItem = Absence & { student_name: string | null };
export function validateAbsenceList(value: unknown, classId: number, studentId?: number): AbsenceListItem[] {
  const statuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED']);
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object' && Number.isSafeInteger(item.id) && item.id > 0 && item.class_id === classId && Number.isSafeInteger(item.student_id) && item.student_id > 0 && (studentId === undefined || item.student_id === studentId) && typeof item.absence_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.absence_date) && typeof item.reason === 'string' && statuses.has(item.status))) {
    throw new Error('결석 신청 내역을 확인할 수 없어요.');
  }
  return value as AbsenceListItem[];
}
export function absenceStatusLabel(status: Absence['status']): string {
  return ({ PENDING: '승인 대기', APPROVED: '수락됨', REJECTED: '거절됨', CANCELED: '취소됨' } as const)[status] ?? '상태 확인 필요';
}
export const absenceApi = {
  listMine: (classId: number, token: string) => request<AbsenceListItem[]>(`/api/class/absences/${classId}/me`, {}, token),
  listClass: (classId: number, token: string) => request<AbsenceListItem[]>(`/api/class/absences/${classId}`, {}, token),
  create: (classId: number, date: string, reason: string, token: string) => request<Absence>(`/api/class/absences/${classId}`, { method: 'POST', ...jsonBody({ absence_date: date, reason }) }, token),
  cancel: (absenceId: number, token: string) => request<void>(`/api/class/absences/${absenceId}`, { method: 'DELETE' }, token),
  approve: (absenceId: number, token: string) => request<Absence>(`/api/class/absences/${absenceId}/approve`, { method: 'PATCH' }, token),
  reject: (absenceId: number, token: string) => request<Absence>(`/api/class/absences/${absenceId}/reject`, { method: 'PATCH' }, token),
};
