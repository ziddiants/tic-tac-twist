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
import { selectableCells, targetCells, type UiState } from "./interaction";

const NAME: Record<Player, string> = { cyan: "Cyan", magenta: "Magenta" };
/** Confetti in the winner's colour, with lighter tints and white for sparkle. */
const CONFETTI: Record<Player, readonly string[]> = {
  cyan: ["#2de2ff", "#2de2ff", "#8ff1ff", "#d8fbff", "#ffffff"],
  magenta: ["#ff4fb2", "#ff4fb2", "#ff8fcd", "#ffd6ec", "#ffffff"],
};

export interface View {
  render(ui: UiState): void;
  /** Brief shake on a cell whose tap did nothing. */
  nudge(cell: number): void;
}

export function mountView(
  root: HTMLElement,
  handlers: { onTap(cell: number): void; onRestart(): void },
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
      <div class="board" role="group" aria-label="Board">
        ${Array.from({ length: BOARD_SIZE }, (_, i) => `<button class="cell" type="button" data-cell="${i}"></button>`).join("")}
      </div>
      ${tray("cyan")}
      <footer class="bottom">
        <button class="btn" type="button" data-action="restart">Restart</button>
      </footer>
    </main>
  `;

  const body = document.body;
  const statusEl = root.querySelector<HTMLElement>(".status")!;
  const subEl = root.querySelector<HTMLElement>(".status-sub")!;
  const boardEl = root.querySelector<HTMLElement>(".board")!;
  const cells = [...root.querySelectorAll<HTMLButtonElement>(".cell")];
  const trays: Record<Player, HTMLElement> = {
    cyan: root.querySelector<HTMLElement>(".tray--cyan")!,
    magenta: root.querySelector<HTMLElement>(".tray--magenta")!,
  };

  boardEl.addEventListener("click", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".cell");
    if (cell) handlers.onTap(Number(cell.dataset.cell));
  });
  root.querySelector('[data-action="restart"]')!.addEventListener("click", handlers.onRestart);

  let shown: UiState | null = null;
  let stopConfetti: (() => void) | null = null;

  function render(ui: UiState): void {
    const { board, turn } = ui.game;
    const st = status(ui.game);
    const line = new Set<number>(winningLine(board) ?? []);
    const selectable = selectableCells(ui.game);
    const targets = targetCells(ui);

    // Turn wash + end state drive the page colour.
    body.dataset.turn = st.kind === "playing" ? turn : st.kind === "win" ? st.player : "draw";
    body.dataset.over = String(st.kind !== "playing");

    statusEl.classList.toggle("status--declare", st.kind !== "playing");
    statusEl.textContent = statusText(ui);
    subEl.textContent = st.kind === "draw" ? "Position repeated 3 times" : "";

    for (const p of ["cyan", "magenta"] as const) {
      const left = PIECES_PER_PLAYER - pieceCount(board, p);
      const t = trays[p];
      t.classList.toggle("tray--active", st.kind === "playing" && turn === p);
      t.querySelectorAll(".tray__disc").forEach((d, i) => d.classList.toggle("is-spent", i >= left));
      t.querySelector(".tray__label")!.textContent = left > 0 ? `${left} left` : "moving";
    }

    cells.forEach((el, i) => {
      const piece = board[i];
      const had = shown?.game.board[i] ?? null;
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

    if (shown && ui.lastMove && ui.game !== shown.game) animate(ui);

    // Confetti only on the move that wins — never on re-render or restart.
    const wasPlaying = shown !== null && status(shown.game).kind === "playing";
    if (st.kind === "win" && wasPlaying) {
      stopConfetti?.();
      stopConfetti = launchConfetti(CONFETTI[st.player], { reduced: reducedMotion() });
    } else if (st.kind === "playing") {
      stopConfetti?.();
      stopConfetti = null;
    }
    shown = ui;
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

  function nudge(cell: number): void {
    if (reducedMotion()) return;
    const el = cells[cell];
    el.classList.remove("cell--nudge");
    void el.offsetWidth; // restart the animation if it is already running
    el.classList.add("cell--nudge");
  }

  return { render, nudge };
}

function tray(p: Player): string {
  return `
    <section class="tray tray--${p}" aria-label="${NAME[p]} pieces">
      <span class="tray__discs">${`<span class="tray__disc disc disc--${p}"></span>`.repeat(PIECES_PER_PLAYER)}</span>
      <span class="tray__label"></span>
    </section>`;
}

function statusText(ui: UiState): string {
  const st = status(ui.game);
  if (st.kind === "win") return `${NAME[st.player]} wins`;
  if (st.kind === "draw") return "Draw";
  const p = ui.game.turn;
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
