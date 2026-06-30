# Attachments-on-replies = gateway-gated + home-restructure plan (2026-06-22 14:51 EDT)

## Attachments on replies — BLOCKED (needs gateway work), spec captured
The user wants v12-style attachments on replies. The gateway forwards connector-write `arguments`
VERBATIM to Composio (reborn_services/connectors.rs: "Arguments forwarded verbatim"), so it's not the
gateway's classifier that blocks it — it's Composio's tool schema. Live probes against
GMAIL_CREATE_EMAIL_DRAFT:
- `attachment` as a base64 string → 400 "Input should be a valid dictionary or instance of
  FileUploadable on parameter `attachment`".
- `attachment` as `{name, mimetype, data}` → 400 "Following fields are missing: {'attachment.s3key'}".
So Composio requires a **FileUploadable with an `s3key`**: the bytes must be uploaded to Composio's
file store first, then referenced. The gateway has NO Composio file-upload capability today.

**To unblock (next gateway phase, /tmp/gw-unify):** add a Composio files-upload step — POST the file
bytes to Composio's upload API (server-side, with the Composio key) to obtain an `s3key`, then pass
`attachment: { s3key, name, mimetype }` to GMAIL_CREATE_EMAIL_DRAFT. Surface a new gated route (e.g.
`POST /connectors/upload`) the Draft-reply modal calls before the draft write. Frontend then adds an
"Attach file" affordance (upload / from Drive / from the thread) → upload → s3key → carry on the draft
write. Still draft-only, never sent.

## Home restructure (step 2) — scoped; it's a holistic change, not a quick cut
Cutting the three cruft surfaces the user named is broader than it looks — each is asserted by many
static tests: `workbench-sources-ready` (connector health) ×8, `workbench-arrived` ×9,
`workbench-upcoming`/rail-upcoming ×6. So the cut + the briefing-section relabel + the test rewrite
must land as ONE coherent pass (not piecemeal, which would churn the suite twice). Plan:
1. HomeView: remove SourceReadinessStrip + WorkbenchArrived + WorkbenchUpcoming; remove the rail
   'upcoming' group (Calendar tab owns it).
2. Relabel toward the briefing: "Needs a decision" → "Needs you"; keep the Ask bar.
3. Rewrite the ~23 affected static assertions in one pass (delete the now-obsolete surface tests;
   migrate the honest-empty / no-fake-data coverage to the surviving sections).
4. Radar ("Worth weighing in"), "This week", "Best times" sections come when the read-everything
   agent turn is reliable (#7) — the radar scoping foundation (lib/workbench-radar.js) already landed.

## This tick
Foundation re-validated (profile engine — newsletter suppression PASS). No code change: the home
restructure is queued as a focused pass to avoid a rushed, regression-prone partial. Attachments
queued as gateway work with the spec above.
