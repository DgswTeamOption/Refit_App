import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../auth/Session';
import { makeupApi, type Availability, type Makeup } from '../services/makeup';
import { scheduleApi, type Schedule } from '../services/schedule';
import { DateTimeField } from './DateTimeField';

export function ServerMakeup({ classId, teacher, settings }: { classId: number; teacher: boolean; settings: boolean }) {
  const { session } = useSession();
  const token = session?.accessToken;
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [slots, setSlots] = useState<Availability[]>([]);
  const [requests, setRequests] = useState<Makeup[]>([]);
  const [scheduleId, setScheduleId] = useState<number>();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [editing, setEditing] = useState<Availability | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [nextSchedules, nextRequests] = await Promise.all([scheduleApi.list(classId, token), makeupApi.list(classId, token)]);
      if (!Array.isArray(nextSchedules) || !Array.isArray(nextRequests)) throw new Error('보강 정보를 확인할 수 없어요.');
      setSchedules(nextSchedules); setRequests(teacher ? nextRequests : nextRequests.filter(item => item.student_id === session?.user.id));
      const nextSlots = teacher ? await makeupApi.slots(classId, token) : (await Promise.all(nextSchedules.map(schedule => makeupApi.slots(classId, token, schedule.scheduleId)))).flatMap(items => items ?? []);
      if (!Array.isArray(nextSlots)) throw new Error('가능 시간을 확인할 수 없어요.');
      setSlots(Array.from(new Map(nextSlots.map(slot => [slot.id, slot])).values())); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '보강 정보를 불러오지 못했어요.'); }
  }, [classId, token, teacher, session?.user.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function run(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await operation(); setEditing(null); await load(); }
    catch (e) { Alert.alert('처리 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  const status = ['승인 대기', '승인', '거절', '취소'];
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable disabled={disabled || busy} onPress={onPress} style={[styles.button, (disabled || busy) && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <View style={styles.container}>
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error} · 다시 시도</Text></Pressable>}
    {teacher && settings && <>
      <Text style={styles.title}>{editing ? '가능 시간 수정' : '가능 시간 등록'}</Text>
      {!editing && <><Text style={styles.label}>수업 회차 선택</Text>{schedules.map(item => button(`${item.startTime} · 학생 #${item.studentId}${scheduleId === item.scheduleId ? ' ✓' : ''}`, () => setScheduleId(item.scheduleId)))}</>}
      {(!editing || editing.can_change_time) && <><Text style={styles.label}>보강 날짜</Text><DateTimeField mode="date" value={date} onChange={setDate} /><Text style={styles.label}>보강 시간</Text><DateTimeField mode="time" value={time} onChange={setTime} /></>}
      <Text style={styles.label}>정원{editing ? ` (최소 ${editing.min_capacity})` : ''}</Text><TextInput style={styles.input} keyboardType="number-pad" value={capacity} onChangeText={setCapacity} accessibilityLabel="정원" />
      {button('저장', () => { const count = Number(capacity); if (!Number.isInteger(count) || count < 1 || (editing && count < editing.min_capacity)) return Alert.alert('정원을 확인해주세요.'); if ((!editing || editing.can_change_time) && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))) return Alert.alert('날짜와 시간을 선택해주세요.'); if (!editing && !scheduleId) return Alert.alert('수업 회차를 선택해주세요.'); const nextTime = `${date}T${time}:00`; void run(() => editing ? makeupApi.updateSlot(editing.id, { capacity: count, ...(editing.can_change_time ? { makeup_time: nextTime } : {}) }, token!) : makeupApi.createSlot(classId, scheduleId!, nextTime, count, token!)); })}
      {editing && button('수정 취소', () => setEditing(null))}
    </>}
    {(!teacher || settings) && <><Text style={styles.title}>보강 가능 시간</Text>{!slots.length && <Text style={styles.label}>등록된 시간이 없어요.</Text>}{slots.map(slot => <View key={slot.id} style={styles.card}><Text>{slot.makeup_time.replace('T', ' ').slice(0, 16)} · 회차 #{slot.schedule_id}</Text><Text style={styles.label}>신청 {slot.applied_count}/{slot.capacity} · {slot.is_full ? '마감' : `잔여 ${slot.remaining_capacity}명`}</Text>{teacher ? <>{!!slot.lock_reason && <Text style={styles.label}>{slot.lock_reason}</Text>}{button('수정', () => { setEditing(slot); setDate(slot.makeup_time.slice(0, 10)); setTime(slot.makeup_time.slice(11, 16)); setCapacity(String(slot.capacity)); })}{button('삭제', () => Alert.alert('가능 시간을 삭제할까요?', '', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => void run(() => makeupApi.removeSlot(slot.id, token!)) }]), !slot.can_delete)}</> : button('신청', () => void run(() => makeupApi.apply(classId, slot.schedule_id, slot.makeup_time, token!)), slot.is_full)}</View>)}</>}
    {!settings && <><Text style={styles.title}>보강 신청 내역</Text>{!requests.length && <Text style={styles.label}>신청 내역이 없어요.</Text>}{requests.map(item => <View key={item.id} style={styles.card}><Text>학생 #{item.student_id} · {item.makeup_time.replace('T', ' ').slice(0, 16)}</Text><Text style={styles.label}>{status[item.approval_status] ?? '상태 확인 필요'}</Text>{item.approval_status === 0 && (teacher ? <>{button('승인', () => void run(() => makeupApi.approve(item.id, 1, token!)))}{button('거절', () => void run(() => makeupApi.approve(item.id, 2, token!)))}</> : button('신청 취소', () => void run(() => makeupApi.cancel(item.id, token!))))}</View>)}</>}
  </View>;
}
const styles = StyleSheet.create({ container: { padding: 20 }, title: { fontSize: 16, fontWeight: '700', marginVertical: 16 }, label: { color: '#666', marginVertical: 7 }, card: { padding: 14, marginVertical: 6, borderColor: '#ddd', borderWidth: 1, borderRadius: 8 }, button: { backgroundColor: '#0099ff', padding: 10, borderRadius: 8, marginVertical: 4, alignItems: 'center' }, disabled: { opacity: 0.45 }, buttonText: { color: '#fff', fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }, error: { color: '#d33' } });
