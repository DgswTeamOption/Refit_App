import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { mode: 'date' | 'time'; value: string; onChange: (value: string) => void };
function initialValue(mode: Props['mode'], value: string): Date {
  if (mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date();
  if (mode === 'time' && /^\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }
  return date;
}
export function DateTimeField({ mode, value, onChange }: Props) {
  const [draft, setDraft] = useState<Date | null>(null);
  function choose() {
    const initial = initialValue(mode, value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: initial, mode, is24Hour: true, onValueChange: (_event, selected) => onChange(dayjs(selected).format(mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm')) });
    } else setDraft(initial);
  }
  return <><Pressable accessibilityRole="button" accessibilityLabel={mode === 'date' ? '날짜 선택' : '시간 선택'} style={styles.field} onPress={choose}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={[styles.value, !value && styles.placeholder]}>{value || (mode === 'date' ? '날짜 선택' : '시간 선택')}</Text></Pressable><Modal transparent visible={draft !== null} animationType="fade" onRequestClose={() => setDraft(null)}><View style={styles.overlay}><View style={styles.dialog}>{draft && <DateTimePicker value={draft} mode={mode} display="spinner" is24Hour onValueChange={(_event, selected) => setDraft(selected)} />}<View style={styles.actions}><Pressable onPress={() => setDraft(null)}><Text style={styles.cancel}>취소</Text></Pressable><Pressable onPress={() => { if (draft) onChange(dayjs(draft).format(mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm')); setDraft(null); }}><Text style={styles.confirm}>확인</Text></Pressable></View></View></View></Modal></>;
}
const styles = StyleSheet.create({ field: { height: 38, justifyContent: 'center', paddingHorizontal: 14 }, value: { color: '#151515', fontSize: 14 }, placeholder: { color: '#999' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 30 }, dialog: { backgroundColor: '#fff', borderRadius: 12, padding: 16 }, actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 }, cancel: { color: '#777', fontSize: 14 }, confirm: { color: '#0099ff', fontSize: 14, fontWeight: '700' } });
