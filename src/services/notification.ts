import { request } from './http';

export type ServerNotification = { notificationId: number; message: string; notificationType: string; createdAt: string; isRead: boolean };
export type NotificationPage = { content: ServerNotification[]; number: number; last: boolean };
export function validateNotificationPage(value: unknown): NotificationPage {
  if (!value || typeof value !== 'object') throw new Error('알림 목록을 확인할 수 없어요.');
  const page = value as Partial<NotificationPage>;
  if (!Array.isArray(page.content) || typeof page.last !== 'boolean' || !Number.isSafeInteger(page.number) || (page.number ?? -1) < 0
    || !page.content.every(item => item && Number.isSafeInteger(item.notificationId) && item.notificationId > 0 && typeof item.message === 'string' && typeof item.isRead === 'boolean')) {
    throw new Error('알림 목록을 확인할 수 없어요.');
  }
  return page as NotificationPage;
}
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
