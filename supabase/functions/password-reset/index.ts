import { rateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendMail as sendGmail } from '../_shared/mailer.ts';


const TOKEN_TTL_MINUTES = 60;

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => null);
    const action = body?.action;
    const limited = await rateLimit(req, `pwreset-${action === 'confirm' ? 'c' : 'r'}`, action === 'confirm' ? 10 : 5, 900, corsHeaders);
    if (limited) return limited;

    // ---------- 1. Request a reset link ----------
    if (action === 'request') {
      const email = String(body?.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return json({ success: false, message: 'Please enter a valid email address.' }, 400);
      }

      const { data: profile } = await admin
        .from('user_profiles')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      let found = !!profile;
      if (!found) {
        const { data: adminAccount } = await admin
          .from('church_admin_accounts')
          .select('admin_email')
          .ilike('admin_email', email)
          .maybeSingle();
        found = !!adminAccount;
      }

      // Always answer the same way so an unknown email cannot be probed.
      if (!found) {
        return json({
          success: true,
          message: 'If that email belongs to an account, a reset link has been sent to it.',
        });
      }

      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const tokenHash = await sha256(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

      await admin.from('password_reset_tokens').insert({
        email,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      // Only our own sites may receive reset links.
      const ALLOWED = ['https://gcycattendance.online', 'https://www.gcycattendance.online', 'https://happy-import-zone.lovable.app'];
      const requested = String(body?.origin || '').replace(/\/$/, '');
      const origin = ALLOWED.includes(requested) || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(requested) && requested.includes('c690eefd') ? requested : ALLOWED[0];
      const link = `${origin}/?reset_token=${token}`;

      const sendResult = await sendGmail({
        to: email,
        fromName: 'CEKB Group',
        subject: 'Set a new password for your CEKB account',
        html: `<p>Hello,</p>
<p>You asked to set a new password for your CEKB Group account.</p>
<p><a href="${link}" style="background:#1d4ed8;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">Create a new password</a></p>
<p>This link works once and expires in ${TOKEN_TTL_MINUTES} minutes. If you did not ask for this, you can ignore this email.</p>`,
      });
      const emailSent = sendResult.ok;

      if (!emailSent) console.warn('Reset email not sent:', sendResult.error);


      return json({
        success: true,
        emailSent,
        message: emailSent
          ? 'A reset link has been sent to your email. It expires in one hour.'
          : 'We could not send the email right now. Please try again in a few minutes.',
      });
    }

    // ---------- 2. Set the new password ----------
    if (action === 'confirm') {
      const token = String(body?.token || '').trim();
      const newPassword = String(body?.password || '');
      if (!token || newPassword.length < 8) {
        return json(
          { success: false, message: 'Your new password must be at least 8 characters long.' },
          400,
        );
      }

      const tokenHash = await sha256(token);
      const { data: row } = await admin
        .from('password_reset_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
        return json(
          { success: false, message: 'This reset link has expired or was already used. Please request a new one.' },
          400,
        );
      }

      const email = row.email as string;
      await admin.from('user_profiles').update({ password_hash: newPassword }).ilike('email', email);
      await admin.from('church_admin_accounts').update({ password: newPassword }).ilike('admin_email', email);
      await admin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);

      await admin.from('audit_logs').insert({
        actor: email,
        action: `Password was reset for ${email}`,
        category: 'Security',
        icon: 'lock_reset',
      });

      return json({ success: true, message: 'Your password has been changed. You can sign in now.' });
    }

    return json({ success: false, message: 'Unknown request.' }, 400);
  } catch (err) {
    console.error('password-reset error', err);
    return json({ success: false, message: 'Something went wrong. Please try again.' }, 500);
  }
});
