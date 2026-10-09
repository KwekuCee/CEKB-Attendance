# One sign-in page for every account

## What changes for people
- The sign-in page gets a single form titled **"Sign in to your account"** with the line "CE Korle Bu Sign In" above it. It has an email/username field, a password field, "Forgot password?" and a Sign In button.
- The Group Pastor / Church Admin switch and the separate "Are you an usher? Sign in here" page are removed.
- After sign-in, the account's role decides where the person goes:
  - Group Pastor (Superadmin) → group dashboard. The 6-digit email code step stays, and it appears in the same form only for this account.
  - Church Admin → their branch dashboard, limited to their own branch as now.
  - Usher → straight to the scanner, with their name showing as now.
- Branch admins whose email isn't verified yet still get blocked with the same message.
- Old usher links (`?signin=usher`) still open the same single sign-in page.
- The homepage "Admin Login" button becomes **"Sign In"**.

## Technical details
- `PublicPortal.tsx`: remove `loginRole`, `loginPane` and the usher state, the usher form and `handleUsherLogin`, and the role toggle buttons. Keep one `handleLogin` that calls `authenticateUserWithDatabase` without a selected role, then routes by `result.user.role` (Superadmin / Church Admin / Usher) using the same session setup each path already uses.
- `supabaseService.authenticateUserWithDatabase`: make the role parameter optional and send `role: null` so the server works out the role itself. The server login already handles this when no role is given, so the OTP step for the group account still runs there.
- `portal-db` login: confirm that `verify_user_login` with `p_role = null` returns the Superadmin, Church Admin and Usher accounts correctly. Only change it if one of them fails.
- Keep the public-tab routing and the existing restricted usher logout. Update the AGENTS.md rule to say all accounts use one sign-in page and are routed by the role the server returns.
- Verify with a typecheck and a Playwright run: only one form shows, wrong passwords show an error, and nothing overflows at 390px.
