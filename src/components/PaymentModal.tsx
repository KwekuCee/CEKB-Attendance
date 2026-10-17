import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { rawPortal } from '../lib/rawPortal';
import { validateGhanaPhone } from '../../supabase/functions/_shared/billing';
import type { BillingStatus } from '../../supabase/functions/_shared/billing';

interface PaymentModalProps {
  billing: BillingStatus;
  churchName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'otp' | 'waiting' | 'success';

const NETWORKS = [
  { id: 'MTN', name: 'MTN Mobile Money', short: 'MTN', color: 'from-amber-500 to-yellow-500', icon: 'smartphone' },
  { id: 'Telecel', name: 'Telecel Cash', short: 'Telecel', color: 'from-red-600 to-rose-500', icon: 'sim_card' },
  { id: 'AirtelTigo', name: 'AirtelTigo Money', short: 'AT Money', color: 'from-blue-600 to-indigo-500', icon: 'signal_cellular_alt' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  billing,
  churchName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState('MTN');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Transaction state
  const [externalRef, setExternalRef] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [pollCountdown, setPollCountdown] = useState(60);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError('');
      setLoading(false);
      setOtpCode('');
      setExternalRef(null);
      setSessionId(null);
      setPollCountdown(60);
    }
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  // Polling for transaction status while in 'waiting' step
  useEffect(() => {
    if (step !== 'waiting' || !externalRef) return;

    let active = true;
    const checkStatus = async () => {
      try {
        const res = await rawPortal({
          action: 'moolreStatus',
          externalRef,
        });

        if (!active) return;

        if (res?.success && res?.status === 'paid') {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          setStep('success');
          onSuccess();
        } else if (res?.status === 'failed') {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          setError(res?.error?.message || res?.error || 'Payment was declined or timed out.');
          setStep('form');
        }
      } catch (err: any) {
        console.warn('Status poll check failed:', err);
      }
    };

    // Run first check after 2 seconds, then poll every 3 seconds
    const initialTimer = window.setTimeout(checkStatus, 2000);
    pollTimerRef.current = window.setInterval(checkStatus, 3000);

    const countdownTimer = window.setInterval(() => {
      setPollCountdown((prev) => {
        if (prev <= 1) {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          setError('Payment confirmation timed out. If you authorized the charge, tap "Check Status" or refresh.');
          setStep('form');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      window.clearInterval(countdownTimer);
    };
  }, [step, externalRef, onSuccess]);

  if (!isOpen) return null;

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const phoneCheck = validateGhanaPhone(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await rawPortal({
        action: 'moolreInitiate',
        churchName,
        period: billing.period,
        phone: phoneCheck.formatted,
        network,
      });

      setLoading(false);
      if (!res?.success) {
        setError(res?.error?.message || res?.error || 'Could not initiate mobile payment. Please try again.');
        return;
      }

      setExternalRef(res.externalRef);
      setMaskedPhone(res.maskedPhone || phoneCheck.formatted);
      if (res.sessionId) setSessionId(res.sessionId);

      if (res.needsOtp) {
        setStep('otp');
      } else {
        setStep('waiting');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Could not connect to payment gateway.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setError('Enter the 4-6 digit OTP sent to your phone.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await rawPortal({
        action: 'moolreVerifyOtp',
        externalRef,
        otpCode: otpCode.trim(),
        sessionId,
      });

      setLoading(false);
      if (res?.success && res?.status === 'paid') {
        setStep('success');
        onSuccess();
      } else {
        setError(res?.error?.message || res?.error || 'Invalid OTP code. Please check and try again.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Verification failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold font-serif">Moolre Mobile Payment</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {churchName} · {billing.periodLabel || billing.period}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: FORM */}
        {step === 'form' && (
          <form onSubmit={handleInitiate} className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Amount to pay</span>
                <span className="text-xl sm:text-2xl font-black font-serif text-blue-700 dark:text-blue-400">
                  GH₵ {billing.amount}.00
                </span>
              </div>
              <span className="rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-xs px-2.5 py-1 font-semibold">
                1 Month Access
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Select Mobile Money Network
              </label>
              <div className="grid grid-cols-3 gap-2">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNetwork(n.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                      network === n.id
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 shadow-sm ring-2 ring-blue-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl mb-1 text-slate-700 dark:text-slate-300">
                      {n.icon}
                    </span>
                    <span>{n.short}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Mobile Money Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-lg">
                  call
                </span>
                <input
                  type="tel"
                  placeholder="e.g. 0244 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                A payment prompt will be sent directly to this phone.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading} className="min-w-[140px]">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Connecting...
                  </span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">bolt</span>
                    Pay GH₵ {billing.amount}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <span className="material-symbols-outlined text-xl text-amber-600 dark:text-amber-400 shrink-0">
                security
              </span>
              <div>
                <p className="font-bold">Authorization Token / OTP Required</p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                  {network === 'Telecel'
                    ? 'Please dial *110# on your Telecel phone to generate your cash voucher or enter the SMS code.'
                    : `Please enter the OTP sent to your phone (${maskedPhone}).`}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Verification Code / Token
              </label>
              <input
                type="text"
                placeholder="Enter 4-6 digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-4 py-3 text-center tracking-widest font-mono text-lg rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Back to change number
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Verifying...' : 'Authorize Payment'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: WAITING FOR USSD APPROVAL */}
        {step === 'waiting' && (
          <div className="mt-6 text-center space-y-4">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 dark:bg-blue-950/60 border border-blue-500/30 text-blue-600">
              <span className="material-symbols-outlined text-4xl animate-pulse">phonelink_ring</span>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600" />
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-bold">Approve on Your Phone</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                A prompt has been sent to <strong className="text-slate-900 dark:text-slate-100">{maskedPhone}</strong>.
                Enter your Mobile Money PIN to approve the GH₵ {billing.amount}.00 charge.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 max-w-xs mx-auto border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent" />
              <span>Waiting for confirmation ({pollCountdown}s)...</span>
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
                  setStep('form');
                }}
              >
                Change Number or Cancel
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'success' && (
          <div className="mt-6 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-500/40 text-emerald-600">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">Payment Confirmed!</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                GH₵ {billing.amount}.00 approved. <strong>{churchName}</strong>'s subscription for{' '}
                <strong>{billing.periodLabel || billing.period}</strong> is now active.
              </p>
            </div>

            <div className="pt-3">
              <Button variant="primary" onClick={onClose} className="w-full">
                Continue to Dashboard
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
