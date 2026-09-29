import { describe, it, expect } from "vitest";
import {
  applyMove,
  createInitialState,
  emptyCells,
  isGameOver,
  legalMoves,
  phaseOf,
  pieceCount,
  positionKey,
  status,
  winner,
  winningLine,
  type Board,
  type Cell,
  type GameState,
  type Move,
  type Player,
} from "./index";

// ---- test helpers -----------------------------------------------------------
function makeBoard(cyan: number[], magenta: number[]): Board {
  const b: Cell[] = new Array<Cell>(9).fill(null);
  for (const i of cyan) b[i] = "cyan";
  for (const i of magenta) b[i] = "magenta";
  return b;
}
/** Build a state directly from piece positions (bypasses game flow, for unit tests). */
function makeState(cyan: number[], magenta: number[], turn: Player): GameState {
  const board = makeBoard(cyan, magenta);
  return { board, turn, history: [positionKey(board, turn)] };
}
function applyAll(state: GameState, moves: Move[]): GameState {
  return moves.reduce((s, m) => applyMove(s, m), state);
}

// ---- initial state ----------------------------------------------------------
describe("initial state", () => {
  it("starts with an empty board, cyan to move, both in placement", () => {
    const s = createInitialState();
    expect(s.turn).toBe("cyan");
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(phaseOf(s.board, "cyan")).toBe("placement");
    expect(status(s).kind).toBe("playing");
  });

  it("offers 9 placement moves and nothing else", () => {
    const s = createInitialState();
    const moves = legalMoves(s);
    expect(moves).toHaveLength(9);
    expect(moves.every((m) => m.type === "place")).toBe(true);
  });
});

// ---- placement --------------------------------------------------------------
describe("placement phase", () => {
  it("places a piece, switches the turn, and is immutable", () => {
    const s0 = createInitialState();
    const s1 = applyMove(s0, { type: "place", to: 4 });
    expect(s1.board[4]).toBe("cyan");
    expect(s1.turn).toBe("magenta");
    expect(pieceCount(s1.board, "cyan")).toBe(1);
    // s0 is untouched
    expect(s0.board[4]).toBeNull();
    expect(s0.turn).toBe("cyan");
  });

  it("switches a player to movement once their 3rd piece is down", () => {
    // c0, m3, c1, m4, c6, m8  -> both have 3 pieces, cyan to move, no line
    const s = applyAll(createInitialState(), [
      { type: "place", to: 0 },
      { type: "place", to: 3 },
      { type: "place", to: 1 },
      { type: "place", to: 4 },
      { type: "place", to: 6 },
      { type: "place", to: 8 },
    ]);
    expect(s.turn).toBe("cyan");
    expect(phaseOf(s.board, "cyan")).toBe("movement");
    const moves = legalMoves(s);
    expect(moves.every((m) => m.type === "move")).toBe(true);
    // 3 pieces × 3 empty cells = 9 moves
    expect(moves).toHaveLength(9);
  });
});

// ---- winning ----------------------------------------------------------------
describe("winning", () => {
  it("detects a win formed during the placement phase", () => {
    // c0, m3, c1, m4, c2 -> cyan completes the top row on their 3rd placement
    const s = applyAll(createInitialState(), [
      { type: "place", to: 0 },
      { type: "place", to: 3 },
      { type: "place", to: 1 },
      { type: "place", to: 4 },
      { type: "place", to: 2 },
    ]);
    expect(status(s)).toEqual({ kind: "win", player: "cyan" });
    expect(winner(s.board)).toBe("cyan");
    expect(winningLine(s.board)).toEqual([0, 1, 2]);
  });

  it("has no winning line while no line is complete", () => {
    expect(winningLine(makeBoard([0, 1], [3, 4]))).toBeNull();
  });

  it("detects a win formed during the movement phase", () => {
    // cyan{0,1,5} magenta{3,4,8}, cyan to move; slide 5->2 to complete the top row
    const s = makeState([0, 1, 5], [3, 4, 8], "cyan");
    expect(status(s).kind).toBe("playing");
    const won = applyMove(s, { type: "move", from: 5, to: 2 });
    expect(status(won)).toEqual({ kind: "win", player: "cyan" });
  });

  it("no legal moves once the game is won", () => {
    const s = makeState([0, 1, 2], [3, 4], "magenta"); // cyan already has a line
    expect(isGameOver(s)).toBe(true);
    expect(legalMoves(s)).toHaveLength(0);
  });
});

// ---- win takes priority over draw ------------------------------------------
describe("win-before-draw precedence", () => {
  it("reports a win even when the position has repeated 3 times", () => {
    const board = makeBoard([0, 1, 2], [3, 4]); // cyan line present
    const key = positionKey(board, "magenta");
    const s: GameState = { board, turn: "magenta", history: [key, key, key] };
    expect(status(s)).toEqual({ kind: "win", player: "cyan" });
  });
});

// ---- draw by threefold repetition ------------------------------------------
describe("draw by threefold repetition", () => {
  it("declares a draw on the 3rd occurrence of a position, not before", () => {
    // A non-winning 6-piece position the two players can shuffle in and out of.
    const start = makeState([0, 5, 7], [1, 3, 8], "cyan"); // occurrence #1
    const cycle: Move[] = [
      { type: "move", from: 0, to: 2 }, // cyan
      { type: "move", from: 1, to: 4 }, // magenta
      { type: "move", from: 2, to: 0 }, // cyan
      { type: "move", from: 4, to: 1 }, // magenta -> back to start, occurrence #2
    ];

    const afterOne = applyAll(start, cycle);
    expect(positionKey(afterOne.board, afterOne.turn)).toBe(
      positionKey(start.board, start.turn),
    );
    expect(status(afterOne).kind).toBe("playing"); // 2 occurrences, not yet a draw

    const afterTwo = applyAll(afterOne, cycle); // occurrence #3
    expect(status(afterTwo)).toEqual({ kind: "draw" });
  });
});

// ---- illegal moves are rejected --------------------------------------------
describe("illegal moves throw", () => {
  it("rejects placing on an occupied cell", () => {
    const s = applyMove(createInitialState(), { type: "place", to: 0 }); // now magenta
    expect(() => applyMove(s, { type: "place", to: 0 })).toThrow();
  });

  it("rejects moving an opponent's piece", () => {
    const s = makeState([0, 5, 7], [1, 3, 8], "cyan");
    expect(() => applyMove(s, { type: "move", from: 1, to: 2 })).toThrow(); // 1 is magenta
  });

  it("rejects moving onto an occupied cell", () => {
    const s = makeState([0, 5, 7], [1, 3, 8], "cyan");
    expect(() => applyMove(s, { type: "move", from: 0, to: 5 })).toThrow(); // 5 is cyan
  });

  it("rejects placing while in the movement phase", () => {
    const s = makeState([0, 5, 7], [1, 3, 8], "cyan"); // cyan has 3 pieces
    expect(() => applyMove(s, { type: "place", to: 2 })).toThrow();
  });

  it("rejects any move after the game is over", () => {
    const won = makeState([0, 1, 2], [3, 4], "magenta");
    expect(() => applyMove(won, { type: "place", to: 5 })).toThrow();
  });
});

// ---- invariant: a legal move always exists while playing --------------------
describe("no stalemate", () => {
  it("always offers at least one legal move in any non-terminal state", () => {
    const states: GameState[] = [
      createInitialState(),
      makeState([0, 5, 7], [1, 3, 8], "cyan"), // movement, cyan
      makeState([0, 5, 7], [1, 3, 8], "magenta"), // movement, magenta
      applyMove(createInitialState(), { type: "place", to: 4 }), // mid-placement
    ];
    for (const s of states) {
      expect(isGameOver(s)).toBe(false);
      expect(legalMoves(s).length).toBeGreaterThan(0);
      expect(emptyCells(s.board).length).toBeGreaterThanOrEqual(3);
    }
  });
});
