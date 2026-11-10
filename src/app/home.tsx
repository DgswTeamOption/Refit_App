import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert } from 'react-native';
import { HomeScreen } from '../components/HomeScreen';
import type { ClassSummary } from '../components/ClassCards';
import { classroomApi, ClassroomTimeoutError, type Classroom } from '../services/classroom';
import { ApiError } from '../services/http';
import { scheduleDates, studentScheduleDates } from '../services/schedule';
import { useSession } from '../auth/Session';
import { useClasses } from '../store/Classes';

function toSummary(item: Classroom, teacher: boolean): ClassSummary {
  if (!Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.name !== 'string') throw new Error('수업 정보를 확인할 수 없어요.');
  return { id: item.id, name: item.name, source: 'server', ...(teacher && item.classCode ? { code: item.classCode } : {}) };
}
export default function Home() {
  const store = useClasses();
  const { session, localUser } = useSession();
  const teacher = (session?.user.role ?? localUser?.role) === 'TEACHER';
  const [result, setResult] = useState<{ token: string; items?: ClassSummary[]; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const token = session?.accessToken;
  useFocusEffect(useCallback(() => {
    if (!token) return;
    let active = true;
    classroomApi.list(token).then(items => {
      if (!Array.isArray(items)) throw new Error('수업 목록을 확인할 수 없어요.');
      if (active) setResult({ token, items: items.map(item => toSummary(item, teacher)) });
    }).catch(error => {
      if (!active) return;
      const message = error instanceof ApiError && error.status === 404
        ? '수업 목록을 찾을 수 없어요. 서버의 수업 API를 확인해주세요.'
        : error instanceof Error ? error.message : '수업 목록을 불러오지 못했어요.';
      setResult(previous => ({ token, items: previous?.token === token ? previous.items : undefined, error: message }));
    });
    return () => { active = false; };
  // A revision change explicitly refreshes the list after mutations or a retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, teacher, revision]));
  async function submit(value: string, bannerUri?: string) {
    if (!session) {
      if (teacher) { const item = store.createClass(value, bannerUri); Alert.alert('수업이 만들어졌어요', `수업코드: ${item.code}`); }
      else store.joinClass(value, localUser?.name);
      return;
    }
    if (teacher && value.length > 50) throw new Error('수업명은 50자 이하여야 해요.');
    if (teacher && bannerUri) throw new Error('서버에 배너 저장 기능이 아직 없어요. 사진을 선택하지 않고 수업을 만들어주세요.');
    const code = value.toUpperCase();
    if (!teacher && !/^[A-Z0-9]{8}$/.test(code)) throw new Error('수업코드는 영문과 숫자 8자리로 입력해주세요.');
    let item: Classroom | undefined;
    try { item = teacher ? await classroomApi.create(value, session.accessToken) : await classroomApi.join(code, session.accessToken); }
    catch (error) { if (error instanceof ClassroomTimeoutError) setRevision(current => current + 1); throw error; }
    if (!item) throw new Error('수업 결과를 확인할 수 없어요.');
    const summary = toSummary(item, teacher);
    setResult(previous => previous && previous.token !== session.accessToken ? previous : { token: session.accessToken, items: [summary, ...(previous?.items ?? []).filter(existing => existing.id !== summary.id)] });
    if (teacher && summary.code) Alert.alert('수업이 만들어졌어요', `수업코드: ${summary.code}`);
    setRevision(value => value + 1);
  }
  async function removeClass(item: ClassSummary) {
    if (item.source === 'server') {
      if (!session) throw new Error('로그인이 필요해요.');
      if (teacher) throw new Error('수업 삭제 기능은 준비 중이에요.');
      try { await classroomApi.leave(item.id, session.accessToken); }
      catch (error) { if (error instanceof ClassroomTimeoutError) setRevision(current => current + 1); throw error; }
      setResult(previous => previous?.token === session.accessToken && previous.items ? { ...previous, items: previous.items.filter(existing => existing.id !== item.id) } : previous);
      setRevision(value => value + 1);
      return;
    }
    if (teacher) store.deleteClass(item.id);
    else store.leaveClass(item.id, session?.user.name ?? localUser?.name);
  }
  const studentName = session?.user.name ?? localUser?.name;
  const localList = (teacher ? store.teacherClasses : store.studentClasses).map(item => {
    const studentId = store.studentOptionsOf(item.id).find(student => student.name === studentName)?.id;
    const schedules = store.schedulesOf(item.id);
    return { ...item, calendarDates: teacher ? scheduleDates(schedules) : studentScheduleDates(schedules, studentId) };
  });
  const current = result?.token === token ? result : null;
  return <HomeScreen role={teacher ? 'teacher' : 'student'} classes={session ? current?.items ?? [] : localList} listStatus={session && !current ? '수업 목록을 불러오는 중이에요.' : current?.items?.length ? undefined : current?.error} listError={current?.items?.length ? current.error : undefined} onRetry={current?.error ? () => { setResult(previous => previous?.items?.length ? { ...previous, error: undefined } : null); setRevision(value => value + 1); } : undefined} onSubmitClass={submit} onRemoveClass={removeClass} notifications={store.notifications} notificationActions={{ markAllRead: async () => store.markAllRead() }} />;
}
