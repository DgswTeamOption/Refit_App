import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import type { Session } from './Session';

const key = 'refit.session.v1';

type Claims = { exp?: unknown; userId?: unknown; role?: unknown };
export function parseStoredSession(value: string | null, now = Date.now()): Session | null {
  if (!value) return null;
  try {
    const session: unknown = JSON.parse(value);
    if (!session || typeof session !== 'object') return null;
    const data = session as Partial<Session>;
    if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string' || !data.refreshToken || !data.user || typeof data.user.name !== 'string') return null;
    const claims = jwtDecode<Claims>(data.accessToken);
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now || !Number.isSafeInteger(claims.userId) || (claims.userId as number) <= 0 || claims.userId !== data.user.id || claims.role !== data.user.role || (claims.role !== 'STUDENT' && claims.role !== 'TEACHER')) return null;
    const photo = data.user.profileImageUrl;
    if (photo !== undefined && photo !== null && typeof photo !== 'string') return null;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: { id: data.user.id, name: data.user.name, role: data.user.role, profileImageUrl: photo ?? null } };
  } catch { return null; }
}
async function storage() {
  if (Platform.OS === 'web') return null;
  // Development binaries built before SecureStore was added can still start normally.
  const { requireOptionalNativeModule } = await import('expo-modules-core');
  if (!requireOptionalNativeModule('ExpoSecureStore')) return null;
  return import('expo-secure-store');
}
export async function readStoredSession(): Promise<Session | null> {
  const store = await storage();
  if (!store) return null;
  const value = await store.getItemAsync(key);
  const session = parseStoredSession(value);
  if (value && !session) await store.deleteItemAsync(key);
  return session;
}
export async function writeStoredSession(session: Session | null): Promise<void> {
  const store = await storage();
  if (!store) return;
  if (session) await store.setItemAsync(key, JSON.stringify(session));
  else await store.deleteItemAsync(key);
}
