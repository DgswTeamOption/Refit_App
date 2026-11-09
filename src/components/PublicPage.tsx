import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Page = 'about' | 'faq' | 'terms' | 'privacy';
const titles: Record<Page, string> = { about: '서비스 소개', faq: 'FAQ', terms: '이용약관', privacy: '개인정보 처리방침' };
const questions = ['수업 코드는 어디서 확인하나요?', '결석 신청을 취소할 수 있나요?', '보강 신청은 어떻게 하나요?', '계정 정보를 수정하려면?'];
const clauses = ['제1조 목적', '제2조 서비스 이용', '제3조 개인정보의 수집 및 이용', '제4조 정보 보관 및 보호', '제5조 이용자의 권리'];

export function PublicPage({ page }: { page: Page }) {
  const [search, setSearch] = useState('');
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}>
      <Pressable accessibilityRole="link" accessibilityLabel="로그인으로 이동" onPress={() => router.replace('/')}><Image source={require('../../assets/figma/logo.svg')} style={styles.logo} contentFit="contain" /></Pressable>
      <View style={styles.headerActions}><Pressable onPress={() => router.replace('/')} accessibilityRole="link"><Text style={styles.login}>로그인</Text></Pressable><Pressable onPress={() => router.replace('/signup')} style={styles.signup} accessibilityRole="link"><Text style={styles.signupText}>회원가입</Text></Pressable></View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.title}>{titles[page]}</Text>
      {page === 'about' ? <>
        <Text style={styles.tagline}>보강 관리, 더 간편하게</Text>
        <Text style={styles.description}>수업 일정과 결석, 보강을 한 곳에서 관리해요.</Text>
        <View style={styles.card}><Image source={require('../../assets/figma/service-card.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.cardTitle}>수업별 일정 관리</Text><Text style={styles.cardSubtitle}>출석과 보강 현황을 한눈에 확인</Text><Text style={styles.cardBody}>학생과 선생님이 함께 쓰는 보강 관리</Text></View>
      </> : page === 'faq' ? <>
        <View style={styles.search}><Image source={require('../../assets/figma/faq-search.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="질문 검색" placeholder="무엇을 도와드릴까요?" placeholderTextColor="#999" value={search} onChangeText={setSearch} style={styles.searchInput} /></View>
        <Text style={styles.faqHeading}>자주 묻는 질문</Text>
        {questions.filter(question => question.includes(search.trim())).map(question => <View key={question} style={styles.question}><Image source={require('../../assets/figma/faq-item.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><Text style={styles.questionText}>{question}</Text><Text style={styles.chevron}>⌄</Text></View>)}
      </> : <>
        <Text style={styles.date}>시행일 2026. 08. 01</Text>
        <Image source={require('../../assets/figma/policy-divider.svg')} style={styles.divider} contentFit="fill" />
        {clauses.map(clause => <View key={clause} style={styles.clause}><Text style={styles.clauseTitle}>{clause}</Text><Text style={styles.clauseDescription}>서비스 이용에 필요한 내용을 안내합니다.</Text><Image source={require('../../assets/figma/policy-row-divider.svg')} style={styles.clauseDivider} contentFit="fill" /></View>)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 70, borderBottomWidth: 1, borderColor: '#eee', paddingLeft: 24, paddingRight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logo: { width: 81.4689, height: 38.0832 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 }, login: { color: '#555', fontSize: 12, fontWeight: '600' }, signup: { height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#0099ff', justifyContent: 'center' }, signupText: { color: '#fff', fontSize: 12, fontWeight: '700' }, content: { paddingHorizontal: 22, paddingTop: 72, paddingBottom: 40 }, title: { fontSize: 23, fontWeight: '700', color: '#151515' }, tagline: { marginTop: 28, fontSize: 17, fontWeight: '700', color: '#0099ff' }, description: { marginTop: 16, color: '#666', fontSize: 13 }, card: { marginTop: 48, height: 170, paddingHorizontal: 20, paddingTop: 32, overflow: 'hidden', borderRadius: 12 }, cardTitle: { fontSize: 15, fontWeight: '700', color: '#151515' }, cardSubtitle: { marginTop: 15, fontSize: 12, color: '#777' }, cardBody: { marginTop: 24, fontSize: 13, color: '#555' }, search: { height: 46, marginTop: 17, justifyContent: 'center' }, searchInput: { paddingHorizontal: 16, color: '#151515', fontSize: 13 }, faqHeading: { marginTop: 22, marginBottom: 22, color: '#151515', fontWeight: '700', fontSize: 15 }, question: { height: 61, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }, questionText: { color: '#444', fontSize: 13 }, chevron: { color: '#888', fontSize: 16 }, date: { marginTop: 30, marginBottom: 18, fontSize: 12, color: '#999' }, divider: { width: '100%', height: 1 }, clause: { height: 88, paddingTop: 25 }, clauseTitle: { color: '#151515', fontSize: 14, fontWeight: '700' }, clauseDescription: { color: '#777', fontSize: 12, marginTop: 12 }, clauseDivider: { position: 'absolute', bottom: 0, width: '100%', height: 1 },
});
