import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useInitial, useSession } from '../auth/Session';
import { baseUrl } from '../services/http';

export function ProfileAvatar() {
  const { session } = useSession();
  const initial = useInitial();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const photo = session?.user.profileImageUrl;
  const uri = photo && (photo.startsWith('/') ? `${baseUrl}${photo}` : photo);
  const showPhoto = !!uri && uri !== failedUri;
  return <View style={styles.avatar}>
    <Image source={showPhoto ? { uri } : require('../../assets/figma/avatar.svg')} style={StyleSheet.absoluteFill} contentFit={showPhoto ? 'cover' : 'contain'} onError={showPhoto ? () => setFailedUri(uri) : undefined} />
    {!showPhoto && <Text style={styles.initial}>{initial}</Text>}
  </View>;
}
const styles = StyleSheet.create({ avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontSize: 13, fontWeight: '700' } });
