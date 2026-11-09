import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type Notice = { id: string; title: string; body: string; author: string; dateLabel: string };
export type NoticeMode = 'list' | 'write' | 'view' | 'edit' | 'delete';
type NoticeActions = {
  create?: (input: { title: string; body: string }) => Promise<void>;
  update?: (id: string, input: { title: string; body: string }) => Promise<void>;
  remove?: (id: string) => Promise<void>;
};
type Props = { mode: NoticeMode; notices: Notice[]; selected: Notice | null; teacher: boolean; actions?: NoticeActions; onSelect: (notice: Notice) => void; onModeChange: (mode: NoticeMode) => void };
export function NoticeScreen({ mode, notices, selected, teacher, actions, onSelect, onModeChange }: Props) {
  const [title, setTitle] = useState(mode === 'edit' ? selected?.title ?? '' : '');
  const [body, setBody] = useState(mode === 'edit' ? selected?.body ?? '' : '');
  const [busy, setBusy] = useState(false);
  async function submit() {
    const input = { title: title.trim(), body: body.trim() };
    if (!input.title || !input.body) return Alert.alert('제목과 내용을 입력해주세요.');
    if (mode === 'write' && !actions?.create || mode === 'edit' && !actions?.update) return Alert.alert('준비 중', '공지 기능은 준비 중이에요.');
    setBusy(true);
    try {
      if (mode === 'write') { await actions?.create?.(input); onModeChange('list'); }
      else if (selected) { await actions?.update?.(selected.id, input); onModeChange('list'); }
    } catch (e) { Alert.alert('공지 저장 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!selected || !actions?.remove) return Alert.alert('준비 중', '공지 삭제 기능은 준비 중이에요.');
    setBusy(true);
    try { await actions.remove(selected.id); onModeChange('list'); }
    catch (e) { Alert.alert('공지 삭제 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  if (mode === 'list') return <View style={styles.content}>{notices.length ? notices.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => onSelect(item)} style={styles.card}><Image source={require('../../assets/figma/notice-card.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.meta}>{item.author} · {item.dateLabel}</Text><Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.summary} numberOfLines={1}>{item.body}</Text><Text style={styles.more}>공지 보기</Text></Pressable>) : <Text style={styles.empty}>등록된 공지가 없어요.</Text>}</View>;
  if (mode === 'view' && selected) return <View style={styles.content}><View style={styles.detail}><Image source={require('../../assets/figma/notice-detail.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.detailMeta}>{selected.author} · {selected.dateLabel}</Text><Text style={styles.detailTitle}>{selected.title}</Text><Text style={styles.detailBody}>{selected.body}</Text>{teacher && <View style={styles.detailButtons}><Pressable style={styles.detailButton} onPress={() => onModeChange('edit')}><Image source={require('../../assets/figma/notice-edit.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cancelText}>공지 수정</Text></Pressable><Pressable style={styles.detailButton} onPress={() => onModeChange('delete')}><Image source={require('../../assets/figma/notice-delete.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.submitText}>공지 삭제</Text></Pressable></View>}</View></View>;
  if (mode === 'delete') return <View style={styles.content}><View style={styles.deleteCard}><Image source={require('../../assets/figma/notice-delete-card.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.deleteTitle}>이 공지를 삭제할까요?</Text><Text style={styles.deleteDescription}>삭제한 공지는 학생에게 더 이상 보이지 않습니다.</Text><View style={styles.deleteButtons}><Pressable style={styles.detailButton} onPress={() => onModeChange('view')}><Image source={require('../../assets/figma/notice-edit.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cancelText}>취소</Text></Pressable><Pressable disabled={busy} style={styles.detailButton} onPress={remove}><Image source={require('../../assets/figma/notice-delete.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.submitText}>공지 삭제</Text></Pressable></View></View></View>;
  if (mode !== 'write' && mode !== 'edit') return null;
  return <View style={styles.content}><Text style={styles.label}>제목</Text><View style={styles.titleInput}><Image source={require('../../assets/figma/notice-title-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="공지 제목" value={title} onChangeText={setTitle} placeholder="공지 제목을 입력해주세요" placeholderTextColor="#999" style={styles.inputText} /></View><Text style={styles.label}>내용</Text><View style={[styles.bodyInput, mode === 'edit' && styles.editBody]}><Image source={mode === 'edit' ? require('../../assets/figma/notice-edit-body.svg') : require('../../assets/figma/notice-body-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="공지 내용" value={body} onChangeText={setBody} placeholder="공지 내용을 입력해주세요" placeholderTextColor="#aaa" multiline style={styles.bodyText} /></View><View style={styles.buttons}><Pressable style={styles.button} onPress={() => onModeChange(mode === 'edit' ? 'view' : 'list')}><Image source={require('../../assets/figma/notice-cancel.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cancelText}>{mode === 'edit' ? '수정 취소' : '작성 취소'}</Text></Pressable><Pressable disabled={busy} style={styles.button} onPress={submit}><Image source={require('../../assets/figma/notice-submit.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.submitText}>{mode === 'edit' ? '수정 완료' : '공지하기'}</Text></Pressable></View></View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 20 }, empty: { color: '#777', fontSize: 13, textAlign: 'center', paddingVertical: 24 }, card: { height: 140, padding: 16, marginBottom: 14 }, meta: { color: '#888', fontSize: 11 }, cardTitle: { color: '#151515', fontSize: 14, fontWeight: '700', marginTop: 12 }, summary: { color: '#777', fontSize: 12, marginTop: 10 }, more: { color: '#0099ff', fontSize: 11, textAlign: 'right', marginTop: 'auto' }, detail: { minHeight: 600, padding: 16 }, detailMeta: { color: '#777', fontSize: 12, marginTop: 8 }, detailTitle: { color: '#151515', fontSize: 16, fontWeight: '700', marginTop: 20 }, detailBody: { color: '#555', fontSize: 12, lineHeight: 24, marginTop: 8 }, detailButtons: { flexDirection: 'row', gap: 8, marginTop: 'auto', paddingHorizontal: 32, paddingTop: 24 }, detailButton: { height: 42, flex: 1, justifyContent: 'center', alignItems: 'center' }, deleteCard: { height: 200, paddingHorizontal: 20, paddingTop: 30 }, deleteTitle: { color: '#151515', fontSize: 17, fontWeight: '700' }, deleteDescription: { color: '#777', fontSize: 12, marginTop: 18 }, deleteButtons: { flexDirection: 'row', gap: 12, marginTop: 40, marginRight: 24 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginBottom: 8 }, titleInput: { height: 48, justifyContent: 'center', marginBottom: 12 }, inputText: { paddingHorizontal: 14, color: '#151515', fontSize: 14 }, bodyInput: { height: 290, paddingHorizontal: 14, paddingVertical: 12 }, editBody: { height: 385 }, bodyText: { flex: 1, color: '#151515', fontSize: 14, textAlignVertical: 'top', padding: 0 }, buttons: { flexDirection: 'row', gap: 12, marginTop: 36 }, button: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#737373', fontSize: 14, fontWeight: '700' }, submitText: { color: '#fff', fontSize: 14, fontWeight: '700' } });
