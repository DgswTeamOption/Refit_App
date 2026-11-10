import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../auth/Session';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { session, localUser, setSession, setLocalUser } = useSession();
  const name = session?.user.name ?? localUser?.name ?? '';

  return <View style={styles.anchor}>
    <Pressable accessibilityRole="button" accessibilityLabel="프로필 메뉴" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.avatar}>
      <ProfileAvatar />
    </Pressable>
    {open && <View style={styles.menu}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <View style={styles.divider} />
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => { setOpen(false); router.push('/profile'); }}><Text style={styles.actionText}>정보수정</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => { setOpen(false); setSession(null); setLocalUser(null); router.replace('/'); }}><Text style={styles.actionText}>로그아웃</Text></Pressable>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  anchor: { zIndex: 11 }, avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontSize: 13, fontWeight: '700' },
  menu: { position: 'absolute', top: 46, right: 15, width: 216, height: 150, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 12, paddingHorizontal: 16, paddingTop: 14 },
  name: { color: '#151515', fontSize: 15, fontWeight: '700' }, divider: { height: 1, backgroundColor: '#e8e8e8', marginTop: 14, marginBottom: 10 },
  action: { height: 38, justifyContent: 'center' }, actionText: { color: '#555', fontSize: 14 },
});
