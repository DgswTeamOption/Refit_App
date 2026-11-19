import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../auth/Session';
import { ChatbotScreen, type ChatbotClass } from '../components/ChatbotScreen';
import { classroomApi } from '../services/classroom';

export default function ChatbotPage() {
  const { session } = useSession();
  const token = session?.accessToken;
  const teacher = session?.user.role === 'TEACHER';
  const [result, setResult] = useState<{ token: string; classes: ChatbotClass[] } | null>(null);
  useEffect(() => {
    if (!token || !teacher) return;
    let active = true;
    classroomApi.list(token)
      .then(items => { if (active) setResult({ token, classes: (items ?? []).map(item => ({ id: item.id, name: item.name })) }); })
      .catch(() => { if (active) setResult({ token, classes: [] }); });
    return () => { active = false; };
  }, [token, teacher]);
  if (!token || !teacher) return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#777' }}>선생님 계정으로 로그인해야 사용할 수 있어요.</Text></View></SafeAreaView>;
  if (result?.token !== token) return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#777' }}>불러오는 중이에요.</Text></View></SafeAreaView>;
  return <ChatbotScreen token={token} classes={result.classes} />;
}
