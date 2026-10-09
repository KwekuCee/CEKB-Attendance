# Refine the CEKB dashboard and form experience

## Goal
Create the polished AEUX-inspired feel you described using white, black, and blue: one rounded dashboard workspace, blended glass effects, cleaner cards, and stronger analytics presentation—without changing any attendance, member, export, settings, or account functionality.

## Dashboard shell and navigation
- Place the main dashboard content inside a large rounded workspace panel beside the dark sidebar, with intentional outer spacing so the whole interface reads as one composed product.
- Refine the sidebar into a clean black/glass surface with subtle depth and restrained blue highlights.
- Remove the current blue left-edge indicator from the active navigation item and use a soft filled/glass active state instead.
- Redesign the top header, search, notifications, profile, and mobile navigation to match the same rounded black/white/blue system.
- Keep every existing menu destination, role restriction, search action, notification action, and logout flow unchanged.

## Analytics dashboard styling
- Remove the thin colored lines currently added to metric cards.
- Rebuild the featured metric card with a smooth, continuous black-to-blue gradient and subtle glass lighting rather than the current separated glow effect.
- Style the remaining cards as rounded white or translucent glass surfaces with clear hierarchy, balanced icons, and consistent spacing.
- Improve the analytics feel across overview, church network, attendance, members, leaders, reports, insights, and settings screens through stronger number hierarchy, compact status treatments, cleaner tables, chart framing, and more intentional section layouts.
- Restyle legacy areas such as Export Records and Settings so they feel integrated with the new dashboard instead of looking like older standalone controls.

## Buttons and effects
- Use solid black for primary actions, blue for selected states and important data accents, and white/light glass for secondary actions.
- Remove gradients from buttons throughout the dashboard and public forms.
- Reserve gradients for one or two high-value visual surfaces, such as the featured analytic card or background lighting.
- Apply glassmorphism selectively to the header, selected navigation, overlays, and a few analytic panels; maintain legibility and contrast.
- Keep all rectangles generously rounded, while preserving practical table, scanner, and input geometry.

## Public attendance and registration forms
- Replace the current top tab strip with a two-column experience on desktop:
  - a rounded black/blue information and navigation panel on the left;
  - the selected form on a clean rounded white/glass panel on the right.
- Put Attendance, Leader Sign Up, Register a Church, Submit Cell Report, and Admin Login in the left-side navigation so selecting an item swaps the form without leaving the layout.
- Give each flow short, relevant attendance/member-management context and a distinct icon treatment without adding marketing clutter.
- Stack the navigation and form cleanly on phones, keeping all existing validation, fields, submissions, and routes intact.

## Technical approach
- Consolidate the late stylesheet overrides so older green/gradient/edge styles cannot leak through.
- Add shared layout hooks for dashboard workspace panels, analytic cards, action areas, and the public split-form shell rather than relying on fragile utility-class matching.
- Update the shared sidebar, top header, dashboard overviews, and public portal presentation while preserving their existing event handlers and data logic.
- Continue using Sora 800 for headings, Manrope for body text, semantic theme tokens, and the shared Button component for redesigned actions.

## Verification
- Check group-pastor, branch-admin, and usher-facing dashboard layouts with their existing navigation and role restrictions.
- Verify the overview, attendance, member database, leaders, analytics, reports, settings, scanner, and all public form selections on desktop and phone widths.
- Confirm there are no card-top accent lines, no sidebar edge line, no gradient buttons, no overlapping text, and no horizontal overflow.
- Verify exports, settings navigation, form switching, search, notifications, scanner access, and logout still work.
- Confirm the preview has no build, console, or runtime errors.
