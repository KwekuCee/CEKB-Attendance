// Calls portal-db actions that return their own top-level shape (login-like actions).
import { getPortalToken } from './portalDb';

const URL = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/portal-db`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export async function rawPortal(payload: Record<string, unknown>, token?: string | null): Promise<any> {
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
