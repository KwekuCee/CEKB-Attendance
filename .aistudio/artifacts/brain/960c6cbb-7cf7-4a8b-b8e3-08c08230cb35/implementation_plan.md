# Comprehensive Multi-Feature Dashboard Walkthrough & Interactive Page Guides

Expand the dashboard walkthrough from a brief overview into a complete, in-depth guided system that takes administrators, pastors, and leaders through every sidebar feature and into each feature's actual page—highlighting and spotlighting tables, filters, actions, and key tools with frosted glass blur, glowing spotlight rings, page-level replay buttons, and a persistent floating help beacon.

## User Decisions & Clarifications Summary

- **Walkthrough Architecture**: **Hybrid Model** — A master end-to-end guided journey visiting each sidebar item followed by detailed deep dives into that feature's page, plus **page-level "Tour This Page" replay buttons** in every section header.
- **Depth Per Page**: **Detailed Walkthrough** — Spotlight all essential operational components:
  1. Header filters, date pickers, and search inputs
  2. Primary action buttons (Add Member, Appoint Leader, Export, Upload, QR Scanner)
  3. Core data tables, card grids, hierarchy trees, and report submission forms
- **Re-launch Mechanism**: **Floating Help Beacon** in the bottom corner with options to:
  - "Start Full Guided Journey" (from Overview to Settings)
  - "Tour This Page" (context-aware guide for the currently active screen)
  - Dismiss/Minimize beacon anytime

---

## 1. Feature-by-Feature Tour Architecture

Every feature follows the user's requested mental model:
**Sidebar Feature Button highlighted (blurred background) → View auto-navigates into that feature's page → Key filters spotlighted → Action buttons spotlighted → Main data table / workspace spotlighted → Next sidebar feature.**

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Master Walkthrough Loop                         │
│                                                                        │
│   [Sidebar: Feature Tab]  ──(auto-navigate)──►  [Page: Filters/Search] │
│              ▲                                           │             │
│              │                                           ▼             │
│       (next feature)                             [Page: Action Bars]   │
│              │                                           │             │
│              │                                           ▼             │
│   [Page: Next Feature...] ◄───────────────────── [Page: Data Tables]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Church Pastor & Church Admin Dashboard Journey

1. **Feature 1: Overview Command Center**
   - **Sidebar**: `[data-tour="nav-dashboard"]` — Overview tab on sidebar with frosted backdrop.
   - **Page Metrics**: `[data-tour="metric-members"]`, `[data-tour="metric-attendance"]`, `[data-tour="metric-firsttimers"]` — Congregation headcounts and live attendance counters.
   - **Page Trend**: `[data-tour="overview-trend"]` — Attendance trend graph and service category breakdown.
   - **Page Actions**: `[data-tour="overview-actions"]` — Quick access bar (QR scanner launch, appoint usher, export records).

2. **Feature 2: PCF & Cell Leaders**
   - **Sidebar**: `[data-tour="nav-leaders"]` — PCF & Cell Leaders sidebar button.
   - **Page Filters**: `[data-tour="leaders-filters"]` — Search by leader name, role filter (PCF Leader, Senior Cell Leader, Cell Leader, BSCT).
   - **Page Actions**: `[data-tour="leaders-actions"]` — "Register New Leader" button and export options.
   - **Page Roster Table**: `[data-tour="leaders-table"]` — Active leadership roster showing member rollups, contact buttons, and cell assignments.

3. **Feature 3: Leader Hierarchy**
   - **Sidebar**: `[data-tour="nav-hierarchy"]` — Leader Hierarchy tree tab.
   - **Page Tree & Rollup**: `[data-tour="hierarchy-tree"]` — Interactive BSCT → PCF → Cell lineage tree with aggregate attendance rollup counters.

4. **Feature 4: Members Database**
   - **Sidebar**: `[data-tour="nav-members"]` — Members database navigation tab.
   - **Page Search & Filters**: `[data-tour="members-filters"]` — Member search input, cell group selector, and Foundation Class filters.
   - **Page Actions**: `[data-tour="members-actions"]` — "Add Member", "Bulk Import / Excel", and export buttons.
   - **Page Roster Table**: `[data-tour="members-table"]` — Members table with digital QR pass generation, attendance count, and WhatsApp/Call shortcuts.

5. **Feature 5: Attendance Records**
   - **Sidebar**: `[data-tour="nav-attendance"]` — Attendance check-in records tab.
   - **Page Date & Service Controls**: `[data-tour="attendance-controls"]` — Service date picker, service category switch (Sunday, Midweek, Special), and inviter search.
   - **Page Attendance Table**: `[data-tour="attendance-table"]` — Live attendee list with check-in timestamp, service type, and usher signature.

6. **Feature 6: Evangelism & Souls**
   - **Sidebar**: `[data-tour="nav-evangelism"]` — Evangelism & Soulwinning tab.
   - **Page Outreach Tools**: `[data-tour="evangelism-actions"]` — Soul spreadsheet importer, manual soul logger, and downloadable Excel template.
   - **Page Convert Table**: `[data-tour="evangelism-table"]` — Outreach contact log with "Convert to Member" one-click promotion.

7. **Feature 7: Weekly Cell Reports**
   - **Sidebar**: `[data-tour="nav-cell_reports"]` — Weekly Cell Reports tab.
   - **Page Report Form & Passcode Gate**: `[data-tour="cell-reports-container"]` — Passcode unlock gate, weekly attendance metrics, souls won, and offering inputs.

8. **Feature 8: Insights & Analytics**
   - **Sidebar**: `[data-tour="nav-analytics"]` — Insights & Analytics tab.
   - **Page Visual Charts**: `[data-tour="analytics-charts"]` — Longitudinal growth graphs, month-over-month retention, and cell health indicators.

9. **Feature 9: Branch Settings & Administration**
   - **Sidebar**: `[data-tour="nav-settings"]` — Settings tab.
   - **Page Configuration Tabs**: `[data-tour="settings-tabs"]` — Branch Profile, SMS Messaging (mNotify), Appoint Ushers, Scanner defaults, Security, and Cloud Backups.

---

### Group Pastor / Superadmin Variant

Adds dedicated steps for:
- **Group Overview / Churches**: `[data-tour="nav-group_overview"]` & `[data-tour="group-churches-table"]` — Multi-branch network aggregate table, individual church rollups, and church registration.
- **Church Admins Directory**: `[data-tour="nav-church_admins_directory"]` & `[data-tour="church-admins-table"]` — Appointing and auditing church pastors and administrators across all branches.

---

### Leader Portal Variant (`LeaderHome.tsx`)

Steps through the leader's specific command center:
1. Leader Sidebar Overview → Group Rollup Metrics
2. Attendance Tab → Service breakdown for cell members & invitees
3. Cell Members Tab → Assigned members roster & contact actions
4. Evangelism Tab → Outreach sheet upload & soul tracker
5. Cell Reports Tab → Weekly report submission form
6. Leader Account & Sign-Out button

---

## 2. Floating Help Beacon & Page-Level "Guide Me" Buttons

### 1. Floating Help Beacon
- **Location**: Fixed floating pill/circle at `bottom-6 right-6` (or `bottom-20 right-4` on mobile to avoid obscuring bottom tabs).
- **Appearance**: Premium gradient pill (`bg-slate-900/90 hover:bg-slate-800 text-white border border-blue-500/40 shadow-2xl backdrop-blur-md px-3.5 py-2.5 rounded-full flex items-center gap-2 cursor-pointer`).
- **Interactive Menu**:
  - 🚀 **Start Full Dashboard Tour** (Starts comprehensive journey from Step 1)
  - 📖 **Tour This Page** (Triggers localized walkthrough of the current screen)
  - ✕ **Dismiss / Hide** (Allows hiding or collapsing to a subtle beacon icon)

### 2. Page-Level "Guide Me" Buttons
- Added to each view's header toolbar (Overview, Leaders, Members, Attendance, Evangelism, Reports, Analytics, Settings).
- Small button with tour icon (`explore` or `tour`) labeled "Guide Me" or "Tour Page".
- Clicking launches the walkthrough specifically filtered to that page's steps, allowing quick refresher guidance without going through all 27 steps.

---

## 3. Technical Implementation & Safety Plan

### Component Architecture
1. **`src/components/DashboardWalkthrough.tsx`**:
   - Accepts mode prop: `mode?: 'full' | 'page'` and `targetPage?: ViewType`.
   - Comprehensive step definitions organized by view and role with clear IDs, icons, titles, descriptions, and tips.
   - Safe asynchronous `tryFind` mechanism with debounced observers to ensure DOM nodes are fully rendered before calculating bounding rectangles.
   - Step navigation controls: Back, Next, Jump to Section, and Skip Tour.
   - Progress indicator showing current step and section (e.g. `Step 4 of 24 · Members Database`).

2. **Tagging `data-tour` Attributes in View Components**:
   - `Sidebar.tsx`: `nav-dashboard`, `nav-leaders`, `nav-hierarchy`, `nav-members`, `nav-attendance`, `nav-evangelism`, `nav-cell_reports`, `nav-analytics`, `nav-settings`, `nav-group_overview`, `nav-church_admins_directory`.
   - `DashboardOverview.tsx`: `metric-members`, `metric-attendance`, `metric-firsttimers`, `overview-trend`, `overview-actions`.
   - `LeadersDirectory.tsx`: `leaders-filters`, `leaders-actions`, `leaders-table`.
   - `LeaderHierarchyTree.tsx`: `hierarchy-tree`.
   - `MembersDirectory.tsx`: `members-filters`, `members-actions`, `members-table`.
   - `AttendanceRecords.tsx`: `attendance-controls`, `attendance-table`.
   - `EvangelismManager.tsx`: `evangelism-actions`, `evangelism-table`.
   - `WeeklyCellReports.tsx`: `cell-reports-container`.
   - `AnalyticsView.tsx`: `analytics-charts`.
   - `SettingsView.tsx`: `settings-tabs`.

3. **Floating Help Beacon Component (`src/components/WalkthroughBeacon.tsx`)**:
   - Standalone component mounted in `App.tsx` and `LeaderHome.tsx`.
   - Controls full-tour vs current-page tour triggering.

---

## 4. Verification & Testing

1. **Compilation & Linting**:
   - Run `lint_applet` and `compile_applet` to ensure zero TypeScript errors or missing imports.
2. **Infinite Loop Prevention**:
   - Verify that rapid next/back clicks or view switching never triggers nested `setState` or max update depth exceeded errors.
3. **Responsive Behavior**:
   - Verify spotlight mask positioning across mobile, tablet, and desktop viewports.
   - Verify safe area avoidance for floating beacon and mobile bottom navigation.
4. **Role Integrity**:
   - Test Superadmin, Church Admin, Church Pastor, Usher, and Leader views to ensure step sequences match the visible navigation items for each role.
