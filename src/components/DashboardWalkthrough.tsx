import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { AuthSessionUser, ViewType } from '../types';
import { Button } from './Button';

export interface WalkthroughStep {
  id: string;
  targetSelector: string;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  tip?: string;
  view?: ViewType;
}

interface DashboardWalkthroughProps {
  isOpen: boolean;
  user: {
    id?: string;
    name: string;
    email?: string;
    role: AuthSessionUser['role'];
    church: string;
  };
  currentView?: ViewType;
  onNavigate?: (view: ViewType) => void;
  onClose: () => void;
}

const STORAGE_PREFIX = 'cekb_walkthrough_seen_v2';

export function getWalkthroughStorageKey(user?: { email?: string; name?: string; role?: string }) {
  const id = (user?.email || user?.name || 'default').trim().toLowerCase();
  const role = (user?.role || 'user').trim().toLowerCase();
  return `${STORAGE_PREFIX}:${role}:${id}`;
}

export function hasSeenWalkthrough(user?: { email?: string; name?: string; role?: string }): boolean {
  if (!user) return true;
  try {
    return localStorage.getItem(getWalkthroughStorageKey(user)) === '1';
  } catch {
    return false;
  }
}

export function markWalkthroughSeen(user?: { email?: string; name?: string; role?: string }) {
  if (!user) return;
  try {
    localStorage.setItem(getWalkthroughStorageKey(user), '1');
  } catch {}
}

function getStepsForRole(role: AuthSessionUser['role']): WalkthroughStep[] {
  if (role === 'Leader') {
    return [
      {
        id: 'leader-overview',
        targetSelector: '[data-tour="leader-overview"]',
        title: 'Overview & Group Metrics',
        subtitle: 'Main Dashboard & Rollup Stats',
        icon: 'space_dashboard',
        description:
          'Your command center provides real-time totals for group attendance, today\'s check-ins, your active cell members, and leaders under you.',
        tip: 'Quick shortcuts at the top let you jump into evangelism data or submit cell reports.',
      },
      {
        id: 'leader-attendance',
        targetSelector: '[data-tour="leader-attendance"]',
        title: 'Attendance per Service Date',
        subtitle: 'Cell & PCF Attendance Breakdown',
        icon: 'fact_check',
        description:
          'Review attendance per service date for all members who chose your name under "who invited you" or belong to your cell/PCF group. Filter by date or service type and export to Excel.',
        tip: 'Check first-timer attendance and follow up with absentees directly from this view.',
      },
      {
        id: 'leader-members',
        targetSelector: '[data-tour="leader-members"]',
        title: 'My Cell Members',
        subtitle: 'Directory of Cell & Group Members',
        icon: 'group',
        description:
          'A complete list of members assigned to your cell or imported by the church administration. See their contact info, service attendance counts, and foundation class levels.',
        tip: 'Click any phone number to place a direct call or send a WhatsApp message.',
      },
      {
        id: 'leader-evangelism',
        targetSelector: '[data-tour="leader-evangelism"]',
        title: 'Evangelism & Soulwinning',
        subtitle: 'Outreach & New Convert Tracker',
        icon: 'campaign',
        description:
          'Upload evangelism spreadsheets or log outreach contacts individually. When a contact attends church, move them to the member database with one click.',
        tip: 'Download the preformatted Excel template to easily collect names during soul-winning.',
      },
      {
        id: 'leader-cell-report',
        targetSelector: '[data-tour="leader-cell-report"]',
        title: 'Submit Weekly Cell Report',
        subtitle: 'Weekly Cell Ministry Returns',
        icon: 'assignment',
        description:
          'Unlock the cell report sheet using your church passcode to submit weekly attendance, outreach centre metrics, souls won, and offering figures.',
        tip: 'Your church pastor or admin issues the 4-digit report code each week.',
      },
      {
        id: 'leader-signout',
        targetSelector: '[data-tour="leader-signout"]',
        title: 'Leader Account & Sign Out',
        subtitle: 'Secure Session Control',
        icon: 'logout',
        description:
          'Your active leader profile and church branch are shown here. Click the sign-out button whenever you finish your session.',
        tip: 'You can replay this step-by-step walkthrough anytime by clicking "Watch Walkthrough".',
      },
    ];
  }

  // Admin / Superadmin / Church Pastor / Usher
  return [
    {
      id: 'nav-dashboard',
      targetSelector: '[data-tour="nav-dashboard"]',
      title: 'Command Center & Live Pulse',
      subtitle: 'Overview & Real-time Metrics',
      icon: 'space_dashboard',
      view: 'dashboard',
      description:
        'Track today\'s live attendance check-ins, first-timer arrivals, service program progress, and key pastor alerts across your church.',
      tip: 'The cards now expand to fill the full screen for optimal visibility.',
    },
    {
      id: 'nav-attendance',
      targetSelector: '[data-tour="nav-attendance"]',
      title: 'Attendance & Check-in History',
      subtitle: 'Service Attendance per Date',
      icon: 'fact_check',
      view: 'attendance',
      description:
        'Audit member check-ins per service date, view arrival times, monitor QR scans vs manual check-ins, and export service lists.',
      tip: 'Filter by service type (Sunday, Midweek, Special) to analyze attendance trends.',
    },
    {
      id: 'nav-members',
      targetSelector: '[data-tour="nav-members"]',
      title: 'Members Database & QR Passes',
      subtitle: 'Complete Congregation Directory',
      icon: 'group',
      view: 'members',
      description:
        'Manage member records, track foundation school stages, filter first timers, import spreadsheets, and generate digital QR passes.',
      tip: 'All imported members are automatically matched and linked to their inviting leaders.',
    },
    {
      id: 'nav-leaders',
      targetSelector: '[data-tour="nav-leaders"]',
      title: 'Leaders & Hierarchy Directory',
      subtitle: 'BSCT, Cell & PCF Leadership',
      icon: 'diversity_3',
      view: 'leaders',
      description:
        'Manage your cell leaders, review automatic promotion flags, link BSCT to Cell to PCF tiers, and view downstream attendance rollups.',
      tip: 'Hierarchy links roll up attendance figures so all levels get accurate numbers.',
    },
    {
      id: 'nav-cell_reports',
      targetSelector: '[data-tour="nav-cell_reports"]',
      title: 'Weekly Cell Reports Portal',
      subtitle: 'Cell Ministry Submissions',
      icon: 'assignment',
      view: 'cell_reports',
      description:
        'Review cell reports submitted by leaders, monitor souls won and weekly offerings, and generate weekly church report access codes.',
      tip: 'Generate a new report code before Sunday so leaders can access the submission form.',
    },
    {
      id: 'nav-evangelism',
      targetSelector: '[data-tour="nav-evangelism"]',
      title: 'Evangelism & Soulwinning Analytics',
      subtitle: 'Outreach & Conversion Tracking',
      icon: 'campaign',
      view: 'evangelism',
      description:
        'Monitor soul winning across your church branches, track follow-up progress, and convert outreach contacts into registered church members.',
      tip: 'Leaders can upload bulk outreach spreadsheets directly from their portal.',
    },
    {
      id: 'nav-settings',
      targetSelector: '[data-tour="nav-settings"]',
      title: 'Settings & SMS Messaging',
      subtitle: 'Branch Configuration & Utilities',
      icon: 'settings',
      view: 'settings',
      description:
        'Configure church service start times, appoint ushers & scanner access, set up mNotify SMS notifications, and review security logs.',
      tip: 'Customize your attendance check-in SMS templates to notify members instantly.',
    },
    {
      id: 'nav-signout',
      targetSelector: '[data-tour="nav-signout"]',
      title: 'Account & Sign Out',
      subtitle: 'Secure Session Control',
      icon: 'logout',
      description:
        'Displays your active administrator account, assigned church, and role. Click here to securely sign out of the system.',
      tip: 'Role-based access ensures only authorized administrators can modify church records.',
    },
  ];
}

export const DashboardWalkthrough: React.FC<DashboardWalkthroughProps> = ({
  isOpen,
  user,
  currentView,
  onNavigate,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const steps = getStepsForRole(user.role);
  const currentStep = steps[stepIndex] || steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const resizeRafRef = useRef<number | null>(null);

  // Update target rect on step change, resize or scroll
  const updateRect = () => {
    if (!isOpen || !currentStep) return;
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    // Navigate view if step requires a different view
    if (currentStep.view && onNavigate && currentView !== currentStep.view) {
      onNavigate(currentStep.view);
    }

    // Scroll element into view smoothly if present
    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
      updateRect();
    }, 120);

    const onScrollOrResize = () => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(updateRect);
    };

    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      clearTimeout(timer);
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, stepIndex, currentStep, currentView]);

  // Keyboard navigation: ArrowRight / ArrowLeft / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' && !isLast) {
        setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' && !isFirst) {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirst, isLast, steps.length]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLast) {
      markWalkthroughSeen(user);
      onClose();
    } else {
      setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }
  };

  const handlePrev = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    markWalkthroughSeen(user);
    onClose();
  };

  // Compute position for the floating tooltip card relative to targetRect
  const getPopoverStyle = (): React.CSSProperties => {
    const cardWidth = Math.min(380, window.innerWidth - 32);
    const cardHeight = 280;
    const padding = 16;

    if (!targetRect) {
      // Centered fallback if element not found in DOM
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    const { top, bottom, left, right, width, height } = targetRect;
    const spaceRight = window.innerWidth - right;
    const spaceBottom = window.innerHeight - bottom;
    const spaceTop = top;

    // Prefer to the right of element (e.g. sidebar navigation)
    if (spaceRight >= cardWidth + 24 && left < window.innerWidth / 2) {
      const topPos = Math.max(padding, Math.min(window.innerHeight - cardHeight - padding, top - 20));
      return {
        position: 'fixed',
        left: `${right + 18}px`,
        top: `${topPos}px`,
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    // Next prefer below element
    if (spaceBottom >= cardHeight + 20) {
      const leftPos = Math.max(padding, Math.min(window.innerWidth - cardWidth - padding, left));
      return {
        position: 'fixed',
        top: `${bottom + 14}px`,
        left: `${leftPos}px`,
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    // Next prefer above element
    if (spaceTop >= cardHeight + 20) {
      const leftPos = Math.max(padding, Math.min(window.innerWidth - cardWidth - padding, left));
      return {
        position: 'fixed',
        bottom: `${window.innerHeight - top + 14}px`,
        left: `${leftPos}px`,
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    // Default: anchored inside viewport
    return {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: `${cardWidth}px`,
      zIndex: 9999,
    };
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Step-by-Step Walkthrough"
      className="fixed inset-0 z-[9990] pointer-events-auto"
    >
      {/* Dark Dimmed Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/65 transition-opacity duration-300"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Spotlight Ring Cutout around Target Button */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[9995] rounded-xl"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
            border: '2px solid #3b82f6',
            outline: '4px solid rgba(59, 130, 246, 0.4)',
          }}
        >
          {/* Animated Pulsing Beacon Dot */}
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white" />
          </span>
        </div>
      )}

      {/* Floating Popover Tooltip Explaining the Highlighted Button */}
      <div
        style={getPopoverStyle()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">{currentStep.icon}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                Step {stepIndex + 1} of {steps.length}
              </span>
              <h3 className="font-headline font-bold text-sm text-slate-900 leading-tight">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
            aria-label="Close walkthrough"
            title="Close walkthrough"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Step Explanation */}
        <p className="text-xs text-slate-600 leading-relaxed font-body">
          {currentStep.description}
        </p>

        {/* Helpful Tip */}
        {currentStep.tip && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-700 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">
              lightbulb
            </span>
            <span className="leading-tight">{currentStep.tip}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={handleSkip}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={isFirst}
              onClick={handlePrev}
              className="py-1 px-3 min-h-[34px] text-xs"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back</span>
            </Button>

            <Button
              variant="primary"
              onClick={handleNext}
              className="py-1 px-3 min-h-[34px] text-xs font-bold"
            >
              <span>{isLast ? 'Done' : 'Next'}</span>
              <span className="material-symbols-outlined text-sm">
                {isLast ? 'check' : 'arrow_forward'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
