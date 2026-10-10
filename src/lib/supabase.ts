import type { SupabaseClient } from '@supabase/supabase-js';
import { portalDb } from './portalDb';

// The backend is managed by Lovable Cloud. Tables are reachable only from
// secure server code, so the app talks to them through the portal data API.
export const SUPABASE_DEFAULT_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://bouwuqpzplazpwuwyphq.supabase.co';
export const SUPABASE_DEFAULT_ANON_KEY = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) || (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) || '';
export const SUPABASE_DEFAULT_PUBLISHABLE_KEY = SUPABASE_DEFAULT_ANON_KEY;

export const supabase = portalDb as unknown as SupabaseClient;

export const isSupabaseConfigured = Boolean(SUPABASE_DEFAULT_URL);

export function getSupabase(): SupabaseClient | null {
  return supabase;
}


// Credentials are managed by the platform; kept for backwards compatibility.
export function saveSupabaseCredentials(_url?: string, _key?: string): SupabaseClient | null {
  return supabase;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; latencyMs: number; message: string; details?: any }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, latencyMs: 0, message: 'Database client is not initialized.' };
  }

  const startTime = Date.now();
  try {
    const { data, error } = await client.from('churches').select('id, name').limit(1);
    const latencyMs = Date.now() - startTime;

    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          latencyMs,
          message: `Connected to the backend (${latencyMs}ms). Note: tables need to be initialized.`,
          details: error
        };
      }
      return { success: false, latencyMs, message: error.message || 'The backend returned an error response.', details: error };
    }

    return {
      success: true,
      latencyMs,
      message: `Successfully connected to the live database (${latencyMs}ms latency).`,
      details: data
    };
  } catch (err: any) {
    return { success: false, latencyMs: Date.now() - startTime, message: err?.message || 'Network error connecting to the database.', details: err };
  }
}
