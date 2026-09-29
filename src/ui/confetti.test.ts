import { describe, it, expect } from "vitest";
import { RAIN_POOL, spawnConfetti, stepConfetti, type Piece } from "./confetti";

// Deterministic RNG so the flight paths are reproducible.
function seeded(seed = 42): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const COLORS = ["#ff4fb2", "#ffffff"];
const FPS = 60;
const SCREENS: [number, number][] = [
  [320, 568],
  [390, 844],
  [628, 716],
  [1440, 900],
];

/**
 * Run `seconds` of animation. Records each burst piece's highest point, every on-screen
 * position, and the piece count per frame.
 */
function fly(W: number, H: number, reduced: boolean, seconds: number) {
  const rand = seeded();
  let pieces: Piece[] = spawnConfetti(W, H, COLORS, reduced, rand);
  const initial = pieces.length;
  const cannons = reduced ? [] : pieces.slice(0, 180); // the 2×90 cannon pieces come first
  const minY = new Map(cannons.map((p) => [p, p.y]));
  const seen: { x: number; y: number; frame: number }[] = [];
  const counts: number[] = [];
  for (let f = 0; f < seconds * FPS; f++) {
    pieces = stepConfetti(pieces, W, H, COLORS, !reduced, rand);
    counts.push(pieces.length);
    for (const p of pieces) {
      if (minY.has(p)) minY.set(p, Math.min(minY.get(p)!, p.y));
      if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) seen.push({ x: p.x, y: p.y, frame: f });
    }
  }
  return { pieces, initial, minY: [...minY.values()], seen, counts };
}

describe.each(SCREENS)("confetti on %ix%i", (W, H) => {
  it("cannon pieces peak inside the screen, not off the top", () => {
    const { minY } = fly(W, H, false, 5);
    expect(minY.filter((y) => y < 0).length / minY.length).toBeLessThan(0.05);
  });

  it("covers the whole screen: every quarter across and down gets confetti", () => {
    const { seen } = fly(W, H, false, 5);
    for (let q = 0; q < 4; q++) {
      expect(seen.some((p) => p.x >= (q * W) / 4 && p.x < ((q + 1) * W) / 4), `column ${q}`).toBe(true);
      expect(seen.some((p) => p.y >= (q * H) / 4 && p.y < ((q + 1) * H) / 4), `row ${q}`).toBe(true);
    }
  });

  it("keeps falling until stopped: still raining over the whole screen after 60 s", () => {
    const { seen, counts } = fly(W, H, false, 60);
    const lastSecond = seen.filter((p) => p.frame >= 59 * FPS);
    expect(counts[counts.length - 1]).toBe(RAIN_POOL);
    for (let q = 0; q < 4; q++) {
      expect(lastSecond.some((p) => p.y >= (q * H) / 4 && p.y < ((q + 1) * H) / 4), `row ${q}`).toBe(true);
    }
  });

  it("never grows: the count only falls from the burst and settles at the rain pool", () => {
    const { initial, counts } = fly(W, H, false, 60);
    expect(Math.max(...counts)).toBeLessThanOrEqual(initial);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(RAIN_POOL);
  });

  it("reduced motion: one small burst that stays on screen and then ends", () => {
    const rand = seeded();
    let pieces = spawnConfetti(W, H, COLORS, true, rand);
    expect(pieces.length).toBe(40);
    let minY = Infinity;
    for (let f = 0; f < 10 * FPS && pieces.length > 0; f++) {
      pieces = stepConfetti(pieces, W, H, COLORS, false, rand);
      for (const p of pieces) minY = Math.min(minY, p.y);
    }
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(pieces.length).toBe(0);
  });
});

it("uses only the given colours", () => {
  const pieces = spawnConfetti(400, 800, COLORS, false, seeded());
  expect(new Set(pieces.map((p) => p.color))).toEqual(new Set(COLORS));
});
