# IronClaw Desktop Design System — Ironwork

IronClaw is a desktop chief of staff for people who live in Claude Code and
Codex all day: they type faster than they click, delegate real work to an agent,
and must personally review every external action before it leaves the machine.
The product should feel like **a terminal that learned typography** — a lit
command prompt in a quiet graphite room. Not a chat app with darker chrome; a
prepared desk where the day is triaged, the agent's work is visible, and the
decision that belongs to the user is already at the prompt.

## The signature — the caret and the gate

One blinking blue block caret (`▌`) carries the entire "whose hand is acting"
semantic across the product, the same meaning everywhere it appears:

- **lit** on the focused composer — the user's prompt;
- **dimmed** on the agent's in-flight run;
- **paused** on a live approval gate — a command waiting on your key.

The gate is the caret's loudest moment. Every external action renders as a
left-anchored **command about to execute**: a mono one-line restatement prefixed
by the caret, on a 3px accent left-rail with a faint accent-glow tint —
`▌ send → jordan@acme.com · 1 attachment leaves this machine`. The destination
and payload are the mono headline; risk is a severity-scaled inline word, not a
corner pill; Approve is labeled `return` and Deny `esc` on the buttons. The
caret, the rail, and the glow exist nowhere else, so a gate is unmistakable at a
squint and can never be skimmed as a receipt. **A receipt is the gate cooled
down:** caret removed, rail desaturated to clay, collapsed. The model on your own
machine is the one thing that never needs a gate — it wears the one lock glyph in
the product, the `Local · NEAR AI Cloud` seal.

## Material direction (graphite, the default)

- **Cool graphite, ink on near-black.** Canvas `--v2-canvas` #0f1115, surfaces
  #161922, inset wells #12141b. Ink is four genuinely distinct AA tiers:
  strong #eceff6 / body #c8cdd7 / muted #a6adb9 / faint #949ca9. Dark graphite is
  the **default** theme (`theme.js` boots here). A cold printer's-paper light
  theme (#f7f6f3, AA-complete) is the honest second theme — never the pinkish
  warm paper it replaces.
- **Whitespace and 0.5px hairlines, never boxes.** Structure is space and a
  single hairline alpha (`--v2-panel-border`); nothing casts a shadow, nothing is
  a nested box, no frosted glass. Cards default to de-boxed (`plain`); `framed`
  is opt-in and rare. **Depth is reserved as a semantic** — the only elevated
  thing in the product is a live gate.
- **Quiet by default.** One blue action per screen; everything else is ghost,
  text, or hairline. Color is money (~60/30/10).

## Color meaning — one accent, one job

- `--v2-accent` (#5b9cff dark / #1f63e0 light): **THE single accent — where a
  hand is acting.** The caret, the one primary commit per screen (including
  Send), focus ring, active-route rail, gate Approve, the local lock. If two
  things on a screen are blue, one is wrong. Never a generic active-route fill.
- `--v2-gold` clay (#e0875c dark / #b9532e light): **the agent's hand, reserved
  to provenance edge only** — a 2px left-edge on generated artifacts and the
  desaturated rail on cooled receipts. Not a general second accent; never on a
  user or nav control.
- `--v2-positive / -warning / -danger`: reserved severities, status as **text +
  one breathing dot** (genuine in-flight only) — never filled status cards, never
  raw Tailwind colors. The breathing dot does not fire on static success.
- All text/background pairs meet WCAG AA (enforced by `contrast.test.mjs`).

## Type — family does the hierarchy work

- **Geist Variable** (sans) for everything human; **Geist Mono** is load-bearing
  as the machine's voice (gate lines, tool names, payloads, IDs, model slug,
  keymaps). **Newsreader** is rationed to a single Display tier on the front-door
  greeting and the You headline only — an editorial masthead Geist alone lacks; a
  gate headline stays grotesk, never editorial.
- Six enforced steps (tokens / classes), no size outside the ladder:
  `--v2-text-display` 28 Newsreader 600 (-0.02em) · `title` 20/600 ·
  `section` 16/500 · `body` 14/400 · `label` 13 Geist Mono medium muted ·
  `meta` 12 Geist Mono faint. Tabular figures by default.
- **Sentence case everywhere.** The 28px Display is the one class exempt from the
  global `letter-spacing: 0` so its optical tracking renders.

## Geometry, space, motion

- **Space:** 4px base (`--v2-space-1..8` = 4/8/12/16/24/32/48/64). Two decided
  rhythms only — 8px tight within a turn/row/group, 32px air between turns and
  sections.
- **Radius:** exactly three — `--v2-radius-control` 6 (every button/input/select/
  chip) · `--v2-radius-card` 12 (panels, gate body, artifact chips) ·
  `--v2-radius-shell` 16 (modals, palette, composer shell). `rounded-full` only
  for true status dots; the caret block is square.
- **Motion is off by default** (global `transition: none`). Exactly two opt-in
  motions, both load-bearing, both behind `prefers-reduced-motion`: the caret
  blink (`.v2-caret--live`, one opacity step, reduced-motion → solid) on the
  three live states, and the breathing dot reserved for genuine in-flight work.
  Everything else — routes, popovers, sends, approvals — is instant. No shimmer;
  loading is a static hairline placeholder.

## Product laws

1. **Anticipation over interrogation.** No primary surface opens to a rhetorical
   question or a bare prompt; it states what moved and what needs you, then offers
   the composer as the answer.
2. **Legible agency.** Autonomous work is visible, attributed to the agent (clay
   provenance edge), and reversible or explicitly irreversible.
3. **The gate is sacred and singular.** Its caret-and-rail silhouette exists
   nowhere else, scales weight by risk, leads with what leaves the machine, and
   prints its keys (`return`/`esc`). Absent a trustworthy risk signal, default to
   higher friction.
4. **One surface in focus.** One blue action per screen; navigate, ask, find,
   run, and approve converge into the Bridge palette.
5. **Honest by construction.** Never render a capability as ready until the
   gateway or local contract proves it; readiness is narrated in exactly one
   place (the Local Seal). Empty/blocked states name the physical next action and
   never show a dead CTA.

## North-star test

A power user who lives in Claude Code opens IronClaw and, at a squint, knows what
needs them, what the agent did on its own, and what they can approve, deny, undo,
or open next — and it looks like the precise instrument they'd keep open all day.
Strip the logo and no generic dashboard wears a blinking command-prompt gate;
that is the disqualifying test, and only this passes it.
