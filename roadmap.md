# Roadmap

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
- [ ] Kiosk mode, offline check-in, service open/close times, attendance undo
- [ ] Absentee auto-assign + follow-up tracker, first-timer journey
- [ ] WhatsApp/SMS reminders (needs WhatsApp Business connection)
- [ ] Leader sign-in, report reminders, report trends, leader family tree
- [ ] Branch comparison, goals, bulk actions, duplicate merge, activity log screen
- [ ] Two-step sign-in, weekly backup export, usher role, system health page
