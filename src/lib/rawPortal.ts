// Calls portal-db actions that return their own top-level shape (login-like actions).
import { getPortalToken, runLocalPortal } from './portalDb';

const LOVABLE_SUPABASE_URL = 'https://bouwuqpzplazpwuwyphq.supabase.co';
const RAW_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || LOVABLE_SUPABASE_URL;
const URL = RAW_URL ? `${RAW_URL}/functions/v1/portal-db` : `${LOVABLE_SUPABASE_URL}/functions/v1/portal-db`;
const KEY = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) || (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) || '';
const ALLOW_LOCAL_FALLBACK =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_LOCAL_PORTAL === 'true') ||
  (typeof process !== 'undefined' && process.env?.VITE_ENABLE_LOCAL_PORTAL === 'true');

function withActionablePortalError(data: any, action: unknown) {
  if (action === 'mnotifyUser' && data?.error?.message === 'Unknown request.') {
    return {
      ...data,
      error: {
        ...data.error,
        message: 'Sender ID and SMS are not enabled on the server yet. Deploy the latest portal-db Supabase Edge Function, then try again.',
      },
    };
  }
  return data;
}

export async function rawPortal(payload: Record<string, unknown>, token?: string | null): Promise<any> {
  if (!URL) {
    if (ALLOW_LOCAL_FALLBACK) return runLocalPortal(payload, token);
    return { success: false, error: { message: 'The server service is not configured.' } };
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
      if (ALLOW_LOCAL_FALLBACK) return runLocalPortal(payload, token);
      const response = await res.json().catch(() => null);
      return withActionablePortalError(
        response || { success: false, error: { message: `The server rejected the request (${res.status}).` } },
        payload.action,
      );
    }
    const data = await res.json().catch(() => null);
    if (!data && ALLOW_LOCAL_FALLBACK) return runLocalPortal(payload, token);
    if (!data) return { success: false, error: { message: 'The server returned an invalid response.' } };
    return withActionablePortalError(data, payload.action);
  } catch (err: any) {
    if (ALLOW_LOCAL_FALLBACK) return runLocalPortal(payload, token);
    console.error('portal-db request failed:', err?.message || err);
    return { success: false, error: { message: 'Could not reach the server. Please try again.' } };
  }
}
