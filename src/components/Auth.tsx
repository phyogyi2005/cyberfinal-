
import React, { useState } from 'react';
import { User, KnowledgeLevel } from '../types';
import { api } from '../services/geminiService';

interface AuthProps {
  onLogin: (user: User, token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<KnowledgeLevel>(KnowledgeLevel.Beginner);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = isRegister 
        ? await api.register({ name, email, password, knowledgeLevel: level })
        : await api.login({ email, password });
      
      onLogin(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-cyber-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-cyber-800 rounded-xl shadow-2xl overflow-hidden p-8 transition-colors">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-cyber-900 dark:text-white">Cyber Advisor</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Database Secure Access</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border dark:bg-cyber-900 dark:border-cyber-700"
              placeholder="Full Name"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border dark:bg-cyber-900 dark:border-cyber-700"
            placeholder="Email Address"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border dark:bg-cyber-900 dark:border-cyber-700"
            placeholder="Password"
          />
          {isRegister && (
            <select 
              value={level} 
              onChange={(e) => setLevel(e.target.value as KnowledgeLevel)}
              className="w-full px-4 py-2 rounded-lg border dark:bg-cyber-900 dark:border-cyber-700"
            >
              <option value={KnowledgeLevel.Beginner}>Beginner</option>
              <option value={KnowledgeLevel.Intermediate}>Intermediate</option>
              <option value={KnowledgeLevel.Advanced}>Advanced</option>
            </select>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-cyber-500 text-white font-semibold rounded-lg hover:bg-cyber-600 transition-colors"
          >
            {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-cyber-500 font-medium">
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  );
};
