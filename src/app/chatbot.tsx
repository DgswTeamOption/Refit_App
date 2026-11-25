import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../auth/Session';
import { RefitChatbot } from '../components/RefitChatbot';
import type { ClassSummary } from '../components/ClassCards';
import { classroomApi } from '../services/classroom';

export default function ChatbotPage() {
  const { session } = useSession();
  const token = session?.accessToken;
  const userId = session?.user.id;
  const teacher = session?.user.role === 'TEACHER';
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ userId: number; classes?: ClassSummary[]; error?: string } | null>(null);
  useEffect(() => {
    if (!token || !teacher || !userId) return;
    let active = true;
    classroomApi.list(token).then(items => {
      if (!Array.isArray(items)) throw new Error('수업 목록을 확인할 수 없어요.');
      if (active) setResult({ userId, classes: items.map(item => ({ id: item.id, name: item.name, source: 'server' })) });
    }).catch(error => { if (active) setResult(previous => previous?.userId === userId && previous.classes ? previous : { userId, error: error instanceof Error ? error.message : '수업 목록을 불러오지 못했어요.' }); });
    return () => { active = false; };
  }, [token, teacher, userId, revision]);
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/home'); };
  if (!token || !teacher) return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#777' }}>선생님 계정으로 로그인해야 사용할 수 있어요.</Text><Pressable accessibilityRole="button" onPress={close}><Text style={{ color: '#0099ff', marginTop: 16 }}>돌아가기</Text></Pressable></View></SafeAreaView>;
  const current = result?.userId === userId ? result : null;
  return <RefitChatbot key={session.user.id} token={token} classes={current?.classes ?? []} initialOpen onClose={close} classListStatus={current?.error ?? (!current ? '수업 목록을 불러오는 중이에요.' : undefined)} onRetryClasses={current?.error ? () => { setResult(null); setRevision(value => value + 1); } : undefined} />;
}
