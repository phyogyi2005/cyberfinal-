
import { Message, KnowledgeLevel, Attachment, MessageType, AnalysisResult, QuizData, ChatMode } from "../types";

// Determine the backend URL based on environment
const BACKEND_URL = (window as any).VITE_BACKEND_URL || 'https://your-backend-url.onrender.com';

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
    if (!res.ok) return [];
    return res.json();
  },

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
    if (!res.ok) return [];
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
      throw new Error(err.error || 'Server connection lost. Please check if your backend is running.');
    }
    return res.json();
  }
};

// Unified function for App.tsx to avoid direct Gemini SDK calls
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
    const response = await api.sendMessage({
      sessionId,
      message: currentMessage,
      attachments,
      userLevel,
      language,
      mode
    });
    
    // The backend returns a saved message object
    return {
      text: response.content,
      type: response.type,
      analysisData: response.analysisData,
      quizData: response.quizData
    };
  } catch (error: any) {
    console.error("API Error:", error);
    return { 
      text: `⚠️ **Error**: ${error.message}. Please ensure your API Key is set in the Render Backend settings.`, 
      type: MessageType.TEXT 
    };
  }
};
