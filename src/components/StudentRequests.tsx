import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar, type CalendarMarks } from './Calendar';
import { isPastAbsenceDate } from '../services/absence';

export type StudentRequest = { id: string; dateLabel: string; statusLabel: string; canCancel: boolean };
export type StudentRequestActions = {
  submit?: (input: { date: string; reason: string }) => Promise<void>;
  cancel?: (id: string) => Promise<void>;
  view?: (id: string) => void;
};
export function StudentRequests({ kind, requests = [], actions, calendarMarks, form, onFormChange, onRetry, emptyMessage = '신청 내역이 없어요.' }: { onRetry?: () => void; kind: 'absence' | 'makeup'; emptyMessage?: string; requests?: StudentRequest[]; actions?: StudentRequestActions; calendarMarks?: CalendarMarks; form: boolean; onFormChange: (active: boolean) => void }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const label = kind === 'absence' ? '결석' : '보강';
  async function submit() {
    if (inFlight.current) return;
    if (!date || !reason.trim()) return Alert.alert('날짜와 사유를 입력해주세요.');
    if (kind === 'absence' && isPastAbsenceDate(date)) return Alert.alert('지난 날짜로는 결석을 신청할 수 없어요.');
    if (reason.trim().length > 500) return Alert.alert('신청 사유는 500자 이하로 입력해주세요.');
    if (!actions?.submit) return Alert.alert('준비 중', `${label} 신청 기능은 준비 중이에요.`);
    inFlight.current = true; setBusy(true);
    try { await actions.submit({ date, reason: reason.trim() }); onFormChange(false); setDate(''); setReason(''); }
    catch (e) { Alert.alert('신청 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function cancel(id: string) {
    if (inFlight.current) return;
    if (!actions?.cancel) return Alert.alert('준비 중', '신청 취소 기능은 준비 중이에요.');
    inFlight.current = true; setBusy(true);
    try { await actions.cancel(id); }
    catch (e) { Alert.alert('취소 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <View style={styles.content}><Calendar showLegend marks={calendarMarks} selected={date} onSelect={form ? setDate : undefined} />
    {form ? <><Text style={styles.label}>신청 날짜</Text><View style={styles.date}><Image source={require('../../assets/figma/date-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={[styles.dateText, !!date && styles.value]}>{date || '달력에서 날짜를 선택해주세요'}</Text></View><Text style={styles.label}>신청 사유</Text><View style={styles.reason}><Image source={require('../../assets/figma/reason-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="신청 사유" value={reason} onChangeText={setReason} multiline placeholder="사유를 입력해주세요" placeholderTextColor="#aaa" style={styles.reasonText} /></View><Pressable accessibilityRole="button" disabled={busy} style={styles.apply} onPress={submit}><Image source={require('../../assets/figma/apply-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>신청하기</Text></Pressable></> : <><Pressable accessibilityRole="button" style={styles.open} onPress={() => onFormChange(true)}><Text style={styles.buttonText}>{label} 신청하기</Text></Pressable><Text style={styles.history}>신청 내역</Text>{requests.length ? requests.map(item => <View key={item.id} style={styles.row}><Image source={require('../../assets/figma/request-row.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.rowText}>{item.dateLabel} · {item.statusLabel}</Text><Pressable disabled={busy} onPress={() => item.canCancel ? cancel(item.id) : actions?.view ? actions.view(item.id) : Alert.alert('준비 중', '상태 조회 기능은 준비 중이에요.')}><Text style={[styles.rowAction, !item.canCancel && styles.statusAction]}>{item.canCancel ? '취소' : '상태 보기'}</Text></Pressable></View>) : <Pressable accessibilityRole={onRetry ? 'button' : undefined} disabled={!onRetry} onPress={onRetry}><Text style={styles.empty}>{emptyMessage}{onRetry ? '\n다시 시도' : ''}</Text></Pressable>}</>}
  </View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 24 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 6 }, date: { height: 40, justifyContent: 'center', paddingHorizontal: 14 }, dateText: { color: '#999', fontSize: 14 }, value: { color: '#151515' }, reason: { height: 74, paddingHorizontal: 14, paddingVertical: 10 }, reasonText: { flex: 1, color: '#151515', fontSize: 14, textAlignVertical: 'top', padding: 0 }, apply: { height: 42, marginTop: 18, justifyContent: 'center', alignItems: 'center' }, open: { height: 42, marginTop: 24, borderRadius: 10, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, history: { color: '#151515', fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 16 }, row: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 5 }, rowText: { color: '#444', fontSize: 12 }, rowAction: { color: '#0099ff', fontSize: 11 }, statusAction: { color: '#777' }, empty: { color: '#777', fontSize: 12, marginTop: 2 } });
