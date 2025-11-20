import { GoogleGenAI } from "@google/genai";
import { Message, KnowledgeLevel, Attachment, MessageType, AnalysisResult, QuizData, ChatMode } from "../types";

// --- CONFIGURATION ---
// 1. Primary: High Intelligence (Cybersecurity reasoning)
const PRIMARY_MODEL = 'gemini-3-pro-preview';
// 2. Fallback: High Speed (General tasks)
const FALLBACK_MODEL = 'gemini-2.5-flash';
// 3. Lite: Lightweight (High availability)
const LITE_MODEL = 'gemini-2.0-flash-lite-preview-02-05';
// 4. Emergency: Global Availability (Fixes "Location not supported" errors on Render/Europe)
const EMERGENCY_MODEL = 'gemini-1.5-flash';

// --- MULTI-KEY CONFIGURATION ---
// You can paste up to 3 API Keys here for local testing or backup.
const HARDCODED_KEY_1 = ""; 
const HARDCODED_KEY_2 = ""; 
const HARDCODED_KEY_3 = ""; 

// --- API KEY RESOLUTION ---
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return '';
};

// Gather all valid keys into a pool
const getAllKeys = () => {
    const candidates = [
        getEnv('VITE_API_KEY_1') || HARDCODED_KEY_1,
        getEnv('VITE_API_KEY_2') || HARDCODED_KEY_2,
        getEnv('VITE_API_KEY_3') || HARDCODED_KEY_3,
        // Legacy support
        getEnv('VITE_API_KEY') || getEnv('API_KEY') || getEnv('GEMINI_API_KEY')
    ];
    // Remove empty strings and duplicates
    return [...new Set(candidates.filter(k => !!k && k.trim() !== ''))];
};

const apiKeys = getAllKeys();

if (apiKeys.length === 0) {
  console.warn("⚠️ NO API KEYS FOUND! Please set VITE_API_KEY_1, VITE_API_KEY_2, or VITE_API_KEY_3 in your environment.");
} else {
  console.log(`✅ Loaded ${apiKeys.length} API Key(s) for rotation logic.`);
}

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      - ESCAPE ALL control characters inside strings (e.g. use \\n for newlines, do not use raw line breaks inside strings).
      - NO COMMENTS inside JSON (e.g. // or /* */).
      - Ensure "options" is an Array of strings.
      - Ensure "correctAnswerIndex" is a number (0 for A, 1 for B, 2 for C, 3 for D).
      
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
      
      STYLE GUIDE (Strictly Follow):
      1. **Use Numbered Lists**: Break concepts down into steps (1., 2., 3.).
      2. **Bold Main Points**: Highlight key terms like **Phishing**, **2FA**, etc.
      3. **Short & Concise**: Keep paragraphs short (1-2 sentences). Avoid walls of text.
      4. **Use Emojis**: Use flags, shields, locks, and checkmarks (e.g., 🚩, 🔒, ✅, 🛡️) to make it visual.
      5. **Interactive**: End with a question to check understanding.
      
      Example Output:
      "Here is how to spot a Phishing Email:
      
      1. 🚩 **Check the Sender**: Look for misspellings.
      2. 🔗 **Don't Click Links**: Hover over them first.
      
      Do you want to try an example?"
      `;
      break;
    case 'analysis':
      baseInstruction += `
      TASK: You are a Threat Analyst.
      1. The user will provide URLs, IPs, Files, or Images.
      2. You MUST analyze them for specific security risks (Phishing, Malware, SQL Injection, etc.).
      3. Output strictly compliant JSON for the analysis result:
      {
        "riskLevel": "Safe" | "Low" | "Medium" | "High" | "Critical",
        "score": number (0-100, 100 is safest),
        "findings": [{"category": "string", "details": "string"}],
        "chartData": [{"name": "string", "value": number, "fill": "hexcode"}]
      }
      
      LANGUAGE INSTRUCTION:
      - If the language is set to Myanmar (Burmese), you MUST translate the values of 'category', 'details', and 'riskLevel' (if possible) into Burmese.
      - However, KEEP the JSON keys (riskLevel, score, findings, chartData) in English.
      `;
      break;
    default: // normal
      baseInstruction += `
      TASK: General Assistant.
      1. Answer questions normally.
      2. If the user uploads an image/file, describe it generally unless asked to analyze it.
      `;
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
    const historyParts = history.slice(-10).map(msg => {
      let text = msg.content;
      if (msg.type === MessageType.ANALYSIS && msg.analysisData) {
        text += `\n\n[System Context: Previous Analysis Data]\n${JSON.stringify(msg.analysisData)}`;
      }
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: text }]
      };
    });

    const currentParts: any[] = [];
    attachments.forEach(att => {
      currentParts.push(fileToGenerativePart(att.data, att.mimeType));
    });
    currentParts.push({ text: currentMessage });

    let responseMimeType: string | undefined = undefined;
    if (mode === 'analysis' && (attachments.length > 0 || currentMessage.length > 5)) {
      responseMimeType = "application/json";
    }

    const finalSystemInstruction = getSystemInstruction(userLevel, language, mode);

    // --- ADVANCED GENERATION: MODEL + KEY ROTATION ---
    const generateWithRotation = async (modelName: string, attempt = 0): Promise<any> => {
      let lastError: any = null;

      if (apiKeys.length === 0) throw new Error("API key is missing.");

      // Try each key in the pool
      for (const key of apiKeys) {
          if (!key) continue;

          try {
              // Create a fresh client for each key to ensure isolation
              const client = new GoogleGenAI({ apiKey: key });
              
              return await client.models.generateContent({
                  model: modelName,
                  contents: [...historyParts, { role: 'user', parts: currentParts }],
                  config: {
                      systemInstruction: finalSystemInstruction,
                      responseMimeType: responseMimeType,
                  }
              });

          } catch (error: any) {
              lastError = error;
              const msg = error.message?.toLowerCase() || '';
              
              const isQuota = msg.includes('quota') || msg.includes('resource_exhausted');
              const isRateLimit = msg.includes('429') || error.status === 429;
              
              // If Quota or Rate Limit, ROTATE KEY immediately for this model
              if (isQuota || isRateLimit) {
                  console.warn(`Key ending in ...${key.slice(-4)} failed on ${modelName}. Rotating to next key...`);
                  continue; 
              }
              
              // If it's a Geo Block or other error, Key Rotation won't help. 
              // Throw to let the Model Fallback strategy handle it.
              throw error;
          }
      }
      
      // If all keys failed for this model, throw the error to trigger Model Fallback
      throw lastError || new Error(`All available keys failed for ${modelName}`);
    };


    let response;
    
    // --- MODEL FALLBACK CHAIN ---
    try {
      // 1. Try Primary Model (Pro) with All Keys
      response = await generateWithRotation(PRIMARY_MODEL);
    } catch (error: any) {
      console.warn(`Primary model (${PRIMARY_MODEL}) failed with all keys. Reason: ${error.message}`);
      
      // 2. Try Fallback Model (Flash 2.5) with All Keys
      try {
        response = await generateWithRotation(FALLBACK_MODEL);
      } catch (fallbackError: any) {
         console.warn(`Fallback model (${FALLBACK_MODEL}) also failed. Reason: ${fallbackError.message}`);
         
         // 3. Try Lite Model (Flash Lite 2.0) with All Keys
         try {
            response = await generateWithRotation(LITE_MODEL);
         } catch (liteError: any) {
             console.warn(`Lite model (${LITE_MODEL}) also failed. Reason: ${liteError.message}`);
             
             // 4. Try Emergency Model (Flash 1.5) - Best for Geo-blocked regions
             try {
                response = await generateWithRotation(EMERGENCY_MODEL);
             } catch (emergencyError: any) {
                 if (emergencyError.message?.includes('location') || emergencyError.message?.includes('supported') || emergencyError.message?.includes('400')) {
                     throw new Error("GEO_BLOCK_ERROR");
                 }
                 throw emergencyError;
             }
         }
      }
    }
    // --- END GENERATION LOGIC ---

    const rawText = response?.text || "";

    // Parsing Logic (Quiz & Analysis)
    if (mode === 'quiz') {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        rawText.match(/```\s*([\s\S]*?)\s*```/) || 
                        rawText.match(/(\{[\s\S]*"[\w_]*question[\w_]*"[\s\S]*\})/);
      
      if (jsonMatch) {
        try {
          let jsonStr = jsonMatch[1] || jsonMatch[0];
          jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          const quizData = JSON.parse(jsonStr);
          
          if (!quizData.question && quizData.question_text) quizData.question = quizData.question_text;

          if (!Array.isArray(quizData.options)) {
              const normalizedOptions: string[] = [];
              if (typeof quizData.options === 'object' && quizData.options !== null) {
                  ['A', 'B', 'C', 'D'].forEach(key => {
                      if ((quizData.options as any)[key]) normalizedOptions.push(`${key}) ${(quizData.options as any)[key]}`);
                  });
                  if (normalizedOptions.length === 0) Object.values(quizData.options).forEach((val: any) => normalizedOptions.push(String(val)));
              }
              if (normalizedOptions.length > 0) quizData.options = normalizedOptions;
          }

          let rawAnswer = quizData.correctAnswerIndex;
          if (rawAnswer === undefined) rawAnswer = quizData.answer || quizData.correct_option || quizData.correctOption || quizData.correct_answer;
          const map: Record<string, number> = {'A': 0, 'B': 1, 'C': 2, 'D': 3};
          if (typeof rawAnswer === 'number') {
             quizData.correctAnswerIndex = rawAnswer;
          } else if (typeof rawAnswer === 'string') {
             const match = rawAnswer.match(/[A-Da-d]/);
             const char = match ? match[0].toUpperCase() : 'A';
             quizData.correctAnswerIndex = map[char] !== undefined ? map[char] : 0;
          } else {
             quizData.correctAnswerIndex = 0;
          }

          const displayText = rawText.replace(jsonMatch[0], '').trim();
          return { text: displayText || "Here is the next question:", type: MessageType.QUIZ, quizData: quizData };
        } catch (e) {
          return { text: rawText, type: MessageType.TEXT };
        }
      }
      return { text: rawText, type: MessageType.TEXT };
    }

    if (mode === 'analysis') {
       try {
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(jsonStr);
        if (!json.riskLevel && !json.score) return { text: rawText, type: MessageType.TEXT };
        const summary = `**Analysis Complete:** Risk Level ${json.riskLevel || 'Unknown'}. Score: ${json.score}/100.`;
        return { text: summary, type: MessageType.ANALYSIS, analysisData: json };
      } catch (e) {
         return { text: rawText, type: MessageType.TEXT };
      }
    }

    return { text: rawText, type: MessageType.TEXT };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    let errorMessage = "I encountered an error processing your request.";
    const msg = error.message?.toLowerCase() || '';
    
    if (msg.includes('geo_block')) {
         errorMessage = "⚠️ **Region Not Supported**: This app is hosted in a region (likely EU) where the newest AI models are restricted. \n\n**Fix:** Create a new Render Service in the **'US West (Oregon)'** region.";
    } else if (msg.includes('quota') || msg.includes('resource_exhausted')) {
        errorMessage = "⚠️ **System Busy**: All AI models are currently overloaded and all backup keys have exceeded their quota. Please try again later.";
    } else if (msg.includes('429')) {
        errorMessage = "⚠️ **High Traffic**: We are experiencing high volume. Please try again in a moment.";
    } else if (msg.includes('api key') || msg.includes('missing')) {
        errorMessage = "⚠️ **Configuration Error**: No valid API Keys found. \n\n**Fix:** Go to Render Dashboard -> Environment Variables -> Add 'VITE_API_KEY_1' with your Gemini API Key.";
    }

    return { 
      text: errorMessage, 
      type: MessageType.TEXT 
    };
  }
};