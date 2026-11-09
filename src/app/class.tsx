import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
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
  const { session } = useSession();
  const store = useClasses();
  const teacher = role === 'teacher';
  const id = classId && /^\d+$/.test(classId) && Number(classId) > 0 ? Number(classId) : undefined;
  const author = session?.user.name ?? (teacher ? '선생님' : '학생');
  const { addNotice, updateNotice, removeNotice, addRequest, cancelRequest, addAvailability, removeAvailability, markAllRead } = store;
  const { requestsOf, availabilityOf } = store;
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
    const mine = (kind: RequestKind): StudentRequest[] => requests.filter(r => r.kind === kind && r.student === author).map(r => ({ id: r.id, dateLabel: r.date, statusLabel: '대기중', canCancel: true }));
    return { absence: mine('absence'), makeup: mine('makeup') };
  }, [requests, author]);

  const teacherRows = useMemo<Partial<Record<TeacherTab, TeacherRow[]>>>(() => {
    const absences = requests.filter(r => r.kind === 'absence');
    const makeups = requests.filter(r => r.kind === 'makeup');
    const students = [...new Set(requests.map(r => r.student))];
    return {
      학생: students.map(student => {
        const a = absences.filter(r => r.student === student);
        return { id: student, cells: [student, `${makeups.filter(r => r.student === student).length}/${a.length}`, a[a.length - 1]?.date ?? '-'] };
      }),
      결석정보: absences.map(r => ({ id: r.id, cells: [r.student, r.date, r.reason, { label: '대기중', tone: 'neutral' as const }] })),
      보강: makeups.map(r => ({ id: r.id, cells: [r.student, r.date, { label: '대기중', tone: 'neutral' as const }] })),
      보강설정: availability.map(a => ({ id: a.id, cells: [a.date, `${a.startTime} ~ ${a.endTime}`], actions: ['삭제' as const] })),
    };
  }, [requests, availability]);

  const calendarMarks = useMemo<CalendarMarks>(() => {
    const marks: CalendarMarks = {};
    requests.filter(r => teacher || r.student === author).forEach(r => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) (marks[r.date] ??= []).push('pending');
    });
    return marks;
  }, [requests, teacher, author]);

  return <ClassScreen
    role={teacher ? 'teacher' : 'student'} name={name || '수업'} classId={id}
    notices={id === undefined ? [] : store.noticesOf(id)} noticeActions={noticeActions}
    studentRequests={studentRequests} requestActions={requestActions} teacherRows={teacherRows}
    onTeacherAction={(tab, rowId, action) => { if (id !== undefined && tab === '보강설정' && action === '삭제') removeAvailability(id, rowId); }}
    onSaveAvailability={id === undefined ? undefined : async input => addAvailability(id, input)}
    notifications={store.notifications} notificationActions={{ markAllRead: async () => markAllRead() }}
    calendarMarks={calendarMarks}
  />;
}
