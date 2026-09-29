import "./style.css";
import { aiMove } from "./ai";
import { createInitialState, isGameOver, otherPlayer } from "./engine";
import { applyChosenMove, tap } from "./ui/interaction";
import { applyTap, canUndo, newMatch, undo, type MatchState } from "./ui/session";
import {
  aiSide,
  firstPlayerForRound,
  isAiTurn,
  isTwistMoment,
  nextRound,
  recordOutcome,
  startSeries,
  type GameConfig,
  type SeriesState,
} from "./ui/series";
import { mountSetup } from "./ui/setup-view";
import { mountView, type RenderCtx, type View } from "./ui/view";

// TT-005: setup screen -> a series of games. In vs-AI the computer plays via aiMove; each
// new game (Play again / restart) hands the first move to the other side (FR-S3).

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  // A short beat before the computer moves, so its move reads as deliberate, not instant.
  const AI_DELAY_MS = 420;
  const AI_DELAY_REDUCED_MS = 140;

  let series: SeriesState | null = null;
  let match: MatchState | null = null;
  let view: View | null = null;
  let aiTimer: number | null = null;
  // Score is added once per game, the first time it renders as over (guarded so undo/re-render
  // can't double-count). The twist cue (FR-U6) shows once per series, first game only.
  let roundScored = false;
  let cueShown = false;
  // Game runtime: started when the board is dealt, frozen at the move that ends the game.
  let roundStartMs = 0;
  let roundElapsedMs: number | null = null;

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ctx(): RenderCtx {
    return {
      mode: series!.config.mode,
      aiSide: aiSide(series!.config),
      score: series!.score,
      elapsedMs: roundElapsedMs,
    };
  }

  /** Record a finished game into the running score + freeze its runtime, once per round. */
  function scoreIfOver(): void {
    if (roundScored || !series || !match || !isGameOver(match.ui.game)) return;
    series = recordOutcome(series, match.ui.game);
    roundElapsedMs = Date.now() - roundStartMs;
    roundScored = true;
  }

  /** Render the current match, then hand the turn to the computer if it's its move. */
  function draw(): void {
    scoreIfOver();
    view!.render(match!, ctx());
    scheduleAi();
  }

  /** After a committed move, flash the one-time twist cue at the place→move transition. */
  function maybeCue(prev: MatchState): void {
    if (cueShown || !series || !match || series.round !== 1) return;
    const move = match.ui.lastMove;
    if (move && match.ui.game !== prev.ui.game && isTwistMoment(move, match.ui.game, otherPlayer(match.ui.game.turn))) {
      cueShown = true;
      view!.showCue("The twist: once a side's 3 pieces are down, it stops placing — each turn it slides one piece to any empty cell.");
    }
  }

  function clearAiTimer(): void {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  }

  function scheduleAi(): void {
    clearAiTimer();
    if (!series || !match || !isAiTurn(series.config, match.ui.game)) return;
    aiTimer = window.setTimeout(runAi, reducedMotion() ? AI_DELAY_REDUCED_MS : AI_DELAY_MS);
  }

  function runAi(): void {
    aiTimer = null;
    if (!series || !match || !isAiTurn(series.config, match.ui.game)) return;
    const prev = match;
    const move = aiMove(match.ui.game, series.config.difficulty);
    match = applyTap(match, applyChosenMove(match.ui, move));
    draw();
    maybeCue(prev);
  }

  /** Start (or restart) the current round: a fresh board with this round's first player. */
  function startRound(): void {
    match = newMatch(createInitialState(firstPlayerForRound(series!.round)));
    roundScored = false; // a fresh board is unscored until it ends
    roundStartMs = Date.now();
    roundElapsedMs = null;
    draw();
  }

  function beginSeries(config: GameConfig): void {
    clearAiTimer();
    view?.destroy(); // stop any confetti still running before this view is replaced
    cueShown = false; // the twist cue is once per series
    series = startSeries(config);
    view = mountView(app!, {
      onTap(cell) {
        // Ignore taps while it's the computer's move (including the pre-move delay).
        if (!match || !series || isAiTurn(series.config, match.ui.game)) return;
        const result = tap(match.ui, cell);
        if (result.kind === "inert") {
          view!.nudge(cell);
          return;
        }
        const prev = match;
        match = applyTap(match, result);
        draw();
        if (result.kind === "moved") maybeCue(prev);
      },
      onUndo() {
        // Undo is a hot-seat control only; vs-AI hides it (taking back the AI's reply is murky).
        if (!match || series?.config.mode === "ai" || !canUndo(match)) return;
        match = undo(match);
        draw();
      },
      onRestart: startRound,
      onPlayAgain() {
        series = nextRound(series!); // next game swaps the first move to the other side
        startRound();
      },
      onMenu: toSetup,
    });
    startRound();
  }

  function toSetup(): void {
    clearAiTimer();
    view?.destroy(); // Menu from a win screen: stop the confetti before it rains onto setup
    series = null;
    match = null;
    view = null;
    delete document.body.dataset.over; // drop the end-screen page state behind the setup screen
    mountSetup(app!, { onStart: beginSeries });
  }

  toSetup();
}
