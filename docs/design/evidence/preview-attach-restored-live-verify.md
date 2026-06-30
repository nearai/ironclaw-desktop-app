# Preview screenshotting restored + live v13/feature verification (2026-06-22 11:17 EDT)

The design-guardrail screenshot capability dropped at loop #33 (the preview tool couldn't attach
to the custom standalone). Restored + used it to verify the live app.

## Preview attach (local infra, not committed)
The preview tool reads the WORKSPACE launch.json (`~/openclaw-knowledge/.claude/launch.json`), not
the desktop repo's. Added a dedicated entry `wb-preview` → serves the v2 webui on port **17651**
(IRONCLAW_GATEWAY_ORIGIN=http://127.0.0.1:17640, IRONCLAW_DEV_INJECT_TOKEN=workbench-standalone) so
it never collides with the standalone's own web tier (17641). Recipe to reproduce:
`preview_start "wb-preview"` while the standalone gateway (17640) is up. Local-only config.

## v13 design fidelity — VERIFIED LIVE (Workbench)
Screenshot of /workbench against the live gateway:
- Newsreader serif display ("What do you want handled?"), blue **#1c63d6** accent (Ask button,
  links, unread dots), dark dock. NO teal/Geist divergence.
- Chat bar with "Auto sources" + "GLM 5.2" model chip + attach/clock; verb chips (What needs me
  today? / Catch me up / Find Slack blockers / Research TEE vendors / Prepare investor update /
  Turn a file into a memo).
- Full LIVE data across all 7 connectors: NEEDS A REPLY (3 real human senders, no newsletters),
  SLACK BLOCKERS (1), GITHUB (6), UPCOMING (6 calendar), RECENT IN NOTION (6), RECENT FILES (6).
- NEEDS A DECISION cards with "Draft reply" + "Not for me" (the dismiss-with-reason control).

## Loop #35 "You" learned section — VERIFIED LIVE
Injected 2 senders × 2 sender-level dismissals, navigated to /you (via the app sidebar "You"):
- "How you work" (serif), stats (0 VIP / 16 FYI / 3 auto-filed), "What IronClaw follows"
  ("bulk senders are auto-filed — never surfaced as needing you"), "Who matters to you" (real
  correspondents w/ tier selects).
- NEW "Auto-filed from your dismissals" section renders both learned senders ("filed 2×") with
  accent-bordered "Surface again" buttons + the read-only footer. Design preserved (reused
  components/tokens).
- Interaction proven: clicking "Surface again" on notifications@noisy-vendor.com cleared its
  dismissals and re-rendered (buttons 2→1; only digest@weekly-roundup.io remained). No console
  errors. Injected test data cleared afterward.

## Mandated validation (this tick)
- Connector live suite: **14/14** — all 7 reads + write-gate (SEND rejected / DELETE forbidden /
  DRAFT allowed) + approvals + a live agent turn (short turn replied, 68 chars). Confirms short
  turns work; the #7 wedge is longer-turn-only.
- test:static **850** green.

Triage is now end-to-end verified IN the live app: observed → correctable → self-teaching →
visible + undoable. Screenshots captured in-session.
