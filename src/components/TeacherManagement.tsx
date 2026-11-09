import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseServerDate } from '../services/schedule';
import { DateTimeField } from './DateTimeField';

type Tab = '학생' | '결석정보' | '출석' | '보강' | '보강설정';
const headings: Record<Tab, string[]> = {
  학생: ['학생', '보강/결석', '최근 결석'],
  결석정보: ['학생', '날짜', '사유', '상태'],
  출석: ['학생', '출석 상태', '관리'],
  보강: ['학생', '날짜/시간', '상태'],
  보강설정: ['날짜', '시간', '관리'],
};
export function TeacherManagement({ tab, addingAvailability, onAvailabilityChange }: { tab: Tab; addingAvailability: boolean; onAvailabilityChange: (active: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [today] = useState(() => new Date());
  const date = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  function saveAvailability() {
    const start = parseServerDate(`${dateValue} ${startTime}:00`);
    const end = parseServerDate(`${dateValue} ${endTime}:00`);
    if (!start.isValid() || !end.isValid() || !end.isAfter(start)) return Alert.alert('날짜와 시간을 확인해주세요.');
    Alert.alert('준비 중', '보강 가능 시간 저장 기능은 준비 중이에요.');
  }
  if (tab === '보강설정' && addingAvailability) return <View style={styles.form}>
    <Text style={styles.label}>날짜</Text><DateTimeField mode="date" value={dateValue} onChange={setDateValue} />
    <Text style={styles.label}>시작 시간</Text><DateTimeField mode="time" value={startTime} onChange={setStartTime} />
    <Text style={styles.label}>종료 시간</Text><DateTimeField mode="time" value={endTime} onChange={setEndTime} />
    <Pressable style={styles.save} onPress={saveAvailability}><Image source={require('../../assets/figma/apply-button.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.buttonText}>저장</Text></Pressable>
    <Text style={styles.registered}>등록된 가능 시간</Text><Text style={styles.noAvailability}>등록된 가능 시간이 없어요.</Text>
  </View>;
  return <View style={styles.content}>
    {tab === '학생' && <View style={styles.search}><Image source={require('../../assets/figma/student-search.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="학생 이름 검색" value={query} onChangeText={setQuery} placeholder="학생 이름 검색" placeholderTextColor="#aaa" style={styles.searchText} /></View>}
    {tab === '출석' && <Text style={styles.date}>{date}</Text>}
    {tab === '보강설정' && <Pressable style={styles.topButton} onPress={() => onAvailabilityChange(true)}><Text style={styles.buttonText}>+ 가능 시간 추가</Text></Pressable>}
    <View style={styles.tableHeader}><Image source={require('../../assets/figma/schedule-header.svg')} style={StyleSheet.absoluteFill} contentFit="fill" />{headings[tab].map(heading => <Text key={heading} style={styles.tableHeading}>{heading}</Text>)}</View>
    <Text style={styles.empty}>{tab === '학생' ? '학생 정보가 없어요.' : tab === '출석' ? '출석 정보가 없어요.' : tab === '보강설정' ? '등록된 가능 시간이 없어요.' : '신청 내역이 없어요.'}</Text>
    {tab === '출석' && <Pressable style={styles.bottomButton} onPress={() => Alert.alert('준비 중', 'QR 출석 기능은 준비 중이에요.')}><Text style={styles.buttonText}>QR사용</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 16 }, form: { paddingHorizontal: 20, paddingTop: 20 }, label: { color: '#555', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 8 }, save: { height: 42, marginTop: 16, alignItems: 'center', justifyContent: 'center' }, registered: { color: '#151515', fontSize: 12, fontWeight: '700', marginTop: 20 }, noAvailability: { color: '#777', fontSize: 12, marginTop: 12 }, search: { height: 42, justifyContent: 'center', marginBottom: 18 }, searchText: { paddingHorizontal: 14, fontSize: 12, color: '#151515' }, date: { color: '#666', fontSize: 13, marginBottom: 16 }, tableHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, tableHeading: { flex: 1, color: '#777', fontWeight: '700', fontSize: 12 }, empty: { color: '#777', fontSize: 12, textAlign: 'center', paddingVertical: 20, borderColor: '#eee', borderWidth: 1 }, topButton: { height: 42, backgroundColor: '#0099ff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 14 }, bottomButton: { height: 42, backgroundColor: '#0099ff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 38 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 } });
