import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Button } from './Button';

interface EmailVerifiedScreenProps {
  status: 'verified' | 'expired' | 'invalid';
  onContinue: () => void;
}

const COPY: Record<
  EmailVerifiedScreenProps['status'],
  { icon: string; title: string; message: string; tone: string }
> = {
  verified: {
    icon: 'mark_email_read',
    title: 'Email confirmed',
    message:
      'Thank you. Your email address is confirmed and you can now sign in to your dashboard.',
    tone: 'bg-blue-50 text-blue-700',
  },
  expired: {
    icon: 'schedule',
    title: 'Link expired',
    message:
      'This confirmation link has expired or was already used. Sign in and choose "Resend confirmation link" to get a fresh one.',
    tone: 'bg-amber-50 text-amber-700',
  },
  invalid: {
    icon: 'link_off',
    title: 'Link not valid',
    message:
      'This confirmation link is incomplete. Please open the most recent link from your inbox, or ask for a new one on the sign-in page.',
    tone: 'bg-rose-50 text-rose-700',
  },
};

export const EmailVerifiedScreen: React.FC<EmailVerifiedScreenProps> = ({ status, onContinue }) => {
  const copy = COPY[status];

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <ChurchLogo className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm mx-auto mb-4" alt="CEKB Logo" />
        <div className={`w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center ${copy.tone}`}>
          <span className="material-symbols-outlined text-[24px]">{copy.icon}</span>
        </div>
        <h1 className="font-display text-2xl text-slate-900 font-extrabold tracking-tight mb-2">
          {copy.title}
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed mb-6">{copy.message}</p>
        <Button
          onClick={onContinue}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
        >
          Go to sign in
        </Button>
      </div>
    </div>
  );
};
