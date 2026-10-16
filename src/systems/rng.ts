// Seeded random numbers for anything that changes the fight (spreads, mix-ups, random specials).
// Online, both players seed it the same way so their games stay identical; visual-only effects
// (particles, confetti) keep using Math.random.

let s = 0x9e3779b9;

export const rng = {
  seed(n: number) {
    s = n >>> 0 || 0x9e3779b9;
  },
  /** float in [0, 1) (mulberry32) */
  next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
  /** current state, for desync checks */
  get state() {
    return s;
  },
};
