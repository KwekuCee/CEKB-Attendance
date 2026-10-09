# Installable CEKB phone app (online only)

Ushers open the site once on their phone, tap "Add to Home Screen", and from then on it launches full-screen from its own CEKB icon — same dashboard, forms and scanner, no browser bars.

## What changes for users
- App icon on the home screen using the CEKB logo, named "CEKB".
- Opens full-screen in portrait with the blue/black theme colours on the status bar.
- Opening it from the icon goes straight to sign-in (or the scanner for a signed-in usher), with the existing mobile opening screen.
- The "App" install button and instructions keep working; the instructions no longer promise offline access.
- The app always loads the latest version (no stale copies after updates).

## Technical details
- Remove the inline service-worker registration from `index.html` and replace `public/sw.js` with the one-release kill-switch worker (clears only its own `cekorlebu-*` caches, then unregisters) so phones that already registered the old caching worker get updates again.
- Update `public/manifest.json`: name "CEKB Group", short_name "CEKB", `id` and `start_url` "/", `scope` "/", `display: standalone`, theme/background colours matching the palette, separate `any` and `maskable` icon entries (192/512, generated from the CEKB logo with safe padding for maskable).
- Align `index.html` theme-color and Apple status-bar style (`black-translucent`) and add safe-area padding so the mobile header and bottom nav clear the notch/home bar.
- Usher sessions persist across app launches (existing stored session) so ushers land on the scanner directly.
- Edit the install modal copy in `MobileAppHeader.tsx`; keep `usePWAInstall` as is.
- Note: home-screen install works only on the published site, not inside the editor preview.

## Usher name and scan counts
- Scanner page header shows "Signed in as <usher name> · <church>" plus a "You've scanned N today" counter that updates after each successful scan.
- Each scan already records the scanner's name ("<name> (QR Scanner)"); add a "Ushers' scans" card on the church admin dashboard (and in the Ushers list in Settings) showing each usher's scans today and for the week, read from that branch's attendance records.
- Group pastor sees the same counts per branch. No database change needed.
