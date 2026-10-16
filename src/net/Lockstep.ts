import { BUTTONS, emptyRaw, ScriptedSource, type InputSource, type RawInput } from '../systems/input';
import { net } from './Net';

// Delay-based lockstep: both games run the same deterministic fight and only exchange
// button states. Local input for tick T is applied at tick T + INPUT_DELAY, which gives it
// time to reach the other player; a tick runs only when both players' inputs for it are in.

export const INPUT_DELAY = 3;
const SUM_EVERY = 120;

const DIRS = ['left', 'right', 'up', 'down'] as const;
const KEYS = BUTTONS.filter((b) => b !== 'start');

export function packInput(r: RawInput): number {
  let k = 0;
  DIRS.forEach((d, i) => {
    if (r[d]) k |= 1 << i;
  });
  KEYS.forEach((b, i) => {
    if (r.buttons[b]) k |= 1 << (i + 4);
  });
  return k;
}

export function unpackInput(k: number): RawInput {
  const r = emptyRaw();
  DIRS.forEach((d, i) => (r[d] = !!(k & (1 << i))));
  KEYS.forEach((b, i) => (r.buttons[b] = !!(k & (1 << (i + 4)))));
  return r;
}

export class Lockstep {
  /** what each fighter's controller reads */
  readonly sources: [ScriptedSource, ScriptedSource] = [new ScriptedSource(), new ScriptedSource()];
  private local = new Map<number, number>();
  private sums = new Map<number, number>();
  /** ms spent waiting for the other player (for the "waiting" message) */
  waitMs = 0;
  desync = false;

  constructor(
    readonly match: number,
    readonly side: 0 | 1,
    private device: InputSource,
  ) {
    net.startMatch(match);
    for (let f = 0; f < INPUT_DELAY; f++) this.local.set(f, 0);
  }

  private remote() {
    let m = net.inputs.get(this.match);
    if (!m) net.inputs.set(this.match, (m = new Map()));
    return m;
  }

  /** sample this player's input for tick + delay; true when the tick can run */
  ready(tick: number): boolean {
    const f = tick + INPUT_DELAY;
    if (!this.local.has(f)) {
      const k = packInput(this.device.poll());
      this.local.set(f, k);
      net.send({ t: 'in', m: this.match, f, k });
    }
    return tick < INPUT_DELAY || this.remote().has(tick);
  }

  /** feed both fighters the inputs for this tick */
  apply(tick: number) {
    const mine = this.local.get(tick) ?? 0;
    const theirs = tick < INPUT_DELAY ? 0 : (this.remote().get(tick) ?? 0);
    this.sources[this.side].state = unpackInput(mine);
    this.sources[1 - this.side].state = unpackInput(theirs);
    this.local.delete(tick - 240);
    this.remote().delete(tick - 240);
  }

  /** compare a fingerprint of the fight every couple of seconds */
  check(tick: number, hash: () => number) {
    if (tick % SUM_EVERY !== 0) return;
    const h = hash();
    this.sums.set(tick, h);
    net.send({ t: 'sum', m: this.match, f: tick, h });
    const theirs = net.sums.get(this.match);
    if (!theirs) return;
    for (const [f, rh] of theirs) {
      const mh = this.sums.get(f);
      if (mh === undefined) continue;
      if (mh !== rh && !this.desync) {
        this.desync = true;
        console.warn(`[online] desync at tick ${f}: ${mh} vs ${rh}`);
      }
      theirs.delete(f);
      this.sums.delete(f);
    }
  }
}
