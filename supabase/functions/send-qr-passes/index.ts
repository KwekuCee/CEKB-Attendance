import { rateLimit } from '../_shared/rate-limit.ts';
// Emails digital attendance QR passes to members or leaders, one message each.
// Used both for the automatic copy sent after check-in / leader registration and
// for the bulk "Email codes to all members / all leaders" buttons.

import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { sendMail } from '../_shared/mailer.ts';
import { getPortalSession } from '../_shared/portal-session.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Signed-out callers may only email a pass to the address already on that person's record. */
async function matchOnRecord(r: Recipient): Promise<Recipient | null> {
  const id = String(r?.id || '').trim();
  const email = String(r?.email || '').trim().toLowerCase();
  if (!id || !email || id.length > 64) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: m } = await admin.from('members').select('id, full_name, email, church_name, role').eq('id', id).maybeSingle();
    if (m && String(m.email || '').trim().toLowerCase() === email) {
      return { id: m.id, name: m.full_name, email, church: m.church_name || undefined, role: m.role || undefined };
    }
    const { data: l } = await admin.from('leaders').select('id, leader_code, full_name, email, church_name, leader_type')
      .or(`leader_code.eq.${id.replace(/[^A-Za-z0-9-]/g, '')}`).limit(1).maybeSingle();
    if (l && String(l.email || '').trim().toLowerCase() === email) {
      return { id, name: l.full_name, email, church: l.church_name || undefined, role: l.leader_type || undefined };
    }
    await new Promise((res) => setTimeout(res, 700));
  }
  return null;
}

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-portal-session',
};

interface Recipient {
  id: string;
  name: string;
  email: string;
  church?: string;
  role?: string;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

function qrImageUrl(code: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=520x520&ecc=H&margin=12&data=${encodeURIComponent(code)}`;
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function passHtml(raw: Recipient): string {
  const r = { id: raw.id, name: esc(raw.name), email: raw.email, church: esc(raw.church), role: esc(raw.role) };
  const church = r.church || 'CEKB';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#1d4ed8;color:#ffffff;padding:20px 24px">
        <div style="font-size:12px;letter-spacing:1px;opacity:.85">CHRIST EMBASSY &bull; KORLE BU</div>
        <div style="font-size:20px;font-weight:bold;margin-top:4px">${church}</div>
        <div style="font-size:12px;opacity:.85;margin-top:2px">Digital Attendance Pass</div>
      </div>
      <div style="padding:24px;text-align:center">
        <p style="font-size:14px;color:#0f172a;margin:0 0 4px">Hello ${r.name || 'Beloved'},</p>
        <p style="font-size:13px;color:#475569;margin:0 0 18px">
          This is your personal attendance code${r.role ? ` (${r.role})` : ''}. Show it to your branch admin at
          every service and your attendance is recorded instantly.
        </p>
        <img src="${qrImageUrl(r.id)}" alt="Attendance QR code" width="260" height="260"
             style="border:8px solid #ffffff;border-radius:12px;background:#ffffff" />
        <div style="margin-top:14px;font-family:monospace;font-size:15px;font-weight:bold;color:#1d4ed8">
          ID: ${esc(r.id)}
        </div>
        <p style="font-size:12px;color:#64748b;margin-top:18px">
          Tip: save this email or take a screenshot of the code so you always have it with you.
        </p>
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  {
    const limited = await rateLimit(req, 'qr-mail', 30, 600, corsHeaders);
    if (limited) return limited;
  }

  try {
    const body = await req.json().catch(() => null);
    let recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];

    // One pass at a time is allowed for self check-in / self registration, but only
    // to the email already saved on that person's record. Bulk sends need sign-in.
    const session = await getPortalSession(req);
    if (!session && recipients.length === 1) {
      const matched = await matchOnRecord(recipients[0]);
      if (!matched) {
        return new Response(JSON.stringify({ error: 'This pass can only be sent to the email on record.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      recipients = [matched];
    }
    if (recipients.length > 1) {
      if (!session) {
        return new Response(JSON.stringify({ error: 'Please sign in to email codes in bulk.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!recipients.length) {
      return new Response(JSON.stringify({ error: 'No recipients supplied.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (recipients.length > 500) {
      return new Response(JSON.stringify({ error: 'Too many recipients in one batch (max 500).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const problems: string[] = [];

    for (const r of recipients) {
      if (!r?.id || !isEmail(r?.email || '')) {
        skipped++;
        continue;
      }

      const result = await sendMail({
        to: r.email.trim(),
        subject: `Your CEKB attendance code (${String(r.id).replace(/[\r\n]/g, '')})`,
        html: passHtml(r),
        fromName: 'CEKB Attendance',
      });

      if (result.ok) sent++;
      else {
        failed++;
        if (problems.length < 5) problems.push(`${r.email}: ${result.error || 'send failed'}`);
      }

      // Gentle pacing so the mail provider does not reject the batch.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return new Response(JSON.stringify({ success: true, sent, skipped, failed, problems }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-qr-passes error', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
