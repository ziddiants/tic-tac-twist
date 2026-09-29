import "./style.css";
import { createInitialState } from "./engine";
import { initialUi, tap, type UiState } from "./ui/interaction";
import { mountView } from "./ui/view";

// Hot-seat game (TT-004). Setup, AI and Play again arrive in TT-005.

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  let ui: UiState = initialUi(createInitialState());

  const view = mountView(app, {
    onTap(cell) {
      const result = tap(ui, cell);
      if (result.kind === "inert") {
        view.nudge(cell);
        return;
      }
      ui = result.ui;
      view.render(ui);
    },
    onRestart() {
      ui = initialUi(createInitialState());
      view.render(ui);
    },
  });

  view.render(ui);
}
