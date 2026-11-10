import { Alert } from 'react-native';
import { HomeScreen } from '../components/HomeScreen';
import type { ClassSummary } from '../components/ClassCards';
import { scheduleDates, studentScheduleDates } from '../services/schedule';
import { useSession } from '../auth/Session';
import { useClasses } from '../store/Classes';
export default function Home() {
  const store = useClasses();
  const { session, localUser } = useSession();
  const teacher = (session?.user.role ?? localUser?.role) === 'TEACHER';
  function submit(value: string, bannerUri?: string) {
    if (teacher) { const item = store.createClass(value, bannerUri); Alert.alert('수업이 만들어졌어요', `수업코드: ${item.code}`); }
    else store.joinClass(value, session?.user.name ?? localUser?.name);
  }
  function removeClass(item: ClassSummary) {
    if (item.source === 'server') throw new Error('수업 삭제 및 나가기 기능은 준비 중이에요.');
    if (teacher) store.deleteClass(item.id);
    else store.leaveClass(item.id, session?.user.name ?? localUser?.name);
  }
  const studentName = session?.user.name ?? localUser?.name;
  const list = (teacher ? store.teacherClasses : store.studentClasses).map(item => {
    const studentId = store.studentOptionsOf(item.id).find(student => student.name === studentName)?.id;
    const schedules = store.schedulesOf(item.id);
    return { ...item, calendarDates: teacher ? scheduleDates(schedules) : studentScheduleDates(schedules, studentId) };
  });
  return <HomeScreen role={teacher ? 'teacher' : 'student'} classes={list} onSubmitClass={submit} onRemoveClass={removeClass} notifications={store.notifications} notificationActions={{ markAllRead: async () => store.markAllRead() }} />;
}
