# Loop #16 — fix conversations a11y + promote /you to the visible nav (2026-06-22 03:59 EDT)

Unblocks loop #15: the `scrollable-region-focusable` violation that stopped the /you
nav promotion is fixed, and /you is now a visible primary-nav item.

- **a11y fix** (`components/sidebar-threads.js`): the conversations scrollable region
  (`overflow-y-auto [scrollbar-width:thin]`, "No conversations yet") now has
  `role="region" aria-label="Conversations" tabindex="0"` → keyboard-accessible. Clears the
  serious axe violation that the 7th nav item exposed on the connections pages.
- **/you promoted to the visible primary nav**: routes.js `hidden:false` + added to the Work
  nav section (after Workbench); `nav.you`='You' in en.js (count 933→934 + BASELINE_MISSING_KEYS);
  IA-guard expected list updated; you-route test asserts visible; `book` nav icon.
- **Gate green:** test:static 808, **a11y 138 (the fix held WITH the 7-item nav)**, design
  DT-1..6, smoke, bundle-size under budget.
- **Live-verified** (standalone :17641 /you): surface renders — "How you work", stats
  "0 VIP · 1 respond · 14 FYI · 2 auto-filed", 15 rows; no console errors. The "You" item is
  in the app primary nav (gate-rendered; the narrow standalone view shows the workbench's
  own dock, the app sidebar-nav shows at wider/test viewports).

All 4 pillars now have working, discoverable surfaces.
