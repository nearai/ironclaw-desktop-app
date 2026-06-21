# Convergence diagnostic — agent connector read inputs/outputs (Calendar)
Shows the agent self-correcting a missing required arg (calendarId) after a 400, then getting real events:
```
  [tool connected-sources.read|completed] in="{\n  \"arguments\": {\n    \"maxResults\": 250,\n    \"orderBy\": \"startTime\",\n    \"singleEvents\": true,\n    \"timeMax\": \"2026-07-21T23:59:59Z\",\n     out={ "data": 
  [tool connected-sources.read|completed] in="{\n  \"arguments\": {\n    \"calendarId\": \"primary\",\n    \"maxResults\": 250,\n    \"orderBy\": \"startTime\",\n    \"singleEvents\": true,\n    \"timeMax\ out={ "data": 
  [tool connected-sources.read|completed] in="{\n  \"arguments\": {\n    \"calendarId\": \"primary\",\n    \"fields\": \"items(summary,start)\",\n    \"maxResults\": 250,\n    \"orderBy\": \"startTime\",\n out={ "data": 
```
