import { jsonBody, request } from './http';

export type ChatbotStudent = { studentId: number; name: string; profileImageUrl: string | null; classId: number; className: string; absenceCount: number; makeupCount: number; lastAbsenceDate: string | null };
export type UnproposedStudent = Omit<ChatbotStudent, 'makeupCount'>;
export type MonthlyStatus = { year: number; month: number; absenceCount: number; makeupCount: number; pendingMakeupCount: number };
export type RecommendedTime = { rank: number; makeupTime: string; dayOfWeek: string; applicantCount: number };
export type ChatbotResponse =
  | { type: 'STUDENT'; message: string; data: ChatbotStudent[] }
  | { type: 'UNPROPOSED_STUDENTS'; message: string; data: UnproposedStudent[] }
  | { type: 'MONTHLY_STATUS'; message: string; data: MonthlyStatus }
  | { type: 'RECOMMEND_TIME'; message: string; data: RecommendedTime[] }
  | { type: 'GUIDE'; message: string; data?: null };

export function validateChatbotResponse(value: unknown): ChatbotResponse {
  if (!value || typeof value !== 'object') throw new Error('챗봇 응답을 확인할 수 없어요.');
  const response = value as Record<string, unknown>;
  if (typeof response.message !== 'string') throw new Error('챗봇 응답을 확인할 수 없어요.');
  const isRecord = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const isCount = (item: unknown) => typeof item === 'number' && Number.isFinite(item) && item >= 0;
  const isStudent = (item: unknown) => isRecord(item) && Number.isSafeInteger(item.studentId) && Number.isSafeInteger(item.classId) && typeof item.name === 'string' && typeof item.className === 'string' && isCount(item.absenceCount) && (item.lastAbsenceDate == null || typeof item.lastAbsenceDate === 'string');
  const data = response.data;
  if (response.type === 'GUIDE' && data == null) return response as ChatbotResponse;
  if (response.type === 'STUDENT' && Array.isArray(data) && data.every(item => isStudent(item) && isCount(item.makeupCount))) return response as ChatbotResponse;
  if (response.type === 'UNPROPOSED_STUDENTS' && Array.isArray(data) && data.every(isStudent)) return response as ChatbotResponse;
  if (response.type === 'MONTHLY_STATUS' && isRecord(data) && Number.isInteger(data.year) && Number.isInteger(data.month) && isCount(data.absenceCount) && isCount(data.makeupCount) && isCount(data.pendingMakeupCount)) return response as ChatbotResponse;
  if (response.type === 'RECOMMEND_TIME' && Array.isArray(data) && data.every(item => isRecord(item) && Number.isInteger(item.rank) && typeof item.makeupTime === 'string' && typeof item.dayOfWeek === 'string' && isCount(item.applicantCount))) return response as ChatbotResponse;
  throw new Error('챗봇 응답을 확인할 수 없어요.');
}

export async function queryChatbot(message: string, token: string, classId?: number, signal?: AbortSignal): Promise<ChatbotResponse> {
  const text = message.trim();
  if (!text || text.length > 200) throw new Error('질문은 1~200자로 입력해주세요.');
  if (classId !== undefined && (!Number.isSafeInteger(classId) || classId <= 0)) throw new Error('수업 정보를 확인할 수 없어요.');
  if (signal?.aborted) { const error = new Error('요청이 취소됐어요.'); error.name = 'AbortError'; throw error; }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let rejectAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => { const error = new Error('요청이 취소됐어요.'); error.name = 'AbortError'; reject(error); };
    if (controller.signal.aborted) rejectAbort();
    else controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await Promise.race([request<unknown>('/api/chatbot/query', { method: 'POST', ...jsonBody({ message: text, ...(classId === undefined ? {} : { classId }) }), signal: controller.signal }, token), cancelled]);
    if (controller.signal.aborted) { const error = new Error('요청이 취소됐어요.'); error.name = 'AbortError'; throw error; }
    return validateChatbotResponse(response);
  } catch (error) {
    if (timedOut) throw new Error('응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.');
    throw error;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', rejectAbort);
    signal?.removeEventListener('abort', abort);
  }
}

// Keep the standalone chatbot route compatible with the shared API client.
export const CHATBOT_MAX_LENGTH = 200;
export type ChatbotReply = ChatbotResponse;
export type ChatStudent = ChatbotStudent;
export type ChatUnproposedStudent = UnproposedStudent;
export type ChatRecommendTime = RecommendedTime;
export type ChatMonthlyStatus = MonthlyStatus;
export const validateChatbotReply = validateChatbotResponse;
export const chatbotApi = {
  query: queryChatbot,
  async students(name: string, token: string): Promise<ChatbotStudent[]> {
    const data = await request<unknown>(`/api/chatbot/students?name=${encodeURIComponent(name)}`, {}, token);
    const reply = validateChatbotResponse({ type: 'STUDENT', message: '', data });
    if (reply.type !== 'STUDENT') throw new Error('챗봇 응답을 확인할 수 없어요.');
    return reply.data;
  },
  async monthlyStatus(token: string): Promise<MonthlyStatus> {
    const data = await request<unknown>('/api/chatbot/monthly-status', {}, token);
    const reply = validateChatbotResponse({ type: 'MONTHLY_STATUS', message: '', data });
    if (reply.type !== 'MONTHLY_STATUS') throw new Error('챗봇 응답을 확인할 수 없어요.');
    return reply.data;
  },
  async unproposedStudents(token: string): Promise<UnproposedStudent[]> {
    const data = await request<unknown>('/api/chatbot/unproposed-students', {}, token);
    const reply = validateChatbotResponse({ type: 'UNPROPOSED_STUDENTS', message: '', data });
    if (reply.type !== 'UNPROPOSED_STUDENTS') throw new Error('챗봇 응답을 확인할 수 없어요.');
    return reply.data;
  },
  async recommendTime(classId: number, token: string): Promise<RecommendedTime[]> {
    const data = await request<unknown>(`/api/chatbot/recommend-time?classId=${encodeURIComponent(classId)}`, {}, token);
    const reply = validateChatbotResponse({ type: 'RECOMMEND_TIME', message: '', data });
    if (reply.type !== 'RECOMMEND_TIME') throw new Error('챗봇 응답을 확인할 수 없어요.');
    return reply.data;
  },
};
