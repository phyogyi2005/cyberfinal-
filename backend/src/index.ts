
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 5000; 
const JWT_SECRET = process.env.JWT_SECRET || 'cyber-advisor-super-secret-key';
// --- DATABASE SCHEMAS ---

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  knowledgeLevel: { type: String, default: 'Beginner' },
  createdAt: { type: Date, default: Date.now }
});

// const sessionSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   title: { type: String, default: 'New Conversation' },
//   mode: { type: String, default: 'normal' },
//   lastUpdated: { type: Date, default: Date.now }
// });

// index.ts ထဲမှာ sessionSchema အဟောင်းကို ဖျက်ပြီး ဒါကို ထည့်ပါ

const sessionSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // 👈 (၁) အရေးကြီးဆုံး ပြင်ဆင်ချက်
  userId: { type: String, required: true }, // (၂) User ID ကိုလည်း String ပြောင်းလိုက်တာ ပိုစိတ်ချရပါတယ်
  title: { type: String, default: 'New Conversation' },
  mode: { type: String, default: 'normal' },
  lastUpdated: { type: Date, default: Date.now }
});


const messageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  //sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
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

// const authenticateToken = (req: any, res: any, next: any) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (!token) return res.status(401).json({ error: 'Unauthorized' });

//   jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
//     if (err) return res.status(403).json({ error: JWT_SECRET);
//     req.user = user;
//     next();
//   });
// };
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  
  // "Bearer <token>" ပုံစံ ဖြစ်မဖြစ် စစ်ဆေးခြင်း
  const token = authHeader && authHeader.split(' ')[1];

  // (၁) Token လုံးဝ မပါလာလျှင် (401 Unauthorized)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Access Token is missing' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      // Console မှာ Error အစစ်ကို ထုတ်ကြည့်မယ် (Developer အတွက်)
      console.error("JWT Verification Error:", err.name, err.message);

      // (၂) Token သက်တမ်းကုန်သွားလျှင် (Expired)
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Forbidden: Session expired. Please login again.' });
      }

      // (၃) & (၄) Token အတုဖြစ်ခြင်း၊ Secret Key မှားခြင်း၊ ပုံစံမကျခြင်း (Invalid)
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ error: 'Forbidden: Invalid Token. Please login again.' });
      }

      // အခြား Error များ
      return res.status(403).json({ error: 'Forbidden: Authentication failed' });
    }

    // အားလုံး အောင်မြင်လျှင်
    req.user = user;
    next();
  });
};

// --- DB SEEDING (50 CYBERSECURITY QUESTIONS) ---
const seedQuizQuestions = async () => {
  try {
    const count = await QuizQuestion.countDocuments();
    if (count < 50) {
      await QuizQuestion.deleteMany({});
      const questions = [
        { question: "What is the primary purpose of Multi-Factor Authentication (MFA)?", options: ["Faster login", "Layered security", "Longer passwords", "Better UI"], correctAnswerIndex: 1, explanation: "MFA adds layers of security beyond just a password." },
        { question: "What is 'Phishing'?", options: ["Catching fish", "Stealing info via deceptive emails", "Speeding up PCs", "Hardware hacking"], correctAnswerIndex: 1, explanation: "Phishing uses deceptive emails to steal sensitive info." },
        { question: "What does HTTPS stand for?", options: ["Hypertext Transfer Protocol Secure", "High Tech Program System", "Home Transfer Private Site", "None of the above"], correctAnswerIndex: 0, explanation: "The 'S' stands for Secure, indicating encrypted data transfer." },
        { question: "A 'Brute Force' attack targets what?", options: ["The server cooling", "Passwords", "Screen brightness", "The Wi-Fi router"], correctAnswerIndex: 1, explanation: "Brute force attempts every possible password combination." },
        { question: "What is a 'VPN' used for?", options: ["Mining Bitcoin", "Encrypting internet traffic", "Editing videos", "Increasing RAM"], correctAnswerIndex: 1, explanation: "A VPN creates a secure, encrypted tunnel for your data." },
        { question: "Which is a strong password?", options: ["password123", "12345678", "Tr0ub4dor&3", "Admin"], correctAnswerIndex: 2, explanation: "Strong passwords use mixed cases, numbers, and symbols." },
        { question: "What is Social Engineering?", options: ["Building bridges", "Manipulating people for info", "Coding websites", "Designing cities"], correctAnswerIndex: 1, explanation: "It relies on human psychology rather than technical hacks." },
        { question: "What is Malware?", options: ["Good software", "Malicious software", "Expensive hardware", "A type of firewall"], correctAnswerIndex: 1, explanation: "Malware is designed to damage or gain unauthorized access." },
        { question: "What is 'Ransomware'?", options: ["Software that asks for help", "Software that encrypts files for money", "A free tool", "A virus scanner"], correctAnswerIndex: 1, explanation: "Ransomware holds your data hostage until you pay." },
        { question: "What is a 'Firewall'?", options: ["A physical wall", "Network security system", "A fast browser", "An anti-overheat tool"], correctAnswerIndex: 1, explanation: "It monitors and controls incoming/outgoing network traffic." },
        { question: "What is a 'Zero-Day' vulnerability?", options: ["A bug fixed today", "An unpatched software vulnerability", "A very old bug", "A marketing term"], correctAnswerIndex: 1, explanation: "A vulnerability known to hackers but not yet patched by developers." },
        { question: "What does 'DDoS' stand for?", options: ["Distributed Denial of Service", "Double Data on Server", "Digital Download of Software", "Direct Denial of Security"], correctAnswerIndex: 0, explanation: "Overwhelming a target with traffic from many sources." },
        { question: "What is 'Shoulder Surfing'?", options: ["Surfing the web", "Watching someone type their password", "A type of physical exercise", "Hacking via Bluetooth"], correctAnswerIndex: 1, explanation: "Literally looking over someone's shoulder to steal credentials." },
        { question: "Why should you update software?", options: ["To get new icons", "To patch security holes", "To use more disk space", "No reason"], correctAnswerIndex: 1, explanation: "Updates often contain critical security patches." },
        { question: "What is 'Two-Factor Authentication' (2FA)?", options: ["Two passwords", "Password + one more factor", "Two people logging in", "Logging in twice"], correctAnswerIndex: 1, explanation: "Requiring two distinct forms of identification." },
        { question: "What is a 'Trojan Horse'?", options: ["A wooden toy", "Malware disguised as legitimate software", "A fast network cable", "A hardware firewall"], correctAnswerIndex: 1, explanation: "It tricks users into running it by looking safe." },
        { question: "What is 'Smishing'?", options: ["Phishing via SMS", "Phishing via Smells", "Hacking a Smart TV", "Phishing via Email"], correctAnswerIndex: 0, explanation: "Phishing attacks conducted through text messages." },
        { question: "What is 'Vishing'?", options: ["Video Phishing", "Voice Phishing", "Virtual Phishing", "None"], correctAnswerIndex: 1, explanation: "Phishing attacks conducted via phone calls." },
        { question: "What is an 'Insider Threat'?", options: ["A threat from the internet", "A threat from someone within the org", "A virus in the CPU", "A broken door lock"], correctAnswerIndex: 1, explanation: "Employees or partners who misuse their access." },
        { question: "What is 'Encryption'?", options: ["Deleting data", "Converting data to code to prevent access", "Copying data", "Compressing files"], correctAnswerIndex: 1, explanation: "Scrambling data so only authorized parties can read it." },
        { question: "What is a 'Public Wi-Fi' risk?", options: ["Faster speeds", "Data interception", "Battery drain", "Better signal"], correctAnswerIndex: 1, explanation: "Hackers can easily monitor traffic on open networks." },
        { question: "What is 'Juice Jacking'?", options: ["Hacking a juicer", "Hacking via USB charging stations", "Stealing power", "None"], correctAnswerIndex: 1, explanation: "Cyberattack through a public charging port." },
        { question: "What is 'Baiting' in social engineering?", options: ["Fishing with worms", "Leaving a malware-infected USB for someone", "Asking for a date", "Buying ads"], correctAnswerIndex: 1, explanation: "Luring victims with a physical or digital 'bait'." },
        { question: "What does 'OWASP' stand for?", options: ["Open Web Application Security Project", "Official Web Security Program", "Online Web Safety Program", "None"], correctAnswerIndex: 0, explanation: "A nonprofit foundation that works to improve software security." },
        { question: "What is a 'Botnet'?", options: ["A robot network", "A network of compromised computers", "A type of internet speed", "A chat room"], correctAnswerIndex: 1, explanation: "A collection of internet-connected devices infected with malware." },
        { question: "What is 'Spear Phishing'?", options: ["Phishing in the ocean", "Targeted phishing for a specific person", "Random phishing", "Fast phishing"], correctAnswerIndex: 1, explanation: "A personalized attack aimed at a specific individual or org." },
        { question: "What is 'SQL Injection'?", options: ["Injecting code into a database query", "A type of physical attack", "Optimizing a database", "Hacking a website CSS"], correctAnswerIndex: 0, explanation: "Inserting malicious SQL code to manipulate a database." },
        { question: "What is a 'Keylogger'?", options: ["A person who makes keys", "Software that records keystrokes", "A type of heavy keyboard", "None"], correctAnswerIndex: 1, explanation: "Malware that records every letter you type." },
        { question: "What is 'Data Breach'?", options: ["A new data release", "Unauthorized access to private data", "Data cleanup", "Data backup"], correctAnswerIndex: 1, explanation: "An incident where information is accessed without authorization." },
        { question: "What is 'Penetration Testing'?", options: ["Testing a pen's ink", "Authorized simulated attack", "Hacking a bank for real", "None"], correctAnswerIndex: 1, explanation: "Testing a system's security by simulating a real attack." },
        { question: "What is 'Patch Management'?", options: ["Fixing clothes", "Updating software regularly", "Garden care", "None"], correctAnswerIndex: 1, explanation: "The process of managing a network of software updates." },
        { question: "What is 'Identity Theft'?", options: ["Losing your ID card", "Stealing someone's personal info to commit fraud", "Changing your name", "None"], correctAnswerIndex: 1, explanation: "Using someone else's identity for financial gain." },
        { question: "What is 'Whaling'?", options: ["Big phishing targeted at executives", "Hunting whales", "Phishing a whole town", "None"], correctAnswerIndex: 0, explanation: "Phishing attacks aimed specifically at senior executives." },
        { question: "What is 'Pretexting'?", options: ["Sending a text before", "Creating a fake scenario to steal info", "Reading a book", "None"], correctAnswerIndex: 1, explanation: "Fabricating a story to gain the victim's trust." },
        { question: "What is 'Cryptojacking'?", options: ["Hacking Bitcoin wallets", "Using a PC to mine crypto without permission", "Buying crypto", "None"], correctAnswerIndex: 1, explanation: "Unauthorized use of a person's computer to mine cryptocurrency." },
        { question: "What is a 'Man-in-the-Middle' (MitM) attack?", options: ["A person standing between two PCs", "Intercepting communication between two parties", "A referee", "None"], correctAnswerIndex: 1, explanation: "The attacker secretly relays and alters the communication." },
        { question: "What is 'Dark Web'?", options: ["A web with no colors", "Hidden part of the internet used for illicit acts", "A website with dark mode", "None"], correctAnswerIndex: 1, explanation: "Part of the deep web that is intentionally hidden." },
        { question: "What is 'Principle of Least Privilege'?", options: ["Giving everyone admin access", "Giving users only the access they need", "Giving no one access", "None"], correctAnswerIndex: 1, explanation: "A concept of limiting access rights for users to the bare minimum." },
        { question: "What is 'Endpoint Security'?", options: ["Securing the finish line", "Securing devices like laptops and phones", "A type of wall", "None"], correctAnswerIndex: 1, explanation: "Securing the devices that connect to a network." },
        { question: "What is 'Biometric Authentication'?", options: ["Using a ruler", "Using physical traits like fingerprints", "Using two passwords", "None"], correctAnswerIndex: 1, explanation: "Using unique physical characteristics to verify identity." },
        { question: "What is 'Tailgating'?", options: ["Following someone into a secure area without access", "A type of car party", "Driving too close to a car", "None"], correctAnswerIndex: 0, explanation: "Physical security breach where someone follows an authorized person." },
        { question: "What is 'Air Gapping'?", options: ["Putting a fan near a PC", "Isolating a computer from all networks", "Clearing the air", "None"], correctAnswerIndex: 1, explanation: "Disconnecting a computer physically from any network for security." },
        { question: "What is 'Hashing'?", options: ["Cooking potatoes", "Creating a unique fixed-length string from data", "Encrypting a file", "None"], correctAnswerIndex: 1, explanation: "One-way conversion of data into a unique string." },
        { question: "What is 'CAPTCHA' used for?", options: ["Displaying ads", "Distinguishing humans from bots", "Speeding up forms", "None"], correctAnswerIndex: 1, explanation: "A challenge-response test to ensure the user is human." },
        { question: "What is 'Information Leakage'?", options: ["A broken pipe", "Unintentional disclosure of private info", "Sharing a secret", "None"], correctAnswerIndex: 1, explanation: "When sensitive info is exposed to unauthorized parties." },
        { question: "What is 'Sandboxing'?", options: ["Playing in the sand", "Running code in an isolated environment", "Cleaning a PC", "None"], correctAnswerIndex: 1, explanation: "Testing untrusted code in a safe, isolated container." },
        { question: "What is 'Rootkit'?", options: ["A tool for gardening", "Malware that grants high-level access while hiding", "A fast CPU", "None"], correctAnswerIndex: 1, explanation: "Malware designed to hide its presence and maintain admin access." },
        { question: "What is 'Social Media Privacy'?", options: ["Deleting your account", "Controlling who sees your personal info online", "Adding many friends", "None"], correctAnswerIndex: 1, explanation: "Managing settings to protect your personal information on social platforms." },
        { question: "What is 'Security Awareness Training'?", options: ["Learning to hack", "Educating users on cyber threats and safe habits", "Reading news", "None"], correctAnswerIndex: 1, explanation: "Training employees to recognize and avoid security risks." },
        { question: "What is 'Data Privacy'?", options: ["Hiding your data", "Proper handling and protection of sensitive personal data", "Deleting old files", "None"], correctAnswerIndex: 1, explanation: "The right of an individual to have control over how their personal info is collected and used." }
      ];
      await QuizQuestion.insertMany(questions);
      console.log("✅ Seeded 50 Quiz Questions into Database");
    }
  } catch (err: any) {
    console.error("⚠️ Database Seeding Warning (usually case-sensitivity related):", err.message);
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

// --- AI SETUP ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
console.log("ai key", ai);

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
    const session = new Session({ userId: req.user.id, title: req.body.title || 'New Conversation', mode: req.body.mode || 'normal' });
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
            _id: sessionId, // Frontend ID ကို သုံးမယ်
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

    if (mode === 'quiz') {
      const randomResults = await QuizQuestion.aggregate([{ $sample: { size: 1 } }]);
      const nextQuestion = randomResults[0];
      
      if (!nextQuestion) {
        aiResponse.content = language === 'my' ? "စနစ်အတွင်း ပဟေဠိမေးခွန်းများ မတွေ့ရှိပါ။" : "No quiz questions found in system.";
        aiResponse.type = 'text';
      } else {
        aiResponse.content = language === 'my' ? "ဤသည်မှာ သင်၏ကျပန်းမေးခွန်းဖြစ်သည်-" : "Here is your random question:";
        aiResponse.type = 'quiz';
        aiResponse.quizData = nextQuestion;
      }
    } 
    else {
      const history = await Message.find({ sessionId }).sort({ timestamp: -1 }).limit(10);
      const historyParts = history.reverse().map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      const currentParts: any[] = [{ text: message }]; // စာကို အရင်ထည့်မယ်

      // ပုံတွေ ပါလာရင် Base64 data ကို Gemini format ပြောင်းပြီး ထည့်မယ်
      if (attachments && attachments.length > 0) {
        attachments.forEach((att: any) => {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType, // e.g. 'image/png'
              data: att.data          // Base64 string
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
      
      const response = await ai.models.generateContent({
        //model: (mode === 'analysis') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
        // ✅ ဒီအတိုင်း အတိအကျ ပြောင်းရေးလိုက်ပါ
        model: (mode === 'analysis') ? 'gemini-2.5-flash' : 'gemini-2.5-flash',
        contents: [...historyParts, { role: 'user', parts: currentParts }],
        config: { systemInstruction: instruction }
      });

      const rawText = response.text || "";
      aiResponse.content = rawText;
      aiResponse.type = 'text';

      if (mode === 'analysis') {
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

  // } catch (error: any) {
  //   console.error("Chat Error:", error);
  //   res.status(500).json({ error: "The AI service is currently unavailable or restricted in your region." });
  // }
    } catch (error: any) {
    // 1. Console မှာ Error အပြည့်အစုံကို ထုတ်ပြမယ် (Render Logs မှာ ကြည့်ဖို့)
    console.error("🔥 ACTUAL SERVER ERROR:", error);

    // 2. Error Message အမှန်ကို Frontend ဆီ ပြန်ပို့မယ်
    // Google API က ပို့လိုက်တဲ့ Error message အတိအကျကို ယူပါမယ်
    const errorMessage = error.message || "Unknown AI Error";

    res.status(500).json({ 
      error: `AI Error: ${errorMessage}`, // 👈 အကြောင်းရင်းမှန်ကို ဒီမှာ ပြမယ်
      details: error // (Optional) အသေးစိတ် အချက်အလက်
    });
  }
});
app.get('/', (req, res) => {
    res.send("✅ Cyber Advisor Backend is Running Successfully!");
});
app.listen(PORT, () => console.log(`🚀 Cyber Server on port ${PORT}`));
