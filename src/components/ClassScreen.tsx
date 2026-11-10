import { Image } from 'expo-image';
import { NotificationBell, type NotificationActions, type NotificationItem } from './NotificationBell';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, type CalendarMarks } from './Calendar';
import { ProfileMenu } from './ProfileMenu';
import { StudentRequests, type StudentRequest, type StudentRequestActions } from './StudentRequests';
import { TeacherManagement, type TeacherTab, type AvailabilityInput, type AvailabilityItem } from './TeacherManagement';
import { TeacherTable, type TeacherRow, type TeacherActionLabel } from './TeacherTable';
import { NoticeScreen, type Notice, type NoticeMode, type NoticeActions } from './NoticeScreen';
import { ScheduleManagement, type StudentOption } from './ScheduleManagement';
import type { Schedule, ScheduleInput } from '../services/schedule';

type Role = 'student' | 'teacher';
type ClassScreenProps = {
  role: Role;
  name: string;
  classId?: number;
  notices?: Notice[];
  noticeActions?: NoticeActions;
  teacherRows?: Partial<Record<TeacherTab, TeacherRow[]>>;
  onTeacherAction?: (tab: TeacherTab, rowId: string, action: TeacherActionLabel) => void;
  studentRequests?: Partial<Record<'absence' | 'makeup', StudentRequest[]>>;
  requestActions?: Partial<Record<'absence' | 'makeup', StudentRequestActions>>;
  notifications?: NotificationItem[];
  notificationActions?: NotificationActions;
  calendarMarks?: CalendarMarks;
  scheduleStudents?: StudentOption[];
  availability?: AvailabilityItem[];
  onSaveAvailability?: (input: AvailabilityInput, id?: string) => Promise<void>;
  attendanceRows?: TeacherRow[];
  attendanceSummary?: { present: number; absent: number; makeup?: number };
  onNfc?: () => Promise<void> | void;
  localSchedules?: Schedule[];
  onCreateLocalSchedule?: (input: ScheduleInput) => void;
};
export function ClassScreen({ role, name, classId, notices = [], noticeActions, teacherRows, onTeacherAction, studentRequests, requestActions, notifications, notificationActions, calendarMarks, scheduleStudents, availability, onSaveAvailability, attendanceRows, attendanceSummary, onNfc, localSchedules, onCreateLocalSchedule }: ClassScreenProps) {
  const [tab, setTab] = useState('메인');
  const [registering, setRegistering] = useState(false);
  const [addingAvailability, setAddingAvailability] = useState(false);
  const [requestForm, setRequestForm] = useState(false);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeMode | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const teacher = role === 'teacher';
  const tabs = teacher ? ['메인', '학생', '결석정보', '출석', '보강', '보강설정', '스케줄 관리'] : ['메인', '결석 일정', '보강 일정', '출석'];
  async function startNfc() {
    if (!onNfc) return Alert.alert('준비 중', 'NFC 출석 기능은 준비 중이에요.');
    setNfcBusy(true);
    try { await onNfc(); }
    catch (error) { Alert.alert('NFC 출석 실패', error instanceof Error ? error.message : '다시 시도해주세요.'); }
    finally { setNfcBusy(false); }
  }
  function selectTab(next: string) {
    setNotice(null); setRegistering(false); setAddingAvailability(false); setRequestForm(false);
    if (next === '메인' || teacher || next === '결석 일정' || next === '보강 일정' || next === '출석') setTab(next);
    else Alert.alert('준비 중', `${next} 화면은 준비 중이에요.`);
  }
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}><Image source={require('../../assets/figma/logo.svg')} style={styles.logo} contentFit="contain" accessibilityLabel="Refit" /><View style={styles.headerActions}><NotificationBell items={notifications} actions={notificationActions} /><ProfileMenu /></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.classHeading}><Pressable onPress={() => notice ? setNotice(notice === 'list' ? null : 'list') : registering ? setRegistering(false) : addingAvailability ? setAddingAvailability(false) : router.replace({ pathname: '/home', params: { role } })}><Text style={styles.back}>{notice ? (notice === 'list' ? '‹ 수업으로 돌아가기' : '‹ 공지 목록으로 돌아가기') : registering ? '‹ 스케줄 관리로 돌아가기' : addingAvailability ? '‹ 보강설정으로 돌아가기' : '‹ 홈으로 돌아가기'}</Text></Pressable><Text style={styles.crumb}><Text style={styles.crumbLink}>홈</Text>  ›  <Text style={styles.crumbLink}>{name}</Text>  ›  {notice ? ({ list: '공지 목록', write: '공지 작성', view: '수업 공지', edit: '공지 수정', delete: '공지 삭제 확인' }[notice]) : registering ? '학생 시간표 등록' : addingAvailability ? '보강 가능 시간 추가' : requestForm ? (tab === '결석 일정' ? '결석 신청' : '보강 신청') : tab === '메인' ? '수업 홈' : tab}</Text><View style={styles.titleRow}><Text style={styles.title}>{name}</Text>{notice === 'list' && teacher && <Pressable style={styles.noticeAdd} onPress={() => setNotice('write')}><Text style={styles.noticeAddText}>+ 공지하기</Text></Pressable>}</View></View>
      <View style={styles.tabs}><Image source={require('../../assets/figma/class-tabs.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>{tabs.map(item => <Pressable key={item} onPress={() => selectTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabText, tab === item && styles.activeText]}>{item}</Text></Pressable>)}</ScrollView></View>
      {notice ? <NoticeScreen key={notice} mode={notice} notices={notices} selected={selectedNotice} teacher={teacher} actions={noticeActions} onSelect={item => { setSelectedNotice(item); setNotice('view'); }} onModeChange={setNotice} /> : teacher && tab !== '메인' && tab !== '스케줄 관리' ? <TeacherManagement key={`${tab}-${addingAvailability}`} tab={tab as TeacherTab} rows={teacherRows?.[tab as TeacherTab]} availability={availability} onAction={onTeacherAction ? (id, action) => onTeacherAction(tab as TeacherTab, id, action) : undefined} onSaveAvailability={onSaveAvailability} addingAvailability={addingAvailability} onAvailabilityChange={setAddingAvailability} /> : !teacher && tab === '출석' ? <View style={styles.main}><TeacherTable headings={['날짜', '출석 상태']} rows={attendanceRows ?? []} emptyMessage="출석 정보가 없어요." /></View> : tab === '결석 일정' || tab === '보강 일정' ? <StudentRequests key={tab} form={requestForm} onFormChange={setRequestForm} calendarMarks={calendarMarks} kind={tab === '결석 일정' ? 'absence' : 'makeup'} requests={studentRequests?.[tab === '결석 일정' ? 'absence' : 'makeup']} actions={requestActions?.[tab === '결석 일정' ? 'absence' : 'makeup']} /> : tab === '메인' ? <View style={styles.main}><Calendar showLegend marks={calendarMarks} />{teacher ? <><Text style={[styles.section, styles.attendanceSection]}>이번달 출석 현황</Text>{attendanceSummary ? <View style={styles.attendanceBadges}><View style={[styles.attendanceBadge, styles.presentBadge]}><Text style={[styles.badgeText, styles.presentText]}>출석 {attendanceSummary.present}회</Text></View><View style={[styles.attendanceBadge, styles.absentBadge]}><Text style={[styles.badgeText, styles.absentText]}>결석 {attendanceSummary.absent}회</Text></View><View style={[styles.attendanceBadge, styles.makeupBadge]}><Text style={[styles.badgeText, styles.makeupText]}>보강 {attendanceSummary.makeup === undefined ? '—' : `${attendanceSummary.makeup}회`}</Text></View></View> : <Text style={styles.placeholder}>출석 정보가 없어요.</Text>}</> : <><Text style={[styles.section, styles.attendanceSection]}>출석하기</Text><Pressable accessibilityRole="button" onPress={startNfc} disabled={nfcBusy} style={styles.nfc}><Image source={require('../../assets/figma/class-nfc-button.svg')} style={styles.nfcBackground} contentFit="fill" /><Text style={styles.nfcText}>NFC 태그하기</Text></Pressable></>}<View style={styles.noticeTitle}><Pressable accessibilityRole="button" accessibilityLabel="공지 목록" onPress={() => setNotice('list')}><Text style={styles.section}>공지</Text></Pressable>{teacher ? <Pressable accessibilityRole="button" accessibilityLabel="공지 작성" onPress={() => setNotice('write')} style={styles.homeNoticeAdd}><Image source={require('../../assets/figma/class-notice-add.svg')} style={styles.homeNoticeAddBackground} contentFit="contain" /><Text style={styles.homeNoticeAddText}>+ 공지</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setNotice('list')}><Text style={styles.more}>더보기</Text></Pressable>}</View>{notices[0] ? <Pressable accessibilityRole="button" onPress={() => { setSelectedNotice(notices[0]); setNotice('view'); }} style={styles.noticePreview}><Image source={require('../../assets/figma/class-notice-preview.svg')} style={styles.noticePreviewBackground} contentFit="fill" /><Text style={styles.noticeMeta}>{notices[0].author} · {notices[0].dateLabel}</Text><Text style={styles.noticePreviewTitle} numberOfLines={1}>{notices[0].title}</Text><Text style={styles.noticePreviewBody} numberOfLines={1}>{notices[0].body}</Text></Pressable> : <Text style={styles.placeholder}>등록된 공지가 없어요.</Text>}</View> : <ScheduleManagement classId={classId} students={scheduleStudents} localSchedules={localSchedules} onCreateLocal={onCreateLocalSchedule} registration={registering} onRegisterChange={setRegistering} />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#fff' }, header: { zIndex: 10, height: 70, borderBottomWidth: 1, borderColor: '#eee', paddingLeft: 24, paddingRight: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logo: { width: 81.4689, height: 38.0832 }, headerActions: { flexDirection: 'row', gap: 20, alignItems: 'center' }, bell: { width: 15.6, height: 18.6 }, avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' }, content: { paddingBottom: 30 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, noticeAdd: { backgroundColor: '#0099ff', height: 38, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }, noticeAddText: { color: '#fff', fontSize: 12, fontWeight: '700' }, classHeading: { paddingHorizontal: 20 }, back: { fontSize: 13, fontWeight: '700', color: '#0099ff', marginTop: 16 }, crumb: { color: '#777', fontSize: 12, marginTop: 26 }, crumbLink: { color: '#0099ff' }, title: { color: '#151515', fontSize: 23, fontWeight: '700', marginTop: 12, marginBottom: 12 }, tabs: { height: 52 }, tabRow: { alignItems: 'stretch', paddingHorizontal: 20, gap: 20 }, tab: { justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: '#151515' }, tabText: { color: '#777', fontSize: 12 }, activeText: { color: '#151515', fontWeight: '700' }, main: { paddingHorizontal: 20, paddingTop: 20 }, section: { fontSize: 15, fontWeight: '700', color: '#151515', marginTop: 24 }, attendanceSection: { fontSize: 16 }, attendanceBadges: { flexDirection: 'row', gap: 8, marginTop: 16 }, attendanceBadge: { height: 25, borderRadius: 12.5, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, presentBadge: { backgroundColor: '#e4f3ff' }, absentBadge: { backgroundColor: '#fce8e8' }, makeupBadge: { backgroundColor: '#fff3d4' }, badgeText: { fontSize: 12, fontWeight: '700' }, presentText: { color: '#3daeff' }, absentText: { color: '#ff6458' }, makeupText: { color: '#ffc45b' }, homeNoticeAdd: { width: 84, height: 32, alignItems: 'center', justifyContent: 'center' }, homeNoticeAddBackground: { position: 'absolute', width: 84, height: 32 }, homeNoticeAddText: { color: '#fff', fontSize: 10, fontWeight: '700' }, nfc: { marginTop: 8, height: 42, justifyContent: 'center', alignItems: 'center' }, nfcBackground: { position: 'absolute', left: 0, top: 0, width: '100%', height: 42 }, nfcText: { fontWeight: '700', color: '#737373', fontSize: 14 }, noticeTitle: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, more: { color: '#0099ff', fontSize: 12 }, noticePreview: { marginTop: 14, height: 113, paddingHorizontal: 14, paddingTop: 16 }, noticePreviewBackground: { position: 'absolute', left: 0, top: 0, width: '100%', height: 113 }, noticeMeta: { color: '#888', fontSize: 10 }, noticePreviewTitle: { color: '#151515', fontSize: 11, fontWeight: '700', marginTop: 14 }, noticePreviewBody: { color: '#777', fontSize: 10, marginTop: 14 }, placeholder: { color: '#777', fontSize: 13, marginTop: 14 }, schedule: { paddingHorizontal: 20 }, scheduleTitle: { fontSize: 14, fontWeight: '700', color: '#151515', marginTop: 12, marginBottom: 18 }, tableHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, tableHeading: { flex: 1, color: '#777', fontWeight: '700', fontSize: 12 }, emptySchedule: { color: '#777', fontSize: 12, textAlign: 'center', paddingVertical: 20, borderColor: '#eee', borderWidth: 1 }, addSchedule: { marginTop: 28, height: 42, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center' }, addText: { color: '#fff', fontSize: 14, fontWeight: '700' } });
