import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../auth/Session';
import { parseServerDate, scheduleApi, type Schedule } from '../services/schedule';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
export function ScheduleManagement({ classId, registration, onRegisterChange }: { classId?: number; registration: boolean; onRegisterChange: (active: boolean) => void }) {
  const { session } = useSession();
  const [result, setResult] = useState<{ key: string; schedules?: Schedule[]; error?: string } | null>(null);
  const [choosingDay, setChoosingDay] = useState(false);
  const requestKey = session && classId ? `${session.user.id}:${classId}:${session.accessToken}` : '';
  const current = result?.key === requestKey ? result : null;
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => {
    if (!session || !classId) return;
    let active = true;
    scheduleApi.list(classId, session.accessToken).then(data => {
      if (active) setResult({ key: requestKey, schedules: data ?? [] });
    }).catch(e => { if (active) setResult({ key: requestKey, error: e instanceof Error ? e.message : '일정을 불러오지 못했어요.' }); });
    return () => { active = false; };
  }, [classId, session, requestKey]);
  const rows = useMemo(() => (current?.schedules ?? []).map(item => ({ ...item, start: parseServerDate(item.startTime) })).filter(item => item.start.isValid()).sort((a, b) => a.start.valueOf() - b.start.valueOf()), [current?.schedules]);
  const days = useMemo(() => { const found = [...new Set(rows.map(item => item.start.day()))].sort((a, b) => a - b); return found.length ? found : [1, 3, 5]; }, [rows]);
  const students = useMemo(() => [...new Set(rows.map(item => item.studentId))].sort((a, b) => a - b), [rows]);
  function openRegistration() { onRegisterChange(true); }
  function unavailable() { Alert.alert('준비 중', '학생 목록과 요일별 반복 일정 등록 기능은 준비 중이에요.'); }
  const status = !session ? '로그인이 필요해요.' : !classId ? '수업 정보가 필요해요.' : !current ? '일정을 불러오는 중이에요.' : current.error || '등록된 일정이 없어요.';
  return <View style={styles.content}>{registration ? <>
    <Text style={styles.label}>학생</Text><Pressable style={styles.input} onPress={unavailable}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.placeholder}>학생 선택</Text></Pressable>
    <Text style={styles.label}>요일</Text><Pressable style={styles.input} onPress={() => setChoosingDay(true)}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.placeholder}>{day === null ? '요일 선택' : `${weekdays[day]}요일`}</Text></Pressable>
    <Modal transparent visible={choosingDay} animationType="fade" onRequestClose={() => setChoosingDay(false)}><View style={styles.overlay}><View style={styles.choices}>{weekdays.map((label, index) => <Pressable key={label} onPress={() => { setDay(index); setChoosingDay(false); }} style={styles.choice}><Text style={styles.choiceText}>{label}요일</Text></Pressable>)}<Pressable onPress={() => setChoosingDay(false)} style={styles.choice}><Text style={styles.choiceText}>취소</Text></Pressable></View></View></Modal>
    <Text style={styles.label}>수업 시간</Text><Pressable style={styles.input} onPress={unavailable}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.placeholder}>시간 선택</Text></Pressable>
    <Pressable style={styles.register} onPress={unavailable}><Image source={require('../../assets/figma/apply-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>등록</Text></Pressable>
    <View style={styles.registrationHeader}><Image source={require('../../assets/figma/schedule-header.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.headerCell}>학생</Text><Text style={styles.headerCell}>날짜/시간</Text></View>
    {rows.length ? rows.map(item => <View key={item.scheduleId} style={styles.registrationRow}><Image source={require('../../assets/figma/schedule-row.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cell}>학생 #{item.studentId}</Text><Text style={styles.cell}>{item.start.format('YYYY.MM.DD HH:mm')}</Text></View>) : <Text style={styles.empty}>{status}</Text>}
  </> : <>
    <Text style={styles.title}>요일별 시간표</Text><ScrollView horizontal><View style={{ minWidth: 362, width: Math.max(362, (days.length + 1) * 100) }}><View style={styles.tableHeader}><Image source={require('../../assets/figma/schedule-header.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.headerCell}>학생</Text>{days.map(value => <Text key={value} style={styles.headerCell}>{weekdays[value]}</Text>)}</View>
    {students.length ? students.map(student => <View key={student} style={styles.tableRow}><Image source={require('../../assets/figma/schedule-row.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cell}>학생 #{student}</Text>{days.map(value => <Text key={value} style={styles.cell}>{rows.filter(item => item.studentId === student && item.start.day() === value).map(item => item.start.format('MM/DD HH:mm')).join('\n') || '—'}</Text>)}</View>) : <Text style={styles.empty}>{status}</Text>}</View></ScrollView>
    <Pressable style={styles.open} onPress={openRegistration}><Text style={styles.buttonText}>+ 학생 시간표 등록</Text></Pressable>
  </>}</View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 12 }, title: { color: '#151515', fontSize: 14, fontWeight: '700', marginBottom: 18 }, tableHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, headerCell: { flex: 1, fontSize: 12, color: '#777', fontWeight: '700' }, tableRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }, cell: { flex: 1, fontSize: 12, color: '#444' }, empty: { borderWidth: 1, borderColor: '#eee', paddingVertical: 20, textAlign: 'center', fontSize: 12, color: '#777' }, open: { marginTop: 28, height: 42, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, label: { fontSize: 13, fontWeight: '700', color: '#555', marginTop: 14, marginBottom: 8 }, input: { height: 38, justifyContent: 'center', paddingHorizontal: 14 }, placeholder: { fontSize: 14, color: '#999' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 40 }, choices: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }, choice: { height: 42, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }, choiceText: { color: '#151515', fontSize: 14 }, register: { height: 42, marginTop: 16, justifyContent: 'center', alignItems: 'center' }, registrationHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 26 }, registrationRow: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 } });
