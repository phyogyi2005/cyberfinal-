import React, { useState, useEffect, useRef } from 'react';
import { Auth } from './components/Auth';
import { ChatMessage } from './components/ChatMessage';
import { api } from './services/geminiService';
import { User, Message, ChatSession, MessageType, Attachment, ChatMode } from './types';

function App() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]); // ✅ Fixed: Added back
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false); // ✅ Fixed: Added back
  
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<'en' | 'my'>('en');
  const [chatMode, setChatMode] = useState<ChatMode>('normal');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // ✅ Fixed: Added back

  
  // --- STATE MANAGEMENT --- အောက်နားမှာ ထည့်ပါ
const [showLevelSelector, setShowLevelSelector] = useState(false); // ✅ ဒီလိုင်းကို ထပ်ထည့်ပါ
  
  // --- 1. INITIAL LOAD (Auth & History) ---
  useEffect(() => {
    // Theme Check
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }

    // User & Token Check
    const storedUser = localStorage.getItem('cyberguard_user');
    const storedToken = localStorage.getItem('cyber_token');

    if (storedUser && storedToken) {
       setUser(JSON.parse(storedUser));
       // Load history immediately using the token
       loadSessions(storedToken); 
    }
  }, []);

  // --- 2. LOAD MESSAGES ON SESSION CHANGE ---
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  // --- 3. AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, attachments]); // Scroll when attachments added too

  // --- API HELPER FUNCTIONS ---

  // const loadSessions = async (tokenOverride?: string) => {
  //   try {
  //     // Pass token if available to ensure auth works
  //     const data = await api.getSessions(tokenOverride); 
  //     setSessions(data);

  //     // If we have sessions but none selected, select the first (most recent)
  //     if (data.length > 0 && !currentSessionId) {
  //       const firstId = data[0]._id || data[0].id;
  //       setCurrentSessionId(firstId);
        
  //       // Restore mode from session if available
  //       if (data[0].mode) setChatMode(data[0].mode as ChatMode);
  //     } 
  //     // If no history exists, create a new session automatically
  //     else if (data.length === 0) {
  //       createNewSession();
  //     }
  //   } catch (e) {
  //     console.error("Session Load Error", e);
  //   }
  // };
  // App.tsx အတွင်း

  const loadSessions = async (tokenOverride?: string) => {
    try {
      const token = tokenOverride || localStorage.getItem('cyber_token');
      if (!token) return;

      const data = await api.getSessions(token); 
      setSessions(data);

      if (data.length > 0 && !currentSessionId) {
        // Backend က _id (သို့) id ကြိုက်တာလာလာ ဖမ်းလို့ရအောင်
        const firstId = data[0]._id || data[0].id;
        setCurrentSessionId(firstId);
        
        if (data[0].mode) setChatMode(data[0].mode as ChatMode);
      } 
      else if (data.length === 0) {
        // 👇 ဒီမှာ await ထည့်ပေးလိုက်ပါ
        await createNewSession(); 
      }
    } catch (e) {
      console.error("Session Load Error", e);
    }
  };

  const loadMessages = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.getMessages(id);
      setMessages(data);
      
      // Update mode based on current session data
      const currentSession = sessions.find(s => (s._id || s.id) === id);
      if (currentSession && currentSession.mode) {
          setChatMode(currentSession.mode as ChatMode);
      }
    } catch (e) {
      console.error("Messages Load Error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async (mode: ChatMode = 'normal') => {
    try {
      const session = await api.createSession('New Conversation', mode);
      setSessions([session, ...sessions]);
      setCurrentSessionId(session._id || session.id);
      setMessages([]);
      setChatMode(mode);
    } catch (e) {
      console.error(e);
    }
  };

  // --- AUTH HANDLERS ---

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('cyberguard_user', JSON.stringify(userData));
    localStorage.setItem('cyber_token', token);
    loadSessions(token);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
  };

  // --- INPUT HANDLERS (Voice & File) ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string)?.split(',')[1];
        if (base64String) {
            setAttachments([...attachments, {
            name: file.name,
            mimeType: file.type,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            data: base64String
            }]);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsRecording(true);
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'my' ? 'my-MM' : 'en-US';
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInput(text);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
    } else {
      alert("Speech recognition not supported in this browser.");
    }
  };

  // const handleSend = async (textOverride?: string) => {
  //   const text = textOverride || input;
    
  //   // (၁) Validation
  //   if ((!text.trim() && attachments.length === 0) || !currentSessionId || !user) return;

  //   // (၂) Optimistic Update (UI မှာ စာအရင်ပြမယ်)
  //   const optimisticMsg: any = {
  //     role: 'user',
  //     content: text,
  //     type: MessageType.TEXT,
  //     timestamp: Date.now(),
  //     attachments: textOverride ? [] : [...attachments]
  //   };
    
  //   setMessages(prev => [...prev, optimisticMsg]);
    
  //   if (!textOverride) {
  //       setInput('');
  //       setAttachments([]);
  //   }
  //   setIsLoading(true);

  //   try {
  //     // (၃) API Call
  //     const response = await api.sendMessage({
  //       sessionId: currentSessionId,
  //       message: text,
  //       userLevel: user.knowledgeLevel,
  //       language,
  //       mode: chatMode,
  //       attachments: textOverride ? [] : attachments
  //     });
      
  //     setMessages(prev => [...prev, response]);

  //     // (၄) Title Update Logic
  //     // ပထမဆုံး စာပို့တာဆိုရင် Sidebar မှာ Title ကို ပြောင်းပေးမယ်
  //     if (messages.length === 0) {
  //        setSessions(prev => prev.map(s => {
  //           if ((s._id || s.id) === currentSessionId) {
  //               return { ...s, title: text.substring(0, 30) + (text.length > 30 ? "..." : "") };
  //           }
  //           return s;
  //        }));
  //     }

  //   } catch (error: any) {
  //     console.error("Chat Error:", error);
  //   } finally {
  //     // (၅) Loading ပိတ်မယ်
  //     setIsLoading(false);
  //   }
  // };

  // // --- QUIZ LOGIC (Frontend Check + Backend Tagging) ---

  // const handleQuizAnswer = (answerText: string) => {
  //    if (chatMode !== 'quiz') return;

  //    // Find the last quiz question asked by the model
  //    const lastQuizMsg = [...messages].reverse().find(m => m.role === 'model' && m.quizData);

  //    if (!lastQuizMsg || !lastQuizMsg.quizData) {
  //       // Fallback: just send the text
  //       handleSend(answerText);
  //       return;
  //    }

  //    const qData = lastQuizMsg.quizData;
  //    const correctIndex = qData.correctAnswerIndex;
  //    const correctOptionText = qData.options[correctIndex] || "";

  //    // Check Answer Logic
  //    const userClick = answerText.trim().toLowerCase();
  //    const correctText = correctOptionText.trim().toLowerCase();
     
  //    // Determine Correctness
  //    const isCorrect = correctText.includes(userClick) || userClick.includes(correctText);

  //    // Create Tagged Payload for Backend
  //    const payload = isCorrect ? `CORRECT:::${answerText}` : `INCORRECT:::${answerText}`;
     
  //    // Send hidden payload, but UI shows just the answer via optimistic update in handleSend
  //    handleSend(payload);
  // };
  // --- CORE SEND LOGIC (UPDATED WITH FIX) ---

  // (A) handleSend မှာ modeOverride parameter ထပ်ဖြည့်ထားပါတယ်
 // --- CORE SEND LOGIC (UPDATED WITH FIX) ---

  // (A) handleSend မှာ modeOverride parameter ထပ်ဖြည့်ထားပါတယ်
// --- CORE SEND LOGIC (UPDATED WITH FIX) ---

  // (A) handleSend မှာ modeOverride parameter ထပ်ဖြည့်ထားပါတယ်
  const handleSend = async (textOverride?: string, modeOverride?: ChatMode) => {
    const text = textOverride || input;
    
    // (B) ✅ CRITICAL FIX:
    // ပေးလိုက်တဲ့ Mode အသစ်ရှိရင် အဲ့ဒါကို သုံးမယ်၊ မရှိမှ လက်ရှိ State (chatMode) ကို သုံးမယ်
    // ဒီလိုလုပ်မှ "Start Quiz" နှိပ်နှိပ်ချင်း "quiz" mode နဲ့ Backend ကို ရောက်မှာပါ
    const currentMode = modeOverride || chatMode;

    // (၁) Validation
    if ((!text.trim() && attachments.length === 0) || !currentSessionId || !user) return;

    // (၂) Optimistic Update (UI မှာ စာအရင်ပြမယ်)
    const optimisticMsg: any = {
      role: 'user',
      content: text,
      type: MessageType.TEXT,
      timestamp: Date.now(),
      attachments: textOverride ? [] : [...attachments]
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
    if (!textOverride) {
        setInput('');
        setAttachments([]);
    }
    setIsLoading(true);

    try {
      // (၃) API Call
      const response = await api.sendMessage({
        sessionId: currentSessionId,
        message: text,
        userLevel: user.knowledgeLevel,
        language,
        mode: currentMode, // ✅ FIX: chatMode အစား currentMode ကို သုံးထားပါတယ်
        attachments: textOverride ? [] : attachments
      });
      
      setMessages(prev => [...prev, response]);

      // (၄) Title Update Logic
      if (messages.length === 0) {
         setSessions(prev => prev.map(s => {
            if ((s._id || s.id) === currentSessionId) {
                return { ...s, title: text.substring(0, 30) + (text.length > 30 ? "..." : "") };
            }
            return s;
         }));
      }

    } catch (error: any) {
      console.error("Chat Error:", error);
    } finally {
      // (၅) Loading ပိတ်မယ်
      setIsLoading(false);
    }
  };

  // --- QUIZ LOGIC (Frontend Check + Backend Tagging) ---

  const handleQuizAnswer = (answerText: string) => {
     if (chatMode !== 'quiz') return;

     // Find the last quiz question asked by the model
     const lastQuizMsg = [...messages].reverse().find(m => m.role === 'model' && m.quizData);

     if (!lastQuizMsg || !lastQuizMsg.quizData) {
        // Fallback: just send the text
        handleSend(answerText);
        return;
     }

     const qData = lastQuizMsg.quizData;
     const correctIndex = qData.correctAnswerIndex;
     const correctOptionText = qData.options[correctIndex] || "";

     // Check Answer Logic
     const userClick = answerText.trim().toLowerCase();
     const correctText = correctOptionText.trim().toLowerCase();
     
     // Determine Correctness
     const isCorrect = correctText.includes(userClick) || userClick.includes(correctText);

     // Create Tagged Payload for Backend
     // Backend will look for "CORRECT:::" or "INCORRECT:::"
     const payload = isCorrect ? `CORRECT:::${answerText}` : `INCORRECT:::${answerText}`;
     
     // Send hidden payload via handleSend
     handleSend(payload);
  };

  // --- MODE CHANGE HANDLER (REQUIRED FOR FIX) ---
  // ဒီ Function ကိုလည်း သေချာ Update လုပ်ပေးပါ

  const handleModeChange = (mode: ChatMode) => {
    setChatMode(mode);

    if(mode === 'normal'){
      handleSend("Start Normal mode",'normal');
    }
    else if (mode === 'quiz') {
      // ✅ FIX: ဒုတိယ parameter အနေနဲ့ 'quiz' ကို ထည့်ပေးလိုက်ပါ
      handleSend("Start Quiz", 'quiz'); 
    } 
    else if (mode === 'analysis') {
       setInput("");
       //
     // handleSend("analysis");
    }
    else if (mode === 'learning') {
       //handleSend("I want to learn about Cybersecurity. Where should I start?", 'learning');
      setShowLevelSelector(true); // Level ရွေးခိုင်းမယ့်အကွက်ကို ဖော်မယ်
    }
  };
  const handleLearningLevelSelect = (level: string) => {
    setShowLevelSelector(false); // Selector ကို ပြန်ပိတ်မယ်
    
    // AI ကို Level နဲ့တကွ စလှမ်းပြောမည့် စာ
    const prompt = `I want to learn about Cybersecurity. My knowledge level is: ${level}. Where should I start?`;
    
    handleSend(prompt, 'learning');
  };

  if (!user) return <Auth onLogin={handleLogin} />;

  return (
    <div className={`flex h-screen w-full bg-slate-50 dark:bg-[#020617] transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-hidden shrink-0`}>
        <div className="p-4">
          <button 
            onClick={() => createNewSession()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-blue-900/20 text-xs uppercase tracking-widest"
          >
            <span className="material-icons text-sm">add</span> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <button 
              key={s._id || s.id} 
              onClick={() => {
                  setCurrentSessionId(s._id || s.id);
                  if (window.innerWidth < 768) setSidebarOpen(false); // Close on mobile
              }} 
              className={`w-full text-left px-3 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider truncate transition-all flex items-center gap-3 ${
                currentSessionId === (s._id || s.id) 
                  ? 'bg-blue-500/10 text-blue-500' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-icons text-[14px] opacity-40">
                {s.mode === 'quiz' ? 'psychology' : s.mode === 'analysis' ? 'radar' : 'chat_bubble_outline'}
              </span>
              {s.title}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.name}</p>
              <p className="text-xs font-bold text-slate-700 dark:text-white truncate">{user.knowledgeLevel}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full py-2 text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/10 rounded-lg transition-all">
            <span className="material-icons text-sm">logout</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* Header */}
        <header className="h-20 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-slate-900/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-slate-500">
                <span className="material-icons">menu</span>
             </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-icons text-white text-xl">security</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tighter">Cyber Advisor</h1>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                MODE: {chatMode.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             <button 
               onClick={() => setLanguage(l => l === 'en' ? 'my' : 'en')}
               className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 gap-2 hover:bg-slate-200 transition-all"
             >
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LANG</span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{language}</span>
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:scale-105 transition-transform">
              <span className="material-icons text-xl">{darkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </header>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-hide bg-slate-50/30 dark:bg-[#020617]">
          <div className="max-w-4xl mx-auto">
            {messages.length > 0 ? (
                messages.map((m, idx) => (
                <ChatMessage 
                    key={m._id || m.id || idx} 
                    message={m} 
                    language={language} 
                    userName={user.name} 
                    onQuizAnswer={handleQuizAnswer} // ✅ Fixed: Passed correctly
                    onExplainRequest={(txt) => handleSend(txt)}
                />
                ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-20">
                    <span className="material-icons text-6xl mb-4">forum</span>
                    <p className="uppercase tracking-widest font-bold text-xs">Start a conversation</p>
                </div>
            )}
            
            {isLoading && (
              <div className="flex items-center gap-3 ml-2 mt-4">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></span>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Processing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Input */}
        <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto flex flex-col gap-4 md:gap-6">
            
            {/* Mode Pills */}
            <div className="flex flex-wrap gap-2 md:gap-3">
              {[
                { id: 'normal', icon: 'chat', label: 'normal', color: 'bg-blue-600 text-white shadow-blue-500/20' },
                { id: 'analysis', icon: 'shield', label: 'check', color: 'bg-emerald-600 text-white shadow-emerald-500/20' },
                { id: 'learning', icon: 'school', label: 'learning', color: 'bg-purple-600 text-white shadow-purple-500/20' },
                { id: 'quiz', icon: 'quiz', label: 'quiz', color: 'bg-rose-600 text-white shadow-rose-500/20' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id as ChatMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    chatMode === m.id ? `${m.color} shadow-lg scale-105` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="material-icons text-sm">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative bg-slate-100 dark:bg-slate-800 rounded-lg p-2 flex items-center gap-2 min-w-fit border border-slate-200 dark:border-slate-700">
                       <span className="material-icons text-sm text-blue-500">
                         {att.type === 'image' ? 'image' : 'description'}
                       </span>
                       <span className="text-[10px] font-bold dark:text-slate-300 max-w-[100px] truncate">{att.name}</span>
                       <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                         <span className="material-icons text-sm">close</span>
                       </button>
                    </div>
                  ))}
                </div>
            )}
           {/* ... Attachments Preview code ... */}
{/* ✅ LEVEL SELECTOR UI (SMALLER + CLOSE BUTTON) */}
{showLevelSelector && chatMode === 'learning' && (
  // bottom-24 ကနေ bottom-20 သို့ ပြောင်းပြီး အောက်နည်းနည်း ပိုကပ်လိုက်သည်
  <div className="absolute bottom-20 left-0 w-full px-4 md:px-10 z-20">
    {/* - max-w-4xl ကနေ max-w-2xl သို့ ပြောင်းပြီး အကျယ်ချုံ့လိုက်သည်
       - p-4 ကနေ p-3 သို့ ပြောင်းပြီး padding လျှော့လိုက်သည်
       - rounded-2xl ကနေ rounded-xl သို့ ပြောင်းသည်
       - 'relative' ထပ်ထည့်ထားသည် (Close button နေရာချဖို့အတွက်)
    */}
    <div className="relative max-w-2xl mx-auto bg-white dark:bg-slate-800 p-3 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up">
      
      {/* 🔥 အသစ်ထည့်ထားသော CLOSE BUTTON */}
      <button
        onClick={() => setShowLevelSelector(false)} // နှိပ်ရင် Selector ကို ပိတ်မယ်
        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all"
      >
         <span className="material-icons text-base block">close</span> {/* icon အသေးစားသုံးထားသည် */}
      </button>

      {/* Title: mb-3 ကို mb-2 သို့လျှော့၊ ခလုတ်နဲ့မထပ်အောင် pr-8 ထည့် */}
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 pr-8">
        Select knowledge level:
      </h3>

      {/* gap-3 ကို gap-2 သို့လျှော့ */}
      <div className="flex gap-2">
        {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
          <button
            key={level}
            onClick={() => handleLearningLevelSelect(level)}
            // py-3 px-4 ကို py-2 px-3 သို့လျှော့၊ text-xs ကို text-[11px] သို့လျှော့
            className="flex-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 transition-all font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-300 border-2 border-transparent hover:border-purple-400"
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  </div>
)}
// {/* ✅ LEVEL SELECTOR UI (Learning Mode အတွက် ဒီနေရာမှာ ထည့်ပါ) */}
// {showLevelSelector && chatMode === 'learning' && (
//   <div className="absolute bottom-24 left-0 w-full px-4 md:px-10 z-20">
//     <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up">
//       <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
//         Select your knowledge level:
//       </h3>
//       <div className="flex gap-3">
//         {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
//           <button
//             key={level}
//             onClick={() => handleLearningLevelSelect(level)}
//             className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 transition-all font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-300 border-2 border-transparent hover:border-purple-400"
//           >
//             {level}
//           </button>
//         ))}
//       </div>
//     </div>
//   </div>
// )}

{/* ... Input Field code ... */}
            {/* Input Field */}
            <div className="flex items-center gap-2 md:gap-4 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 md:px-6 py-3 md:py-4 border border-slate-100 dark:border-slate-700 shadow-inner focus-within:ring-2 ring-blue-500/50 transition-all">
              
              {/* File Upload Button */}
              <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-blue-500 transition-colors">
                 <span className="material-icons">attach_file</span>
              </button>
              <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleFileSelect}
                 accept=".jpg,.jpeg,.png,.pdf,.txt,.log"
              />

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={chatMode === 'analysis' ? "Paste URL or drop file for deep scan..." : "Ask your advisor..."}
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium dark:text-white placeholder:text-slate-500 min-w-0"
              />
              
              {/* Mic Button */}
              <button onClick={toggleRecording} className={`transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-500'}`}>
                <span className="material-icons">{isRecording ? 'mic' : 'mic_none'}</span>
              </button>

              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() && attachments.length === 0}
                className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-50 shadow-lg shadow-blue-600/30 hover:scale-110 transition-transform flex-shrink-0"
              >
                <span className="material-icons text-base">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
