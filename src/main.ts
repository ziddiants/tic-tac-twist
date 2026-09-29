import "./style.css";

// TT-001 scaffold placeholder. Proves the Vite + TS toolchain runs end to end.
// The real game is built on top of this in later tickets:
//   TT-002 engine (pure rules) → TT-003 solver/AI → TT-004 board UI → TT-005 setup/AI
//   → TT-006 neon polish + win celebration → TT-007 ship.
// See ../docs/PRD.md for the full build plan.

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <div class="shell">
      <div class="wordmark">TIC<span class="b">·</span>TAC<span class="b">·</span>TWIST</div>
      <div class="tagline">Place 3 · then move · make a line</div>
      <p class="note">Scaffold ready. The game engine and UI start at ticket TT-002 — see docs/PRD.md.</p>
    </div>
  `;
}
