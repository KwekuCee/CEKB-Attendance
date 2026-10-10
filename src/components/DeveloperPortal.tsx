import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from './Button';
import { PasswordInput } from './PasswordInput';
import { ChurchLogo } from './ChurchLogo';
import { rawPortal } from '../lib/rawPortal';
import { FEATURES, ROLE_LABELS, FEATURE_ROLES, isFeatureOn, type FeatureMatrix } from '../lib/features';
import { SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL } from '../data/supabase_schema';

const DEV_TOKEN_KEY = 'cekb_dev_token';

type Tab =
  | 'overview'
  | 'churches'
  | 'registrations'
  | 'growth'
  | 'messaging'
  | 'sms'
  | 'services'
  | 'storage'
  | 'audit'
  | 'health'
  | 'settings';

const NAV: { group: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    group: 'Oversight',
    items: [
      { id: 'overview', label: 'Overview', icon: 'space_dashboard' },
      { id: 'churches', label: 'Churches & Branches', icon: 'church' },
      { id: 'registrations', label: 'Registrations & Approvals', icon: 'how_to_reg' },
      { id: 'growth', label: 'Growth & Analytics', icon: 'trending_up' },
    ],
  },
  {
    group: 'Communications',
    items: [
      { id: 'messaging', label: 'Live Message Log', icon: 'mark_email_read' },
      { id: 'sms', label: 'SMS Gateway & Templates', icon: 'sms' },
    ],
  },
  {
    group: 'Platform & Operations',
    items: [
      { id: 'services', label: 'Service Programs', icon: 'event' },
      { id: 'storage', label: 'Database & SQL Schema', icon: 'database' },
      { id: 'audit', label: 'Audit Logs', icon: 'receipt_long' },
      { id: 'health', label: 'System Health', icon: 'monitor_heart' },
      { id: 'settings', label: 'Settings & Matrix', icon: 'settings' },
    ],
  },
];

const fmt = (n: number) => (n ?? 0).toLocaleString();
const bytes = (b: number) =>
  b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
const when = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');

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
    const [s, an] = await Promise.all([
      rawPortal({ action: 'devStats' }, t),
      rawPortal({ action: 'devAnalytics' }, t),
    ]);
    if (s?.data) {
      setStats(s.data);
      setA(an?.data || null);
    } else {
      sessionStorage.removeItem(DEV_TOKEN_KEY);
      setToken(null);
    }
  };

  useEffect(() => {
    if (token) load(token);
  }, [token]);

  const act = async (payload: Record<string, unknown>, msg: string) => {
    if (!token) return;
    const r = await rawPortal({ action: 'devAction', ...payload }, token);
    const text = r?.success ? msg : r?.error?.message || r?.error || 'Action failed.';
    setNotice(text);
    setTimeout(() => setNotice(''), 3500);
    if (r?.success) load(token);
    return r;
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await rawPortal({ action: 'devLogin', username, password }, null);
    setBusy(false);
    if (r?.success && r.token) {
      sessionStorage.setItem(DEV_TOKEN_KEY, r.token);
      setToken(r.token);
      setPassword('');
    } else {
      setError(r?.error || 'Sign-in failed.');
    }
  };

  const logout = async () => {
    if (token) await rawPortal({ action: 'logout' }, token);
    sessionStorage.removeItem(DEV_TOKEN_KEY);
    setToken(null);
    setStats(null);
    setA(null);
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-xl space-y-5"
        >
          <div className="flex items-center gap-3">
            <ChurchLogo />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">CEKB Group</p>
              <h1 className="text-2xl font-headline">Developer Sign In</h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Administrative console for platform operations, churches management, approvals, SMS, and database maintenance.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Password</span>
            <PasswordInput
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign In to Console'}
          </Button>
        </form>
      </main>
    );
  }

  const title = NAV.flatMap((g) => g.items).find((i) => i.id === tab)?.label;

  return (
    <div className="dashboard-shell dev-shell min-h-screen">
      {menuOpen && (
        <div
          className="sidebar-backdrop fixed inset-0 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside aria-label="Developer navigation" className={`dashboard-sidebar dev-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="dev-brand">
          <ChurchLogo />
          <div>
            <strong>CEKB Console</strong>
            <span className="sidebar-caption">Developer Oversight</span>
          </div>
        </div>
        <nav className="sidebar-navigation flex-1" aria-label="Developer menu">
          {NAV.map((g) => (
            <div key={g.group} className="mb-3">
              <p className="sidebar-caption sidebar-section-label">{g.group}</p>
              {g.items.map((i) => (
                <Button
                  key={i.id}
                  variant="ghost"
                  className="sidebar-menu-item"
                  aria-current={tab === i.id ? 'page' : undefined}
                  onClick={() => {
                    setTab(i.id);
                    setMenuOpen(false);
                  }}
                >
                  <span className="sidebar-menu-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {i.icon}
                    </span>
                  </span>
                  <span className="sidebar-menu-label">{i.label}</span>
                </Button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="sidebar-account-row">
            <span className="sidebar-avatar" aria-hidden="true">D</span>
            <div className="sidebar-account-details">
              <strong>Developer</strong>
              <span>Full Platform Autonomy</span>
            </div>
            <Button
              variant="ghost"
              className="sidebar-signout"
              onClick={logout}
              aria-label="Sign Out"
              title="Sign Out"
            >
              <span className="material-symbols-outlined" aria-hidden="true">logout</span>
            </Button>
          </div>
        </div>
      </aside>

      <main className="dashboard-workspace dev-workspace min-w-0 p-5 md:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </Button>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Developer Console</p>
              <h1 className="text-3xl font-headline">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notice && (
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-sm animate-pulse">
                {notice}
              </span>
            )}
            <Button variant="secondary" onClick={() => token && load(token)}>
              <span className="material-symbols-outlined mr-1 text-base">refresh</span>
              Refresh
            </Button>
          </div>
        </header>

        {!stats ? (
          <div className="p-12 text-center text-muted-foreground">Loading console metrics…</div>
        ) : !a ? (
          <div className="p-12 text-center text-muted-foreground">
            Analytics are loading or unavailable — click Refresh above.
          </div>
        ) : (
          <>
            {tab === 'overview' && <Overview s={stats} a={a} setTab={setTab} />}
            {tab === 'churches' && <Churches a={a} act={act} />}
            {tab === 'registrations' && <Registrations a={a} act={act} />}
            {tab === 'growth' && <Growth s={stats} a={a} />}
            {tab === 'messaging' && <Messaging a={a} act={act} />}
            {tab === 'sms' && <SmsHub a={a} act={act} />}
            {tab === 'services' && <ServicesManager a={a} act={act} />}
            {tab === 'storage' && (
              <Storage
                a={a}
                token={token}
                reload={() => token && load(token)}
                notify={(m: string) => {
                  setNotice(m);
                  setTimeout(() => setNotice(''), 4000);
                }}
              />
            )}
            {tab === 'audit' && <Audit a={a} />}
            {tab === 'health' && <Health s={stats} a={a} act={act} />}
            {tab === 'settings' && <Settings a={a} act={act} />}
          </>
        )}
      </main>
    </div>
  );
}

/* ========================================================================== */
/*                               BUILDING BLOCKS                              */
/* ========================================================================== */

function Tile({
  label,
  value,
  hint,
  featured,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-border p-5 shadow-sm transition-all ${
        featured ? 'bg-primary text-primary-foreground' : 'bg-card'
      }`}
    >
      <p className={`text-xs uppercase tracking-wider ${featured ? 'opacity-80' : 'text-muted-foreground'}`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-stat tabular-nums">
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {hint && <p className={`mt-1 text-xs ${featured ? 'opacity-80' : 'text-muted-foreground'}`}>{hint}</p>}
    </div>
  );
}

function Card({
  title,
  children,
  right,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-headline">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function SmoothLine({
  series,
  height = 220,
  format = fmt,
}: {
  series: { name: string; data: { label: string; value: number }[] }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const W = 800,
    H = height,
    P = { l: 40, r: 12, t: 14, b: 26 };
  const n = Math.max(1, ...series.map((s) => s.data.length));
  const max = Math.max(1, ...series.flatMap((s) => s.data.map((d) => d.value)));
  const x = (i: number) => P.l + (n === 1 ? 0 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const path = (d: { value: number }[]) =>
    d
      .map((p, i) => {
        if (i === 0) return `M${x(0)},${y(p.value)}`;
        const p0 = d[Math.max(0, i - 2)],
          p1 = d[i - 1],
          p2 = p,
          p3 = d[Math.min(d.length - 1, i + 1)];
        const c1x = x(i - 1) + (x(i) - x(Math.max(0, i - 2))) / 6,
          c1y = y(p1.value) + (y(p2.value) - y(p0.value)) / 6;
        const c2x = x(i) - (x(Math.min(d.length - 1, i + 1)) - x(i - 1)) / 6,
          c2y = y(p2.value) - (y(p3.value) - y(p1.value)) / 6;
        return `C${c1x},${Math.min(H - P.b, c1y)} ${c2x},${Math.min(H - P.b, c2y)} ${x(i)},${y(p2.value)}`;
      })
      .join(' ');
  const [hover, setHover] = useState<number | null>(null);
  const colors = ['hsl(var(--primary))', 'hsl(var(--navigation))', 'hsl(var(--muted-foreground))'];
  const labels = series[0]?.data || [];
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const peakIdx = labels.reduce((p, d, i) => (d.value > (labels[p]?.value ?? -1) ? i : p), 0);
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(
            Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1)))),
          );
        }}
      >
        <defs>
          {series.map((_, k) => (
            <linearGradient key={k} id={`dev-fill-${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colors[k % 3]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={colors[k % 3]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeDasharray="4 6" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">
              {format(t)}
            </text>
          </g>
        ))}
        {series.map((s, k) =>
          s.data.length > 0 && (
            <g key={s.name}>
              {k === 0 && (
                <path
                  d={`${path(s.data)} L${x(s.data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`}
                  fill={`url(#dev-fill-${k})`}
                />
              )}
              <path
                d={path(s.data)}
                fill="none"
                stroke={colors[k % 3]}
                strokeWidth={k === 0 ? 3 : 2}
                strokeDasharray={k === 0 ? undefined : '6 5'}
                strokeLinecap="round"
              />
            </g>
          ),
        )}
        {labels[peakIdx]?.value > 0 && (
          <circle
            cx={x(peakIdx)}
            cy={y(labels[peakIdx].value)}
            r="5"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--card))"
            strokeWidth="2"
          />
        )}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="hsl(var(--border))" />
            {series.map(
              (s, k) =>
                s.data[hover] && (
                  <circle key={k} cx={x(hover)} cy={y(s.data[hover].value)} r="4" fill={colors[k % 3]} />
                ),
            )}
          </g>
        )}
        {[0, Math.floor((n - 1) / 2), n - 1].map(
          (i) =>
            labels[i] && (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                fontSize="11"
                fill="hsl(var(--muted-foreground))"
              >
                {labels[i].label}
              </text>
            ),
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex gap-3">
          {series.map((s, k) => (
            <span key={s.name} className="flex items-center gap-1">
              <span className="inline-block h-2 w-4 rounded-full" style={{ background: colors[k % 3] }} />
              {s.name}
            </span>
          ))}
        </div>
        <span>
          {hover != null && labels[hover]
            ? `${labels[hover].label}: ${series
                .map((s) => `${s.name} ${format(s.data[hover]?.value ?? 0)}`)
                .join(' · ')}`
            : labels[peakIdx]?.value > 0
            ? `Peak ${format(labels[peakIdx].value)} on ${labels[peakIdx].label}`
            : 'No activity yet'}
        </span>
      </div>
    </div>
  );
}

function Donut({ parts }: { parts: { label: string; value: number }[] }) {
  const total = Math.max(1, parts.reduce((t, p) => t + p.value, 0));
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--navigation))',
    'hsl(var(--muted-foreground))',
    'hsl(var(--primary) / 0.45)',
    'hsl(var(--border))',
  ];
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 42 42" className="h-36 w-36 -rotate-90">
        {parts.map((p, i) => {
          const len = (p.value / total) * 100;
          const el = (
            <circle
              key={p.label}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={colors[i % 5]}
              strokeWidth="6"
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="space-y-2 text-sm">
        {parts.map((p, i) => (
          <p key={p.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: colors[i % 5] }} />
            <span className="font-semibold">{p.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {fmt(p.value)} · {Math.round((p.value / total) * 100)}%
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function HBar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-semibold truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground">{suffix ?? fmt(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-3 whitespace-nowrap font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
              {r.map((c, j) => (
                <td key={j} className="p-3">
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="p-6 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const Badge = ({
  ok,
  variant,
  children,
}: {
  ok?: boolean;
  variant?: 'primary' | 'destructive' | 'warning' | 'neutral';
  children: React.ReactNode;
}) => {
  let cls = 'bg-primary/15 text-primary';
  if (variant === 'destructive' || ok === false) cls = 'bg-destructive/15 text-destructive';
  else if (variant === 'warning') cls = 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  else if (variant === 'neutral') cls = 'bg-muted text-muted-foreground';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
};

/* ========================================================================== */
/*                                1. OVERVIEW                                 */
/* ========================================================================== */

function Overview({ s, a, setTab }: any) {
  const [range, setRange] = useState<30 | 90>(30);
  const series = a.series.slice(-range).map((d: any) => ({ label: d.date.slice(5), value: d.count }));
  const active = a.churches.filter((c: any) => c.active),
    inactive = a.churches.filter((c: any) => !c.active);
  const heavy = [...a.churches].sort((x: any, y: any) => y.rows - x.rows).slice(0, 5);
  const growth = a.growth.slice(-12);
  const pendingCount = (a.pendingRegistrations || []).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          featured
          label="Registered Churches"
          value={a.churches.length}
          hint={`${active.length} active · ${inactive.length} inactive`}
        />
        <Tile label="Total Platform Members" value={s.totals.members} />
        <Tile
          label="Check-ins Recorded"
          value={a.tables.attendance_records}
          hint={`${fmt(s.totals.attendanceToday)} today`}
        />
        <Tile
          label="Messages (30 days)"
          value={a.messaging.total30}
          hint={`${fmt(a.messaging.last24)} in last 24h`}
        />
      </div>

      {pendingCount > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">
              pending_actions
            </span>
            <div>
              <p className="font-semibold text-sm">
                {pendingCount} Registration{pendingCount > 1 ? 's' : ''} Awaiting Approval
              </p>
              <p className="text-xs text-muted-foreground">
                Staff or leader registrations pending email verification. You can configure and approve them instantly.
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={() => setTab('registrations')}>
            Review & Approve Registrations
          </Button>
        </div>
      )}

      <Card
        title="Check-in trend"
        right={
          <div className="flex gap-1">
            {[30, 90].map((r) => (
              <Button
                key={r}
                variant={range === r ? 'primary' : 'secondary'}
                onClick={() => setRange(r as 30 | 90)}
              >
                {r} days
              </Button>
            ))}
          </div>
        }
      >
        <SmoothLine series={[{ name: 'Check-ins', data: series }]} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Church growth trajectory">
          {growth.length ? (
            <SmoothLine
              height={170}
              series={[{ name: 'New members', data: growth.map((g: any) => ({ label: g.month, value: g.members })) }]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No growth data yet.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">New members per month (last 12 months)</p>
        </Card>

        <Card
          title="Unverified registrations queue"
          right={
            <Button variant="ghost" onClick={() => setTab('registrations')}>
              View all ({pendingCount})
            </Button>
          }
        >
          {(a.pendingRegistrations || []).length ? (
            <div className="space-y-2.5">
              {(a.pendingRegistrations || []).slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 rounded-xl bg-muted/40">
                  <div>
                    <span className="font-semibold">{f.fullName || f.username || f.email}</span>
                    <span className="text-xs text-muted-foreground ml-2">({f.role})</span>
                    <p className="text-xs text-muted-foreground">{f.church || 'Unassigned branch'}</p>
                  </div>
                  <Badge variant="warning">Verification Pending</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No registrations need attention.</p>
          )}
        </Card>

        <Card title="Active vs inactive churches (30 days)">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold mb-2">Active ({active.length})</p>
              {active.slice(0, 8).map((c: any) => (
                <p key={c.name} className="text-sm truncate">
                  {c.name}
                </p>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-destructive">Inactive ({inactive.length})</p>
              {inactive.slice(0, 8).map((c: any) => (
                <p key={c.name} className="text-sm truncate">
                  {c.name}
                </p>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Storage-heavy churches">
          <div className="space-y-3">
            {heavy.map((c: any) => (
              <HBar
                key={c.name}
                label={c.name}
                value={c.rows}
                max={heavy[0]?.rows}
                suffix={`${fmt(c.rows)} rows · ${bytes(c.estBytes)}`}
              />
            ))}
            {!heavy.length && <p className="text-sm text-muted-foreground">No churches yet.</p>}
          </div>
        </Card>
      </div>

      <Card
        title="Recent outbound messages"
        right={
          <Button variant="ghost" onClick={() => setTab('messaging')}>
            Open message log
          </Button>
        }
      >
        <Table
          head={['Template', 'Count (30 days)']}
          empty="No messages sent yet."
          rows={Object.entries(a.messaging.byTemplate)
            .sort((x: any, y: any) => y[1] - x[1])
            .slice(0, 8)
            .map(([t, n]: any) => [t, fmt(n)])}
        />
      </Card>
    </div>
  );
}

/* ========================================================================== */
/*                     2. CHURCHES & BRANCHES (FULL CRUD)                     */
/* ========================================================================== */

function Churches({ a, act }: any) {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [editChurch, setEditChurch] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [pastor, setPastor] = useState('');
  const [zone, setZone] = useState('Zone 1 (Korle Bu)');
  const [status, setStatus] = useState('Active');

  const list = a.churches.filter((c: any) => {
    const matchQ =
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      (c.pastor && c.pastor.toLowerCase().includes(q.toLowerCase())) ||
      (c.zone && c.zone.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchQ && matchStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await act(
      { op: 'createChurch', name: name.trim(), pastor_name: pastor.trim(), zone, status },
      `Created church "${name.trim()}"`,
    );
    setBusy(false);
    setShowCreate(false);
    setName('');
    setPastor('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChurch) return;
    setBusy(true);
    await act(
      {
        op: 'updateChurch',
        id: editChurch.id,
        name: editChurch.name,
        newName: editChurch.name,
        pastor_name: editChurch.pastor,
        zone: editChurch.zone,
        status: editChurch.status,
      },
      `Updated church "${editChurch.name}"`,
    );
    setBusy(false);
    setEditChurch(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    await act(
      { op: 'deleteChurch', id: deleteTarget.id, name: deleteTarget.name },
      `Deleted church "${deleteTarget.name}"`,
    );
    setBusy(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Registered churches" value={a.churches.length} />
        <Tile label="Active (30 days)" value={a.churches.filter((c: any) => c.active).length} />
        <Tile label="Inactive (30 days)" value={a.churches.filter((c: any) => !c.active).length} />
        <Tile
          label="Avg members / church"
          value={
            a.churches.length
              ? Math.round(a.churches.reduce((t: number, c: any) => t + c.members, 0) / a.churches.length)
              : 0
          }
        />
      </div>

      <Card
        title="Church directory & branch management"
        subtitle="Full administrative autonomy: add new branches, configure pastors and zones, delete decommissioned churches, and recount membership."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => act({ op: 'recalculateChurchCounts' }, 'Member counts recalculated')}
              title="Recalculate member totals from database"
            >
              <span className="material-symbols-outlined text-base mr-1">sync</span>
              Sync Counts
            </Button>
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <span className="material-symbols-outlined text-base mr-1">add</span>
              Add Church Branch
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            placeholder="Search church, pastor, zone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-input bg-background px-4 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active only</option>
            <option value="Inactive">Inactive only</option>
            <option value="Suspended">Suspended only</option>
          </select>
        </div>

        <Table
          head={['Church & Zone', 'Pastor in Charge', 'Status', 'Members', 'Leaders', 'Staff', 'Check-ins (30d)', 'Actions']}
          empty="No churches match your filter."
          rows={list.map((c: any) => [
            <div>
              <strong className="block">{c.name}</strong>
              <span className="text-xs text-muted-foreground">{c.zone || 'Zone 1 (Korle Bu)'}</span>
            </div>,
            c.pastor || 'Pastor in Charge',
            <select
              className="rounded-lg border border-input bg-background px-2 py-1 text-xs font-semibold"
              value={c.status}
              onChange={(e) =>
                act(
                  { op: 'setChurchStatus', name: c.name, status: e.target.value },
                  `${c.name} status updated to ${e.target.value}`,
                )
              }
            >
              {['Active', 'Inactive', 'Suspended'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>,
            fmt(c.members),
            fmt(c.leaders),
            fmt(c.staff),
            fmt(c.checkins30),
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                onClick={() => setEditChurch({ ...c })}
                title="Edit church details"
              >
                <span className="material-symbols-outlined text-sm mr-1">edit</span>
                Edit
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteTarget(c)}
                title="Delete church"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </Button>
            </div>,
          ])}
        />
      </Card>

      {/* Modal: Create Church */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">Add Church Branch</h3>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                ✕
              </Button>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Church Name *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CE Korle Bu Branch 3"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Pastor in Charge</span>
              <input
                value={pastor}
                onChange={(e) => setPastor(e.target.value)}
                placeholder="e.g. Pastor John Doe"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Zone</span>
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="e.g. Zone 1 (Korle Bu)"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? 'Creating…' : 'Create Branch'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Church */}
      {editChurch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleUpdate}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">Edit Church Branch</h3>
              <Button variant="ghost" onClick={() => setEditChurch(null)}>
                ✕
              </Button>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Church Name *</span>
              <input
                required
                value={editChurch.name}
                onChange={(e) => setEditChurch({ ...editChurch, name: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Pastor in Charge</span>
              <input
                value={editChurch.pastor || ''}
                onChange={(e) => setEditChurch({ ...editChurch, pastor: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Zone</span>
              <input
                value={editChurch.zone || ''}
                onChange={(e) => setEditChurch({ ...editChurch, zone: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Status</span>
              <select
                value={editChurch.status || 'Active'}
                onChange={(e) => setEditChurch({ ...editChurch, status: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditChurch(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !editChurch.name.trim()}>
                {busy ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Delete Church Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-xl font-headline">Delete Church Branch</h3>
            </div>
            <p className="text-sm">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              <strong>Safety Cascade Active:</strong> Associated members and leaders will be safely unlinked from this branch so no orphan records or foreign key crashes occur.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={busy}
                onClick={handleDelete}
              >
                {busy ? 'Deleting…' : 'Yes, Delete Church'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*               3. REGISTRATIONS & UNVERIFIED APPROVAL QUEUE                 */
/* ========================================================================== */

function Registrations({ a, act }: any) {
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selected, setSelected] = useState<any>(null); // For configure & approve modal
  const [pwdTarget, setPwdTarget] = useState<any>(null); // For set password modal
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);

  // Form states for configure modal
  const [cfgName, setCfgName] = useState('');
  const [cfgRole, setCfgRole] = useState('');
  const [cfgChurch, setCfgChurch] = useState('');
  const [cfgEmail, setCfgEmail] = useState('');
  const [cfgPhone, setCfgPhone] = useState('');

  const registrations = (a.pendingRegistrations || []).filter((r: any) => {
    const matchQ =
      (r.fullName && r.fullName.toLowerCase().includes(q.toLowerCase())) ||
      (r.email && r.email.toLowerCase().includes(q.toLowerCase())) ||
      (r.username && r.username.toLowerCase().includes(q.toLowerCase())) ||
      (r.church && r.church.toLowerCase().includes(q.toLowerCase()));
    const matchRole = roleFilter === 'All' || r.role === roleFilter;
    return matchQ && matchRole;
  });

  const openConfigure = (r: any) => {
    setSelected(r);
    setCfgName(r.fullName || '');
    setCfgRole(r.role || 'Leader');
    setCfgChurch(r.church || '');
    setCfgEmail(r.email || '');
    setCfgPhone(r.phone || '');
  };

  const handleSaveAndApprove = async (approveNow: boolean) => {
    if (!selected) return;
    setBusy(true);
    await act(
      {
        op: 'updateRegistration',
        id: selected.id,
        email: selected.email,
        fullName: cfgName,
        role: cfgRole,
        church: cfgChurch,
        phone: cfgPhone,
        verified: approveNow,
      },
      approveNow ? `Approved & activated account for ${cfgName || cfgEmail}` : `Saved configuration for ${cfgName || cfgEmail}`,
    );
    setBusy(false);
    setSelected(null);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget || !newPwd.trim()) return;
    setBusy(true);
    await act(
      {
        op: 'setPasswordRegistration',
        id: pwdTarget.id,
        email: pwdTarget.email,
        password: newPwd.trim(),
      },
      `Assigned password and activated account for ${pwdTarget.email}`,
    );
    setBusy(false);
    setPwdTarget(null);
    setNewPwd('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          featured
          label="Unverified Accounts"
          value={(a.pendingRegistrations || []).length}
          hint="Awaiting verification or approval"
        />
        <Tile
          label="Staff & Pastors"
          value={
            (a.pendingRegistrations || []).filter((r: any) =>
              ['Church Pastor', 'Church Admin', 'Superadmin'].includes(r.role),
            ).length
          }
        />
        <Tile
          label="Leaders & Ushers"
          value={
            (a.pendingRegistrations || []).filter((r: any) => ['Leader', 'Usher'].includes(r.role)).length
          }
        />
        <Tile
          label="Oldest Pending"
          value={
            (a.pendingRegistrations || []).length
              ? `${Math.round(
                  (Date.now() -
                    new Date(
                      (a.pendingRegistrations || []).sort(
                        (x: any, y: any) => new Date(x.since).getTime() - new Date(y.since).getTime(),
                      )[0]?.since || Date.now(),
                    ).getTime()) /
                    864e5,
                )}d`
              : '0d'
          }
        />
      </div>

      <Card
        title="Unverified registrations & manual approval desk"
        subtitle="Full autonomy to resolve unclicked verification links, configure correct church assignments, appoint roles, reset initial passwords, or reject invalid sign-ups."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            placeholder="Search by name, email, username, or church…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-input bg-background px-4 py-2 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="All">All Roles</option>
            <option value="Church Pastor">Church Pastor</option>
            <option value="Church Admin">Church Admin</option>
            <option value="Leader">Leader</option>
            <option value="Usher">Usher</option>
          </select>
        </div>

        <Table
          head={['Account', 'Role', 'Assigned Church', 'Contact', 'Registered', 'Actions']}
          empty="No pending unverified registrations right now. All accounts are verified!"
          rows={registrations.map((r: any) => [
            <div>
              <strong className="block">{r.fullName || r.username || 'Unnamed'}</strong>
              <span className="text-xs text-muted-foreground">{r.email}</span>
            </div>,
            <Badge variant="warning">{r.role}</Badge>,
            r.church || <span className="text-muted-foreground italic">None assigned</span>,
            <div className="text-xs">
              <p>{r.email}</p>
              {r.phone && <p className="text-muted-foreground">{r.phone}</p>}
            </div>,
            when(r.since),
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="primary"
                className="px-2.5 py-1 text-xs"
                onClick={() => openConfigure(r)}
                title="Configure details and approve account"
              >
                <span className="material-symbols-outlined text-sm mr-1">tune</span>
                Configure & Approve
              </Button>
              <Button
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                onClick={() =>
                  act(
                    { op: 'approveRegistration', id: r.id, email: r.email },
                    `Approved ${r.fullName || r.email}`,
                  )
                }
                title="Directly approve without editing"
              >
                <span className="material-symbols-outlined text-sm mr-1">check</span>
                Approve
              </Button>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() =>
                  act(
                    { op: 'resendVerification', email: r.email, church: r.church },
                    `Resent verification link to ${r.email}`,
                  )
                }
                title="Resend verification link"
              >
                <span className="material-symbols-outlined text-sm">forward_to_inbox</span>
              </Button>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => setPwdTarget(r)}
                title="Assign temporary password"
              >
                <span className="material-symbols-outlined text-sm">key</span>
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() =>
                  act(
                    { op: 'deleteRegistration', id: r.id, email: r.email },
                    `Deleted unverified registration for ${r.email}`,
                  )
                }
                title="Reject and delete registration"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </Button>
            </div>,
          ])}
        />
      </Card>

      {/* Modal: Configure & Approve */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">Configure Registration & Approve</h3>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                ✕
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Adjust account details, update assigned church branch, and immediately activate their access.
            </p>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Full Name</span>
                <input
                  value={cfgName}
                  onChange={(e) => setCfgName(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Role</span>
                  <select
                    value={cfgRole}
                    onChange={(e) => setCfgRole(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                  >
                    <option value="Church Pastor">Church Pastor</option>
                    <option value="Church Admin">Church Admin</option>
                    <option value="Leader">Leader</option>
                    <option value="Usher">Usher</option>
                    <option value="Superadmin">Superadmin</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Assigned Church</span>
                  <select
                    value={cfgChurch}
                    onChange={(e) => setCfgChurch(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                  >
                    <option value="">-- Choose Branch --</option>
                    {a.churches.map((c: any) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Email</span>
                  <input
                    value={cfgEmail}
                    onChange={(e) => setCfgEmail(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Phone</span>
                  <input
                    value={cfgPhone}
                    onChange={(e) => setCfgPhone(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => handleSaveAndApprove(false)}
                >
                  Save (Keep Pending)
                </Button>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => handleSaveAndApprove(true)}
                >
                  <span className="material-symbols-outlined text-base mr-1">check_circle</span>
                  Approve & Activate Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Set Password */}
      {pwdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSetPassword}
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">Set Initial Password</h3>
              <Button variant="ghost" onClick={() => setPwdTarget(null)}>
                ✕
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Directly assign a password for <strong>{pwdTarget.email}</strong> and mark their account verified so they can log in immediately.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">New Password</span>
              <PasswordInput
                value={newPwd}
                onChange={(e: any) => setNewPwd(e.target.value)}
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPwdTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !newPwd.trim()}>
                {busy ? 'Setting…' : 'Set & Activate'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                             4. GROWTH & USAGE                              */
/* ========================================================================== */

function Growth({ s, a }: any) {
  const now = new Date();
  const m = now.toISOString().slice(0, 7);
  const newThisMonth = a.churches.filter((c: any) => String(c.createdAt).startsWith(m)).length;
  const users = Object.values(a.roleCounts as Record<string, number>).reduce((t, n) => t + n, 0);
  const active = a.churches.filter((c: any) => c.active).length;
  const ratio = (x: number, y: number) => (y ? (x / y).toFixed(1) : '0');

  const growthByMonth = new Map<string, { churches: number; members: number }>();
  for (const g of a.growth || []) {
    growthByMonth.set(String(g.month), { churches: Number(g.churches || 0), members: Number(g.members || 0) });
  }
  const months12 = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - idx), 1));
    const key = d.toISOString().slice(0, 7);
    const item = growthByMonth.get(key) || { churches: 0, members: 0 };
    return { month: key, label: key.slice(2), churches: item.churches, members: item.members };
  });
  let cumChurches = 0;
  let cumMembers = 0;
  const cumulativeMonths = months12.map((pt) => {
    cumChurches += pt.churches;
    cumMembers += pt.members;
    return { ...pt, cumChurches, cumMembers };
  });

  const dailyCheckins = (a.series || []).map((d: any) => ({
    label: String(d.date || '').slice(5),
    value: Number(d.count || 0),
  }));
  const rolling7Checkins = dailyCheckins.map((pt: any, idx: number, arr: any[]) => {
    const win = arr.slice(Math.max(0, idx - 6), idx + 1);
    const avg = win.reduce((sum: number, x: any) => sum + x.value, 0) / Math.max(1, win.length);
    return { label: pt.label, value: Math.round(avg * 10) / 10 };
  });

  const roleParts = Object.entries(a.roleCounts as Record<string, number>).map(([r, n]) => ({
    label: ROLE_LABELS[r] || r,
    value: Number(n || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Churches" value={a.churches.length} />
        <Tile label="New churches this month" value={newThisMonth} />
        <Tile
          label="Active churches"
          value={active}
          hint={`${a.churches.length ? Math.round((active / a.churches.length) * 100) : 0}% activation`}
        />
        <Tile label="Accounts on platform" value={users} />
        <Tile label="Members per leader" value={ratio(s.totals.members, s.totals.leaders)} />
        <Tile label="Members per church" value={ratio(s.totals.members, a.churches.length)} />
        <Tile label="Accounts per church" value={ratio(users, a.churches.length)} />
        <Tile
          label="Check-ins per member (90d)"
          value={ratio(a.series.reduce((t: number, d: any) => t + d.count, 0), s.totals.members)}
        />
      </div>

      <Card title="Check-in usage & 7-day moving average (90 days)">
        <SmoothLine
          height={210}
          series={[
            { name: 'Daily check-ins', data: dailyCheckins },
            { name: '7-day average', data: rolling7Checkins },
          ]}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="New churches per month">
          <SmoothLine
            height={190}
            series={[
              { name: 'New churches', data: cumulativeMonths.map((g) => ({ label: g.label, value: g.churches })) },
              { name: 'Cumulative (12m)', data: cumulativeMonths.map((g) => ({ label: g.label, value: g.cumChurches })) },
            ]}
          />
        </Card>
        <Card title="New members per month">
          <SmoothLine
            height={190}
            series={[
              { name: 'New members', data: cumulativeMonths.map((g) => ({ label: g.label, value: g.members })) },
              { name: 'Cumulative (12m)', data: cumulativeMonths.map((g) => ({ label: g.label, value: g.cumMembers })) },
            ]}
          />
        </Card>
        <Card title="Accounts by role">
          {roleParts.length ? <Donut parts={roleParts} /> : <p className="text-sm text-muted-foreground">No accounts yet.</p>}
        </Card>
        <Card title="Most engaged churches (30d check-ins)">
          <div className="space-y-3">
            {[...a.churches]
              .sort((x: any, y: any) => y.checkins30 - x.checkins30)
              .slice(0, 6)
              .map((c: any, _i: number, arr: any[]) => (
                <HBar key={c.name} label={c.name} value={c.checkins30} max={arr[0]?.checkins30 || 1} />
              ))}
            {!a.churches.length && <p className="text-sm text-muted-foreground">No churches yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                      5. MESSAGING (LIVE MESSAGE LOG)                       */
/* ========================================================================== */

function Messaging({ a, act }: any) {
  const m = a.messaging || {};
  const rate = m.total30 ? Math.round((m.sent30 / m.total30) * 100) : 100;
  const [q, setQ] = useState('');
  const [channelFilter, setChannelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [alsoEmail, setAlsoEmail] = useState(true);
  const [alsoSms, setAlsoSms] = useState(false);
  const [inspectedMessage, setInspectedMessage] = useState<any>(null);

  const rawMessages = a.recentMessages || [];
  const filteredMessages = rawMessages.filter((msg: any) => {
    const isSms = msg.template?.includes('sms') || msg.channel === 'sms';
    const msgChannel = isSms ? 'SMS' : 'Email';
    const matchChannel = channelFilter === 'All' || msgChannel === channelFilter;
    const matchStatus = statusFilter === 'All' || msg.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchQ =
      (msg.recipient && msg.recipient.toLowerCase().includes(q.toLowerCase())) ||
      (msg.template && msg.template.toLowerCase().includes(q.toLowerCase())) ||
      (msg.error && msg.error.toLowerCase().includes(q.toLowerCase()));
    return matchChannel && matchStatus && matchQ;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Delivery success" value={`${rate}%`} hint="last 30 days" />
        <Tile label="24-hour velocity" value={m.last24} hint="messages dispatched" />
        <Tile label="Email Volume" value={m.total30} />
        <Tile label="SMS Volume" value={m.sms30 || 0} />
      </div>

      <Card
        title="Live message stream & communications log"
        subtitle="Inspect all outbound messages passing through the platform (verification emails, check-in confirmations, alerts, broadcasts, and test dispatches)."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            placeholder="Search by recipient, template, error…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-input bg-background px-4 py-2 text-sm"
          />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="All">All Channels</option>
            <option value="Email">Email only</option>
            <option value="SMS">SMS only</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="sent">Sent / Delivered</option>
            <option value="pending">Pending Queue</option>
            <option value="failed">Failed only</option>
          </select>
        </div>

        <Table
          head={['Timestamp', 'Channel', 'Template / Purpose', 'Recipient', 'Status', 'Church', 'Inspect']}
          empty="No messages match your criteria."
          rows={filteredMessages.map((msg: any) => {
            const isSms = msg.template?.includes('sms') || msg.channel === 'sms';
            const ok = msg.status === 'sent' || msg.status === 'delivered';
            return [
              when(msg.at),
              <Badge variant={isSms ? 'warning' : 'primary'}>{isSms ? 'SMS' : 'EMAIL'}</Badge>,
              <strong>{msg.template}</strong>,
              msg.recipient,
              <Badge ok={ok}>{msg.status}</Badge>,
              msg.church || 'All Churches',
              <Button
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                onClick={() => setInspectedMessage(msg)}
              >
                Inspect
              </Button>,
            ];
          })}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Broadcast announcement composer">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Dispatch high-priority announcements to all churches, pastors, and admins.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title, e.g. Upcoming Global Communion Service"
              className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Announcement message content…"
              className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
            />
            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={alsoEmail}
                  onChange={(e) => setAlsoEmail(e.target.checked)}
                />
                <span>Email to all branch pastors and admins</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={alsoSms}
                  onChange={(e) => setAlsoSms(e.target.checked)}
                />
                <span>Send SMS to registered branch phone numbers (when enabled)</span>
              </label>
            </div>
            <Button
              disabled={!title.trim() || !message.trim()}
              onClick={() => {
                act(
                  { op: 'broadcast', title, message, email: alsoEmail, sms: alsoSms },
                  alsoEmail ? 'Announcement broadcast dispatched' : 'Announcement posted',
                );
                setTitle('');
                setMessage('');
              }}
            >
              <span className="material-symbols-outlined text-base mr-1">send</span>
              Dispatch Announcement
            </Button>
          </div>
        </Card>

        <Card title="Recent delivery failures">
          <Table
            head={['When', 'Template', 'Status', 'Reason']}
            empty="No failed deliveries. Every message went through successfully!"
            rows={m.failures.map((f: any) => [
              when(f.at),
              f.template,
              <Badge ok={false}>{f.status}</Badge>,
              f.reason,
            ])}
          />
        </Card>
      </div>

      {/* Modal: Message Inspector */}
      {inspectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">Message Inspector</h3>
              <Button variant="ghost" onClick={() => setInspectedMessage(null)}>
                ✕
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Template</span>
                <strong>{inspectedMessage.template}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-mono">{inspectedMessage.recipient}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Status</span>
                <Badge ok={inspectedMessage.status === 'sent'}>{inspectedMessage.status}</Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Timestamp</span>
                <span>{when(inspectedMessage.at)}</span>
              </div>
              {inspectedMessage.error && (
                <div className="py-2">
                  <span className="text-destructive font-semibold block mb-1">Error Details</span>
                  <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded-xl overflow-auto">
                    {inspectedMessage.error}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setInspectedMessage(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                   6. SMS GATEWAY & TEMPLATES (FULL CRUD)                   */
/* ========================================================================== */

function SmsHub({ a, act }: any) {
  const [cfg, setCfg] = useState<any>(() => ({
    provider: 'Hubtel',
    senderId: 'CE KORLE BU',
    apiKey: '',
    apiSecret: '',
    enabled: false,
    autoSendRegistration: false,
    autoSendCheckin: false,
    defaultCountryCode: '+233',
    lowCreditThreshold: 50,
    ...(a.smsConfig || {}),
  }));

  // Test runner state
  const [testPhone, setTestPhone] = useState('+233');
  const [testMsg, setTestMsg] = useState('Hello from CEKB Developer Console! This is a test dispatch.');
  const [testBusy, setTestBusy] = useState(false);

  // Template CRUD state
  const [showTplModal, setShowTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('General');
  const [tplContent, setTplContent] = useState('');

  const defaultTemplates = [
    {
      id: 'tpl-1',
      name: 'welcome_verification',
      title: 'Welcome & Activation SMS',
      category: 'Onboarding',
      content: 'Welcome to CEKB! Your account has been approved. Use code {code} or login at {link}',
      variables: ['{name}', '{code}', '{link}'],
      is_active: true,
    },
    {
      id: 'tpl-2',
      name: 'checkin_confirmation',
      title: 'Check-in Confirmation',
      category: 'Attendance',
      content: 'Dear {name}, thank you for worshipping with us at {church} today! Grace be multiplied to you.',
      variables: ['{name}', '{church}'],
      is_active: true,
    },
    {
      id: 'tpl-3',
      name: 'absence_followup',
      title: 'Absentee Follow-up SMS',
      category: 'Pastoral',
      content: 'Dear {name}, we missed your fellowship today at {church}! We are praying with you this week.',
      variables: ['{name}', '{church}'],
      is_active: true,
    },
    {
      id: 'tpl-4',
      name: 'cell_meeting_reminder',
      title: 'Cell Meeting Reminder',
      category: 'Fellowship',
      content: 'Hi {name}, our Cell fellowship meets this week. Come expectant for a supernatural time!',
      variables: ['{name}', '{church}', '{time}'],
      is_active: true,
    },
    {
      id: 'tpl-5',
      name: 'birthday_blessings',
      title: 'Birthday Blessings SMS',
      category: 'Celebration',
      content: 'Happy Birthday {name}! CEKB family rejoices with you today. Walk in supernatural abundance!',
      variables: ['{name}', '{church}'],
      is_active: true,
    },
  ];

  const templates = (Array.isArray(a.smsTemplates) && a.smsTemplates.length > 0)
    ? a.smsTemplates
    : defaultTemplates;

  const saveConfig = async () => {
    await act({ op: 'saveSmsConfig', config: cfg }, 'SMS Gateway settings saved');
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMsg.trim()) return;
    setTestBusy(true);
    await act(
      { op: 'sendTestSms', phone: testPhone.trim(), message: testMsg.trim(), provider: cfg.provider },
      `Test SMS dispatched to ${testPhone}`,
    );
    setTestBusy(false);
  };

  const openCreateTpl = () => {
    setEditingTpl(null);
    setTplTitle('');
    setTplName('');
    setTplCategory('General');
    setTplContent('');
    setShowTplModal(true);
  };

  const openEditTpl = (t: any) => {
    setEditingTpl(t);
    setTplTitle(t.title || '');
    setTplName(t.name || '');
    setTplCategory(t.category || 'General');
    setTplContent(t.content || '');
    setShowTplModal(true);
  };

  const handleSaveTpl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || !tplContent.trim()) return;
    const tplPayload = {
      id: editingTpl?.id,
      name: tplName.trim().toLowerCase().replace(/\s+/g, '_'),
      title: tplTitle.trim() || tplName.trim(),
      category: tplCategory,
      content: tplContent.trim(),
      variables: ['{name}', '{church}'],
      is_active: true,
    };
    await act({ op: 'saveSmsTemplate', template: tplPayload }, `Saved SMS template "${tplPayload.title}"`);
    setShowTplModal(false);
  };

  const handleDeleteTpl = async (id: string, name: string) => {
    await act({ op: 'deleteSmsTemplate', id, name }, `Deleted SMS template "${name}"`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-headline flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">sms</span>
            SMS Gateway & Telemetry Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Configure your SMS provider (Hubtel, Arkesel, Twilio, Termii, Mnotify) and maintain customized SMS templates with dynamic variables so you never have to prompt or write code for SMS dispatches.
          </p>
        </div>
        <Badge variant={cfg.enabled ? 'primary' : 'neutral'}>
          {cfg.enabled ? 'Gateway Enabled' : 'Gateway Inactive'}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gateway settings */}
        <Card title="SMS Provider & Credentials" subtitle="Enter your gateway API credentials and sender ID.">
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold">SMS Provider</span>
              <select
                value={cfg.provider}
                onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              >
                <option value="Hubtel">Hubtel (Ghana)</option>
                <option value="Arkesel">Arkesel (Ghana)</option>
                <option value="Twilio">Twilio (Global)</option>
                <option value="Termii">Termii (West Africa)</option>
                <option value="Mnotify">Mnotify (Ghana)</option>
                <option value="Webhook">Custom HTTP Webhook</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Sender ID (max 11 chars)</span>
                <input
                  value={cfg.senderId}
                  maxLength={11}
                  onChange={(e) => setCfg({ ...cfg, senderId: e.target.value })}
                  placeholder="e.g. CE KORLE BU"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold uppercase"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Default Country Code</span>
                <input
                  value={cfg.defaultCountryCode}
                  onChange={(e) => setCfg({ ...cfg, defaultCountryCode: e.target.value })}
                  placeholder="+233"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">API Key / Client ID</span>
              <input
                type="password"
                value={cfg.apiKey}
                onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
                placeholder="Enter provider API key"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-mono"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">API Secret / Client Secret</span>
              <input
                type="password"
                value={cfg.apiSecret}
                onChange={(e) => setCfg({ ...cfg, apiSecret: e.target.value })}
                placeholder="Enter client secret (if applicable)"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-mono"
              />
            </label>

            <div className="pt-2 space-y-2 border-t border-border">
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <span>Enable Live SMS Dispatch</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <span>Auto-send SMS on New Leader Registration</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={cfg.autoSendRegistration}
                  onChange={(e) => setCfg({ ...cfg, autoSendRegistration: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between text-sm cursor-pointer">
                <span>Auto-send SMS Confirmation on Service Check-in</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={cfg.autoSendCheckin}
                  onChange={(e) => setCfg({ ...cfg, autoSendCheckin: e.target.checked })}
                />
              </label>
            </div>

            <Button onClick={saveConfig} className="w-full mt-2">
              <span className="material-symbols-outlined text-base mr-1">save</span>
              Save SMS Configuration
            </Button>
          </div>
        </Card>

        {/* Test SMS Runner */}
        <Card
          title="Interactive Test SMS Dispatcher"
          subtitle="Directly test SMS delivery to any mobile phone right from the console."
        >
          <form onSubmit={handleSendTest} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold">Recipient Mobile Number</span>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+233501234567"
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">Message Preview</span>
              <textarea
                value={testMsg}
                rows={4}
                onChange={(e) => setTestMsg(e.target.value)}
                required
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
              <span className="text-xs text-muted-foreground block text-right">
                {testMsg.length} characters ({Math.ceil(testMsg.length / 160)} SMS credits)
              </span>
            </label>
            <Button type="submit" disabled={testBusy} className="w-full">
              <span className="material-symbols-outlined text-base mr-1">send</span>
              {testBusy ? 'Dispatching…' : 'Dispatch Test SMS'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Templates CRUD */}
      <Card
        title="SMS Message Templates (CRUD)"
        subtitle="Manage dynamic message templates with variable substitution ({name}, {church}, {code}, {time})."
        right={
          <Button variant="primary" onClick={openCreateTpl}>
            <span className="material-symbols-outlined text-base mr-1">add</span>
            Create SMS Template
          </Button>
        }
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <div
              key={t.id || t.name}
              className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm">{t.title}</h4>
                  <Badge variant="warning">{t.category}</Badge>
                </div>
                <code className="text-xs text-muted-foreground block mt-0.5">key: {t.name}</code>
                <p className="mt-2 text-xs bg-muted/50 p-2.5 rounded-xl text-foreground font-mono leading-relaxed">
                  "{t.content}"
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Variables: {(t.variables || ['{name}']).join(', ')}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={() => openEditTpl(t)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteTpl(t.id, t.name)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Modal: Create/Edit SMS Template */}
      {showTplModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSaveTpl}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">
                {editingTpl ? 'Edit SMS Template' : 'Create SMS Template'}
              </h3>
              <Button variant="ghost" onClick={() => setShowTplModal(false)}>
                ✕
              </Button>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">Template Title</span>
              <input
                required
                value={tplTitle}
                onChange={(e) => setTplTitle(e.target.value)}
                placeholder="e.g. Absentee Follow-up SMS"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Key Identifier (slug)</span>
                <input
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. absence_followup"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Category</span>
                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                >
                  <option value="Onboarding">Onboarding</option>
                  <option value="Attendance">Attendance</option>
                  <option value="Pastoral">Pastoral</option>
                  <option value="Fellowship">Fellowship</option>
                  <option value="Celebration">Celebration</option>
                  <option value="General">General</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Message Text</span>
                <div className="flex gap-1 text-xs">
                  {['{name}', '{church}', '{code}', '{time}'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-primary font-mono text-[10px]"
                      onClick={() => setTplContent((prev) => prev + ` ${v}`)}
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                required
                rows={4}
                value={tplContent}
                onChange={(e) => setTplContent(e.target.value)}
                placeholder="Write your template text here…"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowTplModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingTpl ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                 7. SERVICE PROGRAMS (GLOBAL & BRANCH CRUD)                 */
/* ========================================================================== */

function ServicesManager({ a, act }: any) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingSvc, setEditingSvc] = useState<any>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isActive, setIsActive] = useState(true);

  const svcs = a.serviceTypes || [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingSvc) {
      await act(
        { op: 'updateServiceType', id: editingSvc.id, name: name.trim(), description: desc.trim(), is_active: isActive },
        `Updated program "${name.trim()}"`,
      );
    } else {
      await act(
        { op: 'createServiceType', name: name.trim(), description: desc.trim(), is_active: isActive },
        `Created service program "${name.trim()}"`,
      );
    }
    setShowCreate(false);
    setEditingSvc(null);
    setName('');
    setDesc('');
  };

  const openEdit = (s: any) => {
    setEditingSvc(s);
    setName(s.name || '');
    setDesc(s.description || '');
    setIsActive(s.is_active !== false);
    setShowCreate(true);
  };

  const handleDelete = async (s: any) => {
    await act({ op: 'deleteServiceType', id: s.id }, `Deleted program "${s.name}"`);
  };

  return (
    <div className="space-y-6">
      <Card
        title="Service programs & meeting schedules"
        subtitle="Manage regular weekly church services and special programs (e.g. Sunday 1st Service, Midweek Service, Youth Meeting, All Night Prayer)."
        right={
          <Button
            variant="primary"
            onClick={() => {
              setEditingSvc(null);
              setName('');
              setDesc('');
              setIsActive(true);
              setShowCreate(true);
            }}
          >
            <span className="material-symbols-outlined text-base mr-1">add</span>
            Add Service Program
          </Button>
        }
      >
        <Table
          head={['Service / Program Name', 'Description / Schedule', 'Scope', 'Status', 'Actions']}
          empty="No service programs defined yet."
          rows={svcs.map((s: any) => [
            <strong>{s.name}</strong>,
            s.description || <span className="text-muted-foreground italic">None</span>,
            <Badge ok={s.is_global !== false}>{s.is_global ? 'All Churches' : 'Branch Specific'}</Badge>,
            <Badge ok={s.is_active !== false}>{s.is_active !== false ? 'Active' : 'Inactive'}</Badge>,
            <div className="flex gap-1.5">
              <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => openEdit(s)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(s)}
              >
                Delete
              </Button>
            </div>,
          ])}
        />
      </Card>

      {/* Modal: Create/Edit Service Type */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline">
                {editingSvc ? 'Edit Service Program' : 'New Service Program'}
              </h3>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                ✕
              </Button>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">Program Name *</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunday 2nd Service"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">Description / Schedule</span>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Sunday morning 10:00 AM - 12:00 PM"
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              />
            </label>
            <label className="flex items-center justify-between text-sm cursor-pointer pt-1">
              <span>Program Active for Check-in</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSvc ? 'Save Changes' : 'Create Program'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                    8. DATABASE, STORAGE & SQL SCHEMA                       */
/* ========================================================================== */

function Storage({ a, token, reload, notify }: any) {
  const tables = Object.entries(a.tables as Record<string, number>).sort((x, y) => y[1] - x[1]);
  const total = tables.reduce((t, [, n]) => t + n, 0);
  const sorted = [...a.churches].sort((x: any, y: any) => y.rows - x.rows);
  const [archived, setArchived] = useState('');
  const [lastBackup, setLastBackup] = useState('');
  const [busyBackup, setBusyBackup] = useState(false);
  const [busyRestore, setBusyRestore] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [schemaMode, setSchemaMode] = useState<'update' | 'full'>('update');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSql = schemaMode === 'update' ? SUPABASE_UPDATE_SQL : SUPABASE_SQL_SCHEMA;

  const handleCopySql = () => {
    navigator.clipboard.writeText(activeSql);
    setCopied(true);
    notify?.('SQL script copied to clipboard! Paste it into Supabase SQL editor.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadSql = () => {
    const filename = schemaMode === 'update' ? 'cekb-updates.sql' : 'cekb-full-schema.sql';
    const blob = new Blob([activeSql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = filename;
    el.click();
    URL.revokeObjectURL(url);
    notify?.(`Downloaded ${filename}`);
  };

  const handleBackup = async () => {
    if (!token) return;
    setBusyBackup(true);
    const r = await rawPortal({ action: 'devAction', op: 'backup' }, token);
    setBusyBackup(false);
    if (!r?.success || !r.data) {
      notify?.(r?.error || 'Backup failed.');
      return;
    }
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `cekb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    el.click();
    URL.revokeObjectURL(url);
    const stamp = new Date().toLocaleString();
    setLastBackup(stamp);
    notify?.('Backup downloaded');
    reload?.();
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;
    try {
      setBusyRestore(true);
      const text = await file.text();
      const backup = JSON.parse(text);
      const r = await rawPortal({ action: 'devAction', op: 'restore', backup }, token);
      setBusyRestore(false);
      if (r?.success) {
        const res = r.restored || {};
        notify?.(
          `Restored ${res.settings ?? 0} settings, ${res.services ?? 0} services, ${res.churches ?? 0} churches`,
        );
        reload?.();
      } else {
        notify?.(r?.error || 'Restore failed.');
      }
    } catch {
      setBusyRestore(false);
      notify?.('This file is not a valid CEKB backup.');
    }
  };

  const exportArchive = async () => {
    const pass = passphrase.trim();
    if (!pass) {
      notify?.('Enter an encryption passphrase first.');
      return;
    }
    const payload = new TextEncoder().encode(
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        churches: a.churches,
        tables: a.tables,
        growth: a.growth,
      }),
    );
    const salt = crypto.getRandomValues(new Uint8Array(16)),
      iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pass),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
    const blob = new Blob([salt, iv, enc], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `cekb-archive-${new Date().toISOString().slice(0, 10)}.enc`;
    el.click();
    URL.revokeObjectURL(url);
    setArchived(new Date().toLocaleString());
    setPassphrase('');
    notify?.('Encrypted archive downloaded');
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

      {/* SQL Editor / Schema Pull-up Card */}
      <Card
        title="Supabase SQL Editor & Database Update Script"
        subtitle="Pull up the idempotent SQL schema update script directly into your SQL editor anytime without manual prompting or coding."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setSchemaMode('update')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  schemaMode === 'update' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                New Updates SQL (SMS & Autonomy)
              </button>
              <button
                type="button"
                onClick={() => setSchemaMode('full')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  schemaMode === 'full' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Complete Full Schema SQL
              </button>
            </div>
            <Button variant="secondary" onClick={handleDownloadSql}>
              <span className="material-symbols-outlined text-base mr-1">download</span>
              Download .sql
            </Button>
            <Button variant="primary" onClick={handleCopySql}>
              <span className="material-symbols-outlined text-base mr-1">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : 'Copy SQL to Clipboard'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground flex items-center justify-between gap-4">
            <div>
              <strong>Quick instructions for Supabase:</strong> Open your Supabase Dashboard → Click <strong>SQL Editor</strong> in the left sidebar → Click <strong>New query</strong> → Paste this script → Click <strong>Run</strong>. Safe and idempotent.
            </div>
          </div>
          <pre className="max-h-96 overflow-auto rounded-2xl border border-border bg-muted/60 p-4 text-xs font-mono leading-relaxed select-all">
            {activeSql}
          </pre>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Churches by storage footprint">
          <Table
            head={['Church', 'Rows', 'Est. size']}
            empty="No churches yet."
            rows={sorted.map((c: any) => [c.name, fmt(c.rows), bytes(c.estBytes)])}
          />
        </Card>

        <Card title="Backup & restore configuration">
          <p className="text-sm text-muted-foreground mb-4">
            Download a JSON backup of global platform settings, service programs, and church statuses, or restore a previous backup file. Personal member records are never included.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleBackup} disabled={busyBackup}>
              <span className="material-symbols-outlined mr-1 text-base">download</span>
              <span>{busyBackup ? 'Creating backup…' : 'Backup configuration'}</span>
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={busyRestore}>
              <span className="material-symbols-outlined mr-1 text-base">upload_file</span>
              <span>{busyRestore ? 'Restoring…' : 'Restore backup'}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </div>
          {lastBackup && <p className="mt-3 text-xs text-muted-foreground">Last backup created {lastBackup}</p>}
        </Card>

        <Card title="Database integrity & consistency">
          <div className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span>Check-ins without a church link</span>
              <Badge ok={!a.integrity.orphanAtt}>{fmt(a.integrity.orphanAtt)}</Badge>
            </p>
            <p className="flex justify-between">
              <span>Members without a church link</span>
              <Badge ok={!a.integrity.orphanMem}>{fmt(a.integrity.orphanMem)}</Badge>
            </p>
            <p className="flex justify-between">
              <span>Expired sessions awaiting cleanup</span>
              <Badge ok={a.integrity.expiredSessions < 50}>{fmt(a.integrity.expiredSessions)}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              Expired sessions are purged daily automatically; you can also purge them under System Health.
            </p>
          </div>
        </Card>

        <Card title="Encrypted archives">
          <p className="text-sm text-muted-foreground mb-3">
            Download an AES-256 encrypted backup of church-level totals. Personal records are never included.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase to encrypt archive"
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={exportArchive} disabled={!passphrase.trim()}>
              Create encrypted archive
            </Button>
          </div>
          {archived && <p className="mt-2 text-sm">Last archive created {archived}</p>}
        </Card>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                                9. AUDIT LOGS                               */
/* ========================================================================== */

function Audit({ a }: any) {
  const PAGE_SIZE = 10;
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const cats = useMemo(
    () => ['All', ...Array.from(new Set(a.logs.map((l: any) => l.category)))] as string[],
    [a.logs],
  );
  const list = useMemo(
    () =>
      a.logs.filter(
        (l: any) =>
          (cat === 'All' || l.category === cat) &&
          `${l.action} ${l.church || ''}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [a.logs, cat, q],
  );
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const critical = a.logs.filter((l: any) =>
    ['Security', 'System', 'Church', 'Settings'].includes(l.category),
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile featured label="Events loaded" value={a.logs.length} />
        <Tile label="Critical actions" value={critical} />
        <Tile label="Developer actions" value={a.logs.filter((l: any) => l.actor === 'Developer').length} />
        <Tile label="Categories" value={cats.length - 1} />
      </div>
      <Card
        title="Event timeline"
        right={
          <div className="flex flex-wrap gap-2">
            <select
              value={cat}
              onChange={(e) => {
                setCat(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              placeholder="Search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        }
      >
        <Table
          head={['When', 'Category', 'Event', 'Church', 'Actor']}
          empty="No events."
          rows={pageItems.map((l: any) => [
            when(l.at),
            <Badge ok={l.category !== 'Security'}>{l.category}</Badge>,
            l.action,
            l.church || '—',
            l.actor,
          ])}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {list.length === 0
              ? 'Showing 0 events (10 per page)'
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                  safePage * PAGE_SIZE,
                  list.length,
                )} of ${fmt(list.length)} events (10 per page)`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="px-2 font-semibold text-foreground tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ========================================================================== */
/*                             10. SYSTEM HEALTH                              */
/* ========================================================================== */

function Health({ s, a, act }: any) {
  const [ping, setPing] = useState<number | null>(null);
  useEffect(() => {
    const t = performance.now();
    rawPortal({ action: 'featureMatrix' }, null).then(() => setPing(Math.round(performance.now() - t)));
  }, []);
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
          <p className="flex justify-between">
            <span>Data gateway</span>
            <Badge ok={ping != null}>{ping != null ? 'Online' : 'Checking'}</Badge>
          </p>
          <p className="flex justify-between">
            <span>Email delivery</span>
            <Badge ok={failRate < 0.1}>{failRate < 0.1 ? 'Healthy' : 'Degraded'}</Badge>
          </p>
          <p className="flex justify-between">
            <span>Database integrity</span>
            <Badge ok={!a.integrity.orphanAtt && !a.integrity.orphanMem}>
              {!a.integrity.orphanAtt && !a.integrity.orphanMem ? 'Consistent' : 'Review'}
            </Badge>
          </p>
          <p className="flex justify-between">
            <span>Session hygiene</span>
            <Badge ok={a.integrity.expiredSessions < 50}>{fmt(a.integrity.expiredSessions)} expired</Badge>
          </p>
        </div>
        <Button className="mt-4" onClick={() => act({ op: 'purgeSessions' }, 'Expired sessions purged')}>
          Purge expired sessions
        </Button>
      </Card>
    </div>
  );
}

/* ========================================================================== */
/*                    11. PLATFORM SETTINGS & MATRIX                          */
/* ========================================================================== */

function Settings({ a, act }: any) {
  const [p, setP] = useState<any>(() => ({
    platformName: 'CEKB Group',
    tagline: 'Every presence counts.',
    supportEmail: 'support@gcycattendance.online',
    senderName: 'CE Korle Bu',
    primaryColor: '#000f22',
    maintenance: false,
    maintenanceMessage: 'We are making improvements. Please check back shortly.',
    announcementBanner: '',
    allowRegistrations: true,
    allowLeaderSignup: true,
    allowSelfRegistration: true,
    allowSelfCheckin: true,
    allowCellReports: true,
    allowUsherAccounts: true,
    sessionHours: 12,
    requireGroupOtp: true,
    maxChurches: 100,
    plan: 'Free',
    birthdayEmails: true,
    weeklySummary: true,
    reportReminders: true,
    welcomeEmails: true,
    timezone: 'Africa/Accra',
    currency: 'GHS',
    auditRetentionDays: 365,
    ...(a.platform || {}),
  }));

  const [matrix, setMatrix] = useState<FeatureMatrix>(() => a.featureMatrix || {});

  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const toggleFeature = (role: string, id: string) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [id]: !isFeatureOn(prev, role, id),
      },
    }));
  };

  const field = (k: string, label: string, type = 'text', placeholder?: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type={type}
        value={p[k] ?? ''}
        placeholder={placeholder}
        onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
      />
    </label>
  );

  const toggle = (k: string, label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={!!p[k]}
        onChange={(e) => set(k, e.target.checked)}
      />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Profile & security">
          <div className="space-y-2 text-sm">
            <p>Signed in as <strong>Developer</strong> (totals-only oversight).</p>
            <p className="text-muted-foreground">
              Developer credentials are protected by server secrets. You have complete autonomy over churches, approvals, messaging, SMS, and schema updates.
            </p>
          </div>
        </Card>
        <Card title="Platform identity">
          <div className="space-y-3">
            {field('platformName', 'Platform name')}
            {field('tagline', 'Tagline')}
            {field('supportEmail', 'Support email', 'email')}
          </div>
        </Card>
        <Card title="Platform branding & regional defaults">
          <div className="space-y-3">
            {field('primaryColor', 'Primary colour', 'color')}
            {field('senderName', 'Email sender name')}
            <div className="grid grid-cols-2 gap-3">
              {field('timezone', 'Timezone', 'text', 'Africa/Accra')}
              {field('currency', 'Currency', 'text', 'GHS')}
            </div>
            {field('auditRetentionDays', 'Audit log retention (days)', 'number')}
          </div>
        </Card>
        <Card title="Global autonomy & portal access controls">
          <div className="space-y-3">
            {toggle('maintenance', 'Maintenance mode')}
            {toggle('allowRegistrations', 'Allow new church registrations')}
            {toggle('allowLeaderSignup', 'Allow leader sign-up')}
            {toggle('allowSelfRegistration', 'Allow member self-registration')}
            {toggle('allowSelfCheckin', 'Allow member self check-in')}
            {toggle('allowCellReports', 'Allow weekly cell report submissions')}
            {toggle('allowUsherAccounts', 'Allow appointing ushers & branch admins')}
          </div>
        </Card>
        <Card title="Maintenance & announcement banner">
          <div className="space-y-3">
            {field('maintenanceMessage', 'Maintenance screen message', 'text')}
            {field('announcementBanner', 'Public announcement banner (leave blank to hide)', 'text')}
          </div>
        </Card>
        <Card title="Authentication & session security">
          <div className="space-y-3">
            {toggle('requireGroupOtp', 'Require two-step email code for Group Pastor sign-in')}
            {field('sessionHours', 'Session duration (hours, 1–72)', 'number')}
          </div>
        </Card>
        <Card title="Automated communications & scheduled jobs">
          <div className="space-y-3">
            {toggle('birthdayEmails', 'Daily birthday reminder communications')}
            {toggle('weeklySummary', 'Monday weekly summary to Group Pastor')}
            {toggle('reportReminders', 'Weekly missing cell report reminders to leaders')}
            {toggle('welcomeEmails', 'Welcome & verification communications for new accounts')}
          </div>
        </Card>
        <Card title="Commercial plans">
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Current plan</span>
              <select
                value={p.plan}
                onChange={(e) => set('plan', e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
              >
                {['Free', 'Standard', 'Premium', 'Enterprise'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            {field('maxChurches', 'Church limit', 'number')}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => act({ op: 'saveSetting', key: 'platform_config', value: p }, 'Platform settings saved')}>
          Save Platform Settings
        </Button>
      </div>

      <Card
        title="Role permissions & feature matrix"
        right={
          <Button
            variant="secondary"
            onClick={() => act({ op: 'saveSetting', key: 'feature_matrix', value: matrix }, 'Feature matrix saved')}
          >
            Save feature matrix
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2.5">Feature</th>
                {FEATURE_ROLES.map((r) => (
                  <th key={r} className="p-2.5 text-center whitespace-nowrap">
                    {ROLE_LABELS[r] || r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="p-2.5 font-semibold">{item.label}</td>
                  {FEATURE_ROLES.map((r) => (
                    <td key={r} className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={isFeatureOn(matrix, r, item.id)}
                        onChange={() => toggleFeature(r, item.id)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
