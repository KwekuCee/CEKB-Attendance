# Moolre Monthly Subscription Payments

## Goal
Churches pay a monthly fee through Moolre (Mobile Money). The Developer turns billing on or off. When it is on, Pastor and Admin dashboards show a payment prompt from the last day of each month. Once a church pays, its system is unlocked for the next month. The Developer console shows how much has been collected.

## How it works for users

1. **Developer** opens Settings, turns on "Monthly payments (Moolre)", and sets the monthly fee (in GH₵) and the grace period.
2. **On the last day of the month**, Pastors and Admins of each church see a payment card/banner: "Your CEKB subscription for <next month> is due — GH₵ X".
3. They enter a Mobile Money number and network (MTN, Telecel, AirtelTigo), tap **Pay now**, and approve the prompt on their phone (with an OTP step if Moolre asks for one).
4. The dashboard waits for confirmation. When Moolre confirms, the church is marked paid for that month and the prompt disappears.
5. **If not paid** after the grace period, the Pastor/Admin dashboard locks into a full-screen "Payment required" screen (logout still available). Ushers, leaders and public check-in keep working, so attendance is never lost.
6. Other roles (Usher, Leader, Member, Group Pastor) never see the prompt.
7. Turning the toggle off removes all prompts and locks immediately.

## Developer console additions
- **Settings:** toggle on/off, monthly fee, grace days, test/live mode.
- **Revenue card (Overview):** total collected (all time), this month, number of paid churches vs unpaid, and the last 10 payments (church name, amount, date, status) with 10-per-page paging. Totals only — no payer phone numbers shown.

## Steps

1. **Store the key** — confirm the Moolre key, username and account number are saved as secrets (MOOLRE_API_KEY, MOOLRE_API_USER, MOOLRE_ACCOUNT_NUMBER); request any missing ones.
2. **Database** — new tables:
   - `church_subscriptions`: church, period (e.g. 2026-11), amount, status (pending/paid/failed), paid_at.
   - `payment_transactions`: church, period, amount, Moolre reference, external ref, channel, masked phone, status, raw response, timestamps.
   - Billing settings stored in existing `admin_settings` (key `billing`).
   - Grants + RLS: server-only access (service role); browser reads go through portal-db.
3. **Server function `moolre-payments`**:
   - `initiate`: checks the caller is a Pastor/Admin of that church (portal session), validates input with Zod, creates a pending transaction with a unique reference, calls Moolre's payment-request endpoint, returns whether an OTP is needed.
   - `verify-otp`: forwards the OTP to Moolre to continue the charge.
   - `status`: checks Moolre's transaction status and updates the record (used for polling).
   - `webhook`: receives Moolre's callback, verifies the reference/amount against our record, marks the transaction and subscription paid. Idempotent so duplicate callbacks are safe.
   - Rate limited with the existing limiter.
4. **portal-db additions**:
   - `billing_status` for Pastor/Admin: returns `{ enabled, due, locked, amount, period }` computed server-side (last day of month → due; past grace and unpaid → locked).
   - `developer_billing_settings` get/save and `developer_revenue_summary` (aggregates only).
   - Server enforces the lock: when locked, Pastor/Admin data actions return "payment required" so the lock can't be bypassed in the browser.
5. **Frontend**:
   - `BillingPrompt` banner/card + `PaymentModal` (number, network, OTP, waiting state) shown only in Pastor and Admin dashboards.
   - `BillingLockScreen` full-screen when locked, with Pay and Logout.
   - Developer Settings toggle section and `RevenueCard` in Developer Overview.
6. **Emails (optional)** — payment receipt to the Pastor/Admin via the existing mailer.
7. **Tests** — unit tests for the due/locked date rule (last day of month, grace period, already-paid month) and amount matching in the webhook.
8. **Verify** — test-mode payment end-to-end as an Admin, confirm unlock, confirm revenue card updates, confirm toggle off hides everything; then publish.

## Technical details
- Moolre endpoints: `POST https://api.moolre.com/open/transact/payment` (headers `X-API-USER`, `X-API-KEY`), status via `/open/transact/status`; webhook URL = `<backend>/functions/v1/moolre-payments/webhook`, to be pasted into the Moolre dashboard after deploy.
- Due rule computed in server UTC/Ghana time (same offset), shared helper in `_shared/billing.ts`.
- Amount verification on webhook prevents underpayment spoofing; webhook re-queries Moolre status before marking paid.
- Phone numbers stored masked (last 4) in transaction display fields.

## Assumptions to confirm
- One fee per church per month (not per user), same amount for all churches.
- Default grace period: 5 days after the 1st before locking.
- Currency GH₵, Mobile Money only (no cards).
