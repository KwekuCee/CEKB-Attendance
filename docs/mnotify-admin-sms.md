# mNotify Sender IDs and SMS

## Verified provider API

The integration uses the current [BMS/mNotify OpenAPI documentation](https://developer.bms.africa/openapi14.yaml), which is the destination of `https://developer.mnotify.com`.

| Feature | Documented endpoint and behavior |
| --- | --- |
| Register Sender ID | `POST https://api.mnotify.com/api/senderid/register?key=...`, JSON `{ "sender_name": "...", "purpose": "..." }`; response includes `status`, `code`, and `summary.status` (for example `Pending`). |
| Check Sender ID | `POST https://api.mnotify.com/api/senderid/status?key=...`, JSON `{ "sender_name": "..." }`; response includes `summary.status` (for example `Approved`). |
| Send quick SMS | `POST https://api.mnotify.com/api/sms/quick?key=...`, JSON `recipient` (array), `sender`, `message`; success uses `status: "success"`, `code: "2000"` and `summary._id`, `numbers_sent`, `credit_used`, `credit_left`. |
| SMS balance | `GET https://api.mnotify.com/api/balance/sms?key=...`; response includes `balance` and `bonus`. |
| Delivery report | `GET https://api.mnotify.com/api/campaign/{campaign_id}?key=...`; response contains `report[]` with `_id`, `recipient`, `status`, `campaign_id` and other report fields. |

The current docs do **not** define a cost-quote endpoint or specify an SMS unit tariff. The Developer Console therefore requires a manually configured **mNotify credits per SMS page** rate. The user-facing estimate is local and uses GSM-7/Unicode page rules; before dispatch the server checks the live SMS balance and after dispatch records mNotify's actual `credit_used`. Actual provider charging can differ from the estimate. Delivery reasons are displayed only when mNotify includes them in a report.

## Secrets and initial setup

Set these as Supabase/Lovable **Edge Function secrets**, never as `VITE_` variables:

- `MNOTIFY_API_KEY`: the mNotify/BMS developer API key.
- `MNOTIFY_POLL_SECRET`: a strong random secret used only by the scheduled poll request.

The mailer uses the application's existing `RESEND_API_KEY` and Gmail fallback configuration. No mNotify credentials are stored in `admin_settings`, responses, or browser code.

Apply the database schema through the normal Supabase migration process:

```text
supabase/migrations/20261011200000_mnotify_sender_id_and_campaigns.sql
```

It creates `sender_id_requests`, `sender_id_status_history`, `admin_alerts`, `sms_campaigns`, and `sms_recipients`, plus indexes and the `mnotify_management` default settings row. The Developer Console full-schema and updates SQL exports include the same tables. All these tables have RLS enabled, revoke access from `PUBLIC`, `anon`, and `authenticated`, and grant access only to `service_role`. This app uses portal sessions rather than Supabase Auth for user identity, so ownership and role checks are enforced in `portal-db` before any service-role query: users can only view their own sender requests/campaigns; only the Developer can view the cross-account operational dashboard or manually approve/reject requests.

The migration is provided for review and has **not** been applied to the live database by this change. Do not run it against production until you have reviewed the SQL.

## Scheduled approval and delivery polling

The `mnotifyScheduledPoll` action checks pending Sender IDs at most every 10 minutes and campaign reports every 5 minutes, stopping after 72 hours. To enable it:

1. Deploy the updated `portal-db` Edge Function and set the two Edge Function secrets above.
2. Ensure the Supabase `pg_cron`, `pg_net`, and Vault extensions are enabled.
3. In Supabase SQL Editor, place your own project URL, service-role key, and the exact `MNOTIFY_POLL_SECRET` value into Vault. Do not save these values in this repository:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'mnotify_project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'mnotify_poll_service_role_key');
select vault.create_secret('YOUR_MNOTIFY_POLL_SECRET', 'mnotify_poll_secret');
```

4. Schedule the authenticated server-to-server request:

```sql
select cron.schedule(
  'mnotify-status-poll',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'mnotify_project_url')
      || '/functions/v1/portal-db',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mnotify_poll_service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'mnotify_poll_service_role_key'),
      'x-mnotify-poll-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mnotify_poll_secret')
    ),
    body := '{"action":"mnotifyScheduledPoll"}'::jsonb
  );
  $job$
);
```

The Developer Console also has a manual "Poll pending statuses" control; users can manually refresh their own Sender ID or campaign reports if the schedule is not installed. Open Sender IDs & SMS pages refresh their displayed dashboard every 30 seconds; the tables are not exposed to browser-side Supabase Realtime because their RLS access is service-role-only.

## User workflow

Church Admins and Church Pastors open **Settings > Branch Profile > Sender IDs & SMS**:

1. Submit a 1-11 character alphanumeric Sender ID (spaces are allowed) and a purpose of at least 30 characters. Duplicate active names are rejected. Names containing reserved terms such as bank, MTN, GOV, ECG, or police are flagged for Developer review.
2. The request is persisted before the provider call. mNotify registration failures remain saved and can be retried; submissions are limited to five per account per day.
3. Each new request queues an SMS alert to the configured admin number, default `+233550160237`, from the configured approved alert ID, default `CEKBU DEV`. The alert message includes the sender ID, purpose, and submitting account name, truncates to 160 characters, and retries up to three times. Failed alerts are visible in Developer oversight. The alert sender ID must already be approved in mNotify.
4. The account can refresh approval status. Only verified Sender IDs appear in its send form. Developer can also mark a request verified/rejected after handling it in the mNotify dashboard. Users receive email and, where a verified phone is available, SMS notifications with usage guidance.
5. Compose SMS to up to 100 Ghanaian numbers. Local `0XXXXXXXXX` and international `+233XXXXXXXXX` forms are normalized and duplicates removed. The live estimate shows encoding, page count, recipient count, total pages, and configured credit estimate. The server rechecks the mNotify balance, records an idempotency key before sending, and saves the provider campaign ID and per-recipient result.
6. Campaign details show accepted/failed status, actual credits, per-recipient delivery reports and CSV export. A manual refresh is available; automated report polling stops 72 hours after send.

The Developer **SMS Gateway & Templates** page shows sender requests/purpose/status, retry and review controls, aggregate campaign spend/delivery, masked admin alert outcomes, live balance and configurable alert phone, alert sender ID, credits-per-page rate and low-balance threshold. In accordance with the Developer privacy boundary, this cross-account page does not expose account email/name or recipients' phone numbers.

## Notes and limitations

- API keys are sent in the provider's query-string `key` parameter because that is how mNotify documents authentication. The key is only added in the Edge Function and never returned or logged.
- Provider success means accepted/queued, not delivered to a handset. Delivery status comes later from the documented campaign report.
- `CEKBU DEV` must be an approved sender ID in the mNotify dashboard for the alert to arrive. If it is not approved, the request still saves and Developer oversight flags the failed alert.
- SMS pricing is an estimate in provider credits, not a currency quote. Configure the rate based on the account's current mNotify tariff.
- Approval status refresh and report polling require the database migration, deployed Edge Function, the secrets above, and (for automatic refresh) the optional cron schedule.
