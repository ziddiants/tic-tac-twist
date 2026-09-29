# Tic-Tac-Twist: 3 Piece Challenge — PRD & Build Plan

**Version:** 1.0 (MVP) · **Date:** 2026-09-29 · **Owner:** Adwitya · **Scope mode:** HOLD
**Source design:** [`design.md`](design.md) (game-theory findings, UX rationale, cold review)

---

## 1. Overview

A neon-arcade twist on tic-tac-toe. Two players, **3 pieces each**. You **place** your
pieces, then **move** them around the board; first to line up 3 wins. Because the board
never fills (6 pieces on 9 cells), the game is about **mobility and traps**, not filling
squares. It's a member of the historic *Three Men's Morris* family — a proven-fun core.

**Verified by an exact solver** (`docs/research/solver.py`): with our "move-anywhere"
rules the game is *fair* (a draw with perfect play, exactly like tic-tac-toe) yet **80%
of positions contain a forced win** — so real games between imperfect players are sharp
and decisive. The solver also *is* the AI.

## 2. Goals & Non-Goals

**Goals (MVP)**
- G1. A playable, correct, fun web game: hot-seat 2-player **and** vs-AI.
- G2. Provably correct rules (win detection, both phases, guaranteed termination).
- G3. A first-timer understands the place→move twist without reading instructions.
- G4. Feels good on a phone: neon-arcade look, clear turn cue, satisfying win moment.
- G5. Deployable as a single static link.

**Non-Goals (explicitly out of MVP)**
- Online / networked multiplayer, matchmaking, real-time sync.
- Accounts, profiles, auth, persistent stats, leaderboards.
- Adjacent-movement variant (decided against on data — see design.md).
- Undo/redo, replays, save/resume across refresh.
- Native mobile apps (mobile *browser* is the mobile story).
- Server or database of any kind — MVP is 100% client-side.

## 3. Target user

Anyone who knows tic-tac-toe and finds it boring. Casual, mobile-first, short bursts.
Two use cases: (a) two people on one phone; (b) one person vs a beatable-but-smart AI.

## 4. Game rules (verified spec — the contract)

1. **Board:** 3×3 grid. Two players (first = cyan, second = magenta). 3 pieces each.
2. **Placement phase (per player):** while you have <3 pieces on the board, your turn =
   place one piece on any empty cell.
3. **Movement phase (per player):** once your 3 pieces are on the board, your turn = move
   one of *your* pieces to **any** empty cell. Can't move an opponent's piece, can't land
   on an occupied cell, can't skip. Phase is per-player (derived from piece count); the
   two players switch phase at different times (first player places their 3rd first).
4. **Win:** after **every** move (both phases — placement can win), if any
   row/column/diagonal is 3 identical pieces, the player who just moved wins immediately.
5. **Draw:** **threefold repetition = draw.** Key = board contents + side-to-move. Count
   *total* occurrences; the **3rd occurrence auto-declares a draw**. **Evaluation order
   after each move: win first, then draw.** Finite positions + this rule ⇒ always terminates.
6. **No stalemate:** ≤6 pieces on 9 cells ⇒ always ≥3 empty cells ⇒ a legal move always
   exists. No skipping.

## 5. Functional requirements

### Engine (pure TypeScript, no DOM)
- FR-E1. `GameState` = board (9 cells) + side-to-move + move history (position keys).
  Phase is derived, not stored.
- FR-E2. `legalMoves(state)` returns all legal placements or moves for the side to move.
- FR-E3. `applyMove(state, move)` returns the next state (immutable); rejects illegal moves.
- FR-E4. `winner(state)` returns the winning player or none (checked in both phases).
- FR-E5. `isDraw(state)` = any position key reached 3 total occurrences.
- FR-E6. `status(state)` = `playing | win(player) | draw`, applying **win-before-draw**.
- FR-E7. Rules live only here (single source); UI and AI call the engine, never re-implement.

### Solver / AI (pure)
- FR-A1. Exact solver over the game tree (retrograde/minimax; ~5k states — instant).
- FR-A2. Difficulty tiers: **Easy** = random legal move; **Medium** = imperfect (ε-greedy
  over perfect, or shallow lookahead — tuned in TT-003); **Hard** = perfect play.
- FR-A3. `aiMove(state, difficulty)` returns a legal move; runs client-side, sub-frame.

### UI (thin)
- FR-U1. Board centered; magenta tray on top, cyan tray on bottom; pieces are glowing discs.
- FR-U2. **Placement:** tap an empty cell to place (1-tap). Show **"N pieces left"**;
  the tray depletes as pieces are placed (empty tray = you're now in the move phase).
- FR-U3. **Movement:** tap own piece (it glows) → all legal targets pulse → tap a target
  to move (slide animation). Tap selected piece again to deselect; tap another own piece to
  switch. Opponent pieces / occupied cells are inert (2-tap).
- FR-U4. **Turn indicator = ambient wash:** the whole screen glows in the active player's
  color, rising from that player's tray side (cyan bottom, magenta top), crossfading each
  turn. Primary turn cue. Plus a text status: phase + whose turn + pieces left.
- FR-U5. **Win celebration (layout matters — must NOT cover the board):**
  - **Top:** big neon-tube declaration ("CYAN / MAGENTA WINS").
  - **Center:** board stays visible — winning line glows through the 3 pieces, board frame
    glows in the winner's color, losing pieces dim.
  - **Bottom:** round counter (games/score) + **Play again** button.
  - **Confetti** over the entire screen, on the top-most layer.
  - Implementation note: confetti canvas must sit ABOVE all UI; do NOT use a dark modal
    backdrop that covers the board (mockup v2 bug).
  - **Draw (same layout as a win — gets its own declaration moment):** top slot "DRAW"
    (neon, split cyan→magenta) + small "Position repeated 3 times"; board stays visible;
    round counter + Play again at the bottom. **No confetti** — the **echo** instead
    (approved by Adwitya 2026-09-29, built in TT-004): both washes glow together, 3
    board-shaped rings ripple out cyan · magenta · cyan (one per repetition), no pieces dim.
    Reduced-motion: static dual glow, no rings.
- FR-U6. Twist onboarding: on a player's 3rd placement, a one-time cue (first game only).
- FR-U7. `prefers-reduced-motion` ⇒ animations become instant; confetti reduced to a
  single small burst.

### Setup & flow
- FR-S1. Setup screen: **Hot-seat vs AI**. If AI: pick **difficulty** + **your side**
  (default first-player). First player always moves first.
- FR-S2. In-game: restart / back to setup always reachable.
- FR-S3. **Play again** (from the win/draw screen): sides swap by default; round counter
  increments. Optionally a running score (cyan wins / magenta wins) — MVP may show round #.

## 6. UX / UI spec

**Direction: Neon arcade.** Dark aurora backdrop (deep blue/magenta ambient glows), glass
board with depth, glowing cyan `~#2de2ff` vs magenta `~#ff4fb2` discs (tune to WCAG AA on
dark; provide a daylight/light variant of the same palette). Neon-tube display face
(Monoton) for the wordmark and win declaration; Chakra Petch for UI/status. Motion: place
= pop-in, move = slide, win = confetti + board/line glow; all gated by
`prefers-reduced-motion`. Mobile-first, portrait, ≥44px targets, one-handed. See design.md.

## 7. Technical architecture

- **Stack:** TypeScript + Vite. DOM + CSS Grid for the board.
- **Layers:** engine (pure) ← solver/AI (pure) ← UI (thin). Engine + solver have zero DOM
  deps → unit-tested in isolation (Vitest) and reused by the AI.
- **State:** single immutable `GameState`; UI re-renders from it. No global mutable state.
- **No network, no storage** for MVP (refresh resets — acceptable).
- **Confetti:** a small library (e.g. canvas-confetti) or a tiny hand-rolled canvas emitter.

## 8. Build plan (tickets — HOLD scope, build in order)

| ID | Ticket | Acceptance | Depends on |
|----|--------|-----------|-----------|
| **TT-001** | Scaffold Vite+TS project | `npm run dev` serves the neon shell; `npm test` runs; build green; committed | — (done) |
| **TT-002** | Engine + unit tests | FR-E1..E7; tests cover both phases, win in each phase, win-before-draw, threefold-repetition draw, illegal-move rejection, "always a legal move" | TT-001 |
| **TT-003** | Solver + AI + tests | FR-A1..A3; a test asserts the known game values (free=draw; adjacent+center=win) to prove correctness; Hard never loses in self-play | TT-002 |
| **TT-004** | Board UI + interaction | FR-U1..U4; tap-to-place, tap-to-move with target highlighting + slide, turn-color wash; hot-seat fully playable. **+ win confetti + draw echo** (FR-U5, pulled forward from TT-006 at Adwitya's request, 2026-09-29) | TT-002 |
| **TT-005** | Setup + AI wiring + rematch | FR-S1..S3; choose mode/difficulty/side; AI plays; Play again swaps sides + rounds | TT-003, TT-004 |
| **TT-006** | Neon polish + win celebration | FR-U5, FR-U6, FR-U7; full visual pass, win declaration + confetti (board stays visible), onboarding cue, reduced-motion, light/dark | TT-004, TT-005 |
| **TT-007** | Ship | Static build; deploy to a link; smoke-test the full flow end-to-end on a phone | TT-006 |

**Milestones:** M1 = TT-004 (hot-seat playable). M2 = TT-005 (vs-AI playable). M3 = TT-007 (shipped).

## 9. Definition of done (MVP)

- All tickets complete; `npm test`, type-check, and build green.
- Full flow verified end-to-end on a real phone browser: setup → place → move → win, plus
  a draw via repetition, in both hot-seat and vs-AI.
- Rules match §4 exactly (solver values reproduced in tests).
- Neon-arcade look, ambient turn wash readable at a glance, win celebration that keeps the
  board visible; reduced-motion respected; 44px targets; light + dark.

## 10. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Players confused by place→move switch | Tray depletion + counter + one-time cue + highlighted targets |
| Whose-turn unclear | Ambient full-screen color wash (validated in mockup) |
| Win feels flat | Confetti + neon declaration + glowing line, board stays visible (FR-U5) |
| Perfect AI frustrates | Difficulty tiers; default Medium; Easy beatable |
| Rules bug (draw counting / win-vs-draw order) | Rules isolated in engine, heavily unit-tested (TT-002) |
| Scope creep (online, accounts) | Explicit Non-Goals (§2); HOLD scope |

## 11. Open questions (non-blocking)

- OQ1. Medium-difficulty exact definition — tune in TT-003.
- OQ2. Anti-shuffle rule — ship without; add only if playtesting needs it.
- OQ3. Show running score vs just round number on the win screen — decide in TT-006.
- OQ4. Post-MVP (parked): online play, stats persistence, themes, sound, undo.
