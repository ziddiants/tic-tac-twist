import "./style.css";
import { createInitialState } from "./engine";
import { tap } from "./ui/interaction";
import { applyTap, canUndo, newMatch, undo, type MatchState } from "./ui/session";
import { mountView } from "./ui/view";

// Hot-seat game (TT-004) + one undo per player and a step-set count (TT-004b).
// Setup, AI and Play again arrive in TT-005.

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  let match: MatchState = newMatch(createInitialState());

  const view = mountView(app, {
    onTap(cell) {
      const result = tap(match.ui, cell);
      if (result.kind === "inert") {
        view.nudge(cell);
        return;
      }
      match = applyTap(match, result);
      view.render(match);
    },
    onUndo() {
      if (!canUndo(match)) return;
      match = undo(match);
      view.render(match);
    },
    onRestart() {
      match = newMatch(createInitialState());
      view.render(match);
    },
  });

  view.render(match);
}
