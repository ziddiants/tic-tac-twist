import { describe, it, expect } from "vitest";
import { applyMove, createInitialState, isGameOver, type GameState, type Move } from "../engine";
import {
  aiSide,
  firstPlayerForRound,
  hotSeatConfig,
  isAiTurn,
  isTwistMoment,
  nextRound,
  recordOutcome,
  startSeries,
  type GameConfig,
} from "./series";

const place = (to: number): Move => ({ type: "place", to });
const playAll = (moves: Move[], first: "cyan" | "magenta" = "cyan"): GameState =>
  moves.reduce<GameState>((s, m) => applyMove(s, m), createInitialState(first));

const aiConfig = (humanSide: "cyan" | "magenta" = "cyan"): GameConfig => ({
  mode: "ai",
  difficulty: "hard",
  humanSide,
});

describe("series rounds & starter alternation", () => {
  it("starts at round 1", () => {
    expect(startSeries(hotSeatConfig()).round).toBe(1);
  });

  it("nextRound increments the counter and keeps the config", () => {
    const s = startSeries(aiConfig("magenta"));
    const s2 = nextRound(s);
    expect(s2.round).toBe(2);
    expect(s2.config).toEqual(s.config);
    expect(nextRound(s2).round).toBe(3);
  });

  it("first move alternates: game 1 cyan, then magenta, then cyan (FR-S3)", () => {
    expect(firstPlayerForRound(1)).toBe("cyan"); // first player always moves first (FR-S1)
    expect(firstPlayerForRound(2)).toBe("magenta");
    expect(firstPlayerForRound(3)).toBe("cyan");
    expect(firstPlayerForRound(4)).toBe("magenta");
  });
});

describe("AI side & turn", () => {
  it("hot-seat has no AI side and is never an AI turn", () => {
    const c = hotSeatConfig();
    expect(aiSide(c)).toBeNull();
    expect(isAiTurn(c, createInitialState())).toBe(false);
  });

  it("the computer plays the side opposite the human", () => {
    expect(aiSide(aiConfig("cyan"))).toBe("magenta");
    expect(aiSide(aiConfig("magenta"))).toBe("cyan");
  });

  it("isAiTurn is true exactly when it's the computer's move", () => {
    const c = aiConfig("cyan"); // human cyan, AI magenta
    expect(isAiTurn(c, createInitialState("cyan"))).toBe(false); // human (cyan) to move
    expect(isAiTurn(c, createInitialState("magenta"))).toBe(true); // AI (magenta) to move
  });

  it("when the human picks magenta the AI (cyan) opens game 1", () => {
    const c = aiConfig("magenta"); // AI is cyan, and cyan starts round 1
    const game = createInitialState(firstPlayerForRound(1));
    expect(isAiTurn(c, game)).toBe(true);
  });

  it("no AI turn once the game is over", () => {
    const c = aiConfig("cyan"); // AI is magenta, whose turn it would be after cyan wins
    // cyan 0, mag 3, cyan 1, mag 4, cyan 2 -> cyan lines 0-1-2 and wins
    const won = playAll([0, 3, 1, 4, 2].map(place));
    expect(isGameOver(won)).toBe(true);
    expect(won.turn).toBe("magenta"); // AI's side, but the game is finished
    expect(isAiTurn(c, won)).toBe(false);
  });
});

describe("running score (OQ3)", () => {
  const cyanWin = playAll([0, 3, 1, 4, 2].map(place)); // cyan lines 0-1-2

  it("starts a series at 0 · 0, no draws", () => {
    expect(startSeries(hotSeatConfig()).score).toEqual({ cyan: 0, magenta: 0, draws: 0 });
  });

  it("credits the winner and leaves the loser and draws untouched", () => {
    const s = recordOutcome(startSeries(hotSeatConfig()), cyanWin);
    expect(s.score).toEqual({ cyan: 1, magenta: 0, draws: 0 });
  });

  it("counts a draw without crediting either side", () => {
    // Build a shuffle-to-repetition draw: place cyan {0,5,7} / magenta {1,3,8}, then cycle ×2.
    const placements = [0, 1, 5, 3, 7, 8].map(place);
    const cycle: Move[] = [
      { type: "move", from: 0, to: 2 },
      { type: "move", from: 1, to: 4 },
      { type: "move", from: 2, to: 0 },
      { type: "move", from: 4, to: 1 },
    ];
    const drawn = playAll([...placements, ...cycle, ...cycle]);
    expect(isGameOver(drawn)).toBe(true);
    const s = recordOutcome(startSeries(hotSeatConfig()), drawn);
    expect(s.score).toEqual({ cyan: 0, magenta: 0, draws: 1 });
  });

  it("leaves the score untouched while the game is still in progress", () => {
    const s0 = startSeries(hotSeatConfig());
    expect(recordOutcome(s0, createInitialState())).toBe(s0);
  });

  it("accumulates across games (nextRound preserves the score)", () => {
    let s = startSeries(hotSeatConfig());
    s = recordOutcome(s, cyanWin);
    s = nextRound(s);
    s = recordOutcome(s, cyanWin);
    expect(s.score).toEqual({ cyan: 2, magenta: 0, draws: 0 });
    expect(s.round).toBe(2);
  });
});

describe("twist onboarding moment (FR-U6)", () => {
  it("fires on the placement that fills a side's tray (place→move transition)", () => {
    // cyan {0,1,5}, magenta {3,4}: after cyan's 3rd placement cyan must now move, game live.
    const seq = [0, 3, 1, 4, 5].map(place);
    const after = playAll(seq);
    expect(isGameOver(after)).toBe(false);
    expect(after.turn).toBe("magenta"); // cyan just moved
    expect(isTwistMoment(place(5), after, "cyan")).toBe(true);
  });

  it("does not fire on an earlier placement (tray not yet full)", () => {
    const after = playAll([0, 3, 1].map(place)); // cyan has 2 pieces
    expect(isTwistMoment(place(1), after, "cyan")).toBe(false);
  });

  it("does not fire on a movement-phase move", () => {
    const after = playAll([0, 3, 1, 4, 5, 8].map(place)); // both sides fully placed
    const moved = applyMove(after, { type: "move", from: 0, to: 2 });
    expect(isTwistMoment({ type: "move", from: 0, to: 2 }, moved, "cyan")).toBe(false);
  });

  it("does not fire when the filling placement also wins the game", () => {
    // cyan 0, mag 3, cyan 1, mag 4, cyan 2 -> cyan's 3rd placement is a winning line.
    const won = playAll([0, 3, 1, 4, 2].map(place));
    expect(isGameOver(won)).toBe(true);
    expect(isTwistMoment(place(2), won, "cyan")).toBe(false);
  });
});
