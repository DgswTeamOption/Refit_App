import { Platform } from 'react-native';

export type PendingNfcRegistration = { id: number; name: string; url: string; written: boolean };

const keyFor = (userId: number, classId: number) => `refit_nfc_pending_${userId}_${classId}`;

async function secureStore() {
  if (Platform.OS === 'web') throw new Error('NFC 태그 등록은 모바일 개발 빌드에서 사용할 수 있어요.');
  const { requireOptionalNativeModule } = await import('expo-modules-core');
  if (!requireOptionalNativeModule('ExpoSecureStore')) throw new Error('안전한 저장 기능이 포함된 개발 빌드가 필요해요.');
  const store = await import('expo-secure-store');
  if (!await store.isAvailableAsync()) throw new Error('태그 정보를 안전하게 저장할 수 없어요.');
  return store;
}

export async function checkNfcRegistrationStorage(): Promise<void> { await secureStore(); }

export function parsePendingNfcRegistration(raw: string): PendingNfcRegistration {
  try {
    const value = JSON.parse(raw) as Partial<PendingNfcRegistration>;
    const url = typeof value.url === 'string' ? new URL(value.url) : null;
    if (!Number.isSafeInteger(value.id) || !value.id || value.id < 1 || typeof value.name !== 'string' || !value.name.trim() || !url || !['http:', 'https:'].includes(url.protocol) || !url.searchParams.get('token') || typeof value.written !== 'boolean') throw new Error();
    return value as PendingNfcRegistration;
  } catch { throw new Error('태그 등록 정보를 확인할 수 없어요.'); }
}

export async function loadPendingNfcRegistration(userId: number, classId: number): Promise<PendingNfcRegistration | null> {
  const store = await secureStore();
  const raw = await store.getItemAsync(keyFor(userId, classId));
  if (!raw) return null;
  return parsePendingNfcRegistration(raw);
}

export async function savePendingNfcRegistration(userId: number, classId: number, pending: PendingNfcRegistration): Promise<void> {
  const store = await secureStore();
  const raw = JSON.stringify(pending);
  parsePendingNfcRegistration(raw);
  await store.setItemAsync(keyFor(userId, classId), raw);
}

export async function clearPendingNfcRegistration(userId: number, classId: number): Promise<void> {
  const store = await secureStore();
  await store.deleteItemAsync(keyFor(userId, classId));
}
