import React, { useEffect, useState } from 'react';
import { rawPortal } from '../lib/rawPortal';
import { isFeatureOn, type FeatureMatrix } from '../lib/features';
import type { AuthSessionUser } from '../types';
import { ViewType, SettingsTab, Member, AttendanceRecord, ChurchBranch, ChurchAdminAccount, Leader } from '../types';
import { exportMultiSheetExcel, exportMultiSectionCSV } from '../utils/exportUtils';
import { SupportChat } from './SupportChat';
import { Button } from './Button';
import { MemberPhoto } from './MemberPhoto';

interface SidebarProps {
  currentView: ViewType;
  user?: { name: string; role: AuthSessionUser['role']; church: string; avatar?: string };
  members?: Member[];
  attendanceRecords?: AttendanceRecord[];
  churches?: ChurchBranch[];
  churchAdmins?: ChurchAdminAccount[];
  leaders?: Leader[];
  onNavigate: (view: ViewType) => void;
  settingsTab: SettingsTab;
  onNavigateSettingsTab: (tab: SettingsTab) => void;
  onLogout: () => void;
  onStartWalkthrough?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView, user, members = [], attendanceRecords = [], churches = [], churchAdmins = [], leaders = [],
  onNavigate, settingsTab, onNavigateSettingsTab, onLogout, onStartWalkthrough, isMobileOpen = false, onCloseMobile,
}) => {
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [matrix, setMatrix] = useState<FeatureMatrix | null>(null);
  useEffect(() => { rawPortal({ action: 'featureMatrix' }, null).then((r: any) => setMatrix(r?.data || null)).catch(() => {}); }, []);
  useEffect(() => {
    if (currentView !== 'settings' && currentView !== 'database_schema') setSettingsExpanded(false);
  }, [currentView]);
  const isSuperadmin = user?.role === 'Superadmin';
  const navigate = (view: ViewType) => { onNavigate(view); onCloseMobile?.(); };
  const exportRecords = () => {
    const isGroup = user?.role === 'Superadmin';
    const inScope = (church: string) => isGroup || (church || '').toLowerCase() === (user?.church || '').toLowerCase();
    const data = {
      members: members.filter(member => inScope(member.church)),
      attendanceRecords: attendanceRecords.filter(record => inScope(record.church)),
      churches: churches.filter(church => inScope(church.name)),
      churchAdmins: churchAdmins.filter(admin => inScope(admin.churchName)),
      leaders: leaders.filter(leader => inScope(leader.church)),
    };
    const filenamePrefix = isGroup ? 'CEKB_Group_Aggregate_Report' : 'CEKB_Church_Aggregate_Report';
    try { exportMultiSheetExcel(data, filenamePrefix); }
    catch { exportMultiSectionCSV(data, filenamePrefix); }
  };
  const allNavItems: { id: ViewType; label: string; icon: string }[] = isSuperadmin ? [
    { id: 'dashboard', label: 'Overview', icon: 'space_dashboard' },
    { id: 'group_overview', label: 'Churches', icon: 'account_tree' },
    { id: 'church_admins_directory', label: 'Church Admins', icon: 'badge' },
    { id: 'leaders', label: 'Leaders', icon: 'diversity_3' },
    { id: 'leader_registration', label: 'Register a leader', icon: 'person_add' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'attendance', label: 'Attendance', icon: 'fact_check' },
    { id: 'cell_reports', label: 'Weekly Cell Reports', icon: 'assignment' },
    { id: 'analytics', label: 'Insights', icon: 'analytics' },
  ] : [
    { id: 'dashboard', label: 'Overview', icon: 'space_dashboard' },
    { id: 'leaders', label: 'PCF & Cell Leaders', icon: 'diversity_3' },
    { id: 'hierarchy', label: 'Leader Hierarchy', icon: 'account_tree' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'attendance', label: 'Attendance', icon: 'fact_check' },
    { id: 'cell_reports', label: 'Weekly Cell Reports', icon: 'assignment' },
    { id: 'analytics', label: 'Insights', icon: 'analytics' },
    { id: 'leader_registration', label: 'Register New Leader', icon: 'person_add' },
  ];
  const navItems = allNavItems.filter(item => isFeatureOn(matrix, user?.role, item.id));
  const canManageMessaging = user?.role === 'Superadmin' || user?.role === 'Church Admin' || user?.role === 'Church Pastor';
  const menuItem = (id: ViewType, label: string, icon: string) => (
    <Button key={id} variant="ghost" className="sidebar-menu-item" aria-current={currentView === id ? 'page' : undefined} onClick={() => navigate(id)}>
      <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></span>
      <span className="sidebar-menu-label">{label}</span>
    </Button>
  );
  const settingsItems: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: isSuperadmin ? 'HQ & Group Profile' : 'Branch Profile', icon: 'account_box' },
    ...(canManageMessaging ? [{ id: 'messaging' as const, label: 'SMS and Messaging', icon: 'sms' }] : []),
    ...(!isSuperadmin ? [{ id: 'ushers' as const, label: 'Appoint Ushers & Scanners', icon: 'badge' }] : []),
    { id: 'scanner', label: 'Scanner & Pass Defaults', icon: 'qr_code_scanner' },
    { id: 'security', label: 'Security & Auth Gate', icon: 'security' },
    ...(isSuperadmin ? [{ id: 'services' as const, label: 'Global Service Programs', icon: 'tune' }] : []),
    { id: 'backup', label: 'Data & Backups', icon: 'backup' },
    { id: 'accountability', label: 'Activity Logs', icon: 'history' },
  ];
  const settingsIsActive = currentView === 'settings' || currentView === 'database_schema';
  const navigateSettingsTab = (tab: SettingsTab) => {
    onNavigateSettingsTab(tab);
    setSettingsExpanded(true);
    onCloseMobile?.();
  };
  return (
    <>
      {isMobileOpen && <div className="sidebar-backdrop fixed inset-0 z-40 md:hidden" onClick={onCloseMobile} />}
      <aside aria-label="Dashboard navigation" className={`dashboard-sidebar fixed flex flex-col z-50 transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="sidebar-brand">
          <img src="/icon-512.png" alt="CEKB Logo" className="sidebar-brand-logo" />
          <h1>CEKB<span>Group</span></h1>
          {onCloseMobile && <Button variant="ghost" className="sidebar-close md:hidden" aria-label="Close navigation" onClick={onCloseMobile}><span className="material-symbols-outlined" aria-hidden="true">close</span></Button>}
        </div>
        <div className="sidebar-context">
          <span className="sidebar-context-icon material-symbols-outlined" aria-hidden="true">church</span>
          <div><span className="sidebar-caption">Your workspace</span><strong>{isSuperadmin ? 'Group pastor' : user?.church || 'Church Admin'}</strong></div>
        </div>
        <nav className="sidebar-navigation" aria-label="Main menu">
          <p className="sidebar-caption sidebar-section-label">Navigation</p>
          {navItems.map(item => menuItem(item.id, item.label, item.icon))}
          {isFeatureOn(matrix, user?.role, 'export') && (
            <Button variant="ghost" className="sidebar-menu-item" onClick={exportRecords} title={isSuperadmin ? 'Export all church and attendance records' : 'Export branch records'}>
              <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">download</span></span>
              <span className="sidebar-menu-label">{isSuperadmin ? 'Export records' : 'Export Branch Data'}</span>
            </Button>
          )}
          {isFeatureOn(matrix, user?.role, 'support') && (
            <Button variant="ghost" className="sidebar-menu-item" onClick={() => setShowSupportChat(true)}>
              <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">help</span></span>
              <span className="sidebar-menu-label">Admin Support</span>
            </Button>
          )}
          <Button
            variant="ghost"
            className="sidebar-menu-item"
            aria-current={settingsIsActive ? 'page' : undefined}
            aria-expanded={settingsExpanded}
            aria-controls="sidebar-settings-submenu"
            onClick={() => {
              if (currentView !== 'settings') {
                navigate('settings');
                setSettingsExpanded(true);
              } else {
                setSettingsExpanded((expanded) => !expanded);
              }
            }}
          >
            <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">settings</span></span>
            <span className="sidebar-menu-label">Settings</span>
            <span className="material-symbols-outlined sidebar-settings-chevron" aria-hidden="true">
              {settingsExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </Button>
          {settingsExpanded && (
            <div id="sidebar-settings-submenu" className="sidebar-settings-submenu" aria-label="Settings tabs">
              {settingsItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="sidebar-menu-item"
                  aria-current={settingsIsActive && settingsTab === item.id ? 'page' : undefined}
                  onClick={() => navigateSettingsTab(item.id)}
                >
                  <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span></span>
                  <span className="sidebar-menu-label">{item.label}</span>
                </Button>
              ))}
            </div>
          )}
        </nav>
        <div className="sidebar-account">
          {onStartWalkthrough && (
            <Button
              variant="ghost"
              className="sidebar-menu-item mb-2"
              onClick={() => {
                onStartWalkthrough();
                onCloseMobile?.();
              }}
            >
              <span className="sidebar-menu-icon">
                <span className="material-symbols-outlined" aria-hidden="true">school</span>
              </span>
              <span className="sidebar-menu-label">Watch Step-by-Step Walkthrough</span>
            </Button>
          )}
          <p className="sidebar-caption">User account</p>
          <div className="sidebar-account-row">
            <MemberPhoto
              photoUrl={user?.avatar}
              initials={user?.name?.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'C'}
              size={32}
              className="sidebar-avatar"
            />
            <div className="sidebar-account-details"><strong>{user?.name || 'Administrator'}</strong><span>{isSuperadmin ? 'Group pastor' : (user?.role as string) === 'Church Pastor' ? 'Church pastor' : 'Church administrator'}</span></div>
            <Button variant="ghost" className="sidebar-signout" onClick={onLogout} aria-label="Sign Out" title="Sign Out"><span className="material-symbols-outlined" aria-hidden="true">logout</span></Button>
          </div>
          <a className="sidebar-credit" href="https://primehaven.tech" target="_blank" rel="noopener noreferrer">Developed by Prime Haven</a>
        </div>
      </aside>
      {showSupportChat && <SupportChat onClose={() => setShowSupportChat(false)} />}
    </>
  );
};
