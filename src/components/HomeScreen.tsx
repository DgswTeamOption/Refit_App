import { Image } from 'expo-image';
import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Role = 'student' | 'teacher';
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export function HomeScreen({ role }: { role: Role }) {
  const [month, setMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1); });
  const [modalVisible, setModalVisible] = useState(false);
  const [value, setValue] = useState('');
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const start = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => index - start + 1);
  const teacher = role === 'teacher';
  const action = teacher ? '수업 만들기' : '수업 참여하기';
  function changeMonth(delta: number) { setMonth(new Date(year, monthIndex + delta, 1)); }
  function showModal() { setValue(''); setModalVisible(true); }
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}>
      <Image source={require('../../assets/figma/logo.svg')} style={styles.logo} contentFit="contain" accessibilityLabel="Refit" />
      <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="알림" onPress={() => Alert.alert('준비 중', '알림 기능은 준비 중이에요.')}><Image source={require('../../assets/figma/bell.svg')} style={styles.bell} contentFit="contain" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="프로필" onPress={() => router.push('/profile')} style={styles.avatar}><Image source={require('../../assets/figma/avatar.svg')} style={StyleSheet.absoluteFill} contentFit="contain" /><Text style={styles.avatarText}>학</Text></Pressable></View>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.calendar}>
        <Image source={require('../../assets/figma/calendar.svg')} style={StyleSheet.absoluteFill} contentFit="fill" />
        <View style={styles.calendarHeader}><Text style={styles.month}>{year}년 {monthIndex + 1}월</Text><View style={styles.arrows}><Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => changeMonth(-1)}><Text style={styles.arrow}>‹</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => changeMonth(1)}><Text style={styles.arrow}>›</Text></Pressable></View></View>
        <View style={styles.week}>{weekdays.map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.days}>{cells.map((day, index) => <View style={styles.day} key={index}><Text style={[styles.dayText, (index % 7 === 0 || index % 7 === 6) && styles.weekend]}>{day > 0 && day <= days ? day : ''}</Text></View>)}</View>
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>내 수업</Text><Pressable accessibilityRole="button" onPress={showModal}><Text style={styles.add}>+ {action}</Text></Pressable></View>
      <View style={styles.empty}><Text style={styles.emptyText}>아직 참여한 수업이 없어요</Text><Pressable accessibilityRole="button" onPress={showModal} style={styles.emptyButton}><Image source={require('../../assets/figma/home-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>{action}</Text></Pressable></View>
    </ScrollView>
    <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}><View style={styles.overlay}><View style={styles.modal}>
      <Text style={styles.modalTitle}>{action}</Text>
      {teacher ? <><Text style={styles.label}>수업 제목 *</Text><TextInput accessibilityLabel="수업 제목" value={value} onChangeText={setValue} placeholder="수업 제목을 입력해주세요" placeholderTextColor="#aaa" style={styles.input} /><Text style={styles.label}>배너 사진</Text><Pressable style={styles.photo} onPress={() => Alert.alert('준비 중', '사진 선택 기능은 준비 중이에요.')}><Text style={styles.photoText}>사진 선택</Text></Pressable></> : <><Text style={styles.modalDescription}>수업코드를 입력해주세요.</Text><TextInput accessibilityLabel="수업 코드" autoCapitalize="characters" value={value} onChangeText={setValue} placeholder="수업코드를 입력해주세요" placeholderTextColor="#aaa" style={styles.input} /></>}
      <View style={styles.modalActions}><Pressable onPress={() => setModalVisible(false)} style={[styles.modalButton, styles.cancel]}><Text style={styles.cancelText}>취소</Text></Pressable><Pressable onPress={() => Alert.alert('준비 중', `${action} 기능은 준비 중이에요.`)} style={[styles.modalButton, styles.confirm]}><Text style={styles.buttonText}>{teacher ? '만들기' : '참여하기'}</Text></Pressable></View>
    </View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 70, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 15 }, logo: { width: 81.4689, height: 38.0832 }, actions: { flexDirection: 'row', alignItems: 'center', gap: 20 }, bell: { width: 15.6, height: 18.6 }, avatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 }, calendar: { height: 330, paddingHorizontal: 24, paddingTop: 16 }, calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, month: { color: '#151515', fontWeight: '700', fontSize: 18 }, arrows: { flexDirection: 'row', gap: 28, paddingRight: 10 }, arrow: { color: '#151515', fontSize: 28, lineHeight: 34 }, week: { flexDirection: 'row', marginTop: 22 }, weekday: { flex: 1, textAlign: 'center', fontSize: 12, color: '#888' }, days: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }, day: { width: `${100 / 7}%`, height: 30, alignItems: 'center', justifyContent: 'center' }, dayText: { color: '#555', fontSize: 13 }, weekend: { color: '#999' }, sectionHeader: { marginTop: 23, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 20, color: '#151515', fontWeight: '700' }, add: { color: '#0099ff', fontSize: 13, fontWeight: '700' }, empty: { alignItems: 'center', paddingTop: 80 }, emptyText: { fontSize: 15, color: '#777' }, emptyButton: { marginTop: 24, width: 236, height: 42, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 25 }, modal: { borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 28, paddingTop: 22, paddingBottom: 20 }, modalTitle: { fontWeight: '700', fontSize: 20, color: '#151515', marginBottom: 22 }, modalDescription: { color: '#666', fontSize: 14, marginBottom: 18 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginBottom: 10 }, input: { height: 46, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, fontSize: 14, color: '#151515', marginBottom: 18 }, photo: { height: 72, backgroundColor: '#f6f6f6', borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, photoText: { color: '#666', fontSize: 13 }, modalActions: { flexDirection: 'row', gap: 8, marginTop: 28 }, modalButton: { height: 42, flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, cancel: { backgroundColor: '#f3f3f3' }, confirm: { backgroundColor: '#0099ff' }, cancelText: { fontWeight: '700', fontSize: 14, color: '#737373' },
});
