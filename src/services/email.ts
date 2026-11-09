import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_URL to the server computer's address when using a physical device.
const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

type EmailResponse = { success: true; data?: { is_verification: boolean } };

async function post(path: string, body: Record<string, string>): Promise<EmailResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || '요청을 처리하지 못했어요.');
  return result as EmailResponse;
}

export const emailApi = {
  sendCode: (email: string) => post('/api/user/email/send-code', { email_id: email }),
  verifyCode: (email: string, code: string) => post('/api/user/email/verify-code', { email_id: email, verification_code: code }),
};
