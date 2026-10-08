import { rateLimit } from '../_shared/rate-limit.ts';
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
]);

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
    expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString(),
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

  if (!session) {
    if (isRead && !PUBLIC_READ[table]) {
      return json({ error: { message: 'Please sign in to view this data.' } }, 401);
    }
    if (!isRead && !(PUBLIC_WRITE.has(table) && (op === 'insert' || op === 'upsert'))) {
      return json({ error: { message: 'Please sign in to make this change.' } }, 401);
    }
  }

  if (!isRead && SUPERADMIN_WRITE.has(table) && session?.role !== 'Superadmin') {
    return json({ error: { message: 'Only the group account can change these settings.' } }, 403);
  }

  // Visitors may only create brand-new accounts, never overwrite existing ones.
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
      if (table === 'user_profiles' && row.role === 'Superadmin') row.role = 'Church Admin';
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

// ------------------------------------------------------------------- dispatch

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: { message: 'Invalid request.' } }, 400);
    }

    const session = await getSession(req);

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
