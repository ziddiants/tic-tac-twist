/**
 * Series — the multi-game layer above a single game's `MatchState` (see session.ts).
 *
 * A *series* is what a setup choice starts: a run of games sharing one configuration
 * (hot-seat or vs-AI), with a round counter that "Play again" advances. It owns nothing
 * about the live board — only who starts each round and, in vs-AI, which side the computer
 * plays. DOM-free so the round/starter/AI-turn rules are unit-tested without a browser.
 */
import {
  PIECES_PER_PLAYER,
  isGameOver,
  otherPlayer,
  pieceCount,
  status,
  type GameState,
  type Move,
  type Player,
} from "../engine";
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

/** Running tally across a series' games (OQ3: the win screen shows a running score). */
export interface Score {
  readonly cyan: number;
  readonly magenta: number;
  readonly draws: number;
}

export interface SeriesState {
  readonly config: GameConfig;
  /** 1-indexed; incremented by `nextRound`. Drives who starts (see firstPlayerForRound). */
  readonly round: number;
  /** Wins per side + draws, accumulated across the series by `recordOutcome`. */
  readonly score: Score;
}

/** A hot-seat series (defaults fill the AI-only fields, which hot-seat never reads). */
export function hotSeatConfig(): GameConfig {
  return { mode: "hotseat", difficulty: "medium", humanSide: "cyan" };
}

export function startSeries(config: GameConfig): SeriesState {
  return { config, round: 1, score: { cyan: 0, magenta: 0, draws: 0 } };
}

/** Advance to the next game: round + 1 (the starter alternates, see firstPlayerForRound). */
export function nextRound(series: SeriesState): SeriesState {
  return { ...series, round: series.round + 1 };
}

/**
 * Fold a finished game's result into the running score: +1 to the winner, or +1 draw.
 * A game still in progress leaves the score untouched, so the caller can call this on any
 * state; it must call it exactly once per finished game (main.ts guards with a per-round flag).
 */
export function recordOutcome(series: SeriesState, game: GameState): SeriesState {
  const st = status(game);
  if (st.kind === "playing") return series;
  const score =
    st.kind === "win"
      ? { ...series.score, [st.player]: series.score[st.player] + 1 }
      : { ...series.score, draws: series.score.draws + 1 };
  return { ...series, score };
}

/**
 * Twist onboarding (FR-U6): the teaching moment is the place→move transition — the first time
 * a side has placed all its pieces and must now start moving them. Fires on the placement that
 * fills a side's tray and does not itself end the game. Round/once-only guarding is the caller's.
 */
export function isTwistMoment(move: Move, gameAfter: GameState, mover: Player): boolean {
  return (
    move.type === "place" &&
    !isGameOver(gameAfter) &&
    pieceCount(gameAfter.board, mover) === PIECES_PER_PLAYER
  );
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
