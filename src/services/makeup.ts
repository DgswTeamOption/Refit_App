import { jsonBody, request } from './http';
export type Availability = { id: number; class_id: number; teacher_id: number; schedule_id: number; makeup_time: string; capacity: number; applied_count: number; remaining_capacity: number; is_full: boolean; min_capacity: number; can_change_time: boolean; can_delete: boolean; lock_reason: string | null };
export type Makeup = { id: number; class_id: number; student_id: number; schedule_id: number; makeup_time: string; approval_status: 0 | 1 | 2 | 3 };
export const makeupApi = {
  slots: (id: number, token: string, scheduleId?: number) => request<Availability[]>(`/api/makeups/availability?class_id=${id}${scheduleId ? `&schedule_id=${scheduleId}` : ''}`, {}, token),
  list: (id: number, token: string) => request<Makeup[]>(`/api/class/makeups/${id}`, {}, token),
  createSlot: (id: number, scheduleId: number, time: string, capacity: number, token: string) => request<Availability[]>('/api/makeups/availability', { method: 'POST', ...jsonBody({ class_id: id, schedule_id: scheduleId, makeup_time: [time], capacity }) }, token),
  updateSlot: (id: number, input: { makeup_time?: string; capacity?: number }, token: string) => request<Availability>(`/api/makeups/availability/${id}`, { method: 'PATCH', ...jsonBody(input) }, token),
  removeSlot: (id: number, token: string) => request<void>(`/api/makeups/availability/${id}`, { method: 'DELETE' }, token),
  apply: (id: number, scheduleId: number, time: string, token: string) => request<Makeup>('/api/makeups/request', { method: 'POST', ...jsonBody({ class_id: id, schedule_id: scheduleId, makeup_time: time }) }, token),
  cancel: (id: number, token: string) => request<Makeup>(`/api/makeups/cancel/${id}`, { method: 'PATCH' }, token),
  approve: (id: number, status: 1 | 2, token: string) => request<Makeup>(`/api/makeups/approve/${id}`, { method: 'PATCH', ...jsonBody({ approval_status: status }) }, token),
};
