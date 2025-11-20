import React, { useState } from 'react';
import { Message, MessageType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  userName?: string;
  language?: 'en' | 'my';
  onQuizAnswer?: (answer: string, isCorrect: boolean) => void;
  onExplainRequest?: (prompt: string) => void;
  isLast?: boolean;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

// Translation dictionary for Analysis UI
const i18n = {
  en: {
    threatAnalysis: "Threat Analysis",
    risk: "RISK",
    securityScore: "Security Score",
    detailedFindings: "Detailed Findings",
    explainSimply: "Explain Simply",
    detailedView: "Detailed View",
    copyReport: "Copy Analysis Report",
    reportHeader: "Cyber Advisor - Security Analysis Report",
    riskLevel: "Risk Level",
    score: "Score",
    findings: "Findings",
    breakdown: "Threat Breakdown",
    verified: "Verified by Cyber Advisor"
  },
  my: {
    threatAnalysis: "ခြိမ်းခြောက်မှု ဆန်းစစ်ချက်",
    risk: "အန္တရာယ်",
    securityScore: "လုံခြုံရေး ရမှတ်",
    detailedFindings: "အသေးစိတ် တွေ့ရှိချက်များ",
    explainSimply: "ရိုးရှင်းစွာ ရှင်းပြပါ",
    detailedView: "အသေးစိတ် ကြည့်ရန်",
    copyReport: "အစီရင်ခံစာ ကူးယူပါ",
    reportHeader: "Cyber Advisor - လုံခြုံရေး ဆန်းစစ်ချက် အစီရင်ခံစာ",
    riskLevel: "အန္တရာယ် အဆင့်",
    score: "ရမှတ်",
    findings: "တွေ့ရှိချက်များ",
    breakdown: "ခြိမ်းခြောက်မှု အသေးစိတ်",
    verified: "Cyber Advisor မှ စစ်ဆေးအတည်ပြုသည်"
  }
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, userName, language = 'en', onQuizAnswer, onExplainRequest, isLast }) => {
  const isUser = message.role === 'user';
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const t = i18n[language];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleQuizSubmit = (index: number) => {
    if (quizSubmitted || !message.quizData) return;
    setSelectedOption(index);
    setQuizSubmitted(true);
    const isCorrect = index === message.quizData.correctAnswerIndex;
    if (onQuizAnswer) onQuizAnswer(message.quizData.options[index], isCorrect);
  };

  const handleCopyReport = () => {
    if (!message.analysisData) return;
    const riskLevel = message.analysisData.riskLevel || 'Unknown';
    const score = message.analysisData.score || 0;
    const findings = message.analysisData.findings || [];
    const chartData = message.analysisData.chartData || [];
    
    const report = `${t.reportHeader}
----------------------------------------
${t.riskLevel}: ${riskLevel.toUpperCase()}
${t.securityScore}: ${score}/100

${t.findings}:
${findings.map(f => `- [${f.category}] ${f.details}`).join('\n')}

${t.breakdown}:
${chartData.map(c => `- ${c.name}: ${c.value}`).join('\n')}

${t.verified}`;

    navigator.clipboard.writeText(report);
  };

  // --- Avatar Components ---
  const BotAvatar = () => (
    <div className="w-9 h-9 md:w-11 md:h-11 shrink-0 drop-shadow-md transform hover:scale-110 transition-transform duration-200">
       {/* Exact Logo - No container background */}
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
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shadow-lg shrink-0 border-2 border-white dark:border-cyber-800 mt-0.5">
      {userName ? (
         <span className="text-white font-bold text-xs md:text-sm uppercase">{userName.slice(0,2)}</span>
      ) : (
         <span className="material-icons text-white text-sm md:text-xl">person</span>
      )}
    </div>
  );


  // --- Render Content based on Type ---
  const renderContent = () => {
    // Quiz UI
    if (message.type === MessageType.QUIZ && message.quizData) {
      const { question, options, correctAnswerIndex, explanation } = message.quizData;
      const isCorrect = selectedOption === correctAnswerIndex;

      return (
        <div className="flex flex-col items-center w-full">
           {message.content && message.content.trim() !== "Here is the next question:" && (
            <div className="w-full mb-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg text-slate-700 dark:text-slate-300 text-sm">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}

          <div className="w-full bg-white dark:bg-cyber-800 rounded-2xl shadow-lg overflow-hidden border border-slate-200 dark:border-cyber-700">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyber-500 to-blue-600 p-4 md:p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                <span className="material-icons text-8xl">quiz</span>
              </div>
              <div className="relative z-10">
                 <span className="inline-block py-1 px-2 rounded bg-white/20 backdrop-blur-sm text-[10px] font-bold tracking-wide mb-2 border border-white/10">
                   LIVE QUIZ
                 </span>
                 <h3 className="text-lg md:text-xl font-bold leading-tight">{question}</h3>
              </div>
            </div>

            {/* Options */}
            <div className="p-4 md:p-6 space-y-2 md:space-y-3">
              {options.map((option, idx) => {
                let containerClass = "relative group w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 md:gap-4 ";
                let icon = <span className="material-icons text-slate-400 text-lg group-hover:text-cyber-500">radio_button_unchecked</span>;
                
                if (quizSubmitted) {
                  if (idx === correctAnswerIndex) {
                    containerClass += "border-green-500 bg-green-50 dark:bg-green-900/20 ";
                    icon = <span className="material-icons text-green-500 text-lg">check_circle</span>;
                  } else if (idx === selectedOption) {
                    containerClass += "border-red-500 bg-red-50 dark:bg-red-900/20 ";
                    icon = <span className="material-icons text-red-500 text-lg">cancel</span>;
                  } else {
                    containerClass += "border-slate-100 dark:border-cyber-700 opacity-50 ";
                    icon = <span className="material-icons text-slate-300 text-lg">radio_button_unchecked</span>;
                  }
                } else {
                  containerClass += "border-slate-100 dark:border-cyber-700 hover:border-cyber-500 hover:bg-cyber-50 dark:hover:bg-cyber-900 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 cursor-pointer";
                }

                return (
                  <button
                    key={idx}
                    disabled={quizSubmitted}
                    onClick={() => handleQuizSubmit(idx)}
                    className={containerClass}
                  >
                    <div className="flex-shrink-0 flex items-center">
                       {icon}
                    </div>
                    <span className={`font-medium text-sm md:text-base ${
                      quizSubmitted && idx === correctAnswerIndex ? 'text-green-700 dark:text-green-400' :
                      quizSubmitted && idx === selectedOption ? 'text-red-700 dark:text-red-400' :
                      'text-slate-700 dark:text-slate-200'
                    }`}>
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {quizSubmitted && (
              <div className={`p-4 md:p-6 border-t border-slate-100 dark:border-cyber-700 ${
                isCorrect ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-red-50/50 dark:bg-red-900/10'
              }`}>
                <div className="flex gap-3">
                  <span className={`material-icons text-xl md:text-2xl ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                    {isCorrect ? 'emoji_events' : 'info'}
                  </span>
                  <div>
                    <h4 className={`font-bold text-sm mb-1 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {isCorrect ? 'Correct!' : 'Not quite right'}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Analysis UI
    if (message.type === MessageType.ANALYSIS && message.analysisData) {
      const riskLevel = message.analysisData.riskLevel || 'Unknown';
      const score = message.analysisData.score ?? 0;
      const findings = message.analysisData.findings || [];
      const chartData = message.analysisData.chartData || [];
      
      // Dynamic Color Logic
      const isHighRisk = ['High', 'Critical'].includes(riskLevel);
      const isSafe = ['Safe', 'Low'].includes(riskLevel);
      
      const riskColor = isSafe ? 'text-green-500' : isHighRisk ? 'text-red-500' : 'text-yellow-500';
      const borderColor = isSafe ? 'border-green-500' : isHighRisk ? 'border-red-500' : 'border-yellow-500';

      return (
        <div className="w-full max-w-2xl bg-white dark:bg-cyber-800 rounded-2xl shadow-md border border-slate-100 dark:border-cyber-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-cyber-700 bg-slate-50/50 dark:bg-black/20">
            <div className="flex items-center gap-2 text-cyber-500 font-bold uppercase text-xs tracking-wider">
              <span className="material-icons text-sm">analytics</span> {t.threatAnalysis}
            </div>
            <div className={`text-base md:text-lg font-bold ${riskColor}`}>{riskLevel.toUpperCase()} {language === 'my' && t.risk}</div>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="h-40 w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: isHighRisk ? '#7f1d1d' : '#0f172a', 
                            borderColor: isHighRisk ? '#ef4444' : '#334155', 
                            color: '#fff', 
                            borderRadius: '8px' 
                        }} 
                        itemStyle={{ color: '#fff' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center items-center sm:items-start">
                 <div className="text-center sm:text-left mb-4">
                   <span className={`text-4xl font-bold ${riskColor}`}>{score}</span>
                   <span className="text-slate-400 text-xs block uppercase tracking-wide">{t.securityScore}</span>
                 </div>
                 <div className="space-y-1 w-full">
                    {findings.slice(0, 3).map((f, i) => (
                      <div key={i} className="text-xs flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className={`w-1 h-1 rounded-full ${isHighRisk ? 'bg-red-500' : isSafe ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        <span className="truncate">{f.category}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">{t.detailedFindings}</h4>
              {findings.map((f, i) => (
                 <div 
                    key={i} 
                    className={`group p-3 bg-slate-50 dark:bg-cyber-900 rounded border-l-2 transition-colors duration-200 ${
                        isHighRisk ? 'border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 
                        isSafe ? 'border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 
                        'border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                    }`}
                 >
                   <span className={`text-xs font-bold block mb-0.5 transition-colors ${
                       isHighRisk ? 'text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400' : 
                       isSafe ? 'text-slate-500 group-hover:text-green-600 dark:group-hover:text-green-400' : 
                       'text-slate-500 group-hover:text-yellow-600 dark:group-hover:text-yellow-400'
                   }`}>
                       {f.category.toUpperCase()}
                   </span>
                   <p className={`text-sm transition-colors ${
                       isHighRisk ? 'text-slate-700 dark:text-slate-300 group-hover:text-red-700 dark:group-hover:text-red-300' : 
                       isSafe ? 'text-slate-700 dark:text-slate-300 group-hover:text-green-700 dark:group-hover:text-green-300' : 
                       'text-slate-700 dark:text-slate-300'
                   }`}>
                       {f.details}
                   </p>
                 </div>
              ))}
            </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <button
                 onClick={() => onExplainRequest?.(language === 'my' ? "ဒါကို ရိုးရှင်းစွာ ရှင်းပြပေးပါ။" : "Can you explain these findings in simple terms?")}
                 className="py-2 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2"
               >
                 <span className="material-icons text-sm">child_care</span> {t.explainSimply}
               </button>
               <button
                 onClick={() => onExplainRequest?.(language === 'my' ? "နည်းပညာပိုင်းဆိုင်ရာ အသေးစိတ် ရှင်းပြပေးပါ။" : "Please provide a detailed technical explanation of these findings and mitigation steps.")}
                 className="py-2 px-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors flex items-center justify-center gap-2"
               >
                 <span className="material-icons text-sm">psychology</span> {t.detailedView}
               </button>
             </div>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-cyber-700 bg-slate-50 dark:bg-cyber-900/50">
             <button 
               onClick={handleCopyReport}
               className="w-full py-2 px-4 flex items-center justify-center gap-2 bg-white dark:bg-cyber-800 border border-slate-200 dark:border-cyber-600 hover:bg-slate-50 dark:hover:bg-cyber-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
             >
                <span className="material-icons text-sm">description</span> {t.copyReport}
             </button>
          </div>
        </div>
      );
    }

    // Default Text UI
    return (
      <div className={`relative group max-w-full md:max-w-2xl lg:max-w-3xl rounded-2xl px-5 py-4 shadow-sm border ${
        isUser 
          ? 'bg-cyber-500 text-white rounded-tr-none border-cyber-600' 
          : 'bg-white dark:bg-cyber-800 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-100 dark:border-cyber-700'
      }`}>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              att.type === 'image' ? (
                 <img key={i} src={`data:${att.mimeType};base64,${att.data}`} alt="upload" className="max-h-48 rounded-lg border border-white/20" />
              ) : (
                 <div key={i} className="flex items-center p-2 bg-black/10 rounded text-sm">
                   <span className="material-icons mr-2 text-base">description</span> {att.name}
                 </div>
              )
            ))}
          </div>
        )}
        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'dark:prose-invert'} leading-relaxed`}>
          <ReactMarkdown components={{
            strong: ({node, ...props}) => <span className={`${isUser ? 'text-yellow-200' : 'text-cyber-600 dark:text-cyber-400'} font-bold`} {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />
          }}>
            {message.content}
          </ReactMarkdown>
        </div>
        
        {!isUser && (
           <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onClick={copyToClipboard} className="p-1.5 bg-slate-100 dark:bg-black/30 rounded-md text-xs flex items-center hover:text-cyber-500 transition-colors" title="Copy">
               <span className="material-icons text-[14px]">content_copy</span>
             </button>
           </div>
        )}
      </div>
    );
  };

  // --- Main Container ---
  return (
    <div className={`flex gap-3 md:gap-4 mb-6 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        {isUser ? <UserAvatar /> : <BotAvatar />}
      </div>

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Name Label (Optional, for group chat feel) */}
        <span className="text-[10px] text-slate-400 mb-1 px-1">
          {isUser ? 'You' : 'Cyber Advisor'}
        </span>

        {/* Render the actual content */}
        {renderContent()}
      </div>
    </div>
  );
};