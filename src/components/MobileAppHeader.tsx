import React, { useState } from 'react';
import { ViewType } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToast } from '../context/ToastContext';

interface MobileAppHeaderProps {
  currentView: ViewType;
  user?: {
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
  };
  onNavigate: (view: ViewType) => void;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}

export const MobileAppHeader: React.FC<MobileAppHeaderProps> = ({
  currentView,
  user,
  onNavigate,
  onOpenMobileMenu,
  onLogout,
}) => {
  const { isInstalled, installPWA } = usePWAInstall();
  const toast = useToast();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  const logoUrl = '/church-logo.png';

  const handleInstallClick = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream;
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    const success = await installPWA();
    if (success) {
      toast.showSuccess('App Installed!', 'CEKB App added to your device home screen.');
    } else {
      setShowIOSInstructions(true);
    }
  };

  const getPageTitle = (view: ViewType) => {
    switch (view) {
      case 'dashboard':
        return user?.role === 'Superadmin' ? 'Group HQ' : 'Church Dashboard';
      case 'members':
        return 'Members Directory';
      case 'leaders':
        return 'PCF & Cell Leaders';
      case 'attendance':
        return 'Attendance Register';
      case 'analytics':
        return 'Growth Analytics';
      case 'qr_scanner':
        return 'Live QR Scanner';
      case 'register':
        return 'Member Registration';
      case 'leader_registration':
        return 'Appoint Leader';
      case 'group_overview':
        return 'Network Overview';
      case 'settings':
        return 'Settings & Sync';
      default:
        return 'CEKB';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/90 px-3.5 py-2.5 md:hidden shadow-xs">
        {/* iOS-style Top Bar */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: App Logo & Current Screen Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => onNavigate('dashboard')}
              className="relative shrink-0 w-9 h-9 rounded-xl bg-blue-700 p-0.5 shadow-sm shadow-blue-700/20 active:scale-95 transition-transform cursor-pointer flex items-center justify-center overflow-hidden"
              aria-label="Go to Dashboard"
            >
              <img
                src={logoUrl}
                alt="CEKB Logo"
                className="w-full h-full object-cover rounded-[10px]"
              />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-headline font-extrabold text-sm text-slate-900 tracking-tight truncate leading-tight">
                  {getPageTitle(currentView)}
                </span>
                {user?.role === 'Superadmin' ? (
                  <span className="font-label-mono text-[8px] text-blue-700 font-bold uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                    HQ
                  </span>
                ) : (
                  <span className="font-label-mono text-[8px] text-blue-700 font-bold uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 truncate max-w-[80px] shrink-0">
                    {user?.church || 'Church'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-body font-medium truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>CEKB Network</span>
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Install Mobile App"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                <span>App</span>
              </button>
            )}

            {/* Quick QR Scanner Trigger (Church Admin Only) */}
            {user?.role !== 'Superadmin' && (
              <button
                onClick={() => onNavigate('qr_scanner')}
                className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 ${currentView === 'qr_scanner'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                title="Scanner"
                aria-label="Scan QR Pass"
              >
                <span className="material-symbols-outlined text-[19px]">qr_code_scanner</span>
              </button>
            )}

            {/* More Drawer Trigger */}
            <button
              onClick={onOpenMobileMenu}
              className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer active:scale-95"
              title="Navigation Menu"
              aria-label="Open App Menu"
            >
              <span className="material-symbols-outlined text-[19px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* iOS & Android Manual Installation Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-sm text-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <span className="material-symbols-outlined text-[22px]">install_mobile</span>
                </div>
                <h3 className="font-headline font-bold text-base text-slate-900">
                  Install Mobile App
                </h3>
              </div>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-body">
              Add this app directly to your home screen so it opens like an app for quick check-ins:
            </p>

            <div className="space-y-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex items-start gap-2.5">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                  iOS
                </span>
                <p className="text-slate-700">
                  Tap Safari's <strong className="text-slate-900">Share button</strong> <span className="material-symbols-outlined text-[14px] inline-block align-middle">share</span> then select <strong className="text-blue-700">"Add to Home Screen"</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5 border-t border-slate-200 pt-2.5">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                  Android
                </span>
                <p className="text-slate-700">
                  Tap Chrome's <strong className="text-slate-900">Three Dots menu</strong> <span className="material-symbols-outlined text-[14px] inline-block align-middle">more_vert</span> then select <strong className="text-blue-700">"Install app"</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-98"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

