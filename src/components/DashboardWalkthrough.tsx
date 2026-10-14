import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { AuthSessionUser, ViewType } from '../types';
import { Button } from './Button';

export interface WalkthroughStep {
  id: string;
  targetSelector: string;
  title: string;
  subtitle: string;
  section: string;
  icon: string;
  description: string;
  tip?: string;
  view?: ViewType;
}

export type WalkthroughMode = 'full' | 'page';

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
  mode?: WalkthroughMode;
  targetPage?: ViewType;
  onNavigate?: (view: ViewType) => void;
  onClose: () => void;
}

const STORAGE_PREFIX = 'cekb_walkthrough_seen_v4';

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

/**
 * Returns comprehensive step-by-step walkthrough definition for any role.
 * Follows the user's mental model:
 * Sidebar feature item highlighted -> View navigates into that feature -> Key filters/actions/table highlighted -> Next sidebar feature!
 */
export function getAllStepsForRole(role: AuthSessionUser['role']): WalkthroughStep[] {
  if (role === 'Leader') {
    return [
      {
        id: 'leader-overview',
        targetSelector: '[data-tour="leader-overview"]',
        title: 'Command Center & Group Metrics',
        subtitle: 'Overview & Rollup Stats',
        section: 'Overview',
        icon: 'space_dashboard',
        view: 'dashboard',
        description:
          'Your command center provides real-time totals for group attendance, today\'s check-ins, your active cell members, and leaders under you.',
        tip: 'Everything else in the background is blurred so you can see each section clearly as we step through.',
      },
      {
        id: 'leader-attendance',
        targetSelector: '[data-tour="leader-attendance"]',
        title: 'Attendance per Service Date',
        subtitle: 'Cell & PCF Attendance Breakdown',
        section: 'Attendance',
        icon: 'fact_check',
        view: 'dashboard',
        description:
          'Review attendance per service date for all members who chose your name under "who invited you" or belong to your cell/PCF group. Filter by date or service type and export to Excel.',
        tip: 'Check first-timer attendance and follow up with absentees directly from this view.',
      },
      {
        id: 'leader-members',
        targetSelector: '[data-tour="leader-members"]',
        title: 'My Cell Members',
        subtitle: 'Directory of Cell & Group Members',
        section: 'Members',
        icon: 'group',
        view: 'dashboard',
        description:
          'A complete list of members assigned to your cell or imported by the church administration. See their contact info, service attendance counts, and foundation class levels.',
        tip: 'Click any phone number to place a direct call or send a WhatsApp message.',
      },
      {
        id: 'leader-evangelism',
        targetSelector: '[data-tour="leader-evangelism"]',
        title: 'Evangelism & Soulwinning',
        subtitle: 'Outreach & New Convert Tracker',
        section: 'Evangelism',
        icon: 'campaign',
        view: 'dashboard',
        description:
          'Upload evangelism spreadsheets or log outreach contacts individually. When a contact attends church, move them to the member database with one click.',
        tip: 'Download the preformatted Excel template to easily collect names during soul-winning.',
      },
      {
        id: 'leader-cell-report',
        targetSelector: '[data-tour="leader-cell-report"]',
        title: 'Submit Weekly Cell Report',
        subtitle: 'Weekly Cell Ministry Returns',
        section: 'Cell Reports',
        icon: 'assignment',
        view: 'dashboard',
        description:
          'Unlock the cell report sheet using your church passcode to submit weekly attendance, outreach centre metrics, souls won, and offering figures.',
        tip: 'Your church pastor or admin issues the 4-digit report code each week.',
      },
      {
        id: 'leader-signout',
        targetSelector: '[data-tour="leader-signout"]',
        title: 'Leader Account & Sign Out',
        subtitle: 'Secure Session Control',
        section: 'Account',
        icon: 'logout',
        view: 'dashboard',
        description:
          'Your active leader profile and church branch are shown here. Click the sign-out button whenever you finish your session.',
        tip: 'You can replay this step-by-step walkthrough anytime by clicking "Guide Me" in the bottom corner.',
      },
    ];
  }

  if (role === 'Superadmin') {
    return [
      // 1. Overview
      {
        id: 'sa-nav-overview',
        targetSelector: '[data-tour="nav-dashboard"]',
        title: 'Overview Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Overview',
        icon: 'space_dashboard',
        view: 'dashboard',
        description:
          'The Overview tab is the Group Pastor HQ command center. It gives you a birds-eye aggregate summary across every church in the network.',
        tip: 'Clicking Overview returns you here from any sub-page.',
      },
      {
        id: 'sa-metric-members',
        targetSelector: '[data-tour="metric-members"]',
        title: 'Network Membership Total',
        subtitle: 'Overview Page',
        section: 'Overview',
        icon: 'groups',
        view: 'dashboard',
        description:
          'Consolidated tally of all registered members across all Korle Bu group branches combined.',
      },
      {
        id: 'sa-metric-attendance',
        targetSelector: '[data-tour="metric-attendance"]',
        title: 'Combined Sunday Check-Ins',
        subtitle: 'Overview Page',
        section: 'Overview',
        icon: 'fact_check',
        view: 'dashboard',
        description:
          'Real-time stream of all attendee check-ins happening today across the entire group network.',
      },

      // 2. Churches (Group Overview)
      {
        id: 'sa-nav-churches',
        targetSelector: '[data-tour="nav-group_overview"]',
        title: 'Churches Directory Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Churches',
        icon: 'account_tree',
        view: 'group_overview',
        description:
          'The Churches navigation button opens the multi-branch management page, where you supervise all branch locations, pastors, and church administrators.',
      },
      {
        id: 'sa-churches-actions',
        targetSelector: '[data-tour="group-overview-actions"]',
        title: 'Network Actions & Broadcast',
        subtitle: 'Churches Page',
        section: 'Churches',
        icon: 'campaign',
        view: 'group_overview',
        description:
          'Send group-wide emergency announcements to all church branch administrators, or export a complete JSON cloud backup of the entire platform.',
      },
      {
        id: 'sa-churches-table',
        targetSelector: '[data-tour="group-churches-table"]',
        title: 'Registered Churches Network',
        subtitle: 'Churches Page',
        section: 'Churches',
        icon: 'church',
        view: 'group_overview',
        description:
          'Full roster of branch churches with their pastor in charge, active membership totals, status, and quick register controls.',
      },

      // 3. Church Admins Directory
      {
        id: 'sa-nav-admins',
        targetSelector: '[data-tour="nav-church_admins_directory"]',
        title: 'Church Admins Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Church Admins',
        icon: 'badge',
        view: 'church_admins_directory',
        description:
          'The Church Admins navigation button takes you to the directory of all branch administrative officers and pastoral coordinators.',
      },
      {
        id: 'sa-admins-filters',
        targetSelector: '[data-tour="church-admins-filters"]',
        title: 'Filter & Search Admins',
        subtitle: 'Church Admins Page',
        section: 'Church Admins',
        icon: 'search',
        view: 'church_admins_directory',
        description:
          'Search administrators by name, email, phone, or church branch, and filter by status (Active or Pending Verification).',
      },
      {
        id: 'sa-admins-table',
        targetSelector: '[data-tour="church-admins-table"]',
        title: 'Church Administrators Roster',
        subtitle: 'Church Admins Page',
        section: 'Church Admins',
        icon: 'manage_accounts',
        view: 'church_admins_directory',
        description:
          'Manage administrator credentials, approve new sign-ups, or adjust account details directly from this roster.',
      },

      // 4. Leaders Directory
      {
        id: 'sa-nav-leaders',
        targetSelector: '[data-tour="nav-leaders"]',
        title: 'Leaders Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Leaders',
        icon: 'diversity_3',
        view: 'leaders',
        description:
          'The Leaders tab gives you complete visibility over all Church Coordinators, PCF Leaders, Cell Leaders, and BSCTs in all churches.',
      },
      {
        id: 'sa-leaders-table',
        targetSelector: '[data-tour="leaders-section"]',
        title: 'Group Leadership Directory',
        subtitle: 'Leaders Page',
        section: 'Leaders',
        icon: 'military_tech',
        view: 'leaders',
        description:
          'Inspect leader profiles, approve pending promotions, and resolve duplicate leader records with one-click merging.',
      },

      // 5. Members Database
      {
        id: 'sa-nav-members',
        targetSelector: '[data-tour="nav-members"]',
        title: 'Members Database Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Members',
        icon: 'group',
        view: 'members',
        description:
          'Access the consolidated member database covering all branches, Foundation School progression, and digital QR passes.',
      },
      {
        id: 'sa-members-table',
        targetSelector: '[data-tour="members-table"]',
        title: 'Congregation Master Table',
        subtitle: 'Members Page',
        section: 'Members',
        icon: 'contacts',
        view: 'members',
        description:
          'Search, inspect member ID cards, bulk-assign Foundation School classes, and export clean Excel lists.',
      },

      // 6. Attendance Records
      {
        id: 'sa-nav-attendance',
        targetSelector: '[data-tour="nav-attendance"]',
        title: 'Attendance Records Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Attendance',
        icon: 'fact_check',
        view: 'attendance',
        description:
          'The Attendance tab lets you monitor check-ins for any Sunday, Midweek, or Special program across the entire group.',
      },
      {
        id: 'sa-attendance-table',
        targetSelector: '[data-tour="attendance-table"]',
        title: 'Service Attendance Stream',
        subtitle: 'Attendance Page',
        section: 'Attendance',
        icon: 'history_toggle_off',
        view: 'attendance',
        description:
          'Inspect arrival timestamps, station verifiers, leader attribution, and download aggregate Excel summaries.',
      },

      // 7. Evangelism & Souls
      {
        id: 'sa-nav-evangelism',
        targetSelector: '[data-tour="nav-evangelism"]',
        title: 'Evangelism & Souls Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Evangelism',
        icon: 'campaign',
        view: 'evangelism',
        description:
          'Track weekly soulwinning returns submitted by cell leaders and observe conversion rates into full regular members.',
      },
      {
        id: 'sa-evangelism-table',
        targetSelector: '[data-tour="evangelism-table"]',
        title: 'Evangelism Outreach Contacts',
        subtitle: 'Evangelism Page',
        section: 'Evangelism',
        icon: 'volunteer_activism',
        view: 'evangelism',
        description:
          'Inspect souls won during outreach, follow-up notes, and one-click convert them into registered members.',
      },

      // 8. Weekly Cell Reports
      {
        id: 'sa-nav-cell_reports',
        targetSelector: '[data-tour="nav-cell_reports"]',
        title: 'Weekly Cell Reports Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Cell Reports',
        icon: 'assignment',
        view: 'cell_reports',
        description:
          'Audit weekly cell ministry returns, meetings, attendance, offerings, and outreach centres from all branch churches.',
      },
      {
        id: 'sa-cell-reports-table',
        targetSelector: '[data-tour="cell-reports-table"]',
        title: 'Cell Report Submissions',
        subtitle: 'Cell Reports Page',
        section: 'Cell Reports',
        icon: 'table_chart',
        view: 'cell_reports',
        description:
          'View individual submitted sheets with print-friendly summaries, souls won breakdowns, and offering figures.',
      },

      // 9. Insights & Analytics
      {
        id: 'sa-nav-analytics',
        targetSelector: '[data-tour="nav-analytics"]',
        title: 'Insights & Analytics Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Insights',
        icon: 'analytics',
        view: 'analytics',
        description:
          'Visual intelligence into 12-month membership trajectory, arrival time distribution, and demographic profiles.',
      },
      {
        id: 'sa-analytics-charts',
        targetSelector: '[data-tour="analytics-charts"]',
        title: 'Growth Trajectory & Charts',
        subtitle: 'Insights Page',
        section: 'Insights',
        icon: 'monitoring',
        view: 'analytics',
        description:
          'Interactive SVG growth graphs showing cumulative member acquisition and cell health trends.',
      },

      // 10. Superadmin Settings
      {
        id: 'sa-nav-settings',
        targetSelector: '[data-tour="nav-settings"]',
        title: 'HQ System Settings Feature',
        subtitle: 'Sidebar Navigation',
        section: 'Settings',
        icon: 'settings',
        view: 'settings',
        description:
          'Configure global service programs, update Group Pastor credentials, enforce security passcodes, and trigger backups.',
      },
      {
        id: 'sa-settings-tabs',
        targetSelector: '[data-tour="settings-tabs"]',
        title: 'System Preferences & Security',
        subtitle: 'Settings Page',
        section: 'Settings',
        icon: 'admin_panel_settings',
        view: 'settings',
        description:
          'Manage the Security Auth Gate, global service programs, mNotify SMS messaging, and audit accountability trails.',
        tip: 'Congratulations! You have completed the master tour of every feature.',
      },
    ];
  }

  // Church Pastor, Church Admin, Usher 8+ Feature Journey
  return [
    // ----------------------------------------------------
    // FEATURE 1: OVERVIEW
    // ----------------------------------------------------
    {
      id: 'step-nav-overview',
      targetSelector: '[data-tour="nav-dashboard"]',
      title: 'Overview Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Overview',
      icon: 'space_dashboard',
      view: 'dashboard',
      description:
        'The Overview tab on your sidebar is your church\'s operational command center. Everything else is blurred so you can see each section clearly as we step through.',
      tip: 'Clicking Overview returns you to this core dashboard anytime from any sub-page.',
    },
    {
      id: 'step-metric-members',
      targetSelector: '[data-tour="metric-members"]',
      title: 'Registered Members Counter',
      subtitle: 'Overview Page',
      section: 'Overview',
      icon: 'groups',
      view: 'dashboard',
      description:
        'Tracks all registered members in your active church branch. Live counts update automatically as people register, import spreadsheets, or check in.',
      tip: 'Clicking on this card or navigating to Members lets you view, search, and edit complete congregation profiles.',
    },
    {
      id: 'step-metric-attendance',
      targetSelector: '[data-tour="metric-attendance"]',
      title: 'Live Service Attendance',
      subtitle: 'Overview Page',
      section: 'Overview',
      icon: 'how_to_reg',
      view: 'dashboard',
      description:
        'Audit real-time attendance for today\'s service. Live counters break down check-ins by Sunday Service, Midweek Service, or Special programs as members arrive.',
      tip: 'Ushers and coordinators scanning digital QR passes instantly increment these attendance counters live.',
    },
    {
      id: 'step-metric-firsttimers',
      targetSelector: '[data-tour="metric-firsttimers"]',
      title: 'First Timers & New Converts',
      subtitle: 'Overview Page',
      section: 'Overview',
      icon: 'person_add_alt',
      view: 'dashboard',
      description:
        'Highlights guests attending church for their first time this week. When they attend twice, the system automatically advances them from first timer to regular member.',
      tip: 'Follow up with first timers promptly and assign them to an inviting cell leader.',
    },
    {
      id: 'step-overview-actions',
      targetSelector: '[data-tour="overview-actions"]',
      title: 'Quick Operations Toolbar',
      subtitle: 'Overview Page',
      section: 'Overview',
      icon: 'bolt',
      view: 'dashboard',
      description:
        'Rapid shortcuts for Sunday operations: launch the QR check-in camera scanner, view the leader hierarchy, review evangelism records, or appoint ushers with one click.',
      tip: 'Church pastors and administrators can also broadcast announcements to all church leaders directly from here.',
    },
    {
      id: 'step-overview-leaders',
      targetSelector: '[data-tour="overview-pcf-leaders"]',
      title: 'PCF & Cell Leaders Rosters',
      subtitle: 'Overview Page',
      section: 'Overview',
      icon: 'diversity_3',
      view: 'dashboard',
      description:
        'Review your active PCF and Cell leaders. Hierarchy links automatically roll up attendance figures from BSCT to Cell to PCF tiers for complete visibility.',
      tip: 'Click "Manage PCFs" or visit the Leaders tab to review promotion requests and appointed cell leaders.',
    },

    // ----------------------------------------------------
    // FEATURE 2: PCF & CELL LEADERS
    // ----------------------------------------------------
    {
      id: 'step-nav-leaders',
      targetSelector: '[data-tour="nav-leaders"]',
      title: 'PCF & Cell Leaders Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Leaders',
      icon: 'diversity_3',
      view: 'leaders',
      description:
        'Now let\'s explore the PCF & Cell Leaders feature. Clicking this takes you straight into the leadership management directory.',
      tip: 'Watch as the tour now transitions you into the PCF & Cell Leaders page!',
    },
    {
      id: 'step-leaders-filters',
      targetSelector: '[data-tour="leaders-filters"]',
      title: 'Leader Search & Tier Filters',
      subtitle: 'Leaders Page',
      section: 'Leaders',
      icon: 'search',
      view: 'leaders',
      description:
        'Filter leaders by tier: Church Coordinators, PCF Leaders, Cell Leaders, or BSCTs. Type any name to instantly isolate their leadership record.',
      tip: 'Quickly find which leader supervises a given cell or Bible study class.',
    },
    {
      id: 'step-leaders-actions',
      targetSelector: '[data-tour="leaders-actions"]',
      title: 'Leadership Actions & Deduplication',
      subtitle: 'Leaders Page',
      section: 'Leaders',
      icon: 'person_add',
      view: 'leaders',
      description:
        'Register new leaders into the system, or merge duplicate names to ensure members and attendance rollups remain clean.',
      tip: 'The Merge Leaders tool automatically re-assigns members when duplicate spellings are merged.',
    },
    {
      id: 'step-leaders-table',
      targetSelector: '[data-tour="leaders-table"]',
      title: 'Active Leadership Roster',
      subtitle: 'Leaders Page',
      section: 'Leaders',
      icon: 'badge',
      view: 'leaders',
      description:
        'The leadership roster displays appointed cell and PCF leaders, their assigned church branch, cell name, and member counts.',
      tip: 'You can edit contact info or update leader appointments anytime from this roster.',
    },

    // ----------------------------------------------------
    // FEATURE 3: LEADER HIERARCHY
    // ----------------------------------------------------
    {
      id: 'step-nav-hierarchy',
      targetSelector: '[data-tour="nav-hierarchy"]',
      title: 'Leader Hierarchy Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Hierarchy',
      icon: 'account_tree',
      view: 'hierarchy',
      description:
        'The Leader Hierarchy feature defines the chain of leadership: BSCT (Bible Study Class Teachers) report to Cell Leaders, who report to PCF Leaders.',
      tip: 'Only church pastors edit hierarchy assignments, ensuring totals roll up correctly for everyone.',
    },
    {
      id: 'step-hierarchy-tree',
      targetSelector: '[data-tour="hierarchy-tree"]',
      title: 'Lineage Tree & Attendance Rollup',
      subtitle: 'Hierarchy Page',
      section: 'Hierarchy',
      icon: 'schema',
      view: 'hierarchy',
      description:
        'Assign which cell leader each BSCT reports to, and which PCF leader each cell leader reports to. The attendance rollup dynamically sums up numbers at each level.',
      tip: 'Every leader down the chain sees consistent, verified attendance figures.',
    },

    // ----------------------------------------------------
    // FEATURE 4: MEMBERS DATABASE
    // ----------------------------------------------------
    {
      id: 'step-nav-members',
      targetSelector: '[data-tour="nav-members"]',
      title: 'Members Database Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Members',
      icon: 'group',
      view: 'members',
      description:
        'The Members Database is the heart of your congregation records. Clicking here opens the complete directory with digital passes and Foundation School tracking.',
    },
    {
      id: 'step-members-filters',
      targetSelector: '[data-tour="members-filters"]',
      title: 'Real-Time Congregation Search',
      subtitle: 'Members Page',
      section: 'Members',
      icon: 'tune',
      view: 'members',
      description:
        'Search instantly by member name, phone number, or role. Filter by Foundation School progress (Class 1-7 or Completed) or by inviting cell leader.',
      tip: 'Typing just 3 letters or numbers finds members immediately.',
    },
    {
      id: 'step-members-actions',
      targetSelector: '[data-tour="members-actions"]',
      title: 'Member Registration & CSV Export',
      subtitle: 'Members Page',
      section: 'Members',
      icon: 'person_add',
      view: 'members',
      description:
        'Register a new member with photo and contact details, or export the entire member roster into a clean spreadsheet for church reporting.',
    },
    {
      id: 'step-members-table',
      targetSelector: '[data-tour="members-table"]',
      title: 'Congregation Records & Digital Passes',
      subtitle: 'Members Page',
      section: 'Members',
      icon: 'badge',
      view: 'members',
      description:
        'Click on any row to open the member\'s official digital pass with an embedded QR code for lightning-fast camera check-ins at church.',
      tip: 'Direct WhatsApp and Call buttons let you follow up with members with one click.',
    },

    // ----------------------------------------------------
    // FEATURE 5: ATTENDANCE RECORDS
    // ----------------------------------------------------
    {
      id: 'step-nav-attendance',
      targetSelector: '[data-tour="nav-attendance"]',
      title: 'Attendance Records Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Attendance',
      icon: 'fact_check',
      view: 'attendance',
      description:
        'The Attendance feature records and audits every person who checks into Sunday services, midweek meetings, or special conventions.',
    },
    {
      id: 'step-attendance-controls',
      targetSelector: '[data-tour="attendance-controls"]',
      title: 'Service Date & Category Filters',
      subtitle: 'Attendance Page',
      section: 'Attendance',
      icon: 'event',
      view: 'attendance',
      description:
        'Pick any service date to inspect historical attendance archives, or filter between Sunday Service, Mid-week Service, and Youth Ministry.',
      tip: 'You can also filter by cell leader to see exactly which leader brought the most members on a given Sunday.',
    },
    {
      id: 'step-attendance-actions',
      targetSelector: '[data-tour="attendance-actions"]',
      title: 'Manual Recording & Finalize Day',
      subtitle: 'Attendance Page',
      section: 'Attendance',
      icon: 'verified',
      view: 'attendance',
      description:
        'Record attendance by hand for members who arrive without a phone, finalize the service day to archive records, or export the attendance register to Excel.',
    },
    {
      id: 'step-attendance-table',
      targetSelector: '[data-tour="attendance-table"]',
      title: 'Live Check-In Stream',
      subtitle: 'Attendance Page',
      section: 'Attendance',
      icon: 'history_toggle_off',
      view: 'attendance',
      description:
        'Real-time stream showing check-in timestamp, attendee name, member status, station verifier, and inviting leader attribution.',
    },

    // ----------------------------------------------------
    // FEATURE 6: EVANGELISM & SOULS
    // ----------------------------------------------------
    {
      id: 'step-nav-evangelism',
      targetSelector: '[data-tour="nav-evangelism"]',
      title: 'Evangelism & Souls Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Evangelism',
      icon: 'campaign',
      view: 'evangelism',
      description:
        'The Evangelism & Souls feature connects weekly outreach soulwinning into church membership and follow-up.',
    },
    {
      id: 'step-evangelism-stats',
      targetSelector: '[data-tour="evangelism-stats"]',
      title: 'Outreach & Conversion Metrics',
      subtitle: 'Evangelism Page',
      section: 'Evangelism',
      icon: 'trending_up',
      view: 'evangelism',
      description:
        'High-level metrics tracking total souls won by cell groups, how many have attended church, and the overall retention conversion rate.',
    },
    {
      id: 'step-evangelism-actions',
      targetSelector: '[data-tour="evangelism-actions"]',
      title: 'Download Templates & Export Data',
      subtitle: 'Evangelism Page',
      section: 'Evangelism',
      icon: 'file_download',
      view: 'evangelism',
      description:
        'Download the pre-formatted Excel template for cell leaders to record souls during street and campus outreaches, or export data for pastoral reporting.',
    },
    {
      id: 'step-evangelism-table',
      targetSelector: '[data-tour="evangelism-table"]',
      title: 'Outreach Contact Log',
      subtitle: 'Evangelism Page',
      section: 'Evangelism',
      icon: 'contacts',
      view: 'evangelism',
      description:
        'Shows every soul won, their cell leader, phone contact, and status. When they attend church, move them to the member database with one click!',
    },

    // ----------------------------------------------------
    // FEATURE 7: WEEKLY CELL REPORTS
    // ----------------------------------------------------
    {
      id: 'step-nav-cell_reports',
      targetSelector: '[data-tour="nav-cell_reports"]',
      title: 'Weekly Cell Reports Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Cell Reports',
      icon: 'assignment',
      view: 'cell_reports',
      description:
        'The Weekly Cell Reports feature aggregates official weekly returns submitted by all cell leaders in your branch.',
    },
    {
      id: 'step-cell-reports-summary',
      targetSelector: '[data-tour="cell-reports-summary"]',
      title: 'Weekly Return Counters',
      subtitle: 'Cell Reports Page',
      section: 'Cell Reports',
      icon: 'groups',
      view: 'cell_reports',
      description:
        'Summary cards tracking total reports submitted, cell meeting attendance, first timers, souls won, and offerings collected.',
    },
    {
      id: 'step-cell-reports-filters',
      targetSelector: '[data-tour="cell-reports-filters"]',
      title: 'Filter Reports by Leader & Date',
      subtitle: 'Cell Reports Page',
      section: 'Cell Reports',
      icon: 'filter_alt',
      view: 'cell_reports',
      description:
        'Isolate returns from specific cell leaders, filter by report date, and track weekly meeting compliance.',
    },
    {
      id: 'step-cell-reports-table',
      targetSelector: '[data-tour="cell-reports-table"]',
      title: 'Submitted Report Sheets',
      subtitle: 'Cell Reports Page',
      section: 'Cell Reports',
      icon: 'table_chart',
      view: 'cell_reports',
      description:
        'Click "View" on any row to inspect the full submitted cell sheet, printable for pastoral file keeping.',
    },

    // ----------------------------------------------------
    // FEATURE 8: INSIGHTS & ANALYTICS
    // ----------------------------------------------------
    {
      id: 'step-nav-analytics',
      targetSelector: '[data-tour="nav-analytics"]',
      title: 'Insights & Analytics Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Insights',
      icon: 'analytics',
      view: 'analytics',
      description:
        'The Insights & Analytics feature delivers visual charts on congregation demographics, arrival times, professions, and longitudinal growth.',
    },
    {
      id: 'step-analytics-controls',
      targetSelector: '[data-tour="analytics-controls"]',
      title: 'Analytics Tools & Sync',
      subtitle: 'Insights Page',
      section: 'Insights',
      icon: 'sync',
      view: 'analytics',
      description:
        'Sync real-time analytics with the Supabase database or export comprehensive demographic summaries to CSV.',
    },
    {
      id: 'step-analytics-charts',
      targetSelector: '[data-tour="analytics-charts"]',
      title: '12-Month Growth & Peak Arrival Charts',
      subtitle: 'Insights Page',
      section: 'Insights',
      icon: 'monitoring',
      view: 'analytics',
      description:
        'Interactive SVG charts illustrate cumulative member acquisition, arrival time distribution, gender ratios, and top professions.',
    },

    // ----------------------------------------------------
    // FEATURE 9: BRANCH SETTINGS & ADMINISTRATION
    // ----------------------------------------------------
    {
      id: 'step-nav-settings',
      targetSelector: '[data-tour="nav-settings"]',
      title: 'Branch Settings Feature',
      subtitle: 'Sidebar Navigation',
      section: 'Settings',
      icon: 'settings',
      view: 'settings',
      description:
        'The Settings tab lets you configure church parameters, appoint ushers, manage SMS messaging, and customize scanner defaults.',
    },
    {
      id: 'step-settings-tabs',
      targetSelector: '[data-tour="settings-tabs"]',
      title: 'Branch Configuration & Preferences',
      subtitle: 'Settings Page',
      section: 'Settings',
      icon: 'tune',
      view: 'settings',
      description:
        'Easily manage your Branch Profile, appoint ushers for camera check-in stations, setup automated mNotify SMS attendance messages, and audit activity logs.',
      tip: 'You\'re all set! You can replay this walkthrough anytime using the "Guide Me" button in the bottom corner.',
    },
  ];
}

const isSameRect = (a: DOMRect | null, b: DOMRect | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(Math.round(a.top) - Math.round(b.top)) <= 2 &&
    Math.abs(Math.round(a.left) - Math.round(b.left)) <= 2 &&
    Math.abs(Math.round(a.width) - Math.round(b.width)) <= 2 &&
    Math.abs(Math.round(a.height) - Math.round(b.height)) <= 2
  );
};

export const DashboardWalkthrough: React.FC<DashboardWalkthroughProps> = ({
  isOpen,
  user,
  currentView,
  mode = 'full',
  targetPage,
  onNavigate,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showSectionMenu, setShowSectionMenu] = useState(false);

  const allRoleSteps = useMemo(() => getAllStepsForRole(user.role), [user.role]);

  // Filter steps depending on full master journey or page-level replay mode
  const steps = useMemo(() => {
    if (mode === 'page' && targetPage) {
      const pageSteps = allRoleSteps.filter((s) => s.view === targetPage);
      return pageSteps.length > 0 ? pageSteps : allRoleSteps;
    }
    return allRoleSteps;
  }, [allRoleSteps, mode, targetPage]);

  const currentStep = steps[stepIndex] || steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const retryTimerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);

  // Reset to first step whenever walkthrough opens
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setTargetRect(null);
      setShowSectionMenu(false);
    }
  }, [isOpen, mode, targetPage]);

  // Unique sections for quick jump menu
  const uniqueSections = useMemo(() => {
    const map = new Map<string, number>();
    steps.forEach((s, idx) => {
      if (!map.has(s.section)) {
        map.set(s.section, idx);
      }
    });
    return Array.from(map.entries()).map(([name, firstStepIndex]) => ({
      name,
      firstStepIndex,
    }));
  }, [steps]);

  // Debounced bounding rect measurement
  const measureTarget = useCallback(() => {
    if (!isOpen || !currentStep) return;
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect((prev) => (isSameRect(prev, r) ? prev : r));
    } else {
      setTargetRect((prev) => (prev === null ? prev : null));
    }
  }, [isOpen, currentStep]);

  // Synchronize view navigation when stepping to a step in a different view
  useEffect(() => {
    if (!isOpen || !currentStep) return;
    if (currentStep.view && onNavigate && currentView !== currentStep.view) {
      navigatingRef.current = true;
      onNavigate(currentStep.view);
      const timer = setTimeout(() => {
        navigatingRef.current = false;
        measureTarget();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stepIndex, currentStep?.view, onNavigate, currentView, measureTarget]);

  // Locate spotlighted element safely and scroll it into view
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    let attempts = 0;
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);

    const tryFind = () => {
      attempts += 1;
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) {
        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        setTargetRect((prev) => (isSameRect(prev, r) ? prev : r));
      } else if (attempts >= 12) {
        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
        setTargetRect((prev) => (prev === null ? prev : null));
      }
    };

    // Delay slightly to give React views time to mount
    const initialDelay = setTimeout(tryFind, 80);
    retryTimerRef.current = setInterval(tryFind, 180);

    const onScrollOrResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measureTarget);
    };

    window.addEventListener('resize', onScrollOrResize, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });

    return () => {
      clearTimeout(initialDelay);
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, stepIndex, currentStep?.targetSelector, measureTarget]);

  // Keyboard navigation: Escape / ArrowLeft / ArrowRight
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

  if (!isOpen || !currentStep) return null;

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

  // Tooltip positioning relative to targetRect with boundary protection
  const getPopoverStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? window.innerWidth - 32 : 400;
    const estimatedHeight = 310;
    const padding = 16;

    if (!targetRect || isMobile) {
      return {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: `${cardWidth}px`,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 9999,
      };
    }

    const { top, bottom, left, right } = targetRect;
    const spaceRight = window.innerWidth - right;
    const spaceBottom = window.innerHeight - bottom;
    const spaceTop = top;

    // 1. If target is in the sidebar (left rail): position to the right
    if (left < 320 && spaceRight >= cardWidth + 30) {
      const topPos = Math.max(padding, Math.min(window.innerHeight - estimatedHeight - padding, top - 12));
      return {
        position: 'fixed',
        left: `${right + 20}px`,
        top: `${topPos}px`,
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    // 2. Position below the target element if sufficient vertical clearance exists
    if (spaceBottom >= estimatedHeight + 24) {
      const leftPos = Math.max(padding, Math.min(window.innerWidth - cardWidth - padding, left));
      return {
        position: 'fixed',
        top: `${bottom + 16}px`,
        left: `${leftPos}px`,
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    // 3. Position above the target element
    if (spaceTop >= estimatedHeight + 24) {
      const leftPos = Math.max(padding, Math.min(window.innerWidth - cardWidth - padding, left));
      return {
        position: 'fixed',
        bottom: `${window.innerHeight - top + 16}px`,
        left: `${leftPos}px`,
        width: `${cardWidth}px`,
        zIndex: 9999,
      };
    }

    // 4. Centered fallback inside viewport
    return {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: `${cardWidth}px`,
      zIndex: 9999,
    };
  };

  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Step-by-Step Walkthrough"
      className="fixed inset-0 z-[9990] pointer-events-auto"
    >
      {/* 1. Frosted Glass Blur Backdrop with SVG Mask Cutout */}
      <svg className="fixed inset-0 w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <mask id="walkthrough-spotlight-mask" maskUnits="userSpaceOnUse">
            {/* White reveals the blurred and dimmed background */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlighted element so it is 100% unblurred and crisp */}
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx={18}
                ry={18}
                fill="black"
              />
            )}
          </mask>
        </defs>
      </svg>

      {/* Frosted Glass Overlay with Dimmed Backdrop */}
      <div
        className="fixed inset-0 z-[9991] transition-all duration-300 pointer-events-auto"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          mask: 'url(#walkthrough-spotlight-mask)',
          WebkitMask: 'url(#walkthrough-spotlight-mask)',
        }}
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* 2. Spotlight Ring & Luminous Glow surrounding the cut-out target */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[9995] rounded-2xl border-2 border-blue-400 ring-4 ring-blue-500/30 transition-all duration-300 ease-out"
          style={{
            top: `${targetRect.top - 8}px`,
            left: `${targetRect.left - 8}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
            boxShadow: '0 0 35px rgba(59, 130, 246, 0.5), inset 0 0 16px rgba(59, 130, 246, 0.2)',
          }}
        >
          {/* Pulsing corner beacon */}
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-sm" />
          </span>
        </div>
      )}

      {/* 3. Floating Tooltip Card */}
      <div
        style={getPopoverStyle()}
        className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 text-white rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 z-[9999]"
      >
        {/* Step Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-[22px]">{currentStep.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block truncate">
                  Step {stepIndex + 1} of {steps.length} · {currentStep.section}
                </span>
                {mode === 'page' && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                    Page Tour
                  </span>
                )}
              </div>
              <h3 className="font-headline font-bold text-base text-white leading-snug truncate">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Jump To Section Toggle */}
            {uniqueSections.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowSectionMenu(!showSectionMenu)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center"
                  title="Jump to feature section"
                  aria-label="Jump to feature section"
                >
                  <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                </button>

                {showSectionMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 z-50 text-xs space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                      Jump to Section
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {uniqueSections.map((sec) => (
                        <button
                          key={sec.name}
                          onClick={() => {
                            setStepIndex(sec.firstStepIndex);
                            setShowSectionMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            currentStep.section === sec.name
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <span>{sec.name}</span>
                          <span className="text-[10px] opacity-60">Step {sec.firstStepIndex + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSkip}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close walkthrough"
              title="Close walkthrough"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Step Explanation */}
        <p className="text-xs text-slate-300 leading-relaxed font-body">
          {currentStep.description}
        </p>

        {/* Helpful Tip Box */}
        {currentStep.tip && (
          <div className="bg-blue-950/50 border border-blue-800/60 rounded-xl px-3 py-2 text-[11px] text-blue-200 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-400 text-base shrink-0 mt-0.5">
              lightbulb
            </span>
            <span className="leading-snug">{currentStep.tip}</span>
          </div>
        )}

        {/* Navigation & Controls */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={handleSkip}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={isFirst}
              onClick={handlePrev}
              className="py-1 px-3 min-h-[34px] text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back</span>
            </Button>

            <Button
              variant="primary"
              onClick={handleNext}
              className="py-1 px-4 min-h-[34px] text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30"
            >
              <span>{isLast ? 'Finish Tour' : 'Next'}</span>
              <span className="material-symbols-outlined text-sm">
                {isLast ? 'check_circle' : 'arrow_forward'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
