import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../auth/Session';
import { ClassesProvider } from '../store/Classes';

export default function RootLayout() {
  return <SessionProvider><ClassesProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></ClassesProvider></SessionProvider>;
}
