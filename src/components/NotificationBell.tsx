import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../auth/Session';
import { mergeNotificationItems, notificationApi, validateNotificationPage } from '../services/notification';

export type NotificationItem = { id: string; title: string; body: string; read: boolean };
export type NotificationActions = { markAllRead?: () => Promise<void>; open?: (id: string) => void };
type ServerResult = { token: string; items: NotificationItem[]; page: number; last: boolean; error?: string };
export function NotificationBell({ items = [], actions }: { items?: NotificationItem[]; actions?: NotificationActions }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ServerResult | null>(null);
  const inFlight = useRef<string | null>(null);
  const requestNumber = useRef(0);
  const token = session?.accessToken;
  const current = result?.token === token ? result : null;
  const visibleItems = session ? current?.items ?? [] : items;
  async function load(page: number) {
    if (!token || inFlight.current === token) return;
    inFlight.current = token;
    const sequence = ++requestNumber.current;
    setBusy(true);
    try {
      const data = validateNotificationPage(await notificationApi.list(token, page), page);
      if (sequence !== requestNumber.current) return;
      const next = data.content.map(item => ({ id: String(item.notificationId), title: '알림', body: item.message, read: item.isRead }));
      setResult(previous => {
        const existing = page > 0 && previous?.token === token ? previous.items : [];
        return { token, items: mergeNotificationItems(existing, next), page: data.number, last: data.last };
      });
    } catch (error) {
      if (sequence !== requestNumber.current) return;
      setResult(previous => ({ token, items: page > 0 && previous?.token === token ? previous.items : [], page: page > 0 && previous?.token === token ? previous.page : 0, last: page > 0 && previous?.token === token ? previous.last : true, error: error instanceof Error ? error.message : '알림을 불러오지 못했어요.' }));
    } finally { if (sequence === requestNumber.current) { inFlight.current = null; setBusy(false); } }
  }
  async function markAllRead() {
    if (session || !actions?.markAllRead) return Alert.alert('준비 중', '알림 읽음 기능은 준비 중이에요.');
    setBusy(true);
    try { await actions.markAllRead(); }
    catch (error) { Alert.alert('알림 처리 실패', error instanceof Error ? error.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && token) void load(0);
  }
  return <View style={styles.anchor}><Pressable accessibilityRole="button" accessibilityLabel="알림" accessibilityState={{ expanded: open }} onPress={toggle} hitSlop={8}><Image source={require('../../assets/figma/bell.svg')} style={styles.bell} contentFit="contain" /></Pressable>{open && <View style={styles.panel}><Image source={require('../../assets/figma/notification-panel.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><View style={styles.heading}><Text style={styles.title}>알림</Text><Pressable accessibilityRole="button" disabled={busy || !visibleItems.some(item => !item.read)} onPress={markAllRead}><Text style={styles.readAll}>모두 읽음</Text></Pressable></View>{visibleItems.length ? <ScrollView style={styles.items}>{visibleItems.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`알림 상세 보기: ${item.body}`} style={styles.item} onPress={() => { if (!session && actions?.open) actions.open(item.id); else Alert.alert(item.title, item.body); }}><View style={styles.itemLine}>{!item.read && <Image source={require('../../assets/figma/notification-unread.svg')} style={styles.unread} contentFit="contain" />}<Text style={styles.itemTitle}>{item.title}</Text></View><Text style={styles.body} numberOfLines={2}>{item.body}</Text>{index < visibleItems.length - 1 && <Image source={require('../../assets/figma/notification-divider.svg')} style={styles.divider} contentFit="fill" />}</Pressable>)}{!!current?.error && <Text style={styles.error}>{current.error}</Text>}{session && current && (!current.last || !!current.error) && <Pressable disabled={busy} onPress={() => void load(current.page + 1)} style={styles.more}><Text style={styles.readAll}>{busy ? '불러오는 중' : '더 보기'}</Text></Pressable>}</ScrollView> : <View style={styles.emptyArea}><Text style={styles.empty}>{busy ? '알림을 불러오는 중이에요.' : current?.error ?? '새로운 알림이 없어요.'}</Text>{!!current?.error && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void load(0)}><Text style={styles.readAll}>다시 시도</Text></Pressable>}</View>}</View>}</View>;
}
const styles = StyleSheet.create({ anchor: { zIndex: 10 }, bell: { width: 15.6, height: 18.6 }, panel: { position: 'absolute', top: 36, right: -57, width: 310, height: 286, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 16, fontWeight: '700', color: '#151515' }, readAll: { color: '#0099ff', fontSize: 12 }, items: { marginTop: 18 }, item: { minHeight: 48 }, itemLine: { flexDirection: 'row', alignItems: 'center', gap: 12 }, unread: { width: 8, height: 8 }, itemTitle: { color: '#151515', fontSize: 13, fontWeight: '700' }, body: { color: '#777', fontSize: 11, marginLeft: 20, marginTop: 4 }, divider: { width: '100%', height: 1, marginTop: 8 }, emptyArea: { alignItems: 'center', marginTop: 80, gap: 12 }, empty: { color: '#777', fontSize: 12, textAlign: 'center' }, error: { color: '#f04444', fontSize: 11, marginTop: 8 }, more: { alignItems: 'center', padding: 10 } });
