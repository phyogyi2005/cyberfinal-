import React, { useState, useEffect, useRef } from 'react';
import { Auth } from './components/Auth';
import { ChatMessage } from './components/ChatMessage';
import { sendMessageToGemini } from './services/geminiService';
import { User, Message, ChatSession, MessageType, Attachment, ChatMode } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<'en' | 'my'>('en');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // New State for Modes
  const [chatMode, setChatMode] = useState<ChatMode>('normal');
  const [quizCount, setQuizCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Load (Theme & User Check)
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
    const storedUser = localStorage.getItem('cyberguard_user');
    if (storedUser) setUser(JSON.parse(storedUser));

    const storedSessions = localStorage.getItem('cyberguard_sessions');
    if (storedSessions) {
       const parsed = JSON.parse(storedSessions);
       setSessions(parsed);
       if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    }
  }, []);

  // Theme Toggle
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('cyberguard_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isLoading]);


  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [{
        id: 'welcome',
        role: 'model',
        type: MessageType.TEXT,
        content: `Hello ${user?.name || 'there'}! I am Cyber Advisor. Select a mode below (Quiz, Learning, Threat Check, or Normal) to get started.`,
        timestamp: Date.now()
      }],
      lastUpdated: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setChatMode('normal');
    setQuizCount(0);
  };

  // const handleLogin = (userData: User) => {
  //   setUser(userData);
  //   localStorage.setItem('cyberguard_user', JSON.stringify(userData));
  //   if (sessions.length === 0) createNewSession();
  // };
const handleLogin = (userData: User, token: string) => { // 👈 (1) token ကို လက်ခံပါ
  setUser(userData);
  
  // User Data ကို သိမ်းခြင်း
  localStorage.setItem('cyberguard_user', JSON.stringify(userData));
  
  // 👇 (2) Token ကို 'cyber_token' နာမည်နဲ့ မဖြစ်မနေ သိမ်းရပါမယ်
  localStorage.setItem('cyber_token', token); 
  
  if (sessions.length === 0) createNewSession();
};
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cyberguard_user');
    setSessions([]);
  };

  // Handle Mode Switching logic
  const handleModeChange = (newMode: ChatMode) => {
    if (chatMode === newMode && newMode !== 'quiz') return; // Avoid reload unless quiz restart
    
    setChatMode(newMode);
    
    let prompt = "";
    let displayOverride = "";
    
    if (newMode === 'quiz') {
      setQuizCount(1);
      // EXPLICIT instruction to ensure UI renders for the first question
      prompt = "Start a live quiz session immediately. Generate Question 1 of 5 in strict JSON format as specified in system instructions.";
      displayOverride = "Start Quiz";
      // IMPORTANT: Pass newMode here because 'chatMode' state hasn't updated yet in this closure
      handleSend(prompt, displayOverride, newMode); 
    } else if (newMode === 'learning') {
      prompt = `I want to enter Learning Mode. Please teach me a core cybersecurity concept suitable for a ${user?.knowledgeLevel} level.`;
      displayOverride = "Start Learning Mode";
      handleSend(prompt, displayOverride, newMode);
    } else if (newMode === 'analysis') {
       // Don't auto-send, just wait for file/input
       setInput(""); // Clear input
    } else {
       // Normal
       setQuizCount(0);
       // Optionally send a message to acknowledge switch, or just silent switch
    }
  };

  // Updated handleSend to support displayOverride and modeOverride
  const handleSend = async (textOverride?: string, displayOverride?: string, modeOverride?: ChatMode) => {
    let textToSend = textOverride || input;
    const messageDisplay = displayOverride || textToSend; // What shows in the bubble
    const attachmentsToSend = textOverride ? [] : [...attachments];

    if ((!textToSend.trim() && attachmentsToSend.length === 0) || !currentSessionId || !user) return;

    // Determine effective mode immediately (fixes async state issues)
    const effectiveMode = modeOverride || chatMode;

    // Quiz Continuation Logic - Intercepting "Yes/No" after quiz finishes
    if (effectiveMode === 'quiz' && quizCount > 5 && !textOverride) {
        const lowerInput = textToSend.toLowerCase();
        if (lowerInput.includes('yes') || lowerInput.includes('again') || lowerInput.includes('continue') || lowerInput.includes('start')) {
           setQuizCount(1);
           textToSend = "Start a new quiz session. Generate Question 1 of 5 in strict JSON format.";
        } else {
           setChatMode('normal');
           setQuizCount(0);
           textToSend = "Switching to Normal Mode. " + textToSend;
           // If switching to normal, we should probably execute this as normal mode
           // But effectiveMode is still 'quiz' for this turn unless we change it.
           // Let's let the model handle the transition or force 'normal' next turn.
        }
    }

    const activeSessionIndex = sessions.findIndex(s => s.id === currentSessionId);
    if (activeSessionIndex === -1) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageDisplay, // Display the nice text
      type: MessageType.TEXT,
      timestamp: Date.now(),
      attachments: attachmentsToSend
    };

    const updatedSessions = [...sessions];
    updatedSessions[activeSessionIndex].messages.push(userMessage);
    
    // Update title logic
    if (updatedSessions[activeSessionIndex].messages.length === 2 && !textOverride) {
        updatedSessions[activeSessionIndex].title = messageDisplay.slice(0, 30) + (messageDisplay.length > 30 ? '...' : '');
    }
    setSessions(updatedSessions);
    
    if (!textOverride) {
      setInput('');
      setAttachments([]);
    }
    setIsLoading(true);

    // Send the ACTUAL prompt (textToSend), not the display text, using effectiveMode
    const response = await sendMessageToGemini(
      updatedSessions[activeSessionIndex].messages.slice(0, -1), 
      textToSend, 
      userMessage.attachments || [],
      user.knowledgeLevel,
      language,
      effectiveMode,
      currentSessionId!
    );

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      content: response.text,
      type: response.type,
      timestamp: Date.now(),
      analysisData: response.analysisData,
      quizData: response.quizData
    };

    updatedSessions[activeSessionIndex].messages.push(aiMessage);
    updatedSessions[activeSessionIndex].lastUpdated = Date.now();
    setSessions(updatedSessions);
    setIsLoading(false);
  };
 
  // Handler for Quiz Option Click (from ChatMessage component) Old
  // const handleQuizAnswer = (answerText: string) => {
  //    if (chatMode !== 'quiz') return;
     
  //    const nextCount = quizCount + 1;
  //    setQuizCount(nextCount);

  //    let prompt = "";
  //    let displayLabel = "";
     
  //    if (nextCount <= 5) {
  //       prompt = `I choose answer: "${answerText}". Is that correct? Explain briefly, then provide Question ${nextCount} of 5 in JSON format.`;
  //       displayLabel = `I choose answer: ${answerText}`;
  //    } else {
  //       // End of quiz
  //       prompt = `I choose answer: "${answerText}". That was the last question. Grade this answer, then provide a final summary of my performance. Finally, ask me 'Do you want to play again?' or 'Exit'. Do NOT generate a JSON question block.`;
  //       displayLabel = `I choose answer: ${answerText}`;
  //    }
  //    handleSend(prompt, displayLabel);
  // };
  // Handler for Quiz Option Click New
  const handleQuizAnswer = (answerText: string) => {
     if (chatMode !== 'quiz') return;

     // (၁) လက်ရှိ Session ထဲက နောက်ဆုံး Quiz မေးခွန်းကို ရှာမယ်
     const currentSess = sessions.find(s => s.id === currentSessionId);
     // Message တွေကို ပြောင်းပြန်လှန်ပြီး quizData ပါတဲ့ ပထမဆုံးအရာ (လက်ရှိမေးခွန်း) ကို ယူမယ်
     const lastQuizMsg = [...(currentSess?.messages || [])].reverse().find(m => m.role === 'model' && m.quizData);

     // Safety Check: မေးခွန်းမရှိရင် ဘာမှမလုပ်ဘူး
     if (!lastQuizMsg || !lastQuizMsg.quizData) {
        console.error("Error: No quiz data found to compare.");
        return;
     }

     // (၂) အဖြေမှန် တိုက်စစ်ခြင်း (Frontend Logic)
     const qData = lastQuizMsg.quizData;
     const correctIndex = qData.correctAnswerIndex; // ဥပမာ: 1 (Index)
     const correctOptionText = qData.options[correctIndex] || ""; // ဥပမာ: "Phishing"

     // စာလုံးအကြီးအသေး မရွေးအောင် Lowercase ပြောင်းပြီး စစ်မယ်
     const userClick = answerText.trim().toLowerCase();
     const correctText = correctOptionText.trim().toLowerCase();

     // Click နှိပ်လိုက်တဲ့စာက အဖြေမှန်စာသားနဲ့ တူမတူ စစ်မယ်
     // (.includes သုံးတာက "A) Phishing" နဲ့ "Phishing" ကွဲလွဲနေလည်း မှန်အောင်လို့ပါ)
     const isCorrect = correctText.includes(userClick) || userClick.includes(correctText);

     // (၃) Backend ကို ပို့မည့် စာ (Tag တပ်ပြီးသား)
     // မှန်ရင် -> "CORRECT:::Phishing"
     // မှားရင် -> "INCORRECT:::Phishing"
     const payload = isCorrect ? `CORRECT:::${answerText}` : `INCORRECT:::${answerText}`;
     
     const nextCount = quizCount + 1;
     setQuizCount(nextCount);

     // (၄) Backend သို့ ပို့ခြင်း
     // ၅ ပုဒ်ပြည့်ပြီးသွားရင် (Question 5 ဖြေပြီးရင်) Summary တောင်းဖို့ အသင့်ပြင်မယ်
     if (nextCount > 5) {
        // နောက်ဆုံးမေးခွန်းအဖြေကို ပို့လိုက်မယ် (Backend က အမှတ်မှတ်ထားလိမ့်မယ်)
        handleSend(payload, answerText);
        
        // (Optional) Quiz ပြီးသွားကြောင်း သိသာအောင် ၁ စက္ကန့်နေရင် Result တောင်းမယ်
        setTimeout(() => {
            handleSend("Final Summary", "Show My Results");
        }, 1500);
     } else {
        // ပုံမှန် မေးခွန်းဖြေခြင်း
        handleSend(payload, answerText);
     }
  };

  // Voice Handling
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
      recognition.continuous = false;
      recognition.interimResults = false;

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setAttachments([...attachments, {
          name: file.name,
          mimeType: file.type,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          data: base64String
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-black overflow-hidden">
      
      {/* Sidebar (Hidden on mobile, visible on md+) */}
      <div className="hidden md:flex w-64 flex-col h-full bg-white dark:bg-cyber-900 border-r border-slate-200 dark:border-cyber-700 shrink-0">
        <div className="p-4 border-b border-slate-100 dark:border-cyber-800">
           <button 
             onClick={createNewSession}
             className="w-full py-2 px-4 bg-cyber-500 hover:bg-cyber-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
           >
             <span className="material-icons text-sm">add</span> New Chat
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full text-left p-3 rounded-lg text-sm truncate transition-colors flex items-center gap-2 ${
                currentSessionId === session.id 
                  ? 'bg-cyber-50 dark:bg-cyber-800 text-cyber-500 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-800'
              }`}
            >
              <span className="material-icons text-xs opacity-50">chat_bubble_outline</span>
              {session.title}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-cyber-800 mt-auto">
          <div className="flex items-center gap-3 mb-4">
             <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyber-400 to-cyber-600 flex items-center justify-center text-white font-bold shadow-sm">
               {user.name.charAt(0)}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
               <p className="text-xs text-slate-500 dark:text-slate-400">{user.knowledgeLevel}</p>
             </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
            <span className="material-icons text-sm">logout</span> Sign Out
          </button>
        </div>
      </div>

      {/* Main Chat Area - Fixed Height Wrapper */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Header */}
        <header className="h-16 shrink-0 bg-white dark:bg-cyber-900 border-b border-slate-200 dark:border-cyber-700 flex items-center justify-between px-4 lg:px-8 shadow-sm z-20">
           <div className="flex items-center gap-2 md:hidden">
             <button onClick={createNewSession} className="text-cyber-500 p-2"><span className="material-icons">add_circle</span></button>
           </div>
           <div className="flex items-center gap-3">
              {/* Custom SVG Logo - Robot Circle */}
              <div className="h-9 w-9">
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <defs>
                    <linearGradient id="headerShieldGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="50%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <circle cx="32" cy="32" r="30" fill="url(#headerShieldGrad)" />
                  <g fill="white">
                    <rect x="31" y="14" width="2" height="8" rx="1" />
                    <circle cx="32" cy="12" r="3" />
                    <rect x="20" y="22" width="24" height="18" rx="5" />
                    <circle cx="27" cy="30" r="3" fill="#1e293b" />
                    <circle cx="37" cy="30" r="3" fill="#1e293b" />
                    <path d="M20 44C20 44 22 52 32 52C42 52 44 44 44 44H20Z" />
                  </g>
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="font-bold text-lg text-slate-800 dark:text-white hidden sm:block">Cyber Advisor</h1>
                <span className="text-[10px] text-cyber-500 font-semibold uppercase tracking-widest hidden sm:block">
                  Current Mode: {chatMode}
                </span>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
             <button 
               onClick={() => setLanguage(l => l === 'en' ? 'my' : 'en')}
               className="px-3 py-1 rounded-full border border-slate-200 dark:border-cyber-600 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-cyber-800 transition-colors"
             >
               {language === 'en' ? '🇬🇧 EN' : '🇲🇲 MY'}
             </button>

             <button 
               onClick={() => setDarkMode(!darkMode)}
               className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-cyber-800 text-slate-500 dark:text-slate-400 transition-colors"
             >
               <span className="material-icons">{darkMode ? 'light_mode' : 'dark_mode'}</span>
             </button>
           </div>
        </header>

        {/* Messages - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-black scrollbar-hide">
           <div className="max-w-5xl mx-auto pb-4">
             {currentSession ? (
                currentSession.messages.map((msg, idx) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg}
                    userName={user.name} 
                    language={language}
                    isLast={idx === currentSession.messages.length - 1}
                    onExplainRequest={(prompt) => handleSend(prompt)}
                    onQuizAnswer={(answer) => handleQuizAnswer(answer)}
                  />
                ))
             ) : (
               <div className="flex items-center justify-center h-full text-slate-400">Start a new conversation</div>
             )}
             {isLoading && (
               <div className="flex justify-start mb-6 ml-12 md:ml-14">
                 <div className="bg-white dark:bg-cyber-800 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
                    <div className="animate-bounce w-2 h-2 bg-cyber-500 rounded-full delay-0"></div>
                    <div className="animate-bounce w-2 h-2 bg-cyber-500 rounded-full delay-150"></div>
                    <div className="animate-bounce w-2 h-2 bg-cyber-500 rounded-full delay-300"></div>
                 </div>
               </div>
             )}
             <div ref={messagesEndRef} />
           </div>
        </div>

        {/* Input Area - Fixed Bottom */}
        <div className="shrink-0 p-4 bg-white dark:bg-cyber-900 border-t border-slate-200 dark:border-cyber-700 z-20">
          <div className="max-w-4xl mx-auto">
             
             {/* Compact Mode Toggles */}
             <div className="flex flex-wrap gap-2 mb-3 justify-center sm:justify-start">
               {[
                 { id: 'normal', icon: 'chat', label: 'Normal' },
                 { id: 'analysis', icon: 'shield', label: 'Check' },
                 { id: 'learning', icon: 'school', label: 'Learning' },
                 { id: 'quiz', icon: 'quiz', label: 'Quiz' },
                 
                 
               ].map((mode) => (
                 <button
                   key={mode.id}
                   onClick={() => handleModeChange(mode.id as ChatMode)}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                     chatMode === mode.id
                       ? 'bg-cyber-500 text-white border-cyber-500 shadow-md shadow-cyber-500/20'
                       : 'bg-slate-100 dark:bg-cyber-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-cyber-500'
                   }`}
                 >
                   <span className="material-icons text-[16px]">{mode.icon}</span>
                   {mode.label}
                 </button>
               ))}
             </div>

             {attachments.length > 0 && (
               <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                 {attachments.map((att, i) => (
                   <div key={i} className="relative bg-slate-100 dark:bg-cyber-800 rounded-lg p-2 flex items-center gap-2 min-w-fit border border-slate-200 dark:border-cyber-700">
                      <span className="material-icons text-sm text-cyber-500">
                        {att.type === 'image' ? 'image' : 'description'}
                      </span>
                      <span className="text-xs max-w-[100px] truncate dark:text-slate-300">{att.name}</span>
                      <button 
                        onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                        className="hover:text-red-500"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                   </div>
                 ))}
               </div>
             )}

             <div className="relative flex items-center gap-2">
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="p-3 rounded-full bg-slate-100 dark:bg-cyber-800 hover:bg-slate-200 dark:hover:bg-cyber-700 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
                 title="Upload File/Image"
               >
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
                 placeholder={
                   chatMode === 'analysis' ? "Paste URL/Upload file to check..." :
                   chatMode === 'quiz' ? (quizCount > 5 ? "Type 'Yes' to play again..." : "Answer the question...") :
                   "Type your message..."
                 }
                 className="flex-1 bg-slate-100 dark:bg-cyber-800 border-none rounded-full px-4 sm:px-6 py-3 focus:ring-2 focus:ring-cyber-500 outline-none dark:text-white transition-shadow min-w-0 text-sm sm:text-base"
               />

               <button 
                 onClick={toggleRecording}
                 className={`p-3 rounded-full transition-all flex-shrink-0 ${
                   isRecording 
                     ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg' 
                     : 'bg-slate-100 dark:bg-cyber-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-cyber-700'
                 }`}
               >
                 <span className="material-icons">{isRecording ? 'mic_off' : 'mic'}</span>
               </button>

               <button 
                 onClick={() => handleSend()}
                 disabled={!input.trim() && attachments.length === 0}
                 className="p-3 rounded-full bg-cyber-500 text-white shadow-lg shadow-cyber-500/30 hover:bg-cyber-600 disabled:opacity-50 disabled:cursor-not-allowed transform transition active:scale-95 flex-shrink-0"
               >
                 <span className="material-icons">send</span>
               </button>
             </div>
             <p className="text-center text-[10px] text-slate-400 mt-2">
               {chatMode === 'quiz' ? (quizCount > 5 ? 'Quiz Finished. Play again?' : `Quiz: Question ${quizCount}/5`) : 
                chatMode === 'analysis' ? 'Analysis Mode: Secure File & Link Check' :
                `Connected as ${user.name} (${user.knowledgeLevel})`}
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
