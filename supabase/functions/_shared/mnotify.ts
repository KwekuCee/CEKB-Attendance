const MNOTIFY_SMS_URL = 'https://api.mnotify.com/api/sms/quick';
const RECIPIENTS_PER_REQUEST = 100;

export interface AdminSmsResult {
  accepted: number;
  failed: number;
  creditsUsed: number;
  creditsLeft: number | null;
  campaignIds: string[];
  error: string | null;
}

function asCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
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
      failed: recipients.length,
      creditsUsed: 0,
      creditsLeft: null,
      campaignIds: [],
      error: 'The MNOTIFY_API_KEY server secret is not configured.',
    };
  }

  const result: AdminSmsResult = {
    accepted: 0,
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
        body: JSON.stringify({ recipient: batch, sender, message }),
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
      ? new Set(summary.numbers_sent.map((number: unknown) => String(number)))
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
      result.failed += batch.length - accepted;
      result.creditsUsed += asCount(summary.credit_used);
      if (summary.credit_left !== undefined) result.creditsLeft = asCount(summary.credit_left);
      if (summary._id) result.campaignIds.push(String(summary._id).slice(0, 100));
      if (batch.length !== accepted && !result.error) {
        result.error = 'mNotify rejected one or more recipient numbers.';
      }
    } else {
      result.failed += batch.length;
      const providerMessage = typeof payload?.message === 'string' ? payload.message.trim().slice(0, 240) : '';
      result.error = providerMessage || 'mNotify did not accept the SMS request.';
    }
  }

  return result;
}
