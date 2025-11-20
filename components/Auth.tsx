import React, { useState } from 'react';
import { User, KnowledgeLevel } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<KnowledgeLevel>(KnowledgeLevel.Beginner);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock Authentication
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      knowledgeLevel: level,
    };
    onLogin(newUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-cyber-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-cyber-800 rounded-xl shadow-2xl overflow-hidden p-8 transition-colors">
        <div className="text-center mb-8">
          <div className="mx-auto h-24 w-24 mb-4 drop-shadow-2xl transform hover:scale-105 transition-transform duration-300">
             {/* Robot Circle Logo */}
             <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-lg">
              <defs>
                <linearGradient id="robotShieldGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ef4444" /> {/* Red */}
                  <stop offset="50%" stopColor="#a855f7" /> {/* Purple */}
                  <stop offset="100%" stopColor="#3b82f6" /> {/* Blue */}
                </linearGradient>
              </defs>
              
              {/* Circle Background */}
              <circle cx="32" cy="32" r="30" fill="url(#robotShieldGrad)" />
              
              {/* Robot Silhouette */}
              <g fill="white">
                {/* Antenna */}
                <rect x="31" y="14" width="2" height="8" rx="1" />
                <circle cx="32" cy="12" r="3" />
                
                {/* Head */}
                <rect x="20" y="22" width="24" height="18" rx="5" />
                
                {/* Eyes */}
                <circle cx="27" cy="30" r="3" fill="#1e293b" />
                <circle cx="37" cy="30" r="3" fill="#1e293b" />
                
                {/* Body/Shoulders */}
                <path d="M20 44C20 44 22 52 32 52C42 52 44 44 44 44H20Z" />
              </g>
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-cyber-900 dark:text-white tracking-tight">Cyber Advisor</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Your Personal Cybersecurity Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-cyber-700 bg-white dark:bg-cyber-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyber-500 outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-cyber-700 bg-white dark:bg-cyber-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyber-500 outline-none transition-all"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-cyber-700 bg-white dark:bg-cyber-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyber-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Knowledge Level</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(KnowledgeLevel).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={`px-2 py-2 text-xs sm:text-sm rounded-lg border transition-all ${
                      level === lvl
                        ? 'bg-cyber-500 text-white border-cyber-500'
                        : 'bg-slate-50 dark:bg-cyber-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-cyber-700 hover:border-cyber-500'
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
            className="w-full py-3 px-4 bg-gradient-to-r from-cyber-500 to-cyber-400 hover:from-cyber-600 hover:to-cyber-500 text-white font-semibold rounded-lg shadow-md transform transition hover:-translate-y-0.5 focus:ring-2 focus:ring-offset-2 focus:ring-cyber-500"
          >
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-cyber-500 hover:text-cyber-400 font-medium transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  );
};