import { useLocalSearchParams } from 'expo-router';
import { HomeScreen } from '../components/HomeScreen';
export default function Home() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  return <HomeScreen role={role === 'teacher' ? 'teacher' : 'student'} />;
}
