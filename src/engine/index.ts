/**
 * Tic-Tac-Twist engine — the single source of truth for the rules.
 *
 * Pure and DOM-free: every function is a pure transformation of immutable state, so the
 * whole rule set is unit-testable and reusable by the AI (TT-003) and UI (TT-004).
 *
 * Rules (see docs/PRD.md §4):
 *  - 3×3 board, two players, 3 pieces each; first player moves first.
 *  - Placement phase (per player): while you have <3 pieces on the board, place one on
 *    any empty cell. Movement phase (per player): once your 3 are down, move one of your
 *    pieces to ANY empty cell. Phase is derived from a player's piece count, never stored.
 *  - Win: after every move (both phases), 3 in a row/column/diagonal wins immediately.
 *  - Draw: threefold repetition of a position (board + side to move) — the 3rd total
 *    occurrence is an automatic draw. Win is always checked before draw.
 */

export type Player = "cyan" | "magenta";
export type Cell = Player | null;
/** 9 cells, row-major (index 0..8). Always length 9. */
export type Board = readonly Cell[];

export type Move =
  | { readonly type: "place"; readonly to: number }
  | { readonly type: "move"; readonly from: number; readonly to: number };

export type Phase = "placement" | "movement";

export interface GameState {
  readonly board: Board;
  /** Side to move. */
  readonly turn: Player;
  /** Position key of every state so far, including the current one (for repetition). */
  readonly history: readonly string[];
}

export type Status =
  | { readonly kind: "playing" }
  | { readonly kind: "win"; readonly player: Player }
  | { readonly kind: "draw" };

export const BOARD_SIZE = 9;
export const PIECES_PER_PLAYER = 3;
export const REPETITION_LIMIT = 3;

/** All winning triples: 3 rows, 3 columns, 2 diagonals. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function otherPlayer(p: Player): Player {
  return p === "cyan" ? "magenta" : "cyan";
}

export function pieceCount(board: Board, player: Player): number {
  let n = 0;
  for (const c of board) if (c === player) n++;
  return n;
}

export function emptyCells(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) out.push(i);
  return out;
}

/** Phase for a given player, derived purely from their piece count on the board. */
export function phaseOf(board: Board, player: Player): Phase {
  return pieceCount(board, player) < PIECES_PER_PLAYER ? "placement" : "movement";
}

/**
 * Position key = board contents + side to move. This is a complete key: phase derives
 * from the board, and there is no other hidden state.
 */
export function positionKey(board: Board, turn: Player): string {
  let s = "";
  for (const c of board) s += c === "cyan" ? "C" : c === "magenta" ? "M" : ".";
  return s + (turn === "cyan" ? "c" : "m");
}

export function createInitialState(first: Player = "cyan"): GameState {
  const board: Board = new Array<Cell>(BOARD_SIZE).fill(null);
  return { board, turn: first, history: [positionKey(board, first)] };
}

/** The player who owns a completed line, or null. (Only the mover can complete a line.) */
export function winner(board: Board): Player | null {
  for (const [a, b, c] of LINES) {
    const v = board[a];
    if (v !== null && v === board[b] && v === board[c]) return v;
  }
  return null;
}

/** How many times the current position (board + side to move) has occurred this game. */
export function repetitionCount(state: GameState): number {
  const key = positionKey(state.board, state.turn);
  let n = 0;
  for (const k of state.history) if (k === key) n++;
  return n;
}

/** Outcome of the current state. Win takes priority over a draw by repetition. */
export function status(state: GameState): Status {
  const w = winner(state.board);
  if (w !== null) return { kind: "win", player: w };
  if (repetitionCount(state) >= REPETITION_LIMIT) return { kind: "draw" };
  return { kind: "playing" };
}

export function isGameOver(state: GameState): boolean {
  return status(state).kind !== "playing";
}

export function isDraw(state: GameState): boolean {
  return status(state).kind === "draw";
}

/**
 * Every legal move for the side to move. Empty only when the game is over — otherwise a
 * legal move always exists (≤6 pieces on 9 cells ⇒ ≥3 empty cells).
 */
export function legalMoves(state: GameState): Move[] {
  if (isGameOver(state)) return [];
  const { board, turn } = state;
  const empties = emptyCells(board);
  if (phaseOf(board, turn) === "placement") {
    return empties.map((to): Move => ({ type: "place", to }));
  }
  const moves: Move[] = [];
  for (let from = 0; from < board.length; from++) {
    if (board[from] !== turn) continue;
    for (const to of empties) moves.push({ type: "move", from, to });
  }
  return moves;
}

function movesEqual(a: Move, b: Move): boolean {
  if (a.type === "place" && b.type === "place") return a.to === b.to;
  if (a.type === "move" && b.type === "move") return a.from === b.from && a.to === b.to;
  return false;
}

export function isLegalMove(state: GameState, move: Move): boolean {
  return legalMoves(state).some((m) => movesEqual(m, move));
}

/**
 * Apply a legal move and return the next immutable state. Throws on an illegal move or on
 * a move after the game is over. Turn always switches; `winner()` attributes a win to the
 * line's owner (the player who just moved), independent of the resulting `turn`.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (isGameOver(state)) {
    throw new Error("Cannot move: the game is already over.");
  }
  if (!isLegalMove(state, move)) {
    throw new Error(`Illegal move: ${JSON.stringify(move)}`);
  }
  const next: Cell[] = state.board.slice();
  if (move.type === "place") {
    next[move.to] = state.turn;
  } else {
    next[move.from] = null;
    next[move.to] = state.turn;
  }
  const turn = otherPlayer(state.turn);
  return {
    board: next,
    turn,
    history: [...state.history, positionKey(next, turn)],
  };
}
