import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { start: string; end: string; onChange: (start: string, end: string) => void };
function timeDate(value: string) { const date = new Date(); const [hours, minutes] = /^\d{2}:\d{2}$/.test(value) ? value.split(':').map(Number) : [date.getHours(), date.getMinutes()]; date.setHours(hours, minutes, 0, 0); return date; }
export function TimeRangeField({ start, end, onChange }: Props) {
  const [step, setStep] = useState<'start' | 'end' | null>(null);
  const [draft, setDraft] = useState<Date | null>(null);
  const [pendingStart, setPendingStart] = useState('');
  function choose() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ mode: 'time', value: timeDate(start), is24Hour: true, onValueChange: (_e, first) => {
        const nextStart = dayjs(first).format('HH:mm');
        DateTimePickerAndroid.open({ mode: 'time', value: timeDate(end), is24Hour: true, onValueChange: (_event, second) => onChange(nextStart, dayjs(second).format('HH:mm')) });
      } });
    } else { setDraft(timeDate(start)); setStep('start'); }
  }
  function confirm() {
    if (!draft) return;
    const selected = dayjs(draft).format('HH:mm');
    if (step === 'start') { setPendingStart(selected); setDraft(timeDate(end)); setStep('end'); }
    else { onChange(pendingStart, selected); setStep(null); setDraft(null); }
  }
  return <><Pressable accessibilityRole="button" accessibilityLabel="수업 시간 선택" style={styles.field} onPress={choose}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={[styles.value, !start && styles.placeholder]}>{start && end ? `${start} – ${end}` : '시간 선택'}</Text></Pressable><Modal transparent visible={step !== null} animationType="fade" onRequestClose={() => setStep(null)}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.title}>{step === 'start' ? '시작 시간' : '종료 시간'}</Text>{draft && <DateTimePicker value={draft} mode="time" display="spinner" is24Hour onValueChange={(_e, selected) => setDraft(selected)} />}<View style={styles.actions}><Pressable onPress={() => setStep(null)}><Text style={styles.cancel}>취소</Text></Pressable><Pressable onPress={confirm}><Text style={styles.confirm}>{step === 'start' ? '다음' : '확인'}</Text></Pressable></View></View></View></Modal></>;
}
const styles = StyleSheet.create({ field: { height: 38, justifyContent: 'center', paddingHorizontal: 14 }, value: { color: '#151515', fontSize: 14 }, placeholder: { color: '#999' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 30 }, dialog: { backgroundColor: '#fff', borderRadius: 12, padding: 16 }, title: { color: '#151515', fontSize: 14, fontWeight: '700', textAlign: 'center' }, actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 }, cancel: { color: '#777', fontSize: 14 }, confirm: { color: '#0099ff', fontSize: 14, fontWeight: '700' } });
