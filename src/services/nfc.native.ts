import { Platform } from 'react-native';

export async function checkNfcWriteSupport(): Promise<void> {
  const nfc = await import('react-native-nfc-manager').catch(() => null);
  if (!nfc) throw new Error('NFC는 NFC 기능이 포함된 개발 빌드에서 사용할 수 있어요.');
  await nfc.default.start();
  if (!await nfc.default.isSupported()) throw new Error('이 기기는 NFC를 지원하지 않아요.');
  if (Platform.OS === 'android' && !await nfc.default.isEnabled()) throw new Error('휴대폰 설정에서 NFC를 켜주세요.');
}

export async function cancelNfcWrite(): Promise<void> {
  const nfc = await import('react-native-nfc-manager').catch(() => null);
  await nfc?.default.cancelTechnologyRequest().catch(() => {});
}

export async function writeAttendanceUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !parsed.searchParams.get('token')) throw new Error('출석 주소를 확인할 수 없어요.');
  await checkNfcWriteSupport();
  const { default: manager, Ndef, NdefStatus, NfcTech } = await import('react-native-nfc-manager');
  const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
  let requested = false;
  try {
    requested = true;
    await manager.requestTechnology(NfcTech.Ndef, { alertMessage: '등록할 NFC 태그에 아이폰 윗부분을 가까이 대주세요.' });
    const status = await manager.ndefHandler.getNdefStatus();
    if (status.status !== NdefStatus.ReadWrite) throw new Error('쓰기 가능한 NFC 태그가 아니에요.');
    if (status.capacity < bytes.length) throw new Error('태그의 저장 공간이 부족해요.');
    await manager.ndefHandler.writeNdefMessage(bytes);
    if (Platform.OS === 'ios') await manager.setAlertMessageIOS('태그에 출석 주소를 기록했어요.').catch(() => {});
  } finally { if (requested) await manager.cancelTechnologyRequest().catch(() => {}); }
}

export async function readAttendanceToken(): Promise<string> {
  let requested = false;
  let NfcManager: typeof import('react-native-nfc-manager').default | undefined;
  try {
    const nfc = await import('react-native-nfc-manager').catch(() => null);
    if (!nfc) throw new Error('NFC는 개발 빌드에서만 사용할 수 있어요. (Expo Go 미지원)');
    const { Ndef, NfcTech } = nfc;
    NfcManager = nfc.default;
    await NfcManager.start();
    if (!await NfcManager.isSupported()) throw new Error('이 기기는 NFC를 지원하지 않아요.');
    requested = true;
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    for (const record of tag?.ndefMessage ?? []) {
      let value = '';
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) value = Ndef.text.decodePayload(new Uint8Array(record.payload));
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) value = Ndef.uri.decodePayload(new Uint8Array(record.payload));
      if (/^https?:\/\//i.test(value)) { const url = new URL(value); value = url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? ''; }
      if (value && value.length <= 64) return value;
    }
    throw new Error('태그에서 출석 토큰을 읽지 못했어요.');
  } finally { if (requested) await NfcManager?.cancelTechnologyRequest().catch(() => {}); }
}
