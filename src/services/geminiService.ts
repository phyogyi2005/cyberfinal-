
import { Message, KnowledgeLevel, Attachment, MessageType, AnalysisResult, QuizData, ChatMode } from "../types";

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('cyber_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const api = {
  async register(data: any) {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },

  async login(data: any) {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  async getSessions() {
    const res = await fetch(`${BACKEND_URL}/api/sessions`, { headers: getHeaders() });
    return res.json();
  },

  // Fix: Added optional mode parameter to createSession to match its usage in App.tsx
  async createSession(title?: string, mode?: ChatMode) {
    const res = await fetch(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title, mode })
    });
    return res.json();
  },

  async getMessages(sessionId: string) {
    const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/messages`, { headers: getHeaders() });
    return res.json();
  },

  async sendMessage(payload: any) {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Server connection lost');
    }
    return res.json();
  }
};

// Compatibility wrapper for existing App.tsx logic
export const sendMessageToGemini = async (
  history: Message[],
  currentMessage: string,
  attachments: Attachment[],
  userLevel: KnowledgeLevel,
  language: 'en' | 'my',
  mode: ChatMode,
  sessionId?: string
): Promise<any> => {
  try {
    return await api.sendMessage({
      sessionId,
      message: currentMessage,
      attachments,
      userLevel,
      language,
      mode
    });
  } catch (error: any) {
    return { 
      content: `⚠️ Error: ${error.message}. Please check your connection.`, 
      type: MessageType.TEXT 
    };
  }
};
