# Pre-drafted reply engine — "Draft reply" comes ready (2026-06-22 14:27 EDT)

Step 1 of the briefing-as-home rebuild + the user's #1 complaint ("the agent should have replies
ready"). "Draft reply" no longer opens a blank box — it pre-fills a reply drafted in the user's
voice via a short agent turn, for review/edit/create. Nothing is ever sent.

## What shipped
- `lib/workbench-reply.js`: `buildSuggestedReplyPrompt` (pure), `cleanReplyText` (pure),
  `extractReplyText` (pure), `generateSuggestedReply({ message, deps })` — orchestrates
  createThread → sendMessage(prompt) → poll timeline → extract; deps injected for testability.
  Returns '' on any failure/timeout (never fabricates). +6 unit tests.
- `workbench-page.js`: `openDraftReply` kicks off generation (non-blocking) and passes the result
  to the modal via `draftSuggestion`; a token guards against a second draft landing on this one.
- `workbench-approve.js`: a `suggestedBody` prop fills the body ONLY if the user hasn't typed (never
  clobbers an edit); a "drafting a reply in your voice…" header hint; modal stays fully usable
  while generating (textarea + Create never disabled — generation is optional/best-effort).
- Updated 2 static draft tests: opening a draft now legitimately fires a reply-generation turn, so
  the old `sentMessages == []` invariant became "any chat traffic is only the reply-generation
  prompt" — the true "nothing sent" guarantee (connectorWrites = draft-create only, no GMAIL_SEND)
  is unchanged.

## Live proof (preview 17651 → gateway 17640)
Clicked "Draft reply" on a real decision card (speaker-invite email from deana@thetie.io). The modal
opened and filled with a ready, in-voice, context-aware reply:
"Thanks for the invite, Deana — happy to confirm I'll be there for the Out East Summit, July 20–22.
Looking forward to it. If there's any prep you need from me on the speaker side (topic, bio, AV,
etc.), just send it over and I'll get on it."
Recipient + subject correct, Create enabled, no console errors. (No new modal CSS — fidelity holds
by construction.)

Gate: test:static 870 (+6), a11y 140, smoke, design, bundle (cold-start 396.8/401 — reply engine
adds ~1.3 KB, under budget).
