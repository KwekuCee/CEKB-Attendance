# Project architecture

- Preserve existing public-tab and dashboard view routing during visual changes so attendance and account workflows remain intact.
- Define shared visual roles in src/index.css and map legacy Tailwind palette utilities to those roles so all existing screens inherit the same theme.
- Use the shared Button component for new interactive controls to keep focus, sizing and appearance consistent.
- Render restricted-account logout inside full-screen tools so overlays cannot hide sign-out.