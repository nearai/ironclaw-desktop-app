# Pre-draft reply made opt-in (button) + attachments queued as next phase (2026-06-22 14:40 EDT)

User feedback: "i dont need you to draft a reply every time — would be good to have a button … that
[pre-]drafts the reply itself." Also: "some replies need attachments … that was the beauty of v12
… next phase is fixing that."

## Done now — pre-drafting is opt-in
- `openDraftReply` no longer auto-generates; it opens the draft empty and stashes the source message.
  No agent turn fires unless the user asks.
- The modal shows a "Pre-draft reply" button (✨) in the Message header. Clicking it runs the short
  agent turn on demand → fills the body (replacing it, since the user asked); the button reads
  "Drafting…" while in flight and resets so the user can re-draft. '' on failure (never fabricated).
- Token guard so a prior in-flight generation can't land on a newer draft.
- Reverted the 2 static draft tests to `sentMessages == []` — with opt-in, opening a draft fires no
  turn, so the chat runtime is untouched (the more accurate invariant).

## Live proof (preview 17651 → gateway 17640)
- Open "Draft reply" → modal opens EMPTY with a "Pre-draft reply" button (no auto-generation).
- Click "Pre-draft reply" → a fresh contextual reply filled the body in ~seconds: "Confirmed — happy
  to be part of it. Thanks for the invite, Deana. What do you need from me next? Happy to share a
  bio, headshot, and any session preferences…". Create enabled, no console errors.

## Next phase — attachments on replies (v12 capability)
Replies sometimes need attachments. The wire contract is already fixed (attachments carry
`data_base64`, the gated draft path exists). Next: let the Draft-reply modal add/attach files
(source from Drive/the message, or upload) and carry them on the GMAIL_CREATE_EMAIL_DRAFT write.
Tracked as the next workbench item.

Gate: test:static 870, a11y 140, smoke, design, bundle (cold-start unchanged, 396.8/401).
