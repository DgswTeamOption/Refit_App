import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { queryChatbot, type ChatbotResponse } from '../services/chatbot';
import type { ClassSummary } from './ClassCards';

type Conversation = { id: number; question: string; classId?: number; className?: string; answer?: ChatbotResponse; error?: string };
type RequestScope = { classId?: number; className?: string };
const suggestions = [
  { title: '학생 개인 정보 한눈에 보기', question: '' },
  { title: '이번 달 결석·보강 현황', question: '이번달 현황' },
  { title: '보강 시간을 제안하지 않은 학생', question: '미제안 학생' },
  { title: '보강 시간 추천받기', question: '보강 시간 추천' },
];

export function RefitChatbot({ token, classes }: { token: string; classes: ClassSummary[] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [items, setItems] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState<number>();
  const [classChooser, setClassChooser] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const pending = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const shouldFollow = useRef(true);
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  const serverClasses = classes.filter(item => item.source === 'server');
  const selectedClass = serverClasses.find(item => item.id === classId);
  const submit = useCallback(async (text: string, retryScope?: RequestScope) => {
    const question = text.trim();
    if (!question || question.length > 200 || pending.current) return;
    const scope = retryScope ?? (question.includes('추천') && selectedClass ? { classId: selectedClass.id, className: selectedClass.name } : {});
    const controller = new AbortController();
    pending.current = controller;
    const id = nextId.current++;
    shouldFollow.current = true;
    setItems(previous => [...previous, { id, question, ...scope }]);
    setInput(''); setBusy(true);
    try {
      const answer = await queryChatbot(question, token, scope.classId, controller.signal);
      if (!controller.signal.aborted) setItems(previous => previous.map(item => item.id === id ? { ...item, answer } : item));
    } catch (error) {
      if (!controller.signal.aborted) setItems(previous => previous.map(item => item.id === id ? { ...item, error: error instanceof Error ? error.message : '응답을 불러오지 못했어요.' } : item));
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }, [token, selectedClass]);
  const goHome = () => {
    const controller = pending.current;
    pending.current = null;
    controller?.abort();
    setBusy(false); setItems([]); setInput(''); setClassChooser(false);
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Refit AI 열기" onPress={() => setOpen(true)} style={styles.launcher}><Image source={require('../../assets/figma/chatbot/launcher.svg')} style={styles.launcherImage} contentFit="contain" /></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <View style={styles.panel}>
            <View style={styles.header}><Image source={require('../../assets/figma/chatbot/assistant.svg')} style={styles.logo} contentFit="contain" /><View style={styles.headerText}><Text style={styles.heading}>Refit AI</Text><Text style={styles.subtitle}>선생님을 위한 출결·보강 도우미</Text></View><Pressable accessibilityRole="button" accessibilityLabel="챗봇 닫기" onPress={() => setOpen(false)}><Image source={require('../../assets/figma/chatbot/minimize.svg')} style={styles.minimize} contentFit="contain" /></Pressable></View>
            {items.length > 0 && <Pressable accessibilityRole="button" onPress={goHome} style={styles.back}><Image source={require('../../assets/figma/chatbot/back.svg')} style={styles.chevron} contentFit="contain" /><Text style={styles.backText}>홈으로</Text></Pressable>}
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; shouldFollow.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100; }} scrollEventThrottle={100} onContentSizeChange={() => { if (items.length && shouldFollow.current) scrollRef.current?.scrollToEnd({ animated: true }); }}>
              {items.length === 0 ? <>
                <Text style={styles.greeting}>안녕하세요, 선생님.</Text><Text style={styles.intro}>학생의 출결 확인부터 보강 일정까지,{ '\n' }필요한 정보를 바로 찾아드릴게요.</Text>
                <View style={styles.introCard}><Text style={styles.introTitle}>출결과 보강을 한곳에서</Text><Text style={styles.introCopy}>출석 · 결석 · 보강 현황을 확인하고{ '\n' }우리 수업에 맞는 보강 시간을 찾아보세요.</Text></View>
                <Text style={styles.prompt}>무엇을 도와드릴까요?</Text>
                {suggestions.map((item, index) => <Pressable key={item.title} accessibilityRole="button" style={styles.suggestion} onPress={() => item.question ? void submit(item.question) : inputRef.current?.focus()}><View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={styles.suggestionText}>{item.title}</Text><Image source={require('../../assets/figma/chatbot/chevron.svg')} style={styles.chevron} contentFit="contain" /></Pressable>)}
              </> : <>
                {items.map(item => <ConversationItem key={item.id} item={item} submit={submit} />)}
              </>}
            </ScrollView>
            <View style={styles.bottom}>
              <Pressable accessibilityRole="button" accessibilityLabel="추천 수업 선택" accessibilityState={{ expanded: classChooser }} onPress={() => setClassChooser(value => !value)} style={styles.classSelector}><Text style={styles.classSelectorText} numberOfLines={1}>추천 범위: {selectedClass?.name ?? '전체 수업'}  ▾</Text></Pressable>
              {classChooser && <ScrollView keyboardShouldPersistTaps="handled" style={styles.classMenu}><Pressable accessibilityRole="button" onPress={() => { setClassId(undefined); setClassChooser(false); }} style={styles.classOption}><Text>전체 수업</Text></Pressable>{serverClasses.map(item => <Pressable accessibilityRole="button" key={item.id} onPress={() => { setClassId(item.id); setClassChooser(false); }} style={styles.classOption}><Text>{item.name}</Text></Pressable>)}</ScrollView>}
              <View style={styles.composer}><TextInput ref={inputRef} value={input} onChangeText={setInput} maxLength={200} placeholder="학생 이름이나 궁금한 내용을 입력하세요" placeholderTextColor="#999" multiline accessibilityLabel="챗봇 질문" style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="질문 보내기" accessibilityState={{ disabled: busy || !input.trim() }} disabled={busy || !input.trim()} onPress={() => void submit(input)} style={styles.send}><Image source={require('../../assets/figma/chatbot/send.svg')} style={styles.sendIcon} contentFit="contain" /></Pressable></View><Text style={styles.footer}>Refit AI · 출결과 보강을 더 간편하게</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}

const ConversationItem = memo(function ConversationItem({ item, submit }: { item: Conversation; submit: (question: string, scope?: RequestScope) => Promise<void> }) {
  return <View><View style={styles.question}><Text style={styles.questionText}>{item.question}</Text>{!!item.className && <Text style={styles.questionScope}>추천 범위 · {item.className}</Text>}</View>{item.answer ? <Answer answer={item.answer} ask={submit} /> : item.error ? <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{item.error}</Text><Pressable accessibilityRole="button" onPress={() => void submit(item.question, { classId: item.classId, className: item.className })}><Text style={styles.retry}>다시 시도</Text></Pressable></View> : <View style={styles.loadingRow}><ActivityIndicator color="#009fff" /><Text style={styles.loadingText}>답변을 찾고 있어요</Text></View>}</View>;
});

function Answer({ answer, ask }: { answer: ChatbotResponse; ask: (question: string) => Promise<void> }) {
  return <View style={styles.answer}><Text style={styles.answerTitle}>{answer.message}</Text>
    {answer.type === 'STUDENT' && (answer.data.length ? answer.data.map((item, index) => <View key={`${item.classId}-${item.studentId}-${index}`} style={styles.studentCard}><View style={styles.studentHeading}><View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(-1)}</Text></View><View style={styles.studentDetails}><Text style={styles.name}>{item.name}</Text><Text style={styles.muted}>{item.className}</Text></View></View><View style={styles.stats}><Stat label="결석" value={`${item.absenceCount}회`} /><Stat label="보강" value={`${item.makeupCount}회`} /><Stat label="최근 결석" value={item.lastAbsenceDate ?? '없음'} /></View></View>) : <Text style={styles.muted}>조회된 학생이 없어요.</Text>)}
    {answer.type === 'MONTHLY_STATUS' && <View style={styles.summaryCard}><Text style={styles.summaryTitle}>{answer.data.year}년 {answer.data.month}월 결석·보강 현황</Text><View style={styles.stats}><Stat label="결석" value={`${answer.data.absenceCount}회`} /><Stat label="보강" value={`${answer.data.makeupCount}회`} /><Stat label="보강 대기" value={`${answer.data.pendingMakeupCount}회`} /></View><Pressable accessibilityRole="button" onPress={() => void ask('미제안 학생')}><Text style={styles.link}>미제안 학생 확인하기 ›</Text></Pressable></View>}
    {answer.type === 'UNPROPOSED_STUDENTS' && <>{answer.data.length ? answer.data.map((item, index) => <View key={`${item.classId}-${item.studentId}-${index}`} style={styles.studentCard}><View style={styles.studentHeading}><View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(-1)}</Text></View><View style={styles.studentDetails}><Text style={styles.name}>{item.name}</Text><Text style={styles.muted}>{item.className} · 결석 {item.absenceCount}회</Text><Text style={styles.muted}>최근 결석 {item.lastAbsenceDate ?? '정보 없음'}</Text></View><Text style={styles.red}>미제안</Text></View></View>) : <Text style={styles.muted}>미제안 학생이 없어요.</Text>}<Text style={styles.note}>승인된 결석은 있지만 같은 수업에 대기·승인된 보강 신청이 없는 학생이에요.</Text></>}
    {answer.type === 'RECOMMEND_TIME' && (answer.data.length ? answer.data.map(item => <View key={`${item.rank}-${item.makeupTime}`} style={styles.recommendation}><View style={styles.rank}><Text style={styles.rankText}>{item.rank}</Text></View><View style={styles.studentDetails}><Text style={styles.name}>{item.makeupTime.replace('T', ' ').slice(0, 16)} ({item.dayOfWeek})</Text><Text style={styles.muted}>신청 학생</Text></View><Text style={styles.count}>{item.applicantCount}명</Text></View>) : <Text style={styles.muted}>추천할 보강 시간이 없어요.</Text>)}
  </View>;
}
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }
const styles = StyleSheet.create({
  launcher: { position: 'absolute', right: 16, bottom: 20, zIndex: 20, borderRadius: 16, elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, launcherImage: { width: 56, height: 56 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)', alignItems: 'center', justifyContent: 'center' }, keyboard: { width: '100%', flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 16 }, panel: { width: '100%', maxWidth: 440, flex: 1, maxHeight: 742, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#e9e9e9', overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  header: { minHeight: 85, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 23, borderBottomWidth: 1, borderBottomColor: '#eee' }, logo: { width: 40, height: 40 }, headerText: { flex: 1, marginLeft: 12 }, heading: { color: '#151515', fontSize: 17, fontWeight: '700' }, subtitle: { color: '#888', fontSize: 11, marginTop: 4 }, minimize: { width: 38, height: 38 },
  content: { paddingHorizontal: 23, paddingTop: 18, paddingBottom: 16, flexGrow: 1 }, greeting: { fontSize: 21, fontWeight: '700', color: '#151515' }, intro: { color: '#777', fontSize: 14, lineHeight: 22, marginTop: 8 }, introCard: { backgroundColor: '#eff8ff', borderRadius: 16, padding: 16, marginTop: 14 }, introTitle: { color: '#008be0', fontSize: 15, fontWeight: '700' }, introCopy: { color: '#63788a', fontSize: 12, lineHeight: 20, marginTop: 7 }, prompt: { color: '#888', fontSize: 13, marginTop: 16, marginBottom: 8 }, suggestion: { minHeight: 46, borderWidth: 1, borderColor: '#e9e9e9', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginBottom: 8 }, number: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#f3f8fc', alignItems: 'center', justifyContent: 'center' }, numberText: { color: '#009fff', fontSize: 11, fontWeight: '600' }, suggestionText: { flex: 1, color: '#333', fontSize: 12, marginLeft: 12 }, chevron: { width: 6.6, height: 11.6 },
  back: { flexDirection: 'row', gap: 9, alignItems: 'center', marginHorizontal: 23, marginTop: 12, alignSelf: 'flex-start', minHeight: 32 }, backText: { color: '#888', fontSize: 12 }, question: { backgroundColor: '#eff8ff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignSelf: 'flex-end', maxWidth: '90%', marginBottom: 18 }, questionText: { color: '#008be0', fontSize: 13, fontWeight: '600' }, questionScope: { color: '#63788a', fontSize: 11, marginTop: 5 }, answer: { marginBottom: 22 }, answerTitle: { color: '#151515', fontSize: 16, fontWeight: '700', lineHeight: 24, marginBottom: 12 }, studentCard: { borderWidth: 1, borderColor: '#e9e9e9', borderRadius: 14, padding: 14, marginBottom: 10 }, studentHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#eff8ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontWeight: '700', color: '#009fff' }, studentDetails: { flex: 1 }, name: { fontSize: 14, fontWeight: '700', color: '#151515' }, muted: { fontSize: 11, color: '#888', marginTop: 5, lineHeight: 17 }, red: { color: '#f04444', fontSize: 11, fontWeight: '700' }, stats: { flexDirection: 'row', gap: 8, marginTop: 14 }, stat: { flex: 1, backgroundColor: '#f7f9fb', borderRadius: 12, padding: 10, minWidth: 0 }, statValue: { color: '#009fff', fontWeight: '700', fontSize: 19 }, summaryCard: { borderRadius: 14, backgroundColor: '#f7f9fb', padding: 16 }, summaryTitle: { fontWeight: '700', color: '#151515', fontSize: 13 }, link: { color: '#009fff', fontSize: 13, fontWeight: '700', marginTop: 16 }, note: { color: '#888', fontSize: 11, lineHeight: 17, marginTop: 6 }, recommendation: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#e9e9e9', borderRadius: 14, marginBottom: 8 }, rank: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#eff8ff', alignItems: 'center', justifyContent: 'center' }, rankText: { color: '#009fff', fontWeight: '700' }, count: { color: '#009fff', fontSize: 18, fontWeight: '700' }, errorBox: { borderRadius: 12, backgroundColor: '#fff3f3', padding: 14, marginBottom: 20 }, errorText: { color: '#b53c3c', fontSize: 13, lineHeight: 19 }, retry: { color: '#009fff', fontWeight: '700', marginTop: 8 }, loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 }, loadingText: { color: '#777', fontSize: 13 },
  bottom: { paddingHorizontal: 15, paddingBottom: 7 }, classSelector: { alignSelf: 'flex-start', marginBottom: 5, paddingHorizontal: 8, paddingVertical: 4 }, classSelectorText: { fontSize: 11, color: '#63788a' }, classMenu: { backgroundColor: '#fff', borderColor: '#e9e9e9', borderWidth: 1, borderRadius: 10, marginBottom: 6, maxHeight: 150 }, classOption: { paddingHorizontal: 12, paddingVertical: 8 }, composer: { minHeight: 78, borderRadius: 16, backgroundColor: '#f5f6f8', paddingLeft: 16, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end' }, input: { flex: 1, alignSelf: 'stretch', color: '#151515', fontSize: 14, paddingTop: 3, paddingRight: 4, textAlignVertical: 'top' }, send: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 8 }, sendIcon: { width: 32, height: 30 }, footer: { textAlign: 'center', color: '#999', fontSize: 10, marginTop: 5 },
});
