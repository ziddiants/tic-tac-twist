import { describe, it, expect } from "vitest";
import { applyMove, createInitialState, isGameOver, type GameState, type Move } from "../engine";
import {
  aiSide,
  firstPlayerForRound,
  hotSeatConfig,
  isAiTurn,
  nextRound,
  startSeries,
  type GameConfig,
} from "./series";

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
    const place = (to: number): Move => ({ type: "place", to });
    // cyan 0, mag 3, cyan 1, mag 4, cyan 2 -> cyan lines 0-1-2 and wins
    const won = [0, 3, 1, 4, 2].reduce<GameState>((s, to) => applyMove(s, place(to)), createInitialState());
    expect(isGameOver(won)).toBe(true);
    expect(won.turn).toBe("magenta"); // AI's side, but the game is finished
    expect(isAiTurn(c, won)).toBe(false);
  });
});
