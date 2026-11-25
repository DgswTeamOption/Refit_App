import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../auth/Session';
import { ApiError, jsonBody, request, withRequestTimeout } from '../services/http';
import { checkNfcWriteSupport, writeAttendanceUrl } from '../services/nfc';
import { checkNfcRegistrationStorage, clearPendingNfcRegistration, completeNfcRegistration, loadPendingNfcRegistration, parsePendingNfcRegistration, savePendingNfcRegistration, type PendingNfcRegistration } from '../services/nfcRegistration';

type Tag = { id: number; name: string; class_id: number | null; is_active: boolean; token?: string; url?: string };

export function NfcTags({ classId }: { classId: number }) {
  const { session } = useSession();
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [pending, setPending] = useState<PendingNfcRegistration | null>(null);
  const [storageReady, setStorageReady] = useState(Platform.OS === 'web');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [pendingError, setPendingError] = useState('');
  const working = useRef(false);
  const scanController = useRef<AbortController | null>(null);
  const focused = useRef(false);
  const userId = session?.user.id;
  const token = session?.accessToken;

  const load = useCallback(async () => {
    if (!token) return;
    try { const data = await withRequestTimeout(signal => request<Tag[]>('/api/class/nfc/tags', { signal }, token), 20000, () => new Error('태그 목록 조회가 지연되고 있어요.')); if (!Array.isArray(data)) throw new Error('태그 목록을 확인할 수 없어요.'); setTags(data); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '태그 목록을 불러오지 못했어요.'); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; scanController.current?.abort(); }; }, []));
  useFocusEffect(useCallback(() => {
    if (!userId || Platform.OS === 'web') return;
    let active = true;
    setStorageReady(false);
    loadPendingNfcRegistration(userId, classId).then(value => { if (active) { setPending(value); setPendingError(''); setStorageReady(true); } })
      .catch(e => { if (active) { setPendingError(e instanceof Error ? e.message : '태그 등록 정보를 불러오지 못했어요.'); setStorageReady(false); } });
    return () => { active = false; };
  }, [userId, classId]));

  async function run(path: string, method: string, body?: object) {
    if (!token || working.current) return;
    working.current = true; setBusy(true);
    try { await request(path, { method, ...(body ? jsonBody(body) : {}) }, token); await load(); }
    catch (e) { Alert.alert('처리 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { working.current = false; setBusy(false); }
  }

  async function linkedTag(): Promise<Tag | undefined> {
    try { return await withRequestTimeout(signal => request<Tag>(`/api/class/nfc/${classId}`, { signal }, token), 20000, () => new Error('수업의 태그 연결 상태를 확인하지 못했어요. 다시 시도해주세요.')); }
    catch (e) { if (e instanceof ApiError && e.status === 404 && (e.code === 'NFC_TAG_NOT_FOUND' || (!e.code && e.message === '등록되지 않은 NFC 태그입니다'))) return undefined; throw e; }
  }

  async function finishRegistration(item: PendingNfcRegistration) {
    if (!userId || !token) return;
    await completeNfcRegistration(item, {
      save: value => savePendingNfcRegistration(userId, classId, value),
      write: async url => { if (!focused.current) throw new Error('태그 관리 화면에서 등록을 이어서 진행해주세요.'); const controller = new AbortController(); scanController.current = controller; setScanning(true); try { await writeAttendanceUrl(url, controller.signal); } finally { if (scanController.current === controller) scanController.current = null; setScanning(false); } },
      linkedId: async () => (await linkedTag())?.id,
      link: async id => { await withRequestTimeout(signal => request(`/api/class/nfc/${classId}`, { method: 'POST', ...jsonBody({ tag_id: id }), signal }, token), 20000, () => new Error('수업 연결 결과를 확인하지 못했어요. 다시 시도해주세요.')); },
      clear: () => clearPendingNfcRegistration(userId, classId),
      onWritten: setPending,
    });
    setPending(null); setPendingError('');
    await load();
    Alert.alert('태그 등록 완료', '태그에 출석 주소를 기록하고 이 수업에 연결했어요.');
  }

  async function create() {
    const tagName = name.trim();
    if (!tagName) return Alert.alert('태그 이름을 입력해주세요.');
    if (!userId || !token || working.current || !storageReady || pending) return;
    working.current = true; setBusy(true); setPendingError('');
    try {
      await checkNfcWriteSupport();
      await checkNfcRegistrationStorage();
      if (await linkedTag()) throw new Error('이 수업에 이미 연결된 태그가 있어요. 먼저 연결을 해제해주세요.');
      const created = await withRequestTimeout(signal => request<Tag>('/api/class/nfc/tags', { method: 'POST', ...jsonBody({ name: tagName }), signal }, token), 20000, () => new Error('태그 생성 결과를 확인하지 못했어요. 태그 목록을 확인한 뒤 다시 시도해주세요.'));
      if (!created || !Number.isSafeInteger(created.id) || created.id <= 0 || !created.url) throw new Error('태그 생성 결과를 확인할 수 없어요. 태그 목록을 확인해주세요.');
      const item: PendingNfcRegistration = { id: created.id, name: created.name || tagName, url: created.url, written: false };
      parsePendingNfcRegistration(JSON.stringify(item));
      setPending(item); setName('');
      await finishRegistration(item);
    } catch (e) { setPendingError(e instanceof Error ? e.message : '태그 등록에 실패했어요.'); await load(); }
    finally { working.current = false; setBusy(false); }
  }

  async function resume() {
    if (!pending || working.current) return;
    working.current = true; setBusy(true); setPendingError('');
    try { await finishRegistration(pending); }
    catch (e) { setPendingError(e instanceof Error ? e.message : '태그 등록에 실패했어요.'); await load(); }
    finally { working.current = false; setBusy(false); }
  }

  return <View style={styles.container}>
    <Text style={styles.title}>NFC 태그 관리</Text>
    <Text style={styles.description}>이름을 입력하고 등록을 누른 뒤 휴대폰을 NFC 태그에 대주세요. 태그에 출석 주소를 기록하고 이 수업에 연결해요. 태그의 기존 내용은 덮어써집니다.</Text>
    <Text style={styles.description}>기존 태그를 수업에 다시 연결하려면 해당 태그에 출석 주소가 이미 기록되어 있어야 해요.</Text>
    {!!error && <Text onPress={() => void load()} style={styles.error}>{error} · 다시 시도</Text>}
    {!!pendingError && <Text accessibilityRole="alert" style={styles.error}>{pendingError}</Text>}
    {pending ? <View style={styles.card}>
      <Text style={styles.title}>{pending.name} 등록 중</Text>
      <Text style={styles.description}>{pending.written ? '태그 기록이 끝났어요. 수업 연결을 완료해주세요.' : '태그에 기록할 차례예요. NFC 태그를 가까이 대주세요.'}</Text>
      <Text style={styles.warning}>등록이 끝날 때까지 이 태그를 보관해주세요. 안전한 저장에 실패했다면 앱을 종료하지 말고 다시 시도해주세요.</Text>
      <ActionButton busy={busy} label={pending.written ? '수업 연결 다시 시도' : '태그 기록 다시 시도'} onPress={() => void resume()} />
      {scanning && <Pressable accessibilityRole="button" onPress={() => scanController.current?.abort()} style={styles.cancel}><Text>태그 인식 취소</Text></Pressable>}
    </View> : <><TextInput value={name} onChangeText={setName} maxLength={50} placeholder="새 태그 이름" accessibilityLabel="새 태그 이름" style={styles.input} /><ActionButton busy={busy} disabled={!storageReady} label={busy ? '등록 중...' : 'NFC 태그 등록'} onPress={() => void create()} /></>}
    {tags.map(tag => <View style={styles.card} key={tag.id}><Text style={styles.title}>{tag.name} · {tag.is_active ? '사용 중' : '비활성'}</Text><Text style={styles.description}>{tag.class_id ? `연결된 수업 #${tag.class_id}` : '연결된 수업 없음'}</Text>{tag.id === pending?.id ? <Text style={styles.warning}>위에서 태그 등록을 완료해주세요.</Text> : <>{tag.class_id === classId ? <ActionButton busy={busy} label="연결 해제" onPress={() => void run(`/api/class/nfc/${classId}`, 'DELETE')} /> : !tag.class_id ? <ActionButton busy={busy} label="이 수업에 연결" onPress={() => void run(`/api/class/nfc/${classId}`, 'POST', { tag_id: tag.id })} /> : null}<ActionButton busy={busy} label={tag.is_active ? '비활성화' : '활성화'} onPress={() => void run(`/api/class/nfc/tags/${tag.id}`, 'PATCH', { is_active: !tag.is_active })} />{!tag.class_id && <ActionButton busy={busy} label="태그 삭제" onPress={() => Alert.alert('태그를 삭제할까요?', '', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => void run(`/api/class/nfc/tags/${tag.id}`, 'DELETE') }])} />}</>}</View>)}
  </View>;
}
function ActionButton({ label, onPress, busy, disabled = false }: { label: string; onPress: () => void; busy: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={onPress} style={[styles.button, (busy || disabled) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ container: { padding: 20 }, title: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, description: { color: '#666', fontSize: 12, marginBottom: 10 }, error: { color: '#d33', marginVertical: 8 }, warning: { color: '#d33', fontSize: 12, marginBottom: 10 }, input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginVertical: 8 }, card: { padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 }, button: { backgroundColor: '#0099ff', borderRadius: 8, padding: 10, alignItems: 'center', marginVertical: 3 }, cancel: { padding: 12, alignItems: 'center' }, disabled: { opacity: 0.5 }, buttonText: { color: '#fff', fontWeight: '700' } });
