import { Image } from 'expo-image';
import { NotificationBell, type NotificationActions, type NotificationItem } from './NotificationBell';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, type Session } from '../auth/Session';
import { emailApi } from '../services/email';
import { baseUrl } from '../services/http';
import { userApi, type UserProfile } from '../services/user';
import { useClasses } from '../store/Classes';
import { ProfileAvatar } from './ProfileAvatar';

type Page = 'view' | 'edit' | 'delete';
type ProfileProps = { page: Page; notifications?: NotificationItem[]; notificationActions?: NotificationActions };
export function ProfileScreen(props: ProfileProps) {
  const { session } = useSession();
  const { notifications, markAllRead } = useClasses();
  return <ProfileBody key={session ? `user-${session.user.id}` : 'guest'} {...props} notifications={props.notifications ?? notifications} notificationActions={props.notificationActions ?? { markAllRead: async () => markAllRead() }} />;
}
function ProfileBody({ page, notifications, notificationActions }: ProfileProps) {
  const { session, setSession, localUser, setLocalUser } = useSession();
  const local = !session ? localUser : null;
  const [result, setResult] = useState<{ session: Session; profile?: UserProfile; error?: string } | null>(null);
  const current = result?.session === session ? result : null;
  const profile = current?.profile ?? null;
  const error = current?.error ?? '';
  const [name, setName] = useState(() => local?.name ?? '');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    let active = true;
    userApi.get(session.user.id, session.accessToken).then(user => {
      if (!active) return;
      if (!user) throw new Error('프로필 정보를 확인할 수 없어요.');
      setResult({ session, profile: user }); setName(user.name);
      setSession(current => current?.accessToken === session.accessToken && current.user.profileImageUrl !== user.profileImageUrl ? { ...current, user: { ...current.user, profileImageUrl: user.profileImageUrl } } : current);
    }).catch(e => { if (active) setResult({ session, error: e instanceof Error ? e.message : '프로필을 불러오지 못했어요.' }); });
    return () => { active = false; };
  }, [session, setSession]);
  async function save() {
    const nextName = name.trim();
    if (!nextName || nextName.length > 50) return Alert.alert('이름은 1~50자로 입력해주세요.');
    if (local) { setLocalUser({ ...local, name: nextName }); return router.replace('/profile'); }
    if (!session || !profile) return Alert.alert('프로필 정보를 먼저 불러와야 해요.');
    setBusy(true);
    try {
      await userApi.updateName(nextName, session.accessToken);
      setSession(current => current?.accessToken === session.accessToken ? { ...current, user: { ...current.user, name: nextName } } : current);
      router.replace('/profile');
    }
    catch (e) { Alert.alert('정보 수정 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  async function changePhoto() {
    if (!session) return Alert.alert('로그인이 필요해요.');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) return Alert.alert('10MB 이하의 사진을 선택해주세요.');
      setBusy(true);
      const uploaded = await userApi.upload(asset, session.accessToken);
      await userApi.updateImage(uploaded.imageUrl, session.accessToken);
      setSession(current => current?.accessToken === session.accessToken ? { ...current, user: { ...current.user, profileImageUrl: uploaded.imageUrl } } : current);
      const updated = await userApi.get(session.user.id, session.accessToken);
      if (updated) setResult({ session, profile: updated });
    } catch (e) { Alert.alert('사진 변경 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  async function beginRemoval() {
    if (local) { router.push('/profile-delete'); return; }
    if (!session) return Alert.alert('로그인이 필요해요.');
    if (!profile) return Alert.alert('프로필 정보를 먼저 불러와야 해요.');
    setBusy(true);
    try {
      const result = await emailApi.sendCode(profile.emailId);
      if (!result.data?.is_verification) throw new Error('인증코드를 보내지 못했어요.');
      router.push('/profile-delete');
      Alert.alert('인증코드 발송', '가입한 이메일로 인증코드를 보냈어요.');
    } catch (e) { Alert.alert('인증코드 발송 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  async function removeAccount() {
    if (local) {
      if (confirmation !== '계정 삭제') return Alert.alert('확인 문구를 입력해주세요.');
      setLocalUser(null); router.replace('/'); return;
    }
    if (!session || !profile) return Alert.alert('로그인이 필요해요.');
    if (!/^\d{6}$/.test(code) || confirmation !== '계정 삭제') return Alert.alert('인증코드와 확인 문구를 입력해주세요.');
    setBusy(true);
    try {
      const verified = await emailApi.verifyCode(profile.emailId, code);
      if (!verified.data?.is_verification) throw new Error('인증코드를 확인해주세요.');
      await userApi.remove(session.user.id, session.accessToken);
      setSession(null); router.replace('/');
    } catch (e) { Alert.alert('탈퇴 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  const photo = profile?.profileImageUrl;
  const imageUri = photo && (photo.startsWith('/') ? `${baseUrl}${photo}` : photo);
  const heading = page === 'view' ? '내 정보' : page === 'edit' ? '정보 수정' : '계정 탈퇴';
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}><Pressable onPress={() => router.replace({ pathname: '/home', params: { role: (session?.user.role ?? localUser?.role) === 'TEACHER' ? 'teacher' : 'student' } })}><Image source={require('../../assets/figma/logo.svg')} style={styles.logo} contentFit="contain" accessibilityLabel="홈" /></Pressable><View style={styles.headerRight}><NotificationBell items={notifications} actions={notificationActions} /><ProfileAvatar /></View></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{heading}</Text><Image source={require('../../assets/figma/policy-divider.svg')} style={styles.divider} contentFit="fill" />
      {!session && !local && <Text style={styles.notice}>로그인 후 내 정보를 확인할 수 있어요.</Text>}
      {!!error && <Text style={styles.notice}>{error}</Text>}
      {page === 'view' ? <>
        <Pressable accessibilityRole="button" disabled={busy} onPress={changePhoto} style={styles.photoArea}><View style={styles.photoLarge}><Image source={imageUri ? { uri: imageUri } : require('../../assets/figma/profile-photo.svg')} style={StyleSheet.absoluteFill} contentFit="cover" />{!imageUri && <Text style={styles.photoPlaceholder}>사진</Text>}</View><Text style={styles.photoLink}>프로필 사진 변경</Text></Pressable>
        <View style={styles.info}><Text style={styles.infoLabel}>이름</Text><Text style={styles.infoValue}>{profile?.name ?? local?.name ?? '—'}</Text><Image source={require('../../assets/figma/policy-divider.svg')} style={styles.infoDivider} contentFit="fill" /></View>
        <View style={styles.info}><Text style={styles.infoLabel}>이메일</Text><Text style={[styles.infoValue, styles.email]}>{profile?.emailId ?? local?.email ?? '—'}</Text><Image source={require('../../assets/figma/policy-divider.svg')} style={styles.infoDivider} contentFit="fill" /></View>
        <Pressable style={styles.neutralButton} onPress={() => router.push('/profile-edit')}><Text style={styles.neutralText}>정보 수정</Text></Pressable><Pressable disabled={busy} onPress={beginRemoval}><Text style={styles.deleteLink}>계정 삭제</Text></Pressable>
      </> : page === 'edit' ? <>
        <Text style={styles.label}>프로필 사진</Text><Pressable onPress={changePhoto} disabled={busy} style={styles.editPhoto}><Image source={imageUri ? { uri: imageUri } : require('../../assets/figma/edit-photo.svg')} style={StyleSheet.absoluteFill} contentFit="cover" />{!imageUri && <Text style={styles.editPhotoText}>사진 변경</Text>}</Pressable>
        <Text style={styles.label}>이름</Text><TextInput accessibilityLabel="이름" value={profile || local ? name : ''} onChangeText={setName} maxLength={50} placeholder="이름" placeholderTextColor="#999" style={styles.input} />
        <Text style={styles.label}>이메일</Text><TextInput accessibilityLabel="이메일" value={profile?.emailId ?? local?.email ?? ''} editable={false} placeholder="이메일" placeholderTextColor="#999" style={styles.input} />
        <Pressable disabled={busy} onPress={save} style={styles.primaryButton}><Text style={styles.buttonText}>저장</Text></Pressable><Pressable onPress={() => router.back()}><Text style={styles.cancel}>취소</Text></Pressable>
      </> : <>
        <Text style={styles.deleteTitle}>정말 탈퇴하시겠어요?</Text><Text style={styles.deleteDescription}>탈퇴하면 계정과 프로필 정보가 삭제됩니다.</Text>
        <Text style={styles.label}>이메일 인증코드</Text><TextInput accessibilityLabel="이메일 인증코드" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="인증코드 입력" placeholderTextColor="#999" style={styles.input} />
        <Text style={styles.label}>확인을 위해 “계정 삭제”를 입력해주세요</Text><TextInput accessibilityLabel="계정 삭제 확인" value={confirmation} onChangeText={setConfirmation} placeholder="계정 삭제" placeholderTextColor="#999" style={styles.input} />
        <Pressable disabled={busy} onPress={removeAccount} style={[styles.primaryButton, styles.deleteButton]}><Text style={styles.buttonText}>탈퇴하기</Text></Pressable><Pressable onPress={() => router.back()}><Text style={styles.cancel}>취소</Text></Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { zIndex: 10, height: 70, borderBottomWidth: 1, borderColor: '#eee', paddingLeft: 24, paddingRight: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logo: { width: 81.4689, height: 38.0832 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 20 }, bell: { width: 15.6, height: 18.6 }, avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' }, content: { paddingHorizontal: 22, paddingBottom: 35 }, heading: { fontSize: 21, color: '#151515', fontWeight: '700', marginTop: 13, marginBottom: 18 }, divider: { width: '100%', height: 1 }, notice: { color: '#777', fontSize: 12, marginTop: 12 }, photoArea: { alignItems: 'center', marginTop: 36, marginBottom: 40 }, photoLarge: { width: 84, height: 84, borderRadius: 42, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, photoPlaceholder: { color: '#888', fontSize: 12 }, photoLink: { color: '#0099ff', fontSize: 13, marginTop: 16 }, info: { minHeight: 90 }, infoLabel: { color: '#888', fontSize: 12, marginBottom: 10 }, infoValue: { color: '#151515', fontSize: 15, fontWeight: '700' }, email: { fontWeight: '400' }, infoDivider: { position: 'absolute', width: '100%', height: 1, bottom: 20 }, neutralButton: { height: 42, borderRadius: 10, backgroundColor: '#f3f3f3', justifyContent: 'center', alignItems: 'center', marginTop: 20 }, neutralText: { color: '#737373', fontSize: 14, fontWeight: '700' }, logout: { color: '#777', fontWeight: '700', fontSize: 14, marginTop: 24 }, deleteLink: { color: '#f04444', fontWeight: '700', fontSize: 14, marginTop: 24 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginTop: 22, marginBottom: 8 }, editPhoto: { width: 76, height: 76, borderRadius: 38, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 16, overflow: 'hidden' }, editPhotoText: { fontSize: 11, color: '#0099ff' }, input: { height: 46, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, color: '#151515', fontSize: 14 }, primaryButton: { height: 42, borderRadius: 10, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center', marginTop: 30 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 }, cancel: { color: '#777', textAlign: 'center', fontSize: 13, marginTop: 8 }, deleteTitle: { color: '#151515', fontSize: 20, fontWeight: '700', marginTop: 16 }, deleteDescription: { color: '#777', fontSize: 13, marginTop: 22, marginBottom: 10 }, deleteButton: { backgroundColor: '#f04444' },
});
