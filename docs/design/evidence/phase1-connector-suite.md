# Phase 1 — real-connector suite (2026-06-21 PM tick), staged dual-fix binary
```
PASS  boot: staged sidecar serves /llm  
PASS  composio configure  (200)
PASS  connectors/connected  accounts=[googledocs,googledrive,googledrive,googlecalendar,notion,slack,github,gmail]
PASS  read gmail  live read OK
PASS  read googlecalendar  live read OK
PASS  read googledrive  live read OK
PASS  read notion  live read OK
PASS  read github  live read OK
PASS  read slack  live read OK
PASS  write-gate: SEND rejected (flag off)  invalid_request
PASS  write-gate: DELETE forbidden  invalid_request
PASS  write-gate: DRAFT allowed (real draft created)  s=200
PASS  approvals route  
PASS  live agent turn (real model)  replied: 68
=== 14/14 checks passed ===
```
