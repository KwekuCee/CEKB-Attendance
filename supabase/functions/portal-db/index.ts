import { rateLimit } from '../_shared/rate-limit.ts';
import { sendMail } from '../_shared/mailer.ts';
import { getPlatformConfig, type PlatformConfig } from '../_shared/platform.ts';
// Server-side data gateway for the CEKB portal.
//
// The database tables are locked to the service role, so the browser can never
// read or write them directly. Every read/write goes through this function,
// which validates the caller's session, limits which tables and columns can be
// touched, and strips credential columns out of every response.

import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-portal-session',
};

const SESSION_TTL_HOURS = 12;
let platformCache: { at: number; cfg: PlatformConfig } | null = null;
async function platform(fresh = false): Promise<PlatformConfig> {
  if (!fresh && platformCache && Date.now() - platformCache.at < 15000) return platformCache.cfg;
  const cfg = await getPlatformConfig(admin);
  platformCache = { at: Date.now(), cfg };
  return cfg;
}
const SENSITIVE_COLUMNS = ['password_hash', 'password'];

/** Columns visitors (not signed in) may read, per table. */
const PUBLIC_READ: Record<string, string> = {
  churches: 'id, name, pastor_name, members_count, status, zone, created_at, updated_at',
  leaders:
    'id, church_id, church_name, full_name, leader_type, cell_or_pcf_name, parent_leader_id, is_appointed, downstream_count, promotion_status, created_at',
  members:
    'id, church_id, church_name, full_name, gender, status, role, invited_by_leader_id, invited_by_name, service_count, foundation_class, join_date, photo_url, created_at',
  service_types: 'id, church_id, name, description, is_global, is_active, created_at',
};

/** Tables a visitor may add rows to (self check-in, self registration, sign-up). */
const PUBLIC_WRITE = new Set([
  'members',
  'attendance_records',
  'leaders',
  'churches',
  'church_admin_accounts',
  'user_profiles',
  'audit_logs',
]);

/** Tables only a Superadmin may change. */
const SUPERADMIN_WRITE = new Set(['admin_settings']);

const ALLOWED_TABLES = new Set([
  'members',
  'leaders',
  'attendance_records',
  'absence_records',
  'churches',
  'church_admin_accounts',
  'user_profiles',
  'audit_logs',
  'announcements',
  'promotion_queue',
  'service_types',
  'admin_settings',
  'cell_reports',
  'email_send_log',
  'request_rate_limits',
]);

/** Read-only system tables only the group account may see. */
const SUPERADMIN_ONLY = new Set(['email_send_log', 'request_rate_limits']);

const FILTER_OPS = new Set(['eq', 'neq', 'ilike', 'like', 'gte', 'lte', 'gt', 'lt', 'in', 'is', 'not']);

/**
 * Tables that belong to a single branch. Anyone who is not the group account
 * only ever receives their own branch's rows, enforced here on the server so
 * the browser never holds another branch's records.
 */
const BRANCH_SCOPED = new Set([
  'members',
  'leaders',
  'attendance_records',
  'absence_records',
  'church_admin_accounts',
  'promotion_queue',
  'audit_logs',
  'cell_reports',
  'user_profiles',
]);

/** Ushers can only look people up and record check-ins. */
const USHER_READ = new Set(['members', 'attendance_records', 'service_types', 'churches', 'leaders']);

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

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!SENSITIVE_COLUMNS.includes(k)) out[k] = v;
    }
    return out;
  }
  return value;
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface Session {
  role: string;
  user_email: string | null;
  user_name: string | null;
  church_name: string | null;
  church_id: string | null;
}

async function getSession(req: Request): Promise<Session | null> {
  const token = req.headers.get('x-portal-session');
  if (!token) return null;
  const { data } = await admin
    .from('portal_sessions')
    .select('role, user_email, user_name, church_name, church_id, expires_at')
    .eq('token_hash', await sha256(token))
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;
  return data as unknown as Session;
}

async function createSession(user: {
  email?: string | null;
  name?: string | null;
  role: string;
  church?: string | null;
}) {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await admin.from('portal_sessions').insert({
    token_hash: await sha256(token),
    user_email: user.email || null,
    user_name: user.name || null,
    role: user.role,
    church_name: user.church || null,
    expires_at: new Date(Date.now() + (user.role === 'Developer' ? 8 : Math.min(72, Math.max(1, Number((await platform()).sessionHours) || SESSION_TTL_HOURS))) * 3600 * 1000).toISOString(),
  });
  return token;
}

// ---------------------------------------------------------------- query action

interface QueryRequest {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  columns?: string;
  values?: unknown;
  upsert?: { onConflict?: string };
  filters?: Array<{ op: string; column: string; value: unknown }>;
  or?: string;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
  returning?: string;
}

async function handleQuery(body: QueryRequest, session: Session | null) {
  const { table, op } = body;
  if (!ALLOWED_TABLES.has(table)) return json({ error: { message: 'Table not available.' } }, 400);

  const isRead = op === 'select';
  if (SUPERADMIN_ONLY.has(table) && (session?.role !== 'Superadmin' || !isRead)) {
    return json({ error: { message: 'Only the group account can view this.' } }, 403);
  }

  if (!session && !isRead) {
    const cfg = await platform();
    const rows0 = (Array.isArray(body.values) ? body.values : [body.values]) as Array<Record<string, unknown>>;
    if (table === 'churches') {
      if (!cfg.allowRegistrations) return json({ error: { message: 'New church registrations are closed right now.' } }, 403);
      if ((await countOf('churches')) >= Number(cfg.maxChurches || 0)) return json({ error: { message: 'The platform has reached its church limit. Please contact support.' } }, 403);
    }
    if (table === 'user_profiles' && rows0.some((r) => r?.role !== 'Leader') && !cfg.allowRegistrations) return json({ error: { message: 'New church registrations are closed right now.' } }, 403);
    if ((table === 'leaders' || (table === 'user_profiles' && rows0.some((r) => r?.role === 'Leader'))) && !cfg.allowLeaderSignup) return json({ error: { message: 'Leader sign-up is closed right now.' } }, 403);
    if (table === 'members' && !cfg.allowSelfRegistration) return json({ error: { message: 'Self registration is paused right now.' } }, 403);
    if (table === 'attendance_records' && !cfg.allowSelfCheckin) return json({ error: { message: 'Self check-in is paused right now.' } }, 403);
  }
  if (session && table === 'user_profiles' && !isRead && op !== 'delete' && session.role !== 'Superadmin' && !(await platform()).allowUsherAccounts) {
    return json({ error: { message: 'Creating staff accounts is paused by the platform administrator.' } }, 403);
  }

  if (!session) {
    if (isRead && !PUBLIC_READ[table]) {
      return json({ error: { message: 'Please sign in to view this data.' } }, 401);
    }
    if (!isRead && !(PUBLIC_WRITE.has(table) && (op === 'insert' || op === 'upsert'))) {
      return json({ error: { message: 'Please sign in to make this change.' } }, 401);
    }
  }

  if (session?.role === 'Usher') {
    const ok = isRead ? USHER_READ.has(table) : table === 'attendance_records' && (op === 'insert' || op === 'upsert');
    if (!ok) return json({ error: { message: 'Ushers can only scan and record check-ins.' } }, 403);
  }

  // The developer account manages the system but never sees personal records.
  if (session?.role === 'Developer') {
    const ok = table === 'admin_settings' || table === 'service_types';
    if (!ok) return json({ error: { message: 'The developer account only sees totals, not personal records.' } }, 403);
  }

  // Only church pastors (and the group account) may change the leader hierarchy.
  if (session && table === 'leaders' && !isRead && session.role !== 'Church Pastor' && session.role !== 'Superadmin') {
    const rows = (Array.isArray(body.values) ? body.values : body.values ? [body.values] : []) as Array<Record<string, unknown>>;
    const touchesHierarchy = op === 'delete' || rows.some((r) => r && ('parent_leader_id' in r || 'leader_type' in r));
    if (touchesHierarchy && op !== 'insert') {
      return json({ error: { message: 'Only the church pastor can change the leader hierarchy.' } }, 403);
    }
    if (op === 'insert') for (const r of rows) if (r) delete r.parent_leader_id;
  }

  // Leaders have a read-only view of their own branch.
  if (session?.role === 'Leader' && !isRead) {
    return json({ error: { message: 'Leader accounts can only view records.' } }, 403);
  }

  // Church pastors look after their church but never scan check-ins.
  if (session?.role === 'Church Pastor' && table === 'attendance_records' && !isRead && op !== 'delete' && op !== 'update') {
    // pastors may still correct records, but recording is for admins and ushers
    return json({ error: { message: 'Church pastors do not record check-ins.' } }, 403);
  }

  // Branch accounts may only manage staff accounts below them, never group accounts.
  // Church pastors appoint church admins and ushers; church admins appoint ushers.
  const staffRoles = session?.role === 'Church Pastor' ? ['Usher', 'Church Admin'] : ['Usher'];
  if (session && session.role !== 'Superadmin' && table === 'user_profiles' && !isRead) {
    if (op !== 'insert' && op !== 'upsert' && op !== 'delete' && op !== 'update') return json({ error: { message: 'Not allowed.' } }, 403);
    const rows = (Array.isArray(body.values) ? body.values : body.values ? [body.values] : []) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const email = String(row.email || '').toLowerCase();
      const isOwnProfile = email && email === String(session.user_email || '').toLowerCase();
      if (isOwnProfile) { row.role = session.role; delete row.admin_verified; row.church_name = session.church_name; continue; }
      if (email && (op === 'insert' || op === 'upsert')) {
        const { data: existing } = await admin.from('user_profiles').select('role').ilike('email', email).maybeSingle();
        if (existing && !staffRoles.includes(String(existing.role))) return json({ error: { message: 'This email already belongs to another account.' } }, 409);
      }
      row.role = staffRoles.includes(String(row.role)) ? row.role : 'Usher';
      row.church_name = session.church_name; row.admin_verified = true;
    }
  }

  if (!isRead && SUPERADMIN_WRITE.has(table) && session?.role !== 'Superadmin' && session?.role !== 'Developer') {
    return json({ error: { message: 'Only the group account can change these settings.' } }, 403);
  }

  // Visitors may only create brand-new accounts, never overwrite existing ones.
  // Public sign-up creates either a church pastor (with a brand-new church) or a leader.
  if (!session && (table === 'user_profiles' || table === 'church_admin_accounts')) {
    const rows = Array.isArray(body.values) ? body.values : [body.values];
    for (const row of rows as Array<Record<string, unknown>>) {
      const emailColumn = table === 'user_profiles' ? 'email' : 'admin_email';
      const email = String(row?.[emailColumn] || '').trim();
      if (!email) return json({ error: { message: 'An email address is required.' } }, 400);
      const { data: existing } = await admin
        .from(table)
        .select(emailColumn)
        .ilike(emailColumn, email)
        .maybeSingle();
      if (existing) {
        return json({ error: { message: 'An account with this email already exists.' } }, 409);
      }
      if (table === 'user_profiles') {
        const role = row.role === 'Leader' ? 'Leader' : 'Church Pastor';
        if (role === 'Church Pastor') {
          const { data: pastor } = await admin.from('user_profiles').select('id')
            .eq('role', 'Church Pastor').ilike('church_name', String(row.church_name || '')).limit(1).maybeSingle();
          if (pastor) return json({ error: { message: 'This church already has a pastor account. Ask the pastor to appoint you instead.' } }, 409);
        }
        row.role = role;
        // Leaders can sign in straight away; pastors must confirm their email first.
        row.admin_verified = role === 'Leader';
      } else {
        row.admin_verified = false;
      }
    }
  }

  // A branch account always writes into its own branch, whatever the browser sent.
  if (
    session &&
    session.role !== 'Superadmin' &&
    session.church_name &&
    BRANCH_SCOPED.has(table) &&
    (op === 'insert' || op === 'upsert')
  ) {
    const rows = (Array.isArray(body.values) ? body.values : [body.values]) as Array<
      Record<string, unknown>
    >;
    for (const row of rows) {
      if (row && typeof row === 'object' && 'church_name' in row) {
        row.church_name = session.church_name;
      }
    }
  }

  let query: any = admin.from(table);

  if (op === 'select') {
    query = query.select(session ? body.columns || '*' : PUBLIC_READ[table]);
  } else if (op === 'insert') {
    query = query.insert(body.values as any);
    if (body.returning) query = query.select(body.returning);
  } else if (op === 'upsert') {
    query = query.upsert(body.values as any, body.upsert as any);
    if (body.returning) query = query.select(body.returning);
  } else if (op === 'update') {
    query = query.update(body.values as any);
  } else if (op === 'delete') {
    query = query.delete();
  } else {
    return json({ error: { message: 'Unsupported operation.' } }, 400);
  }

  for (const filter of body.filters || []) {
    if (!FILTER_OPS.has(filter.op)) {
      return json({ error: { message: 'Unsupported filter.' } }, 400);
    }
    if (filter.op === 'not') {
      query = query.not(filter.column, 'is', filter.value as any);
    } else {
      query = (query as any)[filter.op](filter.column, filter.value as any);
    }
  }

  // Branch scoping: a branch account never sees or changes another branch's rows.
  if (session && session.role !== 'Superadmin' && BRANCH_SCOPED.has(table) && op !== 'insert' && op !== 'upsert') {
    if (!session.church_name) {
      return json({ error: { message: 'Your account is not linked to a branch yet.' } }, 403);
    }
    query = query.ilike('church_name', session.church_name);
    if (table === 'user_profiles' && op !== 'select') query = query.in('role', staffRoles);
  }

  if (body.or) {
    if (!session) return json({ error: { message: 'Please sign in to run this search.' } }, 401);
    query = query.or(body.or);
  }
  if (body.order) {
    query = query.order(body.order.column, { ascending: body.order.ascending !== false });
  }
  if (typeof body.limit === 'number') query = query.limit(body.limit);
  if (body.single) query = query.maybeSingle();

  const { data, error } = await query;
  if (error) {
    console.error(`portal-db ${op} ${table} failed:`, error.message);
    return json({ error: { message: error.message, code: error.code } }, 200);
  }
  return json({ data: stripSensitive(data) });
}

// ---------------------------------------------------------------- login action

async function handleLogin(body: any) {
  const identifier = String(body?.identifier || '').trim();
  const password = String(body?.password || '').trim();
  const selectedRole = body?.role === 'Superadmin' ? 'Superadmin' : null;

  if (!identifier || !password) {
    return json({ success: false, error: 'Please enter your email and password.' });
  }

  const { data: rpcData } = await admin.rpc('verify_user_login', {
    p_identifier: identifier,
    p_password: password,
    p_role: selectedRole,
    p_church_name: null,
  });

  if (rpcData && (rpcData as any).success && (rpcData as any).user) {
    const u = (rpcData as any).user;
    if (u.role === 'Superadmin') {
      const otp = String(body?.otp || '').replace(/\D/g, '');
      const email = String(u.email || '').toLowerCase();
      if (!otp) {
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
        await admin.from('login_otps').delete().ilike('email', email);
        await admin.from('login_otps').insert({ email, code_hash: await sha256(code), expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
        const sent = await sendMail({ to: email, subject: 'Your CEKB sign-in code', html: `<h2 style="color:#1d4ed8;margin:0 0 8px">Your sign-in code</h2><p>Use this code to finish signing in to the group account:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1e3a8a;margin:16px 0">${code}</p><p>It expires in 10 minutes. If you did not try to sign in, change your password straight away.</p>` });
        if (!sent.ok) return json({ success: false, error: 'We could not send your sign-in code. Please try again.' });
        const masked = email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
        return json({ success: false, error: 'otp_required', email: masked });
      }
      const { data: row } = await admin.from('login_otps').select('*').ilike('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) {
        return json({ success: false, error: 'This code has expired. Sign in again to get a new one.' });
      }
      if (row.code_hash !== (await sha256(otp))) {
        await admin.from('login_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id);
        return json({ success: false, error: 'otp_invalid' });
      }
      await admin.from('login_otps').delete().eq('id', row.id);
    }
    const token = await createSession({
      email: u.email,
      name: u.name,
      role: u.role,
      church: u.church,
    });
    await admin.from('audit_logs').insert({
      actor: u.name || 'Admin',
      church_name: u.church || null,
      action: `User signed in: ${u.name || u.email} (${u.role})`,
      category: 'System',
      icon: 'lock_open',
    });
    return json({ success: true, user: u, token });
  }

  const message = (rpcData as any)?.error || 'Incorrect email or password.';
  return json({ success: false, error: message });
}

// -------------------------------------------------------------- photo storage

async function handleUpload(body: any, session: Session | null) {
  if (!session && !body?.allowSelfService) {
    return json({ error: { message: 'Please sign in to upload a photo.' } }, 401);
  }
  const path = String(body?.path || '');
  const base64 = String(body?.content || '').replace(/^data:[^;]+;base64,/, '');
  const contentType = String(body?.contentType || 'image/jpeg');
  if (!path || !base64 || path.includes('..')) {
    return json({ error: { message: 'Invalid photo upload.' } }, 400);
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 5 * 1024 * 1024) {
    return json({ error: { message: 'Photos must be smaller than 5 MB.' } }, 400);
  }
  const { error } = await admin.storage
    .from('member-photos')
    .upload(path, bytes, { contentType, upsert: true });
  if (error) return json({ error: { message: error.message } }, 200);
  return json({ data: { path } });
}

async function handleSignedUrl(body: any, session: Session | null) {
  if (!session) return json({ error: { message: 'Please sign in to view photos.' } }, 401);
  const path = String(body?.path || '');
  if (!path || path.includes('..')) return json({ error: { message: 'Invalid photo.' } }, 400);
  const { data, error } = await admin.storage.from('member-photos').createSignedUrl(path, 3600);
  if (error) return json({ error: { message: error.message } }, 200);
  return json({ data });
}


// ------------------------------------------------------- developer + group code

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function handleDevLogin(body: any) {
  const user = Deno.env.get('DEVELOPER_USERNAME') || '';
  const pass = Deno.env.get('DEVELOPER_PASSWORD') || '';
  if (!user || !pass) return json({ success: false, error: 'The developer account is not set up yet.' });
  const okUser = safeEqual(String(body?.username || '').trim().toLowerCase(), user.trim().toLowerCase());
  const okPass = safeEqual(String(body?.password || ''), pass);
  if (!okUser || !okPass) return json({ success: false, error: 'Incorrect username or password.' });
  const token = await createSession({ email: null, name: 'Developer', role: 'Developer', church: null });
  await admin.from('audit_logs').insert({ actor: 'Developer', action: 'Developer signed in', category: 'System', icon: 'terminal' });
  return json({ success: true, token });
}

async function countOf(table: string, apply?: (q: any) => any) {
  let q: any = admin.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count || 0;
}

async function handleDevStats(session: Session | null) {
  if (session?.role !== 'Developer') return json({ error: { message: 'Developer sign-in required.' } }, 403);
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const { data: churches } = await admin.from('churches').select('name, status, members_count');
  const [members, leaders, attendanceToday, attendance7, reports7, pastors, admins, ushers, groupPastors, emailsFailed7, emailsSent7, activeSessions] = await Promise.all([
    countOf('members'), countOf('leaders'),
    countOf('attendance_records', (q) => q.eq('attendance_date', today)),
    countOf('attendance_records', (q) => q.gte('checked_in_at', since7)),
    countOf('cell_reports', (q) => q.gte('created_at', since7)),
    countOf('user_profiles', (q) => q.eq('role', 'Church Pastor')),
    countOf('user_profiles', (q) => q.eq('role', 'Church Admin')),
    countOf('user_profiles', (q) => q.eq('role', 'Usher')),
    countOf('user_profiles', (q) => q.eq('role', 'Superadmin')),
    countOf('email_send_log', (q) => q.gte('created_at', since7).in('status', ['failed', 'dlq', 'bounced'])),
    countOf('email_send_log', (q) => q.gte('created_at', since7).eq('status', 'sent')),
    countOf('portal_sessions', (q) => q.gt('expires_at', new Date().toISOString())),
  ]);
  return json({ data: {
    churches: (churches || []).map((c: any) => ({ name: c.name, status: c.status, members: c.members_count })),
    totals: { members, leaders, attendanceToday, attendance7, reports7, pastors, admins, ushers, groupPastors },
    health: { emailsSent7, emailsFailed7, activeSessions },
  } });
}

// Totals-only deep analytics for the developer console. Never returns personal fields.
const DEV_TABLES = ['churches', 'members', 'leaders', 'attendance_records', 'cell_reports', 'announcements', 'audit_logs', 'email_send_log', 'user_profiles', 'church_admin_accounts', 'portal_sessions', 'absence_records', 'qr_tokens', 'service_types', 'suppressed_emails'];
const SAFE_LOG_CATEGORIES = new Set(['System', 'Security', 'Settings', 'Church']);

async function handleDevAnalytics(session: Session | null) {
  if (session?.role !== 'Developer') return json({ error: { message: 'Developer sign-in required.' } }, 403);
  const now = Date.now();
  const since90 = new Date(now - 90 * 864e5).toISOString();
  const since24 = new Date(now - 864e5).toISOString();
  const since30 = new Date(now - 30 * 864e5).toISOString();
  const [{ data: att }, { data: churches }, { data: mem }, { data: lead }, { data: rep }, { data: mail }, { data: logs }, { data: profs }, rowCounts, { data: anns }] = await Promise.all([
    admin.from('attendance_records').select('attendance_date, church_name').gte('attendance_date', since90.slice(0, 10)).limit(100000),
    admin.from('churches').select('name, status, members_count, created_at'),
    admin.from('members').select('church_name, created_at, status').limit(100000),
    admin.from('leaders').select('church_name').limit(100000),
    admin.from('cell_reports').select('church_name, created_at').limit(100000),
    admin.from('email_send_log').select('template_name, status, error_message, created_at, metadata').gte('created_at', since30).order('created_at', { ascending: false }).limit(5000),
    admin.from('audit_logs').select('id, actor, church_name, action, category, icon, created_at').order('created_at', { ascending: false }).limit(1000),
    admin.from('user_profiles').select('role, church_name, admin_verified, created_at'),
    Promise.all(DEV_TABLES.map(async (t) => [t, await countOf(t)] as const)),
    admin.from('announcements').select('title, target_audience, sender_name, created_at').order('created_at', { ascending: false }).limit(20),
  ]);
  const key = (s: any) => String(s || '').trim().toLowerCase();
  const daily: Record<string, number> = {};
  const lastSeen: Record<string, string> = {};
  const att30: Record<string, number> = {};
  for (const r of att || []) {
    daily[r.attendance_date] = (daily[r.attendance_date] || 0) + 1;
    const k = key(r.church_name);
    if (!lastSeen[k] || lastSeen[k] < r.attendance_date) lastSeen[k] = r.attendance_date;
    if (r.attendance_date >= since30.slice(0, 10)) att30[k] = (att30[k] || 0) + 1;
  }
  const series = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(now - (89 - i) * 864e5).toISOString().slice(0, 10);
    return { date: d, count: daily[d] || 0 };
  });
  const tally = (rows: any[] | null) => { const m: Record<string, number> = {}; for (const r of rows || []) m[key(r.church_name)] = (m[key(r.church_name)] || 0) + 1; return m; };
  const memBy = tally(mem), leadBy = tally(lead), repBy = tally(rep), staffBy = tally(profs);
  const churchRows = (churches || []).map((c: any) => {
    const k = key(c.name);
    const rows = (memBy[k] || 0) + (leadBy[k] || 0) + (repBy[k] || 0) + (att30[k] || 0);
    return { name: c.name, status: c.status, members: memBy[k] ?? c.members_count ?? 0, leaders: leadBy[k] || 0, staff: staffBy[k] || 0, reports: repBy[k] || 0, checkins30: att30[k] || 0, lastActive: lastSeen[k] || null, createdAt: c.created_at, rows, estBytes: rows * 1200, active: !!lastSeen[k] && lastSeen[k] >= since30.slice(0, 10) };
  });
  const monthKey = (d: string) => String(d).slice(0, 7);
  const growth: Record<string, { churches: number; members: number }> = {};
  for (const c of churches || []) { const m = monthKey(c.created_at); growth[m] = growth[m] || { churches: 0, members: 0 }; growth[m].churches++; }
  for (const m of mem || []) { const k = monthKey(m.created_at); growth[k] = growth[k] || { churches: 0, members: 0 }; growth[k].members++; }
  const mails = mail || [];
  const failedStatuses = new Set(['failed', 'dlq', 'bounced', 'suppressed', 'complained']);
  const mailBy = (s: (m: any) => boolean) => mails.filter(s).length;
  const failures = mails.filter((m: any) => failedStatuses.has(m.status)).slice(0, 50).map((m: any) => ({ template: m.template_name, status: m.status, reason: m.error_message || 'Unknown', at: m.created_at }));
  const reasons: Record<string, number> = {};
  for (const f of mails.filter((m: any) => failedStatuses.has(m.status))) { const r = String(f.error_message || f.status).slice(0, 60); reasons[r] = (reasons[r] || 0) + 1; }
  const mailChurch: Record<string, number> = {};
  for (const m of mails) { const c = m.metadata?.church || m.metadata?.church_name; if (c) mailChurch[c] = (mailChurch[c] || 0) + 1; }
  // Registrations needing attention: unverified accounts older than a day.
  const flagged = (profs || []).filter((p: any) => !p.admin_verified && p.role !== 'Superadmin' && now - new Date(p.created_at).getTime() > 864e5).map((p: any) => ({ role: p.role, church: p.church_name, since: p.created_at }));
  // Integrity checks (counts only)
  const [orphanAtt, orphanMem, expiredSessions] = await Promise.all([
    countOf('attendance_records', (q) => q.is('church_id', null)),
    countOf('members', (q) => q.is('church_id', null)),
    countOf('portal_sessions', (q) => q.lt('expires_at', new Date().toISOString())),
  ]);
  const roleCounts: Record<string, number> = {};
  for (const p of profs || []) roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  const { data: fm } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'feature_matrix').maybeSingle();
  const { data: plat } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'platform_config').maybeSingle();
  return json({ data: {
    series, churches: churchRows,
    growth: Object.entries(growth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    tables: Object.fromEntries(rowCounts), roleCounts, flagged,
    messaging: {
      total30: mails.length, sent30: mailBy((m) => m.status === 'sent'), failed30: mailBy((m) => failedStatuses.has(m.status)),
      pending: mailBy((m) => m.status === 'pending'), last24: mailBy((m) => m.created_at >= since24),
      sms30: 0, failures, reasons, byChurch: mailChurch,
      byTemplate: mails.reduce((a: any, m: any) => { a[m.template_name] = (a[m.template_name] || 0) + 1; return a; }, {}),
    },
    integrity: { orphanAtt, orphanMem, expiredSessions },
    logs: (logs || []).map((l: any) => ({ id: l.id, category: l.category || 'General', icon: l.icon, church: l.church_name, at: l.created_at,
      action: SAFE_LOG_CATEGORIES.has(l.category) || l.actor === 'Developer' ? l.action : `${l.category || 'Record'} activity`,
      actor: ['Developer', 'System', 'Group Pastor'].includes(l.actor) ? l.actor : 'Church account' })),
    announcements: anns || [],
    featureMatrix: fm?.setting_value || null, platform: plat?.setting_value || null,
  } });
}

async function handleDevAction(body: any, session: Session | null) {
  if (session?.role !== 'Developer') return json({ error: { message: 'Developer sign-in required.' } }, 403);
  const op = String(body?.op || '');
  const log = (action: string, category = 'System') => admin.from('audit_logs').insert({ actor: 'Developer', action, category, icon: 'terminal' });
  if (op === 'setChurchStatus') {
    const status = String(body.status);
    if (!['Active', 'Inactive', 'Suspended'].includes(status)) return json({ error: 'Bad status' }, 400);
    await admin.from('churches').update({ status }).eq('name', String(body.name));
    await log(`Set church "${body.name}" status to ${status}`, 'Church');
    return json({ success: true });
  }
  if (op === 'saveSetting') {
    const k = String(body.key);
    if (!['feature_matrix', 'platform_config'].includes(k)) return json({ error: 'Bad key' }, 400);
    await admin.from('admin_settings').upsert({ setting_key: k, setting_value: body.value ?? {}, is_global: true, setting_type: 'json' }, { onConflict: 'setting_key' });
    platformCache = null;
    if (k === 'platform_config' && body.value?.maintenance) await admin.from('portal_sessions').delete().neq('role', 'Developer');
    await log(`Updated ${k.replace('_', ' ')}${k === 'platform_config' ? (body.value?.maintenance ? ' — maintenance ON' : ' — maintenance off') : ''}`, 'Settings');
    return json({ success: true });
  }
  if (op === 'broadcast') {
    const title = String(body.title || '').trim().slice(0, 200), message = String(body.message || '').trim().slice(0, 5000);
    if (!title || !message) return json({ error: 'Title and message required.' }, 400);
    await admin.from('announcements').insert({ title, message, target_audience: 'All Churches', sender_name: 'developer@gcycattendance.online', church_id: null });
    let emailed = 0;
    if (body.email) {
      const { data: staff } = await admin.from('user_profiles').select('email').in('role', ['Superadmin', 'Church Pastor', 'Church Admin']);
      const to = Array.from(new Set((staff || []).map((r: any) => String(r.email || '').toLowerCase()).filter((e) => e.includes('@'))));
      const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
      const html = `<h2>${esc(title)}</h2>${esc(message).split('\n').map((l) => `<p>${l}</p>`).join('')}<p style="color:#5b6b80;font-size:13px">— GCYC Developer</p>`;
      for (let i = 0; i < to.length; i += 10) {
        const res = await Promise.all(to.slice(i, i + 10).map((addr) => sendMail({ to: addr, subject: title, html, from: 'GCYC Developer <developer@gcycattendance.online>', replyTo: 'developer@gcycattendance.online' })));
        emailed += res.filter((r) => r.ok).length;
        await admin.from('email_send_log').insert(res.map((r) => ({ template_name: 'developer_broadcast', recipient_email: 'staff', status: r.ok ? 'sent' : 'failed', error_message: r.ok ? null : r.error?.slice(0, 500) })));
      }
    }
    await log(`Broadcast announcement: ${title}${body.email ? ` (emailed ${emailed} staff)` : ''}`);
    return json({ success: true, emailed });
  }
  if (op === 'backup') {
    const [{ data: settings }, { data: services }, { data: churches }] = await Promise.all([
      admin.from('admin_settings').select('setting_key, setting_value, setting_type, is_global').eq('is_global', true),
      admin.from('service_types').select('name, description, is_global, is_active, church_id').eq('is_global', true),
      admin.from('churches').select('name, status'),
    ]);
    await log('Created configuration backup', 'System');
    return json({ success: true, data: { version: 1, createdAt: new Date().toISOString(), settings: settings || [], services: services || [], churchStatuses: churches || [] } });
  }
  if (op === 'restore') {
    const b = body.backup;
    if (!b || b.version !== 1 || !Array.isArray(b.settings)) return json({ error: 'This file is not a valid CEKB backup.' }, 400);
    const allowed = new Set(['feature_matrix', 'platform_config']);
    const settings = b.settings.filter((r: any) => r && typeof r.setting_key === 'string').slice(0, 200)
      .map((r: any) => ({ setting_key: r.setting_key, setting_value: r.setting_value ?? {}, setting_type: r.setting_type || 'json', is_global: true }));
    if (settings.length) await admin.from('admin_settings').upsert(settings, { onConflict: 'setting_key' });
    let services = 0;
    for (const sv of (Array.isArray(b.services) ? b.services : []).slice(0, 200)) {
      const name = String(sv?.name || '').trim().slice(0, 120);
      if (!name) continue;
      const { data: ex } = await admin.from('service_types').select('id').eq('is_global', true).ilike('name', name).maybeSingle();
      if (ex) await admin.from('service_types').update({ description: sv.description ?? null, is_active: sv.is_active !== false }).eq('id', ex.id);
      else await admin.from('service_types').insert({ name, description: sv.description ?? null, is_global: true, is_active: sv.is_active !== false, church_id: null });
      services++;
    }
    let churches = 0;
    for (const c of (Array.isArray(b.churchStatuses) ? b.churchStatuses : []).slice(0, 1000)) {
      if (!c?.name || !['Active', 'Inactive', 'Suspended'].includes(c.status)) continue;
      const { count } = await admin.from('churches').update({ status: c.status }, { count: 'exact' }).eq('name', String(c.name));
      churches += count || 0;
    }
    platformCache = null;
    void allowed;
    await log(`Restored configuration backup from ${String(b.createdAt || 'unknown date').slice(0, 25)} (${settings.length} settings, ${services} services, ${churches} church statuses)`, 'System');
    return json({ success: true, restored: { settings: settings.length, services, churches } });
  }
  if (op === 'purgeSessions') {
    await admin.from('portal_sessions').delete().lt('expires_at', new Date().toISOString());
    await log('Purged expired sessions', 'Security');
    return json({ success: true });
  }
  return json({ error: 'Unknown operation' }, 400);
}

async function handleFeatureMatrix() {
  const { data } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'feature_matrix').maybeSingle();
  return json({ data: data?.setting_value || null });
}

async function handleCheckGroupCode(body: any) {
  const code = Deno.env.get('GROUP_PASTOR_CODE') || '';
  return json({ valid: safeEqual(String(body?.code || '').trim().toUpperCase(), code.toUpperCase()) });
}

async function handleClaimGroupPastor(body: any) {
  const code = Deno.env.get('GROUP_PASTOR_CODE') || '';
  if (!safeEqual(String(body?.code || '').trim().toUpperCase(), code.toUpperCase())) {
    return json({ success: false, error: 'Invalid group pastor code.' }, 403);
  }
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return json({ success: false, error: 'Email required.' }, 400);
  // Only a freshly registered, not-yet-confirmed pastor account can be promoted.
  const { data: row } = await admin.from('user_profiles').select('id, role, admin_verified, created_at')
    .ilike('email', email).maybeSingle();
  if (!row || row.role !== 'Church Pastor' || Date.now() - new Date(row.created_at).getTime() > 30 * 60000) {
    return json({ success: false, error: 'Pastor account not found.' }, 404);
  }
  await admin.from('user_profiles').update({ role: 'Superadmin' }).eq('id', row.id);
  await admin.from('audit_logs').insert({ actor: 'System', action: `Group pastor appointed via group code: ${email}`, category: 'System', icon: 'verified' });
  return json({ success: true });
}

// ------------------------------------------------------------------- dispatch

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: { message: 'Invalid request.' } }, 400);
    }

    const session = await getSession(req);

    if (body.action === 'platformStatus') {
      const c = await platform();
      return json({ data: { maintenance: !!c.maintenance, maintenanceMessage: c.maintenanceMessage, platformName: c.platformName, tagline: c.tagline,
        announcementBanner: c.announcementBanner, allowRegistrations: c.allowRegistrations, allowLeaderSignup: c.allowLeaderSignup,
        allowSelfRegistration: c.allowSelfRegistration, allowSelfCheckin: c.allowSelfCheckin, allowCellReports: c.allowCellReports, supportEmail: c.supportEmail } });
    }
    const devAction = ['devLogin', 'devStats', 'devAnalytics', 'devAction', 'logout'].includes(String(body.action));
    if (!devAction && session?.role !== 'Developer') {
      const c = await platform();
      if (c.maintenance) return json({ success: false, maintenance: true, error: { message: c.maintenanceMessage || 'The system is under maintenance.' } }, 503);
    }

    switch (body.action) {
      case 'query':
        return await handleQuery(body as QueryRequest, session);
      case 'login': {
        const limited =
          (await rateLimit(req, 'login-ip', 20, 600, corsHeaders, undefined, true)) ||
          (await rateLimit(req, 'login-id', 8, 600, corsHeaders, `id:${String((body as any).identifier || (body as any).email || '')}`, true));
        if (limited) return limited;
        return await handleLogin(body);
      }
      case 'logout': {
        const token = req.headers.get('x-portal-session');
        if (token) {
          await admin.from('portal_sessions').delete().eq('token_hash', await sha256(token));
        }
        return json({ success: true });
      }
      case 'devLogin': {
        const limited = await rateLimit(req, 'dev-login', 6, 600, corsHeaders, undefined, true);
        if (limited) return limited;
        return await handleDevLogin(body);
      }
      case 'devStats':
        return await handleDevStats(session);
      case 'devAnalytics':
        return await handleDevAnalytics(session);
      case 'devAction':
        return await handleDevAction(body, session);
      case 'featureMatrix':
        return await handleFeatureMatrix();
      case 'checkGroupCode': {
        const limited = await rateLimit(req, 'group-code', 10, 600, corsHeaders, undefined, true);
        if (limited) return limited;
        return await handleCheckGroupCode(body);
      }
      case 'claimGroupPastor': {
        const limited = await rateLimit(req, 'group-claim', 10, 600, corsHeaders, undefined, true);
        if (limited) return limited;
        return await handleClaimGroupPastor(body);
      }
      case 'upload':
        return await handleUpload(body, session);
      case 'signedUrl':
        return await handleSignedUrl(body, session);
      default:
        return json({ error: { message: 'Unknown request.' } }, 400);
    }
  } catch (err) {
    console.error('portal-db error', err);
    return json({ error: { message: 'Something went wrong. Please try again.' } }, 500);
  }
});
