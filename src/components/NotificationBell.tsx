import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// The panel is ready for notification data when its server API is available.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  return <View style={styles.anchor}><Pressable accessibilityRole="button" accessibilityLabel="알림" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} hitSlop={8}><Image source={require('../../assets/figma/bell.svg')} style={styles.bell} contentFit="contain" /></Pressable>{open && <View style={styles.panel}><Image source={require('../../assets/figma/notification-panel.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><View style={styles.heading}><Text style={styles.title}>알림</Text><Text style={styles.readAll}>모두 읽음</Text></View><Text style={styles.empty}>새로운 알림이 없어요.</Text></View>}</View>;
}
const styles = StyleSheet.create({ anchor: { zIndex: 10 }, bell: { width: 15.6, height: 18.6 }, panel: { position: 'absolute', top: 36, right: -57, width: 310, height: 286, paddingHorizontal: 20, paddingTop: 16 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 16, fontWeight: '700', color: '#151515' }, readAll: { color: '#0099ff', fontSize: 12 }, empty: { color: '#777', fontSize: 12, textAlign: 'center', marginTop: 80 } });
