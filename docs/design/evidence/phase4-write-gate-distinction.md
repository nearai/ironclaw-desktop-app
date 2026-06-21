# Phase 4 — write-gate distinction on a SENDS-ENABLED throwaway instance (empty args; nothing delivered)

IRONCLAW_WORKBENCH_SEND_ENABLED=1. Allowlisted cross-tool sends reach Composio (Composio rejects the empty payload -> nothing sent); deletes stay Forbidden at the gateway.
```
PASS  DRAFT allowed (always)  s=200
PASS  SEND GMAIL_SEND_EMAIL reaches Composio (flag on)  successful=false err=Invalid request data provided
PASS  SEND SLACK_CHAT_POST_MESSAGE reaches Composio (flag on)  successful=false err=Invalid request data provided
PASS  SEND GOOGLECALENDAR_CREATE_EVENT reaches Composio (flag on)  successful=false err=Invalid request data provided
PASS  SEND NOTION_CREATE_NOTION_PAGE reaches Composio (flag on)  successful=false err=Invalid request data provided
PASS  DELETE GMAIL_DELETE_MESSAGE Forbidden (even sends on)  successful=undefined err=invalid_request
PASS  DELETE GOOGLECALENDAR_DELETE_EVENT Forbidden (even sends on)  successful=undefined err=invalid_request
=== 7/7 write-gate distinction checks passed ===
```

Signal: SEND slugs return successful=false with a COMPOSIO error ("Invalid request data provided") = forwarded to Composio; DELETE slugs return a gateway "invalid_request" = blocked before Composio. Boundary holds even with sends enabled.
