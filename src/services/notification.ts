import { request, withRequestTimeout } from './http';

export type ServerNotification = { notificationId: number; message: string; notificationType: string; createdAt: string; isRead: boolean };
export type NotificationPage = { content: ServerNotification[]; number: number; last: boolean };
export function validateNotificationPage(value: unknown, expectedPage?: number): NotificationPage {
  if (!value || typeof value !== 'object') throw new Error('알림 목록을 확인할 수 없어요.');
  const page = value as Partial<NotificationPage>;
  if (!Array.isArray(page.content) || typeof page.last !== 'boolean' || !Number.isSafeInteger(page.number) || (page.number ?? -1) < 0 || (expectedPage !== undefined && page.number !== expectedPage)
    || !page.content.every(item => item && Number.isSafeInteger(item.notificationId) && item.notificationId > 0 && typeof item.message === 'string' && typeof item.isRead === 'boolean')) {
    throw new Error('알림 목록을 확인할 수 없어요.');
  }
  return page as NotificationPage;
}
export function mergeNotificationItems<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const ids = new Set(previous.map(item => item.id));
  return [...previous, ...incoming.filter(item => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  })];
}
export const notificationApi = {
  list: async (token: string, page = 0, timeoutMs = 15000) => {
    return withRequestTimeout(signal => request<NotificationPage>(`/notifications?page=${page}&size=20`, { signal }, token), timeoutMs,
      () => new Error('알림 조회가 지연되고 있어요. 잠시 후 다시 시도해주세요.'));
  },
  read: (id: number, token: string) => request<ServerNotification>(`/notifications/${id}/read`, { method: 'PATCH' }, token),
  readAll: (token: string) => request<{ updatedCount: number }>('/notifications/read-all', { method: 'PATCH' }, token),
  remove: (id: number, token: string) => request<void>(`/notifications/${id}`, { method: 'DELETE' }, token),
};
