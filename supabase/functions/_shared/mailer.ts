// Unified outgoing mail: Resend first, Gmail connector as fallback.

import { sendGmail, type GmailAttachment } from './gmail.ts';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
  /** Full sender, e.g. 'GCYC Developer <developer@gcycattendance.online>'. */
  from?: string;
  replyTo?: string;
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
const FONT_HEAD = "'Sora','Segoe UI',Helvetica,Arial,sans-serif";
const FONT_BODY = "'Manrope','Segoe UI',Helvetica,Arial,sans-serif";

/** Plain-text twin of the HTML; mail providers trust messages that include one. */
export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/tr|\/li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

/** Shared branded layout matching the app: black-to-navy header, white card, Sora headings, Manrope text, black buttons. */
function withLogo(html: string, subject = 'CE Korle Bu') {
  if (html.includes('data-cekb-layout')) return html;
  const body = html
    .replace(/<div style="text-align:center;padding:16px 0"><img src="[^"]*icon-512\.png"[^>]*><\/div>/g, '')
    // Buttons: solid black like the app, never bright blue.
    .replace(/background:\s*#1d4ed8/gi, 'background:#000f22')
    .replace(/color:\s*#1d4ed8/gi, 'color:#1b3554')
    .replace(/<h([1-3])([^>]*)style="/gi, `<h$1$2style="font-family:${FONT_HEAD};font-weight:800;color:#000f22;`)
    .replace(/<h([1-3])(?![^>]*style=)([^>]*)>/gi, `<h$1$2 style="font-family:${FONT_HEAD};font-weight:800;color:#000f22;margin:0 0 12px">`);
  const safeTitle = subject.replace(/[<>&"]/g, '');
  return `<!DOCTYPE html>
<html lang="en" dir="ltr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only">
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#eef4fb">
<div data-cekb-layout style="background:#eef4fb;padding:28px 12px;font-family:${FONT_BODY};color:#0f1b2d">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #d6e3f2;box-shadow:0 12px 32px rgba(0,15,34,0.08)">
<div style="background:#000f22;background-image:linear-gradient(135deg,#000f22 0%,#1b3554 60%,#3f6593 100%);padding:28px 24px;text-align:center">
<img src="${MAIL_LOGO_URL}" alt="CE Korle Bu" width="64" height="64" style="display:inline-block;border:0;border-radius:16px;background:#ffffff;padding:6px" />
<div style="font-family:${FONT_HEAD};color:#ffffff;font-size:20px;font-weight:800;margin-top:12px;letter-spacing:-0.01em">CEKB Group</div>
<div style="font-family:${FONT_BODY};color:#c0e6fd;font-size:12px;margin-top:2px">Christ Embassy Korle Bu Attendance System</div>
</div>
<div style="padding:28px 26px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:#1b2b40">${body}</div>
<div style="background:#f5f9fd;padding:16px;text-align:center;font-family:${FONT_BODY};font-size:12px;color:#5b6b80;border-top:1px solid #e3ecf6">
CE Korle Bu &middot; Korle Bu, Accra, Ghana<br>Questions? Reply to this email or write to <a href="mailto:support@gcycattendance.online" style="color:#3f6593">support@gcycattendance.online</a>
</div>
</div></div></body></html>`;
}

async function sendResend(opts: SendMailOptions): Promise<SendMailResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const body: Record<string, unknown> = {
    from: opts.from || MAIL_FROM,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: htmlToText(opts.html),
    reply_to: opts.replyTo || 'support@gcycattendance.online',
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
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
  opts = { ...opts, html: withLogo(opts.html, opts.subject) };
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
