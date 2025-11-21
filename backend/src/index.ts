import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Increase limit for Base64 images sent from frontend
app.use(express.json({ limit: '50mb' }) as any);

// --- CONFIGURATION ---
const REASONING_MODEL = 'gemini-3-pro-preview';
const SPEED_MODEL = 'gemini-2.5-flash';
const LITE_MODEL = 'gemini-2.0-flash-lite-preview-02-05';
const EMERGENCY_MODEL = 'gemini-1.5-flash';

// --- API KEY MANAGEMENT ---
// Backend uses process.env.API_KEY directly
const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.warn("⚠️ Backend Warning: No API_KEY found in .env");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// --- HELPER FUNCTIONS (Moved from Frontend) ---

const getSystemInstruction = (userLevel: string, language: string, mode: string) => {
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
      - ESCAPE ALL control characters inside strings.
      - NO COMMENTS inside JSON.
      - Ensure "options" is an Array of strings.
      - Ensure "correctAnswerIndex" is a number (0-3).
      
      JSON FORMAT:
      \`\`\`json
      {
        "question": "Question text?",
        "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
        "correctAnswerIndex": 0,
        "explanation": "Explanation."
      }
      \`\`\`
      `;
      break;
    case 'learning':
      baseInstruction += `
      TASK: You are an engaging Cyber Tutor.
      STYLE: Numbered Lists, Bold Main Points, Short Paragraphs, Emojis (🚩, 🔒, ✅).
      `;
      break;
    case 'analysis':
      baseInstruction += `
      TASK: You are a Threat Analyst.
      Analyze URLs, IPs, Files, or Images for security risks.
      Output strictly compliant JSON:
      {
        "riskLevel": "Safe" | "Low" | "Medium" | "High" | "Critical",
        "score": number (0-100),
        "findings": [{"category": "string", "details": "string"}],
        "chartData": [{"name": "string", "value": number, "fill": "hexcode"}]
      }
      LANGUAGE INSTRUCTION:
      - If language is 'my' (Burmese), translate values of 'category', 'details', 'riskLevel' to Burmese.
      - Keep JSON keys in English.
      `;
      break;
    default:
      baseInstruction += `TASK: General Assistant. Answer normally.`;
      break;
  }
  return baseInstruction;
};

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data,
      mimeType
    },
  };
};

// --- ROUTES ---

app.get('/', (req, res) => {
  res.json({ message: 'Cyber Advisor Backend is running 🚀' });
});

app.post('/api/chat', async (req, res) => {
  try {
    // Destructure data sent from Frontend
    const { history, message, attachments, userLevel, language, mode } = req.body;

    if (!apiKey) {
      res.status(500).json({ text: "Server Error: Missing API Key configuration on backend.", type: 'text' });
      return;
    }

    // 1. Prepare History for Gemini SDK
    const historyParts = (history || []).map((msg: any) => {
      let text = msg.content;
      if (msg.type === 'analysis' && msg.analysisData) {
        text += `\n\n[System Context: Previous Analysis Data]\n${JSON.stringify(msg.analysisData)}`;
      }
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: text }]
      };
    });

    // 2. Prepare Current Content (Text + Images)
    const currentParts: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((att: any) => {
        currentParts.push(fileToGenerativePart(att.data, att.mimeType));
      });
    }
    currentParts.push({ text: message });

    // 3. Configuration
    let responseMimeType: string | undefined = undefined;
    if (mode === 'analysis' && (currentParts.length > 1 || message.length > 5)) {
      responseMimeType = "application/json";
    }

    const systemInstruction = getSystemInstruction(userLevel, language, mode);

    // 4. Smart Model Selection (Backend Logic)
    // Reasoning Model (Pro) for complex tasks, Speed Model (Flash) for chat
    let modelName = SPEED_MODEL;
    if (mode === 'quiz' || mode === 'analysis') {
      modelName = REASONING_MODEL;
    }

    // 5. Call Google GenAI with Fallback Logic
    let response;
    try {
      // Attempt 1: Selected Model
      response = await ai.models.generateContent({
        model: modelName,
        contents: [...historyParts, { role: 'user', parts: currentParts }],
        config: { systemInstruction, responseMimeType }
      });
    } catch (primaryError: any) {
      console.warn(`Primary model ${modelName} failed: ${primaryError.message}. Switching to fallback.`);
      
      // Attempt 2: Speed Model (if we weren't already using it) or Lite
      let nextModel = (modelName === REASONING_MODEL) ? SPEED_MODEL : LITE_MODEL;
      
      try {
        response = await ai.models.generateContent({
          model: nextModel,
          contents: [...historyParts, { role: 'user', parts: currentParts }],
          config: { systemInstruction, responseMimeType }
        });
      } catch (fallbackError) {
          console.warn(`Fallback model ${nextModel} failed. Switching to Emergency.`);
          // Attempt 3: Emergency Model (Flash 1.5) - Good for Geo-blocks
           response = await ai.models.generateContent({
            model: EMERGENCY_MODEL,
            contents: [...historyParts, { role: 'user', parts: currentParts }],
            config: { systemInstruction, responseMimeType }
          });
      }
    }

    const rawText = response?.text || "";
    let resultType = 'text';
    let resultAnalysis = undefined;
    let resultQuiz = undefined;

    // 6. Output Parsing (Logic moved from Frontend to Backend)
    
    // -- Quiz Parsing --
    if (mode === 'quiz') {
        const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || 
                          rawText.match(/```\s*([\s\S]*?)\s*```/) || 
                          rawText.match(/(\{[\s\S]*"[\w_]*question[\w_]*"[\s\S]*\})/);
        if (jsonMatch) {
            try {
                let jsonStr = jsonMatch[1] || jsonMatch[0];
                jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                const quizData = JSON.parse(jsonStr);
                
                // Normalize Data Structure
                if (!quizData.question && quizData.question_text) quizData.question = quizData.question_text;
                
                if (!Array.isArray(quizData.options)) {
                   const opts: string[] = [];
                   if (typeof quizData.options === 'object' && quizData.options !== null) {
                       Object.values(quizData.options).forEach((v: any) => opts.push(String(v)));
                   }
                   quizData.options = opts;
                }
                
                if (typeof quizData.correctAnswerIndex !== 'number') {
                   quizData.correctAnswerIndex = 0; 
                }

                resultQuiz = quizData;
                resultType = 'quiz';
            } catch(e) {
                console.error("Backend Quiz Parse Error", e);
            }
        }
    }

    // -- Analysis Parsing --
    if (mode === 'analysis') {
        try {
            const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const json = JSON.parse(jsonStr);
            if (json.riskLevel || json.score) {
                resultAnalysis = json;
                resultType = 'analysis';
            }
        } catch(e) {
            console.error("Backend Analysis Parse Error", e);
        }
    }

    // 7. Send Final Response to Frontend
    res.json({
      text: rawText,
      type: resultType,
      analysisData: resultAnalysis,
      quizData: resultQuiz
    });

  } catch (error: any) {
    console.error("Backend API Error:", error);
    res.status(500).json({ 
      text: "Server Error: " + (error.message || "Unknown error"),
      type: 'text'
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});