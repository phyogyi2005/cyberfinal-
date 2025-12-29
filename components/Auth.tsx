import React, { useState } from 'react';
import { User, KnowledgeLevel } from '../types';
import { api } from '../services/geminiService'; // 👈 API ကို ဒီမှာ လှမ်းခေါ်ထားပါတယ်

interface AuthProps {
  onLogin: (user: User, token: string) => void; // 👈 Token ပါ လက်ခံဖို့ ပြင်လိုက်ပါတယ်
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<KnowledgeLevel>(KnowledgeLevel.Beginner);
  const [error, setError] = useState<string | null>(null); // Error ပြဖို့
  const [loading, setLoading] = useState(false); // Loading ပြဖို့

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // ✅ Page Refresh မဖြစ်အောင် တားဆီးခြင်း
    setError(null);
    setLoading(true);

    try {
      let data;
      if (isRegister) {
        // အကောင့်အသစ်ဖွင့်ရန် Backend ကို လှမ်းခေါ်ခြင်း
        data = await api.register({ name, email, password, knowledgeLevel: level });
      } else {
        // အကောင့်ဝင်ရန် (Login) Backend ကို လှမ်းခေါ်ခြင်း
        data = await api.login({ email, password });
      }
      
      // Backend က ပြန်ပေးတဲ့ User နဲ့ Token ကို App ဆီ ပြန်ပို့ခြင်း
      if (data.user && data.token) {
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      console.error(err);
      // Backend က ပို့လိုက်တဲ့ Error စာသားကို ပြသခြင်း
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden p-8 transition-colors">
        
        <div className="text-center mb-8">
            <div className="mx-auto h-20 w-20 mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-all duration-300">
             <span className="material-icons text-4xl text-white">security</span>
          </div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Cyber Advisor</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-xs font-bold uppercase tracking-widest">Your Security Assistant</p>
        </div>

        {/* 🔴 Error တက်ရင် စာနီနီလေး ပေါ်လာမယ့် နေရာ */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
              placeholder="••••••••"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Knowledge Level</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(KnowledgeLevel).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg border transition-all ${
                      level === lvl
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
          >
            {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(null); }}
            className="text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors uppercase tracking-wide"
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  );
};
