# nearai model-list fix (#8) — before/after (staged binary, NEARAI_API_KEY set as the app does)

Root cause: probe_provider built the listing provider with api_key_env:None, so the persisted nearai endpoint resolved keyless -> base defaulted to keyless private.near.ai -> list returns 0. Inference worked because the ACTIVE provider reads NEARAI_API_KEY from env (-> cloud-api.near.ai). Fix: for the persisted nearai endpoint (stored_key_allowed), set api_key_env so resolution reads NEARAI_API_KEY -> cloud-api.

BEFORE: POST /llm/list-models -> s=200 count=0 (could not list models)
AFTER:
```
POST /llm/list-models -> s=200 count=47 anthropic/claude-haiku-4-5, anthropic/claude-opus-4-6, anthropic/claude-opus-4-7, anthropic/claude-sonnet-4-5, anthropic/claude-sonnet-4-6 
```
