# IronClaw Desktop Design System

IronClaw is not a chat app with better chrome. The front door is a prepared
chief-of-staff desk: the day is triaged, the agent's work is visible, and the
first decision that belongs to the user is already at the top.

## Product Laws

1. **Anticipation over interrogation.** No primary surface should open to a
   blank prompt when the app has local, gateway, or connector state that can
   prepare a brief.
2. **Legible agency.** Autonomous work must be visible, attributed to the
   agent, and reversible or explicitly irreversible.
3. **One surface in focus.** One dominant action per screen. Command/search
   entry points should converge into one Bridge surface.
4. **Discreet density.** Prefer rows, ledgers, gates, and compact metrics over
   decorative dashboard mosaics.
5. **Native to the Mac.** Keyboard-first, restrained motion, crisp typography,
   and quiet material hierarchy.
6. **Honest by construction.** Never render a capability as ready until the
   gateway or local contract proves it.

## Color Meaning

- `#0d7d6f` (light) / `#2dd4bf` (dark) / `--v2-accent`: the user's hand. Primary
  actions, links, focus, selected states. A deep teal — distinct from generic
  SaaS blue, paired with gold below. Keep one dominant teal action per screen.
- `#fbbf24` / `accent-gold`: the agent's hand. Generated work, proposed
  actions, approval context. Never use gold as decoration.
- `#20d29a`, `#f5c15b`, `#ff6480`: success, warning, danger. Status must route
  through semantic tokens rather than raw Tailwind colors.

## Type And Geometry

- Font: self-hosted **Geist** (variable, 100–900) first, with system fallbacks. One
  typeface — no serif; display hierarchy comes from size and weight, not a second
  family. Mono: self-hosted **Geist Mono** for IDs, tool names, and payloads.
- Display: 28/600. Title: 20/600. Section: 16/600. Body: 14/450. Label:
  12/500. Micro caps: 11/600.
- Numbers use tabular figures by default.
- Controls use `6px`, cards/panels use `12px`, shell/modals use `16px`.
  `rounded-full` is reserved for true circles.

## Surface Archetypes

- **Today:** Morning Brief first, then active matters and handled receipts.
  Tiles are secondary signals, not the first impression.
- **Desk:** approval inbox and handled feed. Gates must block risky actions.
- **Work:** durable dossiers: objective, context, approvals, artifacts,
  watches, receipts.
- **Chat:** direct conversation instrument. Risky asks should create Work and
  Desk state rather than staying buried in transcript text.
- **Canvas:** thinking annex, not the lobby.

## Command And Keyboard

Keyboard-first, one Bridge surface (Laws 3 + 5). The Workbench is driven by:

- **Cmd/Ctrl+K — command palette.** The single floating entry point: navigate
  (Work / Memory / Library / Chat / Automations / Tools / Settings), or compose
  ("Ask IronClaw: …", prefilled into the command box, never auto-sent). Works
  from anywhere, including inside a field.
- **Bare-key shortcuts** (only when focus is not in a text field, so typing is
  never hijacked): `/` jumps to the command box; `g` then `w/m/l/t` navigates;
  `?` opens the shortcuts help; `Esc` dismisses a panel; `Cmd/Ctrl+⏎` asks/sends.
- Floating overlays (palette, shortcuts, approval modal) are the only place a
  drop shadow is used; docked surfaces separate with 1px borders, not shadow.

## North-Star Test

A new user opens IronClaw cold and can answer within sixty seconds:

- What needs me?
- What did the agent do on its own?
- What can I approve, deny, undo, or open next?
