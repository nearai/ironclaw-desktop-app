# Loop #21 (P4) — gateway supervisor: standalone self-heals on sidecar exit (2026-06-22 05:34 EDT)

Root-caused the "gateway crashed twice" from loop #20: NOT a gateway crash (no
panic/OOM/abort in logs) — the sidecar is spawned in the launcher's process group, so
it's reaped when the launcher's shell/session is torn down. The nohup'd reboot survived,
confirming it.

- `scripts/workbench-standalone.mjs`: `startGateway()` supervisor — on unexpected sidecar
  `exit` it respawns with linear backoff (1s·n, cap 8s), up to 20 restarts, then gives up;
  a `shuttingDown` guard skips respawn on intentional shutdown. Header documents running
  the launcher under `nohup … &` so the launcher itself survives the session (the actual
  reaping cause).
- **Live-proven** (alt ports 17646, separate WB_HOME): boot → "gateway ready" → `kill -9`
  the sidecar → log "gateway exited (signal=SIGKILL); respawn #1 in 1000ms" → "booting
  gateway" → **17646 back up**. Self-heals.
- **Gate green:** test:static 814, a11y 138, design DT-1..6, smoke (launcher is a dev
  script, not bundled — gate unchanged; ran it to confirm no regression).
- App gateway (:17640, nohup'd) stays up; stale duplicate launchers cleaned.
