/**
 * Setup screen (FR-S1) — pick hot-seat vs computer, and for the computer the difficulty
 * and which side you play. Owns its own selection state; on Start it hands a finished
 * `GameConfig` back and never touches the game itself.
 */
import type { Difficulty } from "../ai";
import type { Player } from "../engine";
import { hotSeatConfig, type GameConfig, type GameMode } from "./series";

/** A row of mutually-exclusive pills, rendered as an ARIA radiogroup. */
function seg<T extends string>(
  label: string,
  name: string,
  options: readonly { readonly value: T; readonly text: string }[],
  selected: T,
): string {
  const pills = options
    .map(
      (o) =>
        `<button type="button" class="seg__opt" role="radio" data-name="${name}" data-value="${o.value}" aria-checked="${o.value === selected}">${o.text}</button>`,
    )
    .join("");
  return `
    <fieldset class="opt">
      <legend>${label}</legend>
      <div class="seg" role="radiogroup" aria-label="${label}">${pills}</div>
    </fieldset>`;
}

export function mountSetup(root: HTMLElement, handlers: { onStart(config: GameConfig): void }): void {
  let mode: GameMode = "hotseat";
  let difficulty: Difficulty = "medium"; // default Medium (beatable but smart)
  let side: Player = "cyan"; // default the first player

  root.innerHTML = `
    <main class="setup">
      <div class="wordmark">TIC<span class="b">·</span>TAC<span class="b">·</span>TWIST</div>
      <p class="setup__tag">Place 3, then move. Line up 3 to win.</p>
      <form class="setup__form">
        ${seg<GameMode>("Players", "mode", [
          { value: "hotseat", text: "2 Players" },
          { value: "ai", text: "vs Computer" },
        ], mode)}
        <div class="setup__ai" hidden>
          ${seg<Difficulty>("Difficulty", "difficulty", [
            { value: "easy", text: "Easy" },
            { value: "medium", text: "Medium" },
            { value: "hard", text: "Hard" },
          ], difficulty)}
          ${seg<Player>("Your side", "side", [
            { value: "cyan", text: "Cyan · 1st" },
            { value: "magenta", text: "Magenta" },
          ], side)}
        </div>
        <button type="submit" class="btn setup__start" data-action="start">Start game</button>
      </form>
    </main>`;

  const form = root.querySelector<HTMLFormElement>(".setup__form")!;
  const aiBlock = root.querySelector<HTMLElement>(".setup__ai")!;

  function selectPill(name: string, value: string): void {
    for (const el of root.querySelectorAll<HTMLButtonElement>(`.seg__opt[data-name="${name}"]`)) {
      el.setAttribute("aria-checked", String(el.dataset.value === value));
    }
  }

  form.addEventListener("click", (e) => {
    const pill = (e.target as HTMLElement).closest<HTMLButtonElement>(".seg__opt");
    if (!pill) return;
    const { name, value } = pill.dataset as { name: string; value: string };
    selectPill(name, value);
    if (name === "mode") {
      mode = value as GameMode;
      aiBlock.hidden = mode !== "ai";
    } else if (name === "difficulty") {
      difficulty = value as Difficulty;
    } else if (name === "side") {
      side = value as Player;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const config: GameConfig = mode === "hotseat" ? hotSeatConfig() : { mode: "ai", difficulty, humanSide: side };
    handlers.onStart(config);
  });
}
