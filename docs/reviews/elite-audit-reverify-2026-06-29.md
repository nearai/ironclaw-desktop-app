Confirmed. `connection.paused` exists only in en.js (not es.js) → row 34 PARTIAL is accurate. `bg-copper/20` is NOT in the app.css remap (only `bg-copper` and `bg-copper/10`) → rows 33/50 OPEN accurate. No `safe-area-inset` → row 27 OPEN accurate. command-palette has hardcoded English, no useT → row 19 OPEN accurate.

The provided JSON statuses hold up against spot-checks. Producing the report.

---

# ELITE-AUDIT RE-VERIFICATION (2026-06-29)

## 1. Counts

| Severity | DONE | OPEN | PARTIAL | Total |
|----------|------|------|---------|-------|
| medium   | 4    | 16   | 0       | 20    |
| low      | 4    | 27   | 1       | 32    |
| polish   | 1    | 6    | 0       | 7     |
| **Total**| **9**| **49** | **1** | **59** |

No HUMAN_GATED-by-status or STALE rows. Of the 50 OPEN/PARTIAL rows, **45 are `autonomous_safe:true`**; **5 are `autonomous_safe:false`** (human-gated): 19, 34, 67, 69, 78. (Row 19 is autonomous_safe:false because it requires writing translations to 11 packs; treated as human-gated/deferred below.)

Spot-verified against live code: 34 (PARTIAL confirmed — `connection.paused` only in en.js, in `BASELINE_MISSING_KEYS`), 50/33 (`bg-copper/20` unmapped in app.css), 27 (no `safe-area-inset` anywhere), 19 (command-palette hardcoded English, no `useT`).

---

## 2. TRUE OPEN QUEUE (autonomous-safe)

### MEDIUM

**13** · scroll-anchor on prepend · `pages/chat/components/message-list.js` — capture `prevScrollHeight` before `onLoadMore`, restore `el.scrollTop += (scrollHeight - prevScrollHeight)` in layout effect after older-page insert; keep near-bottom autoscroll. · small

**14** · Export/Save toasts on cancelled dialog · `pages/work/work-page.js` — `const result = await action(); if (result === null) { setBusy(''); return; }` before success toast; mirror message-bubble `if (saved)`. · small

**15** · QuotaExceededError unguarded on Work save · `pages/chat/lib/work-product-save.js` — wrap `setItem` in try/catch; on quota return `{error:'quota'}` so callers toast "Too large for Work — use Save to keep the file". · small

**16** · "Ready to work" brief contradicts amber "Verification pending" · `pages/chat/components/empty-state.js` — gate the positive brief row on `context.modelReadiness.verified === true`; render neutral "Verification pending" row when false. · small

**17** · `items-center` on scroll container clips top at short heights · `pages/chat/components/empty-state.js` (line 197) — replace `items-center` with `flex-col`; center inner grid via `mx-auto my-auto`. Verify 375×667. · trivial

**21** · Shared Popover (role=dialog) no focus trap/restore · `design-system/popover.js` — capture activeElement, rAF focus first focusable, Tab/Shift+Tab trap, restore on cleanup; mirror `modal.js:52-112`. · medium

**22** · Error toasts polite + region unmounts when empty · `components/toast-viewport.js` — keep outer wrapper always mounted; error toasts `role='alert'` (assertive), info/success keep `role='status'`. · small

**23** · Connector overflow menu no Escape/arrow/focus-move · `pages/extensions/components/extension-card.js` — add onKeyDown: Escape closes+restores trigger, ArrowUp/Down move between menuitems, focus first on open. · medium

**24** · Wallet-connect status region no aria-live · `static/wallet-connect.html`, `static/js/wallet-connect.js` — add `role='status' aria-live='polite'` to `#status`; separate `role='alert' aria-live='assertive'` for errors. · small

**25** · ConfigureModal dialog has no accessible name · `pages/extensions/components/configure-modal.js` — add `id='connector-setup-title'` to `<h3>` (364), `aria-labelledby='connector-setup-title'` to dialog wrapper (347). · trivial

**26** · Command palette lacks combobox/listbox semantics · `components/command-palette.js` — input `role='combobox' aria-expanded aria-controls='command-options' aria-activedescendant`; `<ul role='listbox' id='command-options'>`; buttons `role='option' aria-selected` + stable ids. · small

**27** · `viewport-fit=cover` with zero safe-area handling · `static/index.html`, `static/styles/app.css` — add `--v2-safe-bottom: max(.75rem, env(safe-area-inset-bottom))` / `--v2-safe-top`; apply to composer dock + sidebar header. Verify 390px. · small

**28** · /logs grid overflows 375px · `pages/logs/logs-page.js` (line 35) — `grid-cols-[auto_1fr] md:grid-cols-[7rem_3rem_minmax(10rem,18rem)_1fr]` or wrap in `overflow-x-auto min-w-max`. · small

**29** · Gate-enforcement smoke asserts only English · `scripts/smoke-gate-enforcement.mjs` — after English assertion, loop shipped locales, seed `ironclaw_language`, reload, assert translated `approval.*` keys render. · medium

**30** · Token-fidelity lint too narrow (alias-with-opacity no-ops) · `scripts/lint-static-status-tokens.mjs` — add coverage gate: enumerate alias color classes in shipped JS, fail any in neither `tailwind.generated.css` nor `app.css`; wire into `verify:static-frontend`. · medium

**31** · Busy status says "in your browser" on desktop · `pages/settings/components/provider-login-status.js` — import `isDesktopRuntime`; pick `onboarding.nearaiWaitingDesktop` when desktop; add that key to all packs. *(adds keys → see batch note)* · small

**32** · Session-resume probe no loading state · `pages/onboarding/onboarding-page.js` — add `resuming` useState; render existing `onboarding.resumingSession` key + disable auth buttons while probe runs (prevents double-login race). · small

### LOW

**35** · OAuth authorize `disabled` on anchor ignored · `pages/chat/components/auth-oauth-card.js` — when `!hasHttpsAuthorizationUrl` render real `<button disabled>` (no href) + inline "authorization link unavailable" message. · small

**36** · OAuth waiting state no expiry · `auth-oauth-card.js`, `auth-gate-shell.js` — useEffect checks `Date.now() >= expiresAt`, swaps to "authorization expired — re-open to try again", drives re-open CTA. · small

**37** · Risk classifier mislabels unknown tools green · `pages/chat/lib/approval-risk.js` (line 30) — return neutral `tone:'warning'` "unrecognized action — review parameters" instead of muted green read; add create_draft/compose/unknown-vendor tests. · small

**38** · Wallet login swallows real error · `pages/settings/hooks/useProviderLogin.js` (214) — `setNearaiError(String(_err?.message || _err) || t('onboarding.nearaiFailed'))`, mirroring GitHub/Google branch. · trivial

**39** · Slack redeem declares success on any 2xx · `lib/slack-pairing-api.js` (5-14) — derive `success: response.success !== false && (response.connected || response.provider_user_id)`; surface gateway message. · small

**40** · Anchor Connect busy state cosmetically dead · `pages/extensions/components/extension-card.js` (561-570) — href branch when busy: drop href + render disabled Button, or `pointer-events-none opacity-50` + strip href. · small

**41** · Unknown-strategy connect card dead end · `pages/chat/components/channel-connect-card.js` (48-55) — add "Open Connections" Button to `appScopedPath('/extensions/registry')`; replace impl-leaking copy. · small

**42** · `connectorIconKind` matches 'web'/'http' too eagerly · `pages/extensions/components/extension-card.js` (51) — tighten to `key === 'web' || key.startsWith('http') || key === 'hacker-news'`, or move web/http test after kind checks. · trivial

**43** · Preview-modal Save no busy guard · `pages/chat/components/attachment-preview.js` (139-155) — add `busy` useState, `disabled={busy}`, try/catch + finally; mirror GeneratedFileArtifactCard. · small

**44** · Preview mid-extraction shows "No preview available" · `pages/chat/components/attachment-preview.js` (120-178) — pass `extraction` state in; when `'extracting'` render "Reading file…" (`chat.attachmentExtracting`). · small

**45** · Composer chip remove button 14px, no hit padding · `pages/chat/components/chat-input.js` (726-732) — `p-2 -m-1` or `grid h-9 w-9 place-items-center` for ≥44px target. · trivial

**50** · Reconnecting banner no bg (`bg-copper/20` unmapped); dead 'connected' branch as blue · `connection-status.js`, `styles/app.css` — change reconnecting bg to `bg-[var(--v2-warning-soft)]`; delete unreachable `connected` style; add `bg-copper/20` to app.css coverage. · trivial

**51** · ⌘K palette zero discoverability · `pages/chat/components/keyboard-shortcuts.js`, `components/page-header.js` — add `shortcuts.palette` row "⌘K Command palette"; add ⌘K hint/trigger in PageHeader action cluster. · small

**52** · Sidebar thread-search input/icon unlabeled · `components/sidebar-threads.js` (234-242) — `aria-label={t('chat.searchThreads')}` on input; `aria-hidden='true'` on search icon. · trivial

**53** · KeyboardShortcuts close button 28px · `pages/chat/components/keyboard-shortcuts.js` (100-107) — bump to `min-h-[44px] min-w-[44px]` (keep icon `h-4 w-4`); match `modal.js:174`. · trivial

**54** · Broken work deep link hides whole sidebar · `pages/work/work-page.js` (326) — render two-pane with sidebar when `missing`; "not found" only in article pane (or default to `items[0]` with notice). · small

**55** · PDF export renders MD tables as raw pipe text · `pages/chat/lib/work-product-export.js` (860-902) — in `tokensForPdf` skip `/---/` separator row (reuse separator regex); ideally aligned monospace columns. · medium

**56** · Work save does full-page `location.assign` · `pages/chat/lib/work-product-save.js` (172-180) — navigate via React Router (`useNavigate`/passed callback); keep `location.assign` as non-React fallback. · small

**57** · Native `confirm()` in Logs Clear · `pages/logs/logs-page.js` (161) — replace `window.confirm` with existing `ConfirmDialog` (themed/accessible). · small

**58** · Mobile drawer stays open across nav · `layout/gateway-layout.js` — add `React.useEffect(() => sidebar.close(), [location.pathname])`. · trivial

**59** · Approval card dumps raw JSON `<pre>` always-open · `pages/chat/components/approval-card.js` (309-321) — wrap raw params in `<details>` defaulting closed ("Raw parameters"). · trivial

**61** · All 11 locale packs eager-imported (~340KB) · `static/js/main.js`, `lib/i18n.js` — keep en.js eager; convert es..ko to dynamic imports triggered in `setLang()`. · small

**62** · SuggestionChips permanently dead · `chat.js`, `hooks/useChat.js`, `components/suggestion-chips.js` — delete import (chat.js:19), render (237), `handleSuggestion` (101-107), `suggestions/setSuggestions` (useChat 698-699), and `suggestion-chips.js`. · small

**63** · Identical `isDesktopRuntime()` branches in FeaturedProviderRow · `pages/onboarding/onboarding-page.js` (53-121) — collapse if/else into single unconditional `actions` assignment (~33 dead lines). · trivial

**66** · Dead `onSuggestion` prop on EmptyState · `pages/chat/components/empty-state.js` (72), `chat.js` (166) — remove `_onSuggestion` param + the `onSuggestion=` pass (lands with 62). · trivial

**68** · ModelPopover hard-capped to 340px · `design-system/popover.js` (45), `pages/chat/components/chat-input.js` (173) — pass `className='!max-w-none w-[min(28rem,calc(100vw-2rem))]'` to Popover so inner width wins. · trivial

**70** · Concurrent addFiles can exceed raw-size cap (stale snapshot) · `pages/chat/hooks/useComposerAttachments.js` (54-57) — recompute running total in functional setState updater (or serialize with mutex). · small

**71** · Rate-limit cooldown interval leaks forever · `pages/chat/hooks/useChat.js` (194-198) — inside 250ms tick, `if (Date.now() >= cooldownUntil) setCooldownUntil(0)` to trigger cleanup. · trivial

**72** · Hand-enumerated alias remap wrong long-term · `styles/app.css` (240-317) — migrate high-traffic files onto Card/Input/Button + `var(--v2-*)`, then shrink alias block (multi-step, behind #30 gate). · large

### LOW — design/correctness fold-ins (alias/no-op)

**33** · 24 legacy alias classes render as no-ops · `styles/app.css` (259-317) — add 24 missing variants (`bg-iron-800/{50,60,70,80}`, `bg-iron-950/{40,50,55,70,78}`, `bg-signal/50`, `border-signal/{20,60}`, `bg-copper/20`, `border-iron-700/{40,60}`, …) to existing `[class~]` groups. · small

### POLISH

**73** · FeaturedProviderRow non-nearai branches unreachable · `pages/onboarding/onboarding-page.js` (122-142) — remove non-nearai action branches + `handleUse/openDialog/ProviderDialog` wiring. · small

**74** · Suggestion cards imply attachment, only prefill text · `pages/chat/components/empty-state.js` — for suggestions 1 & 3, open file picker on click (useComposerAttachments) or reword self-contained. · small

**75** · Dead approval/auth-gate i18n keys · `i18n/en.js` (190,198,200,240) + all packs — remove `approval.targetLabel/outboundDataLabel/always` + `authGate.oauthAccountLabel`; update approval-card.test.mjs. · small

**77** · InferenceTab hides unwritable sections silently · `pages/settings/components/inference-tab.js` (40-43) — when not writable + no sections + no provider summary/management, render `SettingsNotWritable` (match Agent/Networking tabs). · small

**78** *(also human-gated)* · RecoveryNotice wiring unreachable · `recovery-notice.js`, `useChat.js`, `chat.js` — decision required: wire to exhausted fallback-poll path **or** delete. *(see §3)* · small

**79** · Header badge labels everything "Generated artifact" · `pages/work/work-page.js` (465-467) — "Saved document" for `type==='document'`, "Saved note" for other non-file, "`<KIND>` artifact" only for file/base64. · trivial

---

## 3. HUMAN-GATED / DEFERRED

- **19** (medium, i18n) — Command palette hardcoded English. Blocker: requires authored translations for `command.*` keys across 11 packs (not safe to machine-fill). `components/command-palette.js`.
- **34** (low, PARTIAL, i18n) — `connection.paused` translation. Blocker: needs real translations in 10 non-English packs + removal from `BASELINE_MISSING_KEYS` (verified line 145). `i18n/en.js`, `i18n/i18n-completeness.test.mjs`.
- **67** (low, i18n) — Onboarding gateway-status block + eyebrow hardcoded English. Blocker: ~11 new keys needing authored translations across all packs. `onboarding-page.js`, `i18n/en.js`.
- **69** (low, correctness) — Delete-chat UI is dead (no `DELETE /threads/{id}` backend). Blocker: product/backend decision — delete the UI now, or wait for the endpoint. `sidebar-threads.js`, `sidebar.js`, `gateway-layout.js`.
- **78** (polish, functionality) — RecoveryNotice unreachable. Blocker: wire-vs-delete decision (wiring needs recovery semantics confirmed). `recovery-notice.js`, `useChat.js`, `chat.js`.

Note: rows **31, 32, 44, 46–49, 75** add/use i18n keys but only need the **English** key authored (machine-safe) + `BASELINE_MISSING_KEYS` allowance, so they stay autonomous-safe. Only rows where *non-English translation quality* is the gate are deferred above.

---

## 4. ALREADY DONE

12, 18, 20, 60, 64, 65, 76

---

## 5. RECOMMENDED IMPLEMENTATION BATCHES

Ordered by value: correctness/a11y/honesty first; design/polish folded last.

**Batch A — Toast/dialog honesty + double-fire guards** (honesty/functionality)
Rows: 14, 39, 43, 38. Files: `work-page.js`, `slack-pairing-api.js`, `attachment-preview.js`, `useProviderLogin.js`.
Accept: cancelling a native save shows no success toast; Slack redeem only "connected" with proof; double-click Preview Save spawns one dialog; wallet login surfaces real backend error.

**Batch B — Storage/timer/concurrency correctness** (correctness)
Rows: 15, 70, 71. Files: `work-product-save.js`, `useComposerAttachments.js`, `useChat.js`.
Accept: oversized Work save returns `{error:'quota'}` (no throw); concurrent addFiles never exceeds `MAX_RAW_TOTAL_SIZE`; cooldown interval stops after expiry (no perpetual 250ms re-render).

**Batch C — Touch targets + safe-area + mobile layout** (mobile)
Rows: 27, 28, 45, 53, 58, 17. Files: `index.html`, `app.css`, `logs-page.js`, `chat-input.js`, `keyboard-shortcuts.js`, `gateway-layout.js`, `empty-state.js`.
Accept: at 375–390px — composer/sidebar clear notch+home-indicator, /logs row scrolls not overflows, chip-remove + shortcuts-close ≥44px, drawer closes on route change, landing scrolls without top clip.

**Batch D — A11y dialog/menu/live-region contract** (a11y)
Rows: 21, 22, 23, 24, 25, 26, 52. Files: `popover.js`, `toast-viewport.js`, `extension-card.js`, `wallet-connect.{html,js}`, `configure-modal.js`, `command-palette.js`, `sidebar-threads.js`.
Accept: axe-clean — popover/overflow-menu trap+restore focus + arrow/Escape; error toasts assertive in always-mounted region; ConfigureModal has accessible name; palette exposes combobox/listbox/activedescendant; wallet status announces; thread-search labeled.

**Batch E — Approval/auth honesty + recovery** (honesty/functionality)
Rows: 16, 31, 32, 36, 35, 37, 41, 59. Files: `empty-state.js`, `provider-login-status.js`, `onboarding-page.js`, `auth-oauth-card.js`, `auth-gate-shell.js`, `approval-risk.js`, `channel-connect-card.js`, `approval-card.js`.
Accept: brief never claims "Ready" while chip says "Verification pending"; desktop busy copy drops "in your browser"; resume probe shows loading + disables auth; expired OAuth swaps copy + re-open CTA; non-HTTPS authorize is a real disabled button; unknown tools badge warning not green; unknown-strategy card offers "Open Connections"; raw approval JSON behind `<details>`. (Adds English-only i18n keys where noted.)

**Batch F — Dead-code excision** (correctness/polish)
Rows: 62, 66, 63, 73, 75, 79, 42. Files: `chat.js`, `useChat.js`, `suggestion-chips.js`, `empty-state.js`, `onboarding-page.js`, `i18n/en.js` (+packs), `work-page.js`, `extension-card.js`.
Accept: SuggestionChips + dead `onSuggestion` prop gone; identical desktop/else branches + non-nearai branches collapsed; stale approval/authGate keys removed (tests updated); header badge labels by type; `connectorIconKind` no false 'web' matches; static frontend tests green.

**Batch G — Work/Logs navigation + export fidelity** (functionality/correctness)
Rows: 54, 56, 57, 55. Files: `work-page.js`, `work-product-save.js`, `logs-page.js`, `work-product-export.js`.
Accept: broken work deep link keeps sidebar visible; saving work does client-side route (no full reload); Logs Clear uses themed ConfirmDialog; PDF export skips MD table separator rows (no raw `---` line).

**Batch H — CI/lint gate hardening** (gate-integrity)
Rows: 29, 30. Files: `smoke-gate-enforcement.mjs`, `lint-static-status-tokens.mjs`.
Accept: gate-enforcement smoke fails when a non-English approval gate is untranslated; alias coverage gate fails on any shipped alias class unmapped in `tailwind.generated.css`/`app.css`; both wired into `verify:static-frontend`.

**Batch I — Alias-class no-op remap** (design) — *land after Batch H so the new gate guards it*
Rows: 33, 50. Files: `styles/app.css`, `connection-status.js`.
Accept: the 24 enumerated alias variants resolve to real tokens (no invisible inputs/dots/borders); reconnecting banner uses `--v2-warning-soft`; coverage gate (Batch H) passes.

**Batch J — Scroll-anchor + i18n bundle split + discoverability + a11y polish** (perf/UX)
Rows: 13, 61, 51, 77, 68, 74. Files: `message-list.js`, `main.js`, `lib/i18n.js`, `keyboard-shortcuts.js`, `page-header.js`, `inference-tab.js`, `popover.js`, `chat-input.js`, `empty-state.js`.
Accept: loading older history preserves scroll position; only en.js loads at cold boot (others dynamic on `setLang`); ⌘K appears in shortcuts overlay + header hint; unwritable InferenceTab shows `SettingsNotWritable`; ModelPopover reaches 28rem; attachment-suggestion cards open picker or reword.

**Deferred (separate human-input PRs):** translation rows 19, 34, 67; backend-contract rows 69, 78. Long-horizon refactor **72** rides on Batches H+I and is not commit-sized.