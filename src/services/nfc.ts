export async function checkNfcWriteSupport(): Promise<void> {
  throw new Error('NFC 태그 등록은 NFC를 지원하는 모바일 개발 빌드에서 사용할 수 있어요.');
}
export async function writeAttendanceUrl(_url: string, _signal?: AbortSignal): Promise<void> {
  throw new Error('NFC 태그 등록은 NFC를 지원하는 모바일 개발 빌드에서 사용할 수 있어요.');
}
export async function readAttendanceToken(_signal?: AbortSignal): Promise<string> {
  throw new Error('NFC 출석은 NFC를 지원하는 모바일 개발 빌드에서 사용할 수 있어요.');
}
