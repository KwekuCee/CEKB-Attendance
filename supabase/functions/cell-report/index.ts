// Cell report submissions and per-branch access codes.
//
// Leaders submit weekly cell reports from the public portal after entering the
// access code their church administrator gave them. Codes are created and
// rotated by signed-in admins. All database work happens here with the service
// role, so the code check can never be bypassed from the browser.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { rateLimit } from '../_shared/rate-limit.ts';
import { getPortalSession } from '../_shared/portal-session.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-portal-session',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

function str(value: unknown, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function num(value: unknown) {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const MONEY_KEYS = new Set(['totalOffering']);
const TEXT_KEYS = new Set(['venue', 'meetingDateTime', 'location', 'type']);
/** Forces every count to a non-negative whole number (money keeps 2 decimals). */
function cleanNumbers(obj: Record<string, any>) {
  for (const [k, v] of Object.entries(obj)) {
    if (TEXT_KEYS.has(k)) continue;
    const fix = (x: unknown) => {
      if (String(x ?? '').trim() === '') return '';
      const n = num(x);
      return MONEY_KEYS.has(k) ? String(Math.round(n * 100) / 100) : String(Math.floor(n));
    };
    obj[k] = v && typeof v === 'object' ? { cell: fix(v.cell), outreach: fix(v.outreach) } : fix(v);
  }
  return obj;
}

function ghPhone(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/[\s\-().]/g, '');
  if (!d) return '';
  let m = d.match(/^(?:\+?233|00233)(\d{9})$/);
  if (m) return '0' + m[1];
  m = d.match(/^0(\d{9})$/);
  return m ? d : null;
}

function cleanPhones(list: Array<Record<string, unknown>>, keys: string[]) {
  for (const row of list) for (const k of keys) {
    if (!(k in row)) continue;
    const p = ghPhone(row[k]);
    if (p === null) throw new Error(`"${row[k]}" is not a valid Ghana phone number.`);
    row[k] = p;
  }
  return list;
}

function trimList(value: unknown, max = 200) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map((row) => {
    const out: Record<string, unknown> = {};
    if (row && typeof row === 'object') {
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        out[str(k, 40)] = typeof v === 'boolean' ? v : str(v, 300);
      }
    }
    return out;
  });
}

function trimObject(value: unknown) {
  const out: Record<string, unknown> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v && typeof v === 'object') out[str(k, 40)] = trimObject(v);
      else out[str(k, 40)] = str(v, 500);
    }
  }
  return out;
}

async function findChurch(churchName: string) {
  const { data } = await admin
    .from('churches')
    .select('id, name')
    .ilike('name', churchName)
    .maybeSingle();
  return data as { id: string; name: string } | null;
}

async function codeRowFor(churchName: string) {
  const { data } = await admin
    .from('church_report_codes')
    .select('*')
    .ilike('church_name', churchName)
    .maybeSingle();
  return data as Record<string, any> | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = str(body?.action, 40);
    const session = await getPortalSession(req);
    if (action === 'verify_code' || action === 'submit') {
      const limited =
        action === 'verify_code'
          ? await rateLimit(req, 'report-code', 15, 600, corsHeaders)
          : await rateLimit(req, 'report-submit', 20, 3600, corsHeaders);
      if (limited) return limited;
    }

    // ---- Admin: read the access code(s) they are allowed to see -------------
    if (action === 'list_codes') {
      if (!session) return json({ error: 'Please sign in.' }, 401);
      let query = admin.from('church_report_codes').select('church_name, code_hint, updated_at');
      if (session.role !== 'Superadmin') {
        if (!session.church_name) return json({ error: 'Your account has no branch yet.' }, 403);
        query = query.ilike('church_name', session.church_name);
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ codes: data || [] });
    }

    // ---- Admin: create or rotate a branch access code ----------------------
    if (action === 'rotate_code') {
      if (!session) return json({ error: 'Please sign in.' }, 401);
      const churchName =
        session.role === 'Superadmin' ? str(body?.churchName) : str(session.church_name);
      if (!churchName) return json({ error: 'A church is required.' }, 400);

      const church = await findChurch(churchName);
      const code = newCode();
      const existing = await codeRowFor(churchName);
      const values = {
        church_id: church?.id ?? null,
        church_name: church?.name || churchName,
        code_hash: await sha256(code),
        code_hint: code,
        created_by: session.user_name || session.user_email || 'Admin',
      };
      const { error } = existing
        ? await admin.from('church_report_codes').update(values).eq('id', existing.id)
        : await admin.from('church_report_codes').insert(values);
      if (error) return json({ error: error.message }, 400);
      return json({ code, churchName: values.church_name });
    }

    // ---- Public: check the access code before showing the form -------------
    if (action === 'verify_code' || action === 'submit') {
      let row: Record<string, any> | null = null;
      let signedLeader: Record<string, any> | null = null;
      const leaderCode = str(body?.leaderCode, 24).toUpperCase();
      if (leaderCode) {
        // ---- Leader sign-in: personal LDR code + the phone number on file ----
        const phone = str(body?.phone, 30).replace(/\D/g, '').slice(-9);
        if (phone.length < 9) return json({ error: 'Enter the phone number you registered with.' }, 400);
        const { data: l } = await admin
          .from('leaders')
          .select('id, full_name, church_name, contact, cell_or_pcf_name, leader_type')
          .ilike('leader_code', leaderCode)
          .maybeSingle();
        const onFile = String(l?.contact || '').replace(/\D/g, '').slice(-9);
        if (!l || !onFile || onFile !== phone) {
          return json({ error: 'That leader code and phone number do not match our records.' }, 403);
        }
        signedLeader = l;
        row = { church_name: l.church_name };
      } else {
        const churchName = str(body?.churchName);
        const code = str(body?.code, 24).toUpperCase();
        if (!churchName || !code) {
          return json({ error: 'Select your church and enter the access code.' }, 400);
        }
        row = await codeRowFor(churchName);
        if (!row) {
          return json(
            { error: 'No access code has been set for this church yet. Ask your church administrator.' },
            403,
          );
        }
        if (row.code_hash !== (await sha256(code))) {
          return json({ error: 'That access code is not correct for this church.' }, 403);
        }
      }

      if (action === 'verify_code') {
        return json({
          ok: true,
          churchName: row.church_name,
          leader: signedLeader
            ? {
                fullName: signedLeader.full_name,
                cellOrPcfName: signedLeader.cell_or_pcf_name || '',
                leaderType: signedLeader.leader_type,
              }
            : null,
        });
      }

      // ---- Public: store the submitted report ------------------------------
      const report = body?.report || {};
      const leaderName = signedLeader ? String(signedLeader.full_name) : str(report?.leaderName);
      if (!leaderName) return json({ error: 'Select the name of the leader.' }, 400);

      const church = await findChurch(row.church_name);
      let leaderId: string | null = null;
      const { data: leaderRow } = await admin
        .from('leaders')
        .select('id')
        .ilike('church_name', row.church_name)
        .ilike('full_name', leaderName)
        .maybeSingle();
      if (leaderRow) leaderId = (leaderRow as any).id;

      const grid = cleanNumbers(trimObject(report?.reportGrid));
      const evangelism = cleanNumbers(trimObject(report?.evangelism));
      let soulsList, attendanceList, registerList;
      try {
        soulsList = cleanPhones(trimList(report?.soulsWonList), ['contact']);
        attendanceList = cleanPhones(trimList(report?.cellAttendance), ['contact']);
        registerList = cleanPhones(trimList(report?.sundayRegister), ['contact', 'absenteeContact']);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
      const insert = {
        church_id: church?.id ?? null,
        church_name: row.church_name,
        leader_id: leaderId,
        leader_name: leaderName,
        cell_name: str(report?.cellName),
        outreach_centre: str(report?.outreachCentre),
        report_date: str(report?.reportDate, 10) || new Date().toISOString().slice(0, 10),
        report_grid: grid,
        evangelism,
        souls_won_list: soulsList,
        cell_attendance: attendanceList,
        sunday_register: registerList,
        total_attendance: num((grid as any)?.totalAttendance?.cell),
        total_first_timers: num((grid as any)?.totalFirstTimers?.cell),
        total_souls_won: num((grid as any)?.gotSaved?.cell),
        total_offering: num((grid as any)?.totalOffering?.cell),
        submitted_by: leaderName,
      };

      const { data, error } = await admin.from('cell_reports').insert(insert).select('id').single();
      if (error) return json({ error: error.message }, 400);

      await admin.from('audit_logs').insert({
        actor: leaderName,
        church_id: church?.id ?? null,
        church_name: row.church_name,
        action: `Submitted a weekly cell report for ${insert.cell_name || 'their cell'}`,
        category: 'Cell Report',
        icon: 'assignment_turned_in',
      });

      return json({ ok: true, id: (data as any)?.id });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (err) {
    return json({ error: (err as Error)?.message || 'Unexpected error.' }, 500);
  }
});
