import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession, type Session } from '../auth/Session';
import { parseServerDate, scheduleAccessibility, scheduleApi, validateScheduleList, type Schedule, type ScheduleInput } from '../services/schedule';
import { DateTimeField } from './DateTimeField';
import { TimeRangeField } from './TimeRangeField';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
export type StudentOption = { id: number; name: string };
export function ScheduleManagement({ classId, registration, onRegisterChange, students: availableStudents = [], localSchedules, onCreateLocal }: { classId?: number; registration: boolean; onRegisterChange: (active: boolean) => void; students?: StudentOption[]; localSchedules?: Schedule[]; onCreateLocal?: (input: ScheduleInput) => void }) {
  const { session } = useSession();
  const [result, setResult] = useState<{ session: Session; classId: number; revision: number; schedules?: Schedule[]; error?: string } | null>(null);
  const [choosingStudent, setChoosingStudent] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const localMode = localSchedules !== undefined;
  const current = result && result.session === session && result.classId === classId && result.revision === revision ? result : null;
  useEffect(() => {
    if (localMode || !session || !classId) return;
    let active = true;
    scheduleApi.list(classId, session.accessToken).then(data => {
      const schedules = validateScheduleList(data, classId);
      if (active) setResult({ session, classId, revision, schedules });
    }).catch(e => { if (active) setResult({ session, classId, revision, error: e instanceof Error ? e.message : '일정을 불러오지 못했어요.' }); });
    return () => { active = false; };
  }, [classId, session, revision, localMode]);
  const schedules = localMode ? localSchedules : current?.schedules;
  const rows = useMemo(() => (schedules ?? []).map(item => ({ ...item, start: parseServerDate(item.startTime) })).filter(item => item.start.isValid()).sort((a, b) => a.start.valueOf() - b.start.valueOf()), [schedules]);
  const invalidCount = (schedules?.length ?? 0) - rows.length;
  const days = useMemo(() => { const found = [...new Set(rows.map(item => item.start.day()))].sort((a, b) => a - b); return found.length ? found : [1, 3, 5]; }, [rows]);
  const students = useMemo(() => [...new Set(rows.map(item => item.studentId))].sort((a, b) => a - b), [rows]);
  function openRegistration() { setStudentId(null); setDate(''); setStart(''); setEnd(''); onRegisterChange(true); }
  function selectStudent() {
    if (!availableStudents.length) return localMode
      ? Alert.alert('학생이 없어요', '수업에 참여한 학생이 아직 없어요.')
      : Alert.alert('준비 중', '학생 목록 조회 기능은 준비 중이에요.');
    setChoosingStudent(true);
  }
  async function createSchedule() {
    if (!classId || (localMode ? !onCreateLocal : !session)) return Alert.alert('로그인과 수업 정보가 필요해요.');
    if (session && session.user.role !== 'TEACHER') return Alert.alert('선생님만 일정을 등록할 수 있어요.');
    if (!studentId || !availableStudents.some(student => student.id === studentId)) return Alert.alert('학생을 선택해주세요.');
    const startDate = parseServerDate(`${date} ${start}:00`);
    const endDate = parseServerDate(`${date} ${end}:00`);
    if (!startDate.isValid() || !endDate.isValid() || !endDate.isAfter(startDate)) return Alert.alert('날짜와 시간을 확인해주세요.');
    if (localMode && onCreateLocal) { onCreateLocal({ studentId, startTime: startDate.format('YYYY-MM-DD HH:mm:ss'), endTime: endDate.format('YYYY-MM-DD HH:mm:ss') }); onRegisterChange(false); return; }
    if (!session) return;
    setBusy(true);
    try {
      await scheduleApi.create(classId, { studentId, startTime: startDate.format('YYYY-MM-DD HH:mm:ss'), endTime: endDate.format('YYYY-MM-DD HH:mm:ss') }, session.accessToken);
      setRevision(value => value + 1); onRegisterChange(false);
    } catch (e) { Alert.alert('일정 등록 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  const nameOf = (id: number) => availableStudents.find(student => student.id === id)?.name ?? `학생 #${id}`;
  const status = localMode ? '등록된 일정이 없어요.' : !session ? '로그인이 필요해요.' : !classId ? '수업 정보가 필요해요.' : !current ? '일정을 불러오는 중이에요.' : current.error || '등록된 일정이 없어요.';
  const emptyState = <Pressable accessibilityRole={current?.error ? 'button' : undefined} disabled={!current?.error} onPress={() => setRevision(value => value + 1)}><Text style={styles.empty}>{status}{current?.error ? '\n다시 시도' : ''}</Text></Pressable>;
  return <View style={styles.content}>{invalidCount > 0 && <Text style={styles.warning}>날짜 형식이 올바르지 않은 일정 {invalidCount}개를 표시하지 못했어요.</Text>}{registration ? <>
    <Text style={styles.label}>학생</Text><Pressable style={styles.input} onPress={selectStudent}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.placeholder}>{availableStudents.find(student => student.id === studentId)?.name ?? '학생 선택'}</Text></Pressable>
    <Modal transparent visible={choosingStudent} animationType="fade" onRequestClose={() => setChoosingStudent(false)}><View style={styles.overlay}><View style={styles.choices}>{availableStudents.map(student => <Pressable key={student.id} onPress={() => { setStudentId(student.id); setChoosingStudent(false); }} style={styles.choice}><Text style={styles.choiceText}>{student.name}</Text></Pressable>)}<Pressable onPress={() => setChoosingStudent(false)} style={styles.choice}><Text style={styles.choiceText}>취소</Text></Pressable></View></View></Modal>
    <Text style={styles.label}>요일</Text><DateTimeField mode="date" value={date} onChange={setDate} />
    <Text style={styles.label}>수업 시간</Text><TimeRangeField start={start} end={end} onChange={(nextStart, nextEnd) => { setStart(nextStart); setEnd(nextEnd); }} />
    <Pressable disabled={busy} style={styles.register} onPress={createSchedule}><Image source={require('../../assets/figma/apply-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>등록</Text></Pressable>
    <View style={styles.registrationHeader}><Image source={require('../../assets/figma/schedule-header.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.headerCell}>학생</Text><Text style={styles.headerCell}>요일/시간</Text></View>
    {rows.length ? rows.map(item => <View key={item.scheduleId} style={styles.registrationRow}><Image source={require('../../assets/figma/schedule-row.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cell}>{nameOf(item.studentId)}</Text><Pressable accessibilityRole="button" accessibilityLabel={scheduleAccessibility(item.startTime, item.endTime)} onPress={() => Alert.alert('일정 상세', scheduleAccessibility(item.startTime, item.endTime))} style={styles.cell}><Text style={styles.cellText}>{weekdays[item.start.day()]} {item.start.format('HH:mm')}</Text></Pressable></View>) : emptyState}
  </> : <>
    <Text style={styles.title}>요일별 시간표</Text><ScrollView horizontal><View style={{ minWidth: 362, width: Math.max(362, (days.length + 1) * 100) }}><View style={styles.tableHeader}><Image source={require('../../assets/figma/schedule-header.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.headerCell}>학생</Text>{days.map(value => <Text key={value} style={styles.headerCell}>{weekdays[value]}</Text>)}</View>
    {students.length ? students.map(student => <View key={student} style={styles.tableRow}><Image source={require('../../assets/figma/schedule-row.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cell}>{nameOf(student)}</Text>{days.map(value => { const matching = rows.filter(item => item.studentId === student && item.start.day() === value); const details = matching.map(item => scheduleAccessibility(item.startTime, item.endTime)).join('\n'); return <Pressable key={value} accessibilityRole="button" accessibilityLabel={details || '일정 없음'} disabled={!matching.length} onPress={() => Alert.alert('일정 상세', details)} style={styles.cell}><Text style={styles.cellText}>{matching.map(item => item.start.format('HH:mm')).join('\n') || '—'}</Text></Pressable>; })}</View>) : emptyState}</View></ScrollView>
    <Pressable style={styles.open} onPress={openRegistration}><Text style={styles.buttonText}>+ 학생 시간표 등록</Text></Pressable>
  </>}</View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 12 }, warning: { color: '#f04444', fontSize: 12, marginBottom: 10 }, title: { color: '#151515', fontSize: 14, fontWeight: '700', marginBottom: 18 }, tableHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, headerCell: { flex: 1, fontSize: 12, color: '#777', fontWeight: '700' }, tableRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }, cell: { flex: 1, fontSize: 12, color: '#444' }, cellText: { fontSize: 12, color: '#444' }, empty: { borderWidth: 1, borderColor: '#eee', paddingVertical: 20, textAlign: 'center', fontSize: 12, color: '#777' }, open: { marginTop: 28, height: 42, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, label: { fontSize: 13, fontWeight: '700', color: '#555', marginTop: 14, marginBottom: 8 }, input: { height: 38, justifyContent: 'center', paddingHorizontal: 14 }, placeholder: { fontSize: 14, color: '#999' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 40 }, choices: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }, choice: { height: 42, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }, choiceText: { color: '#151515', fontSize: 14 }, register: { height: 42, marginTop: 16, justifyContent: 'center', alignItems: 'center' }, registrationHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 26 }, registrationRow: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 } });
