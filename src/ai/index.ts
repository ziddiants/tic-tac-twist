/**
 * Tic-Tac-Twist AI — an exact solver over the whole game tree, plus difficulty tiers.
 *
 * This is the TypeScript port of docs/research/solver.py, built ON TOP of the engine
 * (it never re-implements the rules — it calls legalMoves / applyMove / winner / status).
 *
 * The board is tiny (~5k reachable positions), so we solve it completely with retrograde
 * analysis: every position is labelled a WIN, LOSS, or DRAW for the side to move, with a
 * distance-to-mate so the AI wins as fast as possible and loses as slowly as possible.
 * A repetition cycle counts as a draw, which mirrors the threefold-repetition rule.
 */

import {
  applyMove,
  createInitialState,
  legalMoves,
  positionKey,
  status,
  winner,
  type Board,
  type GameState,
  type Move,
  type Player,
} from "../engine";

export type Difficulty = "easy" | "medium" | "hard";
export type Rng = () => number;

/** Result for the side to move: +1 win, 0 draw, -1 loss. */
export type Outcome = -1 | 0 | 1;

interface Solution {
  /** positionKey -> outcome for the side to move. */
  readonly result: ReadonlyMap<string, Outcome>;
  /** positionKey -> distance to mate (moves); Infinity for a draw. */
  readonly dist: ReadonlyMap<string, number>;
  /** Number of reachable non-terminal positions (equivalence check vs the Python solver). */
  readonly size: number;
}

let SOLUTION: Solution | null = null;

/** Build (once) the complete solution table by retrograde analysis from the start. */
function buildSolution(): Solution {
  const start = createInitialState("cyan");
  const startKey = positionKey(start.board, start.turn);

  const nodeOf = new Map<string, { board: Board; turn: Player }>();
  const children = new Map<string, string[]>();
  const parents = new Map<string, Set<string>>();
  const immWin = new Set<string>();
  const seen = new Set<string>([startKey]);
  nodeOf.set(startKey, { board: start.board, turn: start.turn });

  const queue: string[] = [startKey];
  while (queue.length) {
    const k = queue.shift() as string;
    const node = nodeOf.get(k) as { board: Board; turn: Player };
    const s: GameState = { board: node.board, turn: node.turn, history: [k] };
    const kids: string[] = [];
    for (const m of legalMoves(s)) {
      const child = applyMove(s, m);
      if (winner(child.board) !== null) {
        immWin.add(k); // this position has an immediate winning move
        continue;
      }
      const ck = positionKey(child.board, child.turn);
      kids.push(ck);
      if (!parents.has(ck)) parents.set(ck, new Set());
      (parents.get(ck) as Set<string>).add(k);
      if (!seen.has(ck)) {
        seen.add(ck);
        nodeOf.set(ck, { board: child.board, turn: child.turn });
        queue.push(ck);
      }
    }
    children.set(k, kids);
  }

  // Retrograde labelling (BFS by distance, so wins get their shortest distance).
  const result = new Map<string, Outcome>();
  const dist = new Map<string, number>();
  const remaining = new Map<string, number>();
  for (const k of seen) remaining.set(k, (children.get(k) ?? []).length);

  const q: string[] = [];
  for (const k of immWin) {
    if (!result.has(k)) {
      result.set(k, 1);
      dist.set(k, 1);
      q.push(k);
    }
  }
  while (q.length) {
    const u = q.shift() as string;
    const ru = result.get(u) as Outcome;
    const du = dist.get(u) as number;
    for (const p of parents.get(u) ?? []) {
      if (result.has(p)) continue;
      if (ru === -1) {
        // child u is a loss for its mover (p's opponent) -> p wins by moving into u
        result.set(p, 1);
        dist.set(p, du + 1);
        q.push(p);
      } else if (ru === 1) {
        // child u is a win for the opponent -> a bad option for p
        const rem = (remaining.get(p) as number) - 1;
        remaining.set(p, rem);
        if (rem === 0) {
          // every move from p hands the opponent a win -> p is lost
          result.set(p, -1);
          dist.set(p, du + 1);
          q.push(p);
        }
      }
    }
  }
  for (const k of seen) {
    if (!result.has(k)) {
      result.set(k, 0); // unresolved = draw (secured by repetition)
      dist.set(k, Infinity);
    }
  }

  return { result, dist, size: seen.size };
}

function solution(): Solution {
  if (SOLUTION === null) SOLUTION = buildSolution();
  return SOLUTION;
}

/** Game-theoretic value for the side to move at `state` (perfect play). */
export function gameValue(state: GameState): Outcome {
  return solution().result.get(positionKey(state.board, state.turn)) ?? 0;
}

/** Number of reachable non-terminal positions (matches the Python solver's count). */
export function solutionSize(): number {
  return solution().size;
}

interface Scored {
  readonly move: Move;
  readonly val: Outcome;
  readonly dist: number;
}

/** Score each legal move from the mover's perspective (outcome + distance to mate). */
function scoreMoves(state: GameState): Scored[] {
  const sol = solution();
  return legalMoves(state).map((move): Scored => {
    const child = applyMove(state, move);
    const st = status(child);
    if (st.kind === "win") return { move, val: 1, dist: 0 }; // win right now
    if (st.kind === "draw") return { move, val: 0, dist: 0 }; // real repetition draw
    const ck = positionKey(child.board, child.turn);
    const oppResult = sol.result.get(ck) ?? 0; // opponent is to move at the child
    const oppDist = sol.dist.get(ck) ?? Infinity;
    return { move, val: (-oppResult) as Outcome, dist: oppDist };
  });
}

/** The set of optimal moves: fastest win, else draw, else slowest loss. */
function bestMoves(scored: Scored[]): Scored[] {
  const maxVal = Math.max(...scored.map((s) => s.val));
  const top = scored.filter((s) => s.val === maxVal);
  if (maxVal > 0) {
    const best = Math.min(...top.map((s) => s.dist)); // win as fast as possible
    return top.filter((s) => s.dist === best);
  }
  if (maxVal < 0) {
    const best = Math.max(...top.map((s) => s.dist)); // lose as slowly as possible
    return top.filter((s) => s.dist === best);
  }
  return top; // draw — any is fine
}

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** The optimal move for the side to move (perfect play). */
export function bestMove(state: GameState, rng: Rng = Math.random): Move {
  return pick(bestMoves(scoreMoves(state)), rng).move;
}

/**
 * Pick a move for the AI at the given difficulty.
 *  - easy: a random legal move
 *  - medium: optimal 60% of the time, otherwise random (beatable but not clueless)
 *  - hard: perfect play (never loses a drawable/winnable game)
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng = Math.random): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal moves: the game is over.");
  if (difficulty === "easy") return pick(moves, rng);
  if (difficulty === "medium" && rng() < 0.4) return pick(moves, rng);
  return bestMove(state, rng);
}
