import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { emailApi } from '../services/email';
import { useSession, type Session } from '../auth/Session';
import { getGoogleIdToken } from '../auth/google';
import { authApi, emailSession, EmailLoginCompletionError, googleSession, GoogleUserNotRegistered } from '../services/auth';
import { ApiError } from '../services/http';

type Mode = 'login' | 'signup' | 'role';
const blue = '#0099ff';

function Button({ label, variant = 'primary', onPress, disabled = false }: { label: string; variant?: 'primary' | 'secondary' | 'outline' | 'neutral'; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, styles[variant]]}><Text style={[styles.buttonText, variant === 'secondary' && styles.blueText, variant === 'outline' && styles.darkText, variant === 'neutral' && styles.neutralText]}>{label}</Text></Pressable>;
}

function errorText(error: unknown) {
  if (!(error instanceof Error)) return '다시 시도해주세요.';
  if (error instanceof ApiError) return `${error.message}\n(HTTP ${error.status})`;
  const code = (error as { code?: unknown }).code;
  return code === undefined ? `${error.message}\n(${error.name})` : `${error.message}\n(${error.name}: ${String(code)})`;
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const { signupDraft, setSignupDraft, setLocalUser, setSession, pendingGoogleToken, setPendingGoogleToken } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>(signupDraft?.role === 'TEACHER' ? 'teacher' : 'student');
  const [focused, setFocused] = useState(false);
  const [googleRegistered, setGoogleRegistered] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleInFlight = useRef(false);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  const sent = !!sentEmail && sentEmail === email.trim();
  const title = mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '역할 선택';
  const subtitle = mode === 'login' ? '이메일로 받은 인증코드로 바로 로그인하세요.' : mode === 'signup' ? '비밀번호 없이 이메일 인증만으로 가입해요.' : '어떤 역할로 시작할까요?';
  async function sendCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Alert.alert('이메일을 확인해주세요.');
    setBusy(true);
    try {
      const result = await emailApi.sendCode(email.trim());
      if (!result.data?.is_verification) throw new Error('인증코드를 보내지 못했어요.');
      setSentEmail(email.trim()); setCode(''); setNow(Date.now()); setExpiresAt(Date.now() + 300000);
    } catch (error) { Alert.alert('인증코드 발송 실패', error instanceof Error ? error.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  function finishLogin(next: Session) {
    setLocalUser(null); setSignupDraft(null); setPendingGoogleToken(null); setSession(next);
    router.replace({ pathname: '/home', params: { role: next.user.role === 'TEACHER' ? 'teacher' : 'student' } });
  }
  async function continueWithGoogle() {
    if (googleInFlight.current) return;
    googleInFlight.current = true;
    setGoogleBusy(true);
    setPendingGoogleToken(null);
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      try { finishLogin(await googleSession(idToken)); }
      catch (error) {
        if (!(error instanceof GoogleUserNotRegistered)) throw error;
        setSignupDraft(null); setPendingGoogleToken(idToken); router.push('/role');
      }
    } catch (error) { Alert.alert('Google 로그인 실패', errorText(error)); }
    finally { googleInFlight.current = false; setGoogleBusy(false); setBusy(false); }
  }
  async function submit() {
    if (mode === 'role') {
      if (pendingGoogleToken) {
        if (googleInFlight.current) return;
        googleInFlight.current = true;
        setGoogleBusy(true);
        setBusy(true);
        try {
          if (!googleRegistered) {
            try { await authApi.registerGoogle(pendingGoogleToken, role === 'teacher' ? 'TEACHER' : 'STUDENT'); }
            catch (error) {
              if (error instanceof ApiError && error.status === 409) {
                setPendingGoogleToken(null);
                router.replace('/');
                Alert.alert('이미 가입된 계정이에요.', 'Google 로그인으로 계속해주세요.');
                return;
              }
              throw error;
            }
            setGoogleRegistered(true);
          }
          finishLogin(await googleSession(pendingGoogleToken));
        } catch (error) { Alert.alert('Google 회원가입 실패', error instanceof Error && error.message ? error.message : '다시 시도해주세요.'); }
        finally { googleInFlight.current = false; setGoogleBusy(false); setBusy(false); }
        return;
      }
      if (!signupDraft) return Alert.alert('회원가입 정보를 먼저 입력해주세요.');
      if (Date.now() >= signupDraft.expiresAt) return Alert.alert('인증코드가 만료됐어요.', '회원가입 화면에서 인증코드를 다시 받아주세요.');
      setBusy(true);
      try {
        await authApi.registerEmail(signupDraft.email, signupDraft.name, role === 'teacher' ? 'TEACHER' : 'STUDENT', signupDraft.verificationCode);
        setSignupDraft(null);
        router.replace('/');
        Alert.alert('회원가입 완료', '로그인을 위해 인증코드를 새로 받아주세요.');
      } catch (error) { Alert.alert('회원가입 실패', error instanceof Error ? error.message : '다시 시도해주세요.'); }
      finally { setBusy(false); }
      return;
    }
    if (mode === 'signup' && (!name.trim() || name.trim().length > 50)) return Alert.alert('이름은 1~50자로 입력해주세요.');
    if (!sent || Date.now() >= expiresAt || !/^\d{6}$/.test(code)) return Alert.alert('유효한 인증코드 6자리를 입력해주세요.');
    setBusy(true);
    try {
      if (mode === 'signup') {
        setPendingGoogleToken(null);
        setSignupDraft({ name: name.trim(), email: sentEmail, role: 'STUDENT', verificationCode: code, expiresAt });
        router.push('/role');
      }
      else finishLogin(await emailSession(sentEmail, code));
    } catch (error) {
      if (mode === 'login' && (error instanceof EmailLoginCompletionError || (error instanceof ApiError && (error.status === 404 || error.status === 429)))) { setExpiresAt(0); setSentEmail(''); setCode(''); }
      Alert.alert('인증 실패', errorText(error));
    }
    finally { setBusy(false); }
  }
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}><Image source={require('../../assets/figma/logo.svg')} style={styles.logo} contentFit="contain" accessibilityLabel="Refit" /></View>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.form}>
          <View style={styles.title}><Text style={styles.heading}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
          <View style={styles.spacer} />
          {mode === 'role' ? <>
            {(['student', 'teacher'] as const).map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: role === item }} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleSelected]}><Text style={styles.roleTitle}>{item === 'student' ? '학생' : '선생님'}</Text><Text style={styles.subtitle}>{item === 'student' ? '수업에 참여하고 결석·보강을 신청해요' : '수업을 만들고 출석·보강을 관리해요'}</Text></Pressable>)}
          </> : <>
            <Button label={googleBusy ? 'Google 로그인 중...' : 'Google로 계속하기'} variant="outline" disabled={busy} onPress={continueWithGoogle} />
            <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>또는</Text><View style={styles.line} /></View>
            {mode === 'signup' && <View style={styles.field}><Text style={styles.label}>이름</Text><TextInput value={name} onChangeText={setName} placeholder="이름을 입력해주세요" placeholderTextColor="#999" style={styles.input} accessibilityLabel="이름" /></View>}
            <View style={styles.field}><Text style={styles.label}>이메일</Text><View style={styles.row}><TextInput value={email} onChangeText={setEmail} placeholder="example@email.com" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={[styles.input, styles.flexInput]} accessibilityLabel="이메일" /><View style={styles.sendButton}><Button label={sent ? '다시 받기' : '인증코드 받기'} variant={sent && remaining > 0 ? 'neutral' : 'secondary'} disabled={busy || (sent && remaining > 0)} onPress={sendCode} /></View></View>{sent && <Text style={styles.sentMessage}>인증코드를 보냈어요. 메일함을 확인해주세요.</Text>}</View>
            <View style={styles.field}><Text style={styles.label}>인증코드</Text><View style={[styles.codeInput, focused && styles.focused]}><TextInput value={code} onChangeText={setCode} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="6자리 숫자 입력" placeholderTextColor="#999" keyboardType="number-pad" maxLength={6} style={styles.codeText} accessibilityLabel="인증코드" />{sent && remaining > 0 && <Text style={styles.timer}>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</Text>}</View>{sent && <Text style={styles.helper}>5분 안에 입력해주세요. 메일이 없다면 스팸함을 확인해주세요.</Text>}</View>
          </>}
          <View style={styles.spacer} />
          <Button label={mode === 'role' ? (googleBusy ? '가입 처리 중...' : '시작하기') : title} disabled={busy} onPress={submit} />
          {mode !== 'role' && <Text style={styles.switchText}>{mode === 'login' ? '계정이 없나요? ' : '이미 계정이 있나요? '}<Text accessibilityRole="link" style={styles.switchLink} onPress={() => router.replace(mode === 'login' ? '/signup' : '/')}>{mode === 'login' ? '회원가입' : '로그인'}</Text></Text>}
        </View>
        <View style={styles.footer}>{([['서비스 소개', '/about'], ['FAQ', '/faq'], ['이용약관', '/terms'], ['개인정보 처리방침', '/privacy']] as const).map(([label, route], index) => <View key={route} style={styles.footerItem}>{index > 0 && <Text style={styles.footerText}>·</Text>}<Pressable accessibilityRole="link" accessibilityLabel={label} hitSlop={6} onPress={() => router.push(route)}><Text style={styles.footerText}>{label}</Text></Pressable></View>)}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' }, fill: { flex: 1 }, header: { height: 70, borderBottomWidth: 1, borderBottomColor: '#e8e8e8', justifyContent: 'center', paddingLeft: 24 }, logo: { width: 81.4689, height: 38.0832 }, scroll: { flexGrow: 1 }, form: { marginHorizontal: 28, marginTop: 40, gap: 16 }, title: { alignItems: 'center', gap: 6 }, heading: { fontSize: 24, fontWeight: '700', color: '#151515', includeFontPadding: false }, subtitle: { fontSize: 13, color: '#777', textAlign: 'center', includeFontPadding: false }, spacer: { height: 4 }, button: { height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primary: { backgroundColor: blue }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: blue }, outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' }, neutral: { backgroundColor: '#f3f3f3' }, buttonText: { fontSize: 14, fontWeight: '700', color: '#fff', includeFontPadding: false }, blueText: { color: blue }, darkText: { color: '#151515' }, neutralText: { color: '#737373' }, divider: { flexDirection: 'row', alignItems: 'center', gap: 12 }, line: { flex: 1, height: 1, backgroundColor: '#e8e8e8' }, or: { fontSize: 12, color: '#999', includeFontPadding: false }, field: { gap: 8 }, label: { fontSize: 13, fontWeight: '700', color: '#555', includeFontPadding: false }, row: { flexDirection: 'row', gap: 8 }, input: { height: 46, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 14, color: '#151515', fontSize: 14 }, flexInput: { flex: 1, minWidth: 0 }, sendButton: { width: 112 }, sentMessage: { fontSize: 12, color: blue }, codeInput: { height: 46, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, focused: { borderColor: blue, borderWidth: 1.5 }, codeText: { flex: 1, fontSize: 14, color: '#151515', padding: 0 }, timer: { fontSize: 13, fontWeight: '600', color: blue }, helper: { fontSize: 12, color: '#999' }, switchText: { textAlign: 'center', fontSize: 13, color: '#7a7a7a' }, switchLink: { color: blue, fontWeight: '600' }, role: { backgroundColor: '#fff', borderColor: '#e0e0e0', borderWidth: 1, borderRadius: 12, paddingVertical: 22, alignItems: 'center', gap: 6 }, roleSelected: { borderWidth: 2, borderColor: blue, backgroundColor: '#eef7ff' }, roleTitle: { fontSize: 17, fontWeight: '700', color: '#151515' }, footer: { marginTop: 'auto', paddingTop: 40, paddingBottom: 27, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }, footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 3 }, footerText: { fontSize: 11, color: '#999' },
});
