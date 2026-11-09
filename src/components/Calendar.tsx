import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type CalendarStatus = 'attendance' | 'absence' | 'makeup' | 'pending';
export type ClassCalendarColor = 'peach' | 'purple' | 'yellow' | 'mint';
export type CalendarMark = CalendarStatus | { color: ClassCalendarColor; label: string };
export type CalendarMarks = Record<string, CalendarMark[]>;
export type ClassCalendarLegend = { color: ClassCalendarColor; label: string }[];
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const markAssets: Record<CalendarStatus, number> = {
  attendance: require('../../assets/figma/calendar-mark-attendance.svg'),
  absence: require('../../assets/figma/calendar-mark-absence.svg'),
  makeup: require('../../assets/figma/calendar-mark-makeup.svg'),
  pending: require('../../assets/figma/calendar-mark-pending.svg'),
};
const classMarkAssets: Record<ClassCalendarColor, number> = { peach: require('../../assets/figma/class-mark-peach.svg'), purple: require('../../assets/figma/class-mark-purple.svg'), yellow: require('../../assets/figma/calendar-mark-makeup.svg'), mint: require('../../assets/figma/class-mark-mint.svg') };
const classLegendAssets: Record<ClassCalendarColor, number> = { peach: require('../../assets/figma/class-legend-peach.svg'), purple: require('../../assets/figma/class-legend-purple.svg'), yellow: require('../../assets/figma/makeup-dot.svg'), mint: require('../../assets/figma/class-legend-mint.svg') };
const statusLabels: Record<CalendarStatus, string> = { attendance: '출석', absence: '결석', makeup: '보강', pending: '보강 대기중' };
export function Calendar({ onSelect, showLegend = false, marks = {}, classLegend }: { onSelect?: (date: string) => void; showLegend?: boolean; marks?: CalendarMarks; classLegend?: ClassCalendarLegend }) {
  const [month, setMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1); });
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const start = new Date(year, monthIndex, 1).getDay(); const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => index - start + 1);
  return <View style={styles.calendar}><Image source={require('../../assets/figma/calendar.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><View style={styles.header}><Text style={styles.month}>{year}년 {monthIndex + 1}월</Text><View style={styles.arrows}><Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => setMonth(new Date(year, monthIndex - 1, 1))}><Text style={styles.arrow}>‹</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => setMonth(new Date(year, monthIndex + 1, 1))}><Text style={styles.arrow}>›</Text></Pressable></View></View><View style={styles.week}>{weekdays.map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}</View><View style={styles.days}>{cells.map((day, index) => {
    const valid = day > 0 && day <= days;
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const statuses = valid ? marks[key] ?? [] : [];
    return <Pressable style={styles.day} key={index} disabled={!onSelect || !valid} accessibilityLabel={valid ? `${year}년 ${monthIndex + 1}월 ${day}일 ${statuses.map(status => typeof status === 'string' ? statusLabels[status] : status.label).join(' ')}` : undefined} onPress={() => onSelect?.(key)}><Text style={[styles.dayText, (index % 7 === 0 || index % 7 === 6) && styles.weekend]}>{valid ? day : ''}</Text><View style={styles.marks}>{statuses.map((status, i) => <Image key={i} source={typeof status === 'string' ? markAssets[status] : classMarkAssets[status.color]} style={styles.mark} contentFit="contain" />)}</View></Pressable>;
  })}</View>{(showLegend || !!classLegend?.length) && <View style={styles.legend}>{(classLegend ? classLegend.map(item => ({ label: item.label, source: classLegendAssets[item.color] })) : [
    { label: '출석', source: require('../../assets/figma/attendance-dot.svg') },
    { label: '결석', source: require('../../assets/figma/absence-dot.svg') },
    { label: '보강', source: require('../../assets/figma/makeup-dot.svg') },
    { label: '보강 대기중', source: require('../../assets/figma/pending-dot.svg') },
  ]).map((item, index) => <View key={`${item.label}-${index}`} style={styles.legendItem}><Image source={item.source} style={styles.dot} contentFit="contain" /><Text style={styles.legendText}>{item.label}</Text></View>)}</View>}</View>;
}
const styles = StyleSheet.create({ calendar: { height: 330, paddingHorizontal: 24, paddingTop: 16 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, month: { color: '#151515', fontWeight: '700', fontSize: 18 }, arrows: { flexDirection: 'row', gap: 28, paddingRight: 10 }, arrow: { color: '#151515', fontSize: 28, lineHeight: 34 }, week: { flexDirection: 'row', marginTop: 22 }, weekday: { flex: 1, textAlign: 'center', fontSize: 12, color: '#888' }, days: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }, day: { width: `${100 / 7}%`, height: 30, alignItems: 'center', justifyContent: 'center' }, dayText: { color: '#555', fontSize: 13 }, weekend: { color: '#999' }, marks: { height: 6, flexDirection: 'row', gap: 3 }, mark: { width: 6, height: 6 }, legend: { marginTop: 'auto', paddingBottom: 10, flexDirection: 'row', flexWrap: 'wrap' }, legendItem: { width: '50%', height: 15, flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 8, height: 8 }, legendText: { color: '#666', fontSize: 11 } });
