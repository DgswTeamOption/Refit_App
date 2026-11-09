import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type NotificationItem = { id: string; title: string; body: string; read: boolean };
export type NotificationActions = { markAllRead?: () => Promise<void>; open?: (id: string) => void };
export function NotificationBell({ items = [], actions }: { items?: NotificationItem[]; actions?: NotificationActions }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function markAllRead() {
    if (!actions?.markAllRead) return Alert.alert('준비 중', '알림 읽음 기능은 준비 중이에요.');
    setBusy(true);
    try { await actions.markAllRead(); }
    catch (e) { Alert.alert('알림 처리 실패', e instanceof Error ? e.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.anchor}><Pressable accessibilityRole="button" accessibilityLabel="알림" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} hitSlop={8}><Image source={require('../../assets/figma/bell.svg')} style={styles.bell} contentFit="contain" /></Pressable>{open && <View style={styles.panel}><Image source={require('../../assets/figma/notification-panel.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><View style={styles.heading}><Text style={styles.title}>알림</Text><Pressable accessibilityRole="button" disabled={busy || !items.some(item => !item.read)} onPress={markAllRead}><Text style={styles.readAll}>모두 읽음</Text></Pressable></View>{items.length ? <ScrollView style={styles.items}>{items.map((item, index) => <Pressable key={item.id} style={styles.item} onPress={() => actions?.open?.(item.id)}><View style={styles.itemLine}>{!item.read && <Image source={require('../../assets/figma/notification-unread.svg')} style={styles.unread} contentFit="contain" />}<Text style={styles.itemTitle}>{item.title}</Text></View><Text style={styles.body} numberOfLines={1}>{item.body}</Text>{index < items.length - 1 && <Image source={require('../../assets/figma/notification-divider.svg')} style={styles.divider} contentFit="fill" />}</Pressable>)}</ScrollView> : <Text style={styles.empty}>새로운 알림이 없어요.</Text>}</View>}</View>;
}
const styles = StyleSheet.create({ anchor: { zIndex: 10 }, bell: { width: 15.6, height: 18.6 }, panel: { position: 'absolute', top: 36, right: -57, width: 310, height: 286, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 16, fontWeight: '700', color: '#151515' }, readAll: { color: '#0099ff', fontSize: 12 }, items: { marginTop: 18 }, item: { minHeight: 48 }, itemLine: { flexDirection: 'row', alignItems: 'center', gap: 12 }, unread: { width: 8, height: 8 }, itemTitle: { color: '#151515', fontSize: 13, fontWeight: '700' }, body: { color: '#777', fontSize: 11, marginLeft: 20, marginTop: 4 }, divider: { width: '100%', height: 1, marginTop: 8 }, empty: { color: '#777', fontSize: 12, textAlign: 'center', marginTop: 80 } });
