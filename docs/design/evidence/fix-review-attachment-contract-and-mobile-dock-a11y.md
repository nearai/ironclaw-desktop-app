# Review fixes: attachment wire contract + mobile dock a11y (2026-06-22 13:25 EDT)

Addresses an independent review of the active checkout.

## [P1] Stale bundle — already resolved
`npm run verify:static-frontend` was failing on the reviewer's pre-commit snapshot (bundle out of
sync). On the active tree post-commit it PASSES, and `prepare:webui-static` produces zero diff —
the bundle is fresh. No action needed beyond confirming.

## [P1] Attachment data_base64 contract mismatch — FIXED
The gateway's send-message body (`WebUiInboundAttachment`, gateway webui_inbound.rs:132) requires
`data_base64`, but `normalizeAttachmentPayloads` (api.js) serialized `base64` → HTTP 422
"missing field data_base64" in the packaged WebView (file-backed chat/export). The whole static
test+smoke layer had codified the wrong `base64` field (a mock that never enforced it), so only the
reviewer's real-gateway smoke caught it.
- api.js: emit `data_base64` (accept either input key — composer carries `base64`, smokes carry
  `data_base64`).
- Aligned the assertions to the real contract: api.test.mjs, tests/static/attachments-static.spec.ts
  (×2), scripts/smoke-webui-static.mjs (×3 wire reads).
- **Live proof (gateway :17640):** old `base64` → HTTP 422 "missing field data_base64" (reproduces
  the reviewer's error); new `data_base64` → HTTP 200 "Queued" with a run_id (attachment accepted).

## [P2] Mobile dock left an offscreen focusable Close control — FIXED
The closed slide-over dock (≤1120px) translated offscreen but stayed in the tab order + a11y tree.
responsive.js now sets `visibility: hidden` on the closed dock (deferred past the slide-out) and
`visible` on `.is-open`. Live-verified at 390px: closed dock + "Close active work" both compute
`visibility: hidden` (not focusable); applying `is-open` flips both to `visible`.

## [P3] Settings TODOs — acknowledged, not addressed
Generic settings import/export, tool-permission writes, and users return honest TODOs (not
fake-success). Tracked as real backend work (pending TaskList #9/#12), out of scope for this fix.

## Gate
test:static 859, test:a11y-static 140, smoke:webui-static PASS, test:design-static, bundle size
PASS, verify:static-frontend OK.
