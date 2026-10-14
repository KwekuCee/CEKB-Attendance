import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AuthSessionUser, ViewType } from '../types';
import { Button } from './Button';
import { useWalkthrough } from '../context/WalkthroughContext';

export interface WalkthroughStep {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  view?: ViewType;
  selector?: string;
  category?: string;
  whatYouSee: string;
  actionChecklist: string[];
  tip: string;
}

interface DashboardWalkthroughProps {
  isOpen?: boolean;
  user: {
    id?: string;
    name: string;
    email?: string;
    role: AuthSessionUser['role'];
    church: string;
  };
  currentView?: ViewType;
  onNavigate?: (view: ViewType) => void;
  onClose?: () => void;
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

function getStepsForRole(role: AuthSessionUser['role']): WalkthroughStep[] {
  if (role === 'Superadmin') {
    return [
      {
        id: 'superadmin_overview_nav',
        title: 'HQ Command Center',
        subtitle: 'Group-wide real-time pulse across every registered church branch',
        icon: 'space_dashboard',
        view: 'dashboard',
        selector: '[data-tour="nav-dashboard"]',
        category: 'Navigation',
        whatYouSee:
          'The primary overview menu link in the navigation rail gives you one-click access back to the group overview.',
        actionChecklist: [
          'Use this anytime to return to group-level rollups and live check-in stats.',
          'Notice your current church or HQ indicator highlighted at the top.',
        ],
        tip: 'The sidebar stays accessible while you explore, or tucks away cleanly on mobile devices.',
      },
      {
        id: 'superadmin_overview_actions',
        title: 'Action Center & Quick Imports',
        subtitle: 'Bulk operations, spreadsheet imports, and group broadcasts',
        icon: 'tune',
        view: 'dashboard',
        selector: '[data-tour="overview-actions"]',
        category: 'HQ Command Center',
        whatYouSee:
          'Fast shortcuts for downloading Excel templates, importing members, and registering leaders without navigating through sub-menus.',
        actionChecklist: [
          'Download official Excel rosters pre-formatted with column validations.',
          'Bulk import members directly into any branch database.',
        ],
        tip: 'Spreadsheet imports validate phone numbers and check for duplicate member records automatically.',
      },
      {
        id: 'superadmin_metric_members',
        title: 'Total Group Membership',
        subtitle: 'Active members registered across all church branches',
        icon: 'group',
        view: 'dashboard',
        selector: '[data-tour="metric-members"]',
        category: 'HQ Command Center',
        whatYouSee:
          'Live count of all registered believers, cell participants, and converts across all CEKB churches.',
        actionChecklist: [
          'Monitor overall church network growth month-over-month.',
          'Click to jump straight into the global member roster.',
        ],
        tip: 'Counts update dynamically whenever a branch pastor registers or transfers members.',
      },
      {
        id: 'superadmin_metric_attendance',
        title: "Today's Live Attendance & Arrival Times",
        subtitle: 'Real-time check-in stream during Sunday & Midweek services',
        icon: 'fact_check',
        view: 'dashboard',
        selector: '[data-tour="metric-attendance"]',
        category: 'HQ Command Center',
        whatYouSee:
          'Total service attendance logged today, with on-time vs. late arrival metrics based on scheduled start times.',
        actionChecklist: [
          'Watch check-ins tick up in real time as entrance ushers scan QR passes.',
          'Check the percentage of on-time arrivals to encourage punctuality.',
        ],
        tip: 'Multiple scans on the same day for the same service program are automatically deduplicated.',
      },
      {
        id: 'superadmin_metric_firsttimers',
        title: 'First-Timers & New Converts',
        subtitle: 'New visitors welcomed and their 5-week retention status',
        icon: 'person_add',
        view: 'dashboard',
        selector: '[data-tour="metric-firsttimers"]',
        category: 'HQ Command Center',
        whatYouSee:
          'First-time attendees logged during recent services with their retention tracking and follow-up milestones.',
        actionChecklist: [
          'Review how many first-timers attended each church branch this week.',
          'Ensure cell leaders receive prompt follow-up notifications for visitors.',
        ],
        tip: 'First-timers automatically convert to full members once they meet your church’s attendance criteria.',
      },
      {
        id: 'superadmin_group_churches',
        title: 'Churches Network Directory',
        subtitle: 'Monitor every church branch, branch pastors, and growth stats',
        icon: 'account_tree',
        view: 'group_overview',
        selector: '[data-tour="group-churches-table"]',
        category: 'Churches Network',
        whatYouSee:
          'A complete directory of all branches in the CEKB group showing Pastor in Charge, member count, leader count, and branch status.',
        actionChecklist: [
          'Click "+ Add Church" to register a new church branch in the network.',
          'Update branch pastor details or inspect branch-by-branch attendance metrics.',
          'Send group announcements to all churches simultaneously.',
        ],
        tip: 'Each branch has its own secure data partition while rolling up metrics to HQ.',
      },
      {
        id: 'superadmin_church_admins',
        title: 'Church Pastors & Admins Directory',
        subtitle: 'Manage administrative credentials and role appointments',
        icon: 'badge',
        view: 'church_admins_directory',
        selector: '[data-tour="church-admins-table"]',
        category: 'Admins & Pastors',
        whatYouSee:
          'Every Church Pastor and Church Admin account across the group, including verification status and branch assignments.',
        actionChecklist: [
          'Review which administrators have active access to each branch.',
          'Verify newly appointed pastors or suspend accounts when leadership changes.',
        ],
        tip: 'All accounts use one unified sign-in form; their role directs them to the correct dashboard automatically.',
      },
      {
        id: 'superadmin_leaders_filters',
        title: 'Leader Filters & Search',
        subtitle: 'Filter leaders by branch, category (PCF, Cell, BSCT), or name',
        icon: 'filter_alt',
        view: 'leaders',
        selector: '[data-tour="leaders-filters"]',
        category: 'Leaders Directory',
        whatYouSee:
          'Search controls and filter chips that let you quickly segment PCF Leaders, Cell Leaders, and Bible Study Class Teachers.',
        actionChecklist: [
          'Search by leader name or phone number.',
          'Filter by tier to view all PCF Leaders or Cell Leaders in a branch.',
        ],
        tip: 'Use category filters to prepare leadership agendas or training sessions.',
      },
      {
        id: 'superadmin_leaders_table',
        title: 'Leaders Directory & Promotion Flags',
        subtitle: 'Cell network size, member assignments, and promotion readiness',
        icon: 'diversity_3',
        view: 'leaders',
        selector: '[data-tour="leaders-table"]',
        category: 'Leaders Directory',
        whatYouSee:
          'All appointed leaders with their cell group names, assigned member counts, and automatic promotion alerts when networks expand.',
        actionChecklist: [
          'Review each leader’s active disciples and weekly meeting submissions.',
          'Approve or review automatic promotion alerts as groups multiply.',
        ],
        tip: 'Leaders get a read-only leader portal to shepherd their assigned members.',
      },
      {
        id: 'superadmin_members_table',
        title: 'Member Directory & Digital QR Passes',
        subtitle: 'Global believers database, contact records, and digital passes',
        icon: 'badge',
        view: 'members',
        selector: '[data-tour="members-table"]',
        category: 'Members Database',
        whatYouSee:
          'Complete member database with attendance streaks, cell leader assignments, baptism status, and digital QR passes.',
        actionChecklist: [
          'Click any member row to preview or download their personal Digital QR Check-In Pass.',
          'Email QR passes directly to believers for effortless entrance scanning.',
        ],
        tip: 'Believers can save their digital QR pass to their phone photos for instant scanning at the entrance.',
      },
      {
        id: 'superadmin_attendance_controls',
        title: 'Service Attendance & Absentees',
        subtitle: 'Filter by date, service program, and toggle absentee lists',
        icon: 'tune',
        view: 'attendance',
        selector: '[data-tour="attendance-controls"]',
        category: 'Attendance Records',
        whatYouSee:
          'Date pickers, service program selector, and tabs for Live Check-Ins, Absentees, and PCF/Cell Hierarchy Rollup.',
        actionChecklist: [
          'Select any service date or program (e.g. Sunday Service, Midweek Service).',
          'Switch to the "Absentees" tab to view who missed service for pastoral care calls.',
          'Inspect the "Hierarchy Attendance" tab for cell-by-cell rollup totals.',
        ],
        tip: 'Attendance is compared against scheduled service start times to flag on-time arrivals.',
      },
      {
        id: 'superadmin_cell_reports',
        title: 'Weekly Cell Reports & Accountability',
        subtitle: 'Review cell meetings, offerings, souls won, and missing reports',
        icon: 'assignment',
        view: 'cell_reports',
        selector: '[data-tour="cell-reports-container"]',
        category: 'Weekly Cell Reports',
        whatYouSee:
          'Summary statistics of cell meetings held, attendance, offerings, and souls won, along with the list of leaders yet to submit.',
        actionChecklist: [
          'Filter reports by week, meeting type, or church branch.',
          'Check the "Leaders Yet to Submit" section to send reminders before Sunday.',
        ],
        tip: 'Leaders submit reports at /cell-report using their branch’s weekly report code.',
      },
      {
        id: 'superadmin_analytics',
        title: 'Growth Insights & Retention Funnels',
        subtitle: 'Attendance trajectories, retention rates, and demographics',
        icon: 'analytics',
        view: 'analytics',
        selector: '[data-tour="analytics-charts"]',
        category: 'Insights & Analytics',
        whatYouSee:
          'Visual graphs of attendance growth over time, first-timer retention rates, age/gender distributions, and top-performing cells.',
        actionChecklist: [
          'Analyze attendance trends leading up to major ministry conferences.',
          'Use "Export records" in the sidebar to download full 3-sheet Excel reports.',
        ],
        tip: 'Exports include separate sheets for branch summaries, service dates, and first-timer conversions.',
      },
      {
        id: 'superadmin_settings',
        title: 'HQ Settings, Report Codes & Backups',
        subtitle: 'Global service programs, report code rotation, and audit logs',
        icon: 'settings',
        view: 'settings',
        selector: '[data-tour="settings-tabs"]',
        category: 'HQ Settings',
        whatYouSee:
          'HQ configuration panels for weekly report codes, service programs, security gates, admin accountability logs, and database backups.',
        actionChecklist: [
          'Rotate Weekly Cell Report Codes regularly for security.',
          'Download scheduled database backups under the Data & Backups tab.',
        ],
        tip: 'Remember to click "Save All Settings" whenever you make configuration adjustments.',
      },
    ];
  }

  if (role === 'Church Pastor' || role === 'Church Admin') {
    const isPastor = role === 'Church Pastor';
    return [
      {
        id: 'overview_nav',
        title: isPastor ? 'Pastor Command Center' : 'Admin Command Center',
        subtitle: 'Your branch dashboard navigation and overview',
        icon: 'space_dashboard',
        view: 'dashboard',
        selector: '[data-tour="nav-dashboard"]',
        category: 'Navigation',
        whatYouSee:
          'The primary overview link in your navigation rail returns you to your branch overview at any time.',
        actionChecklist: [
          'Click to return to your real-time branch pulse from any sub-screen.',
          'Notice your church branch name prominently displayed at the top.',
        ],
        tip: 'Everything in your dashboard is strictly scoped to your church branch.',
      },
      {
        id: 'overview_actions',
        title: 'Branch Quick Actions & Member Import',
        subtitle: 'Bulk member imports, leader registration, and service timing',
        icon: 'bolt',
        view: 'dashboard',
        selector: '[data-tour="overview-actions"]',
        category: 'Dashboard Overview',
        whatYouSee:
          'Quick action buttons to add members, import spreadsheets, and set service start times.',
        actionChecklist: [
          'Use "Set Service Times" so arrival times are automatically categorized as on-time or late.',
          'Bulk-import existing member lists using our validated Excel template.',
        ],
        tip: 'The import tool detects duplicate names or phone numbers to prevent duplicate profiles.',
      },
      {
        id: 'metric_members',
        title: 'Branch Membership Total',
        subtitle: 'Total registered believers in your church branch',
        icon: 'group',
        view: 'dashboard',
        selector: '[data-tour="metric-members"]',
        category: 'Dashboard Overview',
        whatYouSee:
          'Live count of all active members registered in your church branch.',
        actionChecklist: [
          'Monitor your branch congregation growth.',
          'Click the card to jump straight into the full member directory.',
        ],
        tip: 'New converts and self-registered believers are automatically included in this count.',
      },
      {
        id: 'metric_attendance',
        title: "Today's Service Attendance",
        subtitle: 'Live check-in counter and on-time arrival rate',
        icon: 'fact_check',
        view: 'dashboard',
        selector: '[data-tour="metric-attendance"]',
        category: 'Dashboard Overview',
        whatYouSee:
          'Live count of believers who have checked into service today via QR scan, self check-in, or usher assistance.',
        actionChecklist: [
          'Watch attendance figures climb during pre-service prayer and opening praise.',
          'Check punctuality metrics to see how many arrived before the service start bell.',
        ],
        tip: 'Duplicates on the same day for the same service program are automatically resolved.',
      },
      {
        id: 'metric_firsttimers',
        title: 'First-Timers & New Visitors',
        subtitle: 'Visitors welcomed today and follow-up pipeline',
        icon: 'person_add',
        view: 'dashboard',
        selector: '[data-tour="metric-firsttimers"]',
        category: 'Dashboard Overview',
        whatYouSee:
          'Count of first-time guests checked in for today’s service, along with upcoming birthdays and foundation school classes.',
        actionChecklist: [
          'Prioritize first-timer contacts for the follow-up team right after service.',
          'Celebrate upcoming member birthdays highlighted in the pastoral care panel.',
        ],
        tip: 'Assigning first-timers to cell leaders ensures no visitor slips through the cracks.',
      },
      {
        id: 'leaders_nav',
        title: 'Leaders Directory Navigation',
        subtitle: 'Manage your cell ministry structure and appointed teachers',
        icon: 'diversity_3',
        view: 'leaders',
        selector: '[data-tour="nav-leaders"]',
        category: 'Navigation',
        whatYouSee:
          'The Leaders menu item opens your church’s complete directory of PCF Leaders, Cell Leaders, and BSCT teachers.',
        actionChecklist: [
          'Click to inspect leader performance, assigned members, and contact info.',
        ],
        tip: 'Appointed leaders automatically receive read-only login credentials to track their cell groups.',
      },
      {
        id: 'leaders_filters',
        title: 'Leader Filters & Search',
        subtitle: 'Quickly find leaders by name, cell name, or leadership tier',
        icon: 'filter_alt',
        view: 'leaders',
        selector: '[data-tour="leaders-filters"]',
        category: 'Leaders Directory',
        whatYouSee:
          'Search input and category filter chips (All Leaders, PCF Leaders, Cell Leaders, BSCT).',
        actionChecklist: [
          'Search for a leader by name, phone, or cell name.',
          'Filter by category to see all Cell Leaders reporting to a PCF Leader.',
        ],
        tip: 'Use the category filter before holding tier-specific leadership meetings.',
      },
      {
        id: 'leaders_actions',
        title: 'Appoint Leader & Profile Alerts',
        subtitle: 'Appoint new leaders and complete missing profile details',
        icon: 'person_add',
        view: 'leaders',
        selector: '[data-tour="leaders-actions"]',
        category: 'Leaders Directory',
        whatYouSee:
          'The "+ Appoint Leader" button and the Incomplete Leaders notification banner.',
        actionChecklist: [
          'Click "+ Appoint Leader" to register a new teacher or cell leader.',
          'Complete any missing phone numbers or emails shown in the alerts banner.',
        ],
        tip: 'Leaders with complete phone numbers receive automated check-in and cell report reminders.',
      },
      {
        id: 'leaders_table',
        title: 'Leaders Table & Assigned Disciples',
        subtitle: 'Assigned member totals, cell groups, and contact cards',
        icon: 'table_chart',
        view: 'leaders',
        selector: '[data-tour="leaders-table"]',
        category: 'Leaders Directory',
        whatYouSee:
          'Tabular list of all appointed leaders with their tier badge, cell name, assigned member count, and phone contact.',
        actionChecklist: [
          'Check how many disciples are actively shepherded under each leader.',
          'Click any leader row to edit details or inspect their cell roster.',
        ],
        tip: 'When a leader’s network expands past 15 members, the system flags them for promotion!',
      },
      {
        id: 'hierarchy_nav',
        title: 'Leader Hierarchy Tree',
        subtitle: 'Reporting structure from BSCT → Cell → PCF',
        icon: 'account_tree',
        view: 'hierarchy',
        selector: '[data-tour="nav-hierarchy"]',
        category: 'Navigation',
        whatYouSee:
          'The Hierarchy menu item takes you to the reporting tree where BSCT roll up to Cells and Cells roll up to PCFs.',
        actionChecklist: [
          'Open this view to verify that reporting relationships and rollup attendance are properly configured.',
        ],
        tip: isPastor
          ? 'As Church Pastor, you have exclusive authority to assign and adjust parent hierarchy links.'
          : 'As Church Admin, you can view the hierarchy; coordinate with your Pastor if parent links need updating.',
      },
      {
        id: 'hierarchy_editor',
        title: 'Hierarchy Assignment Controls',
        subtitle: isPastor
          ? 'Link BSCT teachers to Cell Leaders and Cell Leaders to PCF Leaders'
          : 'Inspect parent assignment links',
        icon: 'edit_note',
        view: 'hierarchy',
        selector: '[data-tour="hierarchy-editor"]',
        category: 'Leader Hierarchy',
        whatYouSee:
          'Parent link dropdowns for assigning which Cell Leader oversees each BSCT, and which PCF Leader oversees each Cell Leader.',
        actionChecklist: isPastor
          ? [
              'Select a BSCT teacher and link them to their parent Cell Leader.',
              'Select a Cell Leader and link them to their parent PCF Leader.',
              'Click "Save Hierarchy Changes" to commit the structure.',
            ]
          : [
              'Verify that every cell and BSCT has the correct parent leader selected.',
            ],
        tip: 'Parent links ensure that attendance numbers on every dashboard roll up accurately.',
      },
      {
        id: 'hierarchy_tree',
        title: 'Visual Hierarchy & Rollup Attendance',
        subtitle: 'Interactive tree diagram of your church’s leadership rollups',
        icon: 'account_tree',
        view: 'hierarchy',
        selector: '[data-tour="hierarchy-tree"]',
        category: 'Leader Hierarchy',
        whatYouSee:
          'A multi-level visual tree showing PCF leaders at the top, branch cells in the middle, and BSCT groups below, with aggregated headcounts.',
        actionChecklist: [
          'Inspect the rolled-up member numbers at each level.',
          'Verify that no leaders are unassigned or orphaned without a parent group.',
        ],
        tip: 'Every leader dashboard inherits totals from these links automatically.',
      },
      {
        id: 'members_nav',
        title: 'Members Database Navigation',
        subtitle: 'Comprehensive believer registry and digital pass generator',
        icon: 'group',
        view: 'members',
        selector: '[data-tour="nav-members"]',
        category: 'Navigation',
        whatYouSee:
          'The Members menu link leads to your branch’s complete member and first-timer database.',
        actionChecklist: [
          'Access this screen to register new souls, look up believers, or issue QR passes.',
        ],
        tip: 'You can search members in seconds by name, phone number, or cell leader.',
      },
      {
        id: 'members_filters',
        title: 'Member Filters & Search Bar',
        subtitle: 'Filter by membership status, gender, department, or cell',
        icon: 'filter_alt',
        view: 'members',
        selector: '[data-tour="members-filters"]',
        category: 'Members Database',
        whatYouSee:
          'Search box with real-time matching, plus filter dropdowns for Status (Member, First Timer, Convert), Department, and Cell.',
        actionChecklist: [
          'Filter by "First Timer" to see all recent visitors requiring pastoral follow-up.',
          'Filter by Department (e.g. Choir, Ushers, Media) to review departmental strength.',
        ],
        tip: 'Typing a partial phone number immediately filters the list to matching members.',
      },
      {
        id: 'members_actions',
        title: 'Register Member & Bulk Operations',
        subtitle: 'Add new believers manually or export member directories',
        icon: 'person_add',
        view: 'members',
        selector: '[data-tour="members-actions"]',
        category: 'Members Database',
        whatYouSee:
          'The "+ Register Member" primary action button and export options.',
        actionChecklist: [
          'Click "+ Register Member" to add a new convert or transferring believer.',
          'Download Excel rosters for departmental use.',
        ],
        tip: 'When registering a member, assigning their cell leader links them into the care hierarchy immediately.',
      },
      {
        id: 'members_table',
        title: 'Member Table & Digital QR Check-In Pass',
        subtitle: 'Attendance streaks, follow-up stages, and instant QR generation',
        icon: 'table_chart',
        view: 'members',
        selector: '[data-tour="members-table"]',
        category: 'Members Database',
        whatYouSee:
          'Tabular list of all members showing 5-week attendance streaks, assigned leaders, and a QR icon for each person.',
        actionChecklist: [
          'Click any member row to open their Digital QR Pass card.',
          'Download or email the pass card directly to the believer.',
        ],
        tip: 'Believers present their Digital QR Pass at church entrance doors for instant check-in.',
      },
      {
        id: 'attendance_nav',
        title: 'Attendance Records Navigation',
        subtitle: 'Live check-in register, late arrival tracking, and absentees',
        icon: 'fact_check',
        view: 'attendance',
        selector: '[data-tour="nav-attendance"]',
        category: 'Navigation',
        whatYouSee:
          'The Attendance menu item opens your service check-in register.',
        actionChecklist: [
          'View live check-ins during service or conduct post-service pastoral review.',
        ],
        tip: 'Records are recorded with precise timestamps and check-in methods.',
      },
      {
        id: 'attendance_controls',
        title: 'Attendance Controls & Absentees Toggle',
        subtitle: 'Service date selection, program filter, and absentee list',
        icon: 'tune',
        view: 'attendance',
        selector: '[data-tour="attendance-controls"]',
        category: 'Attendance Records',
        whatYouSee:
          'Date selector, Service Program filter (Sunday Service, Midweek Service), and toggle tabs for Check-Ins, Absentees, and Cell Rollup.',
        actionChecklist: [
          'Select the active service date and program.',
          'Switch to "Absentees" after service to see which active members were missed today.',
          'Check the "Hierarchy Attendance" tab for cell-level turnouts.',
        ],
        tip: 'Absentee lists make it easy for cell leaders to make Sunday evening care calls.',
      },
      {
        id: 'attendance_table',
        title: 'Timestamped Check-In Register',
        subtitle: 'Detailed logs with check-in method and punctuality status',
        icon: 'list_alt',
        view: 'attendance',
        selector: '[data-tour="attendance-table"]',
        category: 'Attendance Records',
        whatYouSee:
          'Live log of attendees showing arrival time, on-time/late badge, and entry method (QR Scan, Self Check-In, Usher Entry).',
        actionChecklist: [
          'Review the check-in stream during or after service.',
          'Notice how late arrivals are clearly distinguished based on your service start time.',
        ],
        tip: 'Export attendance logs anytime for official branch church records.',
      },
      {
        id: 'cell_reports_nav',
        title: 'Weekly Cell Reports Navigation',
        subtitle: 'Track cell meetings, offerings, souls won, and missing reports',
        icon: 'assignment',
        view: 'cell_reports',
        selector: '[data-tour="nav-cell_reports"]',
        category: 'Navigation',
        whatYouSee:
          'The Cell Reports menu link takes you to weekly cell meeting submissions.',
        actionChecklist: [
          'Review weekly cell activity submitted by your PCF, Cell, and BSCT leaders.',
        ],
        tip: 'Leaders submit reports through the public portal using your branch report code.',
      },
      {
        id: 'cell_reports_container',
        title: 'Cell Reports Summary & Leaders Yet to Submit',
        subtitle: 'Total cell attendance, offerings, souls won, and missing lists',
        icon: 'analytics',
        view: 'cell_reports',
        selector: '[data-tour="cell-reports-container"]',
        category: 'Weekly Cell Reports',
        whatYouSee:
          'Summary cards of total cell meetings, aggregate attendance, offerings, souls won, and a dedicated list of leaders who have not yet submitted.',
        actionChecklist: [
          'Filter reports by week and meeting type.',
          'Click any report to read testimonies, attendee lists, or challenges.',
          'Check "Leaders Yet to Submit" to follow up before your weekly church council.',
        ],
        tip: 'Offerings reported in cell meetings roll up into your branch weekly totals.',
      },
      {
        id: 'analytics_nav',
        title: 'Insights & Analytics Navigation',
        subtitle: 'Visual graphs of attendance growth and retention funnels',
        icon: 'analytics',
        view: 'analytics',
        selector: '[data-tour="nav-analytics"]',
        category: 'Navigation',
        whatYouSee:
          'The Analytics menu item opens charts and retention insights for your branch.',
        actionChecklist: [
          'Inspect long-term growth patterns and retention health.',
        ],
        tip: 'Charts help pinpoint which seasons and programs generated the highest engagement.',
      },
      {
        id: 'analytics_charts',
        title: 'Growth Trajectories & Demographic Breakdowns',
        subtitle: 'Attendance curves, first-timer retention, and age/gender data',
        icon: 'bar_chart',
        view: 'analytics',
        selector: '[data-tour="analytics-charts"]',
        category: 'Insights & Analytics',
        whatYouSee:
          'Interactive charts showing week-over-week attendance trajectories, visitor conversion funnels, and demographic distributions.',
        actionChecklist: [
          'Compare Sunday vs. Midweek attendance stability.',
          'Evaluate first-timer conversion rates into permanent members.',
        ],
        tip: 'Use these analytics in your monthly pastoral review meetings.',
      },
      {
        id: 'settings_nav',
        title: 'Settings & Branch Control Center',
        subtitle: 'Report codes, usher appointments, and data backups',
        icon: 'settings',
        view: 'settings',
        selector: '[data-tour="nav-settings"]',
        category: 'Navigation',
        whatYouSee:
          'The Settings link opens your branch administrative control center.',
        actionChecklist: [
          'Configure your Weekly Cell Report Code, appoint ushers, and download backups.',
        ],
        tip: 'Keep your Weekly Cell Report Code up-to-date and share it with active leaders.',
      },
      {
        id: 'settings_tabs',
        title: 'Settings Panels & Usher Appointments',
        subtitle: 'Cell report code, appointing ushers, profile, and backups',
        icon: 'tune',
        view: 'settings',
        selector: '[data-tour="settings-tabs"]',
        category: 'Branch Settings',
        whatYouSee:
          'Tabs for Weekly Cell Report Code, Ushers & Branch Staff, Branch Profile, Scanner Defaults, and Data & Backups.',
        actionChecklist: [
          'Copy your Weekly Cell Report Code to distribute to your cell leaders.',
          isPastor
            ? 'Appoint Church Admins and Ushers in the "Ushers & Branch Staff" panel.'
            : 'Appoint Ushers in the "Ushers" panel so they can access the QR scanner.',
          'Download regular Excel or CSV backups under Data & Backups.',
        ],
        tip: 'Ushers log directly into the full-screen QR check-in camera with their assigned code!',
      },
    ];
  }

  if (role === 'Leader') {
    return [
      {
        id: 'leader_welcome',
        title: 'Welcome to Your Leader Workspace',
        subtitle: 'Your personal cell ministry and attendance oversight portal',
        icon: 'diversity_3',
        selector: '[data-tour="leader-welcome"]',
        category: 'Leader Overview',
        whatYouSee:
          'Your leader dashboard is tailored specifically to your PCF, Cell, or BSCT group within your church branch.',
        actionChecklist: [
          'Verify your leadership role and group name under the header welcome badge.',
          'Use this portal before, during, and after service to track your members.',
        ],
        tip: 'Your account is read-only for church-wide settings so you can focus entirely on pastoral care.',
      },
      {
        id: 'leader_metrics',
        title: 'Group Attendance & Rollup Totals',
        subtitle: 'Automatic rollup of your disciples and downstream leaders',
        icon: 'monitoring',
        selector: '[data-tour="leader-metrics"]',
        category: 'Leader Overview',
        whatYouSee:
          'Four live stat cards: Whole Group Attendance, Today’s Check-Ins, Members in Your Group, and Leaders Under You.',
        actionChecklist: [
          'Check "Today" right after service begins to see who in your structure has checked in.',
          'Compare whole group attendance with your total member count to evaluate faithfulness.',
        ],
        tip: 'If you are a PCF Leader or Cell Leader, these numbers include all cells and BSCT groups reporting to you!',
      },
      {
        id: 'leader_downstream',
        title: 'Downstream Leaders Reporting to You',
        subtitle: 'Track appointed leaders and teachers in your cell network',
        icon: 'account_tree',
        selector: '[data-tour="leader-downstream"]',
        category: 'Cell Structure',
        whatYouSee:
          'A clear breakdown of downstream Cell Leaders or BSCT teachers reporting directly under your structure.',
        actionChecklist: [
          'Encourage and mentor your downstream leaders throughout the week.',
          'Ensure they submit their weekly cell reports on time.',
        ],
        tip: 'Totals from your downstream leaders automatically roll up into your top-level numbers.',
      },
      {
        id: 'leader_members',
        title: 'Assigned Members & Attendance Streaks',
        subtitle: 'Check-in counts, first-timers, and contact details',
        icon: 'group',
        selector: '[data-tour="leader-members"]',
        category: 'Member Care',
        whatYouSee:
          'Complete directory of believers assigned to your care with their attendance streak and membership status.',
        actionChecklist: [
          'Identify members with low recent attendance for encouragement and prayer.',
          'Follow up with First-Timers to help them become established in the cell.',
        ],
        tip: 'When new visitors pick your name during self check-in, they appear in your list automatically.',
      },
      {
        id: 'leader_actions',
        title: 'Submit Weekly Cell Report',
        subtitle: 'Log cell meeting attendance, offerings, souls won, and testimonies',
        icon: 'assignment',
        selector: '[data-tour="leader-actions"]',
        category: 'Weekly Reports',
        whatYouSee:
          'The "Submit cell report" primary button at the top of your dashboard.',
        actionChecklist: [
          'Click "Submit cell report" after your weekly cell fellowship.',
          'Enter your branch Report Code, attendee names, souls won, and offering amount.',
        ],
        tip: 'You can replay this tutorial anytime using the "Tour This Page" button in the header.',
      },
    ];
  }

  // Usher role
  return [
    {
      id: 'usher_viewfinder',
      title: 'Usher QR Check-In Camera',
      subtitle: 'Fast, contactless member verification at the church entrance',
      icon: 'qr_code_scanner',
      selector: '[data-tour="scanner-viewfinder"]',
      category: 'Scanner Station',
      whatYouSee:
        'The live camera viewfinder with target framing reticle and instant QR recognition.',
      actionChecklist: [
        'Allow camera access when prompted by your phone or tablet browser.',
        'Point the camera at a believer’s Digital QR Pass — attendance logs automatically with a confirmation chime.',
      ],
      tip: 'Duplicate scans for the same member and service on the same day are automatically blocked.',
    },
    {
      id: 'usher_controls',
      title: 'Service Program & Manual Search',
      subtitle: 'Select service type and check in members without a pass',
      icon: 'person_search',
      selector: '[data-tour="scanner-controls"]',
      category: 'Scanner Station',
      whatYouSee:
        'The Service Program dropdown (Sunday Service, Midweek Service), manual name/ID search box, and pass photo uploader.',
      actionChecklist: [
        'Confirm the active Service Program in the dropdown before doors open.',
        'If a member forgot their QR pass, type their name in the search box to check them in manually.',
        'If a believer has a screenshot of their pass, you can also use "Upload a picture of the pass".',
      ],
      tip: 'Only members belonging to your church branch will be verified; passes from other branches are flagged immediately.',
    },
    {
      id: 'usher_actions',
      title: 'Entrance Kiosk Mode & Shift Controls',
      subtitle: 'Hands-free continuous scanning and shift logout',
      icon: 'bolt',
      selector: '[data-tour="scanner-actions"]',
      category: 'Scanner Station',
      whatYouSee:
        'The "Entrance mode" toggle button for automatic dismissal and the shift logout button.',
      actionChecklist: [
        'Tap "Entrance mode" so the confirmation sheet resets automatically after 2.5 seconds for the next person.',
        'Use the top Flashlight button when scanning passes in dim auditoriums.',
        'Log out securely when your ushering shift ends.',
      ],
      tip: 'Tap "Watch Walkthrough" at the top anytime you need a quick refresher.',
    },
  ];
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const DashboardWalkthrough: React.FC<DashboardWalkthroughProps> = ({
  isOpen: propsIsOpen,
  user,
  currentView: propsCurrentView,
  onNavigate: propsOnNavigate,
  onClose: propsOnClose,
}) => {
  const context = useWalkthrough();
  const isOpen = Boolean(propsIsOpen || context.isTourOpen);
  const currentView = propsCurrentView || context.targetPage;
  const tourMode = context.tourMode || 'full';
  const targetPage = context.targetPage;

  const allRoleSteps = getStepsForRole(user.role);

  // Filter steps if in page tour mode
  const activeSteps = React.useMemo(() => {
    if (tourMode === 'page' && targetPage) {
      const pageSteps = allRoleSteps.filter(s => s.view === targetPage || (!s.view && targetPage === 'dashboard'));
      if (pageSteps.length > 0) return pageSteps;
    }
    return allRoleSteps;
  }, [allRoleSteps, tourMode, targetPage]);

  const [stepIndex, setStepIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const currentStep = activeSteps[Math.min(stepIndex, activeSteps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === activeSteps.length - 1;
  const progressPct = Math.round(((stepIndex + 1) / activeSteps.length) * 100);

  // Navigate view and calculate spotlight target rect
  const updateTargetSpotlight = useCallback((step: WalkthroughStep | undefined) => {
    if (!step?.selector) {
      setTargetRect(null);
      return;
    }

    setIsSearchingTarget(true);

    let attempts = 0;
    const maxAttempts = 15;

    const tryFind = () => {
      const el = document.querySelector(step.selector!);
      if (el) {
        // Element found!
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        const b = el.getBoundingClientRect();
        // Give comfortable padding
        const pad = 8;
        setTargetRect({
          top: Math.max(0, b.top - pad),
          left: Math.max(0, b.left - pad),
          width: b.width + pad * 2,
          height: b.height + pad * 2,
        });
        setIsSearchingTarget(false);
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(() => setTimeout(tryFind, 60));
      } else {
        // Target not found in DOM, fallback to centered card
        setTargetRect(null);
        setIsSearchingTarget(false);
      }
    };

    tryFind();
  }, []);

  // Update when active step changes
  useEffect(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }

    // If step has a target view that doesn't match currentView, navigate there
    if (currentStep?.view && propsOnNavigate && propsCurrentView !== currentStep.view) {
      propsOnNavigate(currentStep.view);
    }

    // Wait a moment for view to render before finding spotlight target
    const timer = setTimeout(() => {
      updateTargetSpotlight(currentStep);
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, stepIndex, currentStep, propsOnNavigate, propsCurrentView, updateTargetSpotlight]);

  // Handle window resize or scroll
  useEffect(() => {
    if (!isOpen || !currentStep?.selector) return;

    const handleResizeOrScroll = () => {
      const el = document.querySelector(currentStep.selector!);
      if (el) {
        const b = el.getBoundingClientRect();
        const pad = 8;
        setTargetRect({
          top: Math.max(0, b.top - pad),
          left: Math.max(0, b.left - pad),
          width: b.width + pad * 2,
          height: b.height + pad * 2,
        });
      }
    };

    window.addEventListener('resize', handleResizeOrScroll, { passive: true });
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll);
    };
  }, [isOpen, currentStep]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setMinimized(false);
      const firstStep = activeSteps[0];
      if (firstStep?.view && propsOnNavigate && propsCurrentView !== firstStep.view) {
        propsOnNavigate(firstStep.view);
      }
    }
  }, [isOpen, tourMode, targetPage]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || minimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (!isLast) goToStep(stepIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        if (!isFirst) goToStep(stepIndex - 1);
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, minimized, stepIndex, isFirst, isLast]);

  if (!isOpen || activeSteps.length === 0) return null;

  const goToStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(activeSteps.length - 1, idx));
    setStepIndex(clamped);
    const targetStep = activeSteps[clamped];
    if (targetStep?.view && propsOnNavigate) {
      propsOnNavigate(targetStep.view);
    }
  };

  const handleFinish = () => {
    markWalkthroughSeen(user);
    if (activeSteps[0]?.view && propsOnNavigate) {
      propsOnNavigate(activeSteps[0].view);
    }
    if (propsOnClose) propsOnClose();
    context.closeTour();
  };

  const handleSkip = () => {
    markWalkthroughSeen(user);
    if (propsOnClose) propsOnClose();
    context.closeTour();
  };

  // Minimized Preview Pill
  if (minimized) {
    return (
      <div
        role="region"
        aria-label="Step-by-step walkthrough minimized bar"
        className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-2xl border border-blue-500/40 bg-slate-950/95 text-white p-3.5 shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div className="w-9 h-9 rounded-xl bg-blue-600/25 border border-blue-400/30 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-blue-300 text-[20px]">{currentStep.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-blue-300 font-semibold truncate">
            Step {stepIndex + 1} of {activeSteps.length} · {currentStep.title}
          </p>
          <p className="text-xs text-slate-300 truncate">Explore this screen, then continue tour</p>
        </div>
        <Button variant="primary" onClick={() => setMinimized(false)}>
          Expand
        </Button>
      </div>
    );
  }

  // Calculate Popover Position relative to targetRect
  let popoverPlacementClass = 'my-auto';
  let popoverInlineStyles: React.CSSProperties = {};

  if (targetRect && window.innerWidth >= 768) {
    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;
    const spaceRight = window.innerWidth - (targetRect.left + targetRect.width);

    // If target is left sidebar rail, place beside it
    if (targetRect.left < 280 && spaceRight > 500) {
      popoverInlineStyles = {
        position: 'fixed',
        left: Math.min(window.innerWidth - 560, targetRect.left + targetRect.width + 24),
        top: Math.max(20, Math.min(window.innerHeight - 560, targetRect.top - 20)),
        maxWidth: '520px',
        width: '100%',
        margin: 0,
      };
    } else if (spaceBelow >= 360) {
      // Place below
      popoverInlineStyles = {
        position: 'fixed',
        left: Math.max(20, Math.min(window.innerWidth - 540, targetRect.left)),
        top: Math.min(window.innerHeight - 440, targetRect.top + targetRect.height + 16),
        maxWidth: '520px',
        width: '100%',
        margin: 0,
      };
    } else if (spaceAbove >= 360) {
      // Place above
      popoverInlineStyles = {
        position: 'fixed',
        left: Math.max(20, Math.min(window.innerWidth - 540, targetRect.left)),
        bottom: Math.min(window.innerHeight - 60, window.innerHeight - targetRect.top + 16),
        maxWidth: '520px',
        width: '100%',
        margin: 0,
      };
    } else {
      // Centered fallback
      popoverPlacementClass = 'my-auto';
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Step-by-Step Walkthrough"
      className="fixed inset-0 z-[80] overflow-y-auto flex items-end sm:items-center justify-center p-3 sm:p-6"
    >
      {/* 1. Frosted Backdrop or Spotlight Cutout */}
      {targetRect ? (
        <>
          {/* Spotlight glowing border box with 9999px box-shadow */}
          <div
            className="fixed z-[81] rounded-2xl ring-2 ring-blue-400 walkthrough-spotlight-box transition-all duration-300"
            style={{
              top: `${targetRect.top}px`,
              left: `${targetRect.left}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`,
            }}
          />
          {/* Clickable background dismissal area */}
          <div
            className="fixed inset-0 z-[80] pointer-events-auto"
            onClick={() => setMinimized(true)}
            title="Click to minimize and inspect current screen"
          />
        </>
      ) : (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setMinimized(true)}
        />
      )}

      {/* 2. Walkthrough Guide Card */}
      <div
        className={`relative z-[85] w-full max-w-3xl rounded-3xl border border-slate-200/90 bg-white text-slate-900 shadow-2xl overflow-hidden transition-all duration-300 ${popoverPlacementClass}`}
        style={popoverInlineStyles}
      >
        {/* Top Header */}
        <div className="bg-slate-950 text-white px-5 py-3.5 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-300 text-[18px]">school</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-300 bg-blue-900/60 px-1.5 py-0.5 rounded">
                  {currentStep.category || (tourMode === 'page' ? 'Page Guide' : 'Guided Tour')}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  Step {stepIndex + 1} of {activeSteps.length}
                </span>
              </div>
              <h2 className="font-headline font-extrabold text-sm sm:text-base text-white truncate max-w-sm sm:max-w-md">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {tourMode === 'page' && (
              <button
                type="button"
                onClick={() => context.startFullTour()}
                className="text-[11px] font-semibold text-blue-300 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Switch from this single-page guide to the full end-to-end dashboard tour"
              >
                <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
                <span className="hidden sm:inline">Full Tour</span>
              </button>
            )}

            <Button
              variant="secondary"
              onClick={() => setMinimized(true)}
              title="Minimize walkthrough to interact directly with the spotlighted area"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_full</span>
              <span className="hidden sm:inline">Preview</span>
            </Button>

            <Button variant="secondary" onClick={handleSkip} aria-label="Close walkthrough">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step Guide Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Active Feature Subtitle & Icon */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">{currentStep.icon}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {currentStep.subtitle}
              </p>
              <h3 className="font-headline font-bold text-lg text-slate-900 mt-0.5">
                {currentStep.title}
              </h3>
            </div>
          </div>

          {/* What you see */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-3.5 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">What you see</p>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {currentStep.whatYouSee}
            </p>
          </div>

          {/* Action Checklist */}
          {currentStep.actionChecklist && currentStep.actionChecklist.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">What to do here</p>
              <ul className="space-y-1.5">
                {currentStep.actionChecklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                    <span className="material-symbols-outlined text-blue-700 text-[16px] shrink-0 mt-0.5">
                      check_circle
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pro Tip */}
          <div className="rounded-2xl bg-blue-50/80 border border-blue-200/80 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-slate-700">
            <span className="material-symbols-outlined text-blue-700 text-[18px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <span>
              <strong className="text-slate-900">Helpful tip:</strong> {currentStep.tip}
            </span>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={handleSkip}>
            Skip tour
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={isFirst}
              onClick={() => goToStep(stepIndex - 1)}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back</span>
            </Button>

            {!isLast ? (
              <Button variant="primary" onClick={() => goToStep(stepIndex + 1)}>
                <span>Next Feature</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish}>
                <span className="material-symbols-outlined text-[16px]">task_alt</span>
                <span>Complete Tour</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
