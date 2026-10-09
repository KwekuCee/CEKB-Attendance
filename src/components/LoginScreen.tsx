import React, { useState } from 'react';
import { PasswordInput } from './PasswordInput';
import { ChurchLogo } from './ChurchLogo';
import { sendPasswordResetEmail } from '../lib/supabaseService';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('admin@cekorlebu.org');
  const [password, setPassword] = useState('••••••••');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('admin@cekorlebu.org');
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 600);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setIsResetting(true);
    setResetFeedback(null);
    try {
      const res = await sendPasswordResetEmail(resetEmail.trim());
      if (res.success) {
        setResetFeedback({ type: 'success', message: res.message });
      } else {
        setResetFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setResetFeedback({ type: 'error', message: err?.message || 'Failed to dispatch reset link.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 font-body relative overflow-hidden">


      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10 z-10 relative">

        {/* Header */}
        <div className="text-center mb-8">
          <ChurchLogo className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm mx-auto mb-3" alt="CEKB Logo" />
          <h1 className="font-display text-2xl md:text-3xl text-slate-900 font-extrabold tracking-tight mb-1">
            CEKB Group
          </h1>
          <p className="font-body text-xs text-slate-500 font-medium">
            Administrative Access Portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email or Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Email or Phone Number
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                person
              </span>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@cekorlebu.org"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 font-body text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-500 ">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                lock
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 font-body text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Need system credentials?{' '}
            <button
              onClick={() => alert('Please contact the CEKB Central IT Administrator at admin@cekorlebu.org or +233 24 123 4567.')}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Contact Administrator
            </button>
          </p>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
              </div>
              <h3 className="font-headline font-bold text-lg text-slate-900">Password Recovery</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Enter your registered administrator email address. A secure authorisation link will be sent to you.
            </p>

            {resetFeedback && (
              <div
                className={`p-3 rounded-xl text-xs mb-4 flex items-start gap-2 ${
                  resetFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                  {resetFeedback.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span className="leading-snug">{resetFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSendResetEmail}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Administrator Email *
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="admin@cekorlebu.org"
                  className="w-full border border-slate-200 bg-slate-50 p-2.5 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setResetFeedback(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isResetting && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
                  <span>{isResetting ? 'Dispatching...' : 'Send Reset Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
