import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

/** Branch admins create usher accounts that can only scan and record check-ins. */
export const UshersPanel: React.FC<{ church: string }> = ({ church }) => {
  const toast = useToast();
  const [ushers, setUshers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const c: any = getSupabase();
    if (!c) return;
    const { data } = await c.from('user_profiles').select('id, full_name, email, church_name, role').eq('role', 'Usher');
    setUshers((data || []).filter((u: any) => (u.church_name || '').toLowerCase() === church.toLowerCase()));
  };
  useEffect(() => { load(); }, [church]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return toast.showError('Enter a name and a valid email.');
    if (password.length < 8) return toast.showError('Password must be at least 8 characters.');
    setBusy(true);
    const c: any = getSupabase();
    const { error } = await c.from('user_profiles').insert({
      username: email.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      full_name: name.trim(),
      password_hash: password,
      role: 'Usher',
      church_name: church,
      admin_verified: true,
    });
    setBusy(false);
    if (error) return toast.showError(error.message || 'Could not create the usher.');
    toast.showSuccess(`Usher account created for ${name.trim()}.`);
    setName(''); setEmail(''); setPassword('');
    load();
  };

  const remove = async (u: any) => {
    if (!window.confirm(`Remove usher ${u.full_name}?`)) return;
    const c: any = getSupabase();
    await c.from('user_profiles').delete().eq('id', u.id);
    load();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="font-headline font-bold text-sm text-slate-900">Ushers</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">Ushers sign in on the Admin Login page and can only open the scanner and check people in for {church}.</p>
      <form onSubmit={add} className="grid sm:grid-cols-4 gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" aria-label="Usher name" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" aria-label="Usher email" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password (8+ chars)" aria-label="Usher password" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
        <button disabled={busy} className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl px-3 py-2 cursor-pointer disabled:opacity-60">{busy ? 'Adding…' : 'Add usher'}</button>
      </form>
      <div className="mt-3 divide-y divide-slate-100">
        {ushers.length === 0 ? <p className="text-xs text-slate-500 py-2">No ushers yet.</p> : ushers.map(u => (
          <div key={u.id} className="flex items-center justify-between py-2 text-xs">
            <span><span className="font-bold text-slate-900">{u.full_name}</span> · {u.email}</span>
            <button onClick={() => remove(u)} className="text-red-600 font-bold hover:underline cursor-pointer">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
};
