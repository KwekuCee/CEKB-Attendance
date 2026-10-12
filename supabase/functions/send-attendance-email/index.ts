import { rateLimit } from '../_shared/rate-limit.ts';
// Sends a self-attendance notification email to a church's registered admin.
// Reads the admin's email from church_admin_accounts (looked up by church name),
// and sends from the connected Gmail account. Optionally attaches the QR pass PNG.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendMail as sendGmail } from '../_shared/mailer.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-portal-session',
};

interface RequestBody {
  churchName: string;
  memberName: string;
  memberId: string;
  serviceType: string;
  timestamp: string;
  qrPassBase64?: string; // data URL, e.g. "data:image/png;base64,...."
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  {
    const limited = await rateLimit(req, 'att-mail', 30, 600, corsHeaders);
    if (limited) return limited;
  }

  try {
    const body: RequestBody = await req.json();
    const { churchName, memberName, memberId, serviceType, timestamp, qrPassBase64 } = body;

    if (!churchName || !memberName || !memberId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: churchName, memberName, memberId.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase service credentials are not configured on this project.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // The person must really be on this branch's roll, so the notification can
    // never be used to push made-up names or text at a branch admin.
    const { data: memberRow } = await supabase
      .from('members')
      .select('id, church_name, full_name')
      .eq('id', memberId)
      .maybeSingle();

    if (!memberRow || (memberRow.church_name || '').toLowerCase() !== churchName.trim().toLowerCase()) {
      return new Response(
        JSON.stringify({ success: true, sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const safeName = esc(memberRow.full_name || memberName);
    const safeChurch = esc(memberRow.church_name);
    const safeId = esc(memberRow.id);
    const safeService = esc(String(serviceType || '').slice(0, 100));
    const safeTime = esc(String(timestamp || '').slice(0, 60));

    // Look up the admin email for this church (case-insensitive match on name).
    const { data: adminRow, error: adminErr } = await supabase
      .from('church_admin_accounts')
      .select('admin_email, admin_name, church_name')
      .ilike('church_name', churchName)
      .limit(1)
      .maybeSingle();

    if (adminErr) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not notify the branch right now.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adminRow?.admin_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'This branch has no admin to notify yet.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const attachments = qrPassBase64
      ? [
          {
            filename: `${String(memberRow.id).replace(/[^A-Za-z0-9_-]/g, '')}_QR_Pass.png`,
            mimeType: 'image/png',
            content: qrPassBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        ]
      : undefined;

    const sendResult = await sendGmail({
      to: adminRow.admin_email,
      fromName: 'CEKB Attendance',
      subject: `Self Check-In: ${String(memberRow.full_name || memberName).replace(/[\r\n]/g, ' ').slice(0, 80)} — ${String(memberRow.church_name).replace(/[\r\n]/g, ' ')}`,
      html: `
        <div style="font-family: sans-serif; color: #0f172a;">
          <h2 style="color:#1d4ed8;">New Self Attendance Check-In</h2>
          <p><strong>${safeName}</strong> (Member ID: ${safeId}) just checked in via the Self Attendance Portal.</p>
          <table style="border-collapse: collapse; margin-top: 12px;">
            <tr><td style="padding:4px 12px 4px 0; color:#475569;">Church Branch</td><td><strong>${safeChurch}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0; color:#475569;">Service Program</td><td><strong>${safeService}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0; color:#475569;">Check-In Time</td><td><strong>${safeTime}</strong></td></tr>
          </table>
          ${qrPassBase64 ? '<p style="margin-top:16px; color:#475569;">The member\'s digital QR pass is attached.</p>' : ''}
        </div>
      `,
      attachments,
    });

    if (!sendResult.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'The notification email could not be sent.' }),
        { status: sendResult.status || 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
