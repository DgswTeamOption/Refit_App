import { Platform } from 'react-native';

export const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080') : '')).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Resolves a fresh access token for an expired one, or null when the session can no longer be renewed.
type TokenRefresher = (expiredToken: string) => Promise<string | null>;
let tokenRefresher: TokenRefresher | null = null;
export function setTokenRefresher(refresher: TokenRefresher): () => void {
  tokenRefresher = refresher;
  return () => { if (tokenRefresher === refresher) tokenRefresher = null; };
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
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; controller.abort(); reject(error()); }, timeoutMs);
  });
  try { return await Promise.race([run(controller.signal), timeout]); }
  catch (cause) { if (timedOut) throw error(); throw cause; }
  finally { clearTimeout(timer!); }
}

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) { const error = new Error('요청이 취소됐어요.'); error.name = 'AbortError'; throw error; }
}

async function performRequest<T>(path: string, options: RequestInit, accessToken: string | undefined, raw: boolean, retried = false): Promise<T | undefined> {
  throwIfAborted(options.signal);
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
  if (response.status === 401 && accessToken) {
    const renewed = !retried && tokenRefresher ? await tokenRefresher(accessToken) : null;
    throwIfAborted(options.signal);
    if (renewed) return performRequest<T>(path, options, renewed, raw, true);
    unauthorizedListeners.forEach(listener => listener(accessToken));
  }
  const content = await response.text();
  if (!content.trim() && response.ok && raw) return undefined;
  let body: unknown;
  try { body = JSON.parse(content); } catch {
    if (!response.ok) throw new ApiError(response.status, '서버 요청에 실패했어요.');
    throw new Error('서버 응답을 읽을 수 없어요.');
  }
  const object = body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!response.ok) {
    const reasons = Array.isArray(object?.errors) ? object.errors.map(item => item && typeof item === 'object' && typeof item.reason === 'string' ? item.reason : '').filter(Boolean) : [];
    const nested = object?.error && typeof object.error === 'object' ? object.error as Record<string, unknown> : null;
    const message = reasons.length ? reasons.join('\n') : typeof object?.message === 'string' && object.message ? object.message : typeof nested?.message === 'string' && nested.message ? nested.message : '요청을 처리하지 못했어요.';
    throw new ApiError(response.status, message, typeof object?.code === 'string' ? object.code : typeof nested?.code === 'string' ? nested.code : undefined);
  }
  if (raw) return body as T;
  if (object?.success !== true) {
    const nested = object?.error && typeof object.error === 'object' ? object.error as Record<string, unknown> : null;
    throw new Error(typeof nested?.message === 'string' && nested.message ? nested.message : '서버 응답을 읽을 수 없어요.');
  }
  return object.data as T | undefined;
}
export function jsonBody(value: unknown): Pick<RequestInit, 'headers' | 'body'> {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}
