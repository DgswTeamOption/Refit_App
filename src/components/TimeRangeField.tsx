import { Image } from 'expo-image';
import { StyleSheet, Text, TextInput, View } from 'react-native';
export function TimeRangeField({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  return <View style={styles.field}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel="시작 시간" value={start} onChangeText={value => onChange(value, end)} placeholder="HH:mm" placeholderTextColor="#999" style={styles.input} /><Text style={styles.separator}>–</Text><TextInput accessibilityLabel="종료 시간" value={end} onChangeText={value => onChange(start, value)} placeholder="HH:mm" placeholderTextColor="#999" style={styles.input} /></View>;
}
const styles = StyleSheet.create({ field: { height: 38, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }, input: { flex: 1, color: '#151515', fontSize: 14, padding: 0 }, separator: { color: '#777', marginHorizontal: 8 } });
