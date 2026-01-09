// import React, { useState } from 'react';
// import { User, KnowledgeLevel } from '../types';
// import { api } from '../services/geminiService'; // 👈 API ကို ဒီမှာ လှမ်းခေါ်ထားပါတယ်

// interface AuthProps {
//   onLogin: (user: User, token: string) => void; // 👈 Token ပါ လက်ခံဖို့ ပြင်လိုက်ပါတယ်
// }

// export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
//   const [isRegister, setIsRegister] = useState(false);
//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [level, setLevel] = useState<KnowledgeLevel>(KnowledgeLevel.Beginner);
//   const [error, setError] = useState<string | null>(null); // Error ပြဖို့
//   const [loading, setLoading] = useState(false); // Loading ပြဖို့

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault(); // ✅ Page Refresh မဖြစ်အောင် တားဆီးခြင်း
//     setError(null);
//     setLoading(true);

//     try {
//       let data;
//       if (isRegister) {
//         // အကောင့်အသစ်ဖွင့်ရန် Backend ကို လှမ်းခေါ်ခြင်း
//         data = await api.register({ name, email, password, knowledgeLevel: level });
//       } else {
//         // အကောင့်ဝင်ရန် (Login) Backend ကို လှမ်းခေါ်ခြင်း
//         data = await api.login({ email, password });
//       }
      
//       // Backend က ပြန်ပေးတဲ့ User နဲ့ Token ကို App ဆီ ပြန်ပို့ခြင်း
//       if (data.user && data.token) {
//         onLogin(data.user, data.token);
//       }
//     } catch (err: any) {
//       console.error(err);
//       // Backend က ပို့လိုက်တဲ့ Error စာသားကို ပြသခြင်း
//       setError(err.message || 'Authentication failed');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4 transition-colors duration-300">
//       <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden p-8 transition-colors">
        
//         {/* <div className="text-center mb-8">
//             <div className="mx-auto h-20 w-20 mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-all duration-300">
//              <span className="material-icons text-4xl text-white">security</span>
//           </div>
//           <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">Cyber Advisor</h2>
//           <p className="text-slate-500 dark:text-slate-400 mt-2 text-xs font-bold uppercase tracking-widest">Your Security Assistant</p>
//         </div> */}
//          <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-cyber-900 px-4">
//       <div className="max-w-md w-full bg-white dark:bg-cyber-800 rounded-xl shadow-2xl overflow-hidden p-8 transition-colors">
//         <div className="text-center mb-8">
//           <div className="mx-auto h-24 w-24 mb-4 drop-shadow-2xl transform hover:scale-105 transition-transform duration-300">
//              {/* Robot Circle Logo */}
//              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-lg">
//               <defs>
//                 <linearGradient id="robotShieldGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
//                   <stop offset="0%" stopColor="#ef4444" /> {/* Red */}
//                   <stop offset="50%" stopColor="#a855f7" /> {/* Purple */}
//                   <stop offset="100%" stopColor="#3b82f6" /> {/* Blue */}
//                 </linearGradient>
//               </defs>
              
//               {/* Circle Background */}
//               <circle cx="32" cy="32" r="30" fill="url(#robotShieldGrad)" />
              
//               {/* Robot Silhouette */}
//               <g fill="white">
//                 {/* Antenna */}
//                 <rect x="31" y="14" width="2" height="8" rx="1" />
//                 <circle cx="32" cy="12" r="3" />
                
//                 {/* Head */}
//                 <rect x="20" y="22" width="24" height="18" rx="5" />
                
//                 {/* Eyes */}
//                 <circle cx="27" cy="30" r="3" fill="#1e293b" />
//                 <circle cx="37" cy="30" r="3" fill="#1e293b" />
                
//                 {/* Body/Shoulders */}
//                 <path d="M20 44C20 44 22 52 32 52C42 52 44 44 44 44H20Z" />
//               </g>
//             </svg>
//           </div>
//           <h2 className="text-3xl font-bold text-cyber-900 dark:text-white tracking-tight">Cyber Advisor</h2>
//           <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Your Personal Cybersecurity Assistant</p>
//         </div>

//         {/* 🔴 Error တက်ရင် စာနီနီလေး ပေါ်လာမယ့် နေရာ */}
//         {error && (
//           <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-xs font-bold text-center">
//             {error}
//           </div>
//         )}

//         <form onSubmit={handleSubmit} className="space-y-6">
//           {isRegister && (
//             <div>
//               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
//               <input
//                 type="text"
//                 required
//                 value={name}
//                 onChange={(e) => setName(e.target.value)}
//                 className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
//                 placeholder="John Doe"
//               />
//             </div>
//           )}

//           <div>
//             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
//             <input
//               type="email"
//               required
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
//               placeholder="john@example.com"
//             />
//           </div>

//           <div>
//             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
//             <input
//               type="password"
//               required
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
//               placeholder="••••••••"
//             />
//           </div>

//           {isRegister && (
//             <div>
//               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Knowledge Level</label>
//               <div className="grid grid-cols-3 gap-2">
//                 {Object.values(KnowledgeLevel).map((lvl) => (
//                   <button
//                     key={lvl}
//                     type="button"
//                     onClick={() => setLevel(lvl)}
//                     className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg border transition-all ${
//                       level === lvl
//                         ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
//                         : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'
//                     }`}
//                   >
//                     {lvl}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
//           >
//             {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
//           </button>
//         </form>

//         <div className="mt-6 text-center">
//           <button
//             onClick={() => { setIsRegister(!isRegister); setError(null); }}
//             className="text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors uppercase tracking-wide"
//           >
//             {isRegister ? 'Already have an account? Sign In' : 'Need an account? Create one'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };
import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/geminiService';

interface AuthProps {
  onLogin: (user: User, token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 🔐 Confirm Password
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // 🔴 Password Validation
    if (isRegister) {
      // 1. Password Length Check
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      
      // 2. Password Match Check
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      // 3. Password Strength (Optional)
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        setError('Password should contain uppercase, lowercase letters and numbers');
        return;
      }
    }
    
    setLoading(true);

    try {
      let data;
      if (isRegister) {
        // Remove knowledgeLevel from the payload
        data = await api.register({ 
          name, 
          email, 
          password 
          // knowledgeLevel removed
        });
      } else {
        data = await api.login({ email, password });
      }
      
      if (data.user && data.token) {
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset form when switching between login/register
  const handleToggleForm = () => {
    setIsRegister(!isRegister);
    setError(null);
    setPassword('');
    setConfirmPassword(''); // Reset confirm password
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden p-8 transition-colors">
        <div className="text-center mb-8">
          <div className="mx-auto h-24 w-24 mb-4 drop-shadow-2xl transform hover:scale-105 transition-transform duration-300">
            {/* Robot Circle Logo */}
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-lg">
              <defs>
                <linearGradient id="robotShieldGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              
              <circle cx="32" cy="32" r="30" fill="url(#robotShieldGrad)" />
              
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
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Cyber Advisor</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Your Personal Cybersecurity Assistant</p>
        </div>

        {/* Error Message */}
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
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Password
              {isRegister && (
                <span className="text-[9px] text-slate-400 ml-2">
                  (Min 6 chars, upper/lowercase, number)
                </span>
              )}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
              placeholder="••••••••"
            />
            
            {/* Password Strength Indicator */}
            {isRegister && password.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-1 flex-1 rounded-full ${password.length >= 6 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div className={`h-1 flex-1 rounded-full ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div className={`h-1 flex-1 rounded-full ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div className={`h-1 flex-1 rounded-full ${/\d/.test(password) ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Length • Uppercase • Lowercase • Number
                </p>
              </div>
            )}
          </div>

          {/* 🔐 Confirm Password Field (Only for Register) */}
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Confirm Password
                {confirmPassword && password === confirmPassword && (
                  <span className="text-green-500 ml-2">✓</span>
                )}
                {confirmPassword && password !== confirmPassword && (
                  <span className="text-red-500 ml-2">✗</span>
                )}
              </label>
              <input
                type="password"
                required={isRegister}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 outline-none transition-all font-medium text-sm ${
                  confirmPassword
                    ? password === confirmPassword
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-red-500 focus:ring-red-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                }`}
                placeholder="Re-enter password"
              />
              
              {/* Password Match Status */}
              {confirmPassword && (
                <p className={`text-[10px] mt-1 ${
                  password === confirmPassword ? 'text-green-500' : 'text-red-500'
                }`}>
                  {password === confirmPassword 
                    ? '✓ Passwords match' 
                    : '✗ Passwords do not match'}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              isRegister ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
          <button
            onClick={handleToggleForm}
            className="text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors uppercase tracking-wide"
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  );
};
