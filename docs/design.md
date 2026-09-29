# Tic-Tac-Twist: 3 Piece Challenge — Design Document

**Date**: 2026-09-29
**Project**: tic-tac-twist
**Scope Mode**: HOLD (build the proven concept, bulletproof; expand later)

## Problem

Standard tic-tac-toe is "solved" and boring — perfect play is an obvious draw and
most players see every line coming, so games stop being interesting after childhood.
We want a variant that keeps the 10-second-to-learn simplicity but restores tension
and replay value.

**The concept (Tic-Tac-Twist):** each player has exactly 3 pieces. Phase 1 — place
your 3 pieces, one per turn, on empty cells. Phase 2 — once all 3 are placed, each
turn you *move* one existing piece to a different empty cell. Every turn is exactly
one placement or one move; no skipping. Win by forming a line of 3. The board never
fills (6 pieces on 9 cells), so the game becomes about **mobility and traps** rather
than filling squares.

This is a member of the historic **Three Men's Morris** family — a proven-fun core,
which de-risks "is the idea good." Our job is to pick the exact rule variant, close
its known failure modes, and ship the smallest version that proves the fun.

## Constraints

- **User**: Adwitya — solo, cost/session-sensitive, newer to dev. Prefers few processes,
  one language (TypeScript), do-less-verify-more, exact step-by-step for any manual/CLI
  steps.
- **Workflow rules (standing)**: feature branch per ticket, never work on `main`;
  repo stays private until explicitly made public; refinement of an agreed decision =
  minimal change + confirm, don't redesign.
- **MVP scope (decided this session)**: hot-seat 2-player on one device **+** a
  solver-based AI opponent. Explicitly **not** online multiplayer.
- **Movement rule (decided by solver, this session)**: **FREE movement** — a piece may
  move to *any* empty cell (the user's original rule). Chosen over adjacent-only on data.

## Proposed Solution

### Verified game rules (final)

1. 3×3 grid. Two players: X and O. Each has exactly 3 pieces. X moves first.
2. **Placement phase (per player):** while you have fewer than 3 pieces on the board,
   your turn = place one piece on any empty cell.
3. **Movement phase (per player):** once your 3 pieces are on the board, your turn =
   move one of *your* pieces to **any empty cell** (FREE movement). You cannot move an
   opponent's piece, cannot move onto an occupied cell, cannot skip.
   - Phase is per-player, derived purely from that player's piece count on the board
     (<3 = placing, =3 = moving). No separate phase flag is stored.
4. **Win:** after every move, if any row/column/diagonal is 3 identical pieces, the
   player who just moved wins immediately. Checked after *every* move, in **both**
   phases (a placement move can win).
5. **Draw (NEW — the one added rule):** **threefold repetition = draw.** Precise
   semantics:
   - **Position key** = full board contents **+ which player is to move next**. (Phase
     derives from piece counts; no other hidden state, so this key is complete.)
   - A running tally counts *total* occurrences of each key across the game.
   - The **3rd total occurrence** of any key is an **automatic draw** (no claim needed).
   - **Evaluation order after every move:** **win first**, then draw. Win takes priority.
   - Finite position space + this rule = the game always terminates.

### Why FREE movement (the decided design lever)

Built an exact retrograde solver (`research/solver.py`, whole game tree ~5k positions):

| Ruleset | Perfect-play value | Decisive positions |
|---|---|---|
| **Free move** | **Draw** (fair) | **80%** |
| Adjacent + center-open ban | Draw (fair) | 76% |
| Adjacent, center allowed | First-player forced WIN (unfair) | — |

The adjacent results reproduce documented Three Men's Morris theory exactly, which
validates the solver — so the free-movement results are trustworthy too. Free movement
wins: it's the user's original rule, needs no special patch (adjacent needs a "no center
opening" ban to be fair), is simplest to teach, and is most decisive (80% of positions
reward correct play). "Draw with perfect play + decisive in practice" is the
tic-tac-toe / Connect-4 shape.

### Architecture (thin, no backend needed for MVP)

Pure client-side single-page web app. No server, no accounts, no network — hot-seat and
AI both run locally in the browser.

- **Stack**: TypeScript + Vite (confirmed). DOM + CSS Grid for the 3×3 board.
- **Layers (kept separate so the engine is unit-testable without a DOM):**
  1. **Engine (pure functions, no UI):** `GameState`, `legalMoves`, `applyMove`,
     `winner`, `isDraw` (threefold repetition), `status`. Rules live in one place.
  2. **Solver / AI (pure):** minimax/retrograde over the tiny tree → perfect move.
     Easy = random legal move; Medium = degraded (ε-greedy/shallow); Hard = perfect.
     The solver we already wrote *is* the AI.
  3. **UI (thin):** renders state, captures taps, shows phase/turn/targets, win/draw.

### Game setup, sides, and rematch

- **X always moves first** (first-player). Fairness comes from who *is* X, not move order.
- **Hot-seat:** both humans share the device; order is X then O.
- **AI mode:** the human **chooses their side (X or O)**, default **X**; AI plays the other.
- **Play again / rematch:** **sides swap** by default so first-move advantage alternates;
  the round counter increments (optionally a running score).

### UX/UI Design (decided; refined through mockup testing)

**#1 UX job — teach the twist.** The place → move transition is the single point of
player confusion. Mitigations: persistent placement counter ("2 pieces left"); the tray
of pieces **depletes** as you place (empty tray = you're now moving); on the 3rd
placement a one-time cue (first game only); in movement, selecting a piece lights up
**every** legal destination so "move anywhere" is *shown*.

**Interaction (decided):**
- **Tap-to-place (1-tap); tap-to-move (2-tap)** — select own piece (it glows), legal
  targets pulse, tap a target to move (slide animation). Tap selected piece to deselect;
  tap another own piece to switch. Not drag (foolproof + accessible on mobile).
- Illegal taps (opponent piece / occupied cell) are inert, with a subtle nudge.

**Turn indicator — ambient color wash (validated in mockup):** whose turn it is must be
readable at a glance. The **whole-screen background glows in the active player's color**,
rising from that player's tray side (cyan from the bottom, magenta from the top), and
crossfades each turn. This is the primary turn cue; a text status is secondary. (A subtle
tray-label glow alone was too weak — mockup v1 finding.)

**Visual direction — Neon arcade (decided):**
- Dark aurora backdrop (deep blue/magenta ambient glows, not flat black); glass board with
  depth. Two glowing player colors: **cyan** (~`#2de2ff`) vs **magenta** (~`#ff4fb2`) —
  tune for WCAG contrast; provide a daylight/light variant of the same palette.
- Pieces = glowing discs with soft outer glow. Neon-tube display face (Monoton) for the
  wordmark and win declaration; Chakra Petch for UI/status.
- Micro-animations: place = pop-in, move = slide, win = confetti + glow. Respect
  `prefers-reduced-motion` (fall back to instant / a single small burst).
- Mobile-first, one-handed, ≥44px touch targets, portrait.

**Screen flow:**
1. **Setup:** Hot-seat vs AI → if AI: difficulty (Easy/Medium/Hard) + pick your side
   (default first-player) → Start.
2. **Game:** board centered; top tray (magenta) + bottom tray (cyan); ambient turn wash;
   persistent phase/turn indicator + placement counter + restart.
3. **End — win celebration (revised per mockup feedback; must NOT cover the board):**
   - **Top:** big neon-tube declaration ("CYAN / MAGENTA WINS").
   - **Center:** the **board stays visible** — winning line glows boldly through the 3
     pieces, board frame glows in the winner's color, losing pieces dim.
   - **Bottom:** round counter (games/score) + **Play again** button.
   - **Confetti/poppers** overlay the *entire* screen on the top-most layer.
   - Implementation note: confetti must render ABOVE everything (no dark modal backdrop
     over the confetti canvas). Mockup v2 bug: a covering modal hid both confetti and
     board — do not use a covering modal for the win screen.
   - **Draw:** a declaration moment like a win (same layout), "DRAW" + "Position repeated
     3 times". No confetti — a draw-specific effect instead (proposed "echo" ripple, see
     PRD FR-U5; confirm before TT-006).
4. **Play again:** sides swap by default; increment the round counter.

## Error & Rescue Map

| Failure Mode | What Happens | Rescue Action | User Sees |
|---|---|---|---|
| Infinite shuffle / no draw rule (original spec gap) | Two good players loop forever | Threefold-repetition = draw, tracked in move history | "Draw — repeated position" + Play again |
| Adjacent+center-open = forced 1st-player win | Unfair, game feels broken | Rejected that ruleset; chose free movement (fair) | N/A (avoided by design) |
| Player taps opponent's piece / occupied / illegal target | Confusion | Engine rejects; only legal targets highlighted/tappable | Illegal cells inert; subtle nudge |
| Player tries to skip a turn | Rules violated | No skip affordance; a legal move always exists | Turn indicator stays until a legal move |
| Whose turn unclear | Wrong moves | Ambient full-screen color wash + text status | Screen glows in current player's color |
| Win formed during placement | Might be missed | `winner()` checked after *every* move, both phases | Immediate win celebration |
| AI too hard (perfect never loses) | Player quits | Difficulty tiers (Easy/Medium/Hard); default Medium | Difficulty selector before game |
| Refresh mid-game | Progress lost | (Post-MVP) localStorage; MVP: acceptable to reset | MVP: game resets on refresh |

## What This Does NOT Include (non-goals)

- Online / networked multiplayer, matchmaking, real-time sync.
- Accounts, profiles, auth, leaderboards, cross-session stats.
- Adjacent-movement variant (decided against on data; not a toggle).
- Sound, themes/skins, undo/redo, replays, save/resume.
- Server or database of any kind — MVP is 100% client-side.
- Native mobile apps — web only (mobile browser is the mobile story).

## Open Questions (non-blocking)

1. **Medium AI difficulty** — ε-greedy perfect vs shallow lookahead; tune in TT-003.
2. **Anti-shuffle rule** — threefold-repetition is the decided minimum; add a "no
   immediate reversal" rule later *only* if playtesting shows it's needed.
3. **Win screen** — show a running score vs just a round number; decide in TT-006.

## Cold Review Status

A cold reviewer (no exposure to the design conversation) reviewed the design: **PASS** on
Consistency, Scope, and Feasibility (solver size and guaranteed termination independently
re-derived). Two CONCERNs — under-specified draw semantics + minor gaps — were addressed:
draw rule fully pinned, win-before-draw order defined, AI side-selection/rematch specified,
deselect/re-tap UX defined. No issues remain open.

## Past Mistakes Relevant to This Feature

- **Honor the stated gear**: a "go" given before the design is settled is stale once the
  design changes — re-confirm before acting. (Learned this session: scaffolded on a
  conditional "go" before the UX was finished; rolled back and re-approved.)
- **Refinement ≠ reopen**: a detail added to an agreed decision = minimal change + confirm.
- **Branch, not main**; **repo private** until explicitly public.
