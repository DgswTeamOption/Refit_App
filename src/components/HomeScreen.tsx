import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { router } from 'expo-router';
import { Calendar, type CalendarMarks, type ClassCalendarColor } from './Calendar';
import { NotificationBell, type NotificationActions, type NotificationItem } from './NotificationBell';
import { ClassCards, type ClassSummary } from './ClassCards';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Role = 'student' | 'teacher';

export function HomeScreen({ role, classes = [], notifications, notificationActions }: { role: Role; classes?: ClassSummary[]; notifications?: NotificationItem[]; notificationActions?: NotificationActions }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [value, setValue] = useState('');
  const [banner, setBanner] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const teacher = role === 'teacher';
  const colors: ClassCalendarColor[] = ['peach', 'purple', 'yellow', 'mint'];
  const classLegend = classes.map((item, index) => ({ label: item.name, color: item.color ?? colors[index % colors.length] }));
  const calendarMarks: CalendarMarks = {};
  classes.forEach((item, index) => {
    const color = item.color ?? colors[index % colors.length];
    [...new Set(item.calendarDates ?? [])].forEach(date => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) (calendarMarks[date] ??= []).push({ color, label: item.name });
    });
  });
  const action = teacher ? '수업 만들기' : '수업 참여하기';
  function showModal() { setValue(''); setBanner(null); setModalVisible(true); }
  async function selectBanner() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 1], quality: 0.8 });
      if (!result.canceled) setBanner(result.assets[0]);
    } catch { Alert.alert('사진을 선택하지 못했어요.'); }
  }
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}>
      <Image source={require('../../assets/figma/logo.svg')} style={styles.logo} contentFit="contain" accessibilityLabel="Refit" />
      <View style={styles.actions}><NotificationBell items={notifications} actions={notificationActions} /><Pressable accessibilityRole="button" accessibilityLabel="프로필" onPress={() => router.push('/profile')} style={styles.avatar}><Image source={require('../../assets/figma/avatar.svg')} style={StyleSheet.absoluteFill} contentFit="contain" /><Text style={styles.avatarText}>학</Text></Pressable></View>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Calendar marks={calendarMarks} classLegend={classLegend} />
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>내 수업</Text><Pressable accessibilityRole="button" onPress={showModal}><Text style={styles.add}>+ {action}</Text></Pressable></View>
      {classes.length ? <ClassCards classes={classes} role={role} /> : <View style={styles.empty}><Text style={styles.emptyText}>아직 참여한 수업이 없어요</Text><Pressable accessibilityRole="button" onPress={showModal} style={styles.emptyButton}><Image source={require('../../assets/figma/home-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>{action}</Text></Pressable></View>}
    </ScrollView>
    <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}><View style={styles.overlay}><View style={styles.modal}>
      <Text style={styles.modalTitle}>{action}</Text>
      {teacher ? <><Text style={styles.label}>수업 제목 *</Text><TextInput accessibilityLabel="수업 제목" value={value} onChangeText={setValue} placeholder="수업 제목을 입력해주세요" placeholderTextColor="#aaa" style={styles.input} /><Text style={styles.label}>배너 사진</Text><Pressable accessibilityLabel="배너 사진 선택" style={styles.photo} onPress={selectBanner}>{banner ? <Image source={{ uri: banner.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.photoText}>사진 선택</Text>}</Pressable></> : <><Text style={styles.modalDescription}>수업코드를 입력해주세요.</Text><TextInput accessibilityLabel="수업 코드" autoCapitalize="characters" value={value} onChangeText={setValue} placeholder="수업코드를 입력해주세요" placeholderTextColor="#aaa" style={styles.input} /></>}
      <View style={styles.modalActions}><Pressable onPress={() => setModalVisible(false)} style={[styles.modalButton, styles.cancel]}><Text style={styles.cancelText}>취소</Text></Pressable><Pressable onPress={() => Alert.alert('준비 중', `${action} 기능은 준비 중이에요.`)} style={[styles.modalButton, styles.confirm]}><Text style={styles.buttonText}>{teacher ? '만들기' : '참여하기'}</Text></Pressable></View>
    </View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { zIndex: 10, height: 70, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 15 }, logo: { width: 81.4689, height: 38.0832 }, actions: { flexDirection: 'row', alignItems: 'center', gap: 20 }, avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 }, sectionHeader: { marginTop: 23, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 20, color: '#151515', fontWeight: '700' }, add: { color: '#0099ff', fontSize: 13, fontWeight: '700' }, empty: { alignItems: 'center', paddingTop: 80 }, emptyText: { fontSize: 15, color: '#777' }, emptyButton: { marginTop: 24, width: 236, height: 42, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 25 }, modal: { borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 28, paddingTop: 22, paddingBottom: 20 }, modalTitle: { fontWeight: '700', fontSize: 20, color: '#151515', marginBottom: 22 }, modalDescription: { color: '#666', fontSize: 14, marginBottom: 18 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginBottom: 10 }, input: { height: 46, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, fontSize: 14, color: '#151515', marginBottom: 18 }, photo: { height: 72, backgroundColor: '#f6f6f6', borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, photoText: { color: '#666', fontSize: 13 }, modalActions: { flexDirection: 'row', gap: 8, marginTop: 28 }, modalButton: { height: 42, flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, cancel: { backgroundColor: '#f3f3f3' }, confirm: { backgroundColor: '#0099ff' }, cancelText: { fontWeight: '700', fontSize: 14, color: '#737373' },
});
