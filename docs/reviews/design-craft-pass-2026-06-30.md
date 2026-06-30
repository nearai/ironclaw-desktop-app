All claims verified against ground truth. Key findings confirmed and corrected:

- **DESIGN.md spec confirmed**: Display 28/600, Title 20/600, Section 16/600, Body 14/450, Label 12/500, Micro-caps 11/600; controls 6px / cards 12px / shell-modals 16px; tabular figures default; "restrained motion."
- **Onboarding h1 IS the outlier** at `text-[32px] sm:text-[40px]` (line 249); empty-state h2 is already correct at `text-[28px] sm:text-[32px]` — so the empty-state hero also overshoots to 32px at `sm`, which the findings missed.
- **Gold-soft finding cites wrong line**: dark theme `0.14` is **line 121** (not 66-67); fix direction is correct.
- **DESIGN.md does NOT state "6/12/16 only"** — it says controls=6, cards=12, shell/modals=16. So `rounded-[14px]` and bare `rounded`(4px) and `rounded-xl`(12 actually? no, 12px) are off-system, but `8px` is the Card `sm` radius and legitimate. The radius finding's "8/12/16" claim for the Card system is accurate; "6/12/16 only" is not the law.
- Button md is `text-[13px] md:text-sm` (line 33 confirmed). 13px is off-scale.

---

# DESIGN CRAFT PASS — implementation list (2026-06-30)

## 1. Verdict

The system is already strong: a disciplined token layer (`--v2-*` semantic colors, no raw Tailwind), a real `Card` primitive with variant/radius/padding props, a documented type-and-geometry spec in `DESIGN.md`, and a global `transition: none !important` (app.css:426) that enforces the stillness law at the engine level. The craft headroom is not in the architecture — it's in **drift from the spec the system already declares**: a handful of off-scale type sizes (32/40px display, 13px button, 10px micro-cap), off-system radii (`rounded-[14px]`, bare `rounded`), a 2% theme-parity gap on gold-soft, and ~6 dead `transition-*` classes that the global rule already neutralizes but which lie about intent. None of this is visible-broken; it's the difference between "follows the spec" and "is the spec." The empty/error-state cohesion gap (sidebar errors vs. main-page error cards) is the one place where the *user* actually perceives inconsistency, and it's the highest-value batch here.

## 2. DO NOW (ranked, commit-sized batches)

### Batch 1 — Kill dead motion classes (stillness law) · `transition: none !important` already wins, so these are pure intent-cleanup, zero visual change
Six `transition-*` classes survive in source despite app.css:426. They animate nothing today, but they mislead the next editor and would re-animate the instant someone scopes the global rule. Remove the class token only; keep all `rotate-*` / `hover:*` state classes.
- **sidebar-nav.js:76** — `'h-3.5 w-3.5 shrink-0 transition-transform duration-150'` → drop `transition-transform duration-150`.
- **approval-card.js:316** — `'... -rotate-90 transition-transform group-open:rotate-0'` → drop `transition-transform` (keep `-rotate-90 group-open:rotate-0`).
- **chat-input.js:341** — template `` `h-3.5 w-3.5 transition-transform ${manualOpen ? 'rotate-180' : ''}` `` → drop `transition-transform`.
- **provider-card.js:302** — chevron button class join contains `transition-transform` → drop it (keep `rotate-180`).
- **provider-card.js:249** — card class join `'transition-colors'` → drop it.
- **extension-card.js:22** — `CARD` const `'transition-colors hover:border-[...]'` → drop `transition-colors`, keep `hover:border-...`.
- **Acceptance:** `grep -rn "transition-" js/ | grep -v "transition: none"` returns zero in these six files; chevrons/borders flip instantly (already do); `npm run verify:static-frontend` green; no screenshot diff.

### Batch 2 — Type scale: snap display + subtitle + section heading to spec · `onboarding-page.js` + `empty-state.js`
The spec is Display **28/600**, Title **20/600**, Body **14/450**. Three drifts, two files:
- **onboarding-page.js:249** — `text-[32px] ... sm:text-[40px]` → `text-[28px] ... sm:text-[28px]`. (Corrects the *real* outlier; empty-state already starts at 28.)
- **empty-state.js:219** — currently `text-[28px] ... sm:text-[32px]` — **also drop the `sm:text-[32px]`** so both entry points hold a single 28px display tier. (Finding missed this; without it the two heroes still diverge at `sm`.)
- **onboarding-page.js:253** — subtitle `text-base leading-7` (16px Section) → `text-sm leading-[1.35]` (14px Body).
- **onboarding-page.js:291** — section h2 `text-lg` (18px, off-scale) → `text-[20px]` (Title tier). Same fix applies to the `text-lg` h2 in the onboarding access card.
- **Acceptance:** both first-run and chat heroes render at 28px across breakpoints; subtitle reads as body, not section; section heading gains 2px authority. `npm run smoke:webui-static` green; capture `contact-sheet.png` and eyeball onboarding + empty-state hero parity.

### Batch 3 — Type scale: micro-cap + button + tabular · `approval-card.js` + `button.js` + `primitives.js`
- **approval-card.js:263** — risk label `text-[10px]` → `text-[11px]` (spec micro-caps; siblings at 247/291 already 11px).
- **button.js:33** — md size `... text-[13px] md:text-sm` → `... text-sm` (drop the spurious 13px micro-breakpoint; keep `min-h-[40px] md:min-h-[44px]`, so the 44px tap target is unaffected).
- **primitives.js:91** — StatCard value `text-[1.75rem] font-medium ...` → add `tabular-nums` (or `font-[number-tabular]` per Tailwind config) so numeric alignment is self-documenting per spec line 37, not reliant on a global css inherit.
- **Acceptance:** risk label legible at 11px; all md buttons 14px at every width with tap target ≥44px; StatCard numerals align in isolation. Tests green.

### Batch 4 — Radius discipline: snap off-system radii to controls=6 / cards=12 / modals=16 · `extension-card.js` + Skills tab + Modal
DESIGN.md: controls `6px`, cards/panels `12px`, shell/modals `16px`. `rounded-[14px]` and bare `rounded`(4px) and `rounded-xl` are off-system.
- **extension-card.js:20** — `CARD` const `rounded-[14px]` → `rounded-[12px]` (it's a card).
- **extension-card.js:32** — `CHIP` const bare `rounded` (=4px) → `rounded-[6px]` (control tier).
- **SkillsTab badges (~lines 155-156)** — `rounded-xl` → `rounded-[12px]`.
- **Modal panel (~line 139)** — `rounded-[1.5rem]`(24px) → `rounded-[16px]` (shell/modal tier).
- Input mobile radius: leave as-is and verify — desktop `rounded-[16px]` is shell tier; if mobile is `rounded-[14px]`, snap to `rounded-[12px]`.
- **Acceptance:** `grep -rn "rounded-\[14px\]\|rounded-xl\|rounded-\[1.5rem\]\|'rounded '" js/` returns zero in these files; cards/chips/modal corners visibly match the rest of the system. Tests green.

### Batch 5 — Card sub-component padding honors the Card variant · `card.js`
**card.js:84-118** — `CardHeader`/`CardBody`/`CardFooter` hardcode `px-5 py-4 md:px-7 md:py-5`, overriding any `padding='none'` Card. Add an optional `padding='md'` prop to each, composing `PADDINGS[padding]` exactly like `Card` does, so a `padding='none'` Card with manual gutters no longer double-pads.
- **Acceptance:** existing call sites (default `md`) render byte-identical; a `padding='none'` Card with a `CardHeader padding='none'` shows single gutters. `npm run verify:static-frontend` + focused card tests green; Settings Inference tab + chat empty-state cards screenshot-clean.

### Batch 6 — Page gutter + intra-card spacing rhythm · `empty-state.js`
- **empty-state.js:207** — `px-4 py-6 sm:px-8 lg:px-12` → `px-4 py-6 sm:px-6 lg:px-8` (kill the `lg:px-12` outlier; match SettingsPage/ExtensionsPage `p-4 sm:p-6` progression). Then bump Settings/Extensions to add `lg:p-8` so all three share `4→6→8` and stop jumping on resize.
- **empty-state.js:271-285 / 341-365** — resume-thread Link `px-3 py-2` and suggestion button `px-3 py-3` → both `px-3 py-2.5` for even density.
- **empty-state.js:378 (FrontDoorPanel)** — `gap-3` → `gap-2` to match the `gap-2` of internal `FrontDoorSection` items.
- **Acceptance:** no horizontal-margin jump resizing chat ↔ settings ↔ extensions across `sm`/`lg`; thread rows and suggestion rows sit on one baseline rhythm. Capture at 1280/1440 widths.

### Batch 7 — Token discipline: SubLabel + gold-soft theme parity · `primitives.js` + `app.css`
- **primitives.js:199** — `SubLabel` uses `opacity-[0.82]` on `--v2-text-strong`, an untracked implicit token. Replace with `text-[var(--v2-text-muted)]` (the formal 62% secondary token, already contrast-guarded). Drop the `opacity-[0.82]`.
- **app.css:121** *(corrected line — finding said 66-67)* — dark `--v2-gold-soft: rgba(251, 191, 36, 0.14)` → `0.16` to match light theme (app.css:67). Accent-soft already runs the inverse pattern (light 0.12 / dark 0.16), so the gold gap is an oversight, not intent.
- **Acceptance:** `contrast.test.mjs` green (SubLabel ~5.2:1, gold-text-on-gold-soft ≫3:1); gold badges read identically in both themes; SubLabel weight now trackable by the design system. No raw-opacity token left in primitives.

### Batch 8 — Empty / loading / error dignity + cross-surface cohesion · `sidebar-threads.js` (+ shared empty pattern)
The one batch the *user* perceives. Sidebar failure/empty/loading states have less visual dignity than identical main-page states.
- **sidebar-threads.js:267-278** — wrap the "Could not load conversations" error in a bordered panel matching `automations-page.js:20-26`: `bg-[var(--v2-danger-soft)]` + `border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))]` + a danger icon + the retry button.
- **sidebar-threads.js:280-281** — `'No conversations yet'` → `'No conversations yet.'` (period, to match the capitalized, punctuated voice of FrontDoor empties).
- **sidebar-threads.js:250-265** — loading skeleton: prefix a muted pulse icon in an `h-8 w-8` container so loading is scannably distinct from empty/error.
- **Acceptance:** sidebar error/empty/loading visually rhyme with automations-page and FrontDoor; `npm run smoke:webui-static` green; screenshot all three sidebar states.

## 3. CONSIDER (not auto-apply)

- **Unified empty-state component** (work-page file icon / settings-search icon / FrontDoor no-icon / dashed-vs-solid borders). The right fix is one `<EmptyState>` primitive built on `Card variant='subtle'`, replacing the dashed-border special case in empty-state.js:493-502 and the bespoke containers in work-page.js / settings-search-empty.js. High value, but it's a **component-extraction refactor touching 4+ surfaces** — scope it as its own pass with screenshot evidence, not a quick batch. Medium risk because it changes shared visual grammar.
- **`SettingsNotWritable` lock → warning semantics** (settings-not-writable.js:16-19): muted lock → `--v2-warning-soft`/`--v2-warning-text`. Reasonable, but verify it's truly "needs setup" (warning) vs. genuinely "unavailable/disabled" (muted is correct) before changing — semantic, not cosmetic. Confirm the state's meaning first.
- **Sidebar nav vs. sub-nav padding harmonization** (sidebar-nav.js:39/65/93): `py-2`/`gap-3`/`rounded-[10px]` parent vs. `py-1.5`/`gap-2.5`/`rounded-[8px]` children. The nesting *intends* a tighter child rhythm; "make them identical" may flatten a deliberate hierarchy. Eyeball the 2px centering claim in a screenshot before touching — low-confidence that it's actually misaligned.
- **Brief-row icon optical alignment** (empty-state.js:230-258): removing `mt-0.5` and switching `grid place-items-center` → `flex items-center`. Optical-alignment tweaks need eyes-on verification; the prescribed change could over-correct. Test, don't trust the prescription.
- **Settings card top-border rhythm** (inference-tab.js:78): the `first:border-t-0 border-t` suggestion risks double borders against existing Card borders. Only worth it if Settings genuinely reads as "floating" in a screenshot — otherwise it adds hairlines the calm-density covenant doesn't want.
- **WorkPage CTA copy** ("Back to chat" → "Start in chat" + helper line): a product-copy call, not craft. Defer to product voice; harmless but out of scope for a craft pass.

## 4. REJECTED

- **The `rounded` chevron-rotation findings framed as "motion violations the user sees."** False premise: app.css:426 `transition: none !important` already makes every one of these instant. They are real *intent/cleanliness* issues (handled in Batch 1) but must **not** be sold as fixing visible animation — there is no animation to fix. Anyone re-reviewing should treat these as dead-class hygiene, not behavior changes.
- **"Radius discipline: 6/12/16 only" as stated.** DESIGN.md does **not** say "6/12/16 only" — it says controls=6, **cards/panels=12**, shell/modals=16, and the `Card` primitive legitimately offers an `8px` `sm` radius (card.js:42). So `rounded-[8px]` is **on-system**, not a violation. Batch 4 fixes the genuinely off-system values (`14px`, bare-`rounded` 4px, `rounded-xl`, `1.5rem`); do not "correct" 8px radii.
- **Gold-soft fix as line-located in the finding ("change line 121 from 0.14" while also citing 66-67).** The *value* fix is correct and kept (Batch 7), but the finding's line references are internally inconsistent. Ground truth: dark `0.14` is **app.css:121**, light `0.16` is **app.css:67**. Editing by the finding's quoted lines blind would touch the wrong rule. Corrected in Batch 7.
- **No finding rejected on stillness grounds beyond the framing correction above** — every prescribed change is static-safe and gate-safe. The empty-state h1 unification additionally required *adding* a fix the findings omitted (empty-state.js:219 `sm:text-[32px]`), folded into Batch 2.

---
**Files touched (all absolute):** `crates/ironclaw_webui_v2_static/static/styles/app.css`; `.../js/design-system/{card,button,primitives}.js`; `.../js/components/{sidebar-nav,sidebar-threads}.js`; `.../js/pages/chat/components/{empty-state,approval-card,chat-input}.js`; `.../js/pages/onboarding/onboarding-page.js`; `.../js/pages/settings/components/provider-card.js`; `.../js/pages/extensions/components/extension-card.js`. Each batch ships independently; run `npm run prepare:webui-static` then `verify:static-frontend` + `smoke:webui-static` + `contrast.test.mjs` per batch before screenshot capture.