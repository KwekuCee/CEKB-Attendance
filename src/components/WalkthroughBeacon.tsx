import React, { useState } from 'react';
import { ViewType } from '../types';

interface WalkthroughBeaconProps {
  currentView?: ViewType;
  onStartFullTour: () => void;
  onStartPageTour: () => void;
}

const VIEW_LABELS: Partial<Record<ViewType, string>> = {
  dashboard: 'Overview Command Center',
  leaders: 'PCF & Cell Leaders',
  hierarchy: 'Leader Hierarchy',
  members: 'Members Database',
  attendance: 'Attendance Records',
  evangelism: 'Evangelism & Souls',
  cell_reports: 'Weekly Cell Reports',
  analytics: 'Insights & Analytics',
  settings: 'Branch Settings',
  group_overview: 'Churches Overview',
  church_admins_directory: 'Church Admins Directory',
  qr_scanner: 'QR Scanner Station',
  leader_registration: 'Leader Registration',
  register: 'Member Check-In',
};

export const WalkthroughBeacon: React.FC<WalkthroughBeaconProps> = ({
  currentView = 'dashboard',
  onStartFullTour,
  onStartPageTour,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const pageName = VIEW_LABELS[currentView] || 'This Page';

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-20 md:bottom-6 right-5 z-[9980] w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-blue-400 border border-blue-500/40 shadow-xl backdrop-blur-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
        title="Open Guide Beacon"
        aria-label="Open walkthrough guide beacon"
      >
        <span className="material-symbols-outlined text-[20px]">tour</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-5 z-[9980] flex flex-col items-end select-none">
      {/* Expanded Quick Tour Menu */}
      {isOpen && (
        <div className="mb-2 w-72 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 space-y-2 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 text-white">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
              <span className="material-symbols-outlined text-[16px]">explore</span>
              <span>Interactive Guide</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-300 leading-snug">
            Choose how you would like to explore the platform:
          </p>

          <div className="space-y-1.5 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onStartFullTour();
              }}
              className="w-full text-left p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white group-hover:text-blue-300">
                  Full Master Tour
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  All sidebar features &amp; deep-dives
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onStartPageTour();
              }}
              className="w-full text-left p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">auto_stories</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                  Tour {pageName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Spotlight filters, tools &amp; tables on this screen
                </div>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span>Tip: Press ESC anytime to exit</span>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(true);
              }}
              className="hover:text-slate-200 underline cursor-pointer"
            >
              Minimize
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Trigger Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 bg-slate-900/90 hover:bg-slate-900 text-white px-3.5 py-2 rounded-full border border-blue-500/40 shadow-xl hover:shadow-blue-500/20 backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95"
        title="Open Interactive Tour & Guide"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
        </span>
        <span className="material-symbols-outlined text-[17px] text-blue-400 group-hover:rotate-12 transition-transform">
          tour
        </span>
        <span className="text-xs font-bold tracking-wide">
          {isOpen ? 'Close Guide' : 'Guide Me'}
        </span>
      </button>
    </div>
  );
};
