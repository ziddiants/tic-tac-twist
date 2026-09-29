import { describe, it, expect } from "vitest";
import { createInitialState, positionKey, status, type Cell, type GameState, type Player } from "../engine";
import { initialUi, selectableCells, tap, targetCells, type UiState } from "./interaction";

// ---- test helpers -----------------------------------------------------------
function makeState(cyan: number[], magenta: number[], turn: Player): GameState {
  const board: Cell[] = new Array<Cell>(9).fill(null);
  for (const i of cyan) board[i] = "cyan";
  for (const i of magenta) board[i] = "magenta";
  return { board, turn, history: [positionKey(board, turn)] };
}
/** Tap a sequence of cells, asserting each tap did something. */
function tapAll(ui: UiState, cells: number[]): UiState {
  return cells.reduce((u, c) => {
    const r = tap(u, c);
    expect(r.kind, `tap ${c}`).not.toBe("inert");
    return r.ui;
  }, ui);
}

// Movement position: cyan 0,1,5 · magenta 3,4,8 · cyan to move. Empty: 2,6,7.
const MOVING = () => initialUi(makeState([0, 1, 5], [3, 4, 8], "cyan"));

// ---- placement --------------------------------------------------------------
describe("placement (1-tap)", () => {
  it("places a piece on an empty cell and passes the turn", () => {
    const r = tap(initialUi(createInitialState()), 4);
    expect(r.kind).toBe("moved");
    expect(r.ui.game.board[4]).toBe("cyan");
    expect(r.ui.game.turn).toBe("magenta");
    expect(r.ui.lastMove).toEqual({ type: "place", to: 4 });
  });

  it("an occupied cell is inert", () => {
    const ui = tapAll(initialUi(createInitialState()), [4]);
    const r = tap(ui, 4);
    expect(r.kind).toBe("inert");
    expect(r.ui).toBe(ui);
  });

  it("every empty cell is a target and nothing is selectable", () => {
    const ui = tapAll(initialUi(createInitialState()), [4]);
    expect([...targetCells(ui)].sort()).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(selectableCells(ui.game).size).toBe(0);
  });
});

// ---- movement ---------------------------------------------------------------
describe("movement (2-tap)", () => {
  it("tap own piece selects it; its targets are every empty cell", () => {
    const r = tap(MOVING(), 0);
    expect(r.kind).toBe("selected");
    expect(r.ui.selected).toBe(0);
    expect([...targetCells(r.ui)].sort()).toEqual([2, 6, 7]);
  });

  it("no targets show before a piece is selected", () => {
    expect(targetCells(MOVING()).size).toBe(0);
  });

  it("tap a target moves the selected piece", () => {
    const r = tap(tap(MOVING(), 0).ui, 6);
    expect(r.kind).toBe("moved");
    expect(r.ui.game.board[0]).toBeNull();
    expect(r.ui.game.board[6]).toBe("cyan");
    expect(r.ui.selected).toBeNull();
    expect(r.ui.lastMove).toEqual({ type: "move", from: 0, to: 6 });
  });

  it("tap the selected piece again deselects it", () => {
    const r = tap(tap(MOVING(), 0).ui, 0);
    expect(r.kind).toBe("deselected");
    expect(r.ui.selected).toBeNull();
  });

  it("tap another own piece switches the selection", () => {
    const r = tap(tap(MOVING(), 0).ui, 5);
    expect(r.kind).toBe("selected");
    expect(r.ui.selected).toBe(5);
  });

  it("opponent pieces are inert and keep the selection", () => {
    const sel = tap(MOVING(), 0).ui;
    const r = tap(sel, 3);
    expect(r.kind).toBe("inert");
    expect(r.ui.selected).toBe(0);
  });

  it("an empty cell with nothing selected is inert", () => {
    expect(tap(MOVING(), 2).kind).toBe("inert");
  });
});

// ---- game over --------------------------------------------------------------
describe("game over", () => {
  it("a win during placement ends the game; further taps are inert", () => {
    // cyan 0,1,2 across the top — placement wins.
    const ui = tapAll(initialUi(createInitialState()), [0, 3, 1, 4, 2]);
    expect(ui.game.board[2]).toBe("cyan");
    expect(tap(ui, 5).kind).toBe("inert");
    expect(targetCells(ui).size).toBe(0);
    expect(selectableCells(ui.game).size).toBe(0);
  });

  it("a threefold-repetition draw ends the game via taps", () => {
    // Shuffle back and forth: each 4 moves return to the start position.
    let ui = MOVING();
    for (let i = 0; i < 2; i++) ui = tapAll(ui, [0, 2, 3, 6, 2, 0, 6, 3]);
    expect(status(ui.game)).toEqual({ kind: "draw" });
    expect(tap(ui, 0).kind).toBe("inert");
  });
});
