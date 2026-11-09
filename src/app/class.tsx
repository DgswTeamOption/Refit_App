import { useLocalSearchParams } from 'expo-router';
import { ClassScreen } from '../components/ClassScreen';
export default function ClassPage() {
  const { role, name, classId } = useLocalSearchParams<{ role?: string; name?: string; classId?: string }>();
  return <ClassScreen role={role === 'teacher' ? 'teacher' : 'student'} name={name || '수업'} classId={classId && /^\d+$/.test(classId) && Number(classId) > 0 ? Number(classId) : undefined} />;
}
