# Roadmap

## Mobile opening screen (Oct 9, 2026)
- [x] Branded circular loader for three seconds on mobile page entry, followed by a smooth website reveal
- [x] Verify logo rendering, opening transition and immediate desktop entry

## Public form refinement (Oct 9, 2026)
- [x] Tile-grid flow navigation and large bold detail headings
- [x] Stationary desktop navigation with independently scrolling form cards
- [x] Full-height centered report entry and sign-in cards with visible sign-in heading
- [x] Verify switching, scrolling and card alignment in the browser

## Equal-split public forms and attendance hero (Oct 9, 2026)
- [x] Equal-width navigation rectangle and selected form across all five public flows
- [x] Attendance-focused hero message and non-button focus labels
- [x] Verify form switching and equal column widths in the browser

## AEUX-inspired analytic workspace (Oct 9, 2026)
- [x] Rounded dashboard workspace with refined dark navigation
- [x] Remove card-top and active-navigation edge lines
- [x] Solid black actions with restrained blue analytic accents
- [x] Split public forms into side navigation and form workspace
- [x] Browser verification across dashboard and public forms; real-account role checks remain blocked below

## Blue palette and public form redesign (Oct 9, 2026)
- [x] Apply uploaded six-color palette throughout screens
- [x] Rounded controls, panels and tiles
- [x] Redesign opened attendance, leader, church, report and login pages
- [x] Check public forms, navigation, typography and dashboard/scanner layouts; real-account submission checks remain pending below

## Reference-style dashboards and scanner (Oct 9, 2026)
- [x] Charcoal navigation, mint workspace, green accents across dashboard views
- [x] Matching scanner workspace with live camera and visible logout
- [x] Sora headings and Manrope body typography
- [x] Verify dashboard view layouts, scanner controls, logout and fonts; real-account checks remain pending below

## Whole-system redesign (Oct 9, 2026)
- [x] Visible usher logout inside the scanner; clears account and gateway token
- [x] New homepage and public navigation
- [x] Unified dashboard, onboarding, authentication, report and check-in styling
- [x] Verify public navigation, phone layouts, scanner logout and dashboard view rendering
- [ ] Real-account dashboard and usher sign-in verification — requires a user signed into the app; managed auth has no users

- [x] Connect the app to the Lovable Cloud database (all tables + relations)
- [x] Point the client at platform env vars instead of hardcoded credentials
- [x] Verify login and dashboard data end-to-end
- [x] Clear all typecheck/build errors, including pre-existing ones
- [x] Purge all demo data; single Superadmin (wadievanessa@gmail.com)
- [x] Self-attendance: QR pass download + admin email edge function deployed
- [x] Superadmin service type create/delete persisted to database
- [x] Leader self-reg dropdown limited to admin-registered churches
- [x] Admin signup branch name feeds attendance + leader-reg dropdowns
- [x] Removed dashboard Service Types Control; services come only from Settings
- [x] QR scan records attendance instantly ("Scan Next Member")
- [x] Leader registration: member dropdown with autofill + DB-driven church list
- [x] Admin dashboard shows attendance per leader plus total attendance
- [x] Attendance grouped by PCF, cell and every leader (rolled up through the structure) on both dashboards
- [x] QR scanner really reads the passes the app creates (camera decoding, records instantly, blocks repeats)
- [x] Member roles narrowed to Leader, Member, First Timer (legacy roles read as Member)
- [x] Leader self-registration lists every registered church branch
- [x] Finish flexible spreadsheet imports: derive leaders, link members, show matched headings, and complete missing leader details

## Branch privacy, group names, automatic growth (done)
- Branch admins limited to their own branch (members, leaders, attendance) — no cross-branch filters or church editing.
- Admins can record attendance by hand for people without phones; same person/service/day blocked.
- Bible study class / cell / PCF names shown and saved on members, leaders and attendance.
- Automatic growth: foundation graduates become Bible study class teachers; 4 under a leader promotes to cell leader; 4 cells promote to PCF leader. Superadmin appointments protected.

## System audit (Oct 2026)
- [x] Branch member counts kept correct automatically
- [x] Expired sign-in sessions cleaned daily
- [x] Branded email layout for system emails
- [ ] Link records by branch ID instead of name
- [ ] Sign-up/reset emails restyle, live end-to-end tests, close stale findings
- [x] Weekly Monday summary email to group pastor (incl. missing cell reports)
- [x] Fixed daily birthday reminders (scheduled job was being rejected)
- [x] Entrance (kiosk) mode with sound, offline check-in sync (attendance edit/delete already existed)
- [ ] Service open/close times with late flag
- [ ] Absentee auto-assign + follow-up tracker, first-timer journey
- [ ] WhatsApp/SMS reminders (needs WhatsApp Business connection)
- [ ] Leader sign-in, report reminders, report trends, leader family tree
- [ ] Branch comparison, goals, bulk actions, duplicate merge, activity log screen
- [ ] Two-step sign-in, weekly backup export, usher role, system health page
