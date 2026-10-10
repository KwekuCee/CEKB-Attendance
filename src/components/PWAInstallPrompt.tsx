import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ChurchLogo } from './ChurchLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToast } from '../context/ToastContext';

const DISMISS_KEY = 'cekb_pwa_prompt_dismissed_v1';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstalled, isInstallable, isIOS, isAndroid, installPWA } = usePWAInstall();
  const toast = useToast();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideTab, setGuideTab] = useState<'android' | 'ios'>('android');

  useEffect(() => {
    if (isIOS) setGuideTab('ios');
    else if (isAndroid) setGuideTab('android');
  }, [isIOS, isAndroid]);

  useEffect(() => {
    const handleOpen = () => {
      setDismissed(false);
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {}
      setShowGuideModal(true);
    };
    window.addEventListener('cekb:open-install-prompt', handleOpen);
    return () => window.removeEventListener('cekb:open-install-prompt', handleOpen);
  }, []);

  if (isInstalled) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  const handleAndroidDownload = async () => {
    if (isInstallable) {
      const ok = await installPWA();
      if (ok) {
        toast.showSuccess('CEKB App Installed', 'The app has been downloaded to your device.');
        return;
      }
    }
    setGuideTab('android');
    setShowGuideModal(true);
  };

  const handleIOSSave = () => {
    setGuideTab('ios');
    setShowGuideModal(true);
  };

  return (
    <>
      {/* Floating Prompt Box for Downloading (Android) or Saving to Home Screen (iOS) */}
      {!dismissed && (
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
                    {isIOS ? 'Save CEKB to Your Home Screen' : 'Download CEKB to Your Device'}
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
                  ? 'Add this website to your iPhone or iPad Home Screen for instant full-screen check-in, cell reports, and QR scanning.'
                  : 'Download the CEKB app on Android or save it to your iOS Home Screen for one-tap access without browser bars.'}
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {!isIOS && (
                  <Button variant="primary" onClick={handleAndroidDownload} className="flex-1 min-w-[150px]">
                    <span className="material-symbols-outlined">download</span>
                    <span>{isAndroid ? 'Download App' : 'Download (Android)'}</span>
                  </Button>
                )}
                <Button
                  variant={isIOS ? 'primary' : 'secondary'}
                  onClick={handleIOSSave}
                  className="flex-1 min-w-[150px]"
                >
                  <span className="material-symbols-outlined">ios_share</span>
                  <span>{isIOS ? 'Save to Home Screen' : 'Save on iPhone (iOS)'}</span>
                </Button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Guided Installation Modal for Android Download & iOS Add to Home Screen */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl text-foreground space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center border border-border p-1.5">
                  <ChurchLogo className="w-full h-full object-contain" alt="CEKB Logo" />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-lg text-foreground">
                    Get the CEKB App
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Full-screen app experience on Android &amp; iOS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close installation guide"
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Platform Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted">
              <Button
                variant={guideTab === 'android' ? 'primary' : 'ghost'}
                onClick={() => setGuideTab('android')}
                className="w-full"
              >
                <span className="material-symbols-outlined">android</span>
                <span>Android Download</span>
              </Button>
              <Button
                variant={guideTab === 'ios' ? 'primary' : 'ghost'}
                onClick={() => setGuideTab('ios')}
                className="w-full"
              >
                <span className="material-symbols-outlined">phone_iphone</span>
                <span>iPhone / iPad (iOS)</span>
              </Button>
            </div>

            {guideTab === 'android' ? (
              <div className="space-y-3 text-xs bg-muted/60 p-4 rounded-2xl border border-border">
                <p className="font-semibold text-foreground">
                  Download &amp; install the CEKB app on Android:
                </p>
                {isInstallable && (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={async () => {
                      const ok = await installPWA();
                      if (ok) {
                        setShowGuideModal(false);
                        toast.showSuccess('CEKB App Installed', 'Added to your device home screen.');
                      }
                    }}
                  >
                    <span className="material-symbols-outlined">download</span>
                    <span>Install CEKB App Now</span>
                  </Button>
                )}
                <ol className="space-y-2.5 text-muted-foreground list-decimal list-inside">
                  <li>
                    Open this website in <strong className="text-foreground">Google Chrome</strong> on your Android phone.
                  </li>
                  <li>
                    Tap the <strong className="text-foreground">Three Dots menu</strong>{' '}
                    <span className="material-symbols-outlined text-[15px] inline-block align-middle">more_vert</span>{' '}
                    in the top-right corner of Chrome.
                  </li>
                  <li>
                    Tap <strong className="text-primary">&ldquo;Install app&rdquo;</strong> or{' '}
                    <strong className="text-primary">&ldquo;Add to Home screen&rdquo;</strong>, then confirm.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs bg-muted/60 p-4 rounded-2xl border border-border">
                <p className="font-semibold text-foreground">
                  Save CEKB to your iPhone or iPad Home Screen:
                </p>
                <ol className="space-y-2.5 text-muted-foreground list-decimal list-inside">
                  <li>
                    Open this website in <strong className="text-foreground">Safari</strong> on your iPhone or iPad.
                  </li>
                  <li>
                    Tap the <strong className="text-foreground">Share button</strong>{' '}
                    <span className="material-symbols-outlined text-[15px] inline-block align-middle">ios_share</span>{' '}
                    at the bottom of Safari.
                  </li>
                  <li>
                    Scroll down and select{' '}
                    <strong className="text-primary">&ldquo;Add to Home Screen&rdquo;</strong>{' '}
                    <span className="material-symbols-outlined text-[15px] inline-block align-middle">add_box</span>.
                  </li>
                  <li>
                    Tap <strong className="text-foreground">&ldquo;Add&rdquo;</strong> in the top-right corner to launch CEKB from its home screen icon.
                  </li>
                </ol>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowGuideModal(false)} className="w-full">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
