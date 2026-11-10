import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { onUnauthorized } from '../services/http';
import { ActivityIndicator, View } from 'react-native';
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
  useEffect(() => { currentSession.current = session; }, [session]);
  useEffect(() => onUnauthorized(token => {
    if (currentSession.current?.accessToken !== token) return;
    currentSession.current = null;
    setSession(current => current?.accessToken === token ? null : current);
    router.replace('/');
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
