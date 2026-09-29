# Tic-Tac-Twist: 3 Piece Challenge

A neon-arcade twist on tic-tac-toe. Each player has **3 pieces**. Place them, then
**move** them — first to make a line of 3 wins. The board never fills, so it's a game
of mobility and traps, not filling squares.

> **Status:** project scaffolded (Vite + TypeScript). The game engine, AI, and UI are
> built in tickets **TT-002 → TT-007** (see [docs/PRD.md](docs/PRD.md)). Client-only web
> app, hot-seat 2-player + a solver-based AI. No backend, no accounts, no online play.

## Why it's not just tic-tac-toe
Standard tic-tac-toe is a trivial draw. This variant was **solved** (see
[`docs/research/solver.py`](docs/research/solver.py)): with "move anywhere" rules it's a
fair game (a draw with perfect play, like tic-tac-toe) but **80% of positions have a
forced win** — so against real, imperfect opponents, games are sharp and decisive.

## Rules (short)
1. 3×3 grid. Two players, 3 pieces each. First player moves first.
2. **Place** your 3 pieces (one per turn) on empty cells.
3. Once all 3 are down, each turn **move** one of your pieces to any empty cell.
4. Make a row/column/diagonal of 3 → you win.
5. Same position repeated 3 times → draw. No skipping a turn, ever.

## Look & feel
Neon arcade: dark aurora backdrop, glowing cyan vs magenta pieces on a glass board.
The whole screen glows in the current player's color (that's the turn indicator). Wins
get a top declaration, a bold winning line, and screen-wide confetti — board stays visible.

## Develop
```bash
npm install      # first time
npm run dev      # start the Vite dev server
npm test         # run the engine/solver unit tests (Vitest)
npm run build    # type-check + production build to dist/
```

## Docs
- **[docs/PRD.md](docs/PRD.md)** — product requirements + build plan (source of truth).
- **[docs/design.md](docs/design.md)** — design doc: game-theory findings, UX, rationale.
- **[docs/research/solver.py](docs/research/solver.py)** — the exact solver that verified
  the rules and doubles as the AI blueprint.
