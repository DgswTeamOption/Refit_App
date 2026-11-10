import { Redirect } from 'expo-router';
import { AuthScreen } from '../components/AuthScreen';
import { useSession } from '../auth/Session';
export default function Login() {
  const { session } = useSession();
  if (session) return <Redirect href={{ pathname: '/home', params: { role: session.user.role === 'TEACHER' ? 'teacher' : 'student' } }} />;
  return <AuthScreen mode="login" />;
}
