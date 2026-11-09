import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ClassScreen } from '../components/ClassScreen';
import type { NoticeActions } from '../components/NoticeScreen';
import { useSession } from '../auth/Session';
import { useClasses } from '../store/Classes';
export default function ClassPage() {
  const { role, name, classId } = useLocalSearchParams<{ role?: string; name?: string; classId?: string }>();
  const { session } = useSession();
  const store = useClasses();
  const id = classId && /^\d+$/.test(classId) && Number(classId) > 0 ? Number(classId) : undefined;
  const author = session?.user.name ?? (role === 'teacher' ? '선생님' : '학생');
  const { addNotice, updateNotice, removeNotice } = store;
  const noticeActions = useMemo<NoticeActions | undefined>(() => id === undefined ? undefined : {
    create: async input => addNotice(id, input, author),
    update: async (nid, input) => updateNotice(id, nid, input),
    remove: async nid => removeNotice(id, nid),
  }, [id, author, addNotice, updateNotice, removeNotice]);
  return <ClassScreen role={role === 'teacher' ? 'teacher' : 'student'} name={name || '수업'} classId={id} notices={id === undefined ? [] : store.noticesOf(id)} noticeActions={noticeActions} />;
}
