import type { RigData, RigMesh } from '../fight/RigView';

// Skeletal rigs for fighters made by players, built on their device: the in-browser version of
// scripts/make_rigs.py. A rig splits the fighter into body / arm / leg layers, each a skinned mesh
// bound to the same small skeleton the cast's rigs use, so made fighters punch, kick, crouch and
// jump with real moving limbs (RigView).
//
// Two ways in:
//  - the player's own picture, when it shows a whole body: the arms and legs are cut out along
//    capsules around the bones the player placed (joints), and the torso behind them is filled in
//  - a head-and-shoulders picture (a PFP): it goes on a drawn fighter's body, whose layers and
//    joints are known exactly
// Everything is in "rig space": cut-out pixels, y down, the fighter facing +x.

export const JOINT_NAMES = ['head', 'neck', 'lsh', 'lel', 'lwr', 'rsh', 'rel', 'rwr', 'lhip', 'lkn', 'lank', 'rhip', 'rkn', 'rank'] as const;
export type JointName = (typeof JOINT_NAMES)[number];
export type Joints = Record<JointName, [number, number]>;

/** the five layers, all the size of the fighter picture */
export interface Layers {
  w: number;
  h: number;
  body: HTMLCanvasElement;
  armL: HTMLCanvasElement;
  armR: HTMLCanvasElement;
  legL: HTMLCanvasElement;
  legR: HTMLCanvasElement;
}

type P = { x: number; y: number };
const pt = (a: [number, number]): P => ({ x: a[0], y: a[1] });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k });
const len = (a: P) => Math.hypot(a.x, a.y);
const mid = (a: P, b: P) => mul(add(a, b), 0.5);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** distance from (x, y) to the segment a-b, and how far along it (0..1) */
function segDist(x: number, y: number, a: P, b: P): [number, number] {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const L2 = Math.max(1e-6, abx * abx + aby * aby);
  const t = clamp(((x - a.x) * abx + (y - a.y) * aby) / L2, 0, 1);
  return [Math.hypot(x - (a.x + t * abx), y - (a.y + t * aby)), t];
}

function polyDist(x: number, y: number, pts: P[]) {
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(x, y, pts[i], pts[i + 1])[0]);
  return d;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  // its pixels are read back many times: keep them in memory, not on the GPU
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

function pixels(c: HTMLCanvasElement) {
  return c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
}

/** all the pixels within a capsule chain (radius per segment), set in mask */
function capsule(mask: Uint8Array, w: number, h: number, pts: P[], radii: number[]) {
  for (let s = 0; s + 1 < pts.length; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    const r = radii[s];
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - r));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x) + r));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - r));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y) + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (segDist(x, y, a, b)[0] <= r) mask[y * w + x] = 1;
  }
}

/** a limb's half-width, scanned across the middle of the bone */
function limbWidth(alpha: Uint8Array, w: number, h: number, a: P, b: P) {
  const d = sub(b, a);
  const L = len(d);
  if (L < 1) return 20;
  const n = { x: -d.y / L, y: d.x / L };
  const widths: number[] = [];
  for (const t of [0.35, 0.5, 0.65]) {
    const c = add(a, mul(d, t));
    let span = 0;
    for (const side of [1, -1]) {
      let k = 0;
      while (k < 120) {
        const x = Math.round(c.x + n.x * side * (k + 1));
        const y = Math.round(c.y + n.y * side * (k + 1));
        if (x < 0 || y < 0 || x >= w || y >= h || alpha[y * w + x] < 60) break;
        k++;
      }
      span += k;
    }
    widths.push(span / 2);
  }
  return widths.sort((p, q) => p - q)[1];
}

/** distance from every pixel to the nearest set pixel (two-pass chamfer, close to Euclidean) */
function distanceTo(mask: Uint8Array, w: number, h: number) {
  const D = new Float32Array(w * h);
  const INF = 1e9;
  for (let i = 0; i < w * h; i++) D[i] = mask[i] ? 0 : INF;
  const a = 1;
  const b = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + a);
      if (y > 0) {
        v = Math.min(v, D[i - w] + a);
        if (x > 0) v = Math.min(v, D[i - w - 1] + b);
        if (x < w - 1) v = Math.min(v, D[i - w + 1] + b);
      }
      D[i] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = D[i];
      if (x < w - 1) v = Math.min(v, D[i + 1] + a);
      if (y < h - 1) {
        v = Math.min(v, D[i + w] + a);
        if (x < w - 1) v = Math.min(v, D[i + w + 1] + b);
        if (x > 0) v = Math.min(v, D[i + w - 1] + b);
      }
      D[i] = v;
    }
  return D;
}

/** the derived joints the rig uses: pelvis between the hips, and neck/head if missing */
function fullJoints(J: Joints) {
  const j: Record<string, P> = {};
  for (const k of JOINT_NAMES) j[k] = pt(J[k]);
  j.pelvis = mid(j.lhip, j.rhip);
  return j;
}

// ---------------------------------------------------------------- the player's own picture

/**
 * A first guess at where the joints are, from the figure's outline: a standing figure, head at
 * the top, feet at the bottom, arms down the sides. The player then drags them into place.
 */
export function guessJoints(art: HTMLCanvasElement): Joints {
  const w = art.width;
  const h = art.height;
  const d = pixels(art).data;
  const solid = (x: number, y: number) => d[(Math.round(y) * w + Math.round(x)) * 4 + 3] > 100;
  /** the figure's extent and centre along a row */
  const row = (y: number) => {
    let x0 = -1;
    let x1 = -1;
    let sx = 0;
    let n = 0;
    for (let x = 0; x < w; x++)
      if (solid(x, y)) {
        if (x0 < 0) x0 = x;
        x1 = x;
        sx += x;
        n++;
      }
    return { x0, x1, c: n ? sx / n : w / 2, n };
  };
  const centreOf = (ya: number, yb: number) => {
    let s = 0;
    let n = 0;
    for (let y = Math.round(ya); y < yb; y += 3) {
      const r = row(y);
      s += r.c * r.n;
      n += r.n;
    }
    return n ? s / n : w / 2;
  };
  const hx = centreOf(0, h * 0.14);
  const cx = centreOf(h * 0.22, h * 0.5);
  const u = h / 100; // percent of the figure's height
  // the feet: two runs of pixels near the bottom, or one wide run
  const feetY = h * 0.94;
  const runs: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && solid(x, feetY);
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      if (x - start > 3) runs.push([start, x - 1]);
      start = -1;
    }
  }
  runs.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  let fa: number;
  let fb: number;
  if (runs.length >= 2) {
    fa = (runs[0][0] + runs[0][1]) / 2;
    fb = (runs[1][0] + runs[1][1]) / 2;
  } else {
    const r = runs[0] ?? [cx - 8 * u, cx + 8 * u];
    fa = r[0] + (r[1] - r[0]) * 0.22;
    fb = r[0] + (r[1] - r[0]) * 0.78;
  }
  const [rankX, lankX] = fa < fb ? [fa, fb] : [fb, fa];
  // the arms: the figure's widest reach around the waist
  const armRow = row(h * 0.47);
  const lwrX = armRow.x1 >= 0 ? Math.max(cx + 9 * u, armRow.x1 - 3 * u) : cx + 12 * u;
  const rwrX = armRow.x0 >= 0 ? Math.min(cx - 9 * u, armRow.x0 + 3 * u) : cx - 12 * u;
  const r = (x: number, y: number): [number, number] => [Math.round(clamp(x, 0, w - 1)), Math.round(clamp(y, 0, h - 1))];
  return {
    head: r(hx, 8 * u),
    neck: r((hx + cx) / 2, 17 * u),
    lsh: r(cx + 9 * u, 22 * u),
    lel: r((cx + 9 * u + lwrX) / 2 + 2 * u, 35 * u),
    lwr: r(lwrX, 47 * u),
    rsh: r(cx - 9 * u, 22 * u),
    rel: r((cx - 9 * u + rwrX) / 2 - 2 * u, 35 * u),
    rwr: r(rwrX, 47 * u),
    lhip: r(cx + 5 * u, 52 * u),
    lkn: r((cx + 5 * u + lankX) / 2, 73 * u),
    lank: r(lankX, 93 * u),
    rhip: r(cx - 5 * u, 52 * u),
    rkn: r((cx - 5 * u + rankX) / 2, 73 * u),
    rank: r(rankX, 93 * u),
  };
}

/** mirror a picture and its joints (left and right swap sides, so the lead limbs stay in front) */
export function mirror(art: HTMLCanvasElement, J?: Joints): { art: HTMLCanvasElement; joints?: Joints } {
  const c = canvas(art.width, art.height);
  const x = c.getContext('2d')!;
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(art, 0, 0);
  if (!J) return { art: c };
  const m = (k: JointName): [number, number] => [art.width - 1 - J[k][0], J[k][1]];
  const joints = {} as Joints;
  for (const k of JOINT_NAMES) {
    const other = (k[0] === 'l' ? 'r' + k.slice(1) : k[0] === 'r' ? 'l' + k.slice(1) : k) as JointName;
    joints[other] = m(k);
  }
  return { art: c, joints };
}

/** cut the player's whole-body picture into layers along the joints they placed */
export function segment(art: HTMLCanvasElement, J: Joints): Layers {
  const w = art.width;
  const h = art.height;
  const N = w * h;
  const img = pixels(art);
  const d = img.data;
  const alpha = new Uint8Array(N);
  for (let i = 0; i < N; i++) alpha[i] = d[i * 4 + 3];
  const j = fullJoints(J);
  const hipMid = j.pelvis;
  const shMid = mid(j.lsh, j.rsh);
  const torso = Math.max(20, len(sub(shMid, hipMid)));
  const ext = (p0: P, p1: P, f: number) => add(p1, mul(sub(p1, p0), f));

  // arms and legs as capsules around their bones
  const limbs: Record<string, { m: Uint8Array; pts: P[] }> = {};
  for (const s of ['l', 'r']) {
    const sh = j[`${s}sh`];
    const el = j[`${s}el`];
    const wr = j[`${s}wr`];
    const fist = ext(el, wr, 0.45);
    const rUp = clamp(limbWidth(alpha, w, h, sh, el), torso * 0.13, torso * 0.32);
    const rLo = clamp(limbWidth(alpha, w, h, el, wr), torso * 0.11, torso * 0.3);
    const m = new Uint8Array(N);
    capsule(m, w, h, [sh, el, wr, fist], [rUp, rLo, rLo * 1.25]);
    limbs[`arm${s.toUpperCase()}`] = { m, pts: [sh, el, fist] };
  }
  for (const s of ['l', 'r']) {
    const hp = j[`${s}hip`];
    const kn = j[`${s}kn`];
    const an = j[`${s}ank`];
    const foot = ext(kn, an, 0.35);
    foot.y = Math.max(foot.y, h + 10);
    const rUp = clamp(limbWidth(alpha, w, h, hp, kn), torso * 0.18, torso * 0.45);
    const rLo = clamp(limbWidth(alpha, w, h, kn, an), torso * 0.15, torso * 0.42);
    const top = add(hp, mul(sub(hp, kn), (rUp * 0.6) / Math.max(1, len(sub(hp, kn)))));
    const m = new Uint8Array(N);
    capsule(m, w, h, [top, hp, kn, foot], [rUp, rUp, rLo]);
    limbs[`leg${s.toUpperCase()}`] = { m, pts: [hp, kn, foot] };
  }
  // only the figure, and never the head
  const headC = mid(j.head, j.neck);
  const headR = Math.max(len(sub(j.head, j.neck)) * 0.62, torso * 0.22);
  for (const k in limbs) {
    const m = limbs[k].m;
    for (let i = 0; i < N; i++) {
      if (!m[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      if (!alpha[i] || Math.hypot(x - headC.x, y - headC.y) <= headR) m[i] = 0;
    }
  }
  const near = (k: string, i: number) => polyDist(i % w, (i / w) | 0, limbs[k].pts);
  // overlaps: split each pair by the nearest bone; arms win over legs
  for (const [a, b] of [
    ['legL', 'legR'],
    ['armL', 'armR'],
  ]) {
    const ma = limbs[a].m;
    const mb = limbs[b].m;
    for (let i = 0; i < N; i++) {
      if (!(ma[i] && mb[i])) continue;
      if (near(b, i) < near(a, i)) ma[i] = 0;
      else mb[i] = 0;
    }
  }
  const arms = new Uint8Array(N);
  for (let i = 0; i < N; i++) arms[i] = limbs.armL.m[i] | limbs.armR.m[i];
  for (const k of ['legL', 'legR']) for (let i = 0; i < N; i++) if (arms[i]) limbs[k].m[i] = 0;
  // everything below the waist that isn't an arm belongs to the nearest leg
  const hipY = hipMid.y;
  for (let i = 0; i < N; i++) {
    const y = (i / w) | 0;
    if (!alpha[i] || arms[i] || y <= hipY + torso * 0.1) continue;
    if (near('legL', i) <= near('legR', i)) limbs.legL.m[i] = 1;
    else limbs.legR.m[i] = 1;
  }
  const legsLow = new Uint8Array(N);
  for (let i = 0; i < N; i++) legsLow[i] = (limbs.legL.m[i] | limbs.legR.m[i]) && ((i / w) | 0) > hipY + torso * 0.08 ? 1 : 0;
  // bits cut off from the body (fingers, coat tips) go to the nearest limb
  {
    const rest = new Uint8Array(N);
    for (let i = 0; i < N; i++) rest[i] = alpha[i] && !arms[i] && !legsLow[i] ? 1 : 0;
    const lab = new Int32Array(N);
    const sizes = [0];
    const stack: number[] = [];
    for (let p0 = 0; p0 < N; p0++) {
      if (!rest[p0] || lab[p0]) continue;
      const id = sizes.length;
      let n = 0;
      lab[p0] = id;
      stack.push(p0);
      while (stack.length) {
        const p = stack.pop()!;
        n++;
        const x = p % w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w, x > 0 ? p - w - 1 : -1, x < w - 1 ? p - w + 1 : -1, x > 0 ? p + w - 1 : -1, x < w - 1 ? p + w + 1 : -1]) {
          if (q >= 0 && q < N && rest[q] && !lab[q]) {
            lab[q] = id;
            stack.push(q);
          }
        }
      }
      sizes.push(n);
    }
    if (sizes.length > 2) {
      const main = sizes.indexOf(Math.max(...sizes));
      const keys = Object.keys(limbs);
      for (let i = 0; i < N; i++) {
        if (!lab[i] || lab[i] === main) continue;
        const x = i % w;
        const y = (i / w) | 0;
        if (Math.hypot(x - headC.x, y - headC.y) <= headR) continue;
        let best = keys[0];
        let bd = Infinity;
        for (const k of keys) {
          const dd = near(k, i);
          if (dd < bd) {
            bd = dd;
            best = k;
          }
        }
        limbs[best].m[i] = 1;
        if (best.startsWith('arm')) arms[i] = 1;
        else if (y > hipY + torso * 0.08) legsLow[i] = 1;
      }
    }
  }

  // the body: everything that isn't an arm, or a leg below the hips (keeping the shoulders)
  const bodyA = new Uint8Array(alpha);
  for (let i = 0; i < N; i++) {
    if (!alpha[i] || !(arms[i] || legsLow[i])) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const keep = Math.hypot(x - j.lsh.x, y - j.lsh.y) <= torso * 0.16 || Math.hypot(x - j.rsh.x, y - j.rsh.y) <= torso * 0.16;
    if (!keep) bodyA[i] = 0;
  }
  // fill in the torso behind the arms (inside the body's closed outline), so a punch reveals
  // shirt instead of a hole
  const r = Math.max(4, torso * 0.17);
  const solidBody = new Uint8Array(N);
  for (let i = 0; i < N; i++) solidBody[i] = bodyA[i] >= 128 ? 1 : 0;
  const dOut = distanceTo(solidBody, w, h);
  const dilated = new Uint8Array(N);
  for (let i = 0; i < N; i++) dilated[i] = dOut[i] <= r ? 0 : 1; // 1 = outside the dilated body
  const dIn = distanceTo(dilated, w, h);
  const fill = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const closed = dIn[i] > r;
    if (closed && bodyA[i] < 128 && arms[i] && ((i / w) | 0) < hipY + torso * 0.2) fill[i] = 1;
  }
  // colours for the filled area: grown in from the surrounding body, ring by ring
  const known = new Uint8Array(solidBody);
  let frontier: number[] = [];
  for (let i = 0; i < N; i++) if (fill[i]) frontier.push(i);
  for (let pass = 0; pass < 200 && frontier.length; pass++) {
    const next: number[] = [];
    const done: number[] = [];
    for (const i of frontier) {
      const x = i % w;
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let n = 0;
      for (const q of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (q < 0 || q >= N || !known[q]) continue;
        rr += d[q * 4];
        gg += d[q * 4 + 1];
        bb += d[q * 4 + 2];
        n++;
      }
      if (!n) {
        next.push(i);
        continue;
      }
      d[i * 4] = rr / n;
      d[i * 4 + 1] = gg / n;
      d[i * 4 + 2] = bb / n;
      done.push(i);
    }
    if (!done.length) break;
    for (const i of done) known[i] = 1;
    frontier = next;
  }
  for (let i = 0; i < N; i++) if (fill[i]) bodyA[i] = 255;

  const layer = (a: Uint8Array | null, m: Uint8Array | null) => {
    const c = canvas(w, h);
    const out = new ImageData(w, h);
    const o = out.data;
    for (let i = 0; i < N; i++) {
      const v = a ? a[i] : m && m[i] ? alpha[i] : 0;
      if (!v) continue;
      o[i * 4] = d[i * 4];
      o[i * 4 + 1] = d[i * 4 + 1];
      o[i * 4 + 2] = d[i * 4 + 2];
      o[i * 4 + 3] = v;
    }
    c.getContext('2d')!.putImageData(out, 0, 0);
    return c;
  };
  // the limbs keep the original colours (the fill only changed pixels under the arms, which
  // the arm layers also draw: restore those from the source first)
  const src = pixels(art).data;
  const limbLayer = (m: Uint8Array) => {
    const c = canvas(w, h);
    const out = new ImageData(w, h);
    const o = out.data;
    for (let i = 0; i < N; i++) {
      if (!m[i]) continue;
      o.set(src.subarray(i * 4, i * 4 + 4), i * 4);
    }
    c.getContext('2d')!.putImageData(out, 0, 0);
    return c;
  };
  return { w, h, body: layer(bodyA, null), armL: limbLayer(limbs.armL.m), armR: limbLayer(limbs.armR.m), legL: limbLayer(limbs.legL.m), legR: limbLayer(limbs.legR.m) };
}

// ---------------------------------------------------------------- a drawn body for a PFP

const BODY_W = 340;
const BODY_H = 520;

/** where the drawn body's joints are (facing right: L is the front arm and leg) */
export const BODY_JOINTS: Joints = {
  head: [172, 92],
  neck: [170, 192],
  lsh: [214, 212],
  lel: [244, 272],
  lwr: [260, 330],
  rsh: [128, 212],
  rel: [104, 272],
  rwr: [90, 330],
  lhip: [194, 336],
  lkn: [222, 422],
  lank: [242, 494],
  rhip: [146, 336],
  rkn: [124, 420],
  rank: [102, 494],
};

const shade = (c: number, k: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return `rgb(${r},${g},${b})`;
};
const INK = '#0d0806';

/** a thick limb segment with an ink outline */
function limb(x: CanvasRenderingContext2D, pts: P[], width: number, fill: string) {
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) x.lineTo(p.x, p.y);
  x.strokeStyle = INK;
  x.lineWidth = width + 9;
  x.stroke();
  x.strokeStyle = fill;
  x.lineWidth = width;
  x.stroke();
}

function arm(x: CanvasRenderingContext2D, sh: P, el: P, wr: P, sleeve: string, glove: string, band: string) {
  limb(x, [sh, el], 42, sleeve);
  limb(x, [el, wr], 35, sleeve);
  // fist in a fight glove, with a wrap in the fighter's colour
  const dir = mul(sub(wr, el), 1 / Math.max(1, len(sub(wr, el))));
  const fist = add(wr, mul(dir, 16));
  x.fillStyle = INK;
  x.beginPath();
  x.arc(fist.x, fist.y, 26, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = glove;
  x.beginPath();
  x.arc(fist.x, fist.y, 21.5, 0, Math.PI * 2);
  x.fill();
  limb(x, [add(wr, mul(dir, -4)), add(wr, mul(dir, 2))], 36, band);
  x.fillStyle = 'rgba(255,255,255,0.35)';
  x.beginPath();
  x.arc(fist.x - 6, fist.y - 7, 6, 0, Math.PI * 2);
  x.fill();
}

function leg(x: CanvasRenderingContext2D, hp: P, kn: P, an: P, pants: string, shoe: string, stripe: string) {
  limb(x, [hp, kn], 52, pants);
  limb(x, [kn, an], 44, pants);
  // a sneaker pointing forward, its sole on the floor
  const y = BODY_H - 4;
  x.fillStyle = INK;
  x.beginPath();
  x.roundRect(an.x - 30, an.y - 16, 74, y - an.y + 20, 12);
  x.fill();
  x.fillStyle = shoe;
  x.beginPath();
  x.roundRect(an.x - 25, an.y - 11, 64, y - an.y + 9, 9);
  x.fill();
  x.fillStyle = stripe;
  x.fillRect(an.x - 14, an.y + 2, 34, 6);
  x.fillStyle = '#2a2a2a';
  x.fillRect(an.x - 25, y - 6, 64, 6);
}

/**
 * The player's picture as the head of a drawn fighter: hoodie in their colour, joggers, fight
 * gloves, sneakers. Returns the layers (for the rig) and the whole figure (for the card).
 */
export function madeBody(head: HTMLCanvasElement, accent: number): { layers: Layers; art: HTMLCanvasElement; joints: Joints } {
  const j = fullJoints(BODY_JOINTS);
  const hoodie = shade(accent, 0.78);
  const hoodieBack = shade(accent, 0.55);
  const pants = '#22232e';
  const pantsBack = '#17171f';
  const glove = '#141414';
  const band = shade(accent, 1);
  const L: Layers = { w: BODY_W, h: BODY_H, body: canvas(BODY_W, BODY_H), armL: canvas(BODY_W, BODY_H), armR: canvas(BODY_W, BODY_H), legL: canvas(BODY_W, BODY_H), legR: canvas(BODY_W, BODY_H) };

  leg(L.legR.getContext('2d')!, j.rhip, j.rkn, j.rank, pantsBack, '#cfcfcf', shade(accent, 0.6));
  leg(L.legL.getContext('2d')!, j.lhip, j.lkn, j.lank, pants, '#f4f4f4', band);
  arm(L.armR.getContext('2d')!, j.rsh, j.rel, j.rwr, hoodieBack, '#0c0c0c', shade(accent, 0.6));
  arm(L.armL.getContext('2d')!, j.lsh, j.lel, j.lwr, hoodie, glove, band);

  // the body: hoodie torso, waistband, hips; the head on top
  const x = L.body.getContext('2d')!;
  const torso = new Path2D();
  torso.moveTo(j.rsh.x - 20, j.rsh.y - 6);
  torso.quadraticCurveTo(170, 176, j.lsh.x + 20, j.lsh.y - 6);
  torso.lineTo(j.lhip.x + 22, j.lhip.y - 8);
  torso.quadraticCurveTo(170, j.lhip.y + 8, j.rhip.x - 22, j.rhip.y - 8);
  torso.closePath();
  // hips and the top of the joggers
  x.fillStyle = INK;
  x.beginPath();
  x.roundRect(j.rhip.x - 30, j.rhip.y - 26, j.lhip.x - j.rhip.x + 60, 58, 16);
  x.fill();
  x.fillStyle = pants;
  x.beginPath();
  x.roundRect(j.rhip.x - 25, j.rhip.y - 21, j.lhip.x - j.rhip.x + 50, 48, 13);
  x.fill();
  x.lineWidth = 9;
  x.strokeStyle = INK;
  x.stroke(torso);
  const g = x.createLinearGradient(j.rsh.x, 0, j.lsh.x + 20, 0);
  g.addColorStop(0, hoodieBack);
  g.addColorStop(0.6, hoodie);
  g.addColorStop(1, shade(accent, 0.95));
  x.fillStyle = g;
  x.fill(torso);
  // pocket, drawstrings and a chest print
  x.strokeStyle = 'rgba(0,0,0,0.35)';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(140, 300);
  x.quadraticCurveTo(170, 286, 202, 300);
  x.stroke();
  x.strokeStyle = '#f1efe6';
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(162, 214);
  x.lineTo(160, 252);
  x.moveTo(180, 214);
  x.lineTo(183, 250);
  x.stroke();
  x.font = 'bold 30px Anton, Impact, sans-serif';
  x.textAlign = 'center';
  x.fillStyle = '#ffd23f';
  x.strokeStyle = INK;
  x.lineWidth = 4;
  x.strokeText('$TK', 176, 284);
  x.fillText('$TK', 176, 284);
  // waistband
  x.fillStyle = INK;
  x.fillRect(j.rhip.x - 22, j.rhip.y - 14, j.lhip.x - j.rhip.x + 44, 14);
  x.fillStyle = shade(accent, 0.45);
  x.fillRect(j.rhip.x - 19, j.rhip.y - 12, j.lhip.x - j.rhip.x + 38, 9);

  // the head: the top of the picture (a whole figure keeps just its head and shoulders), as big
  // as a fighting-game head, its bottom tucked into the hoodie's collar
  const side = Math.min(head.width, head.height * 1.0, head.width * 1.15);
  const crop = { w: head.width, h: Math.min(head.height, Math.max(side, head.width * 1.05)) };
  const s = Math.min(214 / crop.w, 222 / crop.h);
  const dw = crop.w * s;
  const dh = crop.h * s;
  const bottom = 238;
  x.drawImage(head, 0, 0, crop.w, crop.h, 172 - dw / 2, bottom - dh, dw, dh);

  // the whole figure, in draw order
  const art = canvas(BODY_W, BODY_H);
  const a = art.getContext('2d')!;
  for (const c of [L.legR, L.legL, L.body, L.armR, L.armL]) a.drawImage(c, 0, 0);
  return { layers: L, art, joints: BODY_JOINTS };
}

// ---------------------------------------------------------------- layers to a rig

const BONE = { pelvis: 0, torso: 1, head: 2, armL_up: 3, armL_lo: 4, armR_up: 5, armR_lo: 6, legL_up: 7, legL_lo: 8, legR_up: 9, legR_lo: 10 } as const;
const CELL = 14;

/** pack the layers into one texture and bind a skinned mesh per layer to the skeleton */
export function buildRig(L: Layers, J: Joints): { rig: RigData; atlas: HTMLCanvasElement } {
  const { w, h } = L;
  const j = fullJoints(J);
  const torso = Math.max(20, len(sub(mid(j.lsh, j.rsh), j.pelvis)));
  const ext = (p0: P, p1: P, f: number) => add(p1, mul(sub(p1, p0), f));
  const leadArm = J.lwr[0] >= J.rwr[0] ? 'L' : 'R';
  const leadLeg = J.lank[0] >= J.rank[0] ? 'L' : 'R';
  const other = (s: 'L' | 'R') => (s === 'L' ? 'R' : 'L');
  const draw = [`leg${other(leadLeg)}`, `leg${leadLeg}`, 'body', `arm${other(leadArm)}`, `arm${leadArm}`] as const;

  // crop every layer to what it draws
  type Crop = { x0: number; y0: number; x1: number; y1: number; a: Uint8ClampedArray; c: HTMLCanvasElement };
  const crops: Record<string, Crop> = {};
  for (const name of draw) {
    const c = L[name as keyof Layers] as HTMLCanvasElement;
    const a = pixels(c).data;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (a[(y * w + x) * 4 + 3] > 4) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) continue;
    crops[name] = { x0: Math.max(0, x0 - 2), y0: Math.max(0, y0 - 2), x1: Math.min(w, x1 + 3), y1: Math.min(h, y1 + 3), a, c };
  }
  // shelf packing
  const AW = 1024;
  const order = Object.keys(crops).sort((p, q) => crops[q].y1 - crops[q].y0 - (crops[p].y1 - crops[p].y0));
  const place: Record<string, [number, number]> = {};
  let px = 0;
  let py = 0;
  let shelf = 0;
  for (const n of order) {
    const cw = crops[n].x1 - crops[n].x0;
    const ch = crops[n].y1 - crops[n].y0;
    if (px + cw > AW) {
      px = 0;
      py += shelf + 2;
      shelf = 0;
    }
    place[n] = [px, py];
    px += cw + 2;
    shelf = Math.max(shelf, ch);
  }
  const AH = Math.max(1, py + shelf);
  const atlas = canvas(AW, AH);
  const ax = atlas.getContext('2d')!;
  for (const n of order) {
    const c = crops[n];
    ax.drawImage(c.c, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, place[n][0], place[n][1], c.x1 - c.x0, c.y1 - c.y0);
  }

  const meshes: RigMesh[] = [];
  for (const name of draw) {
    const c = crops[name];
    if (!c) continue;
    const [aX, aY] = place[name];
    const cols = Math.max(1, Math.ceil((c.x1 - c.x0) / CELL));
    const rows = Math.max(1, Math.ceil((c.y1 - c.y0) / CELL));
    const verts: P[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const vid = new Map<number, number>();
    const vert = (cx: number, cy: number) => {
      const key = cy * 10000 + cx;
      const have = vid.get(key);
      if (have !== undefined) return have;
      const vx = Math.min(c.x0 + cx * CELL, c.x1);
      const vy = Math.min(c.y0 + cy * CELL, c.y1);
      vid.set(key, verts.length);
      verts.push({ x: vx, y: vy });
      uv.push((aX + vx - c.x0) / AW, (aY + vy - c.y0) / AH);
      return verts.length - 1;
    };
    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        // does this cell draw anything?
        let any = false;
        const sx0 = c.x0 + cx * CELL;
        const sy0 = c.y0 + cy * CELL;
        for (let y = sy0; y <= Math.min(c.y1 - 1, sy0 + CELL) && !any; y++)
          for (let x = sx0; x <= Math.min(c.x1 - 1, sx0 + CELL); x++)
            if (c.a[(y * w + x) * 4 + 3] >= 6) {
              any = true;
              break;
            }
        if (!any) continue;
        const v00 = vert(cx, cy);
        const v10 = vert(cx + 1, cy);
        const v01 = vert(cx, cy + 1);
        const v11 = vert(cx + 1, cy + 1);
        idx.push(v00, v01, v10, v10, v01, v11);
      }
    // skin weights: at most two bones per vertex
    const wts: [number, number][] = [];
    if (name.startsWith('arm')) {
      const S = name[3] as 'L' | 'R';
      const s = S.toLowerCase();
      const sh = j[`${s}sh`];
      const el = j[`${s}el`];
      const wr = j[`${s}wr`];
      const up = BONE[`arm${S}_up`];
      const lo = BONE[`arm${S}_lo`];
      const elx = ext(el, wr, 0.6);
      for (const v of verts) {
        const [dUp, tUp] = segDist(v.x, v.y, sh, el);
        const [dLo] = segDist(v.x, v.y, el, elx);
        const blend = clamp(((dUp - dLo) / (torso * 0.12)) * 0.5 + 0.5, 0, 1);
        const nearSh = tUp < 0.15 ? clamp(1 - len(sub(v, sh)) / (torso * 0.25), 0, 1) : 0;
        if (nearSh > 0) wts.push([BONE.torso, nearSh * 0.6], [up, 1 - nearSh * 0.6]);
        else wts.push([up, 1 - blend], [lo, blend]);
      }
    } else if (name.startsWith('leg')) {
      const S = name[3] as 'L' | 'R';
      const s = S.toLowerCase();
      const hp = j[`${s}hip`];
      const kn = j[`${s}kn`];
      const an = j[`${s}ank`];
      const up = BONE[`leg${S}_up`];
      const lo = BONE[`leg${S}_lo`];
      const far = add(an, mul(sub(an, kn), 2));
      for (const v of verts) {
        if (v.y < hp.y) {
          wts.push([BONE.pelvis, 0.5], [up, 0.5]);
          continue;
        }
        const [dUp] = segDist(v.x, v.y, hp, kn);
        const [dLo] = segDist(v.x, v.y, kn, far);
        const blend = clamp(((dUp - dLo) / (torso * 0.15)) * 0.5 + 0.5, 0, 1);
        wts.push([up, 1 - blend], [lo, blend]);
      }
    } else {
      // body: pelvis at the waist, torso above, head above the neck
      for (const v of verts) {
        if (v.y < j.neck.y) {
          const k = clamp((j.neck.y - v.y) / (torso * 0.15), 0, 1);
          wts.push([BONE.head, k], [BONE.torso, 1 - k]);
        } else {
          const k = clamp((v.y - (j.pelvis.y - torso * 0.25)) / (torso * 0.3), 0, 1);
          wts.push([BONE.pelvis, k], [BONE.torso, 1 - k]);
        }
      }
    }
    meshes.push({ name, v: verts.flatMap((p) => [p.x, p.y]), uv, i: idx, w: wts });
  }
  const joints: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries(j)) joints[k] = [v.x, v.y];
  return { rig: { w, h, atlas: [AW, AH], joints, leadArm, leadLeg, meshes }, atlas };
}

/** a made fighter's joints, checked (they arrive from the other player online too) */
export function validJoints(J: unknown, w = 4000, h = 4000): J is Joints {
  if (!J || typeof J !== 'object') return false;
  return JOINT_NAMES.every((k) => {
    const v = (J as Record<string, unknown>)[k];
    return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) && v[0] >= -50 && v[0] <= w + 50 && v[1] >= -50 && v[1] <= h + 50;
  });
}
