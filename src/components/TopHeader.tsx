import React, { useState } from 'react';
import { ViewType, UserProfile, Member, AuditLogItem } from '../types';

interface TopHeaderProps {
  currentView: ViewType;
  user: UserProfile;
  members: Member[];
  auditLogs?: AuditLogItem[];
  onOpenMobileSidebar: () => void;
  onNavigate: (view: ViewType) => void;
  onSelectMemberForCard?: (member: Member) => void;
  onOpenAnnouncement?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentView,
  user,
  members,
  auditLogs = [],
  onOpenMobileSidebar,
  onNavigate,
  onSelectMemberForCard,
  onOpenAnnouncement
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = auditLogs.slice(0, 10).map(log => ({
    id: log.id,
    title: log.action?.split(':')?.[0]?.split('Registered')?.[1]?.trim() || log.action || 'System Activity',
    time: log.timestamp || 'Just now',
    desc: log.action || 'No details available',
    category: log.category || 'System',
    isRead: readAlerts.has(log.id)
  }));

  const viewTitles: Record<ViewType, string> = {
    home: 'CEKB Attendance Portal',
    login: 'Admin Sign In',
    admin_signup: 'Church Branch Admin Registration',
    self_attendance: 'Self Service Attendance Check-In',
    leader_self_reg: 'Leader Self-Registration',
    dashboard: 'Overview',
    group_overview: 'Churches',
    leaders: 'Leaders',
    leader_registration: 'Register a leader',
    members: 'Member Database',
    attendance: 'Attendance',
    reports: 'Growth Analytics',
    analytics: 'Insights',
    database_schema: 'Database',
    qr_scanner: 'QR Check-In Station',
    hierarchy: 'Leader Hierarchy',
    register: 'Member Check-In',
    church_admins_directory: 'Church admins',
    cell_reports: 'Weekly Cell Reports',
    settings: 'Settings'
  };

  const cleanHeaderSearch = (searchQuery || '').trim().toLowerCase();
  const filteredMembers = cleanHeaderSearch
    ? members.filter(m => {
      if (!m) return false;
      const nameStr = (m.fullName || '').toLowerCase();
      const idStr = (m.id || '').toLowerCase();
      const phoneStr = m.phone || '';
      return nameStr.includes(cleanHeaderSearch) || idStr.includes(cleanHeaderSearch) || phoneStr.includes(cleanHeaderSearch);
    }).slice(0, 5)
    : [];

  return (
    <header className="dashboard-topbar bg-white/90 backdrop-blur-md border-b border-slate-200/90 w-full h-16 sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between shadow-sm">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <div className="flex items-center gap-2.5">
          <h1 className="font-headline text-lg md:text-xl text-slate-900 font-bold tracking-tight">
            {viewTitles[currentView] || 'CEKB Admin'}
          </h1>

        </div>
      </div>

      {/* Middle/Right: Global Search, Quick Actions, Profile */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Global Search */}
        <div className="relative hidden sm:block">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search members or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="pl-9 pr-8 py-1.5 w-48 md:w-64 bg-slate-100/80 border border-slate-200 rounded-xl font-body text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all placeholder:text-slate-400"
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                className="absolute right-2.5 text-slate-400 hover:text-slate-700 p-0.5"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            ) : (
              <kbd className="absolute right-2.5 text-xs font-semibold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300/50">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Search Autocomplete Dropdown */}
          {showSearchResults && searchQuery.trim().length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-sm z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-bold uppercase text-slate-400 flex justify-between bg-slate-50">
                <span>Search Results</span>
                <span>{filteredMembers.length} found</span>
              </div>
              {filteredMembers.length > 0 ? (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectMemberForCard?.(m);
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-none cursor-pointer group"
                  >
                    <div>
                      <p className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors">{m.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.id} • {m.role} • {m.church}</p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-blue-600 bg-blue-50 p-1 rounded-lg">badge</span>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                  No member found for "{searchQuery}"
                </div>
              )}
              <div className="bg-slate-50 p-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    onNavigate('members');
                    setShowSearchResults(false);
                  }}
                  className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  View full database →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Broadcast Announcement Button */}
        {onOpenAnnouncement && (
          <button
            onClick={onOpenAnnouncement}
            className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Send Announcement"
          >
            <span className="material-symbols-outlined text-[16px] text-blue-700 icon-fill">campaign</span>
            <span>Broadcast</span>
          </button>
        )}

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white animate-pulse"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-sm z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 bg-blue-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-blue-200">notifications_active</span>
                  <h3 className="font-semibold text-xs ">Notifications</h3>
                </div>
                <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">{notifications.filter(n => !n.isRead).length} new</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-xs text-slate-900">{n.title}</p>
                      <span className="text-xs text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{n.desc}</p>
                  </div>
                ))}
              </div>
              <div className="p-2 bg-slate-50 text-center border-t border-slate-100">
                <button
                  onClick={() => {
                    const newReadAlerts = new Set(auditLogs.map(log => log.id));
                    setReadAlerts(newReadAlerts);
                    setShowNotifications(false);
                  }}
                  className="text-xs text-blue-700 font-semibold hover:text-blue-900 cursor-pointer"
                >
                  {readAlerts.size > 0 ? 'Marked all as read' : 'Mark all as read'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-700 text-white font-bold text-xs flex items-center justify-center border border-blue-200 shadow-xs shrink-0">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="hidden lg:block text-left">
            <p className="font-semibold text-xs text-slate-900 leading-tight">{user.name}</p>
            <p className="text-xs text-blue-700 font-semibold leading-tight">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
