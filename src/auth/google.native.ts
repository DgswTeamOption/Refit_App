import { Platform, TurboModuleRegistry } from 'react-native';

const webClientId = '456269811591-2a8l47ng00ppgbbicqphp5s4ijaebkja.apps.googleusercontent.com';
const iosClientId = '456269811591-iq2v2d75dmlbf3pc6hv2b88nrc9o3ne7.apps.googleusercontent.com';

export async function getGoogleIdToken(): Promise<string | null> {
  if (!TurboModuleRegistry.get('RNGoogleSignin')) throw new Error('Google 로그인은 개발 빌드에서 이용할 수 있어요.');
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, iosClientId });
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') return null;
  if (!result.data.idToken) throw new Error('Google ID 토큰을 받지 못했어요.');
  return result.data.idToken;
}
