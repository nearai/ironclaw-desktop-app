# REAL APP E2E — npm run tauri dev (the actual Tauri shell, real ~/.ironclaw profile + Keychain)

The real desktop app built incrementally (Finished dev in 11.77s) WITH the sidecar env wiring, spawned its sidecar, and served. Key boot lines:
```
2026-06-21T22:56:57.247097Z  INFO ironclaw_reborn_composition::nearai_mcp: agent connectors: connected-sources activated; connected-sources.read is now callable by the agent loop
  version   : 0.1.0
  listen    : http://127.0.0.1:3000
  readiness : RebornReadiness { profile: LocalDev, state: DevOnly, facades: RebornFacadeReadiness { host_runtime: true, turn_coordinator: true, product_auth: true }, workers: RebornWorkerReadiness { turn_runner: true, trigger_poller: true }, diagnostics: [RebornReadinessDiagnostic { profile: LocalDev, component: CompositionProfile, reason: DevOnlyProfile, status: Blocking, blocks_production: true }] }
2026-06-21T22:56:57.810466Z  INFO ironclaw_reborn_webui_ingress: WebChat v2 listener bound target="ironclaw::reborn::webui_ingress" bound=127.0.0.1:3000
```

- App compiles + boots with the connector-env change (sidecar.rs).
- Spawned sidecar logs 'connected-sources activated' => the agent-connector fix is LIVE in the real app (not just throwaway tests).
- workers: turn_runner: true, trigger_poller: true.
- GET http://127.0.0.1:3000/api/health => HTTP 200 (sidecar serves).
- GUI killed immediately after capture (no app left running).

## Poller in the real app
Readiness reported `trigger_poller: true` during the boot. To make Phase 5 deterministic (the serve poller is off by default), sidecar.rs now sets `IRONCLAW_TRIGGER_POLLER_ENABLED=1` so the native scheduler runs while the app is open — automations fire on cadence.
