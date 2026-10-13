import React, { useState } from 'react';
import type { AuthSessionUser, ViewType } from '../types';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Button } from './Button';

interface MobileBottomNavProps {
  currentView: ViewType;
  user?: { name: string; role: AuthSessionUser['role']; church: string };
  onNavigate: (view: ViewType) => void;
  onOpenAnnouncementModal?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, user, onNavigate, onOpenAnnouncementModal }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const reducedMotion = useReducedMotion();
  const isSuperadmin = user?.role === 'Superadmin';
  const navTabs: { id: ViewType; label: string; icon: string }[] = isSuperadmin ? [
    { id: 'dashboard', label: 'HQ Home', icon: 'shield' },
    { id: 'group_overview', label: 'Network', icon: 'account_tree' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'leaders', label: 'Leaders', icon: 'diversity_3' },
  ] : user?.role === 'Church Pastor' ? [
    { id: 'dashboard', label: 'Home', icon: 'grid_view' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'hierarchy', label: 'Hierarchy', icon: 'account_tree' },
    { id: 'leaders', label: 'Leaders', icon: 'military_tech' },
  ] : [
    { id: 'dashboard', label: 'Home', icon: 'grid_view' },
    { id: 'members', label: 'Members', icon: 'group' },
    { id: 'qr_scanner', label: 'Scanner', icon: 'qr_code_scanner' },
    { id: 'leaders', label: 'Leaders', icon: 'military_tech' },
  ];
  const actions: { id: ViewType; label: string; icon: string }[] = [
    { id: 'attendance', label: 'Attendance Log', icon: 'fact_check' },
    { id: 'evangelism', label: 'Evangelism & Souls', icon: 'campaign' },
    { id: 'cell_reports', label: 'Cell Reports', icon: 'assignment' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics' },
    { id: 'register', label: 'New Registration', icon: 'person_add' },
    { id: 'leader_registration', label: 'Appoint Leader', icon: 'military_tech' },
  ];
  const navigate = (view: ViewType) => { onNavigate(view); setShowMoreMenu(false); };

  return (
    <>
      <AnimatePresence>
        {showMoreMenu && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMoreMenu(false)} className="mobile-actions-backdrop fixed inset-0 z-40 md:hidden" />
          <motion.div role="dialog" aria-modal="true" aria-label="More actions" initial={reducedMotion ? false : { y: '100%' }} animate={{ y: 0 }} exit={reducedMotion ? { opacity: 0 } : { y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} className="mobile-actions-sheet fixed bottom-0 left-0 right-0 z-50 md:hidden">
            <div className="mobile-actions-heading">
              <h3>More actions</h3>
              <Button variant="ghost" aria-label="Close actions" onClick={() => setShowMoreMenu(false)}><span className="material-symbols-outlined" aria-hidden="true">close</span></Button>
            </div>
            <div className="mobile-actions-grid">
              {actions.map(action => <Button key={action.id} variant="ghost" className="mobile-action" onClick={() => navigate(action.id)}><span className="material-symbols-outlined" aria-hidden="true">{action.icon}</span><span>{action.label}</span></Button>)}
              {onOpenAnnouncementModal && <Button variant="ghost" className="mobile-action mobile-action--wide" onClick={() => { onOpenAnnouncementModal(); setShowMoreMenu(false); }}><span className="material-symbols-outlined" aria-hidden="true">campaign</span>Broadcast Announcement</Button>}
              <Button variant="ghost" className="mobile-action mobile-action--wide" onClick={() => navigate('settings')}><span className="material-symbols-outlined" aria-hidden="true">settings</span>Settings</Button>
            </div>
          </motion.div>
        </>}
      </AnimatePresence>
      <nav id="mobile-bottom-navigation" aria-label="Mobile dashboard navigation" className="md:hidden">
        <div className="mobile-nav-items">
          {navTabs.map(tab => <Button key={tab.id} variant="ghost" className="mobile-nav-item" aria-current={currentView === tab.id ? 'page' : undefined} onClick={() => navigate(tab.id)}>
            <span className="mobile-nav-icon"><span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span></span>
            <span>{tab.label}</span>
          </Button>)}
          <Button variant="ghost" className="mobile-nav-item" aria-expanded={showMoreMenu} aria-haspopup="dialog" onClick={() => setShowMoreMenu(prev => !prev)}>
            <span className="mobile-nav-icon"><span className="material-symbols-outlined" aria-hidden="true">widgets</span></span><span>More</span>
          </Button>
        </div>
      </nav>
    </>
  );
};
