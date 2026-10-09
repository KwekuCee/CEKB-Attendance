import { useEffect, useState, type ReactNode } from 'react';

interface MobileOpeningScreenProps {
  children: ReactNode;
}

export function MobileOpeningScreen({ children }: MobileOpeningScreenProps) {
  const [isOpening, setIsOpening] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    if (!isOpening) return;
    const timer = window.setTimeout(() => setIsOpening(false), 3000);
    return () => window.clearTimeout(timer);
  }, [isOpening]);

  if (!isOpening) return <>{children}</>;

  return (
    <div className="mobile-opening-screen" role="status" aria-live="polite" aria-label="Opening CEKB attendance">
      <div className="mobile-opening-loader" aria-hidden="true" />
      <span className="sr-only">Opening CEKB attendance…</span>
    </div>
  );
}