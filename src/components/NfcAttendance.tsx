import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../auth/Session';
import { attendanceApi } from '../services/classFeatures';
import { readAttendanceToken } from '../services/nfc';
import { scheduleApi, type Schedule } from '../services/schedule';
export function NfcAttendance({ classId, onComplete }: { classId: number; onComplete?: () => void }) {
  const { session } = useSession();
  const [items, setItems] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function show() {
    if (!session || busy) return;
    setBusy(true);
    try {
      const result = await scheduleApi.list(classId, session.accessToken);
      const date = new Date(); const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const current = (result ?? []).filter(item => item.studentId === session.user.id && item.startTime.slice(0, 10) === today);
      if (!current.length) return Alert.alert('오늘 배정된 수업 일정이 없어요.');
      setItems(current); setOpen(true);
    } catch (e) { Alert.alert('일정 조회 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  async function scan(item: Schedule) {
    if (!session || busy) return;
    setOpen(false); setBusy(true);
    try { const tagToken = await readAttendanceToken(); await attendanceApi.nfc(tagToken, item.scheduleId, session.accessToken); Alert.alert('출석 완료'); onComplete?.(); }
    catch (e) { Alert.alert('NFC 출석 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  return <><Pressable accessibilityRole="button" disabled={busy} onPress={show} style={styles.button}><Text style={styles.buttonText}>{busy ? '처리 중...' : 'NFC 태그하기'}</Text></Pressable><Modal transparent visible={open} onRequestClose={() => setOpen(false)}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.title}>출석할 수업을 선택해주세요</Text>{items.map(item => <Pressable key={item.scheduleId} style={styles.option} onPress={() => void scan(item)}><Text>{item.startTime} ~ {item.endTime.slice(11, 16)}</Text></Pressable>)}<Pressable onPress={() => setOpen(false)}><Text style={styles.cancel}>취소</Text></Pressable></View></View></Modal></>;
}
const styles = StyleSheet.create({ button: { marginTop: 8, height: 42, borderRadius: 8, backgroundColor: '#f1f1f1', justifyContent: 'center', alignItems: 'center' }, buttonText: { color: '#555', fontWeight: '700' }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0006' }, dialog: { padding: 20, borderRadius: 12, backgroundColor: '#fff' }, title: { fontWeight: '700', fontSize: 16 }, option: { paddingVertical: 14 }, cancel: { color: '#777', paddingTop: 8 } });
