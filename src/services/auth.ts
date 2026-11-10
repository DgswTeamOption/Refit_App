import { jwtDecode } from 'jwt-decode';
import type { Session } from '../auth/Session';
import { ApiError, jsonBody, request } from './http';
import { userApi } from './user';

type TokenResponse = { accessToken: string; refreshToken: string };
type AccessClaims = { userId?: unknown; role?: unknown };
export class GoogleUserNotRegistered extends Error {}
export const authApi = {
  registerEmail: (email: string, name: string, role: Session['user']['role'], verificationCode: string) => request<unknown>('/api/auth/register', { method: 'POST', ...jsonBody({ email_id: email, name, role, verificationToken: verificationCode }) }),
  loginEmail: (email: string, verificationCode: string) => request<TokenResponse>('/api/auth/login', { method: 'POST', ...jsonBody({ email_id: email, verificationToken: verificationCode }) }),
  registerGoogle: (idToken: string, role: Session['user']['role']) => request<unknown>('/api/auth/google/register', { method: 'POST', ...jsonBody({ idToken, role }) }),
  loginGoogle: (idToken: string) => request<TokenResponse>('/api/auth/google/login', { method: 'POST', ...jsonBody({ idToken }) }),
};

async function sessionFromTokens(tokens: TokenResponse | undefined): Promise<Session> {
  if (!tokens?.accessToken || !tokens.refreshToken) throw new Error('로그인 응답을 확인할 수 없어요.');
  let claims: AccessClaims;
  try { claims = jwtDecode<AccessClaims>(tokens.accessToken); }
  catch { throw new Error('로그인 토큰을 확인할 수 없어요.'); }
  if (typeof claims.userId !== 'number' || !Number.isSafeInteger(claims.userId) || claims.userId <= 0 || (claims.role !== 'STUDENT' && claims.role !== 'TEACHER')) throw new Error('로그인 사용자 정보를 확인할 수 없어요.');
  const profile = await userApi.get(claims.userId, tokens.accessToken);
  if (!profile || profile.id !== claims.userId || profile.role !== claims.role) throw new Error('프로필 정보를 확인할 수 없어요.');
  return { ...tokens, user: { id: profile.id, name: profile.name, role: profile.role } };
}

export async function googleSession(idToken: string): Promise<Session> {
  let tokens: TokenResponse | undefined;
  try { tokens = await authApi.loginGoogle(idToken); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new GoogleUserNotRegistered();
    throw error;
  }
  return sessionFromTokens(tokens);
}

export async function emailSession(email: string, verificationCode: string): Promise<Session> {
  return sessionFromTokens(await authApi.loginEmail(email, verificationCode));
}
