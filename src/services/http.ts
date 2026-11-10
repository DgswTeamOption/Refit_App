import { Platform } from 'react-native';

export const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080') : '')).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const unauthorizedListeners = new Set<(token: string) => void>();
export function onUnauthorized(listener: (token: string) => void): () => void {
  unauthorizedListeners.add(listener);
  return () => { unauthorizedListeners.delete(listener); };
}

export async function request<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T | undefined> {
  return performRequest<T>(path, options, accessToken, false);
}

export async function requestRaw<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T | undefined> {
  return performRequest<T>(path, options, accessToken, true);
}

export async function withRequestTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number, error: () => Error): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try { return await run(controller.signal); }
  catch (cause) { if (timedOut) throw error(); throw cause; }
  finally { clearTimeout(timer); }
}

async function performRequest<T>(path: string, options: RequestInit, accessToken: string | undefined, raw: boolean): Promise<T | undefined> {
  if (!baseUrl) throw new Error('서버 주소가 설정되지 않았어요.');
  if (!__DEV__ && !baseUrl.startsWith('https://')) throw new Error('배포 서버에는 HTTPS 주소가 필요해요.');
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers }); }
  catch (error) {
    if (error instanceof TypeError) throw new Error('서버에 연결하지 못했어요. 네트워크 연결을 확인해주세요.');
    throw error;
  }
  if (response.status === 401 && accessToken) unauthorizedListeners.forEach(listener => listener(accessToken));
  const content = await response.text();
  if (!content.trim() && response.ok && raw) return undefined;
  let body: unknown;
  try { body = JSON.parse(content); } catch {
    if (!response.ok) throw new ApiError(response.status, '서버 요청에 실패했어요.');
    throw new Error('서버 응답을 읽을 수 없어요.');
  }
  const object = body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!response.ok) throw new ApiError(response.status, typeof object?.message === 'string' && object.message ? object.message : '요청을 처리하지 못했어요.');
  if (raw) return body as T;
  if (object?.success !== true) throw new Error('서버 응답을 읽을 수 없어요.');
  return object.data as T | undefined;
}
export function jsonBody(value: unknown): Pick<RequestInit, 'headers' | 'body'> {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}
