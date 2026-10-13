const MNOTIFY_SMS_URL = 'https://api.mnotify.com/api/sms/quick';
const MNOTIFY_API_URL = 'https://api.mnotify.com/api';
const RECIPIENTS_PER_REQUEST = 100;

export interface AdminSmsResult {
  accepted: number;
  acceptedRecipients: string[];
  failed: number;
  creditsUsed: number;
  creditsLeft: number | null;
  campaignIds: string[];
  error: string | null;
}

export interface MnotifyResult {
  ok: boolean;
  payload: Record<string, any> | null;
  error: string | null;
}

async function requestMnotify(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): Promise<MnotifyResult> {
  const apiKey = Deno.env.get('MNOTIFY_API_KEY')?.trim();
  if (!apiKey) return { ok: false, payload: null, error: 'MNOTIFY_API_KEY is not configured.' };
  const url = new URL(`${MNOTIFY_API_URL}${path}`);
  url.searchParams.set('key', apiKey);
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => null) as Record<string, any> | null;
    if (!response.ok || String(payload?.status || '').toLowerCase() !== 'success') {
      const message = typeof payload?.message === 'string' ? payload.message.slice(0, 240) : '';
      return { ok: false, payload, error: message || `mNotify request failed (${response.status}).` };
    }
    return { ok: true, payload, error: null };
  } catch {
    return { ok: false, payload: null, error: 'Could not connect to mNotify.' };
  }
}

export async function registerMnotifySenderId(senderName: string, purpose: string) {
  return requestMnotify('/senderid/register', 'POST', { sender_name: senderName, purpose });
}

export async function getMnotifySenderIdStatus(senderName: string) {
  return requestMnotify('/senderid/status', 'POST', { sender_name: senderName });
}

export async function getMnotifySmsBalance() {
  return requestMnotify('/balance/sms', 'GET');
}

export async function getMnotifyCampaignReport(campaignId: string) {
  return requestMnotify(`/campaign/${encodeURIComponent(campaignId)}`, 'GET');
}

function asCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function normalizeGhanaNumber(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('233') && digits.length === 12 ? `0${digits.slice(3)}` : digits;
}

function providerErrorText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 240);
  if (Array.isArray(value)) {
    const messages = value.map(providerErrorText).filter((message): message is string => !!message);
    return messages.length ? messages.join('; ').slice(0, 240) : null;
  }
  if (value && typeof value === 'object') {
    const fields = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'description', 'details']) {
      const message = providerErrorText(fields[key]);
      if (message) return message;
    }
  }
  return null;
}

export async function sendMnotifySms(
  recipients: string[],
  sender: string,
  message: string,
): Promise<AdminSmsResult> {
  const apiKey = Deno.env.get('MNOTIFY_API_KEY')?.trim();
  if (!apiKey) {
    return {
      accepted: 0,
      acceptedRecipients: [],
      failed: recipients.length,
      creditsUsed: 0,
      creditsLeft: null,
      campaignIds: [],
      error: 'The MNOTIFY_API_KEY server secret is not configured.',
    };
  }

  const result: AdminSmsResult = {
    accepted: 0,
    acceptedRecipients: [],
    failed: 0,
    creditsUsed: 0,
    creditsLeft: null,
    campaignIds: [],
    error: null,
  };

  for (let i = 0; i < recipients.length; i += RECIPIENTS_PER_REQUEST) {
    const batch = recipients.slice(i, i + RECIPIENTS_PER_REQUEST);
    const url = new URL(MNOTIFY_SMS_URL);
    url.searchParams.set('key', apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ recipient: batch, sender, message, is_schedule: false, schedule_date: '' }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      result.failed += batch.length;
      result.error = 'Could not connect to mNotify. Please try again.';
      continue;
    }

    const payload = await response.json().catch(() => null) as Record<string, any> | null;
    const summary = payload?.summary || {};
    const acceptedNumbers = Array.isArray(summary.numbers_sent)
      ? new Set(summary.numbers_sent.map(normalizeGhanaNumber))
      : null;
    const providerAccepted = response.ok &&
      String(payload?.status || '').toLowerCase() === 'success' &&
      String(payload?.code || '') === '2000';

    if (providerAccepted) {
      const rejected = asCount(summary.total_rejected);
      const accepted = acceptedNumbers
        ? batch.filter((number) => acceptedNumbers.has(number)).length
        : summary.total_sent !== undefined
          ? Math.min(batch.length, asCount(summary.total_sent))
          : Math.max(0, batch.length - rejected);
      result.accepted += accepted;
      if (acceptedNumbers) {
        result.acceptedRecipients.push(...batch.filter((number) => acceptedNumbers.has(normalizeGhanaNumber(number))));
      } else {
        result.acceptedRecipients.push(...batch.slice(0, accepted));
      }
      result.failed += batch.length - accepted;
      result.creditsUsed += asCount(summary.credit_used);
      if (summary.credit_left !== undefined) result.creditsLeft = asCount(summary.credit_left);
      if (summary._id) result.campaignIds.push(String(summary._id).slice(0, 100));
      if (batch.length !== accepted && !result.error) {
        result.error = 'mNotify rejected one or more recipient numbers.';
      }
    } else {
      result.failed += batch.length;
      const providerMessage = providerErrorText(payload?.message)
        || providerErrorText(payload?.error)
        || providerErrorText(payload?.errors)
        || providerErrorText(payload?.summary);
      result.error = providerMessage
        || `mNotify rejected the SMS request (HTTP ${response.status}${payload?.code ? `, code ${String(payload.code).slice(0, 30)}` : ''}).`;
    }
  }

  return result;
}

export async function sendMnotifyMessage(
  recipients: string[],
  sender: string,
  message: string,
): Promise<AdminSmsResult> {
  return sendMnotifySms(recipients, sender, message);
}
