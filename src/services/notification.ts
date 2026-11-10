import { request } from './http';

export type ServerNotification = { notificationId: number; message: string; notificationType: string; createdAt: string; isRead: boolean };
export type NotificationPage = { content: ServerNotification[]; number: number; last: boolean };
export const notificationApi = {
  list: (token: string, page = 0) => request<NotificationPage>(`/notifications?page=${page}&size=20`, {}, token),
  remove: (id: number, token: string) => request<void>(`/notifications/${id}`, { method: 'DELETE' }, token),
};
