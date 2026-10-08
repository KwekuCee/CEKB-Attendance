// Unified outgoing mail: Resend first, Gmail connector as fallback.

import { sendGmail, type GmailAttachment } from './gmail.ts';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
  attachments?: GmailAttachment[];
}

export interface SendMailResult {
  ok: boolean;
  via?: 'resend' | 'gmail';
  id?: string;
  error?: string;
  status?: number;
}

const MAIL_FROM = 'CE Korle Bu <support@gcycattendance.online>';
export const MAIL_LOGO_URL = 'https://gcycattendance.online/icon-512.png';
/** Shared branded layout matching the app: royal-blue header band, white card, soft blue page. */
function withLogo(html: string) {
  if (html.includes('data-cekb-layout')) return html;
  const body = html.replace(/<div style="text-align:center;padding:16px 0"><img src="[^"]*icon-512\.png"[^>]*><\/div>/g, '');
  return `<div data-cekb-layout style="background:#eef3fb;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe4f3">
<div style="background:#1d4ed8;padding:20px;text-align:center">
<img src="${MAIL_LOGO_URL}" alt="CE Korle Bu" width="64" height="64" style="display:inline-block;border:0;border-radius:12px;background:#ffffff;padding:4px" />
<div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:8px">CEKB Group</div>
<div style="color:#dbeafe;font-size:12px">Christ Embassy Korle Bu Attendance System</div>
</div>
<div style="padding:24px;font-size:15px;line-height:1.6">${body}</div>
<div style="background:#f8fafc;padding:14px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">CE Korle Bu &middot; support@gcycattendance.online</div>
</div></div>`;
}

async function sendResend(opts: SendMailOptions): Promise<SendMailResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const body: Record<string, unknown> = {
    from: MAIL_FROM,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
  };

  if (opts.attachments?.length) {
    body.attachments = opts.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Resend send failed [${res.status}]: ${text}`);
      return { ok: false, error: text, status: res.status };
    }
    let id: string | undefined;
    try {
      id = JSON.parse(text)?.id;
    } catch { /* ignore */ }
    return { ok: true, via: 'resend', id };
  } catch (err) {
    console.error('Resend request error', err);
    return { ok: false, error: String(err) };
  }
}

/** Sends an email through Resend, falling back to the connected Gmail account. */
export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  opts = { ...opts, html: withLogo(opts.html) };
  const resend = await sendResend(opts);
  if (resend.ok) return resend;

  const gmail = await sendGmail(opts);
  if (gmail.ok) return { ok: true, via: 'gmail', id: gmail.id };

  return {
    ok: false,
    error: `Resend: ${resend.error || 'unavailable'} | Gmail: ${gmail.error || 'unavailable'}`,
    status: resend.status || gmail.status,
  };
}
