# Workbench start-preflight fix — real-app before/after (real ~/.ironclaw profile, staged binary)

BEFORE (pre-fix): start_preflight.blocked=true, reason="NEAR AI Cloud model access is not available right now...", source=model_catalog (model_catalog_count=0) — user BLOCKED at the door even though all 6 connectors ready + GLM-5.1-FP8 inference works.

AFTER (this fix): a concrete active model (zai-org/GLM-5.1-FP8) means a catalog-listing miss no longer hard-blocks:
```
start_preflight.blocked: false
reason: ""
connector_families: 6 ready_families: 6
model_catalog_count: 0 (underlying list still 0 — separate follow-up)
healthy: true
```
