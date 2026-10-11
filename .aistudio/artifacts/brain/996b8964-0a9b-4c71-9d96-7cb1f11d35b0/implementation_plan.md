# Connect Live Lovable Cloud Data & Multi-Church Visibility

Enable the application to query and display live accounts, churches (such as Makarios Church, CEKBU 2, PEPPMAKROS, PLASTICS, CE Korle Bu 5), and member data from your active Lovable Supabase backend, removing the fallback restrictions that previously displayed placeholder data.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Confirmed Status**: Your Lovable Cloud backend (`bouwuqpzplazpwuwyphq.supabase.co/functions/v1/portal-db`) is active and has your live data (including **MAKARIOS CHURCH** with 52 members, **CEKBU 2**, **PEPPMAKROS**, **PLASTICS**, and **CE KORLE BU 5**).
> - **Root Cause**: The client-side database gateway (`portalDb.ts`) contained a guard that routed all queries to local browser storage if a local client key was unset, preventing requests from reaching the live cloud function.
> - **Solution**: Update the network gateway to dispatch requests directly to the live Lovable server function, purge stale local storage caches, and ensure all live churches populate all public and administrative interfaces.

---

## 1. Overview & Core Concept

- **What It Does**: Unlocks direct communication between the client portal and the live Lovable Cloud `portal-db` gateway so that all registered churches, member records, and leader accounts display live data immediately without relying on manual keys.
- **Target Audience**: Church administrators, ushers, group pastors, and members accessing the public attendance check-in and administrative dashboards.
- **Key Value**: Guarantees that every user sees their actual church branch (e.g. Makarios Church) and live member counts instead of local fallback placeholders.

---

## 2. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Client / UI                      │
│  (Public Check-In, Dashboard, Leaders, Members, Reports)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  src/lib/portalDb.ts                        │
│  - Gateway dispatch: sends POST queries to FUNCTIONS_BASE   │
│  - Sends session token via 'x-portal-session' header        │
│  - Purges legacy localStorage cache                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Direct HTTPS POST)
┌─────────────────────────────────────────────────────────────┐
│              Lovable Cloud Edge Function                    │
│      https://bouwuqpzplazpwuwyphq.supabase.co/              │
│                 functions/v1/portal-db                      │
│  - Validates session permissions & public reads             │
│  - Queries live tables via Supabase Service Role            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Live Supabase PostgreSQL Database               │
│  - Churches (Makarios Church, CEKBU 2, PEPPMAKROS, etc.)    │
│  - Members, Leaders, Hierarchy, Attendance, Reports         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Key Product Decisions & Execution Steps

### 1. Remove Gateway Blocking Condition
- In `src/lib/portalDb.ts`, update `callPortal` and `rpc`:
  - Change `if (!FUNCTIONS_BASE || !ANON_KEY)` to check only `if (!FUNCTIONS_BASE)`.
  - Dispatch requests directly to the live `portal-db` server function.
  - When `ANON_KEY` is not locally specified, send standard headers (`Content-Type: application/json` and session headers), which the live function accepts.

### 2. Purge Stale Local Storage & Synchronize Fallback Store
- Automatically clear the stale `cekb_local_portal_db_v1` cache from `localStorage` on boot so previous placeholder records are flushed.
- Replace the legacy single-church default store with a multi-church fallback structure matching the live network branches.

### 3. Verify Church Scoping Across Screens
- Verify that `PublicPortal.tsx` populates the "Select Your Church" dropdown with all live branches returned by `fetchChurchesFromSupabase`.
- Confirm that member attendance, leader directories, and registration flows reflect Makarios Church and other branches without filtering issues.
- Re-verify TypeScript compilation and dev server responsiveness.
