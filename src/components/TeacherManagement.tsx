import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Tab = '학생' | '결석정보' | '출석' | '보강' | '보강설정';
const headings: Record<Tab, string[]> = {
  학생: ['학생', '보강/결석', '최근 결석'],
  결석정보: ['학생', '날짜', '사유', '상태'],
  출석: ['학생', '출석 상태', '관리'],
  보강: ['학생', '날짜/시간', '상태'],
  보강설정: ['날짜', '시간', '관리'],
};
export function TeacherManagement({ tab }: { tab: Tab }) {
  const [query, setQuery] = useState('');
  const [today] = useState(() => new Date());
  const date = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  return <View style={styles.content}>
    {tab === '학생' && <View style={styles.search}><Image source={require('../../assets/figma/student-search.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="학생 이름 검색" value={query} onChangeText={setQuery} placeholder="학생 이름 검색" placeholderTextColor="#aaa" style={styles.searchText} /></View>}
    {tab === '출석' && <Text style={styles.date}>{date}</Text>}
    {tab === '보강설정' && <Pressable style={styles.topButton} onPress={() => Alert.alert('준비 중', '가능 시간 설정 기능은 준비 중이에요.')}><Text style={styles.buttonText}>+ 가능 시간 추가</Text></Pressable>}
    <View style={styles.tableHeader}><Image source={require('../../assets/figma/schedule-header.svg')} style={StyleSheet.absoluteFill} contentFit="fill" />{headings[tab].map(heading => <Text key={heading} style={styles.tableHeading}>{heading}</Text>)}</View>
    <Text style={styles.empty}>{tab === '학생' ? '학생 정보가 없어요.' : tab === '출석' ? '출석 정보가 없어요.' : tab === '보강설정' ? '등록된 가능 시간이 없어요.' : '신청 내역이 없어요.'}</Text>
    {tab === '출석' && <Pressable style={styles.bottomButton} onPress={() => Alert.alert('준비 중', 'QR 출석 기능은 준비 중이에요.')}><Text style={styles.buttonText}>QR사용</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 16 }, search: { height: 42, justifyContent: 'center', marginBottom: 18 }, searchText: { paddingHorizontal: 14, fontSize: 12, color: '#151515' }, date: { color: '#666', fontSize: 13, marginBottom: 16 }, tableHeader: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, tableHeading: { flex: 1, color: '#777', fontWeight: '700', fontSize: 12 }, empty: { color: '#777', fontSize: 12, textAlign: 'center', paddingVertical: 20, borderColor: '#eee', borderWidth: 1 }, topButton: { height: 42, backgroundColor: '#0099ff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 14 }, bottomButton: { height: 42, backgroundColor: '#0099ff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 38 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 } });
