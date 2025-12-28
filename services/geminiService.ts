import { GoogleGenAI } from "@google/genai";
import { Message, KnowledgeLevel, Attachment, MessageType, AnalysisResult, QuizData, ChatMode } from "../types";

// --- CONFIGURATION ---
// Using Gemini 3 models as per guidelines
const REASONING_MODEL = 'gemini-3-pro-preview';
const SPEED_MODEL = 'gemini-3-flash-preview';

const getSystemInstruction = (userLevel: KnowledgeLevel, language: 'en' | 'my', mode: ChatMode) => {
  let baseInstruction = `You are Cyber Advisor, a Cybersecurity Awareness AI Assistant.
  User Knowledge Level: ${userLevel}.
  Language: ${language === 'my' ? 'Myanmar (Burmese)' : 'English'}.
  
  Current Mode: ${mode.toUpperCase()}.
  `;

  switch (mode) {
    case 'quiz':
      baseInstruction += `
      TASK: You are a Quiz Host.
      1. You will conduct a 5-question quiz.
      2. If the user says "Start", provide Question 1 immediately.
      3. For Questions 1 through 5:
         - Wait for user answer.
         - Provide feedback (Correct/Incorrect) + short explanation.
         - THEN generate the NEXT question JSON.
      
      CRITICAL OUTPUT RULES:
      - OUTPUT STRICTLY VALID JSON.
      - Ensure "options" is an Array of strings.
      - Ensure "correctAnswerIndex" is a number (0-3).
      
      JSON FORMAT:
      \`\`\`json
      {
        "question": "Question text here?",
        "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
        "correctAnswerIndex": 0,
        "explanation": "Explanation here."
      }
      \`\`\`
      `;
      break;
    case 'learning':
      baseInstruction += `
      TASK: You are an engaging Cyber Tutor.
      STYLE: Use Numbered Lists, **Bold Main Points**, Short Paragraphs, and Emojis (🚩, 🔒, ✅).
      `;
      break;
    case 'analysis':
      baseInstruction += `
      TASK: You are a Threat Analyst. Analyze URLs, IPs, or Files.
      Output strictly JSON:
      {
        "riskLevel": "Safe" | "Low" | "Medium" | "High" | "Critical",
        "score": number (0-100),
        "findings": [{"category": "string", "details": "string"}],
        "chartData": [{"name": "string", "value": number, "fill": "hexcode"}]
      }
      `;
      break;
    default:
      baseInstruction += `Answer cybersecurity questions normally.`;
      break;
  }

  return baseInstruction;
};

export const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data,
      mimeType
    },
  };
};

export const sendMessageToGemini = async (
  history: Message[],
  currentMessage: string,
  attachments: Attachment[],
  userLevel: KnowledgeLevel,
  language: 'en' | 'my',
  mode: ChatMode
): Promise<{ text: string; type: MessageType; analysisData?: AnalysisResult; quizData?: QuizData }> => {
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const historyParts = history.slice(-10).map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const currentParts: any[] = attachments.map(att => fileToGenerativePart(att.data, att.mimeType));
    currentParts.push({ text: currentMessage });

    const modelName = (mode === 'analysis' || mode === 'quiz') ? REASONING_MODEL : SPEED_MODEL;
    const systemInstruction = getSystemInstruction(userLevel, language, mode);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [...historyParts, { role: 'user', parts: currentParts }],
      config: { 
        systemInstruction,
        responseMimeType: (mode === 'analysis' || mode === 'quiz') ? "application/json" : undefined 
      }
    });

    const rawText = response.text || "";

    if (mode === 'quiz' || mode === 'analysis') {
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[0]);
          if (mode === 'quiz') {
            return { text: "Next Question:", type: MessageType.QUIZ, quizData: json };
          } else {
            return { text: "Analysis Result:", type: MessageType.ANALYSIS, analysisData: json };
          }
        }
      } catch (e) {
        console.warn("Failed to parse JSON response", e);
      }
    }

    return { text: rawText, type: MessageType.TEXT };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMsg = "I'm sorry, I'm having trouble connecting to my brain right now.";
    if (error.message?.includes('location') || error.message?.includes('supported')) {
      errorMsg = "⚠️ **Region Restricted**: Gemini 3 models are currently restricted in your geographic region. Please try again later or use a different network.";
    }
    return { text: errorMsg, type: MessageType.TEXT };
  }
};
