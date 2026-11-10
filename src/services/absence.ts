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
