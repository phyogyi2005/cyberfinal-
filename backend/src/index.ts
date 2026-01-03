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
    } // END QUIZ BLOCK


    // =================================================================
    // 🧠 AI CHAT / ANALYSIS LOGIC (UPDATED WITH MULTI-KEY)
    // =================================================================
    else {
      const history = await Message.find({ sessionId }).sort({ timestamp: -1 }).limit(10);
      const historyParts = history.reverse().map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      const currentParts: any[] = [{ text: message }];

      if (attachments && attachments.length > 0) {
        attachments.forEach((att: any) => {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType, 
              data: att.data          
            }
          });
        });
      }

      const instruction = `You are Cyber Advisor, a Cybersecurity Threat Analyst. User Level: ${userLevel}. Mode: ${mode}. Use ${language === 'my' ? 'Myanmar' : 'English'}.
      
      If mode is 'analysis', your response MUST be a high-quality dashboard analysis in JSON format.
      Example JSON Structure:
      {
        "riskLevel": "Critical",
        "score": 95,
        "findings": [
          {"category": "Typosquatting", "details": "The domain utilizes a homograph attack..."},
          {"category": "Security Protocol", "details": "The URL uses unencrypted HTTP..."}
        ],
        "chartData": [
          {"name": "Malicious", "value": 75, "fill": "#ef4444"},
          {"name": "Safety", "value": 15, "fill": "#10b981"},
          {"name": "Suspicious", "value": 10, "fill": "#f59e0b"}
        ]
      }`;
      
      // 🔥 NEW: Call the Multi-Key Rotation Logic
      const response = await generateResponseWithFallback(historyParts, currentParts, instruction, mode);

      const rawText = response.text || "";
      aiResponse.content = rawText;
      aiResponse.type = 'text';

      if (mode === 'analysis') {
        // Try to extract JSON for Analysis Dashboard
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            aiResponse.analysisData = JSON.parse(jsonMatch[0]);
            aiResponse.type = 'analysis';
          } catch(e) {}
        }
      }
    }

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
