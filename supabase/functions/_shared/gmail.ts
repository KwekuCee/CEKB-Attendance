// Sends email through the connected Gmail account via the Lovable connector gateway.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1';
const MAIL_FROM = 'CE Korle Bu <support@gcycattendance.online>';

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(''));

const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

export interface GmailAttachment {
  filename: string;
  /** raw base64 (no data URL prefix) */
  content: string;
  mimeType?: string;
}

export interface SendGmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
  attachments?: GmailAttachment[];
}

function buildRaw(opts: SendGmailOptions): string {
  const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;
  const boundary = `bnd_${crypto.randomUUID().replace(/-/g, '')}`;
  const lines: string[] = [
    `From: ${MAIL_FROM}`,
    `To: ${to}`,
    `Subject: ${header(opts.subject)}`,
    'Reply-To: support@gcycattendance.online',
    'MIME-Version: 1.0',
  ];
  const text = opts.html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<(br|\/p|\/div|\/h[1-6]|\/tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  const alt = `alt_${crypto.randomUUID().replace(/-/g, '')}`;
  const altPart = [
    `Content-Type: multipart/alternative; boundary="${alt}"`, '',
    `--${alt}`, 'Content-Type: text/plain; charset="UTF-8"', '', text, '',
    `--${alt}`, 'Content-Type: text/html; charset="UTF-8"', '', opts.html, '',
    `--${alt}--`, '',
  ];

  if (opts.attachments?.length) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '');
    lines.push(`--${boundary}`, ...altPart);
    for (const att of opts.attachments) {
      lines.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        att.content.replace(/(.{76})/g, '$1\r\n'),
        '',
      );
    }
    lines.push(`--${boundary}--`, '');
  } else {
    lines.push(...altPart);
  }

  return b64(lines.join('\r\n')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmail(
  opts: SendGmailOptions,
): Promise<{ ok: boolean; id?: string; error?: string; status?: number }> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const connectionKey = Deno.env.get('GOOGLE_MAIL_API_KEY');
  if (!lovableKey || !connectionKey) {
    return { ok: false, error: 'Gmail is not connected for this project.' };
  }

  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': connectionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: buildRaw(opts) }),
  });

  if (!res.ok) {
    const details = await res.text();
    console.error(`Gmail send failed [${res.status}]: ${details}`);
    return { ok: false, error: details, status: res.status };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, id: data?.id };
}
