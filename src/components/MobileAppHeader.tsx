import React from 'react';
import type { AuthSessionUser } from '../types';
import { ViewType } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToast } from '../context/ToastContext';

interface MobileAppHeaderProps {
  currentView: ViewType;
  user?: {
    name: string;
    role: AuthSessionUser['role'];
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
  const { isInstalled, isIOS, triggerInstallOrSave } = usePWAInstall();
  const toast = useToast();

  const logoUrl = '/icon-512.png';

  const handleInstallClick = async () => {
    const success = await triggerInstallOrSave();
    if (success) {
      toast.showSuccess(
        isIOS ? 'Saving to Device' : 'App Install Triggered',
        isIOS
          ? 'Allow the profile download to save the CEKB app icon to your Home Screen.'
          : 'CEKB App installation has been started on your device.'
      );
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
            {user?.role !== 'Superadmin' && (user?.role as string) !== 'Church Pastor' && (
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
    </>
  );
};

