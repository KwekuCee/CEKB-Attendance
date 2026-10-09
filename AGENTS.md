# Project architecture

- Preserve existing public-tab and dashboard view routing during visual changes so attendance and account workflows remain intact.
- Define shared visual roles in src/index.css and map legacy Tailwind palette utilities to those roles so all existing screens inherit the same theme.
- Use the shared Button component for new interactive controls to keep focus, sizing and appearance consistent.
- Render restricted-account logout inside full-screen tools so overlays cannot hide sign-out.
- Use one shared semantic palette across public pages, dashboards and scanners; use named scanner layout hooks to keep the camera framing independent of controls.
- Keep the dashboard as a dark navigation rail beside one rounded light workspace; reserve gradients for featured analytic surfaces, not buttons.
- Use explicit semantic sidebar hooks and aria-current for menu states, never legacy palette selectors or divider borders, so glass navigation stays consistent.
- Public forms use equal viewport-height desktop panes with independent form scrolling and explicit centered-content wrappers for entry screens, so navigation remains visible without hiding headings.
- Mount the mobile opening screen at the application entry, once per page load, so navigation and account workflows never replay the opening delay.
- All accounts (group pastor, church admin, usher) use one sign-in form; the role returned by the server decides the destination, so login logic lives in one place.
- Church pastors register their church and appoint church admins/ushers; church admins appoint ushers; leaders get read-only accounts. Enforce these limits in portal-db, because the browser can't be trusted.
- Only church pastors edit the leader hierarchy (BSCT → Cell → PCF); totals roll up through parent links, so every screen gets the same numbers.
