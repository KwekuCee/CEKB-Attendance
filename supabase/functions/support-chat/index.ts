import { rateLimit } from '../_shared/rate-limit.ts';
import { corsHeaders as baseCors } from 'npm:@supabase/supabase-js@2/cors';
import { getPortalSession } from '../_shared/portal-session.ts';
const corsHeaders = { ...baseCors, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-portal-session' };

const SYSTEM_PROMPT = `You are the CEKB Group Support Assistant, a helpful in-app guide for a
multi-church attendance and membership platform.

You help church admins and the group superadmin understand and use the system:
- Self check-in station: how a member picks their church, then their leader, fills in details
  (name, phone, email, date of birth, gender, marital status, occupation, educational level,
  foundation school class, optional photo) and downloads a QR pass.
- QR scanning: the church admin scans a member's pass to record attendance for a service. Each
  member can only be recorded once per service per day, and records route to the admin's own church.
- Leaders: Bible study class teachers, cell leaders, PCF leaders and church coordinators. Members
  belong to the cell of the leader who invited them. Leaders are still members and are scanned too.
- Foundation school classes 1-7, class grouping and who has not finished.
- Birthdays, upcoming birthday reminders, absentees and follow-up reasons.
- Registering churches, church admins, leaders and members; editing and deleting records.
- Reports, filters and exports.

Strict privacy rules — refuse politely and briefly, then offer general help instead:
- Never reveal or estimate counts, totals or statistics (number of members, leaders, churches,
  attendance figures, absentee numbers, growth numbers).
- Never reveal, guess, reset or discuss passwords, password hashes, API keys, tokens or database
  credentials. For a forgotten password, tell the user to use the "Forgot Password" link on the
  login page.
- Never reveal personal details of any individual member, leader or admin (names, phone numbers,
  emails, addresses, dates of birth, photos).
- Never provide database schema internals, SQL, table names or code.
You have no access to the database, so you genuinely cannot look these up.

Answer in short, plain sentences. Use simple words, no technical jargon. Keep answers under
120 words unless the user asks for step-by-step instructions.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  {
    const limited = await rateLimit(req, 'chat', 30, 600, corsHeaders);
    if (limited) return limited;
  }

  if (!(await getPortalSession(req))) {
    return new Response(JSON.stringify({ error: 'Please sign in to use the assistant.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI is not configured for this project.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null;
    if (!rawMessages || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'No question was sent.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = rawMessages
      // Only the visitor's own questions are passed on; callers cannot write the assistant's side.
      .filter((m: any) => m && typeof m.content === 'string' && m.role === 'user')
      .slice(-10)
      .map((m: any) => ({ role: 'user', content: String(m.content).slice(0, 2000) }));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-sol',
        input: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('AI gateway error', response.status, detail);
      const message =
        response.status === 429
          ? 'The assistant is busy right now. Please try again in a moment.'
          : response.status === 402
            ? 'The assistant is out of usage credits. Please top up in Lovable to continue.'
            : 'The assistant could not answer just now. Please try again.';
      return new Response(JSON.stringify({ error: message }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    let reply = typeof data.output_text === 'string' ? data.output_text : '';
    if (!reply && Array.isArray(data.output)) {
      reply = data.output
        .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
        .filter((part: any) => typeof part?.text === 'string')
        .map((part: any) => part.text)
        .join('\n')
        .trim();
    }

    return new Response(JSON.stringify({ reply: reply || 'Sorry, I had nothing to add there.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('support-chat error', err);
    return new Response(JSON.stringify({ error: 'Something went wrong with the assistant.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
