import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHATBOT_MAX_LENGTH, chatbotApi, type ChatbotReply } from '../services/chatbot';

export type ChatbotClass = { id: number; name: string };
type Message = { id: number; from: 'user' | 'bot'; text: string; reply?: ChatbotReply };

const intro = '안녕하세요, Refit AI예요. 출결과 보강에 대해 물어보세요.';

function formatDate(value?: string | null) { return value ? value.slice(0, 10) : '없음'; }
function formatTime(value: string) { const [date, time = ''] = value.split('T'); return `${date} ${time.slice(0, 5)}`.trim(); }

function ReplyView({ reply }: { reply: ChatbotReply }) {
  if (reply.type === 'GUIDE') return null;
  if (reply.type === 'MONTHLY_STATUS') {
    const { year, month, absenceCount, makeupCount, pendingMakeupCount } = reply.data;
    return <View style={styles.card}><Text style={styles.cardTitle}>{year}년 {month}월 현황</Text>
      <Text style={styles.row}>결석 {absenceCount}건</Text><Text style={styles.row}>보강 {makeupCount}건</Text><Text style={styles.row}>승인 대기 {pendingMakeupCount}건</Text></View>;
  }
  if (!reply.data.length) return null;
  if (reply.type === 'RECOMMEND_TIME') return <View style={styles.cardList}>{reply.data.map(item => <View key={item.rank} style={styles.card}>
    <Text style={styles.cardTitle}>{item.rank}순위 · {item.dayOfWeek}</Text><Text style={styles.row}>{formatTime(item.makeupTime)}</Text><Text style={styles.sub}>신청 {item.applicantCount}명</Text></View>)}</View>;
  if (reply.type === 'UNPROPOSED_STUDENTS') return <View style={styles.cardList}>{reply.data.map(item => <View key={`${item.studentId}-${item.classId}`} style={styles.card}>
    <Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.sub}>{item.className}</Text><Text style={styles.row}>결석 {item.absenceCount}회 · 마지막 {formatDate(item.lastAbsenceDate)}</Text></View>)}</View>;
  return <View style={styles.cardList}>{reply.data.map(item => <View key={`${item.studentId}-${item.classId}`} style={styles.card}>
    <Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.sub}>{item.className}</Text>
    <Text style={styles.row}>결석 {item.absenceCount}회 · 보강 {item.makeupCount}회</Text><Text style={styles.sub}>마지막 결석 {formatDate(item.lastAbsenceDate)}</Text></View>)}</View>;
}

function QuickButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.quickButton}><Text style={styles.quickText}>{label}</Text></Pressable>;
}

export function ChatbotScreen({ token, classes }: { token: string; classes: ChatbotClass[] }) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: 'bot', text: intro }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [classId, setClassId] = useState<number | undefined>(classes.length === 1 ? classes[0].id : undefined);
  const nextId = useRef(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const sending = useRef(false);

  function push(message: Omit<Message, 'id'>) {
    setMessages(previous => [...previous, { ...message, id: nextId.current++ }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }
  async function run(label: string, load: () => Promise<ChatbotReply>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setPicking(false);
    push({ from: 'user', text: label });
    try { const reply = await load(); push({ from: 'bot', text: reply.message, reply }); }
    catch (error) { push({ from: 'bot', text: error instanceof Error ? error.message : '답변을 가져오지 못했어요.' }); }
    finally { sending.current = false; setBusy(false); }
  }
  function monthly() { void run('이번달 현황', async () => { const data = await chatbotApi.monthlyStatus(token); return { type: 'MONTHLY_STATUS', message: '이번 달 현황이에요.', data }; }); }
  function unproposed() { void run('미제안 학생', async () => { const data = await chatbotApi.unproposedStudents(token); return { type: 'UNPROPOSED_STUDENTS', message: data.length ? '보강을 아직 제안하지 않은 학생이에요.' : '보강 미제안 학생이 없어요.', data }; }); }
  function recommend(id: number) {
    setClassId(id);
    const name = classes.find(item => item.id === id)?.name ?? '';
    void run(`시간 추천 · ${name}`, async () => { const data = await chatbotApi.recommendTime(id, token); return { type: 'RECOMMEND_TIME', message: '신청자가 많은 보강 시간이에요.', data }; });
  }
  function askRecommend() {
    if (!classes.length) return push({ from: 'bot', text: '추천할 수업이 없어요.' });
    if (classId) return recommend(classId);
    setPicking(true);
  }
  function askStudent() { push({ from: 'bot', text: '학생 이름을 입력해주세요.' }); }
  function send() {
    const message = text.trim();
    if (!message || busy) return;
    if (message.includes('추천') && !classId && classes.length) { setText(''); push({ from: 'user', text: message }); setPicking(true); return; }
    setText('');
    void run(message, () => chatbotApi.query(message, token, message.includes('추천') ? classId : undefined));
  }

  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.title}>Refit AI</Text><View style={styles.back} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {messages.map(message => <View key={message.id} style={[styles.bubbleRow, message.from === 'user' && styles.userRow]}>
          <View style={[styles.bubble, message.from === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={message.from === 'user' ? styles.userText : styles.botText}>{message.text}</Text>
            {message.reply && <ReplyView reply={message.reply} />}
          </View></View>)}
        {busy && <Text style={styles.sub}>답변을 찾는 중이에요…</Text>}
        {picking && <View style={styles.picker}><Text style={styles.botText}>어느 수업의 시간을 추천할까요?</Text>
          <View style={styles.chips}>{classes.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => recommend(item.id)} style={styles.chip}><Text style={styles.chipText}>{item.name}</Text></Pressable>)}</View></View>}
      </ScrollView>
      <View style={styles.quick}>
        <QuickButton label="이번달 현황" disabled={busy} onPress={monthly} />
        <QuickButton label="미제안 학생" disabled={busy} onPress={unproposed} />
        <QuickButton label="시간 추천" disabled={busy} onPress={askRecommend} />
        <QuickButton label="학생 검색" disabled={busy} onPress={askStudent} />
      </View>
      <View style={styles.inputBar}>
        <TextInput accessibilityLabel="챗봇 질문" value={text} onChangeText={setText} maxLength={CHATBOT_MAX_LENGTH} placeholder="궁금한 내용을 입력해주세요" placeholderTextColor="#aaa" style={styles.input} onSubmitEditing={send} returnKeyType="send" />
        <Pressable accessibilityRole="button" accessibilityLabel="보내기" disabled={busy || !text.trim()} onPress={send} style={[styles.send, (busy || !text.trim()) && styles.sendDisabled]}><Text style={styles.sendText}>보내기</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, flex: { flex: 1 },
  header: { height: 56, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 28, color: '#151515' }, title: { fontSize: 17, fontWeight: '700', color: '#151515' },
  content: { padding: 16, gap: 10 }, bubbleRow: { flexDirection: 'row' }, userRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8 }, botBubble: { backgroundColor: '#f3f3f3' }, userBubble: { backgroundColor: '#0099ff' },
  botText: { color: '#151515', fontSize: 14 }, userText: { color: '#fff', fontSize: 14 },
  cardList: { gap: 8 }, card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e8e8e8', padding: 12, gap: 3 },
  cardTitle: { color: '#151515', fontSize: 14, fontWeight: '700' }, row: { color: '#333', fontSize: 13 }, sub: { color: '#777', fontSize: 12 },
  picker: { gap: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderRadius: 16, borderWidth: 1, borderColor: '#0099ff', paddingHorizontal: 12, paddingVertical: 7 }, chipText: { color: '#0099ff', fontSize: 13, fontWeight: '700' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }, quickButton: { borderRadius: 16, backgroundColor: '#eaf6ff', paddingHorizontal: 12, paddingVertical: 8 }, quickText: { color: '#0077cc', fontSize: 13, fontWeight: '700' },
  inputBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  input: { flex: 1, height: 44, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#151515' },
  send: { height: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#0099ff', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#b8dffb' }, sendText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
