import React, { useState } from 'react';
import { Button } from './Button';
import { ChurchLogo } from './ChurchLogo';
import type { BillingStatus } from '../../supabase/functions/_shared/billing';

interface BillingLockScreenProps {
  billing: BillingStatus;
  churchName: string;
  onPay: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
}

export const BillingLockScreen: React.FC<BillingLockScreenProps> = ({
  billing,
  churchName,
  onPay,
  onLogout,
  onRefresh,
}) => {
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in text-slate-900 dark:text-slate-100">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-10 overflow-hidden text-center space-y-6">
        
        {/* Top Restricted Badge & Sign Out Button (ensures restricted-account logout is always rendered) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined text-base">lock_clock</span>
            <span>Account Temporarily Paused</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Sign Out</span>
          </button>
        </div>

        {/* Emblem */}
        <div className="mx-auto relative flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner">
          <span className="material-symbols-outlined text-4xl">receipt_long</span>
        </div>

        {/* Main Text */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black font-serif tracking-tight text-slate-900 dark:text-slate-100">
            Subscription Payment Required
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            The monthly CEKB subscription for <strong className="text-slate-900 dark:text-slate-200">{churchName}</strong> ({billing.periodLabel || billing.period}) has passed the {billing.graceDays}-day grace period.
          </p>
        </div>

        {/* Amount & Active Service Guarantee Card */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-5 border border-slate-200/80 dark:border-slate-800/80 text-left space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Subscription Fee</span>
            <span className="text-xl font-black font-serif text-blue-700 dark:text-blue-400">
              GH₵ {billing.amount}.00
            </span>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">
              check_circle
            </span>
            <p className="leading-relaxed">
              <strong>Your members are not affected:</strong> QR self check-in, cell leaders, and usher scanners remain fully active so service attendance is never lost.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button variant="primary" onClick={onPay} className="w-full sm:w-auto min-w-[200px] shadow-lg">
            <span className="material-symbols-outlined text-lg">credit_card</span>
            <span>Pay Now (Mobile Money)</span>
          </Button>

          {onRefresh && (
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={checking}
              className="w-full sm:w-auto"
            >
              <span className={`material-symbols-outlined text-lg ${checking ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{checking ? 'Checking...' : 'Check Status'}</span>
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};
