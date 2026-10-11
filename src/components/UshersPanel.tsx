import React, { useEffect, useState } from 'react';
import { PasswordInput } from './PasswordInput';
import { getSupabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { loadLocalStore, saveLocalStore } from '../lib/portalDb';

/** Branch admins and pastors create usher accounts that can only scan and record check-ins. */
export const UshersPanel: React.FC<{ church: string; canAppointAdmins?: boolean }> = ({ church, canAppointAdmins = false }) => {
  const toast = useToast();
  const [ushers, setUshers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<'Usher' | 'Church Admin'>('Usher');

  const load = async () => {
    if (!church) return;
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. From local portal store
    try {
      const store = loadLocalStore();
      const localUsers = (store.tables.user_profiles || []).filter(
        (u: any) =>
          String(u.church_name || '').trim().toLowerCase() === church.trim().toLowerCase() &&
          (canAppointAdmins ? (u.role === 'Usher' || u.role === 'Church Admin') : u.role === 'Usher')
      );
      localUsers.forEach((u: any) => {
        const em = String(u.email || '').toLowerCase();
        if (em && !seen.has(em)) {
          seen.add(em);
          list.push(u);
        }
      });
    } catch {}

    // 2. From Supabase database
    try {
      const c: any = getSupabase();
      if (c) {
        const { data } = await c
          .from('user_profiles')
          .select('id, full_name, email, church_name, role')
          .in('role', canAppointAdmins ? ['Usher', 'Church Admin'] : ['Usher']);
        (data || [])
          .filter((u: any) => String(u.church_name || '').trim().toLowerCase() === church.trim().toLowerCase())
          .forEach((u: any) => {
            const em = String(u.email || '').toLowerCase();
            if (em && !seen.has(em)) {
              seen.add(em);
              list.push(u);
            }
          });
      }
    } catch {}

    setUshers(list);
  };

  useEffect(() => { load(); }, [church]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return toast.showError('Enter a name and a valid email.');
    if (password.length < 8) return toast.showError('Password must be at least 8 characters.');
    setBusy(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const assignedRole = canAppointAdmins ? role : 'Usher';

    // 1. Persist to local store immediately for instant local sign-in capability
    try {
      const store = loadLocalStore();
      const userRow = {
        id: `usr-usher-${Date.now()}`,
        username: cleanEmail,
        email: cleanEmail,
        full_name: cleanName,
        password_hash: password,
        role: assignedRole,
        church_name: church,
        admin_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const existingIdx = (store.tables.user_profiles || []).findIndex(
        (u: any) => String(u.email || '').toLowerCase() === cleanEmail
      );
      if (existingIdx >= 0) {
        store.tables.user_profiles[existingIdx] = { ...store.tables.user_profiles[existingIdx], ...userRow };
      } else {
        store.tables.user_profiles = [...(store.tables.user_profiles || []), userRow];
      }
      saveLocalStore(store);
    } catch {}

    // 2. Persist to Supabase database
    const c: any = getSupabase();
    let dbError = null;
    if (c) {
      const { error } = await c.from('user_profiles').upsert({
        username: cleanEmail,
        email: cleanEmail,
        full_name: cleanName,
        password_hash: password,
        role: assignedRole,
        church_name: church,
        admin_verified: true,
      }, { onConflict: 'email' });
      dbError = error;

      await c.from('church_admin_accounts').upsert({
        id: `ADM-${Date.now()}`,
        church_name: church,
        admin_name: cleanName,
        admin_email: cleanEmail,
        admin_phone: '+233 24 000 0000',
        role: assignedRole,
        status: 'Active',
        email_verified: true,
        password: password,
      }, { onConflict: 'admin_email' }).catch(() => {});
    }

    setBusy(false);
    if (dbError && !dbError.message?.includes('network')) {
      console.warn('Usher create DB warning:', dbError.message);
    }

    // Trigger welcome notification if possible
    if (c?.functions) {
      await c.functions.invoke('usher-welcome', {
        body: { email: cleanEmail, origin: window.location.origin },
        headers: { 'x-portal-session': localStorage.getItem('gcyc_portal_token') || '' },
      }).catch(() => {});
    }

    toast.showSuccess(`${assignedRole === 'Church Admin' ? 'Church admin' : 'Usher'} account created for ${cleanName}. They can now sign in on the main Sign In page.`);
    setName('');
    setEmail('');
    setPassword('');
    load();
  };

  const remove = async (u: any) => {
    if (!window.confirm(`Remove ${u.full_name || u.email}?`)) return;

    // 1. Remove from local store
    try {
      const store = loadLocalStore();
      const em = String(u.email || '').toLowerCase();
      store.tables.user_profiles = (store.tables.user_profiles || []).filter(
        (x: any) => String(x.email || '').toLowerCase() !== em && x.id !== u.id
      );
      saveLocalStore(store);
    } catch {}

    // 2. Remove from Supabase
    const c: any = getSupabase();
    if (c) {
      if (u.id) await c.from('user_profiles').delete().eq('id', u.id).catch(() => {});
      if (u.email) {
        await c.from('user_profiles').delete().ilike('email', u.email).catch(() => {});
        await c.from('church_admin_accounts').delete().ilike('admin_email', u.email).catch(() => {});
      }
    }

    toast.showInfo('Removed', `${u.full_name || u.email} was removed.`);
    load();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-headline font-bold text-base text-slate-900">
            {canAppointAdmins ? 'Branch Staff, Admins & Ushers' : 'Branch Ushers & Check-in Scanners'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {canAppointAdmins
              ? `Appoint church administrators to run ${church} and ushers who scan check-ins at services. All accounts use the main Sign In page.`
              : `Create ushers for ${church}. Ushers sign in on the main Sign In page to launch the QR scanner and record attendance.`}
          </p>
        </div>
        <span className="material-symbols-outlined text-blue-600 text-2xl">badge</span>
      </div>

      <form onSubmit={add} className={`grid gap-2.5 ${canAppointAdmins ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {canAppointAdmins && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            aria-label="Account type"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
          >
            <option value="Usher">Usher (Scanner only)</option>
            <option value="Church Admin">Church Admin</option>
          </select>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name (e.g. Sister Grace)"
          aria-label="Usher name"
          required
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600 focus:bg-white"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email address"
          aria-label="Usher email"
          required
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600 focus:bg-white"
        />
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ chars)"
          aria-label="Usher password"
          required
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl px-4 py-2 cursor-pointer disabled:opacity-60 transition-all flex items-center justify-center gap-1 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          <span>{busy ? 'Appointing…' : canAppointAdmins ? 'Appoint' : 'Add Usher'}</span>
        </button>
      </form>

      <div className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
        <div className="flex items-center justify-between pb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>Active Staff ({ushers.length})</span>
          <span>Role & Church</span>
        </div>
        {ushers.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No ushers appointed for {church} yet. Add an usher above to unlock scanner check-in for your service stations.
          </p>
        ) : (
          ushers.map((u) => (
            <div key={u.id || u.email} className="flex items-center justify-between py-2.5 px-2 text-xs hover:bg-white rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong className="block text-slate-900">{u.full_name || 'Staff Member'}</strong>
                  <span className="text-slate-500 text-[11px]">{u.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  u.role === 'Church Admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {u.role || 'Usher'}
                </span>
                <button
                  onClick={() => remove(u)}
                  className="text-rose-600 hover:text-rose-800 font-semibold p-1 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                  title="Remove staff account"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

