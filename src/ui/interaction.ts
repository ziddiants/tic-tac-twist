/**
 * Tap interaction — the pure bridge between a tapped cell and the engine.
 *
 * DOM-free so the tap rules (1-tap place, 2-tap move, deselect, switch, inert cells) are
 * unit-tested on their own. It never re-implements game rules: what is placeable,
 * selectable, or a target is always read from the engine's `legalMoves`.
 */
import { applyMove, legalMoves, status, type GameState, type Move } from "../engine";

export interface UiState {
  readonly game: GameState;
  /** Cell of the piece picked up for a move (movement phase only), or null. */
  readonly selected: number | null;
  /** The move that produced `game` — the renderer uses it to animate. */
  readonly lastMove: Move | null;
}

export type TapResult =
  | { readonly kind: "moved"; readonly ui: UiState }
  | { readonly kind: "selected"; readonly ui: UiState }
  | { readonly kind: "deselected"; readonly ui: UiState }
  /** The tap did nothing (opponent piece, occupied cell, game over, …). */
  | { readonly kind: "inert"; readonly ui: UiState };

export function initialUi(game: GameState): UiState {
  return { game, selected: null, lastMove: null };
}

/** Cells holding a piece the side to move may pick up (empty during placement). */
export function selectableCells(game: GameState): Set<number> {
  const out = new Set<number>();
  for (const m of legalMoves(game)) if (m.type === "move") out.add(m.from);
  return out;
}

/**
 * Cells a tap would currently land on: every placement cell, or — with a piece
 * selected — every destination for that piece.
 */
export function targetCells(ui: UiState): Set<number> {
  const out = new Set<number>();
  for (const m of legalMoves(ui.game)) {
    if (m.type === "place") out.add(m.to);
    else if (m.from === ui.selected) out.add(m.to);
  }
  return out;
}

export function tap(ui: UiState, cell: number): TapResult {
  const moves = legalMoves(ui.game);
  if (moves.length === 0) return { kind: "inert", ui };

  const place = moves.find((m) => m.type === "place" && m.to === cell);
  if (place) return moved(ui, place);

  if (ui.selected !== null) {
    const move = moves.find((m) => m.type === "move" && m.from === ui.selected && m.to === cell);
    if (move) return moved(ui, move);
    if (cell === ui.selected) return { kind: "deselected", ui: { ...ui, selected: null } };
  }

  if (selectableCells(ui.game).has(cell)) {
    return { kind: "selected", ui: { ...ui, selected: cell } };
  }
  return { kind: "inert", ui };
}

function moved(ui: UiState, move: Move): TapResult {
  return { kind: "moved", ui: { game: applyMove(ui.game, move), selected: null, lastMove: move } };
}

/**
 * Apply a move chosen outside the tap flow — the AI, which may return a from→to move that a
 * single tap can't express. Same "moved" result the tap path produces, so it animates and
 * folds into the session identically.
 */
export function applyChosenMove(ui: UiState, move: Move): TapResult {
  return moved(ui, move);
}

export type EndEffect = "confetti" | "echo" | "clear" | null;

/**
 * Which end-of-game effect a render should trigger. Fires only on the move that ends the
 * game (never on the first render or a re-render); a fresh game clears any running effect.
 */
export function endEffect(prev: GameState | null, next: GameState): EndEffect {
  const now = status(next).kind;
  if (now === "playing") return "clear";
  if (prev === null || status(prev).kind !== "playing") return null;
  return now === "win" ? "confetti" : "echo";
}
