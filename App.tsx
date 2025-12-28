
import React, { useState, useEffect, useRef } from 'react';
import { Auth } from './components/Auth';
import { ChatMessage } from './components/ChatMessage';
import { api, sendMessageToGemini } from './services/geminiService';
import { User, Message, ChatSession, MessageType, Attachment, ChatMode } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<'en' | 'my'>('en');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>('normal');
  const [quizCount, setQuizCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('cyberguard_user');
    const token = localStorage.getItem('cyber_token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      loadSessions();
    }
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isLoading]);

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

  const createNewSession = async (mode: ChatMode = 'normal') => {
    try {
      const session = await api.createSession('New Conversation', mode);
      setSessions([session, ...sessions]);
      setCurrentSessionId(session._id || session.id);
      setChatMode(mode);
      setQuizCount(0);
    } catch (e) {
      console.error(e);
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
    setCurrentSessionId(null);
  };

  const handleModeChange = (newMode: ChatMode) => {
    setChatMode(newMode);
    if (newMode === 'quiz') {
      setQuizCount(1);
      handleSend("Start Quiz", "Start Quiz", newMode);
    } else if (newMode === 'analysis') {
      setInput(""); 
    }
  };

  const handleSend = async (textOverride?: string, displayOverride?: string, modeOverride?: ChatMode) => {
    let textToSend = textOverride || input;
    const messageDisplay = displayOverride || textToSend;
    const attachmentsToSend = textOverride ? [] : [...attachments];

    if ((!textToSend.trim() && attachmentsToSend.length === 0) || !currentSessionId || !user) return;

    const effectiveMode = modeOverride || chatMode;
    const activeSessionIndex = sessions.findIndex(s => (s._id || s.id) === currentSessionId);
    
    if (activeSessionIndex === -1) return;

    // Optimistic Update
    const userMessage: any = {
      role: 'user',
      content: messageDisplay,
      type: MessageType.TEXT,
      timestamp: Date.now(),
      attachments: attachmentsToSend
    };

    const updatedSessions = [...sessions];
    if (!updatedSessions[activeSessionIndex].messages) updatedSessions[activeSessionIndex].messages = [];
    updatedSessions[activeSessionIndex].messages.push(userMessage);
    setSessions(updatedSessions);
    
    if (!textOverride) {
      setInput('');
      setAttachments([]);
    }
    setIsLoading(true);

    const response = await sendMessageToGemini(
      updatedSessions[activeSessionIndex].messages.slice(0, -1), 
      textToSend, 
      attachmentsToSend,
      user.knowledgeLevel,
      language,
      effectiveMode,
      currentSessionId
    );

    const aiMessage: Message = {
      role: 'model',
      content: response.text,
      type: response.type,
      timestamp: Date.now(),
      analysisData: response.analysisData,
      quizData: response.quizData
    };

    updatedSessions[activeSessionIndex].messages.push(aiMessage);
    setSessions([...updatedSessions]);
    setIsLoading(false);
  };

  const currentSession = sessions.find(s => (s._id || s.id) === currentSessionId);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#020617] overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
           <button onClick={() => createNewSession()} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest">
             New Chat
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <button key={s._id || s.id} onClick={() => setCurrentSessionId(s._id || s.id)} className={`w-full text-left p-3 rounded-xl text-[11px] font-bold uppercase truncate ${currentSessionId === (s._id || s.id) ? 'bg-blue-500/10 text-blue-500' : 'text-slate-500'}`}>
              {s.title}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800">
           <button onClick={handleLogout} className="text-xs text-red-500 font-bold uppercase tracking-widest">Sign Out</button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50">
           <div className="flex flex-col">
              <h1 className="text-base font-black text-white uppercase">Cyber Advisor</h1>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">MODE: {chatMode}</p>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => setLanguage(l => l === 'en' ? 'my' : 'en')} className="text-xs text-slate-300 font-bold uppercase">{language}</button>
             <button onClick={() => setDarkMode(!darkMode)} className="text-white"><span className="material-icons">{darkMode ? 'light_mode' : 'dark_mode'}</span></button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-[#020617]">
           <div className="max-w-4xl mx-auto">
             {currentSession?.messages?.map((msg, idx) => (
               <ChatMessage key={idx} message={msg} userName={user.name} language={language} onQuizAnswer={(ans) => handleSend(ans)} />
             ))}
             {isLoading && <div className="text-blue-500 text-[10px] font-bold animate-pulse">ANALYZING...</div>}
             <div ref={messagesEndRef} />
           </div>
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-800">
           <div className="max-w-4xl mx-auto flex flex-col gap-4">
              <div className="flex gap-2">
                {['normal', 'quiz', 'learning', 'analysis'].map(m => (
                  <button key={m} onClick={() => handleModeChange(m as ChatMode)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${chatMode === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{m}</button>
                ))}
              </div>
              <div className="flex items-center gap-4 bg-slate-800 rounded-2xl px-6 py-4">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask anything..." className="flex-1 bg-transparent border-none outline-none text-white text-sm" />
                <button onClick={() => handleSend()} disabled={!input.trim()} className="w-10 h-10 bg-blue-600 text-white rounded-xl"><span className="material-icons">send</span></button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
