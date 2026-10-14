import { rateLimit } from '../_shared/rate-limit.ts';
import { sendMail } from '../_shared/mailer.ts';
import {
  getMnotifyCampaignReport,
  getMnotifySenderIdStatus,
  getMnotifySmsBalance,
  registerMnotifySenderId,
  sendMnotifyMessage,
  sendMnotifySms,
} from '../_shared/mnotify.ts';
import { summarizeDeveloperAccounts } from '../_shared/developer-analytics.ts';
import { getPlatformConfig, type PlatformConfig } from '../_shared/platform.ts';
import { estimateSmsCost } from '../_shared/smsPricing.ts';
import { buildAttendanceCodeSms } from '../_shared/attendance-code-sms.ts';
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
const SENSITIVE_COLUMNS = ['password_hash', 'password', 'apiKey', 'apiSecret', 'api_key', 'api_secret'];

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

/** System-maintained columns never accepted from branch accounts or visitors. */
const PROTECTED_COLUMNS: Record<string, string[]> = {
  members: ['service_count', 'created_at', 'updated_at'],
  leaders: ['downstream_count', 'promotion_status', 'created_at', 'updated_at'],
  churches: ['members_count', 'created_at', 'updated_at'],
  user_profiles: ['auth_user_id', 'created_at', 'updated_at', 'email_verification_token', 'email_verification_sent_at', 'is_church_admin', 'onboarding_completed_at'],
  church_admin_accounts: ['admin_verified', 'email_verified', 'created_at'],
  cell_reports: ['created_at', 'updated_at'],
  announcements: ['created_at'],
  absence_records: ['created_at', 'updated_at'],
  promotion_queue: ['flagged_at', 'status'],
  service_types: ['created_at', 'updated_at'],
  attendance_records: ['is_late'],
  audit_logs: ['id', 'created_at'],
};
/** Extra columns visitors may never set. */
const ANON_PROTECTED: Record<string, string[]> = {
  churches: ['status'],
  leaders: ['is_appointed', 'parent_leader_id', 'onboarding_completed', 'onboarding_completed_at'],
  members: ['foundation_class'],
  attendance_records: ['verified_by'],
};

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
  'evangelism_records',
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
  'evangelism_records',
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

async function logMnotifyFailure(operation: string) {
  const { error } = await admin.from('audit_logs').insert({
    actor: 'System',
    action: `mNotify ${operation} request failed; provider details withheld.`,
    category: 'Messaging',
    icon: 'warning',
  });
  if (error) console.error('Could not record mNotify API failure:', error.message);
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
      if (!SENSITIVE_COLUMNS.includes(k)) out[k] = stripSensitive(v);
    }
    return out;
  }
  return value;
}

function safeSmsConfig(value: unknown) {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    provider: 'Mnotify',
    senderId: typeof config.senderId === 'string' ? config.senderId.slice(0, 11) : '',
    enabled: config.enabled === true,
    apiKeyConfigured: !!Deno.env.get('MNOTIFY_API_KEY')?.trim(),
  };
}

function stripSmsCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSmsCredentials);
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(row)) {
      out[key] = key === 'setting_value' && row.setting_key === 'sms_config'
        ? safeSmsConfig(item)
        : stripSmsCredentials(item);
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
  if (table === 'admin_settings' && !isRead) {
    const rows = (Array.isArray(body.values) ? body.values : [body.values]) as Array<Record<string, unknown>>;
    const writesSmsConfig = op === 'insert' || op === 'upsert'
      ? rows.some((row) => typeof row?.setting_key !== 'string' || row.setting_key === 'sms_config')
      : !(body.filters || []).some((filter) =>
        filter.column === 'setting_key' &&
        ((filter.op === 'eq' && filter.value !== 'sms_config') ||
          (filter.op === 'neq' && filter.value === 'sms_config')));
    if (writesSmsConfig) return json({ error: { message: 'Use the protected SMS settings action to update this configuration.' } }, 403);
  }
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
      // Signed-out visitors simply get no private rows (not an error), so the
      // public pages never break when a background read runs before sign-in.
      return json({ data: body.single ? null : [], error: null });
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
        // Everyone confirms their email before signing in, so nobody can claim a
        // church's leader account with an address they don't control.
        row.admin_verified = false;
        if (role === 'Leader') {
          const { data: ch } = await admin.from('churches').select('name').ilike('name', String(row.church_name || '')).maybeSingle();
          if (!ch) return json({ error: { message: 'Choose a registered church.' } }, 400);
          row.church_name = ch.name;
        }
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
      if (row && typeof row === 'object') {
        row.church_name = session.church_name;
        if (session.church_id) row.church_id = session.church_id;
        else delete row.church_id;
      }
    }
  }

  // Only plain column names may be written, and system-maintained columns are never
  // taken from the browser (except for the group account).
  if (!isRead && op !== 'delete') {
    const rows = (Array.isArray(body.values) ? body.values : body.values ? [body.values] : []) as Array<Record<string, unknown>>;
    if (!rows.length || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      return json({ error: { message: 'Invalid data.' } }, 400);
    }
    const protectedCols = session?.role === 'Superadmin' ? [] : [...(PROTECTED_COLUMNS[table] || []), ...(!session ? (ANON_PROTECTED[table] || []) : [])];
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!/^[a-z][a-z0-9_]{0,62}$/.test(k)) return json({ error: { message: 'Invalid field.' } }, 400);
        if (protectedCols.includes(k)) delete r[k];
      }
      // Updates never move a row to a new identity.
      if (op === 'update' && session?.role !== 'Superadmin') delete r.id;
      if (session && session.role !== 'Superadmin' && op === 'update' && BRANCH_SCOPED.has(table)) {
        delete r.church_id;
        if ('church_name' in r) r.church_name = session.church_name;
      }
    }
  }

  // Branch accounts may only change their own church's record.
  if (session && session.role !== 'Superadmin' && table === 'churches' && !isRead) {
    if (op !== 'update' || !session.church_name) return json({ error: { message: 'Only the group account can change church records.' } }, 403);
    for (const r of (Array.isArray(body.values) ? body.values : [body.values]) as Array<Record<string, unknown>>) {
      delete r.name; delete r.status; delete r.id;
    }
  }

  // Visitors may only add a church admin record for the pastor account they just created.
  if (!session && table === 'church_admin_accounts') {
    for (const r of (Array.isArray(body.values) ? body.values : [body.values]) as Array<Record<string, unknown>>) {
      const email = String(r.admin_email || '').trim();
      const { data: pastor } = await admin.from('user_profiles').select('role, church_name, created_at, admin_verified')
        .ilike('email', email).maybeSingle();
      if (!pastor || pastor.role !== 'Church Pastor' || pastor.admin_verified ||
          Date.now() - new Date(pastor.created_at as string).getTime() > 30 * 60000) {
        return json({ error: { message: 'Church admins are appointed by their church pastor.' } }, 403);
      }
      r.church_name = pastor.church_name; r.role = 'Church Pastor'; r.admin_verified = false;
    }
  }

  let query: any = admin.from(table);

  if (op === 'select') {
    query = query.select(session ? body.columns || '*' : PUBLIC_READ[table]);
  } else if (op === 'insert') {
    query = query.insert(body.values as any);
    if (body.returning) query = query.select(body.returning);
  } else if (op === 'upsert') {
    const conflict = typeof body.upsert?.onConflict === 'string' && /^[a-z_,]+$/.test(body.upsert.onConflict) ? body.upsert.onConflict : undefined;
    // Visitors can add new rows but never overwrite existing ones.
    query = query.upsert(body.values as any, { onConflict: conflict, ignoreDuplicates: !session });
    if (body.returning) query = query.select(body.returning);
  } else if (op === 'update') {
    query = query.update(body.values as any);
  } else if (op === 'delete') {
    query = query.delete();
  } else {
    return json({ error: { message: 'Unsupported operation.' } }, 400);
  }

  for (const filter of body.filters || []) {
    if (!FILTER_OPS.has(filter.op) || !/^[a-z_]+$/.test(String(filter.column))) {
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

  if (session && session.role !== 'Superadmin' && table === 'churches' && op === 'update') {
    query = query.ilike('name', session.church_name);
  }

  if (body.or) {
    if (!session) return json({ error: { message: 'Please sign in to run this search.' } }, 401);
    // Only simple "column.op.value" terms; no nested and()/or() groups.
    const terms = String(body.or).split(',');
    const ok = terms.length <= 10 && terms.every((t) => /^[a-z_]+\.(eq|neq|ilike|like|gt|gte|lt|lte|is)\.[^(),]{0,200}$/.test(t));
    if (!ok) return json({ error: { message: 'Unsupported search.' } }, 400);
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
    return json({ error: { message: 'We could not complete that request. Please try again.', code: error.code === '23505' ? '23505' : undefined } }, 200);
  }
  const sanitized = table === 'admin_settings' ? stripSmsCredentials(data) : data;
  return json({ data: stripSensitive(sanitized) });
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
    const [{ data: profile }, { data: account }] = await Promise.all([
      admin.from('user_profiles')
        .select('id, avatar_url, phone, zone, church_name, full_name, role')
        .ilike('email', String(u.email || '').trim())
        .maybeSingle(),
      admin.from('church_admin_accounts')
        .select('id, admin_name, admin_phone, admin_email, church_name, zone, photo_url, role')
        .ilike('admin_email', String(u.email || '').trim())
        .maybeSingle(),
    ]);
    if (profile) {
      u.id = profile.id || u.id;
      u.name = profile.full_name || u.name;
      u.role = profile.role || u.role;
      u.phone = profile.phone || u.phone || '';
      u.church = profile.church_name || u.church || '';
      u.zone = profile.zone || u.zone || '';
      u.avatar = profile.avatar_url || '';
    } else if (account) {
      u.id = account.id || u.id;
      u.name = account.admin_name || u.name;
      u.role = account.role || u.role;
      u.phone = account.admin_phone || u.phone || '';
      u.church = account.church_name || u.church || '';
      u.zone = account.zone || u.zone || '';
      u.avatar = account.photo_url || '';
    } else {
      u.avatar = '';
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

async function handleUpdateGroupProfile(body: any, session: Session | null, req: Request) {
  if (session?.role !== 'Superadmin' || !session.user_email) {
    return json({ success: false, error: 'Only the signed-in Group Pastor can update this profile.' }, 403);
  }
  const profile = body?.profile || {};
  const email = String(profile.email || '').trim().toLowerCase();
  const name = String(profile.name || '').trim();
  if (!email || !name) {
    return json({ success: false, error: 'Name and email are required.' }, 400);
  }

  const { data: existing, error: lookupError } = await admin.from('user_profiles')
    .select('id, role')
    .ilike('email', session.user_email)
    .maybeSingle();
  if (lookupError || !existing || existing.role !== 'Superadmin') {
    console.error('Group Pastor profile lookup failed:', lookupError?.message || 'profile not found');
    return json({ success: false, error: 'Could not find the signed-in Group Pastor account.' }, 404);
  }

  const { error } = await admin.from('user_profiles').update({
    full_name: name,
    email,
    phone: String(profile.phone || '').trim() || null,
    church_name: String(profile.churchName || '').trim() || null,
    zone: String(profile.zone || '').trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', existing.id);
  if (error) {
    console.error('Group Pastor profile update failed:', error.message);
    return json({ success: false, error: 'The profile could not be saved. Check that the email is not already in use.' }, 400);
  }

  const token = req.headers.get('x-portal-session');
  if (token) {
    await admin.from('portal_sessions').update({
      user_email: email,
      user_name: name,
      church_name: String(profile.churchName || '').trim() || null,
    }).eq('token_hash', await sha256(token));
  }
  await admin.from('audit_logs').insert({
    actor: name,
    church_name: String(profile.churchName || '').trim() || null,
    action: 'Updated the Group Pastor account profile',
    category: 'System',
    icon: 'admin_panel_settings',
  });
  return json({ success: true });
}

async function handleUpdateProfilePhoto(body: any, session: Session | null) {
  if (!session?.user_email || !['Superadmin', 'Church Admin', 'Church Pastor'].includes(session.role)) {
    return json({ success: false, error: 'Only signed-in administrator accounts can update a profile photo.' }, 403);
  }
  const path = String(body?.path || '');
  const safeEmailFolder = `profile-${(await sha256(session.user_email)).slice(0, 32)}`;
  const prefix = `${safeEmailFolder}/`;
  const filename = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  if (!/^\d{10,16}\.(jpg|jpeg|png|webp|gif|heic)$/i.test(filename)) {
    return json({ success: false, error: 'Invalid profile photo path.' }, 400);
  }

  const [profileResult, accountResult] = await Promise.all([
    admin.from('user_profiles').update({ avatar_url: path, updated_at: new Date().toISOString() })
      .ilike('email', session.user_email).select('id'),
    admin.from('church_admin_accounts').update({ photo_url: path })
      .ilike('admin_email', session.user_email).select('id'),
  ]);
  if ((profileResult.error || accountResult.error) ||
      !(profileResult.data?.length || accountResult.data?.length)) {
    console.error('Profile photo update failed:', profileResult.error?.message || accountResult.error?.message || 'account not found');
    return json({ success: false, error: 'The profile photo could not be saved.' }, 500);
  }
  return json({ success: true });
}

// -------------------------------------------------------------- photo storage

async function handleUpload(body: any, session: Session | null) {
  if (!session && !body?.allowSelfService) {
    return json({ error: { message: 'Please sign in to upload a photo.' } }, 401);
  }
  const path = String(body?.path || '');
  if (!/^[A-Za-z0-9._-]{1,80}\/\d{10,16}\.(jpg|jpeg|png|webp|gif|heic)$/i.test(path)) {
    return json({ error: { message: 'Invalid photo upload.' } }, 400);
  }
  const base64 = String(body?.content || '').replace(/^data:[^;]+;base64,/, '');
  const rawType = String(body?.contentType || 'image/jpeg');
  const contentType = /^image\/(jpeg|png|webp|gif|heic)$/.test(rawType) ? rawType : 'image/jpeg';
  if (!path || !base64 || path.includes('..')) {
    return json({ error: { message: 'Invalid photo upload.' } }, 400);
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 5 * 1024 * 1024) {
    return json({ error: { message: 'Photos must be smaller than 5 MB.' } }, 400);
  }
  const { error } = await admin.storage
    .from('member-photos')
    .upload(path, bytes, { contentType, upsert: false });
  if (error) return json({ error: { message: 'Photo upload failed.' } }, 200);
  return json({ data: { path } });
}

async function handleSignedUrl(body: any, session: Session | null) {
  if (!session) return json({ error: { message: 'Please sign in to view photos.' } }, 401);
  const path = String(body?.path || '');
  if (!path || path.includes('..')) return json({ error: { message: 'Invalid photo.' } }, 400);
  if (session.role !== 'Superadmin') {
    if (session.role === 'Developer') return json({ error: { message: 'Not allowed.' } }, 403);
    const church = session.church_name || '';
    const checks = await Promise.all([
      admin.from('members').select('id').eq('photo_url', path).ilike('church_name', church).limit(1),
      admin.from('leaders').select('id').eq('photo_url', path).ilike('church_name', church).limit(1),
      admin.from('church_admin_accounts').select('id').eq('photo_url', path).ilike('church_name', church).limit(1),
      admin.from('user_profiles').select('id').eq('avatar_url', path).ilike('church_name', church).limit(1),
      admin.from('user_profiles').select('id').eq('avatar_url', path).ilike('email', session.user_email || '').limit(1),
    ]);
    if (!checks.some((c: any) => c.data && c.data.length)) return json({ error: { message: 'Photo not found.' } }, 404);
  }
  const { data, error } = await admin.storage.from('member-photos').createSignedUrl(path, 3600);
  if (error) return json({ error: { message: 'Photo not available.' } }, 200);
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

function normalizeGhanaPhone(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('233') && digits.length === 12 ? `0${digits.slice(3)}` : digits;
  return /^0\d{9}$/.test(local) ? local : null;
}

interface AdminSmsDispatchResult {
  error: string | null;
  sms: {
    accepted: number;
    failed: number;
    skippedNoPhone: number;
    creditsUsed: number;
    creditsLeft: number | null;
    campaignIds: string[];
    warning?: string | null;
    error?: string | null;
  } | null;
}

async function dispatchAdminUpdateSms(message: string, session: Session): Promise<AdminSmsDispatchResult> {
  const role = session.role;
  const isGlobalSender = role === 'Developer' || role === 'Superadmin';
  const isBranchSender = role === 'Church Admin' || role === 'Church Pastor';
  if (!isGlobalSender && !isBranchSender) return { error: 'Only admin accounts can send administrator SMS updates.', sms: null };
  if (isBranchSender && !session.church_name) return { error: 'Your account is not linked to a church.', sms: null };

  const church = isBranchSender ? session.church_name : null;
  let profilesQuery = admin.from('user_profiles')
    .select('email, full_name, phone, church_name')
    .eq('role', 'Church Admin')
    .eq('admin_verified', true)
    .limit(1001);
  let accountsQuery = admin.from('church_admin_accounts')
    .select('admin_email, admin_name, admin_phone, church_name')
    .eq('role', 'Church Admin')
    .eq('email_verified', true)
    .eq('status', 'Active')
    .limit(1001);
  if (church) {
    profilesQuery = profilesQuery.ilike('church_name', church);
    accountsQuery = accountsQuery.ilike('church_name', church);
  }

  const [{ data: profiles, error: profilesError }, { data: accounts, error: accountsError }] = await Promise.all([
    profilesQuery,
    accountsQuery,
  ]);
  if (profilesError || accountsError) {
    console.error('Admin SMS recipient lookup failed:', profilesError?.message || accountsError?.message);
    return { error: 'Could not load verified administrator recipients.', sms: null };
  }

  const targets = new Map<string, { phone: string; church: string }>();
  for (const row of [...(accounts || []), ...(profiles || [])] as Array<Record<string, unknown>>) {
    const email = String(row.admin_email || row.email || '').trim().toLowerCase();
    const phone = String(row.admin_phone || row.phone || '').trim();
    const targetKey = email || `phone:${phone}`;
    if (!targetKey) continue;
    const existing = targets.get(targetKey);
    if (!existing || (!existing.phone && phone)) {
      targets.set(targetKey, {
        phone,
        church: String(row.church_name || ''),
      });
    }
  }

  if (targets.size > 500) return { error: 'There are more than 500 verified admin accounts; please contact support.', sms: null };
  const normalized = Array.from(targets.values()).map((target) => ({
    phone: normalizeGhanaPhone(target.phone),
    church: target.church,
  }));
  const recipients = Array.from(new Set(
    normalized.map((target) => target.phone).filter((phone): phone is string => !!phone),
  ));
  const skippedNoPhone = normalized.length - recipients.length;
  if (!recipients.length) {
    return {
      error: 'No verified Church Admin accounts with valid Ghana phone numbers were found for this scope.',
      sms: { accepted: 0, failed: 0, skippedNoPhone, creditsUsed: 0, creditsLeft: null, campaignIds: [] },
    };
  }

  const cleanMessage = message.trim();
  if (!cleanMessage || cleanMessage.length > 1000) return { error: 'Enter a message between 1 and 1,000 characters.', sms: null };
  const { data: configRow, error: configError } = await admin
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'sms_config')
    .maybeSingle();
  if (configError) {
    console.error('Could not load SMS settings:', configError.message);
    return { error: 'Could not load the SMS configuration.', sms: null };
  }
  const config = configRow?.setting_value as Record<string, unknown> | null;
  const senderId = typeof config?.senderId === 'string' ? config.senderId.trim() : '';
  if (config?.enabled !== true) return { error: 'SMS sending is disabled by the developer.', sms: null };
  if (!/^[A-Za-z0-9]{1,11}$/.test(senderId)) {
    return { error: 'Configure an approved mNotify sender ID (1–11 letters or numbers) before sending.', sms: null };
  }

  const delivery = await sendMnotifySms(recipients, senderId, cleanMessage);
  const result = {
    accepted: delivery.accepted,
    failed: delivery.failed,
    skippedNoPhone,
    creditsUsed: delivery.creditsUsed,
    creditsLeft: delivery.creditsLeft,
    campaignIds: delivery.campaignIds,
    error: delivery.error,
  };
  const { error: logError } = await admin.from('email_send_log').insert({
    template_name: 'admin_update_sms',
    recipient_email: 'verified Church Admins',
    recipient_phone: null,
    channel: 'sms',
    subject: null,
    body_preview: cleanMessage.slice(0, 200),
    status: delivery.accepted > 0 ? 'sent' : 'failed',
    error_message: delivery.error,
    metadata: {
      channel: 'sms',
      provider: 'mNotify',
      church: church || 'All Churches',
      accepted: delivery.accepted,
      failed: delivery.failed,
      skippedNoPhone,
      creditsUsed: delivery.creditsUsed,
      creditsLeft: delivery.creditsLeft,
      campaignIds: delivery.campaignIds,
    },
  });
  if (logError) console.error('Could not write admin SMS delivery log:', logError.message);

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor: session.user_name || (role === 'Developer' ? 'Developer' : 'Administrator'),
    church_name: church,
    action: `Admin SMS update: ${delivery.accepted} accepted, ${delivery.failed} failed`,
    category: 'System',
    icon: 'sms',
  });
  if (auditError) console.error('Could not write admin SMS audit log:', auditError.message);

  if (delivery.accepted === 0) return { error: delivery.error || 'mNotify did not accept the SMS.', sms: result };
  return {
    error: null,
    sms: {
      ...result,
      warning: logError || auditError ? 'SMS was accepted, but the platform could not record every audit entry.' : null,
    },
  };
}

async function handleAdminSms(body: any, session: Session | null) {
  if (!session) return json({ error: { message: 'Please sign in to send an SMS.' } }, 401);
  const message = typeof body?.message === 'string' ? body.message : '';
  const result = await dispatchAdminUpdateSms(message, session);
  if (result.error) return json({ success: false, error: { message: result.error }, sms: result.sms }, 400);
  return json({ success: true, sms: result.sms });
}

const SMS_MANAGER_ROLES = new Set(['Superadmin', 'Church Admin', 'Church Pastor']);
const RESERVED_SENDER_TERMS = ['bank', 'mtn', 'vodafone', 'telecel', 'airteltigo', 'gov', 'government', 'police', 'ecg'];

async function getMnotifyManagementConfig() {
  const { data, error } = await admin.from('admin_settings').select('setting_value')
    .eq('setting_key', 'mnotify_management').maybeSingle();
  if (error) throw new Error('Could not load mNotify management settings.');
  const saved = data?.setting_value && typeof data.setting_value === 'object' ? data.setting_value : {};
  return {
    adminPhone: typeof saved.adminPhone === 'string' ? saved.adminPhone : '',
    alertSenderId: typeof saved.alertSenderId === 'string' ? saved.alertSenderId : '',
    unitRate: Number.isFinite(Number(saved.unitRate)) && saved.unitRate !== null ? Number(saved.unitRate) : null,
    lowBalanceThreshold: Number.isFinite(Number(saved.lowBalanceThreshold)) ? Number(saved.lowBalanceThreshold) : 0,
    lowBalanceAlerted: saved.lowBalanceAlerted === true,
    lastBalance: saved.lastBalance !== null && saved.lastBalance !== undefined && Number.isFinite(Number(saved.lastBalance))
      ? Number(saved.lastBalance)
      : null,
    balanceCheckedAt: typeof saved.balanceCheckedAt === 'string' ? saved.balanceCheckedAt : null,
  };
}

async function saveMnotifyBalance(balance: number) {
  const config = await getMnotifyManagementConfig();
  const { error } = await admin.from('admin_settings').upsert({
    setting_key: 'mnotify_management',
    setting_value: { ...config, lastBalance: balance, balanceCheckedAt: new Date().toISOString() },
    setting_type: 'json',
    is_global: true,
  }, { onConflict: 'setting_key' });
  if (error) throw new Error('Could not save the latest mNotify balance.');
}

function senderNeedsReview(senderName: string) {
  const normalized = senderName.toLowerCase().replace(/\s+/g, '');
  return RESERVED_SENDER_TERMS.some((term) => normalized.includes(term));
}

async function addSenderStatusHistory(id: string, actor: string, from: string | null, to: string, reason?: string | null) {
  const { error } = await admin.from('sender_id_status_history').insert({
    sender_id_request_id: id,
    changed_by: actor,
    from_status: from,
    to_status: to,
    reason: reason || null,
  });
  if (error) console.error('Could not record sender-ID status history:', error.message);
}

// The registered phone of the admin/pastor who owns a Sender ID request.
async function getOwnerPhone(email: string): Promise<string | null> {
  if (!email) return null;
  const [{ data: profile }, { data: account }] = await Promise.all([
    admin.from('user_profiles').select('phone').ilike('email', email).limit(1).maybeSingle(),
    admin.from('church_admin_accounts').select('admin_phone').ilike('admin_email', email).limit(1).maybeSingle(),
  ]);
  return normalizeGhanaPhone(String(profile?.phone || '')) || normalizeGhanaPhone(String(account?.admin_phone || '')) || null;
}

async function sendSenderRequestAlert(sender: any, existingAlertId?: string) {
  const cfg = await getMnotifyManagementConfig();
  const normalizedPhone = await getOwnerPhone(String(sender.user_email || ''));
  const alert = {
    sender_id_request_id: sender.id,
    channel: 'sms',
    recipient: normalizedPhone ? `***${normalizedPhone.slice(-4)}` : 'invalid-configured-phone',
    status: 'pending',
    attempts: 0,
  };
  let alertId = existingAlertId;
  if (!alertId) {
    const { data: alertRow, error: insertError } = await admin.from('admin_alerts').insert(alert).select('id').single();
    alertId = alertRow?.id;
    if (insertError || !alertId) {
      console.error('Could not create sender-ID admin alert record:', insertError?.message);
      return { status: 'failed', error: 'Could not record admin alert.' };
    }
  }
  if (!normalizedPhone || !/^[A-Za-z0-9 ]{1,11}$/.test(cfg.alertSenderId)) {
    await admin.from('admin_alerts').update({
      status: 'failed',
      attempts: 0,
      error_message: normalizedPhone ? 'Configure an approved alert sender ID.' : 'The admin has no valid registered phone number.',
    }).eq('id', alertId);
    return { status: 'failed', error: 'Admin alert settings are incomplete.' };
  }

  const prefix = `Your Sender ID request ${sender.sender_name} was received | Purpose: `;
  const suffix = ` | We'll text you once it is approved.`;
  const message = `${prefix}${String(sender.purpose || '').slice(0, Math.max(0, 158 - prefix.length - suffix.length))}${suffix}`.slice(0, 160);
  let lastError = 'mNotify did not accept the alert.';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await sendMnotifySms([normalizedPhone], cfg.alertSenderId, message);
    if (result.accepted > 0) {
      await admin.from('admin_alerts').update({
        status: 'sent',
        attempts: attempt,
        provider_campaign_id: result.campaignIds[0] || null,
        error_message: null,
        sent_at: new Date().toISOString(),
      }).eq('id', alertId);
      return { status: 'sent', error: null };
    }
    lastError = result.error || lastError;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  await admin.from('admin_alerts').update({
    status: 'failed',
    attempts: 3,
    error_message: lastError.slice(0, 300),
  }).eq('id', alertId);
  return { status: 'failed', error: lastError };
}

function senderStatusFromMnotify(payload: Record<string, any> | null): 'submitted' | 'verified' | 'rejected' | null {
  const raw = String(payload?.summary?.status || payload?.summary?.['sender status'] || '').toLowerCase();
  if (raw.includes('approv') || raw.includes('verif')) return 'verified';
  if (raw.includes('reject') || raw.includes('declin')) return 'rejected';
  if (raw.includes('pending') || raw.includes('submit')) return 'submitted';
  return null;
}

async function notifySenderOwner(sender: any, status: 'verified' | 'rejected', reason?: string | null) {
  const { data: profile } = await admin.from('user_profiles')
    .select('email, full_name, phone, admin_verified')
    .ilike('email', sender.user_email)
    .maybeSingle();
  const email = String(profile?.email || sender.user_email || '').trim();
  const name = String(profile?.full_name || sender.user_name || 'there');
  const instructions = 'Use this approved Sender ID on the Send SMS page. Sender IDs must be at most 11 characters. A single SMS page supports up to 160 GSM-7 characters (70 Unicode characters); longer messages use multiple pages. Do not send spam or content that violates mNotify terms.';
  const subject = status === 'verified' ? `Sender ID ${sender.sender_name} approved` : `Sender ID ${sender.sender_name} needs changes`;
  const body = status === 'verified'
    ? `<p>Hello ${name.replace(/[&<>"]/g, '')},</p><p>Your Sender ID <strong>${sender.sender_name}</strong> is approved and ready to use.</p><p>${instructions}</p>`
    : `<p>Hello ${name.replace(/[&<>"]/g, '')},</p><p>Your Sender ID <strong>${sender.sender_name}</strong> was not approved. ${String(reason || 'Please contact your administrator for details.').replace(/[&<>"]/g, '')}</p><p>You can submit a corrected request from SMS Settings.</p>`;
  let emailSent = false;
  if (email.includes('@')) {
    const result = await sendMail({ to: email, subject, html: body });
    emailSent = result.ok;
    await admin.from('email_send_log').insert({
      template_name: 'mnotify_sender_id_status',
      recipient_email: email,
      status: result.ok ? 'sent' : 'failed',
      error_message: result.ok ? null : 'Sender ID status notification email could not be delivered.',
      metadata: { church: sender.church_name, sender_id: sender.sender_name, status },
    });
  }
  let smsSent = false;
  const phone = normalizeGhanaPhone(String(profile?.phone || '')) || await getOwnerPhone(String(sender.user_email || ''));
  const cfg = await getMnotifyManagementConfig();
  // An approved ID can announce itself; otherwise use the platform alert ID.
  const smsSender = status === 'verified' ? sender.sender_name : cfg.alertSenderId;
  if (phone && /^[A-Za-z0-9 ]{1,11}$/.test(String(smsSender || ''))) {
    const notification = status === 'verified'
      ? `Your Sender ID ${sender.sender_name} is approved on mNotify and ready to use. Open Settings > Sender IDs & SMS to send messages.`
      : `${sender.sender_name} was rejected: ${reason || 'Please check your email and resubmit.'}`;
    let result = await sendMnotifySms([phone], smsSender, notification.slice(0, 480));
    if (!result.accepted && smsSender !== cfg.alertSenderId && cfg.alertSenderId) {
      result = await sendMnotifySms([phone], cfg.alertSenderId, notification.slice(0, 480));
    }
    smsSent = result.accepted > 0;
    await admin.from('admin_alerts').insert({
      sender_id_request_id: sender.id, channel: 'sms', recipient: `***${phone.slice(-4)}`,
      status: smsSent ? 'sent' : 'failed', attempts: 1,
      provider_campaign_id: result.campaignIds[0] || null,
      error_message: smsSent ? null : (result.error || 'Status SMS not accepted.').slice(0, 300),
      sent_at: smsSent ? new Date().toISOString() : null,
    });
  }
  return { emailSent, smsSent };
}

async function setSenderStatus(sender: any, status: 'verified' | 'rejected', actor: string, reason?: string | null) {
  if (sender.status === status && sender.notification_sent_at) return { success: true, notification: { emailSent: false, smsSent: false } };
  const { error } = await admin.from('sender_id_requests').update({
    status,
    reviewed_by: actor,
    reviewed_at: new Date().toISOString(),
    rejection_reason: status === 'rejected' ? (reason || 'No reason provided.').slice(0, 500) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', sender.id);
  if (error) return { success: false, error: 'Could not update sender-ID approval.' };
  await addSenderStatusHistory(sender.id, actor, sender.status, status, reason);
  const notification = await notifySenderOwner(sender, status, reason);
  await admin.from('sender_id_requests').update({
    notification_sent_at: notification.emailSent || notification.smsSent ? new Date().toISOString() : null,
  }).eq('id', sender.id);
  return { success: true, notification };
}

async function refreshSenderStatus(sender: any) {
  const result = await getMnotifySenderIdStatus(sender.sender_name);
  if (!result.ok) {
    await logMnotifyFailure('Sender ID status');
    return { success: false, error: result.error || 'Could not refresh sender-ID status.' };
  }
  const status = senderStatusFromMnotify(result.payload);
  if (!status) return { success: true, status: sender.status, pending: true };
  if (status === sender.status) {
    await admin.from('sender_id_requests').update({ updated_at: new Date().toISOString() }).eq('id', sender.id);
    return { success: true, status };
  }
  if (status === 'verified' || status === 'rejected') {
    const updated = await setSenderStatus(sender, status, 'mNotify API', result.payload?.summary?.reason || null);
    return { ...updated, status };
  }
  await admin.from('sender_id_requests').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', sender.id);
  await addSenderStatusHistory(sender.id, 'mNotify API', sender.status, 'submitted');
  return { success: true, status: 'submitted' };
}

async function pollMnotifyPending() {
  const senderCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const reportCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const expiryCutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const [{ data: senders }, { data: campaigns }] = await Promise.all([
    admin.from('sender_id_requests').select('*').eq('submission_status', 'submitted')
      .in('status', ['pending', 'submitted']).is('deleted_at', null).lt('updated_at', senderCutoff).limit(100),
    admin.from('sms_campaigns').select('*').in('status', ['sent', 'partial'])
      .not('provider_campaign_id', 'is', null).gte('created_at', expiryCutoff)
      .or(`last_polled_at.is.null,last_polled_at.lt.${reportCutoff}`).limit(100),
  ]);
  let senderCount = 0;
  let campaignCount = 0;
  for (const sender of senders || []) {
    const result = await refreshSenderStatus(sender);
    if (result.success) senderCount++;
  }
  for (const campaign of campaigns || []) {
    const result = await refreshCampaignReport(campaign);
    if (result.success) campaignCount++;
  }
  const balance = await getMnotifySmsBalance();
  if (balance.ok) {
    const credits = Number(balance.payload?.balance || 0) + Number(balance.payload?.bonus || 0);
    if (Number.isFinite(credits)) {
      await saveMnotifyBalance(credits);
      await checkMnotifyLowBalance(credits);
    }
  } else await logMnotifyFailure('SMS balance');
  return { senderIds: senderCount, campaigns: campaignCount };
}

async function checkMnotifyLowBalance(balance: number) {
  const config = await getMnotifyManagementConfig();
  if (balance > config.lowBalanceThreshold) {
    if (config.lowBalanceAlerted) {
      await admin.from('admin_settings').upsert({
        setting_key: 'mnotify_management',
        setting_value: { ...config, lowBalanceAlerted: false },
        setting_type: 'json',
        is_global: true,
      }, { onConflict: 'setting_key' });
    }
    return;
  }
  if (config.lowBalanceAlerted) return;
  const phone = normalizeGhanaPhone(config.adminPhone);
  const sms = phone
    ? await sendMnotifySms([phone], config.alertSenderId, `Low mNotify SMS balance alert: ${balance} credits remain. Threshold: ${config.lowBalanceThreshold}.`)
    : null;
  await admin.from('admin_alerts').insert({
    channel: 'sms',
    recipient: phone ? `***${phone.slice(-4)}` : 'invalid-configured-phone',
    status: sms?.accepted ? 'sent' : 'failed',
    attempts: 1,
    provider_campaign_id: sms?.campaignIds[0] || null,
    error_message: sms?.error || (phone ? null : 'Configure a valid admin alert phone number.'),
    sent_at: sms?.accepted ? new Date().toISOString() : null,
  });
  await admin.from('admin_settings').upsert({
    setting_key: 'mnotify_management',
    setting_value: { ...config, lowBalanceAlerted: true },
    setting_type: 'json',
    is_global: true,
  }, { onConflict: 'setting_key' });
}

async function refreshCampaignReport(campaign: any) {
  if (!campaign.provider_campaign_id) return { success: false, error: 'mNotify has not returned a campaign ID.' };
  const result = await getMnotifyCampaignReport(campaign.provider_campaign_id);
  if (!result.ok) {
    await logMnotifyFailure('campaign delivery report');
    return { success: false, error: result.error || 'Could not refresh delivery report.' };
  }
  const report = Array.isArray(result.payload?.report) ? result.payload.report : [];
  let delivered = 0;
  let failed = 0;
  for (const entry of report) {
    const phone = normalizeGhanaPhone(entry?.recipient);
    if (!phone) continue;
    const raw = String(entry?.status || '').toLowerCase();
    const status = raw.includes('deliver') ? 'delivered' : raw.includes('fail') || raw.includes('reject') || raw.includes('undeliver') ? 'failed' : 'pending';
    if (status === 'delivered') delivered++;
    else if (status === 'failed') failed++;
    await admin.from('sms_recipients').update({
      status,
      failure_reason: status === 'failed' ? String(entry?.reason || entry?.error || 'Delivery failed.').slice(0, 300) : null,
      provider_message_id: entry?._id == null ? null : String(entry._id).slice(0, 100),
      updated_at: new Date().toISOString(),
    }).eq('campaign_id', campaign.id).eq('recipient_phone', phone);
  }
  const { count: recipientCount } = await admin.from('sms_recipients')
    .select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id);
  const status = report.length && delivered + failed >= (recipientCount || 0)
    ? (failed ? delivered ? 'partial' : 'failed' : 'sent')
    : campaign.status;
  await admin.from('sms_campaigns').update({
    status,
    last_polled_at: new Date().toISOString(),
  }).eq('id', campaign.id);
  const counts = await Promise.all(['delivered', 'failed', 'pending'].map(async (value) => {
    const { count } = await admin.from('sms_recipients').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id).eq('status', value);
    return count || 0;
  }));
  return { success: true, counts: { delivered: counts[0], failed: counts[1], pending: counts[2] } };
}

type SmsContact = { id: string; name: string; phone: string; kind: 'member' | 'leader'; code: string | null };
async function loadChurchSmsDirectory(churchName: string) {
  const [m, l, u] = await Promise.all([
    admin.from('members').select('id, full_name, phone, role').ilike('church_name', churchName).limit(20000),
    admin.from('leaders').select('id, full_name, contact, leader_code').ilike('church_name', churchName).limit(5000),
    admin.from('user_profiles').select('phone').ilike('church_name', churchName).limit(2000),
  ]);
  const list: SmsContact[] = [];
  const leaderNames = new Set<string>();
  for (const r of (l.data || []) as any[]) {
    const phone = normalizeGhanaPhone(String(r.contact || ''));
    leaderNames.add(String(r.full_name || '').trim().toLowerCase());
    if (phone) list.push({ id: String(r.id), name: String(r.full_name || ''), phone, kind: 'leader', code: r.leader_code || null });
  }
  for (const r of (m.data || []) as any[]) {
    const phone = normalizeGhanaPhone(String(r.phone || ''));
    // Leaders are mirrored as members; keep them in the leader list only.
    if (!phone || (r.role === 'Leader' && leaderNames.has(String(r.full_name || '').trim().toLowerCase()))) continue;
    list.push({ id: String(r.id), name: String(r.full_name || ''), phone, kind: 'member', code: String(r.id) });
  }
  const staffPhones = ((u.data || []) as any[]).map((r) => normalizeGhanaPhone(String(r.phone || ''))).filter(Boolean) as string[];
  return Object.assign(list, { staffPhones });
}

async function handleMergeLeaders(body: any, session: Session | null) {
  if (!session || !['Superadmin', 'Church Admin', 'Church Pastor'].includes(session.role)) {
    return json({ error: { message: 'Only church admins, pastors and the group account can merge leaders.' } }, 403);
  }
  const primaryId = String(body?.primaryId || '');
  const duplicateId = String(body?.duplicateId || '');
  if (!primaryId || !duplicateId || primaryId === duplicateId) return json({ error: { message: 'Choose two different leaders.' } }, 400);
  const { data: rows } = await admin.from('leaders').select('id, church_name, full_name').in('id', [primaryId, duplicateId]);
  const primary = (rows || []).find((r: any) => r.id === primaryId);
  const duplicate = (rows || []).find((r: any) => r.id === duplicateId);
  if (!primary || !duplicate) return json({ error: { message: 'Leader not found.' } }, 404);
  if (session.role !== 'Superadmin') {
    const own = String(session.church_name || '').toLowerCase();
    if (String(primary.church_name || '').toLowerCase() !== own || String(duplicate.church_name || '').toLowerCase() !== own) {
      return json({ error: { message: 'You can only merge leaders in your own church.' } }, 403);
    }
  }
  const p = body?.primary || {};
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries({ email: p.email, contact: p.contact, location: p.location, cell_or_pcf_name: p.cellOrPcfName })) {
    if (typeof v === 'string' && v.trim()) patch[k] = v.trim().slice(0, 200);
  }
  await admin.from('leaders').update(patch).eq('id', primaryId);
  await admin.from('members').update({ invited_by_leader_id: primaryId, invited_by_name: primary.full_name }).eq('invited_by_leader_id', duplicateId);
  await admin.from('leaders').update({ parent_leader_id: primaryId }).eq('parent_leader_id', duplicateId);
  await admin.from('promotion_queue').delete().eq('leader_id', duplicateId);
  await admin.from('cell_reports').update({ leader_id: primaryId, leader_name: primary.full_name }).eq('leader_id', duplicateId);
  const { error } = await admin.from('leaders').delete().eq('id', duplicateId);
  if (error) return json({ error: { message: 'Could not remove the duplicate leader.' } }, 500);
  await admin.from('audit_logs').insert({ actor: session.user_name || session.role, action: `Merged leader '${duplicate.full_name}' into '${primary.full_name}'`, category: 'Leader', church_name: primary.church_name, icon: 'merge_type' });
  return json({ success: true });
}

async function handleMnotifyUserAction(body: any, session: Session | null, req: Request) {
  if (!session || !SMS_MANAGER_ROLES.has(session.role) || !session.user_email) {
    return json({ error: { message: 'Church Admin or Church Pastor sign-in is required.' } }, 403);
  }
  const email = session.user_email.toLowerCase();
  const op = String(body?.op || '');
  if (op === 'dashboard') {
    const [{ data: senderIds, error: senderError }, { data: campaigns, error: campaignError }, cfg] = await Promise.all([
      admin.from('sender_id_requests').select('id, sender_name, purpose, status, submission_status, submission_error, rejection_reason, review_required, created_at, submitted_to_mnotify_at')
        .ilike('user_email', email).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
      admin.from('sms_campaigns').select('id, sender_name, message, recipient_count, pages_per_message, total_pages, unit_rate, estimated_cost, actual_credits, status, created_at, provider_campaign_id')
        .ilike('user_email', email).order('created_at', { ascending: false }).limit(30),
      getMnotifyManagementConfig(),
    ]);
    if (senderError || campaignError) return json({ error: { message: 'Could not load SMS dashboard.' } }, 500);
    const campaignRows = await Promise.all((campaigns || []).map(async (campaign: any) => {
      const { data: recipients } = await admin.from('sms_recipients').select('recipient_phone, status, failure_reason')
        .eq('campaign_id', campaign.id).limit(100);
      return { ...campaign, recipients: recipients || [] };
    }));
    return json({ success: true, senderIds: senderIds || [], campaigns: campaignRows, unitRate: cfg.unitRate });
  }

  if (op === 'submitSenderId') {
    const senderName = String(body.senderName || '').trim().replace(/\s+/g, ' ');
    const purpose = String(body.purpose || '').trim();
    if (!/^[A-Za-z0-9 ]{1,11}$/.test(senderName)) return json({ error: { message: 'Sender ID must be 1-11 characters using letters, numbers, and spaces only.' } }, 400);
    if (purpose.length < 30 || purpose.length > 1000) return json({ error: { message: 'Explain your intended messages in 30-1,000 characters.' } }, 400);
    const limited = await rateLimit(req, 'sender-id-submit', 5, 86400, corsHeaders, email, true, true);
    if (limited) return limited;
    const existingId = String(body.id || '');
    let sender: any;
    let previousStatus: string | null = null;
    if (existingId) {
      const { data } = await admin.from('sender_id_requests').select('*').eq('id', existingId).ilike('user_email', email).is('deleted_at', null).maybeSingle();
      if (!data || !['failed', 'rejected'].includes(data.status)) return json({ error: { message: 'This request cannot be resubmitted.' } }, 404);
      previousStatus = data.status;
      const { data: updated, error } = await admin.from('sender_id_requests').update({
        sender_name: senderName, purpose, status: 'pending', submission_status: 'pending',
        submission_error: null, rejection_reason: null, review_required: senderNeedsReview(senderName),
        reviewed_by: null, reviewed_at: null, notification_sent_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', existingId).select('*').single();
      if (error) return json({ error: { message: 'Could not update this sender-ID request. A duplicate sender name may already be registered.' } }, 409);
      sender = updated;
    } else {
      const { data, error } = await admin.from('sender_id_requests').insert({
        user_email: email, user_name: session.user_name, church_id: session.church_id,
        church_name: session.church_name, sender_name: senderName, purpose,
        review_required: senderNeedsReview(senderName),
      }).select('*').single();
      if (error) return json({ error: { message: 'Could not save the request. This sender ID may already be in use.' } }, 409);
      sender = data;
    }
    await addSenderStatusHistory(sender.id, email, previousStatus, 'pending');
    const provider = await registerMnotifySenderId(senderName, purpose);
    if (!provider.ok) await logMnotifyFailure('Sender ID registration');
    const providerStatus = provider.ok ? senderStatusFromMnotify(provider.payload) || 'submitted' : 'failed';
    const updatedStatus = provider.ok ? providerStatus : 'failed';
    const { error: saveError } = await admin.from('sender_id_requests').update({
      status: updatedStatus,
      submission_status: provider.ok ? 'submitted' : 'failed',
      submission_response: provider.payload,
      submission_error: provider.error,
      submitted_to_mnotify_at: provider.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', sender.id);
    if (saveError) console.error('Could not save mNotify sender response:', saveError.message);
    if (updatedStatus !== 'pending') await addSenderStatusHistory(sender.id, 'mNotify API', 'pending', updatedStatus, provider.error);
    const alertPhone = await getOwnerPhone(email);
    const { data: alertRow, error: alertInsertError } = await admin.from('admin_alerts').insert({
      sender_id_request_id: sender.id,
      channel: 'sms',
      recipient: alertPhone ? `***${alertPhone.slice(-4)}` : 'invalid-configured-phone',
      status: 'pending',
      attempts: 0,
    }).select('id').single();
    let alertStatus = 'failed';
    let alertError: string | null = 'Could not queue admin alert.';
    if (alertInsertError || !alertRow) {
      console.error('Could not queue sender-ID admin alert:', alertInsertError?.message);
    } else {
      alertStatus = 'pending';
      alertError = null;
      EdgeRuntime.waitUntil(sendSenderRequestAlert(sender, alertRow.id).catch(async (err) => {
        console.error('Sender-ID admin alert task failed:', err instanceof Error ? err.message : 'unknown error');
        await admin.from('admin_alerts').update({
          status: 'failed',
          attempts: 0,
          error_message: 'Background SMS alert processing failed.',
        }).eq('id', alertRow.id);
      }));
    }
    if (updatedStatus === 'verified' || updatedStatus === 'rejected') {
      await setSenderStatus({ ...sender, status: 'submitted' }, updatedStatus, 'mNotify API', provider.payload?.summary?.reason || null);
    }
    return json({
      success: true,
      senderId: { ...sender, status: updatedStatus, submission_status: provider.ok ? 'submitted' : 'failed', submission_error: provider.error },
      providerAccepted: provider.ok,
      alertStatus,
      alertError,
    });
  }

  if (op === 'refreshSenderId') {
    const { data: sender } = await admin.from('sender_id_requests').select('*').eq('id', String(body.id || '')).ilike('user_email', email).is('deleted_at', null).maybeSingle();
    if (!sender) return json({ error: { message: 'Sender ID request not found.' } }, 404);
    const result = await refreshSenderStatus(sender);
    return json(result.success ? { success: true, status: result.status, pending: result.pending } : { success: false, error: { message: result.error } }, result.success ? 200 : 502);
  }

  if (op === 'contacts') {
    if (!session.church_name) return json({ success: true, contacts: [] });
    const directory = await loadChurchSmsDirectory(session.church_name);
    return json({ success: true, contacts: directory.map(({ id, name, phone, kind, code }) => ({ id, name, phone, kind, code })) });
  }

  if (op === 'sendCodes') {
    const limited = await rateLimit(req, 'user-sms-codes', 5, 600, corsHeaders, email, true, true);
    if (limited) return limited;
    const kind = String(body.kind || '');
    if (kind !== 'member' && kind !== 'leader') return json({ error: { message: 'Choose members or leaders.' } }, 400);
    if (!session.church_name) return json({ error: { message: 'Your account is not linked to a church.' } }, 400);
    const { data: sender } = await admin.from('sender_id_requests').select('id, sender_name')
      .eq('id', String(body.senderIdRequestId || '')).ilike('user_email', email).eq('status', 'verified').is('deleted_at', null).maybeSingle();
    if (!sender) return json({ error: { message: 'Choose one of your verified Sender IDs.' } }, 400);
    const ids = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null;
    const directory = await loadChurchSmsDirectory(session.church_name);
    const targets = directory.filter((c) => c.kind === kind && c.code && (!ids || ids.has(c.id))).slice(0, 1000);
    if (!targets.length) return json({ error: { message: `No ${kind}s with a phone number and code were found.` } }, 400);
    let accepted = 0; let failed = 0; let credits = 0;
    const providerErrors = new Set<string>();
    for (const t of targets) {
      const text = buildAttendanceCodeSms(t.name, t.code, kind);
      const r = await sendMnotifySms([t.phone], sender.sender_name, text);
      if (r.accepted) { accepted++; credits += r.creditsUsed; } else failed++;
      if (r.error) providerErrors.add(r.error.slice(0, 200));
    }
    const failureMessage = providerErrors.values().next().value as string | undefined;
    const errorMessage = failed
      ? `${failed} code message(s) were not accepted.${failureMessage ? ` mNotify: ${failureMessage}` : ''}`
      : null;
    await admin.from('email_send_log').insert({
      template_name: `${kind}_code_sms`, recipient_email: 'campaign', channel: 'sms',
      status: accepted ? 'sent' : 'failed', error_message: errorMessage,
      metadata: { church: session.church_name, accepted, failed, credits },
    });
    await admin.from('audit_logs').insert({
      actor: session.role, action: `Sent ${kind} codes by SMS (${accepted} accepted, ${failed} failed)`,
      category: 'Messaging', church_name: session.church_name, icon: 'sms',
    });
    return json({
      success: accepted > 0,
      accepted,
      failed,
      creditsUsed: credits,
      error: errorMessage ? { message: errorMessage } : accepted ? null : { message: 'mNotify did not accept the code messages.' },
    });
  }

  if (op === 'sendSms') {
    const limited = await rateLimit(req, 'user-sms-send', 10, 600, corsHeaders, email, true, true);
    if (limited) return limited;
    const idempotencyKey = String(body.idempotencyKey || '');
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return json({ error: { message: 'Invalid send request. Reload the form and try again.' } }, 400);
    if (!message || [...message].length > 1000) return json({ error: { message: 'Enter a message between 1 and 1,000 characters.' } }, 400);
    const audience = String(body.audience || 'custom');
    if (!['custom', 'leaders', 'members', 'all'].includes(audience)) return json({ error: { message: 'Choose who should receive this SMS.' } }, 400);
    if (!session.church_name) return json({ error: { message: 'Your account is not linked to a church.' } }, 400);
    const directory = await loadChurchSmsDirectory(session.church_name);
    let recipients: string[];
    if (audience === 'custom') {
      const inputRecipients = Array.isArray(body.recipients)
        ? body.recipients
        : String(body.recipients || '').split(/[\s,;]+/);
      const valid = new Set<string>();
      const invalid: string[] = [];
      for (const value of inputRecipients) {
        const raw = String(value || '').trim();
        if (!raw) continue;
        const phone = /^\+?[\d\s().-]+$/.test(raw) ? normalizeGhanaPhone(raw) : null;
        if (phone) valid.add(phone); else invalid.push(raw.slice(0, 40));
      }
      if (invalid.length) return json({ error: { message: `Correct invalid Ghana phone number(s): ${invalid.slice(0, 10).join(', ')}` } }, 400);
      const allowed = new Set([...directory.map((c) => c.phone), ...directory.staffPhones]);
      const notOnRecord = [...valid].filter((p) => !allowed.has(p));
      if (notOnRecord.length) return json({ error: { message: `These numbers are not on your church's records: ${notOnRecord.slice(0, 10).join(', ')}` } }, 400);
      recipients = [...valid];
    } else {
      recipients = [...new Set(directory.filter((c) => audience === 'all' || (audience === 'leaders' ? c.kind === 'leader' : c.kind === 'member')).map((c) => c.phone))];
    }
    if (!recipients.length) return json({ error: { message: 'No valid phone numbers were found for this audience.' } }, 400);
    if (recipients.length > 3000) return json({ error: { message: 'A campaign is limited to 3,000 unique recipients.' } }, 400);
    const senderIdRequestId = String(body.senderIdRequestId || '');
    const { data: sender } = await admin.from('sender_id_requests').select('id, sender_name, status')
      .eq('id', senderIdRequestId).ilike('user_email', email).eq('status', 'verified').is('deleted_at', null).maybeSingle();
    if (!sender) return json({ error: { message: 'Choose one of your verified Sender IDs.' } }, 400);
    const cfg = await getMnotifyManagementConfig();
    if (cfg.unitRate === null || cfg.unitRate <= 0) {
      return json({ error: { message: 'SMS sending is not configured yet. Ask the Developer to set the cost per SMS page.' } }, 503);
    }
    const unitRate = cfg.unitRate;
    const estimate = estimateSmsCost(message, recipients.length, unitRate);
    const balanceResult = await getMnotifySmsBalance();
    const balance = Number(balanceResult.payload?.balance) + Number(balanceResult.payload?.bonus || 0);
    if (!balanceResult.ok || !Number.isFinite(balance)) {
      await logMnotifyFailure('SMS balance');
      return json({ error: { message: 'Could not verify mNotify credit balance; the SMS was not sent.' } }, 503);
    }
    await saveMnotifyBalance(balance);
    await checkMnotifyLowBalance(balance);
    if (balance <= 0) return json({ error: { message: 'Your mNotify account has no SMS credits available.' } }, 402);
    if (balance < estimate.estimatedCost) {
      return json({ error: { message: 'mNotify balance is too low for this estimated send.' }, estimate }, 402);
    }

    const { data: prior } = await admin.from('sms_campaigns').select('id, status, provider_campaign_id')
      .ilike('user_email', email).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (prior) return json({ success: true, duplicate: true, campaignId: prior.id, status: prior.status });
    const { data: campaign, error: campaignError } = await admin.from('sms_campaigns').insert({
      user_email: email, user_name: session.user_name, church_name: session.church_name,
      sender_id_request_id: sender.id, sender_name: sender.sender_name, message,
      recipient_count: recipients.length, pages_per_message: estimate.pagesPerMessage,
      total_pages: estimate.totalPages, unit_rate: unitRate ?? 0, estimated_cost: estimate.estimatedCost,
      status: 'pending', idempotency_key: idempotencyKey,
    }).select('*').single();
    if (campaignError || !campaign) {
      const { data: duplicate } = await admin.from('sms_campaigns').select('id, status')
        .ilike('user_email', email).eq('idempotency_key', idempotencyKey).maybeSingle();
      if (duplicate) return json({ success: true, duplicate: true, campaignId: duplicate.id, status: duplicate.status });
      return json({ error: { message: 'Could not queue the SMS request.' } }, 500);
    }
    const { error: recipientError } = await admin.from('sms_recipients').insert(recipients.map((recipient_phone) => ({
      campaign_id: campaign.id, recipient_phone,
    })));
    if (recipientError) {
      await admin.from('sms_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
      return json({ error: { message: 'Could not save recipients; no SMS was sent.' } }, 500);
    }
    const sent = await sendMnotifyMessage(recipients, sender.sender_name, message);
    if (sent.error) await logMnotifyFailure('SMS send');
    const accepted = new Set(sent.acceptedRecipients.map(normalizeGhanaPhone).filter(Boolean));
    const failedRecipients = recipients.filter((recipient) => !accepted.has(recipient));
    if (failedRecipients.length) {
      await admin.from('sms_recipients').update({
        status: 'failed',
        failure_reason: sent.error || 'mNotify did not accept this recipient.',
        updated_at: new Date().toISOString(),
      }).eq('campaign_id', campaign.id).in('recipient_phone', failedRecipients);
    }
    const campaignId = sent.campaignIds.length === 1 ? sent.campaignIds[0] : null;
    const sendStatus = sent.accepted === 0 ? 'failed' : sent.failed > 0 ? 'partial' : 'sent';
    await admin.from('sms_campaigns').update({
      status: sendStatus,
      provider_campaign_id: campaignId,
      actual_credits: sent.creditsUsed,
    }).eq('id', campaign.id);
    const { error: logError } = await admin.from('email_send_log').insert({
      template_name: 'user_sms_campaign',
      recipient_email: 'campaign',
      channel: 'sms',
      status: sendStatus === 'failed' ? 'failed' : 'sent',
      error_message: sent.error,
      metadata: {
        channel: 'sms', provider: 'mNotify', campaign_id: campaignId,
        sender_id: sender.sender_name, recipient_count: recipients.length,
        accepted: sent.accepted, failed: sent.failed, estimated_cost: estimate.estimatedCost,
        actual_credits: sent.creditsUsed,
      },
    });
    if (logError) console.error('Could not write SMS campaign telemetry:', logError.message);
    await admin.from('audit_logs').insert({
      actor: session.role, action: `Sent SMS campaign (${sent.accepted} accepted, ${sent.failed} failed)`,
      category: 'Messaging', church_name: session.church_name, icon: 'sms',
    });
    return json({
      success: sendStatus !== 'failed',
      campaignId: campaign.id,
      providerCampaignId: campaignId,
      status: sendStatus,
      accepted: sent.accepted,
      failed: sent.failed,
      creditsUsed: sent.creditsUsed,
      estimate,
      error: sent.error,
    }, sendStatus === 'failed' ? 502 : 200);
  }

  if (op === 'refreshCampaign') {
    const { data: campaign } = await admin.from('sms_campaigns').select('*').eq('id', String(body.id || '')).ilike('user_email', email).maybeSingle();
    if (!campaign) return json({ error: { message: 'SMS campaign not found.' } }, 404);
    const result = await refreshCampaignReport(campaign);
    return json(result.success ? result : { success: false, error: { message: result.error } }, result.success ? 200 : 502);
  }
  return json({ error: { message: 'Unknown SMS management action.' } }, 400);
}

// Totals-only deep analytics for the developer console. Never returns personal fields.
const DEV_TABLES = ['churches', 'members', 'leaders', 'attendance_records', 'cell_reports', 'announcements', 'audit_logs', 'email_send_log', 'user_profiles', 'church_admin_accounts', 'portal_sessions', 'absence_records', 'qr_tokens', 'service_types', 'suppressed_emails', 'sender_id_requests', 'sender_id_status_history', 'admin_alerts', 'sms_campaigns', 'sms_recipients'];
async function handleDevAnalytics(session: Session | null) {
  if (session?.role !== 'Developer') return json({ error: { message: 'Developer sign-in required.' } }, 403);
  const now = Date.now();
  const since90 = new Date(now - 90 * 864e5).toISOString();
  const since24 = new Date(now - 864e5).toISOString();
  const since30 = new Date(now - 30 * 864e5).toISOString();
  const [{ data: att }, { data: churches }, { data: mem }, { data: lead }, { data: rep }, { data: mail }, { data: logs }, { data: profs }, rowCounts, { data: anns }, { data: svcs }] = await Promise.all([
    admin.from('attendance_records').select('attendance_date, church_name').gte('attendance_date', since90.slice(0, 10)).limit(100000),
    admin.from('churches').select('id, name, status, zone, members_count, created_at'),
    admin.from('members').select('church_name, created_at, status').limit(100000),
    admin.from('leaders').select('church_name').limit(100000),
    admin.from('cell_reports').select('church_name, created_at').limit(100000),
    admin.from('email_send_log').select('id, template_name, recipient_email, status, error_message, created_at, metadata').gte('created_at', since30).order('created_at', { ascending: false }).limit(5000),
    admin.from('audit_logs').select('id, actor, church_name, action, category, icon, created_at').order('created_at', { ascending: false }).limit(1000),
    admin.from('user_profiles').select('role, church_name, admin_verified'),
    Promise.all(DEV_TABLES.map(async (t) => [t, await countOf(t)] as const)),
    admin.from('announcements').select('title, target_audience, created_at').order('created_at', { ascending: false }).limit(20),
    admin.from('service_types').select('id, name, description, is_global, is_active, created_at').order('name'),
  ]);
  const accountSummary = summarizeDeveloperAccounts(profs || []);
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
  const memBy = tally(mem), leadBy = tally(lead), repBy = tally(rep), staffBy = accountSummary.staffByChurch;
  const churchRows = (churches || []).map((c: any) => {
    const k = key(c.name);
    const rows = (memBy[k] || 0) + (leadBy[k] || 0) + (repBy[k] || 0) + (att30[k] || 0);
    return {
      id: c.id,
      name: c.name,
      zone: c.zone || 'Zone 1 (Korle Bu)',
      status: c.status,
      members: memBy[k] ?? c.members_count ?? 0,
      leaders: leadBy[k] || 0,
      staff: staffBy[k] || 0,
      reports: repBy[k] || 0,
      checkins30: att30[k] || 0,
      lastActive: lastSeen[k] || null,
      createdAt: c.created_at,
      rows,
      estBytes: rows * 1200,
      active: !!lastSeen[k] && lastSeen[k] >= since30.slice(0, 10)
    };
  });
  const monthKey = (d: string) => String(d).slice(0, 7);
  const growth: Record<string, { churches: number; members: number }> = {};
  for (const c of churches || []) { const m = monthKey(c.created_at); growth[m] = growth[m] || { churches: 0, members: 0 }; growth[m].churches++; }
  for (const m of mem || []) { const k = monthKey(m.created_at); growth[k] = growth[k] || { churches: 0, members: 0 }; growth[k].members++; }
  const mails = mail || [];
  const failedStatuses = new Set(['failed', 'dlq', 'bounced', 'suppressed', 'complained']);
  const mailBy = (s: (m: any) => boolean) => mails.filter(s).length;
  const failures = mails.filter((m: any) => failedStatuses.has(m.status)).slice(0, 50).map((m: any) => ({ template: m.template_name, status: m.status, reason: 'Delivery failed; details are restricted.', at: m.created_at }));
  const reasons: Record<string, number> = {};
  for (const f of mails.filter((m: any) => failedStatuses.has(m.status))) { reasons[f.status] = (reasons[f.status] || 0) + 1; }
  const mailChurch: Record<string, number> = {};
  for (const m of mails) { const c = m.metadata?.church || m.metadata?.church_name; if (c) mailChurch[c] = (mailChurch[c] || 0) + 1; }
  const recentMessages = mails.slice(0, 100).map((m: any) => ({
    id: m.id,
    template: m.template_name,
    recipient: 'staff',
    status: m.status,
    error: m.error_message ? 'Delivery failed; details are restricted.' : null,
    at: m.created_at,
    church: m.metadata?.church || m.metadata?.church_name,
  }));
  // Integrity checks (counts only)
  const [orphanAtt, orphanMem, expiredSessions] = await Promise.all([
    countOf('attendance_records', (q) => q.is('church_id', null)),
    countOf('members', (q) => q.is('church_id', null)),
    countOf('portal_sessions', (q) => q.lt('expires_at', new Date().toISOString())),
  ]);
  const { data: fm } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'feature_matrix').maybeSingle();
  const { data: plat } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'platform_config').maybeSingle();
  const { data: smsConf } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'sms_config').maybeSingle();
  const { data: smsTpls } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'sms_templates').maybeSingle();
  return json({ data: {
    series, churches: churchRows,
    growth: Object.entries(growth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    tables: Object.fromEntries(rowCounts), roleCounts: accountSummary.roleCounts,
    pendingAccounts: accountSummary.pendingCount, recentMessages, serviceTypes: svcs || [],
    messaging: {
      total30: mails.length, sent30: mailBy((m) => m.status === 'sent'), failed30: mailBy((m) => failedStatuses.has(m.status)),
      pending: mailBy((m) => m.status === 'pending'), last24: mailBy((m) => m.created_at >= since24),
      sms30: mails.filter((m: any) => m.metadata?.channel === 'sms' || m.template_name?.includes('sms')).length, failures, reasons, byChurch: mailChurch,
      byTemplate: mails.reduce((a: any, m: any) => { a[m.template_name] = (a[m.template_name] || 0) + 1; return a; }, {}),
    },
    integrity: { orphanAtt, orphanMem, expiredSessions },
    logs: (logs || []).map((l: any) => ({ id: l.id, category: l.category || 'General', icon: l.icon, church: l.church_name, at: l.created_at,
      action: `${l.category || 'Record'} activity`,
      actor: ['Developer', 'System', 'Group Pastor'].includes(l.actor) ? l.actor : 'Church account' })),
    announcements: anns || [],
    featureMatrix: fm?.setting_value || null, platform: plat?.setting_value || null,
    smsConfig: smsConf ? safeSmsConfig(smsConf.setting_value) : null,
    smsTemplates: smsTpls?.setting_value || null,
  } });
}

async function handleChurchDeletion(body: any, session: Session | null) {
  if (!session || !['Developer', 'Superadmin'].includes(session.role)) {
    return json({ success: false, error: { message: 'Only the Developer or Group Pastor can delete a church.' } }, 403);
  }

  const id = String(body?.id || '').trim();
  const name = String(body?.name || '').trim();
  if (!id && !name) {
    return json({ success: false, error: { message: 'Choose a church to delete.' } }, 400);
  }

  let lookup = admin.from('churches').select('id, name');
  if (id) lookup = lookup.eq('id', id);
  else lookup = lookup.ilike('name', name);
  let { data: church, error } = await lookup.maybeSingle();
  if (error) {
    console.error('Church deletion lookup failed:', error.message);
    return json({ success: false, error: { message: 'Could not find the church to delete.' } }, 500);
  }
  if (!church && id && name) {
    const fallback = await admin.from('churches').select('id, name').ilike('name', name).maybeSingle();
    church = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.error('Church deletion fallback lookup failed:', error.message);
    return json({ success: false, error: { message: 'Could not find the church to delete.' } }, 500);
  }
  if (!church) {
    return json({ success: false, error: { message: 'Church not found.' } }, 404);
  }

  const { data: deleted, error: deleteError } = await admin
    .from('churches')
    .delete()
    .eq('id', church.id)
    .select('id')
    .maybeSingle();
  if (deleteError) {
    console.error(`Church deletion failed for ${church.name}:`, deleteError.message);
    return json({
      success: false,
      error: { message: `Could not delete ${church.name}. ${deleteError.message}` },
    }, 500);
  }
  if (!deleted) {
    return json({ success: false, error: { message: `Church ${church.name} was not deleted.` } }, 409);
  }

  await admin.from('audit_logs').insert({
    actor: session.user_email || session.role,
    action: `Deleted church branch "${church.name}" and its associated records`,
    category: 'Church',
    icon: 'domain_disabled',
  });
  return json({ success: true, deletedChurch: church.name });
}

async function handleDevAction(body: any, session: Session | null, req: Request) {
  if (session?.role !== 'Developer') return json({ error: { message: 'Developer sign-in required.' } }, 403);
  const op = String(body?.op || '');
  const log = (action: string, category = 'System') => admin.from('audit_logs').insert({ actor: 'Developer', action, category, icon: 'terminal' });

  if (op === 'getRegistration') {
    const limited = await rateLimit(req, 'developer-account-lookup', 30, 600, corsHeaders, session.user_email || session.role, true, true);
    if (limited) return limited;
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: { message: 'Enter a valid account email.' } }, 400);
    const { data, error } = await admin.from('user_profiles')
      .select('id, email, username, full_name, role, church_name, zone, phone, admin_verified')
      .ilike('email', email)
      .maybeSingle();
    if (error) return json({ error: { message: 'Could not look up the account.' } }, 500);
    if (!data) return json({ error: { message: 'No account found for that email.' } }, 404);
    await log('Looked up one account for administration', 'Security');
    return json({ success: true, account: {
      id: data.id,
      email: data.email,
      username: data.username,
      fullName: data.full_name || data.username || 'Unnamed',
      role: data.role,
      church: data.church_name || '',
      zone: data.zone || '',
      phone: data.phone || '',
      verified: data.admin_verified !== false,
    } });
  }

  const resolveLinkedAdmins = async (value: unknown): Promise<{ emails: string[]; error?: string }> => {
    if (value === undefined) return { emails: [] };
    if (!Array.isArray(value)) return { emails: [], error: 'Admin assignments must be an email list.' };
    const emails = Array.from(new Set(value.map((item) => String(item).trim().toLowerCase())));
    if (emails.length > 100 || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return { emails: [], error: 'Enter no more than 100 valid administrator email addresses.' };
    }
    if (!emails.length) return { emails };
    const { data, error } = await admin.from('user_profiles').select('email, role').in('email', emails);
    if (error) {
      console.error('Could not validate linked admin accounts:', error.message);
      return { emails: [], error: 'Could not validate administrator accounts.' };
    }
    const eligible = new Set((data || []).filter((row: any) => row.role === 'Church Admin').map((row: any) => String(row.email).toLowerCase()));
    const invalid = emails.filter((email) => !eligible.has(email));
    if (invalid.length) return { emails: [], error: `These accounts are not registered Church Admins: ${invalid.join(', ')}` };
    return { emails };
  };

  if (op === 'setChurchStatus') {
    const status = String(body.status);
    if (!['Active', 'Inactive', 'Suspended'].includes(status)) return json({ error: 'Bad status' }, 400);
    const id = body.id;
    const name = String(body.name || '').trim();
    let q = admin.from('churches').update({ status });
    if (id) q = q.eq('id', id);
    else q = q.ilike('name', name);
    await q;
    await log(`Set church "${name}" status to ${status}`, 'Church');
    return json({ success: true });
  }

  if (op === 'createChurch') {
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Church name is required.' }, 400);
    const pastorEmail = String(body.pastor_email || '').trim().toLowerCase();
    const pastorPassword = String(body.pastor_password || '').trim();
    if (body.createPastor && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pastorEmail) || pastorPassword.length < 8)) {
      return json({ error: 'A valid pastor email and password of at least 8 characters are required.' }, 400);
    }
    const linkedAdmins = await resolveLinkedAdmins(body.linkedAdminEmails);
    if (linkedAdmins.error) return json({ error: linkedAdmins.error }, 400);
    const pastor = String(body.pastor_name || 'Pastor in Charge').trim();
    const zone = String(body.zone || 'Zone 1 (Korle Bu)').trim();
    const status = String(body.status || 'Active');
    const { data: newC, error: err } = await admin.from('churches').insert({
      name,
      pastor_name: pastor,
      zone,
      status,
      members_count: 0
    }).select().single();
    if (err) return json({ error: err.message }, 400);

    // Optionally create Pastor account
    if (body.createPastor && body.pastor_email) {
      const pEmail = pastorEmail;
      await admin.from('user_profiles').upsert({
        username: pEmail,
        email: pEmail,
        full_name: pastor,
        role: 'Church Pastor',
        church_name: name,
        zone,
        phone: body.pastor_phone || '+233 24 555 0000',
        password_hash: pastorPassword,
        admin_verified: true,
      }, { onConflict: 'email' });
      await admin.from('church_admin_accounts').upsert({
        church_name: name,
        admin_name: pastor,
        admin_email: pEmail,
        admin_phone: body.pastor_phone || '+233 24 555 0000',
        zone,
        role: 'Church Pastor',
        status: 'Active',
        email_verified: true,
      }, { onConflict: 'admin_email' });
    }

    // Link any admin accounts to this new church and migrate data
    for (const eNorm of linkedAdmins.emails) {
      const { data: pData } = await admin.from('user_profiles').select('church_name').ilike('email', eNorm).maybeSingle();
      const oldCh = pData?.church_name;
      await admin.from('user_profiles').update({ church_name: name, role: 'Church Admin', admin_verified: true }).ilike('email', eNorm);
      await admin.from('church_admin_accounts').update({ church_name: name, role: 'Church Admin', status: 'Active', email_verified: true }).ilike('admin_email', eNorm);

      if (body.migrateData !== false && oldCh && oldCh.toLowerCase() !== name.toLowerCase()) {
        await admin.from('members').update({ church_name: name, church_id: newC?.id || null }).ilike('church_name', oldCh);
        await admin.from('leaders').update({ church_name: name, church_id: newC?.id || null }).ilike('church_name', oldCh);
        await admin.from('attendance_records').update({ church_name: name, church_id: newC?.id || null }).ilike('church_name', oldCh);
        await admin.from('absence_records').update({ church_name: name, church_id: newC?.id || null }).ilike('church_name', oldCh);
        await admin.from('cell_reports').update({ church_name: name, church_id: newC?.id || null }).ilike('church_name', oldCh);
      }
    }

    await log(`Created church branch "${name}"`, 'Church');
    return json({ success: true, church: newC });
  }

  if (op === 'createPastorAccount') {
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    const phone = String(body.phone || '').trim();
    const churchName = String(body.churchName || '').trim();
    const zone = String(body.zone || 'Zone 1 (Korle Bu)').trim();

    if (!fullName || !email || !churchName) {
      return json({ error: 'Full name, email, and church name are required.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return json({ error: 'Enter a valid pastor email and password of at least 8 characters.' }, 400);
    }
    const linkedAdmins = await resolveLinkedAdmins(body.linkedAdminEmails);
    if (linkedAdmins.error) return json({ error: linkedAdmins.error }, 400);

    // Ensure church exists
    let { data: ch } = await admin.from('churches').select('id, name').ilike('name', churchName).maybeSingle();
    if (!ch) {
      const { data: createdCh } = await admin.from('churches').insert({
        name: churchName,
        pastor_name: fullName,
        zone,
        status: 'Active',
        members_count: 0
      }).select().single();
      ch = createdCh;
    } else {
      await admin.from('churches').update({ pastor_name: fullName }).eq('id', ch.id);
    }

    // Upsert pastor in user_profiles
    await admin.from('user_profiles').upsert({
      username: email,
      email,
      full_name: fullName,
      role: 'Church Pastor',
      church_name: churchName,
      zone,
      phone: phone || '+233 24 555 0000',
      password_hash: password,
      admin_verified: true,
    }, { onConflict: 'email' });

    // Upsert pastor in church_admin_accounts
    await admin.from('church_admin_accounts').upsert({
      church_name: churchName,
      admin_name: fullName,
      admin_email: email,
      admin_phone: phone || '+233 24 555 0000',
      zone,
      role: 'Church Pastor',
      status: 'Active',
      email_verified: true,
    }, { onConflict: 'admin_email' });

    // Link any admin accounts to this pastor's church and migrate data
    for (const eNorm of linkedAdmins.emails) {
      const { data: pData } = await admin.from('user_profiles').select('church_name').ilike('email', eNorm).maybeSingle();
      const oldCh = pData?.church_name;
      await admin.from('user_profiles').update({ church_name: churchName, role: 'Church Admin', admin_verified: true }).ilike('email', eNorm);
      await admin.from('church_admin_accounts').update({ church_name: churchName, role: 'Church Admin', status: 'Active', email_verified: true }).ilike('admin_email', eNorm);

      if (body.migrateData !== false && oldCh && oldCh.toLowerCase() !== churchName.toLowerCase()) {
        await admin.from('members').update({ church_name: churchName, church_id: ch?.id || null }).ilike('church_name', oldCh);
        await admin.from('leaders').update({ church_name: churchName, church_id: ch?.id || null }).ilike('church_name', oldCh);
        await admin.from('attendance_records').update({ church_name: churchName, church_id: ch?.id || null }).ilike('church_name', oldCh);
        await admin.from('absence_records').update({ church_name: churchName, church_id: ch?.id || null }).ilike('church_name', oldCh);
        await admin.from('cell_reports').update({ church_name: churchName, church_id: ch?.id || null }).ilike('church_name', oldCh);
      }
    }

    await log(`Created pastor account for "${fullName}" (${email}) at "${churchName}"`, 'Church');
    return json({ success: true, church: ch });
  }

  if (op === 'linkAdminToPastor') {
    const adminEmail = String(body.adminEmail || body.email || '').trim().toLowerCase();
    const adminId = body.adminId || body.id;
    const targetChurch = String(body.targetChurchName || body.churchName || '').trim();

    if (!targetChurch || (!adminEmail && !adminId)) {
      return json({ error: 'Target church name and admin email or ID are required.' }, 400);
    }
    if (!adminEmail) return json({ error: 'An administrator email is required.' }, 400);
    const linkedAdmins = await resolveLinkedAdmins([adminEmail]);
    if (linkedAdmins.error) return json({ error: linkedAdmins.error }, 400);

    // Locate target church
    let { data: ch } = await admin.from('churches').select('id, name').ilike('name', targetChurch).maybeSingle();
    const resolvedTargetName = ch?.name || targetChurch;

    // Locate admin user profile and church admin row
    let pQuery = admin.from('user_profiles').select('id, full_name, username, email, phone, zone, church_name, church_id');
    if (adminId) pQuery = pQuery.eq('id', adminId);
    else pQuery = pQuery.ilike('email', adminEmail);
    const { data: pData } = await pQuery.maybeSingle();

    let aQuery = admin.from('church_admin_accounts').select('id, admin_name, admin_email, admin_phone, zone, church_name, church_id');
    if (adminId) aQuery = aQuery.eq('id', adminId);
    else aQuery = aQuery.ilike('admin_email', adminEmail);
    const { data: aData } = await aQuery.maybeSingle();

    const oldCh = pData?.church_name || aData?.church_name || '';
    const targetEmail = pData?.email || aData?.admin_email || adminEmail;

    // Update user profile
    if (targetEmail) {
      await admin.from('user_profiles').update({
        church_name: resolvedTargetName,
        church_id: ch?.id || null,
        role: 'Church Admin',
        admin_verified: true,
      }).ilike('email', targetEmail);

      // Upsert into church_admin_accounts
      await admin.from('church_admin_accounts').upsert({
        church_name: resolvedTargetName,
        church_id: ch?.id || null,
        admin_name: pData?.full_name || pData?.username || aData?.admin_name || 'Church Admin',
        admin_email: targetEmail,
        admin_phone: pData?.phone || aData?.admin_phone || '+233 24 555 0000',
        zone: pData?.zone || aData?.zone || 'Zone 1 (Korle Bu)',
        role: 'Church Admin',
        status: 'Active',
        email_verified: true,
      }, { onConflict: 'admin_email' });
    }

    // Migrate all records so pastor sees the entire church database
    if (body.migrateData !== false && oldCh && oldCh.toLowerCase() !== resolvedTargetName.toLowerCase()) {
      await admin.from('members').update({ church_name: resolvedTargetName, church_id: ch?.id || null }).ilike('church_name', oldCh);
      await admin.from('leaders').update({ church_name: resolvedTargetName, church_id: ch?.id || null }).ilike('church_name', oldCh);
      await admin.from('attendance_records').update({ church_name: resolvedTargetName, church_id: ch?.id || null }).ilike('church_name', oldCh);
      await admin.from('absence_records').update({ church_name: resolvedTargetName, church_id: ch?.id || null }).ilike('church_name', oldCh);
      await admin.from('cell_reports').update({ church_name: resolvedTargetName, church_id: ch?.id || null }).ilike('church_name', oldCh);
      await admin.from('church_report_codes').update({ church_name: resolvedTargetName, church_id: ch?.id || null }).ilike('church_name', oldCh);
    }

    // Recalculate member counts for the target church and previous church
    const { count: newMemCount } = await admin.from('members').select('*', { count: 'exact', head: true }).ilike('church_name', resolvedTargetName);
    if (ch?.id) {
      await admin.from('churches').update({ members_count: newMemCount || 0 }).eq('id', ch.id);
    } else {
      await admin.from('churches').update({ members_count: newMemCount || 0 }).ilike('name', resolvedTargetName);
    }

    if (oldCh && oldCh.toLowerCase() !== resolvedTargetName.toLowerCase()) {
      const { count: oldMemCount } = await admin.from('members').select('*', { count: 'exact', head: true }).ilike('church_name', oldCh);
      await admin.from('churches').update({ members_count: oldMemCount || 0 }).ilike('name', oldCh);
    }

    await log(`Linked admin "${targetEmail}" to "${resolvedTargetName}" and migrated database`, 'Church');
    return json({ success: true, migratedFrom: oldCh, migratedTo: resolvedTargetName, church: ch });
  }

  if (op === 'updateChurch') {
    const name = String(body.name || '').trim();
    const id = body.id;
    const updates: Record<string, unknown> = {};
    if (body.newName) updates.name = String(body.newName).trim();
    if (body.pastor_name !== undefined) updates.pastor_name = String(body.pastor_name).trim();
    if (body.zone !== undefined) updates.zone = String(body.zone).trim();
    if (body.status !== undefined) updates.status = String(body.status);
    let q = admin.from('churches').update(updates);
    if (id) q = q.eq('id', id);
    else q = q.eq('name', name);
    const { error: err } = await q;
    if (err) return json({ error: err.message }, 400);

    if (body.newName && body.newName !== name) {
      await admin.from('members').update({ church_name: body.newName }).ilike('church_name', name);
      await admin.from('leaders').update({ church_name: body.newName }).ilike('church_name', name);
      await admin.from('attendance_records').update({ church_name: body.newName }).ilike('church_name', name);
      await admin.from('cell_reports').update({ church_name: body.newName }).ilike('church_name', name);
      await admin.from('church_report_codes').update({ church_name: body.newName }).ilike('church_name', name);
      await admin.from('church_admin_accounts').update({ church_name: body.newName }).ilike('church_name', name);
      await admin.from('user_profiles').update({ church_name: body.newName }).ilike('church_name', name);
    }

    await log(`Updated church branch "${name || body.newName}"`, 'Church');
    return json({ success: true });
  }

  if (op === 'deleteChurch') return await handleChurchDeletion(body, session);

  if (op === 'approveRegistration') {
    const id = body.id;
    const email = String(body.email || '').trim().toLowerCase();
    let q = admin.from('user_profiles').update({ admin_verified: true });
    if (id) q = q.eq('id', id);
    else q = q.ilike('email', email);
    const { error: err } = await q;
    if (err) return json({ error: err.message }, 400);
    if (email) {
      await admin.from('church_admin_accounts').update({ email_verified: true, status: 'Active' }).ilike('admin_email', email);
    }
    await log(`Manually approved registration for ${email || id}`, 'Security');
    return json({ success: true });
  }

  if (op === 'updateRegistration') {
    const id = body.id;
    const email = String(body.email || '').trim().toLowerCase();
    const updates: Record<string, unknown> = {};
    if (body.fullName !== undefined) updates.full_name = String(body.fullName).trim();
    if (body.role !== undefined) updates.role = String(body.role);
    if (body.church !== undefined) updates.church_name = String(body.church);
    if (body.phone !== undefined) updates.phone = String(body.phone).trim();
    if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase();
    if (body.verified !== undefined) updates.admin_verified = Boolean(body.verified);
    let q = admin.from('user_profiles').update(updates);
    if (id) q = q.eq('id', id);
    else q = q.ilike('email', email);
    const { error: err } = await q;
    if (err) return json({ error: err.message }, 400);
    await log(`Configured registration details for ${email || id}`, 'Security');
    return json({ success: true });
  }

  if (op === 'resendVerification') {
    const email = String(body.email || '').trim().toLowerCase();
    const token = crypto.randomUUID();
    await admin.from('user_profiles').update({ email_verification_token: token, email_verification_sent_at: new Date().toISOString() }).ilike('email', email);
    await admin.from('email_send_log').insert({
      template_name: 'verification_email',
      recipient_email: email,
      status: 'sent',
      error_message: null,
      metadata: { church: body.church, token }
    });
    await log(`Resent verification link for ${email}`, 'Security');
    return json({ success: true, token });
  }

  if (op === 'setPasswordRegistration') {
    const id = body.id;
    const email = String(body.email || '').trim().toLowerCase();
    const newPass = String(body.password || '').trim();
    if (newPass.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
    let q = admin.from('user_profiles').update({ password_hash: newPass, admin_verified: true });
    if (id) q = q.eq('id', id);
    else q = q.ilike('email', email);
    const { error: err } = await q;
    if (err) return json({ error: err.message }, 400);
    await log(`Assigned password & activated account for ${email || id}`, 'Security');
    return json({ success: true });
  }

  if (op === 'deleteRegistration') {
    const id = body.id;
    const email = String(body.email || '').trim().toLowerCase();
    let q = admin.from('user_profiles').delete();
    if (id) q = q.eq('id', id);
    else q = q.ilike('email', email);
    const { error: err } = await q;
    if (err) return json({ error: err.message }, 400);
    if (email) {
      await admin.from('church_admin_accounts').delete().ilike('admin_email', email);
    }
    await log(`Deleted unverified registration for ${email || id}`, 'Security');
    return json({ success: true });
  }

  if (op === 'saveSmsConfig') {
    const config = body.config && typeof body.config === 'object' && !Array.isArray(body.config)
      ? body.config as Record<string, unknown>
      : {};
    const senderId = typeof config.senderId === 'string' ? config.senderId.trim() : '';
    if (senderId && !/^[A-Za-z0-9]{1,11}$/.test(senderId)) {
      return json({ error: 'Sender ID must contain 1–11 letters or numbers only.' }, 400);
    }
    const safeConfig = { provider: 'Mnotify', senderId, enabled: config.enabled === true };
    const { error: saveError } = await admin.from('admin_settings').upsert({
      setting_key: 'sms_config',
      setting_value: safeConfig,
      is_global: true,
      setting_type: 'json'
    }, { onConflict: 'setting_key' });
    if (saveError) return json({ error: 'Could not save the SMS configuration.' }, 500);
    await log(`Updated SMS Gateway configuration (${senderId ? 'mNotify sender ID set' : 'sender ID cleared'})`, 'Settings');
    return json({ success: true, config: safeConfig });
  }

  if (op === 'saveMnotifyManagement') {
    const cfg = body.config && typeof body.config === 'object' && !Array.isArray(body.config) ? body.config : {};
    const rawPhone = String(cfg.adminPhone || '').trim();
    if (!/^\+?[\d\s().-]+$/.test(rawPhone)) return json({ error: { message: 'Enter a valid Ghanaian admin alert phone number.' } }, 400);
    const adminPhone = normalizeGhanaPhone(rawPhone);
    const alertSenderId = String(cfg.alertSenderId || '').trim();
    const unitRate = Number(cfg.unitRate);
    const lowBalanceThreshold = Number(cfg.lowBalanceThreshold);
    if (!adminPhone) return json({ error: { message: 'Enter a valid Ghanaian admin alert phone number.' } }, 400);
    if (!/^[A-Za-z0-9 ]{1,11}$/.test(alertSenderId)) return json({ error: { message: 'Alert sender ID must be 1-11 letters, numbers, or spaces.' } }, 400);
    if (!Number.isFinite(unitRate) || unitRate <= 0 || unitRate > 1000) return json({ error: { message: 'Enter a valid per-page SMS rate.' } }, 400);
    if (!Number.isFinite(lowBalanceThreshold) || lowBalanceThreshold < 0 || lowBalanceThreshold > 10000000) return json({ error: { message: 'Enter a valid balance alert threshold.' } }, 400);
    const previous = await getMnotifyManagementConfig();
    const config = {
      adminPhone: `+233${adminPhone.slice(1)}`,
      alertSenderId,
      unitRate,
      lowBalanceThreshold,
      lowBalanceAlerted: previous.lowBalanceAlerted,
      lastBalance: previous.lastBalance,
      balanceCheckedAt: previous.balanceCheckedAt,
    };
    const { error } = await admin.from('admin_settings').upsert({
      setting_key: 'mnotify_management', setting_value: config, setting_type: 'json', is_global: true,
    }, { onConflict: 'setting_key' });
    if (error) return json({ error: { message: 'Could not save mNotify settings.' } }, 500);
    await log('Updated mNotify management settings', 'Settings');
    return json({ success: true, config });
  }

  if (op === 'senderIdOverview') {
    const [{ data: senders }, { data: alerts }, { data: campaigns }, cfg] = await Promise.all([
      admin.from('sender_id_requests').select('id, sender_name, purpose, status, submission_status, submission_response, submission_error, rejection_reason, review_required, created_at, submitted_to_mnotify_at, notification_sent_at')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(300),
      admin.from('admin_alerts').select('id, sender_id_request_id, channel, recipient, status, attempts, provider_campaign_id, error_message, sent_at, created_at')
        .order('created_at', { ascending: false }).limit(100),
      admin.from('sms_campaigns').select('id, sender_name, recipient_count, pages_per_message, total_pages, unit_rate, estimated_cost, actual_credits, provider_campaign_id, status, last_polled_at, created_at')
        .order('created_at', { ascending: false }).limit(300),
      getMnotifyManagementConfig(),
    ]);
    const campaignIds = (campaigns || []).map((campaign: any) => campaign.id);
    const recipientCounts = new Map<string, { delivered: number; failed: number; pending: number }>();
    if (campaignIds.length) {
      const { data: recipients, error } = await admin.from('sms_recipients').select('campaign_id, status').in('campaign_id', campaignIds);
      if (error) throw new Error('Could not load SMS delivery totals.');
      for (const recipient of recipients || []) {
        const counts = recipientCounts.get(recipient.campaign_id) || { delivered: 0, failed: 0, pending: 0 };
        if (recipient.status === 'delivered' || recipient.status === 'failed' || recipient.status === 'pending') {
          counts[recipient.status]++;
        }
        recipientCounts.set(recipient.campaign_id, counts);
      }
    }
    const joinedCampaigns = (campaigns || []).map((campaign: any) => ({
      ...campaign,
      delivery: recipientCounts.get(campaign.id) || { delivered: 0, failed: 0, pending: 0 },
    }));
    return json({
      success: true,
      senderIds: senders || [],
      alerts: alerts || [],
      campaigns: joinedCampaigns,
      config: cfg,
      balance: cfg.lastBalance,
      balanceError: cfg.lastBalance === null ? 'Check live balance to load.' : null,
    });
  }

  if (op === 'deleteSenderId') {
    const id = String(body.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return json({ success: false, error: { message: 'Select a valid Sender ID request.' } }, 400);
    }
    const { data: sender, error: lookupError } = await admin.from('sender_id_requests')
      .select('id, sender_name')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (lookupError) {
      console.error('Sender ID removal lookup failed:', lookupError.message);
      return json({ success: false, error: { message: 'Could not load this Sender ID request.' } }, 500);
    }
    if (!sender) return json({ success: false, error: { message: 'Sender ID request was already removed or could not be found.' } }, 404);

    // Permanently remove the request and every record linked to it.
    const { data: campaigns } = await admin.from('sms_campaigns').select('id').eq('sender_id_request_id', id);
    const campaignIds = (campaigns || []).map((c: any) => c.id);
    const steps: Array<[string, any]> = [];
    if (campaignIds.length) {
      steps.push(['sms_recipients', admin.from('sms_recipients').delete().in('campaign_id', campaignIds)]);
    }
    for (const [label, promise] of steps) {
      const { error } = await promise;
      if (error) { console.error(`Sender ID delete (${label}) failed:`, error.message); return json({ success: false, error: { message: 'Could not delete this Sender ID.' } }, 500); }
    }
    for (const table of ['sms_campaigns', 'admin_alerts', 'sender_id_status_history']) {
      const { error } = await admin.from(table).delete().eq('sender_id_request_id', id);
      if (error) { console.error(`Sender ID delete (${table}) failed:`, error.message); return json({ success: false, error: { message: 'Could not delete this Sender ID.' } }, 500); }
    }
    const { error: removeError } = await admin.from('sender_id_requests').delete().eq('id', id);
    if (removeError) {
      console.error(`Sender ID delete failed for ${sender.sender_name}:`, removeError.message);
      return json({ success: false, error: { message: 'Could not delete this Sender ID.' } }, 500);
    }

    const { error: auditError } = await log(`Permanently deleted Sender ID "${sender.sender_name}" and its campaigns and alerts from the portal. The mNotify registration was not changed.`, 'Messaging');
    if (auditError) console.error('Could not write Sender ID removal audit log:', auditError.message);
    return json({ success: true, deletedSenderId: sender.sender_name, providerDeleted: false });
  }

  if (op === 'reviewSenderId') {
    const id = String(body.id || '');
    const status = body.status === 'verified' || body.status === 'rejected' ? body.status : null;
    const reason = String(body.reason || '').trim().slice(0, 500);
    if (!status) return json({ error: { message: 'Choose verified or rejected.' } }, 400);
    const { data: sender } = await admin.from('sender_id_requests').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (!sender) return json({ error: { message: 'Sender ID request not found.' } }, 404);
    const result = await setSenderStatus(sender, status, session.user_email || 'Developer', reason);
    if (!result.success) return json({ error: { message: result.error } }, 500);
    await log(`Marked Sender ID ${sender.sender_name} as ${status}`, 'Messaging');
    return json(result);
  }

  if (op === 'retrySenderId') {
    const { data: sender } = await admin.from('sender_id_requests').select('*').eq('id', String(body.id || '')).is('deleted_at', null).maybeSingle();
    if (!sender || !['failed', 'pending'].includes(sender.submission_status)) {
      return json({ error: { message: 'Only failed sender-ID submissions can be retried.' } }, 400);
    }
    const result = await registerMnotifySenderId(sender.sender_name, sender.purpose);
    const status = result.ok ? senderStatusFromMnotify(result.payload) || 'submitted' : 'failed';
    const { error } = await admin.from('sender_id_requests').update({
      status, submission_status: result.ok ? 'submitted' : 'failed',
      submission_response: result.payload, submission_error: result.error,
      submitted_to_mnotify_at: result.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', sender.id);
    if (error) return json({ error: { message: 'Could not save retry result.' } }, 500);
    await addSenderStatusHistory(sender.id, session.user_email || 'Developer', sender.status, status, result.error);
    if (status === 'verified' || status === 'rejected') {
      const notified = await setSenderStatus({ ...sender, status: 'submitted', notification_sent_at: null }, status, 'mNotify API', result.payload?.summary?.reason || null);
      if (!notified.success) console.error('Could not notify user about sender-ID status:', notified.error);
    }
    return json({ success: result.ok, status, error: result.error });
  }

  if (op === 'retrySenderAlert') {
    const { data: sender } = await admin.from('sender_id_requests').select('id, sender_name, purpose, user_name')
      .eq('id', String(body.id || '')).is('deleted_at', null).maybeSingle();
    if (!sender) return json({ error: { message: 'Sender ID request not found.' } }, 404);
    const result = await sendSenderRequestAlert(sender);
    return json({ success: result.status === 'sent', status: result.status, error: result.error });
  }

  if (op === 'refreshAllMnotify') {
    const limited = await rateLimit(req, 'mnotify-status-refresh', 6, 600, corsHeaders, session.user_email || session.role, true, true);
    if (limited) return limited;
    const refreshed = await pollMnotifyPending();
    return json({ success: true, refreshed });
  }

  if (op === 'refreshSenderId') {
    const { data: sender } = await admin.from('sender_id_requests').select('*').eq('id', String(body.id || '')).is('deleted_at', null).maybeSingle();
    if (!sender) return json({ error: { message: 'Sender ID request not found.' } }, 404);
    const result = await refreshSenderStatus(sender);
    return json(result.success ? result : { success: false, error: { message: result.error } }, result.success ? 200 : 502);
  }

  if (op === 'refreshCampaign') {
    const { data: campaign } = await admin.from('sms_campaigns').select('*').eq('id', String(body.id || '')).maybeSingle();
    if (!campaign) return json({ error: { message: 'SMS campaign not found.' } }, 404);
    const result = await refreshCampaignReport(campaign);
    return json(result.success ? result : { success: false, error: { message: result.error } }, result.success ? 200 : 502);
  }

  if (op === 'getMnotifyBalance') {
    const result = await getMnotifySmsBalance();
    if (!result.ok) return json({ error: { message: result.error } }, 502);
    const balance = Number(result.payload?.balance || 0) + Number(result.payload?.bonus || 0);
    const cfg = await getMnotifyManagementConfig();
    if (Number.isFinite(balance)) await saveMnotifyBalance(balance);
    await checkMnotifyLowBalance(balance);
    return json({ success: true, balance, threshold: cfg.lowBalanceThreshold });
  }

  if (op === 'saveSmsTemplate') {
    const tpl = body.template;
    if (!tpl || !tpl.name) return json({ error: 'Template name required' }, 400);
    const { data: existing } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'sms_templates').maybeSingle();
    const list = Array.isArray(existing?.setting_value) ? existing.setting_value : [];
    const idx = list.findIndex((t: any) => t.id === tpl.id || t.name === tpl.name);
    const toSave = {
      id: tpl.id || `sms-${Date.now()}`,
      name: tpl.name,
      title: tpl.title || tpl.name,
      category: tpl.category || 'General',
      content: tpl.content || '',
      variables: tpl.variables || ['{name}', '{church}'],
      is_active: tpl.is_active !== false,
      updated_at: new Date().toISOString()
    };
    if (idx >= 0) list[idx] = toSave;
    else list.push(toSave);
    await admin.from('admin_settings').upsert({
      setting_key: 'sms_templates',
      setting_value: list,
      is_global: true,
      setting_type: 'json'
    }, { onConflict: 'setting_key' });
    await log(`Saved SMS template "${tpl.title || tpl.name}"`, 'Settings');
    return json({ success: true, template: toSave });
  }

  if (op === 'deleteSmsTemplate') {
    const id = String(body.id || '');
    const { data: existing } = await admin.from('admin_settings').select('setting_value').eq('setting_key', 'sms_templates').maybeSingle();
    const list = (Array.isArray(existing?.setting_value) ? existing.setting_value : []).filter((t: any) => t.id !== id && t.name !== id);
    await admin.from('admin_settings').upsert({
      setting_key: 'sms_templates',
      setting_value: list,
      is_global: true,
      setting_type: 'json'
    }, { onConflict: 'setting_key' });
    await log(`Deleted SMS template`, 'Settings');
    return json({ success: true });
  }

  if (op === 'createServiceType') {
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Program name required' }, 400);
    const { error: err } = await admin.from('service_types').insert({
      name,
      description: body.description || null,
      is_global: true,
      is_active: body.is_active !== false,
    });
    if (err) return json({ error: err.message }, 400);
    await log(`Created service program "${name}"`, 'Settings');
    return json({ success: true });
  }

  if (op === 'updateServiceType') {
    const id = body.id;
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    const { error: err } = await admin.from('service_types').update(updates).eq('id', id);
    if (err) return json({ error: err.message }, 400);
    await log(`Updated service program`, 'Settings');
    return json({ success: true });
  }

  if (op === 'deleteServiceType') {
    const id = body.id;
    const { error: err } = await admin.from('service_types').delete().eq('id', id);
    if (err) return json({ error: err.message }, 400);
    await log(`Deleted service program`, 'Settings');
    return json({ success: true });
  }

  if (op === 'recalculateChurchCounts') {
    const { data: allChurches } = await admin.from('churches').select('id, name');
    for (const ch of allChurches || []) {
      const { count } = await admin.from('members').select('*', { count: 'exact', head: true }).eq('church_id', ch.id);
      await admin.from('churches').update({ members_count: count || 0 }).eq('id', ch.id);
    }
    await log('Recalculated member counts for all churches', 'System');
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
    if (body.sms) {
      const limited = await rateLimit(req, 'admin-sms', 10, 600, corsHeaders, session.user_email || session.role, true, true);
      if (limited) return limited;
    }
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
    let sms: AdminSmsDispatchResult['sms'] | undefined;
    let smsError: string | undefined;
    if (body.sms) {
      const result = await dispatchAdminUpdateSms(`${title}: ${message}`, session!);
      sms = result.sms;
      smsError = result.error || undefined;
    }
    await log(`Broadcast announcement: ${title}${body.email ? ` (emailed ${emailed} staff)` : ''}`);
    return json({ success: true, emailed, sms, smsError });
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
        return await handleDevAction(body, session, req);
      case 'deleteChurch':
        return await handleChurchDeletion(body, session);
      case 'updateGroupProfile':
        return await handleUpdateGroupProfile(body, session, req);
      case 'updateProfilePhoto':
        return await handleUpdateProfilePhoto(body, session);
      case 'mnotifyUser':
        return await handleMnotifyUserAction(body, session, req);
      case 'mergeLeaders':
        return await handleMergeLeaders(body, session);
      case 'mnotifyScheduledPoll': {
        const expected = Deno.env.get('MNOTIFY_POLL_SECRET')?.trim();
        if (!expected || req.headers.get('x-mnotify-poll-secret') !== expected) {
          return json({ error: { message: 'Scheduled poll authorization failed.' } }, 401);
        }
        return json({ success: true, refreshed: await pollMnotifyPending() });
      }
      case 'sendAdminSms': {
        if (session?.role === 'Developer' || session?.role === 'Superadmin') {
          const limited = await rateLimit(req, 'admin-sms', 10, 600, corsHeaders, session.user_email || session.role, true, true);
          if (limited) return limited;
        } else if (session?.role === 'Church Admin' || session?.role === 'Church Pastor') {
          const limited = await rateLimit(req, 'branch-admin-sms', 5, 600, corsHeaders, session.user_email || session.role, true, true);
          if (limited) return limited;
        }
        return await handleAdminSms(body, session);
      }
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
