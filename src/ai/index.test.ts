import { describe, it, expect } from "vitest";
import {
  applyMove,
  createInitialState,
  isGameOver,
  legalMoves,
  positionKey,
  status,
  type Board,
  type Cell,
  type GameState,
  type Move,
  type Player,
  type Status,
} from "../engine";
import { aiMove, bestMove, gameValue, solutionSize, type Difficulty } from "./index";

// ---- helpers ----------------------------------------------------------------
function makeState(cyan: number[], magenta: number[], turn: Player): GameState {
  const b: Cell[] = new Array<Cell>(9).fill(null);
  for (const i of cyan) b[i] = "cyan";
  for (const i of magenta) b[i] = "magenta";
  const board: Board = b;
  return { board, turn, history: [positionKey(board, turn)] };
}
/** Deterministic RNG so AI tie-breaks are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function playGame(dCyan: Difficulty, dMag: Difficulty, rng: () => number): Status {
  let s = createInitialState("cyan");
  let guard = 0;
  while (!isGameOver(s)) {
    const m = aiMove(s, s.turn === "cyan" ? dCyan : dMag, rng);
    s = applyMove(s, m);
    if (++guard > 500) throw new Error("game did not terminate");
  }
  return status(s);
}
function isLegal(state: GameState, move: Move): boolean {
  return legalMoves(state).some(
    (m) =>
      (m.type === "place" && move.type === "place" && m.to === move.to) ||
      (m.type === "move" && move.type === "move" && m.from === move.from && m.to === move.to),
  );
}

// ---- solver correctness (matches docs/research/solver.py) --------------------
describe("solver matches the Python reference", () => {
  it("values the opening position as a draw (free movement = draw)", () => {
    expect(gameValue(createInitialState())).toBe(0);
  });

  it("reaches the same number of positions as the Python solver (4974)", () => {
    expect(solutionSize()).toBe(4974);
  });
});

// ---- AI plays optimally -----------------------------------------------------
describe("hard AI is perfect", () => {
  it("takes an immediate winning move", () => {
    // cyan{0,1,5} vs magenta{3,4,8}, cyan to move: sliding 5->2 completes the top row
    const s = makeState([0, 1, 5], [3, 4, 8], "cyan");
    const m = bestMove(s, mulberry32(1));
    expect(status(applyMove(s, m))).toEqual({ kind: "win", player: "cyan" });
  });

  it("hard vs hard is always a draw and terminates", () => {
    for (const seed of [1, 7, 42]) {
      expect(playGame("hard", "hard", mulberry32(seed))).toEqual({ kind: "draw" });
    }
  });

  it("hard never loses against a random (easy) opponent, on either side", () => {
    for (let seed = 1; seed <= 12; seed++) {
      // hard as cyan -> magenta must never win
      const asCyan = playGame("hard", "easy", mulberry32(seed));
      expect(asCyan).not.toEqual({ kind: "win", player: "magenta" });
      // hard as magenta -> cyan must never win
      const asMag = playGame("easy", "hard", mulberry32(seed + 100));
      expect(asMag).not.toEqual({ kind: "win", player: "cyan" });
    }
  });
});

// ---- difficulty tiers return legal moves ------------------------------------
describe("aiMove returns a legal move at every difficulty", () => {
  it("easy / medium / hard all produce legal moves from the opening", () => {
    const s = createInitialState();
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      const m = aiMove(s, d, mulberry32(3));
      expect(isLegal(s, m)).toBe(true);
    }
  });

  it("throws when asked to move in a finished game", () => {
    const won = makeState([0, 1, 2], [3, 4], "magenta"); // cyan already has a line
    expect(() => aiMove(won, "hard", mulberry32(1))).toThrow();
  });
});
