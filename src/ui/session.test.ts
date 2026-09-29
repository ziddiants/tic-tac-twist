import { describe, it, expect } from "vitest";
import { createInitialState, isGameOver, status } from "../engine";
import { tap } from "./interaction";
import {
  applyTap,
  canUndo,
  lastMover,
  newMatch,
  stepSets,
  undo,
  UNDOS_PER_PLAYER,
  type MatchState,
} from "./session";

/** Play a list of cell taps, asserting each one lands (no inert taps in these fixtures). */
function play(match: MatchState, cells: number[]): MatchState {
  for (const c of cells) {
    const r = tap(match.ui, c);
    if (r.kind === "inert") throw new Error(`unexpected inert tap at cell ${c}`);
    match = applyTap(match, r);
  }
  return match;
}

describe("stepSets", () => {
  it("counts completed cyan+magenta pairs (floor of moves / 2)", () => {
    let m = newMatch(createInitialState());
    expect(stepSets(m.ui.game)).toBe(0); // opening
    m = play(m, [0]);
    expect(stepSets(m.ui.game)).toBe(0); // 1 move = no complete pair
    m = play(m, [3]);
    expect(stepSets(m.ui.game)).toBe(1); // 2 moves = 1 pair
    m = play(m, [1]);
    expect(stepSets(m.ui.game)).toBe(1); // 3 moves = still 1 pair
    m = play(m, [4]);
    expect(stepSets(m.ui.game)).toBe(2); // 4 moves = 2 pairs
  });

  it("a cyan win on move 5 reports 2 step sets", () => {
    // cyan 0, mag 3, cyan 1, mag 4, cyan 2 -> cyan line 0-1-2
    const m = play(newMatch(createInitialState()), [0, 3, 1, 4, 2]);
    expect(status(m.ui.game)).toEqual({ kind: "win", player: "cyan" });
    expect(stepSets(m.ui.game)).toBe(2);
  });
});

describe("undo budget", () => {
  it("a fresh match gives each player one undo and nothing to take back", () => {
    const m = newMatch(createInitialState());
    expect(m.undosLeft).toEqual({ cyan: UNDOS_PER_PLAYER, magenta: UNDOS_PER_PLAYER });
    expect(lastMover(m)).toBeNull();
    expect(canUndo(m)).toBe(false);
  });

  it("selecting a piece does not create an undo point; moving does", () => {
    // Fill to movement phase: cyan {0,1,6}, magenta {8,7,5}, cyan to move.
    let m = play(newMatch(createInitialState()), [0, 8, 1, 7, 6, 5]);
    const pastAfterPlacements = m.past.length;
    expect(pastAfterPlacements).toBe(6);

    const select = tap(m.ui, 0); // pick up a cyan piece
    expect(select.kind).toBe("selected");
    m = applyTap(m, select);
    expect(m.past.length).toBe(pastAfterPlacements); // selecting pushed nothing

    const move = tap(m.ui, 2); // slide 0 -> 2
    expect(move.kind).toBe("moved");
    m = applyTap(m, move);
    expect(m.past.length).toBe(pastAfterPlacements + 1);
  });

  it("undo reverts the last move, hands the turn back, and spends that player's undo", () => {
    let m = play(newMatch(createInitialState()), [0]); // cyan places at 0, magenta to move
    expect(m.ui.game.board[0]).toBe("cyan");
    expect(m.ui.game.turn).toBe("magenta");
    expect(lastMover(m)).toBe("cyan");
    expect(canUndo(m)).toBe(true);

    m = undo(m);
    expect(m.ui.game.board[0]).toBeNull(); // move gone
    expect(m.ui.game.turn).toBe("cyan"); // turn back to the mover
    expect(m.undosLeft.cyan).toBe(0);
    expect(m.undosLeft.magenta).toBe(1);
    expect(m.past).toHaveLength(0);
    expect(m.ui.selected).toBeNull();
    expect(m.ui.lastMove).toBeNull(); // no stale animation on the reverted state
  });

  it("a player gets only one undo per game", () => {
    // cyan 0, mag 3, cyan 1 -> cyan just moved, cyan has an undo left
    let m = play(newMatch(createInitialState()), [0, 3, 1]);
    expect(lastMover(m)).toBe("cyan");
    expect(canUndo(m)).toBe(true);
    m = undo(m); // cyan spends their only undo (board back to cyan {0}, magenta {3}, cyan to move)
    expect(m.undosLeft.cyan).toBe(0);

    // cyan moves again while the game is still live and is the last mover once more...
    m = play(m, [1]); // cyan re-places at 1 -> cyan {0,1}, no line, magenta to move
    expect(isGameOver(m.ui.game)).toBe(false);
    expect(lastMover(m)).toBe("cyan");
    expect(canUndo(m)).toBe(false); // ...but cyan's one undo is already spent

    // the opponent's separate undo is untouched
    m = play(m, [5]); // magenta places at 5 -> magenta is now the last mover
    expect(lastMover(m)).toBe("magenta");
    expect(canUndo(m)).toBe(true);
  });

  it("no undo once the game is over", () => {
    const m = play(newMatch(createInitialState()), [0, 3, 1, 4, 2]); // cyan wins
    expect(isGameOver(m.ui.game)).toBe(true);
    expect(canUndo(m)).toBe(false);
    expect(undo(m)).toBe(m); // undo is a no-op
  });

  it("undo is charged to the actual mover, not the side to move", () => {
    // cyan 0, mag 3 -> magenta was the last mover
    let m = play(newMatch(createInitialState()), [0, 3]);
    expect(lastMover(m)).toBe("magenta");
    m = undo(m);
    expect(m.undosLeft).toEqual({ cyan: 1, magenta: 0 });
    expect(m.ui.game.turn).toBe("magenta");
    expect(m.ui.game.board[3]).toBeNull();
    expect(m.ui.game.board[0]).toBe("cyan"); // cyan's earlier move is untouched
  });
});
