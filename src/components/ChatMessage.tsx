
import React, { useState } from 'react';
import { Message, MessageType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  userName?: string;
  language?: 'en' | 'my';
  onQuizAnswer?: (answer: string, isCorrect: boolean) => void;
  onExplainRequest?: (prompt: string) => void;
  isLast?: boolean;
}

const COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'];

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, userName, language = 'en', onQuizAnswer, onExplainRequest, isLast }) => {
  const isUser = message.role === 'user';
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(message.analysisData || message.content, null, 2));
    alert("Report copied to clipboard!");
  };

  const handleQuizSubmit = (index: number) => {
    if (quizSubmitted || !message.quizData) return;
    setSelectedOption(index);
    setQuizSubmitted(true);
    const isCorrect = index === message.quizData.correctAnswerIndex;
    if (onQuizAnswer) onQuizAnswer(message.quizData.options[index], isCorrect);
  };

  const BotAvatar = () => (
    <div className="w-8 h-8 shrink-0">
       <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="avatarShieldGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="url(#avatarShieldGrad)" />
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
  );

  const UserAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
      <span className="material-icons text-slate-500 text-sm">person</span>
    </div>
  );

  const renderContent = () => {
    if (message.type === MessageType.QUIZ && message.quizData) {
      const { question, options, correctAnswerIndex, explanation } = message.quizData;
      return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full">
          <h3 className="text-lg font-bold mb-4 dark:text-white">{question}</h3>
          <div className="space-y-2">
            {options.map((option, idx) => (
              <button
                key={idx}
                disabled={quizSubmitted}
                onClick={() => handleQuizSubmit(idx)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  quizSubmitted
                    ? idx === correctAnswerIndex
                      ? 'bg-green-500/10 border-green-500 text-green-500 font-semibold'
                      : selectedOption === idx
                      ? 'bg-red-500/10 border-red-500 text-red-500'
                      : 'border-slate-100 dark:border-slate-800 opacity-50'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:text-slate-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {quizSubmitted && (
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400 italic">
              {explanation}
            </div>
          )}
        </div>
      );
    }

    if (message.type === MessageType.ANALYSIS && message.analysisData) {
      const { score, chartData, findings, riskLevel } = message.analysisData;
      
      return (
        <div className="w-full max-w-3xl bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-6 md:p-8">
          {/* Header Row */}
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-[0.2em]">
               <span className="material-icons text-base">analytics</span> THREAT ANALYSIS
             </div>
             <div className="text-amber-500 font-bold text-xl md:text-2xl drop-shadow-lg">
               {language === 'my' ? 'အန္တရာယ်အလွန်ကြီးမား' : 'HIGH RISK DETECTED'}
             </div>
          </div>

          {/* Main Visual Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-10">
            {/* Left: Donut Chart with dynamic labels */}
            <div className="relative h-64 flex flex-col items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="85%"
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              
              {/* Overlay labels on chart as seen in screenshot */}
              <div className="absolute inset-0 flex flex-col justify-center items-start pl-8 pointer-events-none space-y-2">
                 {chartData.map((d, i) => (
                   <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill || COLORS[i % COLORS.length] }}></div>
                      <span className="text-[10px] text-white font-medium opacity-90">{d.name}</span>
                   </div>
                 ))}
              </div>
            </div>

            {/* Right: Oversized Score & Summary */}
            <div className="flex flex-col">
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-[100px] md:text-[130px] font-black leading-none text-red-500 tracking-tighter">
                  {score}
                </span>
                <div className="flex flex-col -mb-4">
                   <span className="text-slate-400 font-bold text-sm md:text-base uppercase tracking-widest">
                    SECURITY
                  </span>
                   <span className="text-slate-400 font-bold text-sm md:text-base uppercase tracking-widest">
                    SCORE
                  </span>
                </div>
              </div>
              <ul className="space-y-2">
                {findings.slice(0, 3).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="text-amber-500 mt-1">•</span>
                    {f.category}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Findings Section */}
          <div className="space-y-6">
            <h4 className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-4">DETAILED FINDINGS</h4>
            {findings.map((finding, idx) => (
              <div key={idx} className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden relative">
                 <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                   idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-red-500' : 'bg-blue-500'
                 }`}></div>
                 <div className="p-5 pl-8">
                    <h5 className="text-slate-400 font-black text-xs uppercase mb-2 tracking-wide">
                      {finding.category}
                    </h5>
                    <p className="text-white text-sm leading-relaxed font-medium">
                      {finding.details}
                    </p>
                 </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-blue-500/30 text-blue-400 font-bold text-xs hover:bg-blue-500/10 transition-all uppercase tracking-widest">
              <span className="material-icons text-sm">visibility</span> Explain Simply
            </button>
            <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#4c1d95] to-[#7c3aed] text-white font-bold text-xs hover:opacity-90 transition-all uppercase tracking-widest shadow-lg shadow-purple-900/20">
              <span className="material-icons text-sm">auto_awesome</span> Detailed View
            </button>
          </div>

          <button 
            onClick={copyToClipboard}
            className="w-full mt-4 flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-[#1e293b] text-slate-200 font-bold text-xs hover:bg-slate-700 transition-all uppercase tracking-widest border border-slate-700"
          >
            <span className="material-icons text-base">description</span> Copy Analysis Report
          </button>
        </div>
      );
    }

    return (
      <div className={`px-4 py-3 rounded-2xl max-w-full ${
        isUser 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 shadow-sm'
      }`}>
        {/* Fix: className is not a valid prop for ReactMarkdown in recent versions. Using a wrapper div for styling. */}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
          <ReactMarkdown>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex gap-4 mb-8 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="mt-1">
        {isUser ? <UserAvatar /> : <BotAvatar />}
      </div>
      <div className={`flex flex-col max-w-[90%] md:max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="mb-1">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
             {isUser ? (userName || 'User') : 'Cyber Advisor'}
           </span>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};
