import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export type Session = { accessToken: string; refreshToken: string; user: { id: number; name: string; role: 'STUDENT' | 'TEACHER' } };
export type SignupDraft = { name: string; email: string; role: 'STUDENT' | 'TEACHER' };
export type LocalUser = { name: string; email: string; role: 'STUDENT' | 'TEACHER' };
type SessionContextValue = { localUser: LocalUser | null; setLocalUser: (user: LocalUser | null) => void; session: Session | null; setSession: Dispatch<SetStateAction<Session | null>>; signupDraft: SignupDraft | null; setSignupDraft: (draft: SignupDraft | null) => void };
const SessionContext = createContext<SessionContextValue | null>(null);

// The future login/signup response can be passed to setSession once those APIs exist.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // UI-only user used until the login/signup APIs exist. It carries no token, so no server calls are made with it.
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const value = useMemo(() => ({ localUser, setLocalUser, session, setSession, signupDraft, setSignupDraft }), [localUser, session, signupDraft]);
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
