// Shared traffic limiter backed by the private consume_rate_limit database function.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

export function clientIp(req: Request) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return (fwd.split(',')[0] || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown').trim();
}

/**
 * Returns null when allowed, or a 429 Response when the caller is over the limit.
 * Fails open if the limiter itself errors, so real users are never locked out by an outage.
 */
export async function rateLimit(
  req: Request,
  scope: string,
  max: number,
  windowSeconds: number,
  headers: Record<string, string>,
  identity?: string,
  nested = false,
  failClosed = false,
): Promise<Response | null> {
  const who = identity ? identity.toLowerCase().slice(0, 120) : clientIp(req);
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket_key: `${scope}:${who}`.slice(0, 200).padEnd(8, '_'),
    p_max_requests: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rate limit check failed', error.message);
    if (failClosed) {
      return new Response(
        JSON.stringify(nested ? { error: { message: 'Could not verify the send limit. Please try again shortly.' } } : { error: 'Could not verify the send limit. Please try again shortly.' }),
        { status: 503, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.allowed === false) {
    const wait = Math.max(1, Number(row.retry_after_seconds) || windowSeconds);
    const mins = Math.ceil(wait / 60);
    const message = `Too many attempts. Please wait ${wait < 90 ? `${wait} seconds` : `${mins} minutes`} and try again.`;
    return new Response(
      JSON.stringify(nested ? { error: { message } } : { error: message, message }),
      { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': String(wait) } },
    );
  }
  return null;
}
