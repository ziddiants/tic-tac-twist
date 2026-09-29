/**
 * Series — the multi-game layer above a single game's `MatchState` (see session.ts).
 *
 * A *series* is what a setup choice starts: a run of games sharing one configuration
 * (hot-seat or vs-AI), with a round counter that "Play again" advances. It owns nothing
 * about the live board — only who starts each round and, in vs-AI, which side the computer
 * plays. DOM-free so the round/starter/AI-turn rules are unit-tested without a browser.
 */
import { isGameOver, otherPlayer, type GameState, type Player } from "../engine";
import type { Difficulty } from "../ai";

export type GameMode = "hotseat" | "ai";

/**
 * The setup choices for a series. `difficulty` and `humanSide` are meaningful only in
 * `ai` mode; hot-seat carries harmless defaults for them.
 */
export interface GameConfig {
  readonly mode: GameMode;
  readonly difficulty: Difficulty;
  /** The side the human controls (vs-AI only); the computer plays the other side. */
  readonly humanSide: Player;
}

export interface SeriesState {
  readonly config: GameConfig;
  /** 1-indexed; incremented by `nextRound`. Drives who starts (see firstPlayerForRound). */
  readonly round: number;
}

/** A hot-seat series (defaults fill the AI-only fields, which hot-seat never reads). */
export function hotSeatConfig(): GameConfig {
  return { mode: "hotseat", difficulty: "medium", humanSide: "cyan" };
}

export function startSeries(config: GameConfig): SeriesState {
  return { config, round: 1 };
}

/** Advance to the next game: round + 1 (the starter alternates, see firstPlayerForRound). */
export function nextRound(series: SeriesState): SeriesState {
  return { ...series, round: series.round + 1 };
}

/**
 * Who moves first in a given round. Game 1 is always cyan (the first player always moves
 * first, FR-S1); each new game hands the first move to the other side (FR-S3, plain
 * alternate): cyan, magenta, cyan, …
 */
export function firstPlayerForRound(round: number): Player {
  return round % 2 === 1 ? "cyan" : "magenta";
}

/** The side the computer plays, or null in hot-seat. */
export function aiSide(config: GameConfig): Player | null {
  return config.mode === "ai" ? otherPlayer(config.humanSide) : null;
}

/** True when the computer should move now: vs-AI, game still live, and it's the AI's turn. */
export function isAiTurn(config: GameConfig, game: GameState): boolean {
  return !isGameOver(game) && game.turn === aiSide(config);
}
