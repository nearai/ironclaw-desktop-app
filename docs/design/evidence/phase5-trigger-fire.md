# Phase 5 — native trigger poller FIRES end-to-end (staged binary, IronClaw-native, NO Hermes)

Rust e2e (authoritative): 4/4 trigger_poller_e2e tests pass —
  fires_recurring_trigger_and_leaves_it_scheduled, drives_trusted_ingress_for_due_scheduled_trigger,
  does_not_fire_trigger_with_future_next_run_at, does_not_submit_turn_for_unpaired_actor.

Binary e2e (scripts/trigger-fire-e2e.mjs):
```
poller worker reported on boot: true
  ↳ approved trigger_create gate (Approval required) -> 200
trigger created: name=phase5-tick state=scheduled next_run_at=2026-06-21T22:41:00Z last_run_at=null
PASS: trigger FIRED — last_run_at=2026-06-21T22:41:28.942255Z state=scheduled
=== Phase 5 firing: PASS (native poller fired the agent-created trigger) ===
```

Flow: IRONCLAW_TRIGGER_POLLER_ENABLED=1 -> poller runs while serving; agent creates a recurring trigger via builtin.trigger_create (PermissionMode::Ask gate, approved over SSE); the native poller fires it (last_run_at populated within the 30s poll). No Hermes, no external scheduler.
