import React, { useState, useEffect, useRef } from 'react';
import { ViewType, AuthSessionUser } from '../types';
import { useWalkthrough } from '../context/WalkthroughContext';

interface WalkthroughBeaconProps {
  currentView?: ViewType;
  user?: { role: AuthSessionUser['role']; name?: string; church?: string };
}

const PAGE_NAMES: Record<string, string> = {
  dashboard: 'Overview Command Center',
  leaders: 'PCF & Cell Leaders',
  hierarchy: 'Leader Hierarchy',
  members: 'Member Database',
  attendance: 'Attendance Records',
  reports: 'Attendance Records',
  cell_reports: 'Weekly Cell Reports',
  analytics: 'Insights & Analytics',
  settings: 'Branch Settings',
  database_schema: 'Database Schema',
  group_overview: 'Churches Network',
  church_admins_directory: 'Church Admins Directory',
  leader_registration: 'Register a Leader',
  register: 'Register New Member',
  qr_scanner: 'Entrance QR Scanner',
};

export const WalkthroughBeacon: React.FC<WalkthroughBeaconProps> = ({ currentView = 'dashboard', user }) => {
  const { startFullTour, startPageTour } = useWalkthrough();
  const [menuOpen, setMenuOpen] = useState(false);
  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem('cekb_beacon_minimized') === 'true';
    } catch {
      return false;
    }
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const toggleMinimized = (val: boolean) => {
    setMinimized(val);
    try {
      localStorage.setItem('cekb_beacon_minimized', String(val));
    } catch {}
  };

  const currentPageLabel = PAGE_NAMES[currentView] || 'This Page';

  return (
    <div
      ref={menuRef}
      className="fixed z-40 right-4 sm:right-6 bottom-20 md:bottom-6 flex flex-col items-end select-none pointer-events-auto"
      aria-label="Interactive guide beacon"
    >
      {/* Expanded Menu Popover */}
      {menuOpen && (
        <div className="mb-3 w-72 rounded-3xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-4 text-white animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-400 text-[18px]">explore</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white">Interactive Guides</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{user?.role || 'Admin'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="py-3 space-y-2">
            {/* Context-aware Tour this page button */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                startPageTour(currentView);
              }}
              className="w-full text-left p-2.5 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-white transition-all flex items-start gap-3 group cursor-pointer"
            >
              <span className="material-symbols-outlined text-blue-400 text-[20px] shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                location_searching
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">Tour This Page</p>
                  <span className="text-[9px] bg-blue-500/30 text-blue-300 font-bold px-1.5 py-0.5 rounded">Active</span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{currentPageLabel}</p>
              </div>
            </button>

            {/* Master Guided Journey */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                startFullTour();
              }}
              className="w-full text-left p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850 hover:border-slate-600 border border-slate-800 text-white transition-all flex items-start gap-3 group cursor-pointer"
            >
              <span className="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                rocket_launch
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">Start Full Guided Journey</p>
                <p className="text-[11px] text-slate-400 mt-0.5">End-to-end master walkthrough</p>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                toggleMinimized(true);
              }}
              className="hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">visibility_off</span>
              <span>Minimize Beacon</span>
            </button>
            <span className="text-[10px] text-slate-500 font-medium">CEKB Assistant</span>
          </div>
        </div>
      )}

      {/* Floating Beacon Button */}
      {minimized ? (
        <button
          type="button"
          onClick={() => {
            toggleMinimized(false);
            setMenuOpen(true);
          }}
          className="relative w-11 h-11 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-blue-500/40 shadow-2xl backdrop-blur-md flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 group"
          title="Open interactive walkthrough & page guide"
          aria-label="Open interactive walkthrough"
        >
          <span className="absolute -inset-0.5 rounded-full bg-blue-500/20 animate-ping pointer-events-none" />
          <span className="material-symbols-outlined text-blue-400 text-[22px] group-hover:rotate-12 transition-transform">
            school
          </span>
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-950 ring-1 ring-blue-400/50" />
        </button>
      ) : (
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="group relative bg-slate-900/90 hover:bg-slate-800 text-white border border-blue-500/40 shadow-2xl backdrop-blur-md px-3.5 py-2.5 rounded-full flex items-center gap-2 cursor-pointer transition-all hover:border-blue-400/80 hover:shadow-blue-500/20 active:scale-95"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            {/* Glowing animated ping ring */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>

            <span className="material-symbols-outlined text-blue-400 text-[18px]">
              school
            </span>
            <span className="text-xs font-bold tracking-tight">Interactive Tour</span>

            <span className="material-symbols-outlined text-slate-400 text-[16px] transition-transform duration-200 group-hover:translate-y-[-1px]">
              {menuOpen ? 'expand_more' : 'unfold_more'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
