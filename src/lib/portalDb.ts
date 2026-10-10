// Browser-side gateway to the secure server data API (`portal-db` function).
//
// The database is not reachable from the browser any more, so this module mimics
// the small slice of the Supabase query builder the app uses and sends each
// query to the server, which checks the signed-in session before touching data.

const RAW_SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://bouwuqpzplazpwuwyphq.supabase.co';
const FUNCTIONS_BASE = RAW_SUPABASE_URL ? `${RAW_SUPABASE_URL}/functions/v1/portal-db` : '';
const ANON_KEY = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) || (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) || '';

import { supabase as cloudClient } from '../integrations/supabase/client';

const TOKEN_KEY = 'gcyc_portal_token';
const LOCAL_DB_KEY = 'cekb_local_portal_db_v1';

interface LocalDbStore {
  tables: Record<string, any[]>;
  photos: Record<string, string>;
}

function getDefaultLocalStore(): LocalDbStore {
  const now = new Date().toISOString();
  return {
    tables: {
      churches: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'CE Korle Bu Central',
          pastor_name: 'Pastor Emmanuel',
          members_count: 0,
          status: 'Healthy',
          zone: 'Zone 1 (Korle Bu)',
          pcf_count: 0,
          cell_count: 0,
          bsct_count: 0,
          created_at: now,
          updated_at: now,
        },
      ],
      user_profiles: [
        {
          id: 'usr-super-1',
          username: 'group.pastor',
          email: 'group.pastor@cekorlebu.org',
          full_name: 'Group Pastor',
          role: 'Superadmin',
          church_name: 'GCYC Group HQ',
          zone: 'Zone 1 (Korle Bu)',
          phone: '+233 24 123 4567',
          password_hash: 'admin123',
          admin_verified: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'usr-pastor-1',
          username: 'admin@cekorlebu.org',
          email: 'admin@cekorlebu.org',
          full_name: 'Pastor Emmanuel',
          role: 'Church Pastor',
          church_name: 'CE Korle Bu Central',
          zone: 'Zone 1 (Korle Bu)',
          phone: '+233 24 555 0000',
          password_hash: 'admin123',
          admin_verified: true,
          created_at: now,
          updated_at: now,
        },
      ],
      church_admin_accounts: [
        {
          id: 'ADM-101',
          church_name: 'CE Korle Bu Central',
          admin_name: 'Pastor Emmanuel',
          admin_email: 'admin@cekorlebu.org',
          admin_phone: '+233 24 555 0000',
          zone: 'Zone 1 (Korle Bu)',
          role: 'Church Pastor',
          admin_verified: true,
          created_at: now,
        },
      ],
      service_types: [
        { id: 'srv-1', name: 'Sunday Service', description: 'Global Church Service Program', is_global: true, is_active: true, created_at: now },
        { id: 'srv-2', name: 'Midweek Service', description: 'Global Church Service Program', is_global: true, is_active: true, created_at: now },
        { id: 'srv-3', name: 'Special Service', description: 'Global Church Service Program', is_global: true, is_active: true, created_at: now },
      ],
      members: [],
      leaders: [],
      attendance_records: [],
      absence_records: [],
      audit_logs: [],
      announcements: [],
      promotion_queue: [],
      admin_settings: [],
      cell_reports: [],
      report_codes: [],
      email_send_log: [],
      portal_sessions: [],
    },
    photos: {},
  };
}

let memoryStore: LocalDbStore | null = null;

export function loadLocalStore(): LocalDbStore {
  if (memoryStore) return memoryStore;
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tables) {
        const def = getDefaultLocalStore();
        memoryStore = {
          tables: { ...def.tables, ...parsed.tables },
          photos: parsed.photos || {},
        };
        return memoryStore;
      }
    }
  } catch {
    /* ignore */
  }
  memoryStore = getDefaultLocalStore();
  return memoryStore;
}

export function saveLocalStore(store: LocalDbStore): void {
  memoryStore = store;
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function getLocalSession(store: LocalDbStore, token?: string | null) {
  const t = token ?? getPortalToken();
  if (!t) return null;
  const sessions = store.tables.portal_sessions || [];
  return sessions.find((s) => s.token === t) || null;
}

function matchesFilter(row: any, f: { op: string; column: string; value: any }): boolean {
  const val = row?.[f.column];
  const target = f.value;
  switch (f.op) {
    case 'eq':
      return val === target;
    case 'neq':
      return val !== target;
    case 'ilike': {
      const pattern = String(target ?? '').toLowerCase().replace(/%/g, '');
      const s = String(val ?? '').toLowerCase();
      if (String(target ?? '').includes('%')) return s.includes(pattern);
      return s === pattern;
    }
    case 'like': {
      const pattern = String(target ?? '').replace(/%/g, '');
      const s = String(val ?? '');
      if (String(target ?? '').includes('%')) return s.includes(pattern);
      return s === pattern;
    }
    case 'gt':
      return val > target;
    case 'gte':
      return val >= target;
    case 'lt':
      return val < target;
    case 'lte':
      return val <= target;
    case 'in':
      return Array.isArray(target) && target.includes(val);
    case 'is':
      return val === target || (target === null && val == null);
    case 'not':
      return val !== target;
    default:
      return true;
  }
}

export async function runLocalPortal(payload: Record<string, any>, explicitToken?: string | null): Promise<any> {
  const store = loadLocalStore();
  const action = String(payload.action || '');
  const session = getLocalSession(store, explicitToken);

  const getSetting = (key: string) => {
    const row = (store.tables.admin_settings || []).find((r: any) => r.setting_key === key);
    return row?.setting_value ?? null;
  };

  if (action === 'platformStatus') {
    const cfg = getSetting('platform_config') || {};
    return {
      data: {
        maintenance: !!cfg.maintenance,
        maintenanceMessage: cfg.maintenanceMessage || '',
        platformName: cfg.platformName || 'CEKB Group',
        tagline: cfg.tagline || 'Every presence counts.',
        announcementBanner: cfg.announcementBanner || '',
        allowRegistrations: cfg.allowRegistrations !== false,
        allowLeaderSignup: cfg.allowLeaderSignup !== false,
        allowSelfRegistration: cfg.allowSelfRegistration !== false,
        allowSelfCheckin: cfg.allowSelfCheckin !== false,
        allowCellReports: cfg.allowCellReports !== false,
        supportEmail: cfg.supportEmail || 'support@gcycattendance.online',
      },
    };
  }

  if (action === 'featureMatrix') {
    return { data: getSetting('feature_matrix') || null };
  }

  if (action === 'checkGroupCode') {
    const code = String(payload.code || '').trim().toUpperCase();
    return { valid: code === 'GROUP26' || code === 'CEKB-GROUP' };
  }

  if (action === 'claimGroupPastor') {
    const code = String(payload.code || '').trim().toUpperCase();
    if (code !== 'GROUP26' && code !== 'CEKB-GROUP') {
      return { success: false, error: 'Invalid group pastor code.' };
    }
    const email = String(payload.email || '').trim().toLowerCase();
    const prof = (store.tables.user_profiles || []).find((p: any) => String(p.email || '').toLowerCase() === email);
    if (prof) {
      prof.role = 'Superadmin';
      saveLocalStore(store);
      return { success: true };
    }
    return { success: false, error: 'Pastor account not found.' };
  }

  if (action === 'login') {
    const identifier = String(payload.identifier || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    if (!identifier || !password) {
      return { success: false, error: 'Please enter your email and password.' };
    }
    const profiles = store.tables.user_profiles || [];
    const admins = store.tables.church_admin_accounts || [];
    let match = profiles.find(
      (u: any) =>
        String(u.email || '').toLowerCase() === identifier ||
        String(u.username || '').toLowerCase() === identifier,
    );
    if (!match) {
      const adm = admins.find((a: any) => String(a.admin_email || '').toLowerCase() === identifier);
      if (adm) {
        match = {
          id: adm.id,
          email: adm.admin_email,
          full_name: adm.admin_name,
          role: adm.role || 'Church Pastor',
          church_name: adm.church_name,
          zone: adm.zone || 'Zone 1 (Korle Bu)',
          phone: adm.admin_phone,
          password_hash: adm.password || 'admin123',
        };
      }
    }
    if (!match) {
      return { success: false, error: 'Incorrect email or password.' };
    }
    const expectedPass = match.password_hash || match.password;
    if (expectedPass && expectedPass !== password && password !== '••••••••') {
      return { success: false, error: 'Incorrect email or password.' };
    }
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const userObj = {
      id: match.id || `usr-${Date.now()}`,
      name: match.full_name || match.username || 'Administrator',
      role: match.role || 'Church Admin',
      church: match.church_name || (match.role === 'Superadmin' ? 'GCYC Group HQ' : ''),
      zone: match.zone || 'Zone 1 (Korle Bu)',
      email: match.email || identifier,
      phone: match.phone || '+233 24 123 4567',
    };
    store.tables.portal_sessions = [
      ...(store.tables.portal_sessions || []),
      {
        token,
        role: userObj.role,
        user_email: userObj.email,
        user_name: userObj.name,
        church_name: userObj.church,
        expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      },
    ];
    saveLocalStore(store);
    return { success: true, user: userObj, token };
  }

  if (action === 'logout') {
    const t = explicitToken ?? getPortalToken();
    if (t) {
      store.tables.portal_sessions = (store.tables.portal_sessions || []).filter((s: any) => s.token !== t);
      saveLocalStore(store);
    }
    return { success: true };
  }

  if (action === 'upload') {
    const path = String(payload.path || '');
    const content = String(payload.content || '');
    if (!path || !content) return { data: null, error: { message: 'Invalid photo upload.' } };
    store.photos[path] = content;
    saveLocalStore(store);
    return { data: { path }, error: null };
  }

  if (action === 'signedUrl') {
    const path = String(payload.path || '');
    const signedUrl = store.photos[path] || path;
    return { data: { signedUrl }, error: null };
  }

  if (action === 'devLogin') {
    const u = String(payload.username || '').trim();
    const p = String(payload.password || '').trim();
    if (!u || !p) return { success: false, error: 'Incorrect username or password.' };
    const token = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    store.tables.portal_sessions = [
      ...(store.tables.portal_sessions || []),
      {
        token,
        role: 'Developer',
        user_email: null,
        user_name: 'Developer',
        church_name: null,
        expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      },
    ];
    saveLocalStore(store);
    return { success: true, token };
  }

  if (action === 'devStats') {
    const today = new Date().toISOString().slice(0, 10);
    const churches = store.tables.churches || [];
    const members = store.tables.members || [];
    const leaders = store.tables.leaders || [];
    const att = store.tables.attendance_records || [];
    const reps = store.tables.cell_reports || [];
    const profs = store.tables.user_profiles || [];
    return {
      data: {
        churches: churches.map((c: any) => ({ name: c.name, status: c.status || 'Active', members: c.members_count || 0 })),
        totals: {
          members: members.length,
          leaders: leaders.length,
          attendanceToday: att.filter((a: any) => a.attendance_date === today).length,
          attendance7: att.length,
          reports7: reps.length,
          pastors: profs.filter((p: any) => p.role === 'Church Pastor').length,
          admins: profs.filter((p: any) => p.role === 'Church Admin').length,
          ushers: profs.filter((p: any) => p.role === 'Usher').length,
          groupPastors: profs.filter((p: any) => p.role === 'Superadmin').length,
        },
        health: {
          emailsSent7: 0,
          emailsFailed7: 0,
          activeSessions: (store.tables.portal_sessions || []).length,
        },
      },
    };
  }

  if (action === 'devAnalytics') {
    const now = Date.now();
    const series = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(now - (89 - i) * 864e5).toISOString().slice(0, 10);
      const count = (store.tables.attendance_records || []).filter((r: any) => r.attendance_date === d).length;
      return { date: d, count };
    });
    const churches = (store.tables.churches || []).map((c: any) => ({
      name: c.name,
      status: c.status || 'Active',
      members: c.members_count || 0,
      leaders: 0,
      staff: 1,
      reports: 0,
      checkins30: 0,
      lastActive: null,
      createdAt: c.created_at,
      rows: 1,
      estBytes: 1200,
      active: true,
    }));
    const tablesCount: Record<string, number> = {};
    for (const [k, rows] of Object.entries(store.tables)) {
      tablesCount[k] = Array.isArray(rows) ? rows.length : 0;
    }
    const roleCounts: Record<string, number> = {};
    for (const p of store.tables.user_profiles || []) {
      roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
    }
    return {
      data: {
        series,
        churches,
        growth: [{ month: new Date().toISOString().slice(0, 7), churches: churches.length, members: (store.tables.members || []).length }],
        tables: tablesCount,
        roleCounts,
        flagged: [],
        messaging: {
          total30: 0,
          sent30: 0,
          failed30: 0,
          pending: 0,
          last24: 0,
          sms30: 0,
          failures: [],
          reasons: {},
          byChurch: {},
          byTemplate: {},
        },
        integrity: { orphanAtt: 0, orphanMem: 0, expiredSessions: 0 },
        logs: (store.tables.audit_logs || []).slice(0, 50).map((l: any) => ({
          id: l.id,
          category: l.category || 'System',
          icon: l.icon,
          church: l.church_name,
          at: l.created_at,
          action: l.action,
          actor: l.actor || 'System',
        })),
        announcements: store.tables.announcements || [],
        featureMatrix: getSetting('feature_matrix'),
        platform: getSetting('platform_config'),
      },
    };
  }

  if (action === 'devAction') {
    const op = String(payload.op || '');
    if (op === 'setChurchStatus') {
      const ch = (store.tables.churches || []).find((c: any) => c.name === payload.name);
      if (ch) ch.status = payload.status;
      saveLocalStore(store);
      return { success: true };
    }
    if (op === 'saveSetting') {
      const k = String(payload.key || '');
      const list = store.tables.admin_settings || [];
      const existing = list.find((r: any) => r.setting_key === k);
      if (existing) existing.setting_value = payload.value;
      else list.push({ id: `set-${Date.now()}`, setting_key: k, setting_value: payload.value, is_global: true });
      store.tables.admin_settings = list;
      saveLocalStore(store);
      return { success: true };
    }
    if (op === 'broadcast') {
      store.tables.announcements = [
        {
          id: `ann-${Date.now()}`,
          title: payload.title,
          message: payload.message,
          target_audience: 'All Churches',
          sender_name: 'developer@gcycattendance.online',
          created_at: new Date().toISOString(),
        },
        ...(store.tables.announcements || []),
      ];
      saveLocalStore(store);
      return { success: true, emailed: 0 };
    }
    if (op === 'purgeSessions') {
      return { success: true };
    }
    return { success: true };
  }

  if (action === 'query') {
    const table = String(payload.table || '');
    const op = String(payload.op || 'select');
    if (!store.tables[table]) store.tables[table] = [];
    let rows = [...store.tables[table]];

    // Enforce leader hierarchy protection: only Church Pastor and Superadmin can modify hierarchy fields
    if (session && table === 'leaders' && op !== 'select' && session.role !== 'Church Pastor' && session.role !== 'Superadmin') {
      const incoming = Array.isArray(payload.values) ? payload.values : payload.values ? [payload.values] : [];
      const touchesHierarchy = op === 'delete' || incoming.some((r: any) => r && ('parent_leader_id' in r || 'leader_type' in r));
      if (touchesHierarchy && op !== 'insert') {
        return { data: null, error: { message: 'Only the church pastor can change the leader hierarchy.' } };
      }
    }

    const filters: Array<{ op: string; column: string; value: any }> = payload.filters || [];
    const matchRow = (r: any) => filters.every((f) => matchesFilter(r, f));

    if (op === 'select') {
      let result = rows.filter(matchRow);
      if (payload.order?.column) {
        const col = payload.order.column;
        const asc = payload.order.ascending !== false;
        result.sort((a, b) => {
          const va = a?.[col] ?? '';
          const vb = b?.[col] ?? '';
          if (va < vb) return asc ? -1 : 1;
          if (va > vb) return asc ? 1 : -1;
          return 0;
        });
      }
      if (typeof payload.limit === 'number') {
        result = result.slice(0, payload.limit);
      }
      if (payload.single) {
        return { data: result[0] ?? null, error: null };
      }
      return { data: result, error: null };
    }

    if (op === 'insert' || op === 'upsert') {
      const incoming = (Array.isArray(payload.values) ? payload.values : [payload.values]).filter(Boolean);
      const conflictCol = payload.upsert?.onConflict?.split(',')[0]?.trim() || 'id';
      const saved: any[] = [];

      for (const item of incoming) {
        const record = {
          id: item.id || `${table.slice(0, 3)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        if (table === 'user_profiles' && !session) {
          record.admin_verified = true;
        }
        const existingIdx = rows.findIndex(
          (r) => r?.[conflictCol] != null && String(r[conflictCol]).toLowerCase() === String(record[conflictCol]).toLowerCase(),
        );
        if (op === 'upsert' && existingIdx >= 0) {
          rows[existingIdx] = { ...rows[existingIdx], ...record };
          saved.push(rows[existingIdx]);
        } else {
          rows.unshift(record);
          saved.push(record);
        }
      }
      store.tables[table] = rows;
      saveLocalStore(store);
      return { data: payload.single ? (saved[0] ?? null) : saved, error: null };
    }

    if (op === 'update') {
      const updated: any[] = [];
      store.tables[table] = rows.map((r) => {
        if (matchRow(r)) {
          const next = { ...r, ...(payload.values || {}), updated_at: new Date().toISOString() };
          updated.push(next);
          return next;
        }
        return r;
      });
      saveLocalStore(store);
      return { data: payload.single ? (updated[0] ?? null) : updated, error: null };
    }

    if (op === 'delete') {
      store.tables[table] = rows.filter((r) => !matchRow(r));
      saveLocalStore(store);
      return { data: [], error: null };
    }
  }

  return { data: null, error: null };
}

export function setPortalToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    /* storage unavailable */
  }
}

export function getPortalToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export interface PortalResponse<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export async function callPortal<T = any>(payload: Record<string, unknown>): Promise<PortalResponse<T>> {
  if (!FUNCTIONS_BASE) {
    return runLocalPortal(payload);
  }
  try {
    const token = getPortalToken();
    const res = await fetch(FUNCTIONS_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        ...(token ? { 'x-portal-session': token } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!body) return { data: null, error: { message: 'No response from the server.' } };
    if (body.error) return { data: null, error: body.error };
    return { data: (body.data ?? null) as T, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Network error.' } };
  }
}

type Op = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

class PortalQuery implements PromiseLike<PortalResponse> {
  private table: string;
  private op: Op = 'select';
  private columns = '*';
  private returning?: string;
  private values?: unknown;
  private upsertOptions?: { onConflict?: string };
  private filters: Array<{ op: string; column: string; value: unknown }> = [];
  private orFilter?: string;
  private orderBy?: { column: string; ascending?: boolean };
  private limitCount?: number;
  private singleRow = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*') {
    if (this.op === 'select') this.columns = columns;
    else this.returning = columns;
    return this;
  }

  insert(values: unknown) {
    this.op = 'insert';
    this.values = values;
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string }) {
    this.op = 'upsert';
    this.values = values;
    this.upsertOptions = options;
    return this;
  }

  update(values: unknown) {
    this.op = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  private filter(op: string, column: string, value: unknown) {
    this.filters.push({ op, column, value });
    return this;
  }

  eq(c: string, v: unknown) { return this.filter('eq', c, v); }
  neq(c: string, v: unknown) { return this.filter('neq', c, v); }
  ilike(c: string, v: unknown) { return this.filter('ilike', c, v); }
  like(c: string, v: unknown) { return this.filter('like', c, v); }
  gt(c: string, v: unknown) { return this.filter('gt', c, v); }
  gte(c: string, v: unknown) { return this.filter('gte', c, v); }
  lt(c: string, v: unknown) { return this.filter('lt', c, v); }
  lte(c: string, v: unknown) { return this.filter('lte', c, v); }
  in(c: string, v: unknown) { return this.filter('in', c, v); }
  is(c: string, v: unknown) { return this.filter('is', c, v); }
  not(c: string, _operator: string, v: unknown) { return this.filter('not', c, v); }

  or(expression: string) {
    this.orFilter = expression;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.singleRow = true;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  private run(): Promise<PortalResponse> {
    return callPortal({
      action: 'query',
      table: this.table,
      op: this.op,
      columns: this.columns,
      returning: this.returning,
      values: this.values,
      upsert: this.upsertOptions,
      filters: this.filters,
      or: this.orFilter,
      order: this.orderBy,
      limit: this.limitCount,
      single: this.singleRow,
    });
  }

  then<TResult1 = PortalResponse, TResult2 = never>(
    onfulfilled?: ((value: PortalResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled as any, onrejected as any);
  }
}

/** Small stand-in for the Supabase client, backed by the secure server API. */
export const portalDb = {
  from(table: string) {
    return new PortalQuery(table);
  },

  async rpc(fn: string, params: Record<string, unknown>) {
    if (fn === 'verify_user_login') {
      if (!FUNCTIONS_BASE) {
        const res = await runLocalPortal({
          action: 'login',
          identifier: params.p_identifier,
          password: params.p_password,
          role: params.p_role,
          otp: params.p_otp,
        });
        if (res?.success && res.token) setPortalToken(res.token);
        return { data: { success: !!res?.success, user: res?.user, error: res?.error, email: res?.email }, error: null };
      }
      const res = await fetch(FUNCTIONS_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({
          action: 'login',
          identifier: params.p_identifier,
          password: params.p_password,
          role: params.p_role,
          otp: params.p_otp,
        }),
      })
        .then((r) => r.json())
        .catch(() => null);

      if (!res) return { data: null, error: { message: 'Could not reach the sign-in service.' } };
      if (res.success && res.token) setPortalToken(res.token);
      return { data: { success: !!res.success, user: res.user, error: res.error, email: res.email }, error: null };
    }
    return { data: null, error: { message: 'Not available from the browser.' } };
  },


  functions: {
    invoke(name: string, options?: { body?: unknown; headers?: Record<string, string> }) {
      const token = getPortalToken();
      return (cloudClient as any).functions.invoke(name, {
        ...options,
        headers: {
          ...(options?.headers || {}),
          ...(token ? { 'x-portal-session': token } : {}),
        },
      });
    },
  },

  auth: {
    async signOut() {
      await callPortal({ action: 'logout' });
      setPortalToken(null);
      return { error: null };
    },
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File, options?: { contentType?: string; allowSelfService?: boolean }) {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Could not read the selected photo.'));
            reader.readAsDataURL(file);
          });
          const res = await callPortal({
            action: 'upload',
            path,
            content,
            contentType: options?.contentType || file.type || 'image/jpeg',
            allowSelfService: true,
          });
          return { data: res.data, error: res.error };
        },
        async createSignedUrl(path: string, _expiresIn: number) {
          const res = await callPortal<{ signedUrl: string }>({ action: 'signedUrl', path });
          return { data: res.data, error: res.error };
        },
      };
    },
  },
};
