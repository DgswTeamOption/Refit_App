import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { authApi } from '../services/auth';
import { ApiError, onUnauthorized, setTokenRefresher } from '../services/http';
import { ActivityIndicator, Alert, View } from 'react-native';
import { readStoredSession, writeStoredSession } from './sessionStorage';

export type Session = { accessToken: string; refreshToken: string; user: { id: number; name: string; role: 'STUDENT' | 'TEACHER'; profileImageUrl?: string | null } };
export type SignupDraft = { name: string; email: string; role: 'STUDENT' | 'TEACHER'; verificationCode: string; expiresAt: number };
export type LocalUser = { name: string; email: string; role: 'STUDENT' | 'TEACHER' };
type SessionContextValue = { localUser: LocalUser | null; setLocalUser: (user: LocalUser | null) => void; session: Session | null; setSession: Dispatch<SetStateAction<Session | null>>; signupDraft: SignupDraft | null; setSignupDraft: (draft: SignupDraft | null) => void; pendingGoogleToken: string | null; setPendingGoogleToken: (token: string | null) => void };
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const storageQueue = useRef<Promise<void>>(Promise.resolve());
  const lastPersistedSession = useRef<Session | null>(null);
  // UI-only user carries no token, so no server calls are made with it.
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const currentSession = useRef<Session | null>(null);
  useEffect(() => {
    let active = true;
    readStoredSession().then(value => { if (active && value) { lastPersistedSession.current = value; setSession(value); } }).catch(() => {}).finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!hydrated || session === lastPersistedSession.current) return;
    lastPersistedSession.current = session;
    storageQueue.current = storageQueue.current.then(() => writeStoredSession(session)).catch(() => {});
  }, [hydrated, session]);
  const refreshing = useRef<Promise<string | null> | null>(null);
  useEffect(() => { currentSession.current = session; }, [session]);
  useEffect(() => setTokenRefresher(async expiredToken => {
    const current = currentSession.current;
    if (!current) return null;
    // Another request already renewed this session.
    if (current.accessToken !== expiredToken) return current.accessToken;
    refreshing.current ??= (async () => {
      try {
        const tokens = await authApi.refresh(current.refreshToken);
        if (!tokens?.accessToken || !tokens.refreshToken) return null;
        // The server rotates the refresh token, so the new one must replace the stored one.
        currentSession.current = { ...current, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
        setSession(existing => existing?.accessToken === expiredToken ? { ...existing, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } : existing);
        return tokens.accessToken;
      } catch (error) {
        // An unreachable server must not sign the user out; only a rejected refresh token does.
        if (error instanceof ApiError) return null;
        throw error;
      } finally { refreshing.current = null; }
    })();
    return refreshing.current;
  }), []);
  useEffect(() => onUnauthorized(token => {
    if (currentSession.current?.accessToken !== token) return;
    currentSession.current = null;
    setSession(current => current?.accessToken === token ? null : current);
    router.replace('/');
    Alert.alert('다시 로그인해주세요', '로그인이 만료됐거나 인증이 해제됐어요.');
  }), []);
  const value = useMemo(() => ({ localUser, setLocalUser, session, setSession, signupDraft, setSignupDraft, pendingGoogleToken, setPendingGoogleToken }), [localUser, session, signupDraft, pendingGoogleToken]);
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center' }}><ActivityIndicator color="#0099ff" /></View>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing');
  return value;
}
export function useInitial() {
  const { session, localUser } = useSession();
  return (session?.user.name ?? localUser?.name ?? '학').trim().charAt(0) || '학';
}
