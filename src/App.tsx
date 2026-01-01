
import React, { useState, useEffect, useRef } from 'react';
import { Auth } from './components/Auth';
import { ChatMessage } from './components/ChatMessage';
import { api } from './services/geminiService';
import { User, Message, ChatSession, MessageType, Attachment, ChatMode } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true); // Default to dark for that cyber look
  const [language, setLanguage] = useState<'en' | 'my'>('en');
  const [chatMode, setChatMode] = useState<ChatMode>('normal');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial Load (Theme, User & History Fetch)
  useEffect(() => {
    // 1. Theme Check
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }

    // 2. User & Token Check
    // (မှတ်ချက်: LocalStorage Key နာမည် မှန်ကန်ကြောင်း စစ်ဆေးပါ)
    const storedUser = localStorage.getItem('cyberguard_user'); 
    const storedToken = localStorage.getItem('cyber_token');

    if (storedUser && storedToken) {
       setUser(JSON.parse(storedUser));
       
       // 👇 အရေးကြီးဆုံးအချက်: Token ကို parameter အနေနဲ့ ထည့်ပေးရပါမယ်
       fetchSessions(storedToken); 
    }
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      if (data.length > 0 && !currentSessionId) {
        setCurrentSessionId(data[0]._id || data[0].id);
      }
    } catch (e) {
      console.error("Session Load Error", e);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await api.getMessages(id);
      setMessages(data);
    } catch (e) {
      console.error("Messages Load Error", e);
    }
  };

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('cyberguard_user', JSON.stringify(userData));
    localStorage.setItem('cyber_token', token);
    loadSessions();
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
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

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim() || !currentSessionId || !user) return;

    const optimisticMsg: any = {
      role: 'user',
      content: text,
      type: MessageType.TEXT,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    if (!textOverride) setInput('');
    setIsLoading(true);

    try {
      const response = await api.sendMessage({
        sessionId: currentSessionId,
        message: text,
        userLevel: user.knowledgeLevel,
        language,
        mode: chatMode
      });
      setMessages(prev => [...prev, response]);
      setTimeout(loadSessions, 500);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: ChatMode) => {
    setChatMode(mode);
    if (mode === 'quiz') {
      handleSend("Start Quiz");
    } else if (mode === 'analysis') {
      handleSend("Perform Security Check for http://g00gle.com");
    }
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
              onClick={() => setCurrentSessionId(s._id || s.id)} 
              className={`w-full text-left px-3 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider truncate transition-all flex items-center gap-3 ${
                currentSessionId === (s._id || s.id) 
                  ? 'bg-blue-500/10 text-blue-500' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-icons text-[14px] opacity-40">chat_bubble_outline</span>
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
        <header className="h-20 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white dark:bg-slate-900/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-icons text-white text-xl">security</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tighter">Cyber Advisor</h1>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                CURRENT MODE: {chatMode.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
        <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide bg-slate-50/30 dark:bg-[#020617]">
          <div className="max-w-4xl mx-auto">
            {messages.map((m, idx) => (
              <ChatMessage 
                key={m._id || m.id || idx} 
                message={m} 
                language={language} 
                userName={user.name} 
                onQuizAnswer={(ans) => handleSend(ans)}
              />
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 ml-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></span>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Analyzing threat vector...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Input */}
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            
            {/* Mode Pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'normal', icon: 'forum', label: 'Consult', color: 'bg-blue-600 text-white shadow-blue-500/20' },
                { id: 'quiz', icon: 'psychology', label: 'Drill', color: 'bg-emerald-600 text-white shadow-emerald-500/20' },
                { id: 'learning', icon: 'school', label: 'Train', color: 'bg-purple-600 text-white shadow-purple-500/20' },
                { id: 'analysis', icon: 'radar', label: 'Check', color: 'bg-rose-600 text-white shadow-rose-500/20' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id as ChatMode)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    chatMode === m.id ? `${m.color} shadow-lg scale-105` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-icons text-sm">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Input Field */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 py-4 border border-slate-100 dark:border-slate-700 shadow-inner">
              <button className="text-slate-400 hover:text-blue-500 transition-colors">
                <span className="material-icons">add_circle_outline</span>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={chatMode === 'analysis' ? "Paste URL or drop file for deep scan..." : "Ask your advisor anything..."}
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium dark:text-white placeholder:text-slate-500"
              />
              <button className="text-slate-400 hover:text-blue-500 transition-colors">
                <span className="material-icons">keyboard_voice</span>
              </button>
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-50 shadow-lg shadow-blue-600/30 hover:scale-110 transition-transform"
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
