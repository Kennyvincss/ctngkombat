// Turning a player's uploaded picture into a fighter, on their own device (no upload, no server).
//
// Background removal is a flood fill from the picture's edges: everything connected to the border
// that looks like the border's colours goes. That handles the usual profile picture (a character on
// a flat or gently shaded background) well. A busy photo background can't be separated this way;
// the player can then keep the background, and the picture becomes a framed portrait instead.

/** how hard the cut-out tries to remove the background */
export type CutLevel = 'soft' | 'strong' | 'off';

const TOLERANCE: Record<Exclude<CutLevel, 'off'>, number> = { soft: 34, strong: 62 };
/** working size for the cut-out (the longest side) */
const WORK = 640;
/** the fighter's in-game texture height (same as the cast's cut-outs) */
export const CUTOUT_H = 520;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('That file is not a picture the browser can open.'));
    img.src = src;
  });
}

export function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** the source picture scaled down to working size */
function working(img: HTMLImageElement): HTMLCanvasElement {
  const s = Math.min(1, WORK / Math.max(img.width, img.height));
  const c = canvas(img.width * s, img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** a few representative colours of the picture's border (corners and edges can differ) */
function borderColours(d: Uint8ClampedArray, w: number, h: number): number[][] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 128) return;
    const key = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
    const o = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    o.n++;
    o.r += d[i];
    o.g += d[i + 1];
    o.b += d[i + 2];
    buckets.set(key, o);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }
  const total = 2 * (w + h);
  return [...buckets.values()]
    .filter((o) => o.n > total * 0.04)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((o) => [o.r / o.n, o.g / o.n, o.b / o.n]);
}

/**
 * The picture with its background removed, cropped to the figure and scaled to the game's
 * cut-out height. Null when the background can't be told apart from the figure.
 */
export function cutOut(img: HTMLImageElement, level: Exclude<CutLevel, 'off'>): HTMLCanvasElement | null {
  const src = working(img);
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const cols = borderColours(d, w, h);
  if (!cols.length) return null;
  const tol = TOLERANCE[level];
  const tol2 = tol * tol;
  const isBg = (i: number) => {
    if (d[i + 3] < 40) return true;
    for (const c of cols) {
      const dr = d[i] - c[0];
      const dg = d[i + 1] - c[1];
      const db = d[i + 2] - c[2];
      if (dr * dr + dg * dg + db * db < tol2) return true;
    }
    return false;
  };
  // flood fill from every border pixel through background-coloured pixels
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (!bg[p] && isBg(p * 4)) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  // keep the main figure: the biggest solid area, plus anything big enough to matter (an arm
  // that only touches the body through a thin gap)
  const lab = new Int32Array(w * h);
  const sizes: number[] = [0];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (bg[p0] || lab[p0]) continue;
    const id = sizes.length;
    let n = 0;
    stack.push(p0);
    lab[p0] = id;
    while (stack.length) {
      const p = stack.pop()!;
      n++;
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) {
        if (q >= 0 && q < w * h && !bg[q] && !lab[q]) {
          lab[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(n);
  }
  const biggest = Math.max(...sizes);
  const area = w * h;
  // nothing removed, or (almost) everything removed: this picture's background can't be cut
  const fg = sizes.reduce((a, b) => a + b, 0);
  if (biggest < area * 0.04 || fg > area * 0.96) return null;
  const keep = new Uint8Array(sizes.length);
  sizes.forEach((n, i) => (keep[i] = i > 0 && n >= Math.max(biggest * 0.05, 40) ? 1 : 0));
  // alpha with a soft one-pixel edge, and the figure's bounding box
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) {
    if (!keep[lab[p]]) continue;
    alpha[p] = 255;
    const x = p % w;
    const y = (p / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  for (let p = 0; p < w * h; p++) {
    if (!alpha[p]) continue;
    const x = p % w;
    const edge = (x > 0 && !alpha[p - 1]) || (x < w - 1 && !alpha[p + 1]) || (p >= w && !alpha[p - w]) || (p < w * (h - 1) && !alpha[p + w]);
    d[p * 4 + 3] = edge ? 150 : 255;
  }
  for (let p = 0; p < w * h; p++) if (!alpha[p]) d[p * 4 + 3] = 0;
  ctx.putImageData(data, 0, 0);
  return fit(src, x0, y0, x1 + 1, y1 + 1);
}

/** the whole picture kept, as a portrait with soft rounded edges (when the background stays) */
export function portrait(img: HTMLImageElement): HTMLCanvasElement {
  const src = working(img);
  const w = src.width;
  const h = src.height;
  const c = canvas(w, h);
  const x = c.getContext('2d')!;
  x.drawImage(src, 0, 0);
  // fade the edges out so it doesn't read as a hard rectangle in the arena
  x.globalCompositeOperation = 'destination-in';
  const g = x.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.32, w / 2, h * 0.48, Math.max(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  return fit(c, 0, 0, w, h);
}

/** crop and scale to the in-game cut-out height */
function fit(src: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number): HTMLCanvasElement {
  const cw = x1 - x0;
  const ch = y1 - y0;
  const s = CUTOUT_H / ch;
  const c = canvas(cw * s, CUTOUT_H);
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, x0, y0, cw, ch, 0, 0, c.width, c.height);
  return c;
}

/** the figure's most vivid colour, for the fighter's glow and card */
export function accentOf(c: HTMLCanvasElement): number {
  const s = Math.min(1, 96 / Math.max(c.width, c.height));
  const t = canvas(c.width * s, c.height * s);
  const x = t.getContext('2d')!;
  x.drawImage(c, 0, 0, t.width, t.height);
  const d = x.getImageData(0, 0, t.width, t.height).data;
  const hues = new Float32Array(12);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (sat < 0.35 || mx < 0.3) continue;
    let hue = 0;
    if (mx === r) hue = ((g - b) / (mx - mn) + 6) % 6;
    else if (mx === g) hue = (b - r) / (mx - mn) + 2;
    else hue = (r - g) / (mx - mn) + 4;
    hues[Math.floor(hue * 2) % 12] += sat * mx;
  }
  let best = 0;
  for (let i = 1; i < 12; i++) if (hues[i] > hues[best]) best = i;
  if (hues[best] === 0) return 0xf5c542;
  return hsv((best + 0.5) / 12, 0.85, 1);
}

/** HSV (0..1 each) to a 0xRRGGBB colour */
export function hsv(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][((i % 6) + 6) % 6];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
