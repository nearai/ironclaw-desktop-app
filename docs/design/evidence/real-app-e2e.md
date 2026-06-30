# Real-app E2E (2026-06-21 PM tick) — staged dual-fix binary against the REAL ~/.ironclaw profile
Probe: scripts/probe-workbench-live-wiring.mjs --json --skip-chat-handoff
```
healthy                                      true
llm.active.provider_id                       "nearai"
llm.active.model                             "zai-org/GLM-5.1-FP8"
llm.active_provider.id                       "nearai"
llm.active_provider.name                     ""
llm.active_provider.adapter                  "nearai"
llm.active_provider.default_model            "deepseek-ai/DeepSeek-V4-Flash"
llm.active_provider.active                   true
llm.active_provider.active_model             "zai-org/GLM-5.1-FP8"
llm.active_provider.builtin                  true
llm.active_provider.api_key_required         false
llm.active_provider.accepts_api_key          true
llm.active_provider.api_key_set              true
llm.active_provider.can_list_models          true
llm.providers                                [26]
llm.models.ok                                false
llm.models.count                             0
llm.models.sample                            [0]
llm.models.message                           "could not list models for this provider"
connectors.reads.gmail.status                200
connectors.reads.gmail.successful            true
connectors.reads.gmail.has_data              true
connectors.reads.gmail.count                 3
connectors.reads.gmail.error_present         false
connectors.reads.calendar.status             200
connectors.reads.calendar.successful         true
connectors.reads.calendar.has_data           true
connectors.reads.calendar.count              1
connectors.reads.calendar.error_present      false
connectors.reads.drive.status                200
connectors.reads.drive.successful            true
connectors.reads.drive.has_data              true
connectors.reads.drive.count                 3
connectors.reads.drive.error_present         false
connectors.reads.notion.status               200
connectors.reads.notion.successful           true
connectors.reads.notion.has_data             true
connectors.reads.notion.count                3
connectors.reads.notion.error_present        false
connectors.reads.github.status               200
connectors.reads.github.successful           true
connectors.reads.github.has_data             true
connectors.reads.github.count                3
connectors.reads.github.error_present        false
connectors.reads.slack.status                200
connectors.reads.slack.successful            true
connectors.reads.slack.has_data              true
connectors.reads.slack.count                 0
connectors.reads.slack.error_present         false
workbench.live_source_status                 "Gmail ready via Composio (email reads); Calendar ready via Composio (calendar reads); Drive ready via Composio (Drive and Docs reads); Notion ready via Composio (Notion page search); Slack ready via Composio (Slack message search); GitHub ready via Composio (GitHub notifications and repo context)"
workbench.live_source_data_counts.slackBlockers 0
workbench.start_preflight.blocked            true
workbench.start_preflight.source             "model_catalog"
summary.llm.active_provider                  "nearai"
summary.llm.active_model                     "zai-org/GLM-5.1-FP8"
summary.llm.model_catalog_count              0
summary.llm.model_catalog_supported          false
summary.connected_data.ready_families        [6]
summary.connected_data.live_row_counts.slackBlockers 0
summary.workbench_start_preflight.blocked    true
summary.workbench_start_preflight.source     "model_catalog"
summary.chat_source_tools.blocked_by_setup   [0]
```
