import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { PasswordInput } from './PasswordInput';
import { ChurchLogo } from './ChurchLogo';
import { rawPortal } from '../lib/rawPortal';

const DEV_TOKEN_KEY = 'cekb_dev_token';

interface Stats {
  churches: Array<{ name: string; status: string; members: number }>;
  totals: Record<string, number>;
  health: Record<string, number>;
}

const TOTAL_LABELS: Record<string, string> = {
  members: 'Members',
  leaders: 'Leaders',
  attendanceToday: 'Check-ins today',
  attendance7: 'Check-ins (7 days)',
  reports7: 'Cell reports (7 days)',
  pastors: 'Church pastors',
  admins: 'Church admins',
  ushers: 'Ushers',
  groupPastors: 'Group pastors',
};
const HEALTH_LABELS: Record<string, string> = {
  emailsSent7: 'Emails sent (7 days)',
  emailsFailed7: 'Emails failed (7 days)',
  activeSessions: 'Signed-in sessions',
};

export default function DeveloperPortal() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(DEV_TOKEN_KEY));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = async (t: string) => {
    const r = await rawPortal({ action: 'devStats' }, t);
    if (r?.data) setStats(r.data);
    else { sessionStorage.removeItem(DEV_TOKEN_KEY); setToken(null); }
  };

  useEffect(() => { if (token) load(token); }, [token]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await rawPortal({ action: 'devLogin', username, password }, null);
    setBusy(false);
    if (r?.success && r.token) { sessionStorage.setItem(DEV_TOKEN_KEY, r.token); setToken(r.token); setPassword(''); }
    else setError(r?.error || 'Sign-in failed.');
  };

  const logout = async () => {
    if (token) await rawPortal({ action: 'logout' }, token);
    sessionStorage.removeItem(DEV_TOKEN_KEY); setToken(null); setStats(null);
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <form onSubmit={login} className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <ChurchLogo />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">CEKB Group</p>
              <h1 className="text-2xl font-headline">Developer Sign In</h1>
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required
              className="w-full rounded-xl border border-input bg-background px-4 py-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Password</span>
            <PasswordInput value={password} onChange={(e: any) => setPassword(e.target.value)} autoComplete="current-password" required
              className="w-full rounded-xl border border-input bg-background px-4 py-3" />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign In'}</Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">CEKB Group</p>
            <h1 className="text-3xl font-headline">Developer Overview</h1>
            <p className="text-sm text-muted-foreground">Totals only — personal member and leader records are hidden from this account.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => token && load(token)}>Refresh</Button>
            <Button onClick={logout}>Sign out</Button>
          </div>
        </header>

        {!stats ? <p className="text-muted-foreground">Loading…</p> : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Tile label="Churches" value={stats.churches.length} featured />
              {Object.entries(TOTAL_LABELS).map(([k, l]) => <Tile key={k} label={l} value={stats.totals[k] ?? 0} />)}
            </section>
            <section>
              <h2 className="text-xl font-headline mb-3">System health</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(HEALTH_LABELS).map(([k, l]) => <Tile key={k} label={l} value={stats.health[k] ?? 0} />)}
              </div>
            </section>
            <section>
              <h2 className="text-xl font-headline mb-3">Churches</h2>
              <div className="rounded-3xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left"><tr><th className="p-3">Church</th><th className="p-3">Status</th><th className="p-3 text-right">Members</th></tr></thead>
                  <tbody>
                    {stats.churches.map((c) => (
                      <tr key={c.name} className="border-t border-border"><td className="p-3 font-semibold">{c.name}</td><td className="p-3">{c.status}</td><td className="p-3 text-right tabular-nums">{c.members}</td></tr>
                    ))}
                    {stats.churches.length === 0 && <tr><td colSpan={3} className="p-4 text-muted-foreground">No churches registered yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Tile({ label, value, featured }: { label: string; value: number; featured?: boolean }) {
  return (
    <div className={`rounded-3xl border border-border p-5 shadow-sm ${featured ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
      <p className={`text-xs uppercase tracking-wider ${featured ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
      <p className="mt-2 text-3xl font-stat tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
