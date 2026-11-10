import { request } from './http';

export type ServerNotification = { notificationId: number; message: string; notificationType: string; createdAt: string; isRead: boolean };
export type NotificationPage = { content: ServerNotification[]; number: number; last: boolean };
export const notificationApi = {
  list: async (token: string, page = 0, timeoutMs = 15000) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try { return await request<NotificationPage>(`/notifications?page=${page}&size=20`, { signal: controller.signal }, token); }
    catch (error) {
      if (timedOut) throw new Error('알림 조회가 지연되고 있어요. 잠시 후 다시 시도해주세요.');
      throw error;
    } finally { clearTimeout(timer); }
  },
  remove: (id: number, token: string) => request<void>(`/notifications/${id}`, { method: 'DELETE' }, token),
};
