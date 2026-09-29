import "./style.css";
import { aiMove } from "./ai";
import { createInitialState } from "./engine";
import { applyChosenMove, tap } from "./ui/interaction";
import { applyTap, canUndo, newMatch, undo, type MatchState } from "./ui/session";
import {
  aiSide,
  firstPlayerForRound,
  isAiTurn,
  nextRound,
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

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ctx(): RenderCtx {
    return { round: series!.round, mode: series!.config.mode, aiSide: aiSide(series!.config) };
  }

  /** Render the current match, then hand the turn to the computer if it's its move. */
  function draw(): void {
    view!.render(match!, ctx());
    scheduleAi();
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
    const move = aiMove(match.ui.game, series.config.difficulty);
    match = applyTap(match, applyChosenMove(match.ui, move));
    draw();
  }

  /** Start (or restart) the current round: a fresh board with this round's first player. */
  function startRound(): void {
    match = newMatch(createInitialState(firstPlayerForRound(series!.round)));
    draw();
  }

  function beginSeries(config: GameConfig): void {
    clearAiTimer();
    view?.destroy(); // stop any confetti still running before this view is replaced
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
        match = applyTap(match, result);
        draw();
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
