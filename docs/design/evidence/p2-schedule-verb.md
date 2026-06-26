# Loop #8 (P2 start) — the "Schedule" chat-bar verb (2026-06-22 01:19 EDT)

First P2 chat-bar verb. The command bar now recognizes explicit scheduling/automation
asks and frames them as a native recurring job — and the backend chain is proven live.

- New `schedule` scene (workbench-scenes-registry.js), ordered AFTER `monitor` so an
  observation-with-cadence ask ("watch competitor … every Friday") stays Monitor while
  pure scheduling ("every weekday at 9am …", "schedule this daily", "remind me each
  morning", "automate a daily digest") lands on Schedule.
- Scene framing is honest: "recurring job that runs while the app is open and asks
  before anything leaves"; action rows stage a native scheduled trigger + keep every
  run gated (Approval). `commandActionLabel` → "Schedule".
- **Live-verified** (standalone :17641): typing "Every weekday at 9am summarize my inbox
  and flag what needs a reply" → the bar's action button reads **"Schedule"**. No console errors.
- **Backend proven E2E** (scripts/trigger-fire-e2e.mjs, native poller, NO Hermes): the
  agent created a recurring trigger via builtin.trigger_create (approval gate → 200) and
  **the native poller FIRED it** (last_run_at populated ~5s after next_run_at).
- Monitor precedence preserved (regression test: "watch competitor … weekly" → Monitor).
- **Gate green:** test:static 792 (new schedule-scene test), design DT-1..6, a11y 138, smoke.

Still gated: the bar frames + the agent creates the trigger; a Workbench-native one-click
create (no agent turn) is the later #9 backend route. Real sends stay OFF.
