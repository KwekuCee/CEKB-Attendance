// Verifies scheduled jobs: the cron sends x-cron-token, we compare its SHA-256 to a locked table.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export async function isScheduledCall(req: Request): Promise<boolean> {
  const token = req.headers.get('x-cron-token') || '';
  if (token.length < 32) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const { data } = await admin.from('app_cron_tokens').select('token_hash').eq('token_hash', hash).maybeSingle();
  return !!data;
}
