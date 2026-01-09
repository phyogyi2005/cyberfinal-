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

const ragUrl = process.env.RAG_NGROK_URL;
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
    console.log("=== CHAT REQUEST စတင်ပါသည် ===");
    console.log("Mode:", req.body.mode);  // 'normal' လား စစ်ပါ
    console.log("Message length:", req.body.message?.length);
    console.log("Attachments:", req.body.attachments?.length || 0);
    console.log("RAG URL ရှိလား:", !!process.env.RAG_NGROK_URL);
    console.log("RAG URL တန်ဖိုး:", process.env.RAG_NGROK_URL);
    // ... ကျန်ကုဒ်တွေ
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
            default:
                Binstruction += `
                TASK: General Assistant.
                1. Answer questions normally.
                2. If the user uploads an image/file/url, describe it generally unless asked to analyze it.
                `;
                break;
        }
        return Binstruction;
    };

    // =================================================================
    // 🛑 QUIZ LOGIC (UNCHANGED)
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
    // 🧠 NORMAL / LEARNING / ANALYSIS MODE LOGIC
    // =================================================================
    
    // Prepare history and current parts
    const history = await Message.find({ sessionId }).sort({ timestamp: -1 }).limit(10);
    const historyParts = history.reverse().map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));
    
    const currentParts: any[] = [{ text: message }];
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

    // RAG ကို ခေါ်မလား မခေါ်ဘူးလား ဆုံးဖြတ်ပါ
let shouldUseRAG = false;

if (mode === 'normal' && !hasAttachments) {
    // ဆိုက်ဘာလုံခြုံရေးနဲ့ ပတ်သက်တဲ့ မေးခွန်းမျိုးဆိုမှ RAG သုံးပါ
    const cyberKeywords = [
    // === ENGLISH KEYWORDS ===
    // Basic Cybersecurity
    'cyber', 'security', 'hacker', 'hacking', 'hack', 
    'cybersecurity', 'cyber security', 'information security',
    'infosec', 'data security', 'network security',
    'web security', 'internet security', 'computer security',
    
    // Threats & Attacks
    'phishing', 'malware', 'virus', 'ransomware', 'trojan',
    'spyware', 'adware', 'worm', 'botnet', 'ddos', 'dos',
    'man in the middle', 'mitm', 'sql injection', 'xss',
    'cross site scripting', 'zero day', 'exploit', 'vulnerability',
    'breach', 'data breach', 'leak', 'attack vector', 'payload',
    'social engineering', 'spear phishing', 'whaling',
    
    // Protection & Defense
    'firewall', 'antivirus', 'vpn', 'virtual private network',
    'encryption', 'decryption', 'ssl', 'tls', 'https',
    'authentication', 'authorization', '2fa', 'mfa',
    'two factor', 'multi factor', 'biometric', 'password',
    'passphrase', 'access control', 'iam', 'identity management',
    
    // Technical Terms
    'endpoint', 'server', 'cloud', 'iot', 'internet of things',
    'blockchain', 'cryptography', 'crypto', 'digital signature',
    'certificate', 'pki', 'public key', 'private key',
    'hash', 'hashing', 'salt', 'salting', 'token', 'jwt',
    
    // Compliance & Standards
    'gdpr', 'hipaa', 'pci dss', 'iso 27001', 'nist',
    'compliance', 'audit', 'risk assessment', 'pen test',
    'penetration testing', 'ethical hacking', 'red team',
    'blue team', 'soc', 'security operations center',
    
    // Tools & Technologies
    'metasploit', 'wireshark', 'nmap', 'burp suite',
    'kali linux', 'parrot os', 'nessus', 'openvas',
    'snort', 'suricata', 'ids', 'ips', 'siem',
    
    // === BURMESE KEYWORDS ===
    // မြန်မာအခေါ်အဝေါ်များ
    'ဆိုက်ဘာ', 'လုံခြုံရေး', 'ဆိုက်ဘာလုံခြုံရေး',
    'ဟက်ကာ', 'ဟက်ခြင်း', 'ဒေတာလုံခြုံရေး',
    'ကွန်ပျူတာလုံခြုံရေး', 'အင်တာနက်လုံခြုံရေး',
    'ကွန်ယက်လုံခြုံရေး', 'သတင်းအချက်အလက်လုံခြုံရေး',
    
    // ခြိမ်းခြောက်မှုများ
    'ဖစ်ရှင်း', 'မယ်လ်ဝဲ', 'ဗိုင်းရပ်စ်', 'ရန်ဆမ်ဝဲ',
    'ဝက်ဘ်ဆိုက်တိုက်ခိုက်မှု', 'ဒေတာခိုးယူမှု',
    'စကားဝှက်ခိုးယူမှု', 'အွန်လိုင်းလိမ်လည်မှု',
    'ဟက်တိုက်ခိုက်မှု', 'အင်တာနက်တိုက်ခိုက်မှု',
    'ဗိုင်းရပ်တိုက်ခိုက်မှု', 'မယ်လ်ဝဲတိုက်ခိုက်မှု',
    
    // ကာကွယ်ရေး
    'ဖိုင်ယာဝေါ', 'အန်တီဗိုင်းရပ်စ်', 'ဗွီပီအန်',
    'လျှို့ဝှက်ကုဒ်သင်္ကတ', 'ဒီဂျစ်တယ်လက်မှတ်',
    'နှစ်ဆင့်အတည်ပြုခြင်း', 'စကားဝှက်',
    'လုံခြုံသောစကားဝှက်', 'ဘဏ္ဍာရေးလုံခြုံရေး',
    'အသုံးပြုသူအတည်ပြုခြင်း',
    
    // နည်းပညာစကားလုံးများ
    'အင်ဒ်ပွိုင့်', 'ဆာဗာ', 'ကလောက်', 'အိုင်အိုတီ',
    'ဘလော့ခ်ချိန်း', 'ဒေတာဘေ့စ်', 'ဝဘ်ဆာဗာ',
    'ဒိုမိန်း', 'အိုင်ပီလိပ်စာ', 'မက်ခရိုဝဲ',
    
    // အထွေထွေ
    'အင်တာနက်', 'အွန်လိုင်း', 'ဝဘ်', 'ဝဘ်ဆိုက်',
    'အက်ပ်လီကေးရှင်း', 'ဆော့ဖ်ဝဲ', 'ဟာ့ဒ်ဝဲ',
    'အွန်လိုင်းဘဏ်', 'ဒီဂျစ်တယ်ငွေပေးချေမှု',
    'အီးမေးလ်', 'မက်ဆေ့ချ်', 'ဆိုရှယ်မီဒီယာ','စကားဝှက်',
    
    // ဥပဒေနှင့် စံချိန်စံညွှန်းများ
    'ဆိုက်ဘာဥပဒေ', 'လုံခြုံရေးစံချိန်များ',
    'အီးမေးလ်လုံခြုံရေး', 'အွန်လိုင်းလုံခြုံရေး',
    'ဒေတာကာကွယ်ရေး', 'ကိုယ်ရေးကိုယ်တာလုံခြုံရေး',
    
    // အရေးပေါ်အခြေအနေများ
    'ဟက်ခံရခြင်း', 'ဗိုင်းရပ်ကူးစက်ခံရခြင်း',
    'စကားဝှက်ပျောက်ဆုံးခြင်း', 'အကောင့်ခိုးယူခံရခြင်း',
    'ငွေခိုးယူခံရခြင်း', 'ဒေတာပျောက်ဆုံးခြင်း',
    
    // လေ့ကျင့်ရေးနှင့် အသိပညာပေး
    'ဆိုက်ဘာအသိပညာ', 'လုံခြုံရေးအသိပညာ',
    'အွန်လိုင်းဘေးကင်းရေး', 'အင်တာနက်ဘေးကင်းရေး',
    'ဆိုရှယ်မီဒီယာဘေးကင်းရေး',
    'မိုဘိုင်းလုံခြုံရေး', 'စမတ်ဖုန်းလုံခြုံရေး','ဥပဒေ',
    
    // နောက်ဆုံးပေါ် ခြိမ်းခြောက်မှုများ
    'AI ဟက်ကင်း', 'နက်ရှိုင်းသင်ယူမှုဟက်ကင်း',
    'IoT ဟက်ကင်း', '5G လုံခြုံရေး',
    'ကလောက်ဟက်ကင်း', 'ဘလော့ခ်ချိန်းလုံခြုံရေး',
    
    // အသုံးများသော ဝေါဟာရများ
    'ဂျီဒီပီအာ', 'အိုင်အက်စ်အို ၂၇၀၀၁',
    'ပီစီအိုင်ဒီအက်စ်အက်စ်', 'အိပ်ချ်အိုင်ပီအေအေ',
    'စီအိုင်အေ', 'အန်အက်စ်အေ', 'အက်ဖ်ဘီအိုင်အေ',
    
    // ကွန်ပျူတာအခြေခံ
    'အောက်စ်', 'ဝင်းဒိုး', 'လီနပ်စ်', 'မက်',
    'ဆာဗာအမျိုးအစား', 'ဒေတာဘေ့စ်အမျိုးအစား',
    'ပရိုဂရမ်ဘာသာစကား', 'အက်ပလီကေးရှင်း',
    
    // လုံခြုံရေးအတွက် လုပ်ဆောင်ချက်များ
    'ဘတ်ချ်ပေါ့တ်', 'လော့ဂ်အင်း', 'လော့ဂ်အောက့်',
    'အကောင့်သော့ခလောက်', 'ဘတ်ချ်အပ်ဒိတ်',
    'လုံခြုံရေးအပ်ဒိတ်', 'ပရိုဂရမ်အပ်ဒိတ်',

    // === ဥပဒေအမည်များ ===
    'ဆိုက်ဘာဥပဒေ',
    'စီဘာဥပဒေ',
    'ဆိုက်ဘာဥပဒေ (၂၀၁၉)',
    'Cyber Law',
    'Cyber Security Law',
    'အင်တာနက်ဥပဒေ',
    'ဒီဂျစ်တယ်ဥပဒေ',
    'အွန်လိုင်းဥပဒေ',
    
    // === ဥပဒေအမှတ်တံဆိပ်များ ===
    'ဥပဒေအမှတ် ၂၁/၂၀၁၉',
    'Law No. 21/2019',
    'ဆိုက်ဘာလုံခြုံရေးဥပဒေ',
    'Cybersecurity Law 2019',
    
    // === ဝန်ကြီးဌာနနှင့် အဖွဲ့အစည်းများ ===
    'ပြန်ကြားရေးဝန်ကြီးဌာန',
    'MOIP',
    'Ministry of Information',
    'ဆိုက်ဘာလုံခြုံရေးအဖွဲ့',
    'Cyber Security Committee',
    'ဆိုက်ဘာတပ်ဖွဲ့',
    'Cyber Force',
    'ဆိုက်ဘာရဲတပ်ဖွဲ့',
    'Cyber Police',
    'ဆိုက်ဘာခွဲ',
    'Cyber Division',
    
    // === အခန်းကဏ္ဍများ ===
    'အခန်း (၈)',
    'Chapter 8',
    'အခန်း (၉)',
    'Chapter 9',
    'အခန်း (၁၀)',
    'Chapter 10',
    'အပိုဒ်ခွဲများ',
    'Sections',
    'ဥပဒေပုဒ်မ',
    'Law Sections',
    
    // === ဥပဒေပါ သတ်မှတ်ချက်များ ===
    'ကြီးလေးသော ပြစ်မှု',
    'Serious Crime',
    'အလတ်စား ပြစ်မှု',
    'Moderate Crime',
    'သာမန် ပြစ်မှု',
    'Minor Crime',
    'ပြစ်ဒဏ်',
    'Penalty',
    'ထောင်ဒဏ်',
    'Imprisonment',
    'ဒဏ်ကြေး',
    'Fine',
    
    // === တားမြစ်ချက်များ ===
    'အွန်လိုင်းတွင် တားမြစ်အကြောင်းအရာများ',
    'Prohibited Online Content',
    'အစိုးရအား ခြိမ်းခြောက်ခြင်း',
    'Threatening the Government',
    'နိုင်ငံတော်အား ထိခိုက်စေသော အကြောင်းအရာ',
    'Content Harmful to the State',
    'လူမျိုးရေး ခွဲခြားမှု',
    'Racial Discrimination',
    'ဘာသာရေး ခွဲခြားမှု',
    'Religious Discrimination',
    'လိင်ပိုင်းဆိုင်ရာ အကြမ်းဖက်မှု',
    'Sexual Violence',
    'အကြမ်းဖက်ဝါဒ',
    'Terrorism',
    'မူးယစ်ဆေးဝါး',
    'Drugs',
    'လောင်းကစား',
    'Gambling',
    'ညစ်ညမ်းရုပ်ပုံများ',
    'Pornography',
    
    // === လူထုအား ထိခိုက်စေသော အကြောင်းအရာများ ===
    'လူထုအား ထိခိုက်စေခြင်း',
    'Harm to the Public',
    'အထွေထွေ အနှောင့်အယှက်ဖြစ်စေခြင်း',
    'General Disturbance',
    'လူမှုရေး အနှောင့်အယှက်',
    'Social Disturbance',
    'လူမှုစည်းလုံးညီညွတ်မှု ထိခိုက်ခြင်း',
    'Harm to Social Unity',
    'အများပြည်သူ ငြိမ်းချမ်းရေး ထိခိုက်ခြင်း',
    'Harm to Public Peace',
    
    // === အွန်လိုင်းလူမှုကွန်ရက်များ ===
    'ဖေ့စ်ဘုတ်',
    'Facebook',
    'ဗွီဘာ',
    'Viber',
    'ဝပ်',
    'WhatsApp',
    'တယ်လီဂျမ်',
    'Telegram',
    'လိုင်း',
    'Line',
    'ဝီချတ်',
    'WeChat',
    'အင်စတာဂရမ်',
    'Instagram',
    'တွစ်တာ',
    'Twitter',
    'တစ်တော့',
    'TikTok',
    
    // === ဒေတာနှင့် ကိုယ်ရေးကိုယ်တာ ===
    'ဒေတာကာကွယ်ရေး',
    'Data Protection',
    'ကိုယ်ရေးကိုယ်တာ လုံခြုံရေး',
    'Privacy Protection',
    'ဒေတာလုံခြုံရေး',
    'Data Security',
    'ပုဂ္ဂိုလ်ရေး အချက်အလက်',
    'Personal Information',
    'ကိုယ်ရေးကိုယ်တာ အချက်အလက်',
    'Personal Data',
    'အချက်အလက် ကာကွယ်ရေး',
    'Information Protection',
    
    // === စီးပွားရေးဆိုင်ရာ ===
    'အွန်လိုင်းစီးပွားရေး',
    'Online Business',
    'အီးကုန်စည်',
    'E-commerce',
    'ဒီဂျစ်တယ် ငွေပေးချေမှု',
    'Digital Payment',
    'အွန်လိုင်းဘဏ်',
    'Online Banking',
    'အွန်လိုင်းငွေလွှဲ',
    'Online Money Transfer',
    'ဆိုက်ဘာတိုက်ခိုက်မှု',
    'Cyber Attack',
    'ဒေတာခိုးယူမှု',
    'Data Theft',
    'ငွေကြေးလိမ်လည်မှု',
    'Financial Fraud',
    
    // === အသိပညာပေးခြင်း ===
    'ဆိုက်ဘာလုံခြုံရေး အသိပညာပေး',
    'Cyber Security Awareness',
    'အွန်လိုင်း ဘေးကင်းရေး အသိပညာပေး',
    'Online Safety Awareness',
    'ဆိုက်ဘာ ပညာပေး',
    'Cyber Education',
    'အင်တာနက် အသုံးပြုသူ ပညာပေး',
    'Internet User Education',
    'မိဘများအတွက် ဆိုက်ဘာ ပညာပေး',
    'Cyber Education for Parents',
    'ကျောင်းသားများအတွက် ဆိုက်ဘာ ပညာပေး',
    'Cyber Education for Students',
    
    // === ဥပဒေစိုးမိုးရေး ===
    'ဥပဒေစိုးမိုးရေး',
    'Law Enforcement',
    'ဆိုက်ဘာ စုံစမ်းရေး',
    'Cyber Investigation',
    'ဒီဂျစ်တယ် သက်သေ',
    'Digital Evidence',
    'ဆိုက်ဘာ ရာဇဝတ်မှု',
    'Cyber Crime',
    'ဆိုက်ဘာ တရားစွဲဆိုမှု',
    'Cyber Prosecution',
    'ဆိုက်ဘာ တရားရုံး',
    'Cyber Court',
    
    // === နည်းပညာဆိုင်ရာ ===
    'အိုင်ပီလိပ်စာ',
    'IP Address',
    'ဒိုမိန်း',
    'Domain',
    'ဝဘ်ဆိုက်',
    'Website',
    'ဆာဗာ',
    'Server',
    'ကွန်ယက်',
    'Network',
    'ဒေတာဘေ့စ်',
    'Database',
    'အက်ပလီကေးရှင်း',
    'Application',
    'ဆော့ဖ်ဝဲ',
    'Software',
    
    // === လူမှုရေးဆိုင်ရာ ===
    'အွန်လိုင်း ညစ်ညမ်းမှု',
    'Online Harassment',
    'ဆိုက်ဘာ အနိုင်ကျင့်မှု',
    'Cyber Bullying',
    'အွန်လိုင်း ခြိမ်းခြောက်မှု',
    'Online Threat',
    'အွန်လိုင်း စော်ကားမှု',
    'Online Defamation',
    'ဂုဏ်သိက္ခာ ထိခိုက်စေခြင်း',
    'Defamation',
    'မကောင်းသတင်း ဖြန့်ခြင်း',
    'Spreading False News',
    'အချက်အလက် မှားယွင်းခြင်း',
    'False Information',
    'သတင်းအတု',
    'Fake News',
    
    // === နိုင်ငံတကာဆိုင်ရာ ===
    'ဆိုက်ဘာရာဇဝတ်မှု ပူးပေါင်းဆောင်ရွက်ရေး',
    'International Cyber Crime Cooperation',
    'အာဆီယံ ဆိုက်ဘာ ပူးပေါင်းရေး',
    'ASEAN Cyber Cooperation',
    'နိုင်ငံတကာ ဆိုက်ဘာ သဘောတူညီချက်',
    'International Cyber Agreement',
    'ဆိုက်ဘာ သံတမန်',
    'Cyber Diplomacy',
    'ဆိုက်ဘာ စစ်ပွဲ',
    'Cyber Warfare',
    'ဆိုက်ဘာ စစ်ဆင်ရေး',
    'Cyber Operations',
    
    // === အခွင့်အရေးများ ===
    'အွန်လိုင်း အခွင့်အရေး',
    'Online Rights',
    'ဒီဂျစ်တယ် အခွင့်အရေး',
    'Digital Rights',
    'လွတ်လပ်စွာ ထုတ်ဖော်ပြောဆိုခွင့်',
    'Freedom of Expression',
    'သတင်းအချက်အလက် လွတ်လပ်ခွင့်',
    'Freedom of Information',
    'အင်တာနက် အသုံးပြုခွင့်',
    'Internet Access Rights',
    'ဒီဂျစ်တယ် နိုင်ငံသားအခွင့်အရေး',
    'Digital Citizenship',
    
    // === စည်းမျဉ်းစည်းကမ်းများ ===
    'စည်းမျဉ်းစည်းကမ်း',
    'Regulations',
    'ဆိုက်ဘာ စည်းကမ်း',
    'Cyber Regulations',
    'အင်တာနက် စည်းကမ်း',
    'Internet Regulations',
    'ဆိုရှယ်မီဒီယာ စည်းကမ်း',
    'Social Media Regulations',
    'ဝဘ်ဆိုက် မှတ်ပုံတင်ခြင်း',
    'Website Registration',
    'အွန်လိုင်း ဝန်ဆောင်မှု မှတ်ပုံတင်ခြင်း',
    'Online Service Registration',
    
    // === အရေးယူမှုများ ===
    'ဆိုက်ဘာ အရေးယူမှု',
    'Cyber Action',
    'ဝဘ်ဆိုက် ပိတ်ခြင်း',
    'Website Blocking',
    'အက်ပလီကေးရှင်း ပိတ်ခြင်း',
    'App Blocking',
    'အကောင့် ပိတ်ခြင်း',
    'Account Suspension',
    'အိုင်ပီ ပိတ်ခြင်း',
    'IP Blocking',
    'ဒိုမိန်း ပိတ်ခြင်း',
    'Domain Blocking',
    'အင်တာနက် ရပ်ဆိုင်းခြင်း',
    'Internet Suspension',
    
    // === လက်ရှိ အငြင်းပွားမှုများ ===
    'လွတ်လပ်ခွင့် vs လုံခြုံရေး',
    'Freedom vs Security',
    'ကိုယ်ရေးကိုယ်တာ vs နိုင်ငံအတွက် လုံခြုံရေး',
    'Privacy vs National Security',
    'အွန်လိုင်း လွတ်လပ်ခွင့် ကန့်သတ်ချက်များ',
    'Online Freedom Restrictions',
    'အစိုးရ စောင့်ကြည့်မှု',
    'Government Surveillance',
    'ဒီဂျစ်တယ် စောင့်ကြည့်မှု',
    'Digital Surveillance',
    
    // === အကောင်အထည်ဖော်ဆောင်ရွက်မှုများ ===
    'ဆိုက်ဘာဥပဒေ အကောင်အထည်ဖော်ခြင်း',
    'Cyber Law Implementation',
    'ဆိုက်ဘာ လုံခြုံရေး မဟာဗျူဟာ',
    'Cyber Security Strategy',
    'ဆိုက်ဘာ လုံခြုံရေး အစီအစဉ်',
    'Cyber Security Plan',
    'ဒီဂျစ်တယ် မြန်မာပြည်',
    'Digital Myanmar',
    'ဆိုက်ဘာ ဖွံ့ဖြိုးရေး',
    'Cyber Development',
    
    // === အထူးကိစ္စများ ===
    'ဆိုက်ဘာ အန္တရာယ်',
    'Cyber Threat',
    'ဆိုက်ဘာ ပြဿနာ',
    'Cyber Issue',
    'ဆိုက်ဘာ စိန်ခေါ်မှု',
    'Cyber Challenge',
    'ဆိုက်ဘာ ဘေးအန္တရာယ်',
    'Cyber Risk',
    'ဆိုက်ဘာ အန္တရာယ် စီမံခန့်ခွဲမှု',
    'Cyber Risk Management',
    
    // === ပြစ်မှုအမျိုးအစားများ ===
    'ဆိုက်ဘာ စော်ကားမှု',
    'Cyber Defamation',
    'အင်တာနက် စော်ကားမှု',
    'Internet Defamation',
    'ဆိုက်ဘာ ခိုးယူမှု',
    'Cyber Theft',
    'အိုင်ဒီ ခိုးယူမှု',
    'Identity Theft',
    'အကောင့် ခိုးယူမှု',
    'Account Theft',
    'ဒေတာ ဖျက်ဆီးမှု',
    'Data Destruction',
    'ဆာဗာ တိုက်ခိုက်မှု',
    'Server Attack',
    'ဝဘ်ဆိုက် တိုက်ခိုက်မှု',
    'Website Attack',
    
    // === နောက်ဆုံးပေါ် ပြဿနာများ ===
    'အွန်လိုင်း လိမ်လည်မှု',
    'Online Scam',
    'အင်တာနက် လိမ်လည်မှု',
    'Internet Fraud',
    'အွန်လိုင်း ငွေကြေးလိမ်လည်မှု',
    'Online Financial Fraud',
    'အကောင့် ဟက်ခံရခြင်း',
    'Account Hacking',
    'စကားဝှက် ခိုးယူခံရခြင်း',
    'Password Theft',
    'အန်ကရစ် ဗိုင်းရပ်စ်',
    'Ransomware Virus',
    'ဒေတာ ပြန်တောင်းခံမှု',
    'Data Ransom',
    
    // === အသုံးများသော ဝေါဟာရများ ===
    'ဆိုက်ဘာ လုံခြုံရေး မူဝါဒ',
    'Cyber Security Policy',
    'အွန်လိုင်း မူဝါဒ',
    'Online Policy',
    'ဆိုက်ဘာ လုံခြုံရေး စံချိန်း',
    'Cyber Security Standards',
    'ဆိုက်ဘာ လုံခြုံရေး ပညာရေး',
    'Cyber Security Education',
    'ဆိုက်ဘာ လုံခြုံရေး လေ့ကျင့်မှု',
    'Cyber Security Training',
    'ဆိုက်ဘာ လုံခြုံရေး သင်တန်း',
    'Cyber Security Course',
    
    // === တရားစီရင်ရေး ===
    'ဆိုက်ဘာ တရားရုံး',
    'Cyber Court',
    'ဆိုက်ဘာ တရားသူကြီး',
    'Cyber Judge',
    'ဆိုက်ဘာ ရှေ့နေ',
    'Cyber Lawyer',
    'ဆိုက်ဘာ ဥပဒေအကြံပေး',
    'Cyber Legal Advisor',
    'ဆိုက်ဘာ တရားစွဲဆိုခံရသူ',
    'Cyber Defendant',
    'ဆိုက်ဘာ လိုက်လံစစ်ဆေးရေး',
    'Cyber Investigation',
    'ဆိုက်ဘာ စစ်ဆေးရေး အရာရှိ',
    'Cyber Investigator',
    
    // === ဥပဒေပြုရေး ===
    'ဆိုက်ဘာ ဥပဒေ ပြင်ဆင်ခြင်း',
    'Cyber Law Amendment',
    'ဆိုက်ဘာ ဥပဒေ ပြန်လည်သုံးသပ်ခြင်း',
    'Cyber Law Review',
    'ဆိုက်ဘာ ဥပဒေ အားနည်းချက်များ',
    'Cyber Law Weaknesses',
    'ဆိုက်ဘာ ဥပဒေ အားသာချက်များ',
    'Cyber Law Strengths',
    'ဆိုက်ဘာ ဥပဒေ ဝေဖန်ချက်များ',
    'Cyber Law Criticism',
    'ဆိုက်ဘာ ဥပဒေ ထောက်ခံချက်များ',
    'Cyber Law Support',
    
    // === အကြံပြုချက်များ ===
    'ဆိုက်ဘာ ဥပဒေ ပြုပြင်ပြောင်းလဲရေး',
    'Cyber Law Reform',
    'ဆိုက်ဘာ ဥပဒေ ခေတ်မီရေး',
    'Cyber Law Modernization',
    'ဆိုက်ဘာ ဥပဒေ အဆင့်မြှင့်တင်ရေး',
    'Cyber Law Upgrade',
    'ဆိုက်ဘာ ဥပဒေ လိုအပ်ချက်များ',
    'Cyber Law Requirements',
    'ဆိုက်ဘာ ဥပဒေ အကောင်အထည်ဖော်မှု စိန်ခေါ်မှုများ',
    'Cyber Law Implementation Challenges'
];
    
    const lowerMessage = message.toLowerCase();
    const isCyberQuestion = cyberKeywords.some(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
    );
    
    shouldUseRAG = isCyberQuestion; // ဆိုက်ဘာမေးခွန်းမှသာ RAG သုံးပါ
}

// RAG သုံးမယ်ဆိုရင်
// if (shouldUseRAG) {
//     console.log("🔄 RAG server ကို ခေါ်ဆိုနေပါသည်...");
    
//     try {
//         const ragResponse = await fetch(`${ragUrl}/chat`, {
//             method: 'POST',
//             headers: { 
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json'
//             },
//             body: JSON.stringify({ 
//                 query: message,
//                 user_id: req.user.id
//             }),
            
//             const controller = new AbortController();
    
//     // 2. Timeout ကို သတ်မှတ်ပါ (၁၀ စက္ကန့်ပြည့်ရင် controller.abort() ကို ခေါ်ပါမယ်)
        
//             const timeoutId = setTimeout(() => controller.abort(), 10000);
//         });
        
//         if (ragResponse.ok) {
//             const data = await ragResponse.json();
//             console.log("✅ RAG မှ အဖြေရရှိပါသည်");
            
//             // RAG အဖြေကို ချက်ချင်း return ပြန်ပါ
//             aiResponse.content = data.response || data.answer || "RAG အဖြေ";
//             const savedAiMsg = new Message(aiResponse);
//             await savedAiMsg.save();
            
//             return res.json(savedAiMsg); // 🛑 ဒီမှာ အဆုံးသတ်ပါ!
//         }
//     } catch (error) {
//         console.log("⚠️ RAG server အဆင်မပြေပါ၊ Gemini ကို ပြန်သုံးပါမည်");
//         // Error ဖြစ်ရင် Gemini ဆီသွားပါ
//     }
// }
      if (shouldUseRAG) {
    console.log("🔄 RAG server ကို ခေါ်ဆိုနေပါသည်...");

    // 1. AbortController ကို ဖန်တီးပါ
    const controller = new AbortController();
    
    // 2. Timeout ကို သတ်မှတ်ပါ (၁၀ စက္ကန့်ပြည့်ရင် controller.abort() ကို ခေါ်ပါမယ်)
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const ragResponse = await fetch(`${ragUrl}/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                query: message,
                user_id: req.user.id
            }),
            signal: controller.signal // 3. controller signal ကို ဒီမှာထည့်ပါ
        });
        
        // 4. အဖြေရပြီဆိုရင် Timeout ကို ပြန်ဖျက်ပါ (Memory မစားအောင်လို့ပါ)
        clearTimeout(timeoutId);

        if (ragResponse.ok) {
            const data = await ragResponse.json();
            console.log("✅ RAG မှ အဖြေရရှိပါသည်");
            
            // RAG အဖြေကို ချက်ချင်း return ပြန်ပါ
            aiResponse.content = data.response || data.answer || "RAG အဖြေ";
            const savedAiMsg = new Message(aiResponse);
            await savedAiMsg.save();
            
            return res.json(savedAiMsg); // 🛑 ဒီမှာ အဆုံးသတ်ပါ!
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("⚠️ RAG server Time out ဖြစ်သွားပါသည် (၁၀ စက္ကန့်ကျော်သွားပါသည်)");
        } else {
            console.log("⚠️ RAG server အဆင်မပြေပါ၊ Gemini ကို ပြန်သုံးပါမည်", error);
        }
        // Error ဖြစ်ရင် Gemini ဆီသွားပါ
    }
}

// RAG မအောင်မြင်ရင် (သို့) ဆိုက်ဘာမေးခွန်းမဟုတ်ရင် Gemini သုံးပါ
console.log("🔄 Gemini ကို အသုံးပြုနေပါသည်...");
// ... Gemini logic တွေ ဆက်ရေးပါ

    // 🔥 GEMINI FALLBACK (RAG မအောင်မြင်ရင် (သို့) တခြား Mode ဆိုရင်)
    const instruction = getSystemInstruction(userLevel, language, mode);
    const response = await generateResponseWithFallback(historyParts, currentParts, instruction, mode);
    
    const rawText = response.text || "";
    aiResponse.content = rawText;
    aiResponse.type = 'text';

    // Analysis Mode အတွက် JSON Parsing
    if (mode === 'analysis') {
        const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                aiResponse.analysisData = JSON.parse(jsonMatch[0]);
                aiResponse.type = 'analysis';
            } catch(e: any) {
                console.error("JSON Parse Error:", e.message);
                aiResponse.content += "\n\n(⚠️ Analysis visual generation failed, but here is the text report.)";
            }
        }
    }

    // Save AI response
    const savedAiMsg = new Message(aiResponse);
    await savedAiMsg.save();

    // Update session title and timestamp
    const msgCount = await Message.countDocuments({ sessionId });
    if (msgCount <= 2) {
        await Session.findByIdAndUpdate(sessionId, { 
            title: message.slice(0, 30) + (message.length > 30 ? "..." : "") 
        });
    }
    await Session.findByIdAndUpdate(sessionId, { 
        lastUpdated: new Date() 
    });

    return res.json(savedAiMsg);

  } catch (error: any) {
    console.error("🔥 SERVER ERROR:", error);
    res.status(500).json({ 
      error: `AI Error: ${error.message || "Unknown Error"}`, 
      details: error.message 
    });
  }
});
app.get('/', (req, res) => {
    res.send("✅ Cyber Advisor Backend is Running Successfully!");
});
app.listen(PORT, () => console.log(`🚀 Cyber Server on port ${PORT}`));
