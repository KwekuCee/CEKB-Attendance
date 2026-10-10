import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __cekbDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' ? window.__cekbDeferredPrompt || null : null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.__cekbDeferredPrompt = globalDeferredPrompt;
  });
}

async function fetchIconBase64(): Promise<string> {
  try {
    const res = await fetch('/icon-192.png');
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '');
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * Generates and downloads an iOS WebClip (.mobileconfig) directly to the iPhone/iPad
 * so iOS triggers its native "Install Profile / Save Web App to Home Screen" dialog immediately.
 */
export async function triggerIOSSaveToDevice(): Promise<boolean> {
  const origin = window.location.origin;
  const iconB64 = await fetchIconBase64();
  const iconEntry = iconB64
    ? `      <key>Icon</key>\n      <data>${iconB64}</data>\n`
    : '';

  const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>IgnoreManifestScope</key>
      <false/>
      <key>IsRemovable</key>
      <true/>
${iconEntry}      <key>Label</key>
      <string>CEKB</string>
      <key>PayloadDescription</key>
      <string>Installs the CEKB Group Web App on your Home Screen</string>
      <key>PayloadDisplayName</key>
      <string>CEKB Group Web App</string>
      <key>PayloadIdentifier</key>
      <string>online.gcycattendance.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>3E8B2090-2A27-4247-AAEB-5D4A46117EF7</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${origin}/</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Saves the CEKB Group Attendance &amp; Church Management App directly to your iPhone or iPad Home Screen.</string>
  <key>PayloadDisplayName</key>
  <string>CEKB Group App</string>
  <key>PayloadIdentifier</key>
  <string>online.gcycattendance.profile</string>
  <key>PayloadOrganization</key>
  <string>Christ Embassy Korle Bu (CEKB Group)</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>9A1F3B42-8E11-4C90-9C12-7E5A88D10921</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  const blob = new Blob([mobileconfig], { type: 'application/x-apple-aspen-config' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CEKB-App.mobileconfig';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/**
 * Fallback direct app launcher download when the browser does not expose beforeinstallprompt
 * (e.g. inside an embedded preview frame or non-Chromium browser).
 */
function downloadStandaloneAppLauncher(): boolean {
  const origin = window.location.origin;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#000f22" />
  <title>CEKB Group App</title>
  <link rel="icon" href="${origin}/icon-192.png" />
  <link rel="apple-touch-icon" href="${origin}/icon-192.png" />
  <meta http-equiv="refresh" content="0;url=${origin}/" />
  <style>
    html, body { margin: 0; height: 100%; background: #000f22; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <script>window.location.replace(${JSON.stringify(origin + '/')});</script>
  <p>Launching CEKB Group…</p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CEKB-App.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt || (typeof window !== 'undefined' ? window.__cekbDeferredPrompt || null : null)
  );
  const [isInstallable, setIsInstallable] = useState<boolean>(
    () => Boolean(globalDeferredPrompt || (typeof window !== 'undefined' && window.__cekbDeferredPrompt))
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    const syncPrompt = () => {
      const p = window.__cekbDeferredPrompt || globalDeferredPrompt;
      if (p) {
        globalDeferredPrompt = p;
        setDeferredPrompt(p);
        setIsInstallable(true);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      window.__cekbDeferredPrompt = globalDeferredPrompt;
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      window.__cekbDeferredPrompt = null;
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    syncPrompt();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('cekb:installable', syncPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('cekb:installable', syncPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || globalDeferredPrompt || window.__cekbDeferredPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult.outcome === 'accepted') {
          globalDeferredPrompt = null;
          window.__cekbDeferredPrompt = null;
          setIsInstalled(true);
          setIsInstallable(false);
          setDeferredPrompt(null);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error triggering PWA installation prompt:', err);
      }
    }
    // Directly trigger download of the app launcher to the device
    return downloadStandaloneAppLauncher();
  }, [deferredPrompt]);

  const saveIOS = useCallback(async (): Promise<boolean> => {
    return await triggerIOSSaveToDevice();
  }, []);

  const triggerInstallOrSave = useCallback(async (): Promise<boolean> => {
    const ua = window.navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) {
      return await triggerIOSSaveToDevice();
    }
    return await installPWA();
  }, [installPWA]);

  const openPromptBox = useCallback(() => {
    window.dispatchEvent(new CustomEvent('cekb:open-install-prompt'));
  }, []);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    installPWA,
    saveIOS,
    triggerInstallOrSave,
    deferredPrompt,
    openPromptBox,
  };
}
