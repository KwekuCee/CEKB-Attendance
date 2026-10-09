import React, { useState } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Button } from './Button';
import { confirmPasswordReset } from '../lib/supabaseService';

interface ResetPasswordScreenProps {
  token: string;
  onDone: () => void;
}

/** Page an admin lands on from the reset link, to choose a new password. */
export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ token, onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setFeedback({ type: 'error', message: 'Use at least 8 characters for your new password.' });
      return;
    }
    if (password !== confirm) {
      setFeedback({ type: 'error', message: 'The two passwords do not match.' });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    const res = await confirmPasswordReset(token, password);
    setIsSaving(false);
    setFeedback({ type: res.success ? 'success' : 'error', message: res.message });
    if (res.success) {
      setTimeout(onDone, 2200);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <ChurchLogo className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm mx-auto mb-3" alt="CEKB Logo" />
          <h1 className="font-display text-2xl text-slate-900 font-extrabold tracking-tight mb-1">
            Create a new password
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Choose a new password for your account.
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs mb-4 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">New password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Repeat new password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-blue-600"
            />
          </div>
          <Button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3.5 rounded-xl transition-all disabled:opacity-60 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save new password'}
          </Button>
        </form>

        <Button variant="ghost"
          onClick={onDone}
          className="w-full mt-4 text-xs text-slate-500 font-semibold hover:text-slate-800 cursor-pointer"
        >
          Back to sign in
        </Button>
      </div>
    </div>
  );
};
