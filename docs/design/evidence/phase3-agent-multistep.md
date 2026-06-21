# Phase 3 — real multi-step agent turn (latest staged binary: connector-enable + reasoning-cap + list-models fixes)

Tool use (real Gmail) -> assistant synthesis, end-to-end:
```
  [tool connected-sources.read|completed] in="{   \"arguments\": {     \"maxResults\": 1,     \"query\": \"in:inbox\"   },   \"tool\": \"GMAIL_FETCH_EMAILS\",   \"toolkit\": \"gmail\" }" out={ "data": { "messages": [ { "
  [assistant|finalized] Here's your most recent inbox email: - **Sender:** The Information Briefing <info@theinformation.com> - **Subject:** The
```

Asserts: agent calls GMAIL_FETCH_EMAILS via connected-sources.read, gets real data, and finalizes an assistant reply citing the real sender+subject.
