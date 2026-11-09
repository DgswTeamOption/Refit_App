import { Platform } from 'react-native';

export const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080') : '')).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type Envelope<T> = { success: true; data?: T };
export async function request<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T | undefined> {
  if (!baseUrl) throw new Error('서버 주소가 설정되지 않았어요.');
  if (!__DEV__ && !baseUrl.startsWith('https://')) throw new Error('배포 서버에는 HTTPS 주소가 필요해요.');
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  let body: Envelope<T> | { message?: string };
  try { body = await response.json(); } catch {
    if (!response.ok) throw new ApiError(response.status, '서버 요청에 실패했어요.');
    throw new Error('서버 응답을 읽을 수 없어요.');
  }
  if (!response.ok) throw new ApiError(response.status, 'message' in body && body.message ? body.message : '요청을 처리하지 못했어요.');
  if (!('success' in body) || !body.success) throw new Error('서버 응답을 읽을 수 없어요.');
  return body.data;
}
export function jsonBody(value: unknown): Pick<RequestInit, 'headers' | 'body'> {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}
