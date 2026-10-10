import React, { useEffect, useState } from 'react';
import { AuthSessionUser, ViewType } from '../types';
import { Button } from './Button';

export interface WalkthroughStep {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  view?: ViewType;
  whatYouSee: string;
  actionChecklist: string[];
  tip: string;
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

const STORAGE_PREFIX = 'cekb_walkthrough_seen_v1';

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
  if (role === 'Superadmin') {
    return [
      {
        id: 'overview',
        title: 'Group Pastor HQ Overview',
        subtitle: 'Group-wide real-time pulse across every registered church branch',
        icon: 'space_dashboard',
        view: 'dashboard',
        whatYouSee:
          'Your main command center displays total registered churches, group-wide membership, today’s live attendance check-ins, upcoming birthdays, foundation class groups, and usher scan activity.',
        actionChecklist: [
          'Review today’s total check-ins and first-timer conversions across all branches.',
          'Check the Upcoming Birthdays and Class Groups panels for pastoral care.',
          'Use the quick-import or export shortcuts to keep records synchronized.',
        ],
        tip: 'Click any metric card or branch summary to drill directly into that church’s live records.',
      },
      {
        id: 'group_overview',
        title: 'Churches Network & Branch Health',
        subtitle: 'Monitor every church in the CEKB Group and add or update branches',
        icon: 'account_tree',
        view: 'group_overview',
        whatYouSee:
          'A complete directory of all churches in the group showing each branch’s Pastor in Charge, member count, PCF/Cell/BSCT leader counts, and active status.',
        actionChecklist: [
          'Add new church branches or update a branch pastor’s details.',
          'Send a group-wide announcement to all churches using the Broadcast button.',
          'Inspect branch-by-branch attendance totals and growth.',
        ],
        tip: 'Member counts update automatically whenever members are added, imported, or transferred.',
      },
      {
        id: 'church_admins',
        title: 'Church Pastors & Admins Directory',
        subtitle: 'Manage branch pastors and administrators across the group',
        icon: 'badge',
        view: 'church_admins_directory',
        whatYouSee:
          'Every Church Pastor and Church Admin account across all branches, including verification status, contact details, and assigned church.',
        actionChecklist: [
          'Verify or update branch administrator contact details.',
          'Review which administrators are assigned to each church branch.',
          'Remove or suspend outdated branch accounts when leadership changes.',
        ],
        tip: 'Only verified accounts can sign in to manage branch records.',
      },
      {
        id: 'leaders',
        title: 'PCF, Cell & BSCT Leaders Directory',
        subtitle: 'Oversee cell ministry leaders and automatic promotion flags',
        icon: 'diversity_3',
        view: 'leaders',
        whatYouSee:
          'All PCF Leaders, Cell Leaders, and Bible Study Class Teachers (BSCT) across the group, along with their assigned member counts and promotion queue.',
        actionChecklist: [
          'Filter leaders by church branch or leadership tier (PCF, Cell, BSCT).',
          'Approve or decline automatic leader promotion alerts when a leader’s network grows.',
          'Edit leader contact details or cell/PCF group names.',
        ],
        tip: 'Use "Register a leader" in the sidebar to appoint new leaders and issue their read-only login credentials.',
      },
      {
        id: 'members',
        title: 'Members & First-Timers Database',
        subtitle: 'Complete directory of members, new converts, and digital QR passes',
        icon: 'group',
        view: 'members',
        whatYouSee:
          'Every registered member across all branches with their 5-week attendance streak, cell leader assignment, department, and follow-up stage.',
        actionChecklist: [
          'Search members by name, phone number, church branch, or leader.',
          'Click any member to open their Digital QR Pass card to download or email.',
          'Edit member profiles or filter for First Timers needing follow-up.',
        ],
        tip: 'First Timers automatically convert to General Members once they reach the configured attendance threshold.',
      },
      {
        id: 'attendance',
        title: 'Service Attendance & Absentees',
        subtitle: 'Live check-in logs, on-time vs. late arrivals, and absentee follow-up',
        icon: 'fact_check',
        view: 'attendance',
        whatYouSee:
          'Timestamped check-in records for Sunday, Midweek, and Special services, showing who checked in via Self Check-In, QR Scan, or Usher Manual entry.',
        actionChecklist: [
          'Filter attendance by date, church branch, or service program.',
          'Switch to the Absentees view to see who missed service and assign follow-up.',
          'Check the Hierarchy Attendance panel to see totals rolled up by PCF and Cell.',
        ],
        tip: 'Arrival times are automatically compared against each church’s configured service start time.',
      },
      {
        id: 'cell_reports',
        title: 'Weekly Cell Reports',
        subtitle: 'Review weekly cell meeting submissions, offerings, and souls won',
        icon: 'assignment',
        view: 'cell_reports',
        whatYouSee:
          'All weekly cell reports submitted by PCF, Cell, and BSCT leaders, including cell attendance, Sunday attendance, first timers, new converts, offerings, testimonies, and leaders yet to submit.',
        actionChecklist: [
          'Filter cell reports by week, church branch, or meeting type.',
          'Click any report to read attendee names, testimonies, and pastoral challenges.',
          'Check the Missing Reports list to see which leaders haven’t submitted this week.',
        ],
        tip: 'Leaders submit reports at /cell-report using their church’s report code configured in Settings.',
      },
      {
        id: 'analytics',
        title: 'Growth Insights & Analytics',
        subtitle: 'Retention funnels, demographics, and multi-sheet exports',
        icon: 'analytics',
        view: 'analytics',
        whatYouSee:
          'Visual analytics covering service attendance trends, first-timer retention, age/gender/department breakdowns, and top-performing leaders.',
        actionChecklist: [
          'Compare attendance growth across services and branches.',
          'Use "Export records" in the sidebar to download a 3-sheet Excel workbook or CSV.',
        ],
        tip: 'The exported Excel workbook includes separate sheets for church totals, service dates, and first-timer conversions.',
      },
      {
        id: 'settings',
        title: 'Settings, Service Programs & Report Codes',
        subtitle: 'Configure HQ profile, cell report codes, global services, and backups',
        icon: 'settings',
        view: 'settings',
        whatYouSee:
          'Your HQ control center with tabs for HQ Profile, Weekly Cell Report Codes, Admin Accountability Logs, Global Service Programs, Scanner Defaults, Security Gate, and Data Backups.',
        actionChecklist: [
          'Set or rotate each church’s Weekly Cell Report Code so leaders can submit reports.',
          'Add or remove Global Service Programs (e.g. Sunday Service, Midweek Service).',
          'Review the Admin Accountability & Action Logs or download a full system backup.',
        ],
        tip: 'Always click "Save All Settings" after updating your HQ profile or service programs.',
      },
    ];
  }

  if (role === 'Church Pastor' || role === 'Church Admin') {
    const isPastor = role === 'Church Pastor';
    return [
      {
        id: 'overview',
        title: isPastor ? 'Welcome to Your Church Pastor Dashboard' : 'Welcome to Your Church Admin Dashboard',
        subtitle: `Step-by-step tour of ${isPastor ? 'pastoral oversight' : 'branch administration'} for your church`,
        icon: 'space_dashboard',
        view: 'dashboard',
        whatYouSee:
          'Your church workspace shows your branch’s total members, today’s check-ins, first timers, cell leaders, upcoming member birthdays, foundation school classes, and live usher scan counts.',
        actionChecklist: [
          'Check today’s live service attendance and first-timer check-ins at a glance.',
          'Set your church’s Service Start Times so the system automatically flags on-time vs. late arrivals.',
          'Use the spreadsheet import panel on the dashboard to bulk-import existing members and leaders.',
        ],
        tip: 'Everything in your dashboard is scoped privately to your church branch.',
      },
      {
        id: 'leaders',
        title: 'PCF & Cell Leaders Directory',
        subtitle: 'Manage your PCF Leaders, Cell Leaders, and BSCT teachers',
        icon: 'diversity_3',
        view: 'leaders',
        whatYouSee:
          'All registered leaders in your church branch, their leadership category (PCF Leader, Cell Leader, BSCT), cell/group name, and the number of members assigned to them.',
        actionChecklist: [
          'Review each leader’s assigned members and attendance rate.',
          'Complete any missing leader profile details in the Incomplete Leaders panel.',
          'Use "Register New Leader" in the sidebar to add leaders and create their login accounts.',
        ],
        tip: 'When a leader registers or is appointed, they receive a read-only leader dashboard to track their group.',
      },
      {
        id: 'hierarchy',
        title: 'Leader Hierarchy (BSCT → Cell → PCF)',
        subtitle: isPastor
          ? 'Link BSCT teachers to Cell Leaders and Cell Leaders to PCF Leaders'
          : 'View how BSCT teachers roll up into Cells and PCFs',
        icon: 'account_tree',
        view: 'hierarchy',
        whatYouSee:
          'Your church’s complete leadership tree showing how BSCT leaders report to Cell Leaders, and Cell Leaders report to PCF Leaders, with rolled-up attendance totals.',
        actionChecklist: isPastor
          ? [
              'Assign each BSCT leader to their parent Cell Leader, and each Cell Leader to their PCF Leader.',
              'Set or update the Cell / PCF group name for each leader.',
              'Verify that attendance totals roll up accurately from BSCT → Cell → PCF.',
            ]
          : [
              'Inspect the BSCT → Cell → PCF reporting tree and rolled-up attendance numbers.',
              'Coordinate with your Church Pastor whenever parent hierarchy links need adjustment.',
            ],
        tip: 'Only the Church Pastor (and Group Pastor) can edit parent hierarchy links, ensuring every screen shows consistent rollup totals.',
      },
      {
        id: 'members',
        title: 'Members & First-Timers Directory',
        subtitle: 'Manage member records, follow-up stages, and digital QR passes',
        icon: 'group',
        view: 'members',
        whatYouSee:
          'Your branch’s complete member database with filters for Status (Member, First Timer, New Convert), Department, Gender, and Assigned Leader.',
        actionChecklist: [
          'Click "+ Register Member" to add a new member or first-timer manually.',
          'Click any member row to view or download their personal QR Check-In Pass.',
          'Update member cell assignments, foundation school progress, or baptism status.',
        ],
        tip: 'You can also email QR passes directly to members so they can scan at the door every service.',
      },
      {
        id: 'attendance',
        title: 'Service Attendance, Hierarchy Rollup & Absentees',
        subtitle: 'Track who attended service, how they checked in, and who missed service',
        icon: 'fact_check',
        view: 'attendance',
        whatYouSee:
          'Live attendance register for your church showing check-in time, on-time/late status, check-in method (Self Check-In, QR Scan, Usher), plus Absentee and Hierarchy Attendance tabs.',
        actionChecklist: [
          'Filter attendance by service date or service program (Sunday Service, Midweek Service).',
          'Open the Absentees tab after service to see members who did not check in and log follow-up calls.',
          'Check the PCF / Cell Attendance rollup to see which cells had the strongest turnout.',
        ],
        tip: 'Members who check in multiple times on the same day for the same service are automatically deduplicated.',
      },
      {
        id: 'cell_reports',
        title: 'Weekly Cell Reports',
        subtitle: 'Track weekly cell meetings, offerings, first-timers, and missing reports',
        icon: 'assignment',
        view: 'cell_reports',
        whatYouSee:
          'Every weekly cell report submitted by your PCF, Cell, and BSCT leaders, with summary totals for Cell Attendance, Sunday Attendance, Souls Won, and Offerings.',
        actionChecklist: [
          'Review submitted reports for the current week and inspect testimonies or challenges.',
          'Check the "Leaders Yet to Submit" list to follow up with leaders who haven’t filed their report.',
          'Export weekly cell report summaries for church review.',
        ],
        tip: 'Leaders submit reports from the public portal ("Cell reports" tab) using your branch’s Cell Report Code.',
      },
      {
        id: 'analytics',
        title: 'Branch Insights & Growth Analytics',
        subtitle: 'Visualize attendance trends, retention, and demographics',
        icon: 'analytics',
        view: 'analytics',
        whatYouSee:
          'Charts and breakdowns of your church’s attendance trajectory, first-timer retention rate, department participation, and age/gender distribution.',
        actionChecklist: [
          'Review week-over-week attendance growth and conversion rates.',
          'Click "Export Branch Data" in the sidebar to download your branch’s Excel or CSV report.',
        ],
        tip: 'Use these insights during leadership meetings to spot cells and departments that need support.',
      },
      {
        id: 'settings',
        title: 'Settings, Report Codes & Appointing Ushers / Admins',
        subtitle: 'Configure branch profile, cell report codes, ushers, and backups',
        icon: 'settings',
        view: 'settings',
        whatYouSee:
          'Your Branch Control Center containing your Weekly Cell Report Code, Ushers & Staff Appointment panel, Branch Profile, Scanner Defaults, Audit Logs, and Data Exports.',
        actionChecklist: [
          'Copy or update your church’s Weekly Cell Report Code and share it with your cell leaders.',
          isPastor
            ? 'Appoint Church Admins and Ushers in the "Ushers & Branch Staff" panel — they will receive their login details automatically.'
            : 'Appoint Ushers in the "Ushers" panel so they can sign in straight to the entrance QR scanner.',
          'Configure scanner sound/vibration preferences and download Excel/CSV backups under Data & Backups.',
        ],
        tip: 'Whenever you need a refresher on any feature, click "Watch Step-by-Step Walkthrough" right above your name in the sidebar!',
      },
    ];
  }

  if (role === 'Leader') {
    return [
      {
        id: 'leader_welcome',
        title: 'Welcome to Your Leader Account',
        subtitle: 'Your personal cell ministry & attendance oversight portal',
        icon: 'diversity_3',
        whatYouSee:
          'Your leader workspace is tailored specifically to your PCF, Cell, or BSCT group within your church branch.',
        actionChecklist: [
          'Verify your leadership role and Cell / PCF group name under your welcome heading.',
          'Use this dashboard before and after every service to monitor your members.',
        ],
        tip: 'Your account is read-only for church-wide settings so you can focus 100% on shepherding your members and leaders.',
      },
      {
        id: 'leader_metrics',
        title: 'Your Group Attendance & Rollup Totals',
        subtitle: 'Automatic rollup of your members and every leader under you',
        icon: 'monitoring',
        whatYouSee:
          'Four live stat cards: Whole Group Attendance, Today’s Check-Ins, Members in Your Group, and Leaders Under You.',
        actionChecklist: [
          'Check "Today" during or right after service to see how many people in your structure checked in.',
          'Compare "Whole group attendance" with "Members in your group" to gauge consistency.',
        ],
        tip: 'If you are a PCF Leader or Cell Leader, these numbers automatically include the cells and BSCT teachers under you!',
      },
      {
        id: 'leader_downstream',
        title: 'Leaders Under You & Your Members List',
        subtitle: 'Track every leader and member connected to your cell structure',
        icon: 'account_tree',
        whatYouSee:
          'A breakdown of downstream leaders reporting to you and a complete list of your assigned/invited members with their total services attended and membership status.',
        actionChecklist: [
          'Check which of your members are still listed as "First Timer" and help them complete check-ins.',
          'Follow up with members whose service count hasn’t increased after Sunday or Midweek service.',
        ],
        tip: 'When new members select your name during self-registration or check-in, they appear in your member list automatically.',
      },
      {
        id: 'leader_cell_report',
        title: 'Submitting Your Weekly Cell Report',
        subtitle: 'Log your weekly cell meeting attendance, offerings, and souls won',
        icon: 'assignment',
        whatYouSee:
          'The "Submit cell report" button at the top of your dashboard opens the Weekly Cell Report form.',
        actionChecklist: [
          'Click "Submit cell report" after your weekly cell meeting.',
          'Select your church, enter the Church Report Code provided by your Pastor/Admin, and pick your name.',
          'Fill in your meeting type, cell attendance, Sunday attendance, first timers, new converts, offering, and attendee names.',
        ],
        tip: 'You can replay this tutorial anytime using the "Watch Step-by-Step Walkthrough" button above your account controls.',
      },
    ];
  }

  // Usher role
  return [
    {
      id: 'usher_scanner',
      title: 'Welcome to the Usher QR Check-In Station',
      subtitle: 'Fast, contactless member verification at the church entrance',
      icon: 'qr_code_scanner',
      whatYouSee:
        'Your account opens directly into the live camera QR Scanner with a target frame, service selector, manual search bar, and today’s scan counter at the top.',
      actionChecklist: [
        'Allow camera access when prompted by your phone or tablet browser.',
        'Point the camera at a member’s Digital QR Pass — attendance logs automatically with a confirmation chime.',
      ],
      tip: 'Duplicate scans for the same member and service on the same day are automatically prevented.',
    },
    {
      id: 'usher_service_lookup',
      title: 'Selecting the Service & Manual Member Lookup',
      subtitle: 'Check in members even if they forgot their QR pass',
      icon: 'person_search',
      whatYouSee:
        'Directly below the camera frame are the Service Program dropdown, the Manual Name/ID Search box, and the "Upload a picture of the pass" button.',
      actionChecklist: [
        'First, confirm the active Service Program (e.g. Sunday Service, Midweek Service) in the dropdown.',
        'If a member forgot their QR pass, type their name or ID in "Or find a member by name or ID" and tap their name.',
        'If a member has a screenshot of their pass on another device, you can also use "Upload a picture of the pass".',
      ],
      tip: 'Only members belonging to your church branch will be confirmed; passes from other branches are flagged immediately.',
    },
    {
      id: 'usher_kiosk',
      title: 'Entrance Kiosk Mode & Flashlight Controls',
      subtitle: 'Hands-free continuous scanning for busy service entrances',
      icon: 'bolt',
      whatYouSee:
        'The "Entrance mode" toggle button below the controls and the Flashlight button in the top-right header.',
      actionChecklist: [
        'Tap "Entrance mode: keep scanning automatically" so the confirmation sheet closes after 2.5 seconds and resets for the next person.',
        'Use the top-right Flashlight button when scanning passes in dim auditoriums or evening services.',
        'Use the "Log out" button at the top when your ushering shift ends.',
      ],
      tip: 'You can re-open this guide anytime by tapping "Watch Step-by-Step Walkthrough" in the top bar.',
    },
  ];
}

export const DashboardWalkthrough: React.FC<DashboardWalkthroughProps> = ({
  isOpen,
  user,
  onNavigate,
  onClose,
}) => {
  const steps = getStepsForRole(user.role);
  const [stepIndex, setStepIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setMinimized(false);
      const firstView = steps[0]?.view;
      if (firstView && onNavigate) {
        onNavigate(firstView);
      }
    }
  }, [isOpen, user.role]);

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progressPct = Math.round(((stepIndex + 1) / steps.length) * 100);

  const goToStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setStepIndex(clamped);
    const targetView = steps[clamped]?.view;
    if (targetView && onNavigate) {
      onNavigate(targetView);
    }
  };

  const handleFinish = () => {
    markWalkthroughSeen(user);
    if (steps[0]?.view && onNavigate) {
      onNavigate(steps[0].view);
    }
    onClose();
  };

  const handleSkip = () => {
    markWalkthroughSeen(user);
    onClose();
  };

  if (minimized) {
    return (
      <div
        role="region"
        aria-label="Step-by-step walkthrough minimized bar"
        className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-2xl border border-slate-700 bg-slate-950/95 text-white p-3.5 shadow-2xl backdrop-blur-xl flex items-center gap-3"
      >
        <div className="w-9 h-9 rounded-xl bg-blue-600/25 border border-blue-400/30 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-blue-300 text-[20px]">{currentStep.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-blue-300 font-semibold">
            Step {stepIndex + 1} of {steps.length} · {currentStep.title}
          </p>
          <p className="text-xs text-slate-300 truncate">Explore this screen, then continue tour</p>
        </div>
        <Button variant="primary" onClick={() => setMinimized(false)}>
          Expand
        </Button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Step-by-Step Walkthrough"
      className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Top Progress & Role Header */}
        <div className="bg-slate-950 text-white px-5 py-4 sm:px-7 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-300 text-[22px]">school</span>
            </div>
            <div>
              <p className="text-xs text-blue-300 font-semibold">
                Interactive Step-by-Step Walkthrough · {user.role === 'Superadmin' ? 'Group Pastor HQ' : user.role}
              </p>
              <h2 className="font-headline font-extrabold text-base sm:text-lg text-white">
                {user.church ? `${user.church} — Guided Feature Tour` : 'CEKB Portal — Guided Feature Tour'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setMinimized(true)}
              title="Minimize walkthrough to interact with the current screen"
            >
              <span className="material-symbols-outlined">open_in_full</span>
              <span className="hidden sm:inline">Preview Screen</span>
            </Button>
            <Button variant="secondary" onClick={handleSkip} aria-label="Close walkthrough">
              <span className="material-symbols-outlined">close</span>
              <span>Close</span>
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100">
          <div
            className="h-full bg-blue-700 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Body: Left Step Navigator + Right Detailed Feature Guide */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
          {/* Step List Rail */}
          <nav
            aria-label="Walkthrough steps"
            className="md:col-span-4 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-3 sm:p-4 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto max-h-44 md:max-h-[440px]"
          >
            {steps.map((s, idx) => {
              const active = idx === stepIndex;
              const done = idx < stepIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors shrink-0 md:shrink cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : done
                        ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                        : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      active
                        ? 'bg-blue-600 text-white'
                        : done
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </span>
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Step Content */}
          <div className="md:col-span-8 p-5 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">{currentStep.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Step {stepIndex + 1} of {steps.length} · {currentStep.subtitle}
                  </p>
                  <h3 className="font-headline font-extrabold text-xl text-slate-900 mt-0.5">
                    {currentStep.title}
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                <p className="text-xs font-bold text-slate-800">What you see on this screen</p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {currentStep.whatYouSee}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-800">What to do here (Step-by-Step)</p>
                <ul className="space-y-2">
                  {currentStep.actionChecklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                      <span className="material-symbols-outlined text-blue-700 text-[18px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-700">
                <span className="material-symbols-outlined text-blue-700 text-[18px] shrink-0">
                  lightbulb
                </span>
                <span>
                  <strong className="text-slate-900">Helpful tip:</strong> {currentStep.tip}
                </span>
              </div>
            </div>

            {/* Footer Controls */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={handleSkip}>
                Skip walkthrough
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={isFirst}
                  onClick={() => goToStep(stepIndex - 1)}
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                  <span>Previous</span>
                </Button>

                {!isLast ? (
                  <Button variant="primary" onClick={() => goToStep(stepIndex + 1)}>
                    <span>Next Feature</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Button>
                ) : (
                  <Button variant="primary" onClick={handleFinish}>
                    <span className="material-symbols-outlined">task_alt</span>
                    <span>Finish Walkthrough</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
