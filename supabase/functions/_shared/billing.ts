// Shared billing and subscription logic for Moolre payments in CEKB.
// All date and time calculations use UTC (Ghana time is GMT+0).

export const FIXED_EXCHANGE_RATE = 11; // 1 USD = 11 GHS

export function calculateGhsFee(usd: number): number {
  return Math.round(Math.max(0, Number(usd) || 0) * FIXED_EXCHANGE_RATE);
}

export interface BillingSettings {
  enabled: boolean;
  monthlyFeeUsd?: number; // in USD, e.g. 50
  fixedExchangeRate?: number; // 1 USD = 11 GHS
  monthlyFee: number; // in GH₵, e.g. 550
  graceDays: number; // e.g. 5 days after the 1st
  testMode: boolean; // true for sandbox/simulated payments
  exemptChurches?: string[]; // list of church names with free access
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  enabled: false,
  monthlyFeeUsd: 50,
  fixedExchangeRate: FIXED_EXCHANGE_RATE,
  monthlyFee: 550,
  graceDays: 5,
  testMode: true,
  exemptChurches: [],
};

export interface BillingStatus {
  enabled: boolean;
  due: boolean;
  locked: boolean;
  exempt?: boolean;
  amount: number; // GH₵
  amountUsd?: number; // USD ($)
  period: string; // e.g. '2026-11'
  periodLabel: string; // e.g. 'November 2026'
  graceDays: number;
  daysRemaining?: number;
  isAdvanceNotice?: boolean;
  churchName?: string;
  paidHistory?: any[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats year and month into standard period string: YYYY-MM
 * @param monthZeroIndexed 0 for Jan, 11 for Dec
 */
export function formatPeriod(year: number, monthZeroIndexed: number): string {
  return `${year}-${String(monthZeroIndexed + 1).padStart(2, '0')}`;
}

/**
 * Formats 'YYYY-MM' into human-readable label: 'November 2026'
 */
export function formatPeriodLabel(period: string): string {
  if (!period || !period.includes('-')) return period || '';
  const [yearStr, monthStr] = period.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

/**
 * Computes billing status based on current date, church's paid periods, and billing settings.
 */
export function computeBillingStatus({
  date,
  paidPeriods,
  settings,
  churchName,
}: {
  date: Date | string | number;
  paidPeriods: string[] | Set<string>;
  settings: BillingSettings;
  churchName?: string;
}): BillingStatus {
  const s = { ...DEFAULT_BILLING_SETTINGS, ...(settings || {}) };
  const paidSet = paidPeriods instanceof Set ? paidPeriods : new Set(paidPeriods || []);

  const feeUsd = s.monthlyFeeUsd ?? 50;
  const feeGhs = s.monthlyFee ?? calculateGhsFee(feeUsd);

  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed
  const day = d.getUTCDate();

  const currentPeriod = formatPeriod(year, month);
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextPeriod = formatPeriod(nextMonthYear, nextMonth);

  // Check if church has free access exemption
  const exemptList = Array.isArray(s.exemptChurches) ? s.exemptChurches : [];
  const isExempt = Boolean(
    churchName &&
    exemptList.some(
      (c) => String(c || '').trim().toLowerCase() === String(churchName).trim().toLowerCase()
    )
  );

  if (isExempt) {
    return {
      enabled: s.enabled,
      due: false,
      locked: false,
      exempt: true,
      amount: feeGhs,
      amountUsd: feeUsd,
      period: currentPeriod,
      periodLabel: formatPeriodLabel(currentPeriod),
      graceDays: s.graceDays,
      daysRemaining: 0,
      churchName,
    };
  }

  if (!s.enabled) {
    return {
      enabled: false,
      due: false,
      locked: false,
      exempt: false,
      amount: feeGhs,
      amountUsd: feeUsd,
      period: '',
      periodLabel: '',
      graceDays: s.graceDays,
      daysRemaining: 0,
      churchName,
    };
  }

  // Number of days in current month
  const daysInCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const isLastDayOfMonth = day === daysInCurrentMonth;

  const isCurrentPaid = paidSet.has(currentPeriod);

  // If today is the last day of the month:
  // We evaluate next month's subscription (in advance).
  if (isLastDayOfMonth) {
    // If current month is unpaid on the last day, they are already overdue and locked
    if (!isCurrentPaid) {
      return {
        enabled: true,
        due: true,
        locked: true,
        exempt: false,
        amount: feeGhs,
        amountUsd: feeUsd,
        period: currentPeriod,
        periodLabel: formatPeriodLabel(currentPeriod),
        graceDays: s.graceDays,
        daysRemaining: 0,
        churchName,
      };
    }

    const isNextPaid = paidSet.has(nextPeriod);
    return {
      enabled: true,
      due: !isNextPaid,
      locked: false, // advance notice on the last day, never locked yet
      exempt: false,
      amount: feeGhs,
      amountUsd: feeUsd,
      period: nextPeriod,
      periodLabel: formatPeriodLabel(nextPeriod),
      graceDays: s.graceDays,
      daysRemaining: s.graceDays + 1, // last day of month + grace days of next month
      isAdvanceNotice: true,
      churchName,
    };
  }

  // Not the last day of month:
  // If current month is already paid, no payment is due or locked
  if (isCurrentPaid) {
    return {
      enabled: true,
      due: false,
      locked: false,
      exempt: false,
      amount: feeGhs,
      amountUsd: feeUsd,
      period: currentPeriod,
      periodLabel: formatPeriodLabel(currentPeriod),
      graceDays: s.graceDays,
      daysRemaining: 0,
      churchName,
    };
  }

  // Current month is NOT paid:
  // Within grace period (day 1 to graceDays): due = true, locked = false
  // Past grace period (day > graceDays): due = true, locked = true
  const locked = day > s.graceDays;
  const daysRemaining = locked ? 0 : Math.max(0, s.graceDays - day + 1);

  return {
    enabled: true,
    due: true,
    locked,
    exempt: false,
    amount: feeGhs,
    amountUsd: feeUsd,
    period: currentPeriod,
    periodLabel: formatPeriodLabel(currentPeriod),
    graceDays: s.graceDays,
    daysRemaining,
    churchName,
  };
}

/**
 * Masks a phone number to only show the last 4 digits (e.g. •••• •• 1234)
 */
export function maskPhoneNumber(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  const last4 = digits.slice(-4);
  return `•••• •• ${last4}`;
}

/**
 * Validates a Ghanaian mobile phone number (10 digits starting with 0, or 12 digits starting with 233)
 */
export function validateGhanaPhone(phone: string): { valid: boolean; formatted: string; error?: string } {
  const clean = String(phone || '').trim().replace(/[\s\-\(\)]/g, '');
  let standard = clean;
  if (standard.startsWith('+233')) standard = standard.slice(1);
  if (standard.startsWith('233') && standard.length === 12) {
    standard = '0' + standard.slice(3);
  }
  if (!/^0[235][0-9]{8}$/.test(standard)) {
    return {
      valid: false,
      formatted: clean,
      error: 'Enter a valid Ghanaian 10-digit mobile money number (e.g. 0244123456).',
    };
  }
  return { valid: true, formatted: standard };
}

/**
 * Maps common network labels to Moolre channel code.
 * MTN = '13', Telecel = '6', AirtelTigo = '7'
 */
export function normalizeNetworkChannel(network: string): { channelCode: string; channelName: string } {
  const n = String(network || '').toLowerCase().trim();
  if (n.includes('mtn')) return { channelCode: '13', channelName: 'MTN' };
  if (n.includes('telecel') || n.includes('vodafone')) return { channelCode: '6', channelName: 'Telecel' };
  if (n.includes('airtel') || n.includes('tigo') || n.includes('at')) return { channelCode: '7', channelName: 'AirtelTigo' };
  return { channelCode: '13', channelName: 'MTN' };
}

/**
 * Verifies that the amount received from Moolre matches our expected subscription amount.
 * Prevents underpayment spoofing.
 */
export function validateWebhookAmount(expected: number, received: number | string): boolean {
  const exp = Number(expected);
  const rec = Number(received);
  if (isNaN(exp) || isNaN(rec)) return false;
  const expPesewas = Math.round(exp * 100);
  const recPesewas = Math.round(rec * 100);
  return recPesewas === expPesewas;
}
