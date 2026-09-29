/**
 * The DOM view — draws a `UiState` and reports taps. Holds no game state of its own:
 * everything shown is re-derived from the state passed to `render`.
 */
import {
  BOARD_SIZE,
  PIECES_PER_PLAYER,
  phaseOf,
  pieceCount,
  status,
  winningLine,
  type Player,
} from "../engine";
import { launchConfetti } from "./confetti";
import { endEffect, selectableCells, targetCells, type UiState } from "./interaction";
import { canUndo, lastMover, stepSets, type MatchState } from "./session";
import type { GameMode } from "./series";

/** Extra display context for a render, beyond the live game/undo state. */
export interface RenderCtx {
  readonly mode: GameMode;
  /** The side the computer plays (vs-AI), else null — drives the "thinking" label. */
  readonly aiSide: Player | null;
}

const NAME: Record<Player, string> = { cyan: "Cyan", magenta: "Magenta" };
/** Confetti in the winner's colour, with lighter tints and white for sparkle. */
const CONFETTI: Record<Player, readonly string[]> = {
  cyan: ["#2de2ff", "#2de2ff", "#8ff1ff", "#d8fbff", "#ffffff"],
  magenta: ["#ff4fb2", "#ff4fb2", "#ff8fcd", "#ffd6ec", "#ffffff"],
};

export interface View {
  render(match: MatchState, ctx: RenderCtx): void;
  /** Brief shake on a cell whose tap did nothing. */
  nudge(cell: number): void;
  /** Tear down before the view is discarded: stop any confetti (its canvas lives on
   *  document.body, so replacing the root won't remove it) and clear the echo. */
  destroy(): void;
}

export function mountView(
  root: HTMLElement,
  handlers: {
    onTap(cell: number): void;
    onUndo(): void;
    onRestart(): void;
    onPlayAgain(): void;
    onMenu(): void;
  },
): View {
  root.innerHTML = `
    <div class="wash" aria-hidden="true">
      <div class="wash__layer wash__layer--magenta"></div>
      <div class="wash__layer wash__layer--cyan"></div>
    </div>
    <main class="game">
      <header class="top">
        <div class="wordmark">TIC<span class="b">·</span>TAC<span class="b">·</span>TWIST</div>
        <p class="status" aria-live="polite"></p>
        <p class="status-sub"></p>
      </header>
      ${tray("magenta")}
      <div class="board-wrap">
        <div class="echo" aria-hidden="true"></div>
        <div class="board" role="group" aria-label="Board">
          ${Array.from({ length: BOARD_SIZE }, (_, i) => `<button class="cell" type="button" data-cell="${i}"></button>`).join("")}
        </div>
      </div>
      ${tray("cyan")}
      <footer class="bottom">
        <p class="stepcount" aria-live="polite"></p>
        <div class="bottom__actions">
          <button class="btn btn--ghost" type="button" data-action="undo">↺ Undo</button>
          <button class="btn" type="button" data-action="restart">Restart</button>
          <button class="btn" type="button" data-action="playagain">Play again</button>
          <button class="btn btn--ghost" type="button" data-action="menu">Menu</button>
        </div>
      </footer>
    </main>
  `;

  const body = document.body;
  const statusEl = root.querySelector<HTMLElement>(".status")!;
  const subEl = root.querySelector<HTMLElement>(".status-sub")!;
  const boardEl = root.querySelector<HTMLElement>(".board")!;
  const echoEl = root.querySelector<HTMLElement>(".echo")!;
  const stepcountEl = root.querySelector<HTMLElement>(".stepcount")!;
  const undoBtn = root.querySelector<HTMLButtonElement>('[data-action="undo"]')!;
  const cells = [...root.querySelectorAll<HTMLButtonElement>(".cell")];
  const trays: Record<Player, HTMLElement> = {
    cyan: root.querySelector<HTMLElement>(".tray--cyan")!,
    magenta: root.querySelector<HTMLElement>(".tray--magenta")!,
  };
  const undoBadges: Record<Player, HTMLElement> = {
    cyan: trays.cyan.querySelector<HTMLElement>(".tray__undo")!,
    magenta: trays.magenta.querySelector<HTMLElement>(".tray__undo")!,
  };

  boardEl.addEventListener("click", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".cell");
    if (cell) handlers.onTap(Number(cell.dataset.cell));
  });
  undoBtn.addEventListener("click", handlers.onUndo);
  root.querySelector('[data-action="restart"]')!.addEventListener("click", handlers.onRestart);
  root.querySelector('[data-action="playagain"]')!.addEventListener("click", handlers.onPlayAgain);
  root.querySelector('[data-action="menu"]')!.addEventListener("click", handlers.onMenu);

  let shown: MatchState | null = null;
  let stopConfetti: (() => void) | null = null;

  function render(match: MatchState, ctx: RenderCtx): void {
    const ui = match.ui;
    const { board, turn } = ui.game;
    const st = status(ui.game);
    const line = new Set<number>(winningLine(board) ?? []);
    const selectable = selectableCells(ui.game);
    const targets = targetCells(ui);

    // Turn wash + end state drive the page colour. Mode hides undo in vs-AI (CSS).
    body.dataset.turn = st.kind === "playing" ? turn : st.kind === "win" ? st.player : "draw";
    body.dataset.over = String(st.kind !== "playing");
    body.dataset.mode = ctx.mode;

    statusEl.classList.toggle("status--declare", st.kind !== "playing");
    statusEl.textContent = statusText(ui, ctx.aiSide);
    subEl.textContent = st.kind === "draw" ? "Position repeated 3 times" : "";

    // Whose take-back is live right now: the last mover, and only while it is legal. Both
    // the Undo button and one tray pill wear that player's colour so the pairing is obvious.
    const mover = lastMover(match);
    const armed = canUndo(match);

    for (const p of ["cyan", "magenta"] as const) {
      const left = PIECES_PER_PLAYER - pieceCount(board, p);
      const t = trays[p];
      t.classList.toggle("tray--active", st.kind === "playing" && turn === p);
      t.querySelectorAll(".tray__disc").forEach((d, i) => d.classList.toggle("is-spent", i >= left));
      // Once the game is over the trays have nothing to say ("moving" would invite a tap).
      t.querySelector(".tray__label")!.textContent =
        st.kind !== "playing" ? "" : left > 0 ? `${left} left` : "moving";
      // Each player's remaining undo (1 -> 0); the pill lights up in their colour while
      // their take-back is the one that is actionable this instant.
      const undosLeft = match.undosLeft[p];
      const badge = undoBadges[p];
      badge.textContent = `↺ ${undosLeft}`;
      badge.classList.toggle("is-spent", undosLeft === 0);
      badge.classList.toggle("is-armed", armed && mover === p);
      badge.setAttribute("aria-label", `${NAME[p]} undo remaining, ${undosLeft}`);
    }

    // Undo button: enabled only while a take-back is legal (see session.canUndo). When armed
    // it takes the last mover's colour — note that is the opposite side to the turn wash. The
    // remaining-count lives on the tray pills, so the button label stays a plain "↺ Undo"
    // (a "· N" suffix wrapped to three lines on a narrow phone).
    undoBtn.disabled = !armed;
    if (armed && mover) undoBtn.dataset.arm = mover;
    else delete undoBtn.dataset.arm;

    // Step-set count belongs to the end screen only (right above Play again).
    if (st.kind === "playing") {
      stepcountEl.textContent = "";
    } else {
      const n = stepSets(ui.game);
      stepcountEl.textContent = `${n} step set${n === 1 ? "" : "s"}`;
    }

    cells.forEach((el, i) => {
      const piece = board[i];
      const had = shown?.ui.game.board[i] ?? null;
      if (shown === null || piece !== had) {
        el.replaceChildren();
        if (piece) {
          const disc = document.createElement("span");
          disc.className = `disc disc--${piece}`;
          el.append(disc);
        }
      }
      el.classList.toggle("cell--selectable", selectable.has(i));
      el.classList.toggle("cell--selected", ui.selected === i);
      // Placement cells are simply tappable; pulsing targets only show for a picked-up piece.
      el.classList.toggle("cell--open", ui.selected === null && targets.has(i));
      el.classList.toggle("cell--target", ui.selected !== null && targets.has(i));
      el.classList.toggle("cell--win", line.has(i));
      el.classList.toggle("cell--dim", st.kind === "win" && piece !== null && !line.has(i));
      el.disabled = st.kind !== "playing";
      el.setAttribute("aria-label", cellLabel(i, piece, ui.selected === i, targets.has(i)));
    });

    if (shown && ui.lastMove && ui.game !== shown.ui.game) animate(ui);

    const effect = endEffect(shown?.ui.game ?? null, ui.game);
    if (effect === "confetti" && st.kind === "win") {
      stopConfetti = launchConfetti(CONFETTI[st.player], { reduced: reducedMotion() });
    } else if (effect === "echo") {
      echo();
    } else if (effect === "clear") {
      stopConfetti?.();
      stopConfetti = null;
      echoEl.replaceChildren();
    }
    shown = match;
  }

  /** Pop in a placed piece; slide a moved one from its old cell (FLIP). */
  function animate(ui: UiState): void {
    const move = ui.lastMove!;
    const disc = cells[move.to].querySelector<HTMLElement>(".disc");
    if (!disc || reducedMotion()) return;
    if (move.type === "place") {
      disc.classList.add("disc--pop");
      return;
    }
    const from = cells[move.from].getBoundingClientRect();
    const to = cells[move.to].getBoundingClientRect();
    disc.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
    disc.getBoundingClientRect(); // commit the start position before transitioning
    disc.classList.add("disc--slide");
    disc.style.transform = "";
  }

  /**
   * Draw: 3 board-shaped rings ripple out, cyan · magenta · cyan — one per repetition —
   * and repeat until Restart so the moment can't be missed.
   */
  function echo(): void {
    echoEl.replaceChildren();
    if (reducedMotion()) return; // reduced motion: the still dual glow is the whole effect
    (["cyan", "magenta", "cyan"] as const).forEach((p, i) => {
      const ring = document.createElement("span");
      ring.className = `echo__ring echo__ring--${p}`;
      ring.style.animationDelay = `${i * 400}ms`;
      echoEl.append(ring);
    });
  }

  function nudge(cell: number): void {
    if (reducedMotion()) return;
    const el = cells[cell];
    el.classList.remove("cell--nudge");
    void el.offsetWidth; // restart the animation if it is already running
    el.classList.add("cell--nudge");
  }

  function destroy(): void {
    stopConfetti?.();
    stopConfetti = null;
    echoEl.replaceChildren();
  }

  return { render, nudge, destroy };
}

function tray(p: Player): string {
  return `
    <section class="tray tray--${p}" aria-label="${NAME[p]} pieces">
      <span class="tray__discs">${`<span class="tray__disc disc disc--${p}"></span>`.repeat(PIECES_PER_PLAYER)}</span>
      <span class="tray__label"></span>
      <span class="tray__undo"></span>
    </section>`;
}

function statusText(ui: UiState, aiSide: Player | null): string {
  const st = status(ui.game);
  if (st.kind === "win") return `${NAME[st.player]} wins`;
  if (st.kind === "draw") return "Draw";
  const p = ui.game.turn;
  // Vs-AI: while it is the computer's move the human has nothing to do but watch.
  if (p === aiSide) return `${NAME[p]} is thinking…`;
  if (phaseOf(ui.game.board, p) === "placement") {
    const left = PIECES_PER_PLAYER - pieceCount(ui.game.board, p);
    return `${NAME[p]} · place a piece (${left} left)`;
  }
  return ui.selected === null ? `${NAME[p]} · pick a piece to move` : `${NAME[p]} · tap where to move it`;
}

function cellLabel(i: number, piece: Player | null, selected: boolean, target: boolean): string {
  const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
  const what = piece ? `${NAME[piece]} piece${selected ? ", selected" : ""}` : "empty";
  return `${where}: ${what}${target ? ", available" : ""}`;
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
