import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClassScreen } from '../components/ClassScreen';
import type { NoticeActions } from '../components/NoticeScreen';
import type { StudentRequest, StudentRequestActions } from '../components/StudentRequests';
import type { TeacherTab } from '../components/TeacherManagement';
import type { TeacherRow } from '../components/TeacherTable';
import { attendanceCalendarMarks, latestAbsenceLabel } from '../services/calendarMarks';
import { parseServerDate } from '../services/schedule';
import { noticeApi, attendanceApi, type ServerNotice, type Attendance, type AttendanceRow, type AttendanceStats } from '../services/classFeatures';
import { classroomApi, type ClassStudent } from '../services/classroom';
import { absenceApi, absenceStatusLabel, validateAbsenceList, type AbsenceListItem } from '../services/absence';
import { useSession } from '../auth/Session';
import { useClasses, type RequestKind } from '../store/Classes';

export default function ClassPage() {
  const { name, classId, source } = useLocalSearchParams<{ name?: string; classId?: string; source?: string }>();
  const { session, localUser } = useSession();
  const store = useClasses();
  const teacher = (session?.user.role ?? localUser?.role) === 'TEACHER';
  const id = classId && /^\d+$/.test(classId) && Number(classId) > 0 ? Number(classId) : undefined;
  const localId = source === 'server' ? undefined : id;
  const token = session?.accessToken;
  const studentId = session?.user.id;
  const [absenceRevision, setAbsenceRevision] = useState(0);
  const [absenceResult, setAbsenceResult] = useState<{ token: string; id: number; teacher: boolean; revision: number; items?: AbsenceListItem[]; error?: string } | null>(null);
  useFocusEffect(useCallback(() => {
    if (source !== 'server' || !id || !token) return;
    let active = true;
    const load = teacher ? absenceApi.listClass : absenceApi.listMine;
    load(id, token).then(items => {
      const verified = validateAbsenceList(items, id, teacher ? undefined : studentId);
      if (active) setAbsenceResult({ token, id, teacher, revision: absenceRevision, items: verified });
    }).catch(error => { if (active) setAbsenceResult({ token, id, teacher, revision: absenceRevision, error: error instanceof Error ? error.message : '결석 신청 내역을 불러오지 못했어요.' }); });
    return () => { active = false; };
  }, [source, id, token, teacher, studentId, absenceRevision]));
  const currentAbsences = absenceResult && absenceResult.token === token && absenceResult.id === id && absenceResult.teacher === teacher && absenceResult.revision === absenceRevision ? absenceResult : null;
  const absenceStatus = source === 'server' ? currentAbsences?.error ?? (!currentAbsences ? '결석 신청 내역을 불러오는 중이에요.' : undefined) : undefined;
  const [serverHome, setServerHome] = useState<{ token: string; id: number; name?: string; error?: string } | null>(null);
  useEffect(() => {
    if (source !== 'server' || !id || !token) return;
    let active = true;
    const now = new Date();
    classroomApi.home(id, now.getFullYear(), now.getMonth() + 1, token).then(data => {
      if (!data || data.classroomId !== id || typeof data.name !== 'string') throw new Error('수업 정보를 확인할 수 없어요.');
      if (active) setServerHome({ token, id, name: data.name });
    }).catch(error => { if (active) setServerHome({ token, id, error: error instanceof Error ? error.message : '수업 정보를 불러오지 못했어요.' }); });
    return () => { active = false; };
  }, [source, id, token]);
  const currentHome = serverHome && serverHome.token === token && serverHome.id === id ? serverHome : null;
  const author = session?.user.name ?? localUser?.name ?? (teacher ? '선생님' : '학생');
  const { addNotice, updateNotice, removeNotice, addRequest, cancelRequest, addAvailability, updateAvailability, removeAvailability, markAllRead, setRequestStatus, markAttendance, addSchedule } = store;
  const { requestsOf, availabilityOf, membersOf, attendanceOf } = store;
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);
  const members = useMemo(() => localId === undefined ? [] : membersOf(localId), [localId, membersOf]);
  const attendance = useMemo(() => localId === undefined ? [] : attendanceOf(localId), [localId, attendanceOf]);
  const statusCell = (status: 'pending' | 'approved' | 'rejected') => status === 'approved' ? { label: '승인', tone: 'blue' as const } : status === 'rejected' ? { label: '거절', tone: 'red' as const } : { label: '대기중', tone: 'neutral' as const };
  const requests = useMemo(() => localId === undefined ? [] : requestsOf(localId), [localId, requestsOf]);
  const availability = useMemo(() => localId === undefined ? [] : availabilityOf(localId), [localId, availabilityOf]);

  const [featureRevision, setFeatureRevision] = useState(0);
  const [features, setFeatures] = useState<{ key: string; students: ClassStudent[]; notices: ServerNotice[]; attendance: Attendance[]; attendanceRows: AttendanceRow[]; stats: AttendanceStats[]; error?: string } | null>(null);
  const featureKey = `${token}-${id}-${teacher}`;
  useFocusEffect(useCallback(() => {
    if (source !== 'server' || !id || !token) return;
    let active = true;
    const now = new Date();
    const tasks = [noticeApi.list(id, token), teacher ? classroomApi.students(id, token) : Promise.resolve([]), teacher ? attendanceApi.list(id, today, token) : attendanceApi.mine(id, now.getFullYear(), now.getMonth() + 1, token), attendanceApi.stats(id, now.getFullYear(), now.getMonth() + 1, token)];
    Promise.allSettled(tasks).then(([notices, students, attendanceData, stats]) => {
      if (!active) return;
      const errors = [notices, students, attendanceData, stats].filter(result => result.status === 'rejected');
      setFeatures({ key: featureKey, notices: notices.status === 'fulfilled' && Array.isArray(notices.value) ? notices.value as ServerNotice[] : [], students: students.status === 'fulfilled' && Array.isArray(students.value) ? students.value as ClassStudent[] : [], attendance: !teacher && attendanceData.status === 'fulfilled' && Array.isArray(attendanceData.value) ? attendanceData.value as Attendance[] : [], attendanceRows: teacher && attendanceData.status === 'fulfilled' && Array.isArray(attendanceData.value) ? attendanceData.value as AttendanceRow[] : [], stats: stats.status === 'fulfilled' && Array.isArray(stats.value) ? stats.value as AttendanceStats[] : [], error: errors.length ? '일부 수업 정보를 불러오지 못했어요. 다시 수업에 들어와 주세요.' : undefined });
    });
    return () => { active = false; };
  }, [source, id, token, teacher, today, featureRevision, featureKey]));
  const serverFeatures = features?.key === featureKey ? features : null;
  const refreshFeatures = () => setFeatureRevision(value => value + 1);
  const noticeActions = useMemo<NoticeActions | undefined>(() => localId === undefined ? (id && token && teacher ? { create: async input => { await noticeApi.create(id, input.title, input.body, token); refreshFeatures(); }, update: async (nid, input) => { await noticeApi.update(id, nid, input.title, input.body, token); refreshFeatures(); }, remove: async nid => { await noticeApi.remove(id, nid, token); refreshFeatures(); } } : undefined) : {
    create: async input => addNotice(localId, input, author),
    update: async (nid, input) => updateNotice(localId, nid, input),
    remove: async nid => removeNotice(localId, nid),
  }, [localId, id, token, teacher, author, addNotice, updateNotice, removeNotice]);

  const requestActions = useMemo<Partial<Record<RequestKind, StudentRequestActions>> | undefined>(() => {
    if (localId === undefined) {
      if (!id || !session || teacher) return undefined;
      return { absence: { submit: async ({ date, reason }) => {
        try {
          const result = await absenceApi.create(id, date, reason, session.accessToken);
          if (!result || !Number.isSafeInteger(result.id)) throw new Error('신청 결과를 확인하지 못했어요. 신청 내역을 확인해주세요.');
          Alert.alert('결석 신청 완료', '결석 신청이 접수됐어요.');
        } finally { setAbsenceRevision(value => value + 1); }
      }, cancel: async requestId => {
        const absenceId = Number(requestId);
        if (!Number.isSafeInteger(absenceId) || absenceId <= 0 || !currentAbsences?.items?.some(item => item.id === absenceId && item.student_id === session.user.id && item.class_id === id && item.status === 'PENDING')) throw new Error('대기 중인 결석 신청을 다시 확인해주세요.');
        try { await absenceApi.cancel(absenceId, session.accessToken); }
        finally { setAbsenceRevision(value => value + 1); }
      }, view: requestId => {
        const item = currentAbsences?.items?.find(entry => String(entry.id) === requestId);
        if (item) Alert.alert('신청 상세', `날짜: ${item.absence_date}\n상태: ${absenceStatusLabel(item.status)}\n사유: ${item.reason}`);
      } } };
    }
    const make = (kind: RequestKind): StudentRequestActions => ({
      submit: async ({ date, reason }) => addRequest(localId, { kind, student: author, date, reason }),
      cancel: async rid => cancelRequest(localId, rid),
      view: rid => {
        const item = requests.find(r => r.id === rid && r.kind === kind && r.student === author);
        if (item) Alert.alert('신청 상세', `날짜: ${item.date}\n상태: ${item.status === 'approved' ? '수락됨' : item.status === 'rejected' ? '거절됨' : '승인 대기'}\n사유: ${item.reason}`);
      },
    });
    return { absence: make('absence'), makeup: make('makeup') };
  }, [localId, id, session, teacher, currentAbsences, author, addRequest, cancelRequest, requests]);

  const studentRequests = useMemo(() => {
    const mine = (kind: RequestKind): StudentRequest[] => requests.filter(r => r.kind === kind && r.student === author).map(r => {
      const date = parseServerDate(`${r.date} 00:00:00`);
      return { id: r.id, dateLabel: date.isValid() ? date.format('M월 D일') : r.date, statusLabel: r.status === 'approved' ? '수락됨' : r.status === 'rejected' ? '거절됨' : '승인 대기', canCancel: r.status === 'pending' };
    });
    const serverAbsences: StudentRequest[] = (currentAbsences?.items ?? []).map(item => {
      const date = parseServerDate(`${item.absence_date} 00:00:00`);
      return { id: String(item.id), dateLabel: date.isValid() ? date.format('M월 D일') : item.absence_date, statusLabel: absenceStatusLabel(item.status), canCancel: item.status === 'PENDING' };
    });
    return { absence: source === 'server' ? serverAbsences : mine('absence'), makeup: mine('makeup') };
  }, [requests, author, currentAbsences, source]);

  const teacherRows = useMemo<Partial<Record<TeacherTab, TeacherRow[]>>>(() => {
    const absences = requests.filter(r => r.kind === 'absence');
    const makeups = requests.filter(r => r.kind === 'makeup');
    const students = requests.map(r => r.student);
    return {
      출석: members.map(student => {
        const today_ = attendance.find(a => a.student === student && a.date === today);
        return { id: student, cells: [student, today_ ? { label: today_.status === 'present' ? '출석' : '결석', tone: today_.status === 'present' ? 'blue' as const : 'red' as const } : { label: '미체크', tone: 'neutral' as const }], actions: ['출석' as const, '결석' as const] };
      }),
      학생: [...new Set([...members, ...students])].map(student => {
        const a = absences.filter(r => r.student === student);
        return { id: student, cells: [student, `${makeups.filter(r => r.student === student).length}/${a.length}`, latestAbsenceLabel(absences, attendance, student, today)] };
      }),
      결석정보: absences.map(r => ({ id: r.id, cells: [r.student, r.date, r.reason, statusCell(r.status)], reasonDetail: r.reason, actions: r.status === 'pending' ? ['승인' as const, '거절' as const] : undefined })),
      보강: makeups.map(r => ({ id: r.id, cells: [r.student, r.date, statusCell(r.status)], actions: r.status === 'pending' ? ['승인' as const, '거절' as const] : undefined })),
      보강설정: availability.map(a => ({ id: a.id, cells: [a.date, `${a.startTime} ~ ${a.endTime}`], actions: ['삭제' as const] })),
    };
  }, [requests, availability, members, attendance, today]);

  const calendarMarks = useMemo(() => {
    const localMarks = attendanceCalendarMarks(requests, attendance, teacher, author);
    if (source !== 'server') return localMarks;
    for (const item of currentAbsences?.items ?? []) {
      if (item.status === 'APPROVED' && /^\d{4}-\d{2}-\d{2}$/.test(item.absence_date)) localMarks[item.absence_date] = ['absence'];
    }
    return localMarks;
  }, [requests, attendance, teacher, author, source, currentAbsences]);
  const serverTeacherRows: Partial<Record<TeacherTab, TeacherRow[]>> = { ...teacherRows, 학생: (serverFeatures?.students ?? []).map(student => ({ id: String(student.studentId), cells: [student.name, `${student.makeupCount}/${student.absenceCount}`, student.lastAbsenceDate ?? '—'] })), 출석: (serverFeatures?.attendanceRows ?? []).map(row => ({ id: String(row.schedule_id), cells: [row.student_name, row.status === 'PRESENT' ? '출석' : row.status === 'ABSENT' ? '결석' : row.status === 'LATE' ? '지각' : '미체크'], actions: ['출석' as const, '결석' as const] })), 결석정보: (currentAbsences?.items ?? []).map(item => ({ id: String(item.id), cells: [item.student_name || `학생 #${item.student_id}`, item.absence_date, item.reason, item.status === 'APPROVED' ? { label: '승인', tone: 'blue' as const } : item.status === 'REJECTED' ? { label: '거절', tone: 'red' as const } : { label: item.status === 'CANCELED' ? '취소' : '대기중', tone: 'neutral' as const }], reasonDetail: item.reason, actions: item.status === 'PENDING' ? ['승인' as const, '거절' as const] : undefined })) };

  return <ClassScreen
    role={teacher ? 'teacher' : 'student'} name={currentHome?.name || name || '수업'} classId={id} loadError={currentHome?.error ?? serverFeatures?.error}
    notices={localId === undefined ? (serverFeatures?.notices ?? []).map(item => ({ id: String(item.noticeId), title: item.title, body: item.content, author: item.writerId === session?.user.id ? author : '선생님', dateLabel: item.createdAt, canEdit: item.writerId === session?.user.id })) : store.noticesOf(localId)} noticeActions={noticeActions}
    studentRequests={studentRequests} requestActions={requestActions} teacherRows={source === 'server' ? serverTeacherRows : teacherRows} serverDataUnavailable={localId === undefined} absenceStatus={absenceStatus} onRefreshAbsences={source === 'server' ? () => setAbsenceRevision(value => value + 1) : undefined} onRetryAbsences={currentAbsences?.error ? () => setAbsenceRevision(value => value + 1) : undefined}
    onTeacherAction={localId === undefined ? (source === 'server' && teacher && token ? async (tab, rowId, action) => {
      if (tab === '출석' && (action === '출석' || action === '결석') && id) { try { await attendanceApi.set(id, Number(rowId), action === '출석' ? 'PRESENT' : 'ABSENT', token); } finally { refreshFeatures(); } return; }
      if (tab !== '결석정보' || (action !== '승인' && action !== '거절')) throw new Error('해당 기능은 준비 중이에요.');
      const absenceId = Number(rowId);
      if (!Number.isSafeInteger(absenceId) || absenceId <= 0 || !currentAbsences?.items?.some(item => item.id === absenceId && item.class_id === id && item.status === 'PENDING')) throw new Error('대기 중인 결석 신청을 다시 확인해주세요.');
      try { await (action === '승인' ? absenceApi.approve(absenceId, token) : absenceApi.reject(absenceId, token)); }
      finally { setAbsenceRevision(value => value + 1); }
    } : undefined) : (tab, rowId, action) => {
      if (tab === '보강설정' && action === '삭제') removeAvailability(localId, rowId);
      else if ((tab === '결석정보' || tab === '보강') && (action === '승인' || action === '거절')) setRequestStatus(localId, rowId, action === '승인' ? 'approved' : 'rejected');
      else if (tab === '출석' && (action === '출석' || action === '결석')) markAttendance(localId, rowId, today, action === '출석' ? 'present' : 'absent');
    }}
    scheduleStudents={localId === undefined ? (serverFeatures?.students ?? []).map(student => ({ id: student.studentId, name: student.name })) : store.studentOptionsOf(localId)}
    localSchedules={localId === undefined ? undefined : store.schedulesOf(localId)}
    onCreateLocalSchedule={localId === undefined ? undefined : input => addSchedule(localId, input)}
    attendanceRows={localId === undefined ? (serverFeatures?.attendance ?? []).map(a => ({ id: String(a.id), cells: [a.attendance_date, a.status === 'PRESENT' ? '출석' : a.status === 'ABSENT' ? '결석' : a.status === 'LATE' ? '지각' : '미체크'] })) : attendance.filter(a => a.student === author).map(a => ({ id: `${a.student}-${a.date}`, cells: [a.date, { label: a.status === 'present' ? '출석' : '결석', tone: a.status === 'present' ? 'blue' as const : 'red' as const }] }))}
    attendanceSummary={localId === undefined ? (serverFeatures ? { present: serverFeatures.stats.reduce((sum, row) => sum + row.present_count, 0), absent: serverFeatures.stats.reduce((sum, row) => sum + row.absent_count, 0) } : undefined) : { present: attendance.filter(a => a.status === 'present' && a.date.slice(0, 7) === today.slice(0, 7)).length, absent: attendance.filter(a => a.status === 'absent' && a.date.slice(0, 7) === today.slice(0, 7)).length }}
    availability={availability}
    onSaveAvailability={localId === undefined ? undefined : async (input, availabilityId) => { if (availabilityId) updateAvailability(localId, availabilityId, input); else addAvailability(localId, input); }}
    notifications={store.notifications} notificationActions={{ markAllRead: async () => markAllRead() }}
    calendarMarks={calendarMarks}
  />;
}
