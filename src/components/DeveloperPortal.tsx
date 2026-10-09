import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { PasswordInput } from './PasswordInput';
import { ChurchLogo } from './ChurchLogo';
import { rawPortal } from '../lib/rawPortal';
import { FEATURES, FEATURE_ROLES, ROLE_LABELS, type FeatureMatrix } from '../lib/features';

const DEV_TOKEN_KEY = 'cekb_dev_token';
type Tab = 'overview' | 'churches' | 'features' | 'growth' | 'storage' | 'messaging' | 'audit' | 'health' | 'settings';
const NAV: { group: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  { group: 'Oversight', items: [
    { id: 'overview', label: 'Overview', icon: 'space_dashboard' },
    { id: 'churches', label: 'Churches', icon: 'church' },
    { id: 'features', label: 'Features', icon: 'toggle_on' },
    { id: 'growth', label: 'Growth & Usage', icon: 'trending_up' },
  ] },
  { group: 'Platform', items: [
    { id: 'storage', label: 'Database & Storage', icon: 'database' },
    { id: 'messaging', label: 'Messaging Health', icon: 'forward_to_inbox' },
    { id: 'audit', label: 'Audit Logs', icon: 'receipt_long' },
    { id: 'health', label: 'System Health', icon: 'monitor_heart' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ] },
];

const fmt = (n: number) => (n ?? 0).toLocaleString();
const bytes = (b: number) => b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
const when = (d?: string | null) => d ? new Date(d).toLocaleString() : '—';

export default function DeveloperPortal() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(DEV_TOKEN_KEY));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [a, setA] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async (t: string) => {
    const [s, an] = await Promise.all([rawPortal({ action: 'devStats' }, t), rawPortal({ action: 'devAnalytics' }, t)]);
    if (s?.data) { setStats(s.data); setA(an?.data || null); }
    else { sessionStorage.removeItem(DEV_TOKEN_KEY); setToken(null); }
  };
  useEffect(() => { if (token) load(token); }, [token]);

  const act = async (payload: Record<string, unknown>, msg: string) => {
    if (!token) return;
    const r = await rawPortal({ action: 'devAction', ...payload }, token);
    setNotice(r?.success ? msg : (r?.error?.message || r?.error || 'Action failed.'));
    setTimeout(() => setNotice(''), 3500);
    if (r?.success) load(token);
  };

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
    sessionStorage.removeItem(DEV_TOKEN_KEY); setToken(null); setStats(null); setA(null);
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
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required className="w-full rounded-xl border border-input bg-background px-4 py-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Password</span>
            <PasswordInput value={password} onChange={(e: any) => setPassword(e.target.value)} autoComplete="current-password" required className="w-full rounded-xl border border-input bg-background px-4 py-3" />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign In'}</Button>
        </form>
      </main>
    );
  }

  const title = NAV.flatMap((g) => g.items).find((i) => i.id === tab)?.label;
  return (
    <div className="dashboard-shell min-h-screen md:flex">
      <aside className={`dashboard-sidebar dev-sidebar ${menuOpen ? 'flex' : 'hidden'} md:flex flex-col`}>
        <div className="flex items-center gap-3 p-5">
          <ChurchLogo />
          <div><strong className="block font-headline">CEKB Console</strong><span className="sidebar-caption">Developer</span></div>
        </div>
        <nav className="sidebar-navigation flex-1" aria-label="Developer menu">
          {NAV.map((g) => (
            <div key={g.group} className="mb-3">
              <p className="sidebar-caption sidebar-section-label">{g.group}</p>
              {g.items.map((i) => (
                <Button key={i.id} variant="ghost" className="sidebar-menu-item" aria-current={tab === i.id ? 'page' : undefined} onClick={() => { setTab(i.id); setMenuOpen(false); }}>
                  <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">{i.icon}</span></span>
                  <span className="sidebar-menu-label">{i.label}</span>
                </Button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="sidebar-account-row">
            <span className="sidebar-avatar" aria-hidden="true">D</span>
            <div className="sidebar-account-details"><strong>Developer</strong><span>Totals only</span></div>
            <Button variant="ghost" className="sidebar-signout" onClick={logout} aria-label="Sign Out" title="Sign Out"><span className="material-symbols-outlined" aria-hidden="true">logout</span></Button>
          </div>
        </div>
      </aside>
      <main className="dashboard-workspace flex-1 min-w-0 p-5 md:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="secondary" className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"><span className="material-symbols-outlined">menu</span></Button>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Developer console</p>
              <h1 className="text-3xl font-headline">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notice && <span className="rounded-full bg-muted px-3 py-1 text-sm">{notice}</span>}
            <Button variant="secondary" onClick={() => token && load(token)}>Refresh</Button>
          </div>
        </header>
        {!stats ? <p className="text-muted-foreground">Loading…</p> : !a ? <p className="text-muted-foreground">Analytics are loading or unavailable — try Refresh.</p> : (
          <>
            {tab === 'overview' && <Overview s={stats} a={a} />}
            {tab === 'churches' && <Churches a={a} act={act} />}
            {tab === 'features' && <Features a={a} act={act} />}
            {tab === 'growth' && <Growth s={stats} a={a} />}
            {tab === 'storage' && <Storage a={a} />}
            {tab === 'messaging' && <Messaging a={a} act={act} />}
            {tab === 'audit' && <Audit a={a} />}
            {tab === 'health' && <Health s={stats} a={a} act={act} />}
            {tab === 'settings' && <Settings a={a} act={act} />}
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- building blocks ---------- */
function Tile({ label, value, hint, featured }: { label: string; value: React.ReactNode; hint?: string; featured?: boolean }) {
  return (
    <div className={`rounded-3xl border border-border p-5 shadow-sm ${featured ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
      <p className={`text-xs uppercase tracking-wider ${featured ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
      <p className="mt-2 text-3xl font-stat tabular-nums">{typeof value === 'number' ? fmt(value) : value}</p>
      {hint && <p className={`mt-1 text-xs ${featured ? 'opacity-80' : 'text-muted-foreground'}`}>{hint}</p>}
    </div>
  );
}
function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-headline">{title}</h2>{right}</div>
      {children}
    </section>
  );
}
function Bars({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((p, d, i) => (d.value > (data[p]?.value ?? -1) ? i : p), 0);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.label}: ${fmt(d.value)}`} className={`flex-1 rounded-t ${i === peak && d.value > 0 ? 'bg-primary' : 'bg-primary/40'}`} style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{data[0]?.label}</span>{data[peak]?.value > 0 && <span>Peak: {fmt(data[peak].value)} on {data[peak].label}</span>}<span>{data[data.length - 1]?.label}</span></div>
    </div>
  );
}
function HBar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span className="font-semibold truncate">{label}</span><span className="tabular-nums text-muted-foreground">{suffix ?? fmt(value)}</span></div>
      <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%` }} /></div>
    </div>
  );
}
function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>{head.map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="p-3">{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={head.length} className="p-4 text-muted-foreground">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
const Badge = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{children}</span>
);

/* ---------- sections ---------- */
function Overview({ s, a }: any) {
  const [range, setRange] = useState<30 | 90>(30);
  const series = a.series.slice(-range).map((d: any) => ({ label: d.date.slice(5), value: d.count }));
  const active = a.churches.filter((c: any) => c.active), inactive = a.churches.filter((c: any) => !c.active);
  const heavy = [...a.churches].sort((x: any, y: any) => y.rows - x.rows).slice(0, 5);
  const growth = a.growth.slice(-12);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Churches" value={a.churches.length} hint={`${active.length} active · ${inactive.length} inactive`} />
        <Tile label="Total members" value={s.totals.members} />
        <Tile label="Check-ins recorded" value={a.tables.attendance_records} hint={`${fmt(s.totals.attendanceToday)} today`} />
        <Tile label="Messages (30 days)" value={a.messaging.total30} hint={`${fmt(a.messaging.last24)} in last 24h`} />
      </div>
      <Card title="Check-in trend" right={<div className="flex gap-1">{[30, 90].map((r) => <Button key={r} variant={range === r ? 'default' : 'secondary'} size="sm" onClick={() => setRange(r as 30 | 90)}>{r} days</Button>)}</div>}>
        <Bars data={series} />
      </Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Church growth trajectory">
          {growth.length ? <Bars height={120} data={growth.map((g: any) => ({ label: g.month, value: g.members }))} /> : <p className="text-sm text-muted-foreground">No growth data yet.</p>}
          <p className="mt-2 text-xs text-muted-foreground">New members per month (last 12 months)</p>
        </Card>
        <Card title="Flagged registrations">
          {a.flagged.length ? <div className="space-y-2">{a.flagged.slice(0, 8).map((f: any, i: number) => <div key={i} className="flex justify-between text-sm"><span><strong>{f.role}</strong> · {f.church || 'No church'}</span><span className="text-muted-foreground">unverified since {new Date(f.since).toLocaleDateString()}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No registrations need attention.</p>}
        </Card>
        <Card title="Active vs inactive churches (30 days)">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm font-semibold mb-2">Active ({active.length})</p>{active.slice(0, 8).map((c: any) => <p key={c.name} className="text-sm truncate">{c.name}</p>)}</div>
            <div><p className="text-sm font-semibold mb-2 text-destructive">Inactive ({inactive.length})</p>{inactive.slice(0, 8).map((c: any) => <p key={c.name} className="text-sm truncate">{c.name}</p>)}</div>
          </div>
        </Card>
        <Card title="Storage-heavy churches">
          <div className="space-y-3">{heavy.map((c: any) => <HBar key={c.name} label={c.name} value={c.rows} max={heavy[0]?.rows} suffix={`${fmt(c.rows)} rows · ${bytes(c.estBytes)}`} />)}{!heavy.length && <p className="text-sm text-muted-foreground">No churches yet.</p>}</div>
        </Card>
      </div>
      <Card title="Recent outbound messages">
        <Table head={['Template', 'Count (30 days)']} empty="No messages sent yet." rows={Object.entries(a.messaging.byTemplate).sort((x: any, y: any) => y[1] - x[1]).slice(0, 8).map(([t, n]: any) => [t, fmt(n)])} />
      </Card>
    </div>
  );
}

function Churches({ a, act }: any) {
  const [q, setQ] = useState('');
  const list = a.churches.filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Registered churches" value={a.churches.length} />
        <Tile label="Active (30 days)" value={a.churches.filter((c: any) => c.active).length} />
        <Tile label="Inactive (30 days)" value={a.churches.filter((c: any) => !c.active).length} />
        <Tile label="Avg members / church" value={a.churches.length ? Math.round(a.churches.reduce((t: number, c: any) => t + c.members, 0) / a.churches.length) : 0} />
      </div>
      <Card title="Church registry" right={<input placeholder="Search church" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />}>
        <Table head={['Church', 'Status', 'Members', 'Leaders', 'Staff accounts', 'Check-ins (30d)', 'Last active', 'Control']} empty="No churches registered yet."
          rows={list.map((c: any) => [<strong>{c.name}</strong>, <Badge ok={c.status === 'Active'}>{c.status}</Badge>, fmt(c.members), fmt(c.leaders), fmt(c.staff), fmt(c.checkins30), c.lastActive || 'Never',
            <select className="rounded-lg border border-input bg-background px-2 py-1" value={c.status} onChange={(e) => act({ op: 'setChurchStatus', name: c.name, status: e.target.value }, `${c.name} set to ${e.target.value}`)}>
              {['Active', 'Inactive', 'Suspended'].map((s) => <option key={s}>{s}</option>)}</select>])} />
      </Card>
    </div>
  );
}

function Features({ a, act }: any) {
  const [m, setM] = useState<FeatureMatrix>(() => a.featureMatrix || {});
  const on = (r: string, f: string) => m[r]?.[f] !== false;
  const toggle = (r: string, f: string) => setM((p) => ({ ...p, [r]: { ...(p[r] || {}), [f]: !on(r, f) } }));
  return (
    <Card title="Feature entitlements by account type" right={<Button onClick={() => act({ op: 'saveSetting', key: 'feature_matrix', value: m }, 'Features saved')}>Save changes</Button>}>
      <p className="mb-4 text-sm text-muted-foreground">Unticked features are hidden from that account's menu entirely.</p>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="p-3 text-left">Feature</th>{FEATURE_ROLES.map((r) => <th key={r} className="p-3 text-center whitespace-nowrap">{ROLE_LABELS[r]}</th>)}</tr></thead>
          <tbody>{FEATURES.map((f) => (
            <tr key={f.id} className="border-t border-border"><td className="p-3 font-semibold">{f.label}</td>
              {FEATURE_ROLES.map((r) => <td key={r} className="p-3 text-center"><input type="checkbox" className="h-4 w-4 accent-primary" checked={on(r, f.id)} onChange={() => toggle(r, f.id)} aria-label={`${f.label} for ${ROLE_LABELS[r]}`} /></td>)}
            </tr>))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Growth({ s, a }: any) {
  const now = new Date(); const m = now.toISOString().slice(0, 7);
  const newThisMonth = a.churches.filter((c: any) => String(c.createdAt).startsWith(m)).length;
  const users = Object.values(a.roleCounts as Record<string, number>).reduce((t, n) => t + n, 0);
  const active = a.churches.filter((c: any) => c.active).length;
  const ratio = (x: number, y: number) => (y ? (x / y).toFixed(1) : '0');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Churches" value={a.churches.length} />
        <Tile label="New churches this month" value={newThisMonth} />
        <Tile label="Active churches" value={active} hint={`${a.churches.length ? Math.round((active / a.churches.length) * 100) : 0}% activation`} />
        <Tile label="Accounts on platform" value={users} />
        <Tile label="Members per leader" value={ratio(s.totals.members, s.totals.leaders)} />
        <Tile label="Members per church" value={ratio(s.totals.members, a.churches.length)} />
        <Tile label="Accounts per church" value={ratio(users, a.churches.length)} />
        <Tile label="Check-ins per member (90d)" value={ratio(a.series.reduce((t: number, d: any) => t + d.count, 0), s.totals.members)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="New churches per month">{a.growth.length ? <Bars height={140} data={a.growth.map((g: any) => ({ label: g.month, value: g.churches }))} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}</Card>
        <Card title="New members per month">{a.growth.length ? <Bars height={140} data={a.growth.map((g: any) => ({ label: g.month, value: g.members }))} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}</Card>
        <Card title="Accounts by type"><div className="space-y-3">{Object.entries(a.roleCounts).map(([r, n]: any) => <HBar key={r} label={ROLE_LABELS[r] || r} value={n} max={Math.max(...Object.values(a.roleCounts as Record<string, number>))} />)}</div></Card>
        <Card title="Most engaged churches (30d check-ins)"><div className="space-y-3">{[...a.churches].sort((x: any, y: any) => y.checkins30 - x.checkins30).slice(0, 6).map((c: any, _i: number, arr: any[]) => <HBar key={c.name} label={c.name} value={c.checkins30} max={arr[0].checkins30} />)}</div></Card>
      </div>
    </div>
  );
}

function Storage({ a }: any) {
  const tables = Object.entries(a.tables as Record<string, number>).sort((x, y) => y[1] - x[1]);
  const total = tables.reduce((t, [, n]) => t + n, 0);
  const sorted = [...a.churches].sort((x: any, y: any) => y.rows - x.rows);
  const [archived, setArchived] = useState('');
  const exportArchive = async () => {
    const pass = window.prompt('Choose a passphrase to encrypt this backup (keep it safe):');
    if (!pass) return;
    const payload = new TextEncoder().encode(JSON.stringify({ exportedAt: new Date().toISOString(), churches: a.churches, tables: a.tables, growth: a.growth }));
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
    const blob = new Blob([salt, iv, enc], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob); const el = document.createElement('a');
    el.href = url; el.download = `cekb-archive-${new Date().toISOString().slice(0, 10)}.enc`; el.click(); URL.revokeObjectURL(url);
    setArchived(new Date().toLocaleString());
  };
  const ok = a.integrity.orphanAtt === 0 && a.integrity.orphanMem === 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Total database rows" value={total} />
        <Tile label="Estimated size" value={bytes(total * 900)} />
        <Tile label="Church data rows" value={sorted.reduce((t: number, c: any) => t + c.rows, 0)} />
        <Tile label="Integrity" value={ok ? 'Healthy' : 'Needs review'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Table rows breakdown"><div className="space-y-3">{tables.map(([t, n]) => <HBar key={t} label={t.replace(/_/g, ' ')} value={n} max={tables[0][1]} />)}</div></Card>
        <Card title="Churches by storage footprint">
          <Table head={['Church', 'Rows', 'Est. size']} empty="No churches yet." rows={sorted.map((c: any) => [c.name, fmt(c.rows), bytes(c.estBytes)])} />
        </Card>
        <Card title="Database integrity & consistency">
          <div className="space-y-2 text-sm">
            <p className="flex justify-between"><span>Check-ins without a church link</span><Badge ok={!a.integrity.orphanAtt}>{fmt(a.integrity.orphanAtt)}</Badge></p>
            <p className="flex justify-between"><span>Members without a church link</span><Badge ok={!a.integrity.orphanMem}>{fmt(a.integrity.orphanMem)}</Badge></p>
            <p className="flex justify-between"><span>Expired sessions awaiting cleanup</span><Badge ok={a.integrity.expiredSessions < 50}>{fmt(a.integrity.expiredSessions)}</Badge></p>
            <p className="text-xs text-muted-foreground">Expired sessions are purged daily automatically; you can also purge them under System Health.</p>
          </div>
        </Card>
        <Card title="Encrypted archives">
          <p className="text-sm text-muted-foreground mb-3">Download an AES-256 encrypted backup of church-level totals. Personal records are never included.</p>
          <Button onClick={exportArchive}>Create encrypted archive</Button>
          {archived && <p className="mt-2 text-sm">Last archive created {archived}</p>}
        </Card>
      </div>
    </div>
  );
}

function Messaging({ a, act }: any) {
  const m = a.messaging;
  const rate = m.total30 ? Math.round((m.sent30 / m.total30) * 100) : 100;
  const [title, setTitle] = useState(''); const [message, setMessage] = useState('');
  const busiest = Object.entries(m.byChurch as Record<string, number>).sort((x, y) => y[1] - x[1]).slice(0, 6);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Delivery success" value={`${rate}%`} hint="last 30 days" />
        <Tile label="24-hour velocity" value={m.last24} hint="messages sent" />
        <Tile label="Queue (pending)" value={m.pending} />
        <Tile label="Delivery failures" value={m.failed30} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Email vs SMS (30 days)">
          <div className="space-y-3"><HBar label="Email" value={m.total30} max={Math.max(m.total30, m.sms30, 1)} /><HBar label="SMS (coming soon)" value={m.sms30} max={Math.max(m.total30, 1)} /></div>
        </Card>
        <Card title="Failure reasons">
          {Object.keys(m.reasons).length ? <div className="space-y-3">{Object.entries(m.reasons).map(([r, n]: any) => <HBar key={r} label={r} value={n} max={m.failed30} />)}</div> : <p className="text-sm text-muted-foreground">No failures — every message was delivered.</p>}
        </Card>
        <Card title="Busiest churches by volume">
          {busiest.length ? <div className="space-y-3">{busiest.map(([c, n]) => <HBar key={c} label={c} value={n} max={busiest[0][1]} />)}</div> : <p className="text-sm text-muted-foreground">No church-tagged messages yet.</p>}
        </Card>
        <Card title="Send announcement to all churches">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Sent as developer@gcycattendance.online</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. System upgrade" className="w-full rounded-xl border border-input bg-background px-4 py-2" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Message to every church" className="w-full rounded-xl border border-input bg-background px-4 py-2" />
            <Button disabled={!title.trim() || !message.trim()} onClick={() => { act({ op: 'broadcast', title, message }, 'Announcement sent'); setTitle(''); setMessage(''); }}>Send announcement</Button>
          </div>
        </Card>
      </div>
      <Card title="Recent delivery failures">
        <Table head={['When', 'Template', 'Status', 'Reason']} empty="No failed deliveries." rows={m.failures.map((f: any) => [when(f.at), f.template, <Badge ok={false}>{f.status}</Badge>, f.reason])} />
      </Card>
      <Card title="Announcements sent">
        <Table head={['When', 'Title', 'From', 'Audience']} empty="No announcements yet." rows={a.announcements.map((n: any) => [when(n.created_at), n.title, n.sender_name || '—', n.target_audience])} />
      </Card>
    </div>
  );
}

function Audit({ a }: any) {
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('');
  const cats = useMemo(() => ['All', ...Array.from(new Set(a.logs.map((l: any) => l.category)))] as string[], [a.logs]);
  const list = a.logs.filter((l: any) => (cat === 'All' || l.category === cat) && `${l.action} ${l.church || ''}`.toLowerCase().includes(q.toLowerCase()));
  const critical = a.logs.filter((l: any) => ['Security', 'System', 'Church', 'Settings'].includes(l.category)).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Events loaded" value={a.logs.length} />
        <Tile label="Critical actions" value={critical} />
        <Tile label="Developer actions" value={a.logs.filter((l: any) => l.actor === 'Developer').length} />
        <Tile label="Categories" value={cats.length - 1} />
      </div>
      <Card title="Event timeline" right={<div className="flex gap-2"><select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">{cats.map((c) => <option key={c}>{c}</option>)}</select><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 text-sm" /></div>}>
        <Table head={['When', 'Category', 'Event', 'Church', 'Actor']} empty="No events." rows={list.map((l: any) => [when(l.at), l.category, l.action, l.church || '—', l.actor])} />
        <p className="mt-2 text-xs text-muted-foreground">Events involving individual people are summarised so personal names stay private.</p>
      </Card>
    </div>
  );
}

function Health({ s, a, act }: any) {
  const [ping, setPing] = useState<number | null>(null);
  useEffect(() => { const t = performance.now(); rawPortal({ action: 'featureMatrix' }, null).then(() => setPing(Math.round(performance.now() - t))); }, []);
  const failRate = a.messaging.total30 ? a.messaging.failed30 / a.messaging.total30 : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Server response" value={ping == null ? '…' : `${ping} ms`} />
        <Tile label="Signed-in sessions" value={s.health.activeSessions} />
        <Tile label="Email queue" value={a.messaging.pending} />
        <Tile label="Emails failed (7d)" value={s.health.emailsFailed7} />
      </div>
      <Card title="Service status">
        <div className="space-y-2 text-sm">
          <p className="flex justify-between"><span>Data gateway</span><Badge ok={ping != null}>{ping != null ? 'Online' : 'Checking'}</Badge></p>
          <p className="flex justify-between"><span>Email delivery</span><Badge ok={failRate < 0.1}>{failRate < 0.1 ? 'Healthy' : 'Degraded'}</Badge></p>
          <p className="flex justify-between"><span>Database integrity</span><Badge ok={!a.integrity.orphanAtt && !a.integrity.orphanMem}>{!a.integrity.orphanAtt && !a.integrity.orphanMem ? 'Consistent' : 'Review'}</Badge></p>
          <p className="flex justify-between"><span>Session hygiene</span><Badge ok={a.integrity.expiredSessions < 50}>{fmt(a.integrity.expiredSessions)} expired</Badge></p>
        </div>
        <Button className="mt-4" onClick={() => act({ op: 'purgeSessions' }, 'Expired sessions purged')}>Purge expired sessions</Button>
      </Card>
    </div>
  );
}

function Settings({ a, act }: any) {
  const [p, setP] = useState<any>(() => ({ platformName: 'CEKB Group', tagline: 'Every presence counts.', supportEmail: 'support@gcycattendance.online', senderName: 'CE Korle Bu', primaryColor: '#000f22', maintenance: false, allowRegistrations: true, allowLeaderSignup: true, plan: 'Free', maxChurches: 100, ...(a.platform || {}) }));
  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const field = (k: string, label: string, type = 'text') => (
    <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span>
      <input type={type} value={p[k] ?? ''} onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-2" /></label>
  );
  const toggle = (k: string, label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" className="h-4 w-4 accent-primary" checked={!!p[k]} onChange={(e) => set(k, e.target.checked)} /></label>
  );
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Profile & security">
          <div className="space-y-2 text-sm">
            <p>Signed in as <strong>Developer</strong> (totals-only access).</p>
            <p className="text-muted-foreground">Username and password are stored as protected server secrets. Sessions end when this tab closes.</p>
            <p className="text-muted-foreground">Sign-in attempts are rate-limited and every sign-in is recorded in the audit log.</p>
          </div>
        </Card>
        <Card title="Platform identity">{<div className="space-y-3">{field('platformName', 'Platform name')}{field('tagline', 'Tagline')}{field('supportEmail', 'Support email', 'email')}</div>}</Card>
        <Card title="Platform branding">{<div className="space-y-3">{field('primaryColor', 'Primary colour', 'color')}{field('senderName', 'Email sender name')}</div>}</Card>
        <Card title="Global autonomy & controls"><div className="space-y-3">{toggle('maintenance', 'Maintenance mode')}{toggle('allowRegistrations', 'Allow new church registrations')}{toggle('allowLeaderSignup', 'Allow leader sign-up')}</div></Card>
        <Card title="Commercial plans"><div className="space-y-3">
          <label className="block space-y-1"><span className="text-sm font-semibold">Current plan</span>
            <select value={p.plan} onChange={(e) => set('plan', e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-2">{['Free', 'Standard', 'Premium', 'Enterprise'].map((x) => <option key={x}>{x}</option>)}</select></label>
          {field('maxChurches', 'Church limit', 'number')}</div></Card>
        <Card title="System emails"><div className="space-y-2 text-sm">
          <p>Outgoing sender: <strong>CE Korle Bu &lt;support@gcycattendance.online&gt;</strong></p>
          <p>Developer announcements: <strong>developer@gcycattendance.online</strong></p>
          <p className="text-muted-foreground">Templates: sign-up, verification, password reset, sign-in code, QR passes, birthday reminders, weekly summary, report reminders, staff appointments.</p>
        </div></Card>
      </div>
      <Button onClick={() => act({ op: 'saveSetting', key: 'platform_config', value: p }, 'Settings saved')}>Save settings</Button>
    </div>
  );
}
