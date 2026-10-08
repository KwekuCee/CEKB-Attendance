# System audit and feature roadmap

## What the database check showed (confirmed)
- 2 branches, 14 members, 7 leaders, 6 check-ins and 1 cell report. Every member, leader and check-in is linked to a real branch, and every leader has a leader code.
- **Branch member counts are wrong:** both branches show 0 members. MAKARIOS CHURCH really has 12 and CEKBU 2 has 2. The saved count is never updated.
- **27 expired sign-in sessions** are still stored. They are never cleaned up.
- **Lost check-ins** from before the last fix (for example Mike Vinci) can't be recovered.

## Still unchecked (step 1 of the build)
- New attendance flow end to end: check in from a phone, then confirm it appears on both dashboards.
- A full cell report submission, the phonebook button and the "too many attempts" limit.
- A real test email to confirm the logo and layout.
- A fresh security scan and database warnings check.
- Two old monitoring findings are still open. Both were already fixed, so they only need closing.
- The intermittent preview crash at start-up (duplicate React copy). Make sure it can't come back.

## Fixes
1. Keep branch member counts correct automatically. Use live counts in the dashboards and correct the two stored counts.
2. Remove expired sessions automatically every day.
3. Link records by branch ID instead of branch name, so renaming a branch or a spelling difference ("Tesano" vs "TESANO") can't break filters.
4. Finish restyling every email so it matches the app (royal blue and white, logo, clear buttons). This was requested earlier.
5. Close the stale findings and run the full verification above.

## Suggested features (pick what you want)
**Attendance**
- Kiosk mode: a tablet at the entrance that keeps scanning with sound and a big green tick.
- Offline check-in that syncs once the device is back online.
- Service sessions with open and close times, so late check-ins are flagged.
- An undo or correct-attendance option with a reason, saved in the activity log.

**Follow-up and care**
- Automatic absentee list after each service: members who missed 2 or more in a row, assigned to their leader.
- A follow-up tracker: called, visited, prayed with, plus notes.
- WhatsApp/SMS reminders for services, birthdays and absentees.
- First-timer journey: welcome message, then foundation school invite, then a leader assigned automatically.

**Leaders and cells**
- A leader's own sign-in to see their members, attendance and past reports.
- Weekly report reminders, plus a "missing reports" list for admins.
- Cell report trends: souls won, offering and attendance over time, per cell and PCF.
- A visual family tree of the leader structure.

**Admin and group pastor**
- A weekly summary email to the group pastor every Monday.
- Branch comparison: growth, retention and first-timer conversion rates.
- Goals per branch (for example 200 members by December) with progress bars.
- Bulk actions: message, move branch or update status for many members at once.
- Duplicate-member finder and merge (same phone or similar name).
- A full activity log screen with filters (who changed what, and when).

**Reliability and safety**
- Two-step sign-in for the group pastor account.
- Scheduled data export (backup to Excel) emailed weekly.
- Simple permission levels: usher (scan only), branch admin, group pastor.
- A system health page showing failed emails and blocked attempts.

## Technical details
- Counts: a trigger on members insert/delete/update(church_id) recalculates churches.members_count, plus a one-time backfill.
- Sessions: a pg_cron daily delete from portal_sessions where expires_at < now().
- Branch ID scoping: add church_id to portal_sessions on login. In portal-db, filter BRANCH_SCOPED tables by church_id, falling back to case-insensitive name matching.
- Emails: one shared HTML layout in _shared/mailer.ts (header with logo, blue band, card body, button style, footer), used by the bespoke function emails and mirrored in the auth email templates. Then redeploy.
- Verification: Playwright as the branch admin, curl tests on the edge functions, security scan, and the linter.
