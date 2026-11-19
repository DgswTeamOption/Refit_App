import { jsonBody, request } from './http';

export type ChatStudent = { studentId: number; name: string; profileImageUrl?: string | null; classId: number; className: string; absenceCount: number; makeupCount: number; lastAbsenceDate?: string | null };
export type ChatUnproposedStudent = { studentId: number; name: string; profileImageUrl?: string | null; classId: number; className: string; absenceCount: number; lastAbsenceDate?: string | null };
export type ChatRecommendTime = { rank: number; makeupTime: string; dayOfWeek: string; applicantCount: number };
export type ChatMonthlyStatus = { year: number; month: number; absenceCount: number; makeupCount: number; pendingMakeupCount: number };

export type ChatbotReply =
  | { type: 'STUDENT'; message: string; data: ChatStudent[] }
  | { type: 'RECOMMEND_TIME'; message: string; data: ChatRecommendTime[] }
  | { type: 'UNPROPOSED_STUDENTS'; message: string; data: ChatUnproposedStudent[] }
  | { type: 'MONTHLY_STATUS'; message: string; data: ChatMonthlyStatus }
  | { type: 'GUIDE'; message: string; data: null };

export const CHATBOT_MAX_LENGTH = 200;
const listTypes = ['STUDENT', 'RECOMMEND_TIME', 'UNPROPOSED_STUDENTS'];

export function validateChatbotReply(value: unknown): ChatbotReply {
  const reply = value as { type?: unknown; message?: unknown; data?: unknown } | null | undefined;
  const type = reply?.type;
  const ok = !!reply && typeof reply.message === 'string' && (
    (typeof type === 'string' && listTypes.includes(type) && Array.isArray(reply.data))
    || (type === 'MONTHLY_STATUS' && !!reply.data && typeof reply.data === 'object')
    || type === 'GUIDE');
  if (!ok) throw new Error('챗봇 응답을 확인할 수 없어요.');
  return (type === 'GUIDE' ? { ...reply, data: null } : reply) as ChatbotReply;
}

async function required<T>(promise: Promise<T | undefined>): Promise<T> {
  const result = await promise;
  if (result === undefined || result === null) throw new Error('챗봇 응답을 확인할 수 없어요.');
  return result;
}

export const chatbotApi = {
  query: async (message: string, token: string, classId?: number) =>
    validateChatbotReply(await request<unknown>('/api/chatbot/query', { method: 'POST', ...jsonBody({ message, classId: classId ?? null }) }, token)),
  students: (name: string, token: string) => required(request<ChatStudent[]>(`/api/chatbot/students?name=${encodeURIComponent(name)}`, {}, token)),
  monthlyStatus: (token: string) => required(request<ChatMonthlyStatus>('/api/chatbot/monthly-status', {}, token)),
  unproposedStudents: (token: string) => required(request<ChatUnproposedStudent[]>('/api/chatbot/unproposed-students', {}, token)),
  recommendTime: (classId: number, token: string) => required(request<ChatRecommendTime[]>(`/api/chatbot/recommend-time?classId=${classId}`, {}, token)),
};
