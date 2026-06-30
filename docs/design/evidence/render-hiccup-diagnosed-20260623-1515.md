# Live render hiccup — DIAGNOSED via instrumentation (2026-06-23 15:15 EDT)

Instrumented runBriefing / the trigger handler / the HomeView render / WorkbenchBriefing with
temporary console.warn (since removed; never committed), rebuilt, booted the standalone, triggered
"What needs me today?", and read the console. The exact live sequence:

1. WBDBG trigger {canBrief:true, isBriefing:true, briefingReadsPending:false}
2. WBDBG briefing branch {shouldStartSlackBriefing:false} -> direct runBriefing()
3. WBDBG runBriefing set det "Good afternoon. 6 sources could not be read."
4. WBDBG HomeView render WITH briefing {kind:null}
5. WBDBG WorkbenchBriefing called {hasBriefing:TRUE, headline:"Good afternoon. 6 source", hasReplies:true}
   ^^ THE RENDER PATH WORKS. setBriefing(det) commits, HomeView re-renders, WorkbenchBriefing gets det.
6. WBDBG synth resolved {hasRich:FALSE, tokenMatch:true, needsYou:0}
   ^^ synthesis correctly returned null (this session's connectors FAILED -> empty bundle -> the
      "nothing to synthesize" guard returns null). So no setBriefing(rich).
7. WBDBG WorkbenchBriefing called {hasBriefing:FALSE}
   ^^ briefing reverted to NULL — WITHOUT dismissBriefing ever logging.

## Two distinct problems
A) **det -> null reset (the render bug).** The briefing renders (det), then reverts to null with NO
   dismissBriefing call. The only other thing that nulls briefing is the useState INITIALIZER (line
   376) — i.e. WorkbenchPage REMOUNTS, resetting state. Leading theory: a remount (or an unlogged
   reset) wipes the briefing shortly after it's set. Also seen: the trigger handler fired ~8x from one
   send (the pointer-event sequence / render storm) — worth confirming it's not multi-firing into a
   reset. NEXT: add a mount/unmount useEffect log to WorkbenchPage to confirm the remount; if so, lift
   the briefing state above the remounting boundary or stop the remount.
B) **Live connectors failing this session (environmental).** Headline "6 sources could not be read" —
   the standalone's Composio reads errored this boot (they worked in earlier sessions; transient).
   With no connector data the bundle is empty, so synthesis returns null regardless. A healthy boot is
   needed to see the real needsYou->rich flow live.

## Status
Render PATH works (proven). The blocker is the det->null reset (likely a remount) + a healthy connector
session. The synthesis/latency architecture is correct and committed.
