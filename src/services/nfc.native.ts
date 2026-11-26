import { Platform } from 'react-native';

export async function checkNfcWriteSupport(): Promise<void> {
  const nfc = await import('react-native-nfc-manager').catch(() => null);
  if (!nfc) throw new Error('NFC는 NFC 기능이 포함된 개발 빌드에서 사용할 수 있어요.');
  await nfc.default.start();
  if (!await nfc.default.isSupported()) throw new Error('이 기기는 NFC를 지원하지 않아요.');
  if (Platform.OS === 'android' && !await nfc.default.isEnabled()) throw new Error('휴대폰 설정에서 NFC를 켜주세요.');
}

export async function writeAttendanceUrl(url: string, signal?: AbortSignal): Promise<void> {
  const parsed = new URL(url);
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !parsed.searchParams.get('token')) throw new Error('출석 주소를 확인할 수 없어요.');
  const checkCancelled = () => { if (signal?.aborted) throw new Error('태그 인식을 취소했어요.'); };
  checkCancelled();
  await checkNfcWriteSupport();
  const { default: manager, Ndef, NdefStatus, NfcTech, NfcAdapter } = await import('react-native-nfc-manager');
  checkCancelled();
  const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
  let requested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelling: Promise<void> | undefined;
  const stop = () => requested ? (cancelling ??= manager.cancelTechnologyRequest().catch(() => {})) : Promise.resolve();
  const cancel = () => { void stop(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    checkCancelled();
    requested = true;
    const tech = Platform.OS === 'android' ? [NfcTech.Ndef, NfcTech.NdefFormatable] : NfcTech.Ndef;
    const options = Platform.OS === 'android' ? { isReaderModeEnabled: true, readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V } : { alertMessage: '등록할 NFC 태그에 아이폰 윗부분을 가까이 대주세요.' };
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('태그를 찾지 못했어요. 휴대폰 뒷면에 태그를 다시 대주세요.')), 30000); });
    const detected = await Promise.race([manager.requestTechnology(tech, options), timeout]);
    clearTimeout(timer);
    timer = undefined;
    checkCancelled();
    if (Platform.OS === 'android' && !detected) throw new Error('이 NFC 태그에는 출석 주소를 기록할 수 없어요.');
    if (Platform.OS === 'android' && detected === NfcTech.NdefFormatable) {
      await manager.ndefFormatableHandlerAndroid.formatNdef(bytes);
      return;
    }
    const status = await manager.ndefHandler.getNdefStatus();
    checkCancelled();
    if (status.status !== NdefStatus.ReadWrite) throw new Error('쓰기 가능한 NFC 태그가 아니에요.');
    if (status.capacity < bytes.length) throw new Error('태그의 저장 공간이 부족해요.');
    await manager.ndefHandler.writeNdefMessage(bytes);
    if (Platform.OS === 'ios') await manager.setAlertMessageIOS('태그에 출석 주소를 기록했어요.').catch(() => {});
  } catch (error) {
    if (signal?.aborted) throw new Error('태그 인식을 취소했어요. 다시 시도할 수 있어요.');
    throw error;
  } finally { if (timer) clearTimeout(timer); signal?.removeEventListener('abort', cancel); await stop(); }
}

export async function readAttendanceToken(signal?: AbortSignal): Promise<string> {
  let requested = false;
  let NfcManager: typeof import('react-native-nfc-manager').default | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelling: Promise<void> | undefined;
  const checkCancelled = () => { if (signal?.aborted) throw new Error('태그 인식을 취소했어요.'); };
  const stop = () => requested && NfcManager ? (cancelling ??= NfcManager.cancelTechnologyRequest().catch(() => {})) : Promise.resolve();
  const cancel = () => { void stop(); };
  try {
    checkCancelled();
    const nfc = await import('react-native-nfc-manager').catch(() => null);
    if (!nfc) throw new Error('NFC는 개발 빌드에서만 사용할 수 있어요. (Expo Go 미지원)');
    const { Ndef, NfcTech, NfcAdapter } = nfc;
    NfcManager = nfc.default;
    await NfcManager.start();
    if (!await NfcManager.isSupported()) throw new Error('이 기기는 NFC를 지원하지 않아요.');
    if (Platform.OS === 'android' && !await NfcManager.isEnabled()) throw new Error('휴대폰 설정에서 NFC를 켜주세요.');
    checkCancelled();
    signal?.addEventListener('abort', cancel, { once: true });
    requested = true;
    const options = Platform.OS === 'android' ? { isReaderModeEnabled: true, readerModeFlags: NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V } : { alertMessage: '출석 태그에 아이폰 윗부분을 가까이 대주세요.' };
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('태그를 찾지 못했어요. 다시 시도해주세요.')), 30000); });
    const detected = await Promise.race([NfcManager.requestTechnology(NfcTech.Ndef, options), timeout]);
    clearTimeout(timer); timer = undefined;
    checkCancelled();
    if (Platform.OS === 'android' && !detected) throw new Error('출석 주소가 기록된 NFC 태그가 아니에요.');
    const tag = await NfcManager.getTag();
    checkCancelled();
    for (const record of tag?.ndefMessage ?? []) {
      let value = '';
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) value = Ndef.text.decodePayload(new Uint8Array(record.payload));
      if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) value = Ndef.uri.decodePayload(new Uint8Array(record.payload));
      if (/^https?:\/\//i.test(value)) { const url = new URL(value); value = url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? ''; }
      if (value && value.length <= 64) return value;
    }
    throw new Error('태그에서 출석 토큰을 읽지 못했어요.');
  } catch (error) {
    if (signal?.aborted) throw new Error('태그 인식을 취소했어요.');
    throw error;
  } finally { if (timer) clearTimeout(timer); signal?.removeEventListener('abort', cancel); await stop(); }
}
