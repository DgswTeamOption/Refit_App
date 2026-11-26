import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../auth/Session';
import { attendanceApi } from '../services/classFeatures';
import { withRequestTimeout } from '../services/http';
import { makeupApi } from '../services/makeup';
import { readAttendanceToken } from '../services/nfc';
import { nfcAttendanceChoices, validateNfcMakeups, type NfcAttendanceChoice } from '../services/nfcAttendance';
import { scheduleApi, validateScheduleList } from '../services/schedule';

export function NfcAttendance({ classId, onComplete }: { classId: number; onComplete?: () => void }) {
  const { session } = useSession();
  const [items, setItems] = useState<NfcAttendanceChoice[]>([]);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const working = useRef(false);
  const activeScan = useRef<AbortController | null>(null);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { focused.current = true; setBusy(working.current); if (!working.current) setScanning(false); return () => { focused.current = false; activeScan.current?.abort(); }; }, []));

  async function show() {
    if (!session || working.current) return;
    working.current = true; setBusy(true); setNotice('');
    try {
      const [scheduleResult, makeupResult] = await Promise.allSettled([
        scheduleApi.list(classId, session.accessToken),
        withRequestTimeout(signal => makeupApi.list(classId, session.accessToken, signal), 20000, () => new Error('보강 일정을 불러오지 못했어요.')),
      ]);
      if (!focused.current) return;
      if (scheduleResult.status === 'rejected') throw scheduleResult.reason;
      const schedules = validateScheduleList(scheduleResult.value, classId);
      let makeups;
      if (makeupResult.status === 'fulfilled') { try { makeups = validateNfcMakeups(makeupResult.value, classId, session.user.id); } catch { /* Keep regular attendance available when makeup data is unavailable. */ } }
      const hasMakeups = !!makeups;
      const choices = nfcAttendanceChoices(schedules, makeups ?? [], classId, session.user.id);
      if (!choices.length) {
        if (!hasMakeups) throw new Error('보강 일정을 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
        return Alert.alert('오늘 출석할 일정이 없어요', '정규 수업 또는 승인된 보강 일정을 확인해주세요.');
      }
      setItems(choices);
      if (!hasMakeups) setNotice('보강 일정을 불러오지 못해 정규 수업만 표시돼요. 다시 시도하려면 창을 닫고 출석하기를 눌러주세요.');
      setOpen(true);
    } catch (e) { if (focused.current) Alert.alert('일정 조회 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { working.current = false; if (focused.current) setBusy(false); }
  }

  async function scan(item: NfcAttendanceChoice) {
    if (!session || working.current) return;
    working.current = true; setOpen(false); setBusy(true);
    const controller = new AbortController();
    activeScan.current = controller;
    setScanning(true);
    try {
      const tagToken = await readAttendanceToken(controller.signal);
      if (controller.signal.aborted || !focused.current) return;
      setScanning(false);
      const result = await attendanceApi.nfc(tagToken, item.scheduleId, session.accessToken);
      if (!result || !Number.isSafeInteger(result.id) || result.id <= 0 || result.class_id !== classId || result.schedule_id !== item.scheduleId || result.student_id !== session.user.id || (result.status !== 'PRESENT' && result.status !== 'LATE')) throw new Error('출석 결과를 확인하지 못했어요. 출석 내역을 확인해주세요.');
      if (focused.current) { Alert.alert(result.status === 'LATE' ? '지각 처리 완료' : '출석 완료'); onComplete?.(); }
    } catch (e) { if (!controller.signal.aborted && focused.current) Alert.alert('NFC 출석 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { if (activeScan.current === controller) activeScan.current = null; working.current = false; if (focused.current) { setScanning(false); setBusy(false); } }
  }

  return <>
    <Pressable accessibilityRole="button" disabled={busy} onPress={show} style={styles.button}><Text style={styles.buttonText}>{busy ? '처리 중...' : 'NFC 태그하기'}</Text></Pressable>
    <Modal transparent visible={open} onRequestClose={() => setOpen(false)}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.title}>출석할 수업을 선택해주세요</Text>{!!notice && <Text style={styles.notice}>{notice}</Text>}<ScrollView style={styles.options}>{items.map(item => <Pressable accessibilityRole="button" key={item.key} style={styles.option} onPress={() => void scan(item)}><Text>{item.label}</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setOpen(false)}><Text style={styles.cancel}>취소</Text></Pressable></View></View></Modal>
    {Platform.OS === 'android' && <Modal transparent visible={scanning} onRequestClose={() => activeScan.current?.abort()}><View style={styles.overlay}><View style={styles.dialog}><ActivityIndicator size="large" color="#0099ff" /><Text style={styles.scanTitle}>출석 태그를 대주세요</Text><Text style={styles.notice}>휴대폰 뒷면을 태그에 가까이 대고 잠시 유지해주세요.</Text><Pressable accessibilityRole="button" onPress={() => activeScan.current?.abort()}><Text style={styles.cancel}>취소</Text></Pressable></View></View></Modal>}
  </>;
}
const styles = StyleSheet.create({ button: { marginTop: 8, height: 42, borderRadius: 8, backgroundColor: '#f1f1f1', justifyContent: 'center', alignItems: 'center' }, buttonText: { color: '#555', fontWeight: '700' }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0006' }, dialog: { padding: 20, borderRadius: 12, backgroundColor: '#fff' }, title: { fontWeight: '700', fontSize: 16 }, scanTitle: { fontWeight: '700', fontSize: 16, marginTop: 16, textAlign: 'center' }, notice: { color: '#777', marginTop: 10, lineHeight: 20 }, options: { maxHeight: 300 }, option: { paddingVertical: 14 }, cancel: { color: '#777', paddingTop: 8 } });
