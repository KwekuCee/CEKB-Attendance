import React from 'react';
import type { AuthSessionUser, Leader } from '../types';
import { Button } from './Button';
import { MemberPhoto } from './MemberPhoto';

export type LeaderTab = 'overview' | 'evangelism' | 'members' | 'cell_report';

interface LeaderSidebarProps {
  currentTab: LeaderTab;
  user: AuthSessionUser;
  leader?: Leader;
  onNavigate: (tab: LeaderTab) => void;
  onSubmitCellReportClick: () => void;
  onLogout: () => void;
  onStartWalkthrough?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const LeaderSidebar: React.FC<LeaderSidebarProps> = ({
  currentTab,
  user,
  leader,
  onNavigate,
  onSubmitCellReportClick,
  onLogout,
  onStartWalkthrough,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const handleNav = (tab: LeaderTab) => {
    if (tab === 'cell_report') {
      onSubmitCellReportClick();
    } else {
      onNavigate(tab);
    }
    onCloseMobile?.();
  };

  const navItems: { id: LeaderTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'space_dashboard' },
    { id: 'evangelism', label: 'Evangelism & Souls', icon: 'campaign' },
    { id: 'members', label: 'My Cell Members', icon: 'group' },
    { id: 'cell_report', label: 'Submit cell report', icon: 'assignment' },
  ];

  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop fixed inset-0 z-40 md:hidden bg-slate-900/60 backdrop-blur-sm"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Leader portal navigation"
        className={`dashboard-sidebar fixed flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="sidebar-brand flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icon-512.png" alt="CEKB Logo" className="sidebar-brand-logo w-8 h-8 rounded-lg" />
            <h1 className="font-headline font-bold text-base text-white tracking-tight">
              CEKB<span className="text-blue-400 font-normal ml-1">Leader</span>
            </h1>
          </div>
          {onCloseMobile && (
            <Button
              variant="ghost"
              className="sidebar-close md:hidden text-slate-400 hover:text-white p-1"
              aria-label="Close navigation"
              onClick={onCloseMobile}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
            </Button>
          )}
        </div>

        {/* Church & Leader Context */}
        <div className="sidebar-context mt-4 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
          <span className="sidebar-context-icon material-symbols-outlined text-blue-400 text-xl" aria-hidden="true">
            church
          </span>
          <div className="min-w-0 flex-1">
            <span className="sidebar-caption block text-[10px] uppercase font-semibold text-slate-400 tracking-wider truncate">
              {user.church}
            </span>
            <strong className="block text-xs font-bold text-white truncate">
              {leader ? `${leader.leaderType} · ${leader.cellOrPcfName || 'Cell'}` : 'Leader Portal'}
            </strong>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="sidebar-navigation flex-1 mt-5 space-y-1 overflow-y-auto" aria-label="Leader menu">
          <p className="sidebar-caption sidebar-section-label text-[10px] uppercase font-bold text-slate-400 px-2 mb-2 tracking-wider">
            Menu
          </p>

          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className="sidebar-menu-item"
              aria-current={currentTab === item.id ? 'page' : undefined}
              onClick={() => handleNav(item.id)}
            >
              <span className="sidebar-menu-icon">
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              </span>
              <span className="sidebar-menu-label">{item.label}</span>
            </Button>
          ))}
        </nav>

        {/* Account Footer with Logout */}
        <div className="sidebar-account pt-4 border-t border-white/10 mt-auto space-y-3">
          {onStartWalkthrough && (
            <Button
              variant="ghost"
              className="sidebar-menu-item text-slate-300 hover:text-white"
              onClick={() => {
                onStartWalkthrough();
                onCloseMobile?.();
              }}
            >
              <span className="sidebar-menu-icon">
                <span className="material-symbols-outlined text-blue-400" aria-hidden="true">school</span>
              </span>
              <span className="sidebar-menu-label">Watch Walkthrough</span>
            </Button>
          )}

          <p className="sidebar-caption text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">
            Your Account
          </p>

          <div className="sidebar-account-row flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <MemberPhoto
                photoUrl={user.avatar}
                initials={user.name?.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'LD'}
                size={32}
                className="sidebar-avatar ring-1 ring-white/20"
              />
              <div className="sidebar-account-details min-w-0 flex-1">
                <strong className="block text-xs font-bold text-white truncate">{user.name}</strong>
                <span className="block text-[11px] text-slate-400 truncate">{leader?.leaderType || 'Leader'}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              className="sidebar-signout text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded-lg transition"
              onClick={onLogout}
              aria-label="Sign Out"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">logout</span>
            </Button>
          </div>

          <a
            className="sidebar-credit block text-center text-[10px] text-slate-300 hover:text-slate-100 transition py-1"
            href="https://primehaven.tech"
            target="_blank"
            rel="noopener noreferrer"
          >
            Developed by Prime Haven
          </a>
        </div>
      </aside>
    </>
  );
};
