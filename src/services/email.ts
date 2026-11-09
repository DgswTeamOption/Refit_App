import { jsonBody, request } from './http';

type EmailData = { is_verification: boolean };
export const emailApi = {
  sendCode: async (email: string) => ({ data: await request<EmailData>('/api/user/email/send-code', { method: 'POST', ...jsonBody({ email_id: email }) }) }),
  verifyCode: async (email: string, code: string) => ({ data: await request<EmailData>('/api/user/email/verify-code', { method: 'POST', ...jsonBody({ email_id: email, verification_code: code }) }) }),
};
