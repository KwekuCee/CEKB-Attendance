# mNotify administrator update SMS

## Configure the API key

In Lovable, add the secret named **`MNOTIFY_API_KEY`** with the API key from your mNotify/BMS developer settings. It is read only by the Supabase Edge Function and must not be added to a `VITE_` variable, the browser, or `admin_settings`. For local Edge Function development, configure the same name with the Supabase CLI secrets mechanism.

The function sends through the documented mNotify BMS quick SMS API:

- `POST https://api.mnotify.com/api/sms/quick?key=...`
- JSON body: `recipient` (Ghana local-format phone numbers), `sender` (approved Sender ID), and `message`
- A successful provider response is identified by `status: "success"` and `code: "2000"`. The returned campaign ID and provider credit totals are recorded in the SMS delivery log.

Reference: [mNotify/BMS API v2 documentation](https://developer.bms.africa/), SMS → Quick Bulk SMS.

## Enable and send

1. Register and get the Sender ID approved in the mNotify dashboard first. Registration/approval remains a manual dashboard process.
2. In the Developer Console → SMS Gateway & Templates, set the approved Sender ID (1–11 ASCII letters or digits) and enable administrator update SMS.
3. A Developer can send updates to verified Church Admin accounts platform-wide. A signed-in Church Admin or Church Pastor can send to verified Church Admin accounts in their own church. Recipients are selected server-side; arbitrary recipients cannot be supplied.
4. Only Ghana local numbers matching `0` followed by nine digits are sent. Accounts without a valid phone number are counted as skipped.

The send result reports accepted and failed recipients and the credits mNotify says it used. Acceptance is not a final handset delivery receipt. mNotify's documented quick-send endpoint provides a campaign ID for later delivery-status checks; automated polling and final delivery receipts are not implemented.

The API key is never returned to the browser. Existing SMS provider credentials in `sms_config` are not used; the server reads only `MNOTIFY_API_KEY`.

## Local development fallback

Remote portal requests fail with an error by default; they are never silently replayed against local demo state. To explicitly opt into the local fallback during development, set `VITE_ENABLE_LOCAL_PORTAL=true`. Keep it `false` (or unset) in Lovable/production so a failed server save cannot look successful locally.

## Database setup SQL

Both Developer Console SQL downloads (full schema and incremental updates) end by revoking table access from `PUBLIC`, `anon`, and `authenticated`, enabling row-level security, and granting access to `service_role` only. Apply the Supabase migrations for the authoritative deployment path; the final table/function hardening migration is `20261011180000_harden_portal_tables.sql`.
