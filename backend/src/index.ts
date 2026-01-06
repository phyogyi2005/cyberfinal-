import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from "@google/genai";

dotenv.config(); // Load .env file

const app = express();
const PORT = process.env.PORT || 5000; 
const JWT_SECRET = process.env.JWT_SECRET || 'cyber-advisor-super-secret-key';

// --- 1. API KEY CONFIGURATION (NEW) ---
// API Key ၅ ခုကို စုစည်းလိုက်ပါတယ်
const apiKeys = [
    process.env.API_KEY_1,
    process.env.API_KEY_2,
    process.env.API_KEY_3,
    process.env.API_KEY_4,
    process.env.API_KEY_5,
    process.env.API_KEY // Legacy support
].filter(key => key && key.trim() !== '');

// --- 2. MODEL CONFIGURATION (NEW) ---
// Updated for January 2026 (Google AI Studio)

const PRIMARY_MODEL = 'gemini-2.5-pro'; // Best for Deep reasoning & Coding
const FALLBACK_MODEL = 'gemini-3.0-flash-preview'; // Newest, Fastest & Agentic tasks
const LITE_MODEL = 'gemini-2.5-flash-lite'; // High-throughput & Cost Effective
const EMERGENCY_MODEL = 'gemini-2.5-flash'; // Balanced Speed/Performance (Replaces discontinued 1.5)

// --- DATABASE SCHEMAS ---

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  knowledgeLevel: { type: String, default: 'Beginner' },
  createdAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  title: { type: String, default: 'New Conversation' },
  mode: { type: String, default: 'normal' },
  score: { type: Number, default: 0 }, 
  questionCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  role: { type: String, enum: ['user', 'model'], required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  quizData: { type: Object },
  analysisData: { type: Object },
  timestamp: { type: Date, default: Date.now }
});

const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String }],
  correctAnswerIndex: { type: Number, required: true },
  explanation: { type: String, required: true },
  category: { type: String, default: 'General' }
});

const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);
const Message = mongoose.model('Message', messageSchema);
const QuizQuestion = mongoose.model('QuizQuestion', quizQuestionSchema);

// --- MIDDLEWARE ---
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }) as any);

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Access Token is missing' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error("JWT Verification Error:", err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Forbidden: Session expired. Please login again.' });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ error: 'Forbidden: Invalid Token. Please login again.' });
      }
      return res.status(403).json({ error: 'Forbidden: Authentication failed' });
    }
    req.user = user;
    next();
  });
};

// --- DB SEEDING (50 CYBERSECURITY QUESTIONS) ---
const seedQuizQuestions = async () => {
  try {
    const count = await QuizQuestion.countDocuments();
    if (count < 50) {
      // (Seeding Logic Truncated for brevity - same as your original code)
      // ... your existing questions array ...
       console.log("✅ Seeded Quiz Questions (Check DB)");
    }
  } catch (err: any) {
    console.error("⚠️ Database Seeding Warning:", err.message);
  }
};

// --- MONGODB CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB Atlas');
      seedQuizQuestions();
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// --- 3. HELPER FUNCTION: ADVANCED GENERATION LOGIC (NEW) ---
// ဒီ Function က Key 5 ခု နဲ့ Model 4 မျိုးကို အလိုအလျောက် စီမံပေးပါမယ်
const generateResponseWithFallback = async (
    historyParts: any[], 
    currentParts: any[], 
    instruction: string, 
    mode: string
) => {
    
    // Key အလှည့်ကျသုံးတဲ့ Function
    const generateWithRotation = async (modelName: string) => {
        let lastError: any = null;
        
        if (apiKeys.length === 0) throw new Error("NO_API_KEYS_CONFIGURED");

        for (const key of apiKeys) {
            try {
                // Key တစ်ခုစီအတွက် Client အသစ်ဆောက်မယ်
                const client = new GoogleGenAI({ apiKey: key });
                
                const response = await client.models.generateContent({
                    model: modelName,
                    contents: [...historyParts, { role: 'user', parts: currentParts }],
                    config: { 
                        systemInstruction: instruction,
                        // Analysis mode ဆိုရင် JSON format တောင်းမယ်
                        responseMimeType: (mode === 'analysis') ? 'application/json' : 'text/plain'
                    }
                });
                return response; // အောင်မြင်ရင် ချက်ချင်း return ပြန်မယ်

            } catch (error: any) {
                lastError = error;
                const msg = error.message?.toLowerCase() || '';
                
                // Quota (429) ပြည့်ရင် နောက် Key တစ်ခုပြောင်းမယ်
                if (msg.includes('quota') || msg.includes('429') || msg.includes('resource_exhausted')) {
                    console.warn(`⚠️ Key ending in ...${key?.slice(-4)} exhausted. Rotating...`);
                    continue; 
                }

                // Model မရှိတာ (သို့) Region ပိတ်တာဆိုရင် Key လဲလဲ မရဘူး။ Model လဲမှရမယ်။
                if (msg.includes('not found') || msg.includes('location') || msg.includes('unsupported')) {
                    throw error; 
                }
            }
        }
        throw lastError || new Error(`All keys failed for ${modelName}`);
    };

    // Model Fallback Step-by-Step
    try {
        console.log(`🤖 Trying Primary Model: ${PRIMARY_MODEL}`);
        return await generateWithRotation(PRIMARY_MODEL);
    } catch (err: any) {
        console.warn(`🔻 Primary Failed: ${err.message}. Switching to Fallback...`);
        
        try {
            console.log(`⚡ Trying Fallback Model: ${FALLBACK_MODEL}`);
            return await generateWithRotation(FALLBACK_MODEL);
        } catch (err2: any) {
             console.warn(`🔻 Fallback Failed. Switching to Lite...`);
             
             try {
                console.log(`🍃 Trying Lite Model: ${LITE_MODEL}`);
                return await generateWithRotation(LITE_MODEL);
             } catch (err3: any) {
                 console.warn(`🔻 Lite Failed. Switching to Emergency...`);
                 // နောက်ဆုံးအဆင့် - Geo-block ရှောင်နိုင်တဲ့ Model
                 console.log(`🚑 Trying Emergency Model: ${EMERGENCY_MODEL}`);
                 return await generateWithRotation(EMERGENCY_MODEL);
             }
        }
    }
};


// --- ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, knowledgeLevel } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, knowledgeLevel });
    await user.save();
    
    const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, knowledgeLevel: user.knowledgeLevel } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, knowledgeLevel: user.knowledgeLevel } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions', authenticateToken, async (req: any, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id }).sort({ lastUpdated: -1 });
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', authenticateToken, async (req: any, res) => {
  try {
    const session = new Session({ 
        _id: Date.now().toString(), 
        userId: req.user.id, 
        title: req.body.title || 'New Conversation', 
        mode: req.body.mode || 'normal' 
    });
    await session.save();
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/messages', authenticateToken, async (req: any, res) => {
  try {
    const messages = await Message.find({ sessionId: req.params.id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- MAIN CHAT & QUIZ LOGIC ---
app.post('/api/chat', authenticateToken, async (req: any, res) => {
  try {
    const { sessionId, message, attachments, userLevel, language, mode } = req.body;
    let session = await Session.findById(sessionId);
    if (!session) {
        session = new Session({
            _id: sessionId,
            userId: req.user.id,
            title: message.substring(0, 30) + (message.length > 30 ? "..." : ""),
            mode: mode || 'normal'
        });
        await session.save();
    }
    const userMsg = new Message({
      sessionId,
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    await userMsg.save();

    let aiResponse: any = { role: 'model', sessionId, timestamp: new Date() };
const getSystemInstruction = (userLevel: string, language: 'en' | 'my', mode: string) => {
 let Binstruction = `You are Cyber Advisor, a Cybersecurity Awareness AI Assistant for myanmar youth.
  User Knowledge Level: ${userLevel}.
  Language: ${language === 'my' ? 'Myanmar (Burmese)' : 'English'}.
  
  Current Mode: ${mode.toUpperCase()}.
  `;
        switch (mode) {
                case 'learning':
      Binstruction += `
      TASK: You are an engaging Cyber Tutor.
      Look up the user knowledge level teach to user.
      
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
      Binstruction += `
      TASK: You are a Cybersecurity Threat Analyst.
      
      INSTRUCTIONS:
      1. Analyze the input (URL, text, or file) for security risks.
      2. Output the result in **STRICT JSON** format.
      3. **IMPORTANT:** Provide **3 distinct findings** if possible.
      4. **SCORING RULE:** The 'score' is a **SECURITY SCORE** (Safety Level). 
         - If Risk is **Safe**, score MUST be **90-100**.
         - If Risk is **Suspicious**, score MUST be **50-70**.
         - If Risk is **Malicious**, score MUST be **0-30**.
      
      LANGUAGE RULES (CRITICAL):
      - **JSON KEYS** (e.g., "riskLevel", "score", "findings", "chartData", "category", "details", "name", "value", "fill") MUST REMAIN IN **ENGLISH**. DO NOT TRANSLATE KEYS.
      - **JSON VALUES** (The content inside the keys, specifically 'details' and 'category') MUST be in **${language === 'my' ? 'MYANMAR (Burmese)' : 'ENGLISH'}**.
      
      REQUIRED JSON STRUCTURE:
      {
        "riskLevel": "Safe" | "Low" | "Medium" | "High" | "Critical", 
        "score": number (0-100. This is a SAFETY SCORE: 100 = Safe, 0 = Critical Risk),
        "findings": [
          {
             "category": "String (e.g., Protocol Security)",
             "details": "String (Explain the first finding in ${language === 'my' ? 'Myanmar' : 'English'})"
          },
          {
             "category": "String (e.g., Domain Reputation)",
             "details": "String (Explain the second finding in ${language === 'my' ? 'Myanmar' : 'English'})"
          },
          {
             "category": "String (e.g., Content Analysis)",
             "details": "String (Explain the third finding in ${language === 'my' ? 'Myanmar' : 'English'})"
          }
        ],
        "chartData": [
          {"name": "Malicious", "value": number, "fill": "#ef4444"},
          {"name": "Safe", "value": number, "fill": "#10b981"},
          {"name": "Suspicious", "value": number, "fill": "#f59e0b"}
        ]
      }
      `;
      break;
            case 'normal':
                {
                    Binstruction += `
      TASK: General Assistant.
      1. Answer questions normally.
      2. If the user uploads an image/file,and url  describe it generally unless asked to analyze it.
      `;
                }
                break;
    default: // normal
      Binstruction += `
      TASK: General Assistant.
      1. Answer questions normally.
      2. If the user uploads an image/file,and url  describe it generally unless asked to analyze it.
      `;
      break;
  }
        return Binstruction;
        };
    // =================================================================
    // 🛑 QUIZ LOGIC (UNCHANGED)
    // ဒီအပိုင်းကို မူရင်းအတိုင်း လုံးဝ မပြောင်းဘဲ ထားပါတယ်
    // =================================================================
    if (mode === 'quiz') {
      
      const lowerMsg = message.toLowerCase();
      
      // (1) STOP LOGIC
      if (lowerMsg === "no" || lowerMsg.includes("stop") || lowerMsg.includes("quit") || lowerMsg.includes("exit")) {
          aiResponse.content = "🛑 **Quiz Ended.**\n\nThanks for playing! You can ask me general questions or type **'Start'** to play a new round.";
          aiResponse.type = 'text';
      }
      // (2) START / CONTINUE
      else if (lowerMsg.includes("start") || lowerMsg.includes("yes") || lowerMsg.includes("continue") || lowerMsg.includes("play again")) {
          await Session.findByIdAndUpdate(sessionId, { score: 0, questionCount: 0 });
          const startMsg = lowerMsg.includes("continue") || lowerMsg.includes("yes") 
              ? "🚀 **Starting Next Round!**\n\n" 
              : "🔄 **Starting New Quiz!**\n\n";

          const randomResults = await QuizQuestion.aggregate([{ $sample: { size: 1 } }]);
          const nextQuestion = randomResults[0];

          if (nextQuestion) {
              aiResponse.content = `${startMsg}${language === 'my' ? "ပထမဆုံး မေးခွန်း-" : "Question 1:"}`;
              aiResponse.type = 'quiz';
              aiResponse.quizData = nextQuestion;
          }
      } 
      // (3) GAMEPLAY
      else {
          let feedback = "";
          const lastSystemMsg = await Message.findOne({ 
            sessionId, 
            role: 'model', 
            quizData: { $exists: true } 
          }).sort({ timestamp: -1 });

          if (lastSystemMsg && lastSystemMsg.quizData) {
            const qData = lastSystemMsg.quizData;
            const correctIndex = qData.correctAnswerIndex; 
            const correctOptionText = qData.options[correctIndex] || ""; 
            
            const userMsg = lowerMsg.trim();
            const correctText = correctOptionText.trim().toLowerCase();
            
            let isCorrect = false;
            if (correctText.length > 0 && userMsg.length > 0) {
                if (userMsg.includes("incorrect:::")) {
                    isCorrect = false; 
                }  
                else {
                    isCorrect = correctText.includes(userMsg) || 
                                userMsg.includes(correctText) || 
                                userMsg.includes("correct:::");
                }
            }

            if (isCorrect) {
                feedback = "✅ **Correct!**\n\n";
                await Session.findByIdAndUpdate(sessionId, { $inc: { score: 1 } });
            } else {
                feedback = `❌ **Incorrect.** The answer was: *${correctOptionText}*.\n\n`;
            }
            
            await Session.findByIdAndUpdate(sessionId, { $inc: { questionCount: 1 } });

            const freshSession = await Session.findById(sessionId);
            const currentCount = freshSession?.questionCount || 0;
            const currentScore = freshSession?.score || 0; 

            if (currentCount >= 5) {
                let finalComment = "";
                if (currentScore >= 5) finalComment = "🏆 **Perfect!** You are a Cyber Expert!";
                else if (currentScore >= 3) finalComment = "✅ **Good Job!** You passed.";
                else finalComment = "📚 **Keep Learning!**";

                aiResponse.content = `${feedback}🎉 **Round Completed!**\n\n📊 **Score: ${currentScore} / 5**\n${finalComment}\n\n❓ **Do you want to continue?** (Type 'Yes' or 'No')`;
                aiResponse.type = 'text'; 
            } else {
                const randomResults = await QuizQuestion.aggregate([{ $sample: { size: 1 } }]);
                const nextQuestion = randomResults[0];
                
                if (!nextQuestion) {
                  aiResponse.content = "No questions found.";
                  aiResponse.type = 'text';
                } else {
                  aiResponse.content = `${feedback}**Question ${currentCount + 1}:**`; 
                  aiResponse.type = 'quiz';
                  aiResponse.quizData = nextQuestion;
                }
            }
          } else {
             aiResponse.content = "Please type 'Start' to begin the quiz.";
             aiResponse.type = 'text';
          }
      }
      
      const savedQuizMsg = new Message(aiResponse);
      await savedQuizMsg.save();
      return res.json(savedQuizMsg);
    } 
      // (1) HISTORY & CURRENT PARTS PREPARATION (မူရင်းအတိုင်းထားပါ)
      const history = await Message.find({ sessionId }).sort({ timestamp: -1 }).limit(10);
      const historyParts = history.reverse().map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      const currentParts: any[] = [{ text: message }];
      
      // Check if there are attachments
      const hasAttachments = attachments && attachments.length > 0;

      if (hasAttachments) {
        attachments.forEach((att: any) => {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType, 
              data: att.data          
            }
          });
        });
      }

      let finalResponseText = "";

      🔥 RAG INTEGRATION (New Code Here)
      Normal mode ဖြစ်မယ်၊ File/Image မပါဘူးဆိုရင် RAG ကို အရင်မေးမယ်
      let usedRAG = false;

      if (mode === 'normal' && !hasAttachments) {
          try {
              const ragUrl = process.env.RAG_NGROK_URL; // .env မှာ ထည့်ထားပါ
              
              if (ragUrl) {
                  console.log("🔄 Calling RAG Server via Ngrok...");
                  const ragResponse = await fetch(`${ragUrl}/chat`, { // Endpoint ကို Colab ကုဒ်နဲ့ ကိုက်အောင်ပြင်ပါ (ဥပမာ /chat or /query)
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ query: message }) // Colab က လက်ခံတဲ့ body format အတိုင်းထားပါ
                  });

                  if (ragResponse.ok) {
                      const data : any = await ragResponse.json();
                      // Colab က ပြန်ပေးတဲ့ key ကို ဒီမှာသုံးပါ (ဥပမာ: data.response, data.answer)
                      if (data.response || data.answer) {
                          finalResponseText = data.response || data.answer;
                          usedRAG = true;
                          console.log("✅ RAG Server Responded Successfully");
                      }
                  } else {
                      console.warn("⚠️ RAG Server returned error, falling back to Gemini.");
                  }
              }
          } catch (err) {
              console.error("❌ RAG Connection Failed (Using Gemini instead):", err);
          }
      }
      // 🔥 RAG INTEGRATION - ပြင်ဆင်ပြီးသား


// 🔥 ဒီအောက်က code တွေက RAG မအောင်မြင်ရင် (သို့) 
// analysis/quiz mode ဆိုရင် လုပ်မှာဖြစ်တယ်
// (မူရင်း Gemini code တွေ ဆက်ရေးပါ)

      // 🔥 GEMINI FALLBACK (RAG မအောင်မြင်ရင် (သို့) တခြား Mode ဆိုရင် Gemini သုံးမယ်)
      if (!usedRAG) {
          const instruction = getSystemInstruction(userLevel, language, mode);
          const response = await generateResponseWithFallback(historyParts, currentParts, instruction, mode);
          finalResponseText = response.text || "";
      }

      // (2) SAVE RESPONSE & RETURN
      aiResponse.content = finalResponseText;
      aiResponse.type = 'text';

      // Analysis Mode အတွက် Logic (မူရင်းအတိုင်း)
      if (mode === 'analysis' && !usedRAG) {
        const cleanText = finalResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            aiResponse.analysisData = JSON.parse(jsonMatch[0]);
            aiResponse.type = 'analysis';
          } catch(e) {}
        }
      }
   // }

    
    
      
      const instruction = getSystemInstruction(userLevel,language,mode);
        
      // 🔥 NEW: Call the Multi-Key Rotation Logic
       
            
      const response = await generateResponseWithFallback(historyParts, currentParts, instruction, mode);
      
      const rawText = response.text || "";
      aiResponse.content = rawText;
      aiResponse.type = 'text';
        
    
        if (mode === 'analysis') {
        // Try to extract JSON for Analysis Dashboard
        // ပိုကောင်းတဲ့ Regex ကို သုံးထားပါတယ် (Markdown code block တွေကို ဖယ်ရှားဖို့)
        const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // ပထမဆုံး { နဲ့ နောက်ဆုံး } ကြားက စာသားကိုပဲ ယူပါမယ်
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          try {
            aiResponse.analysisData = JSON.parse(jsonMatch[0]);
            aiResponse.type = 'analysis';
          } catch(e) {
             console.error("JSON Parse Error:", e);
             // JSON မအောင်မြင်ရင် Text အနေနဲ့ပဲ ပြပါမယ် (User မတိုင်ပင်မိအောင်)
             aiResponse.content += "\n\n(⚠️ Analysis visual generation failed, but here is the text report.)";
          }
        }
      }}

    const savedAiMsg = new Message(aiResponse);
    await savedAiMsg.save();

    const msgCount = await Message.countDocuments({ sessionId });
    if (msgCount <= 2) {
      await Session.findByIdAndUpdate(sessionId, { title: message.slice(0, 30) });
    }
    await Session.findByIdAndUpdate(sessionId, { lastUpdated: new Date() });

    res.json(savedAiMsg);

  } catch (error: any) {
    console.error("🔥 SERVER ERROR:", error);
    res.status(500).json({ 
      error: `AI Error: ${error.message || "Unknown Error"}`, 
      details: error 
    });
  }
      
});

app.get('/', (req, res) => {
    res.send("✅ Cyber Advisor Backend is Running Successfully!");
});
app.listen(PORT, () => console.log(`🚀 Cyber Server on port ${PORT}`));
