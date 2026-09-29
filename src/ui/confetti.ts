/**
 * Full-screen confetti on a canvas above all UI. Taps pass through (pointer-events: none).
 * Removes its own canvas when the pieces have fallen or faded; `stop()` ends it early.
 *
 * The physics (`spawnConfetti`, `stepConfetti`) is pure so it is unit-tested without a DOM.
 */

export interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  w: number;
  h: number;
  color: string;
}

/** px per frame², per frame. */
export const GRAVITY = 0.12;
export const DRAG = 0.992;
export const LIFE_MS = 4200;
const REDUCED_LIFE_MS = 1600;
const FADE_MS = 900;

/**
 * Two side cannons + a rain from the top so the whole screen is covered. Reduced motion:
 * one small, short burst (PRD FR-U7). Launch speed scales with the screen height so the
 * cannons peak inside the screen on every size.
 */
export function spawnConfetti(
  W: number,
  H: number,
  colors: readonly string[],
  reduced: boolean,
  rand: () => number = Math.random,
): Piece[] {
  const pick = () => colors[Math.floor(rand() * colors.length)];
  const piece = (x: number, y: number, angle: number, speed: number): Piece => ({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle: rand() * Math.PI,
    spin: (rand() - 0.5) * 0.3,
    w: 6 + rand() * 6,
    h: 3 + rand() * 4,
    color: pick(),
  });
  // Speed that climbs `rise` px before gravity stops it: v = √(2·g·rise). The drag makes the
  // real peak a little lower, which keeps pieces on screen.
  const speedFor = (rise: number) => Math.sqrt(2 * GRAVITY * rise);

  const out: Piece[] = [];
  if (reduced) {
    for (let i = 0; i < 40; i++) {
      const s = speedFor(H * 0.2) * (0.6 + rand() * 0.4);
      out.push(piece(W / 2, H * 0.35, -Math.PI / 2 + (rand() - 0.5) * 2, s));
    }
    return out;
  }
  const cannonY = H * 0.8;
  for (let i = 0; i < 90; i++) {
    const s = speedFor(cannonY * 0.9) * (0.7 + rand() * 0.3);
    out.push(piece(0, cannonY, -Math.PI / 2.6 - rand() * 0.45, s));
    out.push(piece(W, cannonY, -Math.PI + Math.PI / 2.6 + rand() * 0.45, s));
  }
  for (let i = 0; i < 80; i++) {
    out.push(piece(rand() * W, -10 - rand() * H * 0.4, Math.PI / 2, 1 + rand() * 2));
  }
  return out;
}

/** Advance every piece one frame. */
export function stepConfetti(pieces: Piece[]): void {
  for (const p of pieces) {
    p.vx *= DRAG;
    p.vy = p.vy * DRAG + GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.spin;
  }
}

export function launchConfetti(colors: readonly string[], opts: { reduced: boolean }): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize(): void {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const pieces = spawnConfetti(innerWidth, innerHeight, colors, opts.reduced);
  const life = opts.reduced ? REDUCED_LIFE_MS : LIFE_MS;

  let raf = 0;
  const start = performance.now();
  function frame(now: number): void {
    const t = now - start;
    stepConfetti(pieces);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = t > life - FADE_MS ? Math.max(0, (life - t) / FADE_MS) : 1;
    let alive = 0;
    for (const p of pieces) {
      if (p.y > innerHeight + 20) continue;
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      // Squash on one axis so pieces appear to tumble.
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.angle * 2), p.w, p.h * Math.cos(p.angle * 2));
      ctx.restore();
    }
    if (t < life && alive > 0) raf = requestAnimationFrame(frame);
    else stop();
  }
  raf = requestAnimationFrame(frame);

  function stop(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.remove();
  }
  return stop;
}
