import React from 'react';
import { Button } from './Button';
import type { BillingStatus } from '../../supabase/functions/_shared/billing';

interface BillingPromptProps {
  billing: BillingStatus;
  churchName: string;
  onPay: () => void;
  onDismiss?: () => void;
}

export const BillingPrompt: React.FC<BillingPromptProps> = ({
  billing,
  churchName,
  onPay,
  onDismiss,
}) => {
  if (!billing.enabled || !billing.due || billing.locked || billing.exempt) return null;

  const usd = billing.amountUsd ?? 50;
  const ghs = billing.amount ?? 550;

  return (
    <div
      role="alert"
      className="mb-6 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/15 via-blue-800/10 to-indigo-900/15 p-4 sm:p-5 shadow-sm backdrop-blur-sm transition-all"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <span className="material-symbols-outlined text-xl">payments</span>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Monthly Subscription Due
              </span>
              {billing.daysRemaining !== undefined && billing.daysRemaining > 0 && (
                <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                  {billing.daysRemaining} {billing.daysRemaining === 1 ? 'day' : 'days'} grace left
                </span>
              )}
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
              Your CEKB subscription for {billing.periodLabel || billing.period} is due — ${usd} (GH₵ {Number(ghs).toFixed(2)})
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Pay via Mobile Money (MTN, Telecel, AirtelTigo) to ensure uninterrupted access for{' '}
              <strong className="text-slate-800 dark:text-slate-200">{churchName}</strong>'s pastors and administrators.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1.5"
            >
              Dismiss
            </button>
          )}
          <Button variant="primary" onClick={onPay} className="shadow-md">
            <span className="material-symbols-outlined text-lg">credit_card</span>
            Pay now · ${usd} (GH₵ {Number(ghs).toFixed(2)})
          </Button>
        </div>
      </div>
    </div>
  );
};
