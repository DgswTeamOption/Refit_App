import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../auth/Session';
import { jsonBody, request } from '../services/http';

type Tag = { id: number; name: string; class_id: number | null; is_active: boolean; token: string; url: string };
export function NfcTags({ classId }: { classId: number }) {
  const { session } = useSession();
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    try { const data = await request<Tag[]>('/api/class/nfc/tags', {}, session.accessToken); if (!Array.isArray(data)) throw new Error('태그 목록을 확인할 수 없어요.'); setTags(data); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '태그 목록을 불러오지 못했어요.'); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function run(path: string, method: string, body?: object) {
    if (!session || busy) return;
    setBusy(true);
    try { await request(path, { method, ...(body ? jsonBody(body) : {}) }, session.accessToken); setName(''); await load(); }
    catch (e) { Alert.alert('처리 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => void) => <Pressable disabled={busy} onPress={action} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <View style={styles.container}><Text style={styles.title}>NFC 태그 관리</Text><Text style={styles.description}>태그를 생성하고 수업에 연결하세요. 태그 쓰기는 별도의 NFC 쓰기 도구를 사용해 아래 URL 또는 토큰을 기록해주세요.</Text>{!!error && <Text onPress={() => void load()} style={styles.error}>{error} · 다시 시도</Text>}<TextInput value={name} onChangeText={setName} maxLength={50} placeholder="새 태그 이름" style={styles.input} />{button('태그 생성', () => name.trim() ? void run('/api/class/nfc/tags', 'POST', { name: name.trim() }) : Alert.alert('태그 이름을 입력해주세요.'))}{tags.map(tag => <View style={styles.card} key={tag.id}><Text style={styles.title}>{tag.name} · {tag.is_active ? '사용 중' : '비활성'}</Text><Text selectable style={styles.description}>토큰: {tag.token}{'\n'}URL: {tag.url}</Text><Text style={styles.description}>{tag.class_id ? `연결된 수업 #${tag.class_id}` : '연결된 수업 없음'}</Text>{tag.class_id === classId ? button('연결 해제', () => void run(`/api/class/nfc/${classId}`, 'DELETE')) : !tag.class_id ? button('이 수업에 연결', () => void run(`/api/class/nfc/${classId}`, 'POST', { tag_id: tag.id })) : null}{button(tag.is_active ? '비활성화' : '활성화', () => void run(`/api/class/nfc/tags/${tag.id}`, 'PATCH', { is_active: !tag.is_active }))}{!tag.class_id && button('태그 삭제', () => Alert.alert('태그를 삭제할까요?', '', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => void run(`/api/class/nfc/tags/${tag.id}`, 'DELETE') }]))}</View>)}</View>;
}
const styles = StyleSheet.create({ container: { padding: 20 }, title: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, description: { color: '#666', fontSize: 12, marginBottom: 10 }, error: { color: '#d33', marginVertical: 8 }, input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginVertical: 8 }, card: { padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 }, button: { backgroundColor: '#0099ff', borderRadius: 8, padding: 10, alignItems: 'center', marginVertical: 3 }, buttonText: { color: '#fff', fontWeight: '700' } });
