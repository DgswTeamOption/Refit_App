import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Session = { accessToken: string; refreshToken: string; user: { id: number; name: string; role: 'STUDENT' | 'TEACHER' } };
export type SignupDraft = { name: string; email: string; role: 'STUDENT' | 'TEACHER' };
type SessionContextValue = { session: Session | null; setSession: (session: Session | null) => void; signupDraft: SignupDraft | null; setSignupDraft: (draft: SignupDraft | null) => void };
const SessionContext = createContext<SessionContextValue | null>(null);

// The future login/signup response can be passed to setSession once those APIs exist.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const value = useMemo(() => ({ session, setSession, signupDraft, setSignupDraft }), [session, signupDraft]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing');
  return value;
}
