# Home cruft cut — surface 3 of 3: connector-health strip removed (2026-06-23 08:49 EDT)

Last of the three home surfaces the user named ("connector health? why is it in here?"). The
always-on "Gmail · Ready · via Composio" readiness chips (SourceReadinessStrip) were noise on a
"what needs me" home. Connector readiness still lives — on demand — in the "What's allowed" source
inspector, which is the right place for it.

## Removed
- `SourceReadinessStrip` component + its HomeView render + the import in workbench-page.js.
  (`props.connectorFamilies` stays — WorkbenchColdStart still uses it for the cold-open.)
- The dead CSS block in styles/workspace.js (.wb13-sources-ready / .wb13-source-ready{,-name,-via}).

## Re-homed guarantees (no test deleted blind)
- "which accounts read as Ready, incl. INITIATED-not-Ready" → ALREADY the subject of the
  source-inspector test ("source inspector honors live Composio connector accounts": Notion=INITIATED
  asserts `not.toContainText('Ready')`). Dropped the duplicate strip assertions from the inbox test.
- 6 catch-up-briefing/source tests used the strip only as a "connectors are live" liveness proxy;
  each already polls connectorReadRequests (or asserts the briefing/rail content) for real sync, so
  the proxy lines were redundant — removed. Two interaction tests (manual-source-scope, Slack-blocker
  chip) swapped the proxy for `coldstart count 0` (the cold-open yields to the real surface).
- "no live source → no readiness strip" honest-empty → moot (no strip); the cold-open assertions in
  the same test remain the honest-empty subject.

## Proof
- Full gate GREEN: test:static 869/0, test:a11y-static 138 passed, test:design-static DT-1..6,
  smoke:webui-static PASS, bundle cold-start 396.0 KB < 401.
- Live standalone DOM: sources-ready 0, arrived 0, upcoming 0, decisions 1, coldstart 0 (live
  connectors). Screenshot: clean home (Ask bar -> chips -> "Needs a decision · 5"), v13 fidelity
  (Newsreader serif, blue #1c63d6, dark dock, real rail NEEDS A REPLY 5 / SLACK 1 / GITHUB 6), the
  read-only posture line + "What's allowed" inspector entry. No teal/Geist drift.

## Home cruft cut COMPLETE (all 3 surfaces the user named)
Upcoming (b…), Arrived (b502d6e), connector-health (this commit). Home is now: Ask bar + suggestion
chips + "Needs a decision" cards + the rail. Next: relabel "Needs a decision" toward the briefing's
"Needs you", then build the "Worth weighing in" radar (workbench-radar.js foundation shipped).
