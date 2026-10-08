// Browser-side gateway to the secure server data API (`portal-db` function).
//
// The database is not reachable from the browser any more, so this module mimics
// the small slice of the Supabase query builder the app uses and sends each
// query to the server, which checks the signed-in session before touching data.

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/portal-db`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

import { supabase as cloudClient } from '../integrations/supabase/client';

const TOKEN_KEY = 'gcyc_portal_token';

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
