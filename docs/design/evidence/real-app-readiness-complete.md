# Real-app readiness — COMPLETE (all fixes composed; real ~/.ironclaw profile, key set as the app boots)

Probe booted with NEARAI_API_KEY (as sidecar.rs does):
```
healthy: true
model_catalog_count: 47
model_catalog_supported: true
start_preflight.blocked: false
connector_families: 6
ready_families: 6
```

Interpretation: model_catalog_count 0->47 (list-models fix #8), model_catalog_supported false->true, start_preflight.blocked true->false (preflight fix + catalog now lists), 6/6 connector families ready. The real-app Workbench boots, populates the model picker, is not false-blocked, and all connectors are live.
