import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { HomeScreen } from '../components/HomeScreen';
import { useClasses } from '../store/Classes';
export default function Home() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const teacher = role === 'teacher';
  const store = useClasses();
  function submit(value: string, bannerUri?: string) {
    if (teacher) { const item = store.createClass(value, bannerUri); Alert.alert('수업이 만들어졌어요', `수업코드: ${item.code}`); }
    else store.joinClass(value);
  }
  return <HomeScreen role={teacher ? 'teacher' : 'student'} classes={teacher ? store.teacherClasses : store.studentClasses} onSubmitClass={submit} onRemoveClass={teacher ? store.deleteClass : store.leaveClass} />;
}
