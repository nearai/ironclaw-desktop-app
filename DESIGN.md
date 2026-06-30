# IronClaw Desktop Design System

IronClaw is a desktop chief of staff that should feel like Claude Code: warm,
calm, confident, and premium. Not a chat app with darker chrome — a prepared
desk where the day is triaged, the agent's work is visible, and the first
decision that belongs to the user is already at the top.

## Material direction (the warm-light system)

- **Warm paper, near-black ink.** Canvas is warm paper (`--v2-canvas` #faf7f1),
  surfaces are warm white (`--v2-surface` #fffdf9). Text is warm ink
  (`--v2-text-strong` #211c15 / body #3b342b / muted #6f6658). Light is the
  default theme; dark is a supported variant.
- **Whitespace and hairlines, not boxes.** Structure comes from space and
  0.5px warm hairlines (`--v2-panel-border`), not nested bordered cards. A
  section is a quiet heading + air + hairline-separated rows. At most one soft
  framed surface per region (e.g. the composer).
- **Quiet by default.** One blue primary action per screen; everything else is
  ghost, text, or hairline. Mostly monochrome — color is a scarce resource
  (~60/30/10).

## Color meaning

- `--v2-accent` #2f6fed: **the user's hand.** Primary actions, links, focus,
  selected/active states. One dominant blue action per screen.
- `--v2-gold` #c2603a (clay): **the agent's hand.** Generated work, the spark
  mark, agent send, attribution dots. Never clay for user/nav actions; never
  decoration.
- `--v2-positive/-warning/-danger`: status only, through semantic tokens —
  never raw Tailwind colors. Errors stay calm (hairline + a small tinted icon),
  not saturated filled boxes.
- All text/background pairs meet WCAG AA (enforced by `contrast.test.mjs`).

## Type and geometry

- Font: self-hosted Inter Variable, system fallbacks.
- Scale: Display 28/600 · Title 20/600 · Section 16/600 · Body 14/450 ·
  Label 12/500. Tabular figures by default. Optical negative tracking on large
  display headings only.
- **Sentence case everywhere.** No uppercase eyebrow labels. Section/eyebrow
  labels use the canonical quiet style `text-[13px] font-medium
  text-[var(--v2-text-muted)]` (no `uppercase`, no `tracking-*`, no `font-mono`).
- Controls `6px` · cards/panels `12px` · shell/modals `16px`. `rounded-full`
  only for true circles.
- **No motion.** State changes are instant (global `transition: none`).

## Product laws

1. **Anticipation over interrogation.** No primary surface opens to a blank
   prompt when local/gateway/connector state can prepare a brief.
2. **Legible agency.** Autonomous work is visible, attributed to the agent
   (clay), and reversible or explicitly irreversible.
3. **One surface in focus.** One dominant blue action per screen; command and
   search converge into the Bridge palette.
4. **Calm density.** Rows, ledgers, gates, and compact metrics over decorative
   dashboard mosaics — but expressed as airy hairline rows, not box piles.
5. **Honest by construction.** Never render a capability as ready until the
   gateway or local contract proves it.

## Surface archetypes

- **Today / front door:** ranked brief (what moved / needs you / ready), a
  spacious composer, hairline desk rows. Calm, lots of air.
- **Desk:** approval inbox and handled receipts; gates block risky actions
  (action, target, destination, outbound data, risk; blue Approve, quiet Deny).
- **Work:** durable dossiers — objective, context, approvals, artifacts (clay =
  generated), receipts; copyable, exportable, reloadable.
- **Chat:** assistant output reads as quiet work-on-the-desk (inline rows +
  artifact chips), not big bubbles; the user turn is the one blue bubble.

## North-star test

A new user opens IronClaw cold and within sixty seconds knows: what needs me,
what the agent did on its own, and what I can approve, deny, undo, or open next —
and it looks like a tool they'd want to use all day.
