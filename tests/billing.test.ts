import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeBillingStatus,
  formatPeriod,
  formatPeriodLabel,
  maskPhoneNumber,
  validateGhanaPhone,
  normalizeNetworkChannel,
  validateWebhookAmount,
  calculateGhsFee,
  FIXED_EXCHANGE_RATE,
  BillingSettings,
} from '../supabase/functions/_shared/billing.ts';

const baseSettings: BillingSettings = {
  enabled: true,
  monthlyFeeUsd: 50,
  fixedExchangeRate: 11,
  monthlyFee: 550,
  graceDays: 5,
  testMode: true,
  exemptChurches: ['Makarios Church', 'Grace Chapel'],
};

test('Fixed exchange rate and USD to GHS fee calculation', () => {
  assert.equal(FIXED_EXCHANGE_RATE, 11);
  assert.equal(calculateGhsFee(50), 550);
  assert.equal(calculateGhsFee(100), 1100);
  assert.equal(calculateGhsFee(0), 0);
});

test('Free access exemption: exempt churches are never due or locked (case-insensitive)', () => {
  // November 15, 2026 (way past grace days, unpaid)
  const date = '2026-11-15T12:00:00Z';
  
  // Exact match
  const status1 = computeBillingStatus({
    date,
    paidPeriods: [],
    settings: baseSettings,
    churchName: 'Makarios Church',
  });
  assert.equal(status1.exempt, true);
  assert.equal(status1.due, false, 'Exempt church should not be due');
  assert.equal(status1.locked, false, 'Exempt church should never be locked');

  // Case-insensitive match with extra whitespace
  const status2 = computeBillingStatus({
    date,
    paidPeriods: [],
    settings: baseSettings,
    churchName: '  makarios church  ',
  });
  assert.equal(status2.exempt, true);
  assert.equal(status2.due, false);
  assert.equal(status2.locked, false);

  // Non-exempt church is locked after grace days
  const status3 = computeBillingStatus({
    date,
    paidPeriods: [],
    settings: baseSettings,
    churchName: 'City Center Church',
  });
  assert.equal(status3.exempt, false);
  assert.equal(status3.due, true);
  assert.equal(status3.locked, true);
});

test('Due rule: on the last day of the month, next month is due but NOT locked', () => {
  // October 31, 2026: last day of October.
  // October is paid, November is not paid.
  const date = '2026-10-31T12:00:00Z';
  const status = computeBillingStatus({
    date,
    paidPeriods: ['2026-10'],
    settings: baseSettings,
  });

  assert.equal(status.enabled, true);
  assert.equal(status.due, true, 'Next month should be due on the last day of current month');
  assert.equal(status.locked, false, 'Next month should not be locked in advance');
  assert.equal(status.period, '2026-11');
  assert.equal(status.periodLabel, 'November 2026');
  assert.equal(status.amount, 550);
  assert.equal(status.amountUsd, 50);
});

test('Grace period rule: within grace days (1st to 5th), current month is due but NOT locked', () => {
  // November 3, 2026 (Day 3 <= 5)
  // November is unpaid.
  const date = '2026-11-03T10:00:00Z';
  const status = computeBillingStatus({
    date,
    paidPeriods: ['2026-10'],
    settings: baseSettings,
  });

  assert.equal(status.enabled, true);
  assert.equal(status.due, true);
  assert.equal(status.locked, false, 'Should be within grace period');
  assert.equal(status.period, '2026-11');
  assert.equal(status.daysRemaining, 3); // 5 - 3 + 1 = 3 days remaining (3rd, 4th, 5th)
});

test('Grace period expiration: after grace days (e.g. 6th), unpaid current month is LOCKED', () => {
  // November 6, 2026 (Day 6 > 5)
  // November is unpaid.
  const date = '2026-11-06T10:00:00Z';
  const status = computeBillingStatus({
    date,
    paidPeriods: ['2026-10'],
    settings: baseSettings,
  });

  assert.equal(status.enabled, true);
  assert.equal(status.due, true);
  assert.equal(status.locked, true, 'Should be locked past grace period');
  assert.equal(status.period, '2026-11');
  assert.equal(status.daysRemaining, 0);
});

test('Already-paid month: if current month is paid, due and locked are both FALSE', () => {
  // November 15, 2026
  // November 2026 is already paid.
  const date = '2026-11-15T15:00:00Z';
  const status = computeBillingStatus({
    date,
    paidPeriods: ['2026-10', '2026-11'],
    settings: baseSettings,
  });

  assert.equal(status.enabled, true);
  assert.equal(status.due, false, 'Already paid month should not be due');
  assert.equal(status.locked, false, 'Already paid month must not be locked');
  assert.equal(status.period, '2026-11');
});

test('Last day of month when next month is ALREADY paid', () => {
  // October 31, 2026: October and November are both paid.
  const date = '2026-10-31T12:00:00Z';
  const status = computeBillingStatus({
    date,
    paidPeriods: ['2026-10', '2026-11'],
    settings: baseSettings,
  });

  assert.equal(status.enabled, true);
  assert.equal(status.due, false);
  assert.equal(status.locked, false);
});

test('Toggle off: turning billing off immediately clears due and locked states', () => {
  // November 10, 2026 (past grace period and unpaid)
  const date = '2026-11-10T12:00:00Z';
  const status = computeBillingStatus({
    date,
    paidPeriods: [],
    settings: { ...baseSettings, enabled: false },
  });

  assert.equal(status.enabled, false);
  assert.equal(status.due, false);
  assert.equal(status.locked, false);
});

test('Webhook amount validation: matches expected subscription fee and catches underpayment spoofing', () => {
  assert.equal(validateWebhookAmount(550, 550), true);
  assert.equal(validateWebhookAmount(550, '550.00'), true);
  assert.equal(validateWebhookAmount(550, 549.99), false, 'Underpayment by 1 pesewa must be rejected');
  assert.equal(validateWebhookAmount(550, 50), false, 'Severe underpayment must be rejected');
  assert.equal(validateWebhookAmount(550, 0), false);
  assert.equal(validateWebhookAmount(550, 'abc'), false);
});

test('Phone masking: masks all but the last 4 digits for privacy', () => {
  assert.equal(maskPhoneNumber('0244123456'), '•••• •• 3456');
  assert.equal(maskPhoneNumber('+233550160237'), '•••• •• 0237');
  assert.equal(maskPhoneNumber('12'), '••••');
});

test('Ghanaian phone number validation and normalization', () => {
  assert.equal(validateGhanaPhone('0244123456').valid, true);
  assert.equal(validateGhanaPhone('0550160237').valid, true);
  assert.equal(validateGhanaPhone('+233244123456').valid, true);
  assert.equal(validateGhanaPhone('+233244123456').formatted, '0244123456');
  assert.equal(validateGhanaPhone('0123456789').valid, false); // invalid prefix
  assert.equal(validateGhanaPhone('12345').valid, false); // too short
});

test('Network channel normalization maps to Moolre channel codes', () => {
  assert.deepEqual(normalizeNetworkChannel('MTN'), { channelCode: '13', channelName: 'MTN' });
  assert.deepEqual(normalizeNetworkChannel('mtn mobile money'), { channelCode: '13', channelName: 'MTN' });
  assert.deepEqual(normalizeNetworkChannel('Telecel'), { channelCode: '6', channelName: 'Telecel' });
  assert.deepEqual(normalizeNetworkChannel('Vodafone Cash'), { channelCode: '6', channelName: 'Telecel' });
  assert.deepEqual(normalizeNetworkChannel('AirtelTigo'), { channelCode: '7', channelName: 'AirtelTigo' });
});

test('Period formatting and human-readable labels', () => {
  assert.equal(formatPeriod(2026, 10), '2026-11');
  assert.equal(formatPeriod(2026, 0), '2026-01');
  assert.equal(formatPeriodLabel('2026-11'), 'November 2026');
  assert.equal(formatPeriodLabel('2027-01'), 'January 2027');
});

test('Copyable schemas and migration include church_subscriptions and payment_transactions with service_role lockdown and is_test partition', async () => {
  const { SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL } = await import('../src/data/supabase_schema.js');
  for (const schema of [SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL]) {
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS public.church_subscriptions'));
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS public.payment_transactions'));
    assert.ok(schema.includes('is_test BOOLEAN NOT NULL DEFAULT true'));
    assert.ok(schema.includes('pay_trans_is_test'));
    assert.ok(schema.includes("'church_subscriptions'"));
    assert.ok(schema.includes("'payment_transactions'"));
  }
});

