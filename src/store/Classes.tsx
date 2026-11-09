import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ClassSummary } from '../components/ClassCards';
import type { Schedule } from '../services/schedule';
import type { Notice } from '../components/NoticeScreen';

// In-memory store used until the class/notice server APIs exist. Data resets on app restart.
export type StoredClass = ClassSummary & { code: string };
type Input = { title: string; body: string };
export type RequestKind = 'absence' | 'makeup';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type StoredRequest = { id: string; kind: RequestKind; student: string; date: string; reason: string; status: RequestStatus };
export type AttendanceStatus = 'present' | 'absent';
export type StoredAttendance = { student: string; date: string; status: AttendanceStatus };
export type StoredAvailability = { id: string; date: string; startTime: string; endTime: string };
export type StoredNotification = { id: string; title: string; body: string; read: boolean };
type Value = {
  teacherClasses: StoredClass[];
  studentClasses: StoredClass[];
  createClass: (name: string, bannerUrl?: string | null) => StoredClass;
  joinClass: (code: string, student?: string) => StoredClass;
  deleteClass: (id: number) => void;
  leaveClass: (id: number, student?: string) => void;
  noticesOf: (classId: number) => Notice[];
  addNotice: (classId: number, input: Input, author: string) => void;
  updateNotice: (classId: number, id: string, input: Input) => void;
  removeNotice: (classId: number, id: string) => void;
  requestsOf: (classId: number) => StoredRequest[];
  addRequest: (classId: number, input: Omit<StoredRequest, 'id' | 'status'>) => void;
  setRequestStatus: (classId: number, id: string, status: RequestStatus) => void;
  membersOf: (classId: number) => string[];
  attendanceOf: (classId: number) => StoredAttendance[];
  markAttendance: (classId: number, student: string, date: string, status: AttendanceStatus) => void;
  cancelRequest: (classId: number, id: string) => void;
  availabilityOf: (classId: number) => StoredAvailability[];
  addAvailability: (classId: number, input: Omit<StoredAvailability, 'id'>) => void;
  removeAvailability: (classId: number, id: string) => void;
  schedulesOf: (classId: number) => Schedule[];
  addSchedule: (classId: number, input: { studentId: number; startTime: string; endTime: string }) => void;
  notifications: StoredNotification[];
  markAllRead: () => void;
};
const Ctx = createContext<Value | null>(null);
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(taken: Set<string>) {
  let code = '';
  do { code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''); } while (taken.has(code));
  return code;
}
function dateLabel() { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; }

export function ClassesProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<StoredClass[]>([]);
  const [joined, setJoined] = useState<number[]>([]);
  const [notices, setNotices] = useState<Record<number, Notice[]>>({});
  const [nextId, setNextId] = useState(1);
  const [requests, setRequests] = useState<Record<number, StoredRequest[]>>({});
  const [availability, setAvailability] = useState<Record<number, StoredAvailability[]>>({});
  const [schedules, setSchedules] = useState<Record<number, Schedule[]>>({});
  const [members, setMembers] = useState<Record<number, string[]>>({});
  const [attendance, setAttendance] = useState<Record<number, StoredAttendance[]>>({});
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const notify = useCallback((title: string, body: string) => setNotifications(prev => [{ id: `n-${Date.now()}-${prev.length}`, title, body, read: false }, ...prev]), []);
  const createClass = useCallback((name: string, bannerUrl?: string | null) => {
    const item: StoredClass = { id: nextId, name, bannerUrl: bannerUrl ?? null, code: makeCode(new Set(classes.map(c => c.code))) };
    setNextId(nextId + 1); setClasses(prev => [...prev, item]);
    return item;
  }, [classes, nextId]);
  const joinClass = useCallback((code: string, student = '학생') => {
    const item = classes.find(c => c.code === code.trim().toUpperCase());
    if (!item) throw new Error('수업코드를 찾을 수 없어요.');
    if (joined.includes(item.id)) throw new Error('이미 참여한 수업이에요.');
    setJoined(prev => [...prev, item.id]);
    setMembers(prev => ({ ...prev, [item.id]: (prev[item.id] ?? []).includes(student) ? prev[item.id] : [...(prev[item.id] ?? []), student] }));
    return item;
  }, [classes, joined]);
  const deleteClass = useCallback((id: number) => {
    setClasses(prev => prev.filter(c => c.id !== id)); setJoined(prev => prev.filter(x => x !== id));
    const drop = <T,>(prev: Record<number, T>) => { const { [id]: _removed, ...rest } = prev; return rest; };
    setNotices(drop); setRequests(drop); setAvailability(drop); setSchedules(drop); setMembers(drop); setAttendance(drop);
  }, []);
  const leaveClass = useCallback((id: number, student = '학생') => {
    setJoined(prev => prev.filter(x => x !== id));
    setMembers(prev => ({ ...prev, [id]: (prev[id] ?? []).filter(name => name !== student) }));
  }, []);
  const noticesOf = useCallback((classId: number) => notices[classId] ?? [], [notices]);
  const addNotice = useCallback((classId: number, input: Input, author: string) => {
    const item: Notice = { id: `${classId}-${Date.now()}`, title: input.title, body: input.body, author, dateLabel: dateLabel() };
    setNotices(prev => ({ ...prev, [classId]: [item, ...(prev[classId] ?? [])] }));
    notify('새 공지', input.title);
  }, [notify]);
  const updateNotice = useCallback((classId: number, id: string, input: Input) => {
    setNotices(prev => ({ ...prev, [classId]: (prev[classId] ?? []).map(n => n.id === id ? { ...n, ...input } : n) }));
  }, []);
  const removeNotice = useCallback((classId: number, id: string) => {
    setNotices(prev => ({ ...prev, [classId]: (prev[classId] ?? []).filter(n => n.id !== id) }));
  }, []);
  const requestsOf = useCallback((classId: number) => requests[classId] ?? [], [requests]);
  const addRequest = useCallback((classId: number, input: Omit<StoredRequest, 'id' | 'status'>) => {
    setRequests(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), { ...input, id: `${classId}-${Date.now()}`, status: 'pending' as const }] }));
    notify(input.kind === 'absence' ? '결석 신청' : '보강 신청', `${input.student} · ${input.date}`);
  }, [notify]);
  const setRequestStatus = useCallback((classId: number, id: string, status: RequestStatus) => {
    setRequests(prev => ({ ...prev, [classId]: (prev[classId] ?? []).map(r => r.id === id ? { ...r, status } : r) }));
    notify(status === 'approved' ? '신청 승인' : '신청 거절', '신청 처리 결과가 반영됐어요.');
  }, [notify]);
  const membersOf = useCallback((classId: number) => members[classId] ?? [], [members]);
  const attendanceOf = useCallback((classId: number) => attendance[classId] ?? [], [attendance]);
  const markAttendance = useCallback((classId: number, student: string, date: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []).filter(a => !(a.student === student && a.date === date)), { student, date, status }] }));
  }, []);
  const cancelRequest = useCallback((classId: number, id: string) => setRequests(prev => ({ ...prev, [classId]: (prev[classId] ?? []).filter(r => r.id !== id) })), []);
  const availabilityOf = useCallback((classId: number) => availability[classId] ?? [], [availability]);
  const addAvailability = useCallback((classId: number, input: Omit<StoredAvailability, 'id'>) => setAvailability(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), { ...input, id: `${classId}-${Date.now()}` }] })), []);
  const removeAvailability = useCallback((classId: number, id: string) => setAvailability(prev => ({ ...prev, [classId]: (prev[classId] ?? []).filter(a => a.id !== id) })), []);
  const schedulesOf = useCallback((classId: number) => schedules[classId] ?? [], [schedules]);
  const addSchedule = useCallback((classId: number, input: { studentId: number; startTime: string; endTime: string }) => {
    setSchedules(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), { ...input, classId, scheduleId: Date.now() + (prev[classId]?.length ?? 0) }] }));
  }, []);
  const markAllRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);
  const studentClasses = useMemo(() => classes.filter(c => joined.includes(c.id)), [classes, joined]);
  const value = useMemo(() => ({ teacherClasses: classes, studentClasses, createClass, joinClass, deleteClass, leaveClass, noticesOf, addNotice, updateNotice, removeNotice, schedulesOf, addSchedule, requestsOf, addRequest, setRequestStatus, membersOf, attendanceOf, markAttendance, cancelRequest, availabilityOf, addAvailability, removeAvailability, notifications, markAllRead }), [classes, studentClasses, createClass, joinClass, deleteClass, leaveClass, noticesOf, addNotice, updateNotice, removeNotice, schedulesOf, addSchedule, requestsOf, addRequest, setRequestStatus, membersOf, attendanceOf, markAttendance, cancelRequest, availabilityOf, addAvailability, removeAvailability, notifications, markAllRead]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useClasses() {
  const value = useContext(Ctx);
  if (!value) throw new Error('ClassesProvider is missing');
  return value;
}
