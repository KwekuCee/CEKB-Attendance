// Emails a newly appointed usher, telling them they can sign in and start scanning.
// Only a signed-in branch admin (or group account) may trigger it, and only for an
// usher account that really exists on their branch.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPortalSession } from '../_shared/portal-session.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { sendMail } from '../_shared/mailer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-portal-session',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const limited = await rateLimit(req, 'usher-welcome', 20, 600, corsHeaders);
  if (limited) return limited;

  const session = await getPortalSession(req);
  if (!session || session.role === 'Usher') return json({ success: false, error: 'Please sign in as a church admin.' }, 401);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email.includes('@')) return json({ success: false, error: 'A valid email is required.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: usher } = await admin
    .from('user_profiles')
    .select('full_name, email, church_name, role')
    .ilike('email', email)
    .eq('role', 'Usher')
    .maybeSingle();
  if (!usher) return json({ success: false, error: 'Usher not found.' }, 404);

  const isGroup = session.role === 'Superadmin';
  if (!isGroup && (usher.church_name || '').toLowerCase() !== (session.church_name || '').toLowerCase()) {
    return json({ success: false, error: 'This usher belongs to another branch.' }, 403);
  }

  const origin = /^https:\/\/[a-z0-9.-]+$/i.test(String(body?.origin || '')) ? String(body.origin) : 'https://gcycattendance.online';
  const name = esc(usher.full_name || 'there');
  const church = esc(usher.church_name || 'your church');

  const result = await sendMail({
    to: usher.email,
    subject: `You've been appointed as an usher at ${usher.church_name || 'CE Korle Bu'}`,
    html: `<h2 style="font-size:22px">Welcome to the usher team, ${name}</h2>
<p>You have been appointed as an usher for <strong>${church}</strong>. Thank you for serving — every person you welcome and check in matters.</p>
<p>Your account is ready. Sign in with this email address and the password your church admin set for you:</p>
<p style="margin:22px 0"><a href="${origin}/?signin=usher" style="background:#000f22;color:#ffffff;padding:13px 22px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">Sign in as an usher</a></p>
<p><strong>How to get started</strong><br>1. Open the link above on your phone.<br>2. Tap “Sign In”, then “Are you an usher? Sign in here”.<br>3. Allow camera access and start scanning members’ passes.</p>
<p>Tip: on your phone, choose “Add to Home Screen” so the scanner opens like an app.</p>
<p style="color:#5b6b80;font-size:13px">Forgot your password? Use “Forgot Password?” on the usher sign-in page. If you weren’t expecting this, you can ignore this email.</p>`,
  });

  if (!result.ok) return json({ success: false, error: result.error || 'Email could not be sent.' }, 502);
  return json({ success: true });
});
