import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ChurchLogo } from './ChurchLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToast } from '../context/ToastContext';

const DISMISS_KEY = 'cekb_pwa_prompt_dismissed_v1';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstalled, isIOS, isAndroid, installPWA, saveIOS } = usePWAInstall();
  const toast = useToast();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOpen = () => {
      setDismissed(false);
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {}
    };
    window.addEventListener('cekb:open-install-prompt', handleOpen);
    return () => window.removeEventListener('cekb:open-install-prompt', handleOpen);
  }, []);

  // Automatically dismiss the install dialog 10 seconds after it appears
  useEffect(() => {
    if (isInstalled || dismissed) return;
    const timer = window.setTimeout(() => {
      setDismissed(true);
      try {
        sessionStorage.setItem(DISMISS_KEY, '1');
      } catch {}
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [isInstalled, dismissed]);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  const handleAndroidDownload = async () => {
    const ok = await installPWA();
    handleDismiss();
    if (ok) {
      toast.showSuccess('Downloading CEKB App', 'The CEKB app download has been triggered on your device.');
    }
  };

  const handleIOSSave = async () => {
    await saveIOS();
    handleDismiss();
    toast.showSuccess('Saving to Device', 'Allow the profile download to add the CEKB app icon to your Home Screen.');
  };

  return (
    <aside
      role="dialog"
      aria-label="Install CEKB App"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[410px] z-40 rounded-3xl border border-border bg-card/95 backdrop-blur-xl p-4 sm:p-5 shadow-2xl"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 border border-border p-1.5">
          <ChurchLogo className="w-full h-full object-contain" alt="CEKB App" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                <span className="material-symbols-outlined text-[14px]">install_mobile</span>
                <span>CEKB Mobile &amp; Desktop App</span>
              </span>
              <h3 className="font-headline font-extrabold text-base text-foreground mt-0.5">
                {isIOS ? 'Save CEKB to Your Device' : 'Download CEKB to Your Device'}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {isIOS
              ? 'Save the CEKB app directly to your iPhone or iPad for instant full-screen check-in, cell reports, and QR scanning.'
              : 'Install the CEKB app on Android or save it to your iOS device for one-tap access without browser bars.'}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {!isIOS && (
              <Button variant="primary" onClick={handleAndroidDownload} className="flex-1 min-w-[150px]">
                <span className="material-symbols-outlined">download</span>
                <span>{isAndroid ? 'Install App' : 'Download (Android)'}</span>
              </Button>
            )}
            <Button
              variant={isIOS ? 'primary' : 'secondary'}
              onClick={handleIOSSave}
              className="flex-1 min-w-[150px]"
            >
              <span className="material-symbols-outlined">ios_share</span>
              <span>{isIOS ? 'Save to Device' : 'Save on iPhone (iOS)'}</span>
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
