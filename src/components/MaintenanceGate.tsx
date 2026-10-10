import React, { useEffect, useState } from 'react';
import { rawPortal } from '../lib/rawPortal';
import { setPortalToken } from '../lib/portalDb';

// When the developer turns on maintenance mode, only a static homepage is shown:
// no sign-in, sign-up, check-in or reports. The server refuses those requests too.
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    const check = () => rawPortal({ action: 'platformStatus' }, null).then((r) => r?.data && setStatus(r.data));
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (status?.maintenance) {
      setPortalToken(null);
      try { localStorage.removeItem('gcyc_auth_session'); } catch { /* ignore */ }
    }
  }, [status?.maintenance]);
  if (!status?.maintenance) return <>{children}</>;
  return (
    <main className="maintenance-home min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <img src="/church-logo.png" alt="CEKB logo" className="h-24 w-24 rounded-3xl bg-card p-2 shadow-xl" />
      <div className="space-y-3 max-w-xl">
        <p className="text-xs uppercase tracking-[0.3em] opacity-70">Christ Embassy Korle Bu</p>
        <h1 className="text-4xl md:text-6xl font-headline">{status.platformName || 'CEKB Group'}</h1>
        <p className="text-xl font-headline opacity-90">{status.tagline || 'Every presence counts.'}</p>
      </div>
      <div className="rounded-3xl border border-border/30 bg-card/10 px-6 py-5 max-w-md backdrop-blur">
        <p className="font-semibold flex items-center justify-center gap-2"><span className="material-symbols-outlined" aria-hidden="true">construction</span>Scheduled maintenance</p>
        <p className="mt-2 text-sm opacity-80">{status.maintenanceMessage || 'We are making improvements. Please check back shortly.'}</p>
      </div>
      {status.supportEmail && <a className="text-sm underline opacity-80" href={`mailto:${status.supportEmail}`}>{status.supportEmail}</a>}
    </main>
  );
}
