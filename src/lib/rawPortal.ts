// Calls portal-db actions that return their own top-level shape (login-like actions).
import { getPortalToken, runLocalPortal } from './portalDb';

const LOVABLE_SUPABASE_URL = 'https://bouwuqpzplazpwuwyphq.supabase.co';
const RAW_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || LOVABLE_SUPABASE_URL;
const URL = RAW_URL ? `${RAW_URL}/functions/v1/portal-db` : `${LOVABLE_SUPABASE_URL}/functions/v1/portal-db`;
const KEY = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) || (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) || '';

export async function rawPortal(payload: Record<string, unknown>, token?: string | null): Promise<any> {
  if (!URL) {
    return runLocalPortal(payload, token);
  }
  try {
    const t = token ?? getPortalToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(t ? { 'x-portal-session': t } : {}),
    };
    if (KEY) {
      headers['apikey'] = KEY;
      headers['Authorization'] = `Bearer ${KEY}`;
    }
    const res = await fetch(URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('portal-db remote returned non-ok status, falling back to local portal:', res.status);
      return runLocalPortal(payload, token);
    }
    const data = await res.json().catch(() => null);
    if (!data) return runLocalPortal(payload, token);
    return data;
  } catch (err: any) {
    console.warn('portal-db fetch failed, falling back to local portal:', err?.message);
    return runLocalPortal(payload, token);
  }
}

