import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar } from './Calendar';

export function StudentRequests({ kind }: { kind: 'absence' | 'makeup' }) {
  const [form, setForm] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const label = kind === 'absence' ? '결석' : '보강';
  return <View style={styles.content}><Calendar onSelect={form ? setDate : undefined} />
    {form ? <><Text style={styles.label}>신청 날짜</Text><View style={styles.date}><Image source={require('../../assets/figma/date-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={[styles.dateText, date && styles.value]}>{date || '날짜를 선택해주세요'}</Text></View><Text style={styles.label}>신청 사유</Text><View style={styles.reason}><Image source={require('../../assets/figma/reason-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="신청 사유" value={reason} onChangeText={setReason} multiline placeholder="사유를 입력해주세요" placeholderTextColor="#aaa" style={styles.reasonText} /></View><Pressable accessibilityRole="button" style={styles.apply} onPress={() => Alert.alert('준비 중', `${label} 신청 기능은 준비 중이에요.`)}><Image source={require('../../assets/figma/apply-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>신청하기</Text></Pressable></> : <><Pressable accessibilityRole="button" style={styles.open} onPress={() => setForm(true)}><Text style={styles.buttonText}>{label} 신청하기</Text></Pressable><Text style={styles.history}>신청 내역</Text><Text style={styles.empty}>신청 내역이 없어요.</Text></>}
  </View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 24 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 6 }, date: { height: 40, justifyContent: 'center', paddingHorizontal: 14 }, dateText: { color: '#999', fontSize: 14 }, value: { color: '#151515' }, reason: { height: 74, paddingHorizontal: 14, paddingVertical: 10 }, reasonText: { flex: 1, color: '#151515', fontSize: 14, textAlignVertical: 'top', padding: 0 }, apply: { height: 42, marginTop: 18, justifyContent: 'center', alignItems: 'center' }, open: { height: 42, marginTop: 24, borderRadius: 10, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, history: { color: '#151515', fontSize: 15, fontWeight: '700', marginTop: 14 }, empty: { color: '#777', fontSize: 12, marginTop: 18 } });
