import { describe, it, expect } from "vitest";
import { LIFE_MS, spawnConfetti, stepConfetti, type Piece } from "./confetti";

// Deterministic RNG so the flight paths are reproducible.
function seeded(seed = 42): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const COLORS = ["#ff4fb2", "#ffffff"];
const FRAMES = Math.round((LIFE_MS / 1000) * 60);
const SCREENS: [number, number][] = [
  [320, 568],
  [390, 844],
  [628, 716],
  [1440, 900],
];

/** Run the whole flight; record each piece's highest point and every on-screen position. */
function fly(W: number, H: number, reduced: boolean) {
  const pieces: Piece[] = spawnConfetti(W, H, COLORS, reduced, seeded());
  const count = pieces.length;
  const minY = pieces.map((p) => p.y);
  const seen: { x: number; y: number }[] = [];
  for (let f = 0; f < FRAMES; f++) {
    stepConfetti(pieces);
    pieces.forEach((p, i) => {
      minY[i] = Math.min(minY[i], p.y);
      if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) seen.push({ x: p.x, y: p.y });
    });
  }
  return { pieces, count, minY, seen };
}

describe.each(SCREENS)("confetti on %ix%i", (W, H) => {
  it("cannon pieces peak inside the screen, not off the top", () => {
    const { minY } = fly(W, H, false);
    const cannons = minY.slice(0, 180); // the 2×90 cannon pieces come first
    const offTop = cannons.filter((y) => y < 0).length;
    expect(offTop / cannons.length).toBeLessThan(0.05);
  });

  it("covers the whole screen: every quarter across and down gets confetti", () => {
    const { seen } = fly(W, H, false);
    for (let q = 0; q < 4; q++) {
      expect(seen.some((p) => p.x >= (q * W) / 4 && p.x < ((q + 1) * W) / 4), `column ${q}`).toBe(true);
      expect(seen.some((p) => p.y >= (q * H) / 4 && p.y < ((q + 1) * H) / 4), `row ${q}`).toBe(true);
    }
  });

  it("everything has fallen off the bottom by the end", () => {
    const { pieces } = fly(W, H, false);
    expect(pieces.filter((p) => p.y <= H).length / pieces.length).toBeLessThan(0.1);
  });

  it("reduced motion is one small burst that stays on screen", () => {
    const { count, minY } = fly(W, H, true);
    expect(count).toBe(40);
    expect(minY.every((y) => y >= 0)).toBe(true);
  });
});

it("uses only the given colours", () => {
  const pieces = spawnConfetti(400, 800, COLORS, false, seeded());
  expect(new Set(pieces.map((p) => p.color))).toEqual(new Set(COLORS));
});
