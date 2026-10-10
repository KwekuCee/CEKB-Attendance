// Calls portal-db actions that return their own top-level shape (login-like actions).
import { getPortalToken, runLocalPortal } from './portalDb';

const RAW_URL = import.meta.env.VITE_SUPABASE_URL || '';
const URL = RAW_URL ? `${RAW_URL}/functions/v1/portal-db` : '';
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export async function rawPortal(payload: Record<string, unknown>, token?: string | null): Promise<any> {
  if (!URL) {
    return runLocalPortal(payload, token);
  }
  try {
    const t = token ?? getPortalToken();
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        ...(t ? { 'x-portal-session': t } : {}),
      },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}
