/**
 * Full-screen confetti on a canvas above all UI. Taps pass through (pointer-events: none).
 *
 * A win opens with a burst (two side cannons + a rain), then keeps a gentle rain falling
 * until `stop()` (Restart). Pieces that fall off the bottom are recycled to the top, so the
 * piece count settles at RAIN_POOL and never grows. Reduced motion: one small burst that
 * ends on its own (PRD FR-U7).
 *
 * The physics (`spawnConfetti`, `stepConfetti`) is pure so it is unit-tested without a DOM.
 */

export interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Per-frame velocity retention. Rain uses more drag so it flutters down slowly. */
  drag: number;
  angle: number;
  spin: number;
  w: number;
  h: number;
  color: string;
}

/** px per frame², per frame. */
export const GRAVITY = 0.12;
const CANNON_DRAG = 0.992;
/** Terminal speed GRAVITY / (1 - RAIN_DRAG) = 3 px/frame ≈ 180 px/s. */
const RAIN_DRAG = 0.96;
/** Pieces kept falling after the opening burst. */
export const RAIN_POOL = 90;
const REDUCED_LIFE_MS = 1600;
const FADE_MS = 500;

type Rand = () => number;

function makePiece(
  x: number,
  y: number,
  angle: number,
  speed: number,
  drag: number,
  colors: readonly string[],
  rand: Rand,
): Piece {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    drag,
    angle: rand() * Math.PI,
    spin: (rand() - 0.5) * 0.3,
    w: 6 + rand() * 6,
    h: 3 + rand() * 4,
    color: colors[Math.floor(rand() * colors.length)],
  };
}

function rainPiece(W: number, y: number, colors: readonly string[], rand: Rand): Piece {
  const p = makePiece(rand() * W, y, Math.PI / 2, 1 + rand() * 2, RAIN_DRAG, colors, rand);
  p.vx = (rand() - 0.5) * 1.5; // slight sideways drift
  return p;
}

/**
 * The opening burst. Launch speed scales with the screen height so the cannons peak inside
 * the screen on every size.
 */
export function spawnConfetti(
  W: number,
  H: number,
  colors: readonly string[],
  reduced: boolean,
  rand: Rand = Math.random,
): Piece[] {
  // Speed that climbs `rise` px before gravity stops it: v = √(2·g·rise). Drag makes the
  // real peak a little lower, which keeps pieces on screen.
  const speedFor = (rise: number) => Math.sqrt(2 * GRAVITY * rise);

  const out: Piece[] = [];
  if (reduced) {
    for (let i = 0; i < 40; i++) {
      const s = speedFor(H * 0.2) * (0.6 + rand() * 0.4);
      out.push(makePiece(W / 2, H * 0.35, -Math.PI / 2 + (rand() - 0.5) * 2, s, CANNON_DRAG, colors, rand));
    }
    return out;
  }
  const cannonY = H * 0.8;
  for (let i = 0; i < 90; i++) {
    const s = speedFor(cannonY * 0.9) * (0.7 + rand() * 0.3);
    out.push(makePiece(0, cannonY, -Math.PI / 2.6 - rand() * 0.45, s, CANNON_DRAG, colors, rand));
    out.push(makePiece(W, cannonY, -Math.PI + Math.PI / 2.6 + rand() * 0.45, s, CANNON_DRAG, colors, rand));
  }
  for (let i = 0; i < RAIN_POOL; i++) {
    out.push(rainPiece(W, -10 - rand() * H, colors, rand));
  }
  return out;
}

/**
 * Advance one frame and return the pieces still in play. With `continuous`, a piece that
 * falls off the bottom re-enters at the top as rain while the pool is above RAIN_POOL;
 * extra burst pieces are dropped, so the count settles at RAIN_POOL.
 */
export function stepConfetti(
  pieces: Piece[],
  W: number,
  H: number,
  colors: readonly string[],
  continuous: boolean,
  rand: Rand = Math.random,
): Piece[] {
  const out: Piece[] = [];
  let fallen = 0;
  for (const p of pieces) {
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.spin;
    if (p.y <= H + 20) out.push(p);
    else fallen++;
  }
  if (continuous) {
    const refill = Math.min(fallen, RAIN_POOL - out.length);
    for (let i = 0; i < refill; i++) out.push(rainPiece(W, -10 - rand() * 30, colors, rand));
  }
  return out;
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

  const continuous = !opts.reduced;
  let pieces = spawnConfetti(innerWidth, innerHeight, colors, opts.reduced);

  let raf = 0;
  const start = performance.now();
  function frame(now: number): void {
    const t = now - start;
    pieces = stepConfetti(pieces, innerWidth, innerHeight, colors, continuous);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    // Only the reduced-motion burst ends on its own (with a short fade).
    const fadeFrom = REDUCED_LIFE_MS - FADE_MS;
    ctx.globalAlpha = !continuous && t > fadeFrom ? Math.max(0, 1 - (t - fadeFrom) / FADE_MS) : 1;
    for (const p of pieces) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      // Squash on one axis so pieces appear to tumble.
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.angle * 2), p.w, p.h * Math.cos(p.angle * 2));
      ctx.restore();
    }
    const done = !continuous && (t >= REDUCED_LIFE_MS || pieces.length === 0);
    if (done) stop();
    else raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function stop(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.remove();
  }
  return stop;
}
