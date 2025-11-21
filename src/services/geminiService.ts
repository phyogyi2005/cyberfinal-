import { Message, KnowledgeLevel, Attachment, MessageType, AnalysisResult, QuizData, ChatMode } from "../types";

// Point this to your backend URL. 
// In development: http://localhost:5000
// In production (Render): https://your-app-name.onrender.com
const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:5000'; 

export const sendMessageToGemini = async (
  history: Message[],
  currentMessage: string,
  attachments: Attachment[],
  userLevel: KnowledgeLevel,
  language: 'en' | 'my',
  mode: ChatMode
): Promise<{ text: string; type: MessageType; analysisData?: AnalysisResult; quizData?: QuizData }> => {
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history,
        message: currentMessage,
        attachments,
        userLevel,
        language,
        mode
      }),
    });

    if (!response.ok) {
      // Try to get error message from backend
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.text || `Backend error: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // Expected format: { text, type, analysisData, quizData }

  } catch (error: any) {
    console.error("Frontend Service Error:", error);
    return { 
      text: `Connection error: ${error.message}. Please ensure the backend server is running.`, 
      type: MessageType.TEXT 
    };
  }
};