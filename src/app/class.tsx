import { useLocalSearchParams } from 'expo-router';
import { ClassScreen } from '../components/ClassScreen';
export default function ClassPage() {
  const { role, name } = useLocalSearchParams<{ role?: string; name?: string }>();
  return <ClassScreen role={role === 'teacher' ? 'teacher' : 'student'} name={name || '수업'} />;
}
