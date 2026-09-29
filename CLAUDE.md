# CLAUDE.md — Tic-Tac-Twist project

Project-specific instructions. This supplements the global `~/.claude/CLAUDE.md` (AI CTO).

## BOOT — read first each session
1. `docs/PRD.md` — requirements + build plan (source of truth for scope/drift).
2. `docs/design.md` — game-theory findings, UX/UI decisions, rationale.
3. Vault `~/ProductBrain/Projects/tic-tac-twist/` — Decisions, Past Mistakes, latest Session.
4. ShipStack handoff `~/.shipstack/projects/tic-tac-twist/handoff.md` — where we left off.

## What this is
A neon-arcade tic-tac-toe variant (Three Men's Morris family). 3 pieces each; place then
move; line of 3 wins; threefold-repetition = draw. **Client-only web app.** MVP =
hot-seat 2-player + a solver-based AI. No backend, no accounts, no online play.

## Stack
- **TypeScript + Vite.** DOM + CSS Grid for the 3×3 board (no canvas needed for the board).
- Three layers, kept separate: **engine** (pure rules, no UI) · **solver/AI** (pure) ·
  **UI** (thin, renders state + captures taps). Engine + solver are unit-tested (Vitest)
  with no DOM deps.
- Scripts: `npm run dev` / `npm test` / `npm run build`.

## Non-negotiables (rules correctness — never cut)
- Win checked after **every** move, in **both** phases (placement can win). Win before draw.
- Threefold repetition (board + side-to-move, counted total occurrences) = auto draw.
- Phase is **per-player**, derived from that player's piece count on board (<3 place, =3 move).
- Free movement: a piece may move to **any** empty cell. No skipping — a legal move always
  exists (≤6 pieces on 9 cells).
- Respect `prefers-reduced-motion` (animations degrade to instant).

## UX must-haves (from mockup testing)
- **Turn = ambient color wash**: the whole screen glows in the current player's color
  (cyan from bottom, magenta from top). Primary turn cue.
- **Win celebration** does NOT cover the board: declaration on top, board visible in the
  center (glowing winning line + board glow), round counter + Play again at the bottom,
  confetti over the whole screen. Confetti must render ABOVE everything (no covering modal).

## Workflow (standing rules — honor them)
- **Branch, not main.** Each build ticket gets a feature branch off `main`; merge only
  after tests pass + Adwitya approves (prefer `--no-ff`). Trivial doc/bookkeeping may go
  direct to `main`.
- **Repo stays PRIVATE** until Adwitya explicitly says to publish. No remote yet (local
  only). When adding one: `gh repo create --private`.
- **Refinement ≠ reopen.** A detail added to an agreed decision = minimal change + confirm.
- **Honor the stated gear** — explicit "go" before switching design→build; a "go" given
  before the design changed is stale, re-confirm.
- **Secrets** live in a gitignored `.env`; never paste keys into chat.

## Quality bar (from global CLAUDE.md)
Handle every state (setup, placing, moving, win, draw, illegal tap). Mobile-first, ≥44px
touch targets, dark + light themes. Correct → Simple → Maintainable → Fast → Elegant.
