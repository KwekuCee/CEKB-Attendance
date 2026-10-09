import React, { useState } from 'react';
import { ViewType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface MobileBottomNavProps {
  currentView: ViewType;
  user?: {
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
  };
  onNavigate: (view: ViewType) => void;
  onOpenAnnouncementModal?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  user,
  onNavigate,
  onOpenAnnouncementModal,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isSuperadmin = user?.role === 'Superadmin';

  const navTabs: { id: ViewType; label: string; icon: string }[] = isSuperadmin ? [
    { id: 'dashboard', label: 'HQ Home', icon: 'shield' },
    { id: 'group_overview', label: 'Network', icon: 'account_tree' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'leaders', label: 'Leaders', icon: 'diversity_3' },
  ] : (user?.role as string) === 'Church Pastor' ? [
    { id: 'dashboard', label: 'Home', icon: 'grid_view' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'hierarchy', label: 'Hierarchy', icon: 'account_tree' },
    { id: 'leaders', label: 'Leaders', icon: 'military_tech' },
  ] : [
    { id: 'dashboard', label: 'Home', icon: 'grid_view' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'qr_scanner', label: 'Scan', icon: 'qr_code_scanner' },
    { id: 'leaders', label: 'Leaders', icon: 'military_tech' },
  ];

  return (
    <>
      {/* Mobile Slide-Up Quick Actions Sheet */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreMenu(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/90 rounded-t-3xl p-5 md:hidden shadow-sm text-slate-900 safe-area-bottom"
            >
              {/* Native Drag Handle */}
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                    <span className="material-symbols-outlined text-[18px]">apps</span>
                  </div>
                  <h3 className="font-headline font-bold text-base text-slate-900">App Actions & Features</h3>
                </div>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <button
                  onClick={() => { onNavigate('attendance'); setShowMoreMenu(false); }}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-2xl transition-all cursor-pointer text-center group active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">fact_check</span>
                  </div>
                  <span className="font-headline font-bold text-xs text-slate-900">Attendance Log</span>
                  <span className="text-xs text-slate-500 mt-0.5">Sunday Register</span>
                </button>

                <button
                  onClick={() => { onNavigate('analytics'); setShowMoreMenu(false); }}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-2xl transition-all cursor-pointer text-center group active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">analytics</span>
                  </div>
                  <span className="font-headline font-bold text-xs text-slate-900">Analytics</span>
                  <span className="text-xs text-slate-500 mt-0.5">Insights</span>
                </button>

                <button
                  onClick={() => { onNavigate('register'); setShowMoreMenu(false); }}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-2xl transition-all cursor-pointer text-center group active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">person_add</span>
                  </div>
                  <span className="font-headline font-bold text-xs text-slate-900">New Registration</span>
                  <span className="text-xs text-slate-500 mt-0.5">Members & Guests</span>
                </button>

                <button
                  onClick={() => { onNavigate('leader_registration'); setShowMoreMenu(false); }}
                  className="flex flex-col items-center justify-center p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-2xl transition-all cursor-pointer text-center group active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">military_tech</span>
                  </div>
                  <span className="font-headline font-bold text-xs text-slate-900">Appoint Leader</span>
                  <span className="text-xs text-slate-500 mt-0.5">PCF & Cell Leads</span>
                </button>

                {onOpenAnnouncementModal && (
                  <button
                    onClick={() => { onOpenAnnouncementModal(); setShowMoreMenu(false); }}
                    className="col-span-2 flex items-center justify-center gap-2 p-3 bg-blue-700 hover:bg-blue-800 text-white rounded-2xl transition-all cursor-pointer font-headline font-bold text-xs shadow-xs active:scale-98"
                  >
                    <span className="material-symbols-outlined text-[20px]">campaign</span>
                    <span>Broadcast Network Announcement</span>
                  </button>
                )}

                <button
                  onClick={() => { onNavigate('settings'); setShowMoreMenu(false); }}
                  className="col-span-2 flex items-center justify-center gap-2 p-3 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-2xl transition-all cursor-pointer text-slate-800 font-headline font-bold text-xs active:scale-98"
                >
                  <span className="material-symbols-outlined text-[20px] text-slate-600">settings</span>
                  <span>App & System Settings</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Native Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-slate-200/90 px-3 py-1.5 md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.06)] safe-area-bottom"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navTabs.map(tab => {
            const isActive = currentView === tab.id;
            const isScannerTab = tab.id === 'qr_scanner';

            if (isScannerTab) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onNavigate(tab.id)}
                  className="relative -top-3.5 flex flex-col items-center cursor-pointer group"
                  aria-label="Open Live QR Scanner"
                >
                  <div className={`w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-700/35 transition-transform active:scale-90 border-3 border-white ${isActive ? 'ring-2 ring-blue-700 ring-offset-2' : ''}`}>
                    <span className="material-symbols-outlined text-[24px] font-bold">
                      qr_code_scanner
                    </span>
                  </div>
                  <span className="text-xs font-headline font-bold text-blue-700 mt-0.5">
                    Scanner
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`relative flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer active:scale-95 ${
                  isActive ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className={`material-symbols-outlined text-[22px] transition-transform ${isActive ? 'scale-110 icon-fill text-blue-700' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>
                <span className={`text-xs font-headline font-semibold mt-0.5 ${isActive ? 'font-bold text-blue-700' : 'text-slate-500'}`}>
                  {tab.label}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute -bottom-0.5 w-1.5 h-1.5 bg-blue-700 rounded-full"
                  />
                )}
              </button>
            );
          })}

          {/* More Menu Drawer Trigger */}
          <button
            onClick={() => setShowMoreMenu(prev => !prev)}
            className={`relative flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              showMoreMenu ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${showMoreMenu ? 'text-blue-700' : 'text-slate-400'}`}>
              widgets
            </span>
            <span className={`text-xs font-headline font-semibold mt-0.5 ${showMoreMenu ? 'font-bold text-blue-700' : 'text-slate-500'}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

