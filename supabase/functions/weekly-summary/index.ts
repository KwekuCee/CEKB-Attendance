// Monday summary: per-branch attendance, new members, cell reports and leaders missing reports.
import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendMail } from '../_shared/mailer.ts';
import { isScheduledCall } from '../_shared/app-cron.ts';
import { getPortalSession } from '../_shared/portal-session.ts';
import { getPlatformConfig } from '../_shared/platform.ts';

const corsHeaders = { ...baseCorsHeaders, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-portal-session, x-cron-token' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!(await isScheduledCall(req))) {
    const s = await getPortalSession(req);
    if (!s || (s as any).role !== 'Superadmin') return json({ success: false, message: 'Only the group account can send this summary.' }, 401);
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cfg = await getPlatformConfig(db);
  if (cfg.maintenance || (!cfg.weeklySummary && !cfg.reportReminders)) return json({ success: true, skipped: 'Disabled in platform settings' });
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  const [{ data: churches }, { data: att }, { data: mem }, { data: reps }, { data: leaders }, { data: supers }] = await Promise.all([
    db.from('churches').select('name, members_count'),
    db.from('attendance_records').select('church_name, member_id').gte('attendance_date', since),
    db.from('members').select('church_name, status').gte('join_date', since),
    db.from('cell_reports').select('church_name, leader_id, leader_name, total_souls_won, total_offering').gte('report_date', since),
    db.from('leaders').select('id, full_name, email, church_name, leader_type').in('leader_type', ['Cell Leader', 'PCF Leader']),
    db.from('user_profiles').select('email, full_name').eq('role', 'Superadmin'),
  ]);

  const lc = (v: string | null) => (v || '').toLowerCase();
  const rows = (churches || []).map((c: any) => {
    const n = lc(c.name);
    const a = (att || []).filter((r: any) => lc(r.church_name) === n);
    const r = (reps || []).filter((x: any) => lc(x.church_name) === n);
    const reported = new Set(r.map((x: any) => x.leader_id));
    const missing = (leaders || []).filter((l: any) => lc(l.church_name) === n && !reported.has(l.id));
    return { name: c.name, members: c.members_count, checkins: a.length, unique: new Set(a.map((x: any) => x.member_id)).size,
      newMembers: (mem || []).filter((m: any) => lc(m.church_name) === n).length, reports: r.length,
      souls: r.reduce((s: number, x: any) => s + (x.total_souls_won || 0), 0),
      offering: r.reduce((s: number, x: any) => s + Number(x.total_offering || 0), 0), missing };
  });

  const td = 'padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px';
  const table = `<table style="width:100%;border-collapse:collapse"><tr style="background:#eff6ff;color:#1d4ed8">${['Branch', 'Members', 'Check-ins', 'New', 'Reports', 'Souls won', 'Offering'].map((h) => `<th style="${td};text-align:left">${h}</th>`).join('')}</tr>${rows.map((r) => `<tr><td style="${td}"><strong>${esc(r.name)}</strong></td><td style="${td}">${r.members}</td><td style="${td}">${r.checkins} (${r.unique} people)</td><td style="${td}">${r.newMembers}</td><td style="${td}">${r.reports}</td><td style="${td}">${r.souls}</td><td style="${td}">GH₵${r.offering.toFixed(2)}</td></tr>`).join('')}</table>`;
  const missing = rows.filter((r) => r.missing.length).map((r) => `<p style="margin:12px 0 4px"><strong>${esc(r.name)}</strong> — no report from:</p><p style="margin:0;color:#475569">${r.missing.map((l: any) => esc(l.full_name)).join(', ')}</p>`).join('');
  const html = `<h2 style="color:#1d4ed8;margin:0 0 8px">Weekly summary</h2><p>Here is how every branch did in the last 7 days (since ${since}).</p>${table}${missing ? `<h3 style="color:#1d4ed8;margin-top:20px">Cell reports still missing</h3>${missing}` : '<p>Every cell and PCF leader submitted a report this week.</p>'}`;

  let sent = 0;
  // Gentle reminder to each leader who has not sent a report this week.
  if (cfg.reportReminders) for (const r of rows) for (const l of r.missing as any[]) {
    if (!l.email) continue;
    await sendMail({ to: l.email, subject: 'Reminder: your weekly cell report', html: `<h2 style="color:#1d4ed8;margin:0 0 8px">Hello ${esc(l.full_name)},</h2><p>We haven't received your cell report for the past week yet. Please submit it from the <strong>Submit Cell Report</strong> button on <a href="https://gcycattendance.online">gcycattendance.online</a>.</p><p>Thank you for serving!</p>` });
  }
  if (cfg.weeklySummary) for (const s of supers || []) if (s.email && (await sendMail({ to: s.email, subject: 'CEKB weekly summary', html })).ok) sent++;
  return json({ success: true, sent, branches: rows.length });
});
