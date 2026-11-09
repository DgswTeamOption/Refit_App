import { Image } from 'expo-image';
import { StyleSheet, TextInput, View } from 'react-native';

// Web fallback; native platforms use the system picker in DateTimeField.native.tsx.
export function DateTimeField({ mode, value, onChange }: { mode: 'date' | 'time'; value: string; onChange: (value: string) => void }) {
  return <View style={styles.field}><Image source={require('../../assets/figma/schedule-input.svg')} style={StyleSheet.absoluteFill} contentFit="fill" /><TextInput accessibilityLabel={mode === 'date' ? '날짜 선택' : '시간 선택'} value={value} onChangeText={onChange} placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm'} placeholderTextColor="#999" style={styles.input} /></View>;
}
const styles = StyleSheet.create({ field: { height: 38, justifyContent: 'center', paddingHorizontal: 14 }, input: { padding: 0, color: '#151515', fontSize: 14 } });
