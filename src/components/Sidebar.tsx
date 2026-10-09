import React, { useState } from 'react';
import { ViewType, Member, AttendanceRecord, ChurchBranch, ChurchAdminAccount } from '../types';
import { exportMultiSheetExcel, exportMultiSectionCSV } from '../utils/exportUtils';
import { SupportChat } from './SupportChat';
import { Button } from './Button';

interface SidebarProps {
  currentView: ViewType;
  user?: { name: string; role: 'Superadmin' | 'Church Admin'; church: string };
  members?: Member[];
  attendanceRecords?: AttendanceRecord[];
  churches?: ChurchBranch[];
  churchAdmins?: ChurchAdminAccount[];
  onNavigate: (view: ViewType) => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView, user, members = [], attendanceRecords = [], churches = [], churchAdmins = [],
  onNavigate, onLogout, isMobileOpen = false, onCloseMobile,
}) => {
  const [showSupportChat, setShowSupportChat] = useState(false);
  const isSuperadmin = user?.role === 'Superadmin';
  const navigate = (view: ViewType) => { onNavigate(view); onCloseMobile?.(); };
  const exportRecords = () => {
    try { exportMultiSheetExcel(members, attendanceRecords, churches, churchAdmins); }
    catch { exportMultiSectionCSV(members, attendanceRecords, churches, churchAdmins); }
  };
  const navItems: { id: ViewType; label: string; icon: string }[] = isSuperadmin ? [
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
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'attendance', label: 'Attendance', icon: 'fact_check' },
    { id: 'cell_reports', label: 'Weekly Cell Reports', icon: 'assignment' },
    { id: 'analytics', label: 'Insights', icon: 'analytics' },
    { id: 'leader_registration', label: 'Register New Leader', icon: 'person_add' },
  ];
  const menuItem = (id: ViewType, label: string, icon: string) => (
    <Button key={id} variant="ghost" className="sidebar-menu-item" aria-current={currentView === id ? 'page' : undefined} onClick={() => navigate(id)}>
      <span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></span>
      <span className="sidebar-menu-label">{label}</span>
    </Button>
  );
  return (
    <>
      {isMobileOpen && <div className="sidebar-backdrop fixed inset-0 z-40 md:hidden" onClick={onCloseMobile} />}
      <aside aria-label="Dashboard navigation" className={`dashboard-sidebar fixed flex flex-col z-50 transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="sidebar-brand">
          <img src="/church-logo.png" alt="CEKB Logo" className="sidebar-brand-logo" />
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
        </nav>
        <div className="sidebar-utilities">
          {!isSuperadmin && <Button className="sidebar-scanner-action" onClick={() => navigate('qr_scanner')}><span className="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>Launch Scanner</Button>}
          <Button variant="ghost" className="sidebar-menu-item" onClick={exportRecords} title={isSuperadmin ? 'Export all church and attendance records' : 'Export branch records'}><span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">download</span></span><span className="sidebar-menu-label">{isSuperadmin ? 'Export records' : 'Export Branch Data'}</span></Button>
          <Button variant="ghost" className="sidebar-menu-item" onClick={() => setShowSupportChat(true)}><span className="sidebar-menu-icon"><span className="material-symbols-outlined" aria-hidden="true">help</span></span><span className="sidebar-menu-label">Admin Support</span></Button>
          {menuItem('settings', 'Settings', 'settings')}
        </div>
        <div className="sidebar-account">
          <p className="sidebar-caption">User account</p>
          <div className="sidebar-account-row">
            <span className="sidebar-avatar" aria-hidden="true">{user?.name?.trim().charAt(0).toUpperCase() || 'C'}</span>
            <div className="sidebar-account-details"><strong>{user?.name || 'Administrator'}</strong><span>{isSuperadmin ? 'Group pastor' : 'Church administrator'}</span></div>
            <Button variant="ghost" className="sidebar-signout" onClick={onLogout} aria-label="Sign Out" title="Sign Out"><span className="material-symbols-outlined" aria-hidden="true">logout</span></Button>
          </div>
          <a className="sidebar-credit" href="https://primehaven.tech" target="_blank" rel="noopener noreferrer">Developed by Prime Haven</a>
        </div>
      </aside>
      {showSupportChat && <SupportChat onClose={() => setShowSupportChat(false)} />}
    </>
  );
};
