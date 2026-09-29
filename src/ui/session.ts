/**
 * Match session — the small layer above a single `UiState` that main.ts drives.
 *
 * It owns the two things a live match needs beyond the current position:
 *  - an **undo stack** of prior game states, so a move can be taken back, and
 *  - a per-player **undo budget** (one undo each, per game).
 *
 * DOM-free on purpose: the undo rules (who a take-back is charged to, when it is
 * allowed) and the step-set count are unit-tested here without a browser.
 */
import { isGameOver, type GameState, type Player } from "../engine";
import { initialUi, type TapResult, type UiState } from "./interaction";

/** How many undos each player gets per game. */
export const UNDOS_PER_PLAYER = 1;

export interface MatchState {
  readonly ui: UiState;
  /** Game states before each committed move, oldest → newest. Popped by `undo`. */
  readonly past: readonly GameState[];
  /** Undos still available to each player this game. */
  readonly undosLeft: Readonly<Record<Player, number>>;
}

export function newMatch(game: GameState): MatchState {
  return {
    ui: initialUi(game),
    past: [],
    undosLeft: { cyan: UNDOS_PER_PLAYER, magenta: UNDOS_PER_PLAYER },
  };
}

/**
 * Fold a tap result into the match. A committed move pushes the state it replaced onto
 * the undo stack; a select/deselect only swaps the visible `ui` (nothing to undo).
 */
export function applyTap(match: MatchState, result: TapResult): MatchState {
  if (result.kind === "moved") {
    return { ...match, ui: result.ui, past: [...match.past, match.ui.game] };
  }
  return { ...match, ui: result.ui };
}

/**
 * The player an undo would refund — the one who made the last committed move — or null
 * if no move has been made. (The pushed state's `turn` is the side that was about to move,
 * i.e. the mover.)
 */
export function lastMover(match: MatchState): Player | null {
  const prev = match.past[match.past.length - 1];
  return prev ? prev.turn : null;
}

/** An undo is allowed only while the game is live and the last mover still has one left. */
export function canUndo(match: MatchState): boolean {
  const mover = lastMover(match);
  if (mover === null || isGameOver(match.ui.game)) return false;
  return match.undosLeft[mover] > 0;
}

/** Take back the last move and hand the turn back to its author, spending their undo. */
export function undo(match: MatchState): MatchState {
  if (!canUndo(match)) return match;
  const mover = lastMover(match)!;
  const prev = match.past[match.past.length - 1];
  return {
    ui: { game: prev, selected: null, lastMove: null },
    past: match.past.slice(0, -1),
    undosLeft: { ...match.undosLeft, [mover]: match.undosLeft[mover] - 1 },
  };
}

/** Completed step sets = pairs of moves (one cyan + one magenta) played so far. */
export function stepSets(game: GameState): number {
  return Math.floor((game.history.length - 1) / 2);
}
