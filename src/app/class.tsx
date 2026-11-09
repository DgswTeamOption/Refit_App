import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import { ClassScreen } from '../components/ClassScreen';
import type { NoticeActions } from '../components/NoticeScreen';
import type { StudentRequest, StudentRequestActions } from '../components/StudentRequests';
import type { TeacherTab } from '../components/TeacherManagement';
import type { TeacherRow } from '../components/TeacherTable';
import type { CalendarMarks } from '../components/Calendar';
import { useSession } from '../auth/Session';
import { useClasses, type RequestKind } from '../store/Classes';

export default function ClassPage() {
  const { role, name, classId } = useLocalSearchParams<{ role?: string; name?: string; classId?: string }>();
  const { session, localUser } = useSession();
  const store = useClasses();
  const teacher = role === 'teacher';
  const id = classId && /^\d+$/.test(classId) && Number(classId) > 0 ? Number(classId) : undefined;
  const author = session?.user.name ?? localUser?.name ?? (teacher ? '선생님' : '학생');
  const { addNotice, updateNotice, removeNotice, addRequest, cancelRequest, addAvailability, removeAvailability, markAllRead, setRequestStatus, markAttendance, addSchedule } = store;
  const { requestsOf, availabilityOf, membersOf, attendanceOf } = store;
  const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);
  const members = useMemo(() => id === undefined ? [] : membersOf(id), [id, membersOf]);
  const attendance = useMemo(() => id === undefined ? [] : attendanceOf(id), [id, attendanceOf]);
  const statusCell = (status: 'pending' | 'approved' | 'rejected') => status === 'approved' ? { label: '승인', tone: 'blue' as const } : status === 'rejected' ? { label: '거절', tone: 'red' as const } : { label: '대기중', tone: 'neutral' as const };
  const requests = useMemo(() => id === undefined ? [] : requestsOf(id), [id, requestsOf]);
  const availability = useMemo(() => id === undefined ? [] : availabilityOf(id), [id, availabilityOf]);

  const noticeActions = useMemo<NoticeActions | undefined>(() => id === undefined ? undefined : {
    create: async input => addNotice(id, input, author),
    update: async (nid, input) => updateNotice(id, nid, input),
    remove: async nid => removeNotice(id, nid),
  }, [id, author, addNotice, updateNotice, removeNotice]);

  const requestActions = useMemo<Record<RequestKind, StudentRequestActions> | undefined>(() => {
    if (id === undefined) return undefined;
    const make = (kind: RequestKind): StudentRequestActions => ({
      submit: async ({ date, reason }) => addRequest(id, { kind, student: author, date, reason }),
      cancel: async rid => cancelRequest(id, rid),
    });
    return { absence: make('absence'), makeup: make('makeup') };
  }, [id, author, addRequest, cancelRequest]);

  const studentRequests = useMemo(() => {
    const mine = (kind: RequestKind): StudentRequest[] => requests.filter(r => r.kind === kind && r.student === author).map(r => ({ id: r.id, dateLabel: r.date, statusLabel: r.status === 'approved' ? '승인' : r.status === 'rejected' ? '거절' : '대기중', canCancel: r.status === 'pending' }));
    return { absence: mine('absence'), makeup: mine('makeup') };
  }, [requests, author]);

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
        return { id: student, cells: [student, `${makeups.filter(r => r.student === student).length}/${a.length}`, a[a.length - 1]?.date ?? '-'] };
      }),
      결석정보: absences.map(r => ({ id: r.id, cells: [r.student, r.date, r.reason, statusCell(r.status)], actions: r.status === 'pending' ? ['승인' as const, '거절' as const] : undefined })),
      보강: makeups.map(r => ({ id: r.id, cells: [r.student, r.date, statusCell(r.status)], actions: r.status === 'pending' ? ['승인' as const, '거절' as const] : undefined })),
      보강설정: availability.map(a => ({ id: a.id, cells: [a.date, `${a.startTime} ~ ${a.endTime}`], actions: ['삭제' as const] })),
    };
  }, [requests, availability, members, attendance, today]);

  const calendarMarks = useMemo<CalendarMarks>(() => {
    const marks: CalendarMarks = {};
    requests.filter(r => r.status !== 'rejected' && (teacher || r.student === author)).forEach(r => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) (marks[r.date] ??= []).push(r.status === 'pending' ? 'pending' : r.status === 'approved' ? (r.kind === 'absence' ? 'absence' : 'makeup') : 'pending');
    });
    attendance.filter(a => a.status === 'present' && (teacher || a.student === author)).forEach(a => { (marks[a.date] ??= []).push('attendance'); });
    return marks;
  }, [requests, attendance, teacher, author]);

  return <ClassScreen
    role={teacher ? 'teacher' : 'student'} name={name || '수업'} classId={id}
    notices={id === undefined ? [] : store.noticesOf(id)} noticeActions={noticeActions}
    studentRequests={studentRequests} requestActions={requestActions} teacherRows={teacherRows}
    onTeacherAction={(tab, rowId, action) => {
      if (id === undefined) return;
      if (tab === '보강설정' && action === '삭제') removeAvailability(id, rowId);
      else if ((tab === '결석정보' || tab === '보강') && (action === '승인' || action === '거절')) setRequestStatus(id, rowId, action === '승인' ? 'approved' : 'rejected');
      else if (tab === '출석' && (action === '출석' || action === '결석')) markAttendance(id, rowId, today, action === '출석' ? 'present' : 'absent');
    }}
    scheduleStudents={members.map((student, index) => ({ id: index + 1, name: student }))}
    localSchedules={id === undefined ? undefined : store.schedulesOf(id)}
    onCreateLocalSchedule={id === undefined ? undefined : input => addSchedule(id, input)}
    attendanceRows={attendance.filter(a => a.student === author).map(a => ({ id: `${a.student}-${a.date}`, cells: [a.date, { label: a.status === 'present' ? '출석' : '결석', tone: a.status === 'present' ? 'blue' as const : 'red' as const }] }))}
    attendanceSummary={`이번달 출석 ${attendance.filter(a => a.status === 'present' && a.date.slice(0, 7) === today.slice(0, 7)).length}건 · 결석 ${attendance.filter(a => a.status === 'absent' && a.date.slice(0, 7) === today.slice(0, 7)).length}건`}
    onNfc={id === undefined ? undefined : () => { markAttendance(id, author, today, 'present'); Alert.alert('출석 완료', '오늘 출석이 기록됐어요.'); }}
    onSaveAvailability={id === undefined ? undefined : async input => addAvailability(id, input)}
    notifications={store.notifications} notificationActions={{ markAllRead: async () => markAllRead() }}
    calendarMarks={calendarMarks}
  />;
}
