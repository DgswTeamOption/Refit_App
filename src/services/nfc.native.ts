import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

export async function readAttendanceToken(): Promise<string> {
  let requested = false;
  try {
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
  } finally { if (requested) await NfcManager.cancelTechnologyRequest().catch(() => {}); }
}
