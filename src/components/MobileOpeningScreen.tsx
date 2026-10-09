import { useEffect, useState, type ReactNode } from 'react';
import { ChurchLogo } from './ChurchLogo';

interface MobileOpeningScreenProps {
  children: ReactNode;
}

export function MobileOpeningScreen({ children }: MobileOpeningScreenProps) {
  const [phase, setPhase] = useState<'opening' | 'revealing' | 'done'>(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'opening' : 'done'
  );

  useEffect(() => {
    if (phase === 'done') return;
    const timer = window.setTimeout(
      () => setPhase(phase === 'opening' ? 'revealing' : 'done'),
      phase === 'opening' ? 3000 : 500
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <>
      <div className={phase === 'opening' ? 'mobile-opening-content--hidden' : undefined} aria-hidden={phase === 'opening' ? true : undefined}>
        {children}
      </div>
      {phase !== 'done' && (
        <div className={`mobile-opening-screen${phase === 'revealing' ? ' mobile-opening-screen--revealing' : ''}`} role="status" aria-live="polite" aria-label="Opening CEKB attendance">
          <div className="mobile-opening-brand">
            <div className="mobile-opening-emblem">
              <div className="mobile-opening-loader" aria-hidden="true" />
              <ChurchLogo className="mobile-opening-logo" alt="CEKB logo" />
            </div>
            <h1>CEKB Group</h1>
            <p>Every presence counts.</p>
          </div>
          <span className="sr-only">Opening CEKB attendance…</span>
        </div>
      )}
    </>
  );
}