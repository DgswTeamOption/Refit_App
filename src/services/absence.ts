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
export const absenceApi = {
  create: (classId: number, date: string, reason: string, token: string) => request<Absence>(`/api/class/absences/${classId}`, { method: 'POST', ...jsonBody({ absence_date: date, reason }) }, token),
  cancel: (absenceId: number, token: string) => request<void>(`/api/class/absences/${absenceId}`, { method: 'DELETE' }, token),
  approve: (absenceId: number, token: string) => request<Absence>(`/api/class/absences/${absenceId}/approve`, { method: 'PATCH' }, token),
  reject: (absenceId: number, token: string) => request<Absence>(`/api/class/absences/${absenceId}/reject`, { method: 'PATCH' }, token),
};
