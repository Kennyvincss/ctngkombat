import Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Raw input: what a device says is held this frame. Directions are absolute
// (left/right on screen); the Controller converts them to forward/back.
// ---------------------------------------------------------------------------

// The simple buttons players use (keyboard, gamepad and touch alike):
//   punch, kick       forward or down + the button = the power version
//   special           the fighter's special: alone = 1st, forward = 2nd, down = 3rd
//   block             hold to guard (holding back works too)
//   combo             punch, kick, power punch, then the special if it's ready
//   finisher          EX special (1 bar); after the deciding round, the fatality
// The classic buttons (lp..fat) are what the fight engine runs on; the CPU and the intro press
// them directly, and the Controller turns the simple buttons into them.
// ok / back only drive menus; start pauses.
export const BUTTONS = ['lp', 'hp', 'lk', 'hk', 's1', 's2', 's3', 'ex', 'fat', 'block', 'start', 'punch', 'kick', 'special', 'combo', 'finisher', 'ok', 'back'] as const;
export type Button = (typeof BUTTONS)[number];

export interface RawInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  buttons: Record<Button, boolean>;
}

export function emptyRaw(): RawInput {
  return { left: false, right: false, up: false, down: false, buttons: Object.fromEntries(BUTTONS.map((b) => [b, false])) as Record<Button, boolean> };
}

export interface InputSource {
  poll(): RawInput;
  destroy?(): void;
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

type KeyMap = { left: string[]; right: string[]; up: string[]; down: string[] } & Partial<Record<Button, string[]>>;

/** Player 1: W A S D to move, and six keys in a block like the touch buttons: U I O / J K L */
export const KEYMAP_P1: KeyMap = {
  left: ['A'],
  right: ['D'],
  up: ['W'],
  down: ['S'],
  punch: ['J'],
  kick: ['K'],
  special: ['L'],
  combo: ['U'],
  block: ['I'],
  finisher: ['O'],
  start: ['ENTER'],
  ok: ['J'],
};

/** Player 2: arrows, and the same block on the numpad: 4 5 6 / 1 2 3 */
export const KEYMAP_P2: KeyMap = {
  left: ['LEFT'],
  right: ['RIGHT'],
  up: ['UP'],
  down: ['DOWN'],
  punch: ['NUMPAD_ONE'],
  kick: ['NUMPAD_TWO'],
  special: ['NUMPAD_THREE'],
  combo: ['NUMPAD_FOUR'],
  block: ['NUMPAD_FIVE'],
  finisher: ['NUMPAD_SIX'],
  start: ['NUMPAD_ADD'],
  ok: ['NUMPAD_ONE'],
};

/** In 1-player modes P1 can also use the arrow keys with Z X C V (+ Shift to block), friendlier on laptops. */
export const KEYMAP_SOLO_EXTRA: Partial<KeyMap> = {
  left: ['LEFT'],
  right: ['RIGHT'],
  up: ['UP'],
  down: ['DOWN'],
  punch: ['Z'],
  kick: ['X'],
  special: ['C'],
  finisher: ['V'],
  block: ['SHIFT'],
  ok: ['Z'],
};

export class KeyboardSource implements InputSource {
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};

  constructor(scene: Phaser.Scene, map: KeyMap, extra?: Partial<KeyMap>) {
    const kb = scene.input.keyboard!;
    const KC = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
    for (const name of Object.keys(map) as (keyof KeyMap)[]) {
      const names = [...(map[name] ?? []), ...((extra && extra[name]) || [])];
      this.keys[name] = names.filter((n) => KC[n] !== undefined).map((n) => kb.addKey(KC[n], true, false));
    }
  }

  /** when the last poll happened: a key tapped and released since then still counts once */
  private lastPoll = performance.now();

  private down(name: string): boolean {
    const list = this.keys[name];
    if (!list) return false;
    for (const k of list) if (k.isDown || k.timeDown > this.lastPoll) return true;
    return false;
  }

  poll(): RawInput {
    const r = emptyRaw();
    const now = performance.now();
    r.left = this.down('left');
    r.right = this.down('right');
    r.up = this.down('up');
    r.down = this.down('down');
    for (const b of BUTTONS) r.buttons[b] = this.down(b);
    this.lastPoll = now;
    return r;
  }
}

// ---------------------------------------------------------------------------
// Gamepad (standard mapping: Xbox, PlayStation and most Bluetooth/USB pads). Pad index 0 → P1,
// 1 → P2.   Xbox / PlayStation:
//   X / □  PUNCH        A / ✕  KICK        Y / △  SPECIAL     B / ○  BLOCK (hold)
//   RB / R1 COMBO       RT / R2 FINISHER   LB / L1, LT / L2 also BLOCK
//   D-pad or left stick move · Start (or Select) pauses · menus: A / ✕ ok, B / ○ back
// ---------------------------------------------------------------------------

export class GamepadSource implements InputSource {
  constructor(private scene: Phaser.Scene, private index: number) {}

  poll(): RawInput {
    const r = emptyRaw();
    const gp = this.scene.input.gamepad;
    const pad = gp && gp.total > 0 ? gp.getPad(this.index) : undefined;
    if (!pad || !pad.connected) return r;
    const ax = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
    const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
    r.left = pad.left || ax < -0.45;
    r.right = pad.right || ax > 0.45;
    r.up = pad.up || ay < -0.55;
    r.down = pad.down || ay > 0.55;
    const b = (i: number) => (pad.buttons[i] ? pad.buttons[i].pressed : false);
    r.buttons.punch = b(2);
    r.buttons.kick = b(0);
    r.buttons.special = b(3);
    r.buttons.block = b(1) || b(4) || b(6);
    r.buttons.combo = b(5);
    r.buttons.finisher = b(7);
    r.buttons.start = b(9) || b(8);
    r.buttons.ok = b(0);
    r.buttons.back = b(1);
    return r;
  }
}

/** Merge several sources (keyboard + gamepad + touch) into one. */
export class MergedSource implements InputSource {
  constructor(private sources: InputSource[]) {}
  poll(): RawInput {
    const r = emptyRaw();
    for (const s of this.sources) {
      const p = s.poll();
      r.left ||= p.left;
      r.right ||= p.right;
      r.up ||= p.up;
      r.down ||= p.down;
      for (const b of BUTTONS) r.buttons[b] ||= p.buttons[b];
    }
    return r;
  }
  destroy() {
    for (const s of this.sources) s.destroy?.();
  }
}

/** A source whose state is written by code (CPU, touch overlay, training dummy). */
export class ScriptedSource implements InputSource {
  state: RawInput = emptyRaw();
  poll(): RawInput {
    return this.state;
  }
  clear() {
    this.state = emptyRaw();
  }
}

// ---------------------------------------------------------------------------
// Controller: turns raw input into per-frame intent relative to facing, with
// edge detection, the simple buttons, a short input buffer, motion inputs (↓↘→, →↓↘, ↓↙←,
// ↓↓→), dash double-taps and
// the status effects that mess with input (reversed controls, input lag).
// ---------------------------------------------------------------------------

export interface Intent {
  /** numpad direction relative to facing: 6 = forward, 4 = back, 2 = down, 8 = up */
  dir: number;
  fwd: boolean;
  back: boolean;
  up: boolean;
  down: boolean;
  held: Record<Button, boolean>;
  pressed: Record<Button, boolean>;
  /** special triggered this frame (1..3) or 0 */
  special: 0 | 1 | 2 | 3;
  /** the special was triggered with a heavy button or the EX button: wants the EX version */
  exWanted: boolean;
  /** which button(s) to watch for charge moves */
  specialButton: Button | null;
  dash: 0 | 1 | -1; // 1 forward dash, -1 back dash
  fatality: boolean;
}

const HISTORY = 24;
/** a press is remembered this many frames, so one made just before the fighter can act still happens */
const BUFFER = 10;
const BUFFERED = ['lp', 'hp', 'lk', 'hk'] as const;
type Buffered = (typeof BUFFERED)[number];

export class Controller {
  private prev = emptyRaw();
  private dirHistory: { dir: number; frame: number }[] = [];
  private frame = 0;
  private lastTap: Record<'f' | 'b', number> = { f: -100, b: -100 };
  private lastHorz = 5;
  private lagQueue: RawInput[] = [];
  reversed = false;
  lagFrames = 0;
  /** last intent, for Debug Mode to display */
  last: Intent | null = null;
  /** set by the fighter: can a special be used now? (COMBO only ends in a special when it can) */
  specialReady: () => boolean = () => true;
  /** set by the fighter: is it free to start an attack? (COMBO waits for that) */
  canAct: () => boolean = () => true;
  private comboAsked = -100;
  private buffered: Partial<Record<Buffered, number>> = {};
  private bufSpecial: { n: 1 | 2 | 3; button: Button; ex: boolean; frame: number } | null = null;
  private comboQueue: { at: number; b: Button }[] = [];

  constructor(public source: InputSource) {}

  read(facing: number): Intent {
    this.frame++;
    let raw = this.source.poll();
    // input lag status: delay raw input by N frames
    this.lagQueue.push(cloneRaw(raw));
    const keep = Math.max(1, this.lagFrames + 1);
    while (this.lagQueue.length > keep) this.lagQueue.shift();
    raw = this.lagQueue[0];
    if (this.reversed) raw = { ...raw, left: raw.right, right: raw.left };

    let fwd = facing > 0 ? raw.right && !raw.left : raw.left && !raw.right;
    let back = facing > 0 ? raw.left && !raw.right : raw.right && !raw.left;
    const up = raw.up && !raw.down;
    const down = raw.down && !raw.up;
    // the block button (touch) holds guard: same as holding back, without tapping out dashes
    const stickH = fwd ? 1 : back ? -1 : 0;
    if (raw.buttons.block) {
      fwd = false;
      back = true;
    }
    const h = fwd ? 1 : back ? -1 : 0;
    const v = up ? 1 : down ? -1 : 0;
    const dir = 5 + h + v * 3;

    const last = this.dirHistory[this.dirHistory.length - 1];
    if (!last || last.dir !== dir) this.dirHistory.push({ dir, frame: this.frame });
    while (this.dirHistory.length > HISTORY) this.dirHistory.shift();

    const pressed = {} as Record<Button, boolean>;
    for (const b of BUTTONS) pressed[b] = raw.buttons[b] && !this.prev.buttons[b];

    // dash: neutral → fwd → neutral → fwd within 14 frames
    let dash: 0 | 1 | -1 = 0;
    const horz = stickH === 1 && v === 0 ? 6 : stickH === -1 && v === 0 ? 4 : 5;
    if (horz !== this.lastHorz && horz !== 5) {
      const key = horz === 6 ? 'f' : 'b';
      if (this.frame - this.lastTap[key] <= 14) {
        dash = horz === 6 ? 1 : -1;
        this.lastTap[key] = -100;
      } else this.lastTap[key] = this.frame;
    }
    this.lastHorz = horz;

    // specials from the classic buttons: motion inputs and the direct special buttons
    let special: 0 | 1 | 2 | 3 = 0;
    let exWanted = false;
    let specialButton: Button | null = null;
    const punch = pressed.lp || pressed.hp;
    const kick = pressed.lk || pressed.hk;
    if (punch && this.motion([6, 2, 3], 18)) {
      special = 2;
      specialButton = pressed.hp ? 'hp' : 'lp';
    } else if (punch && this.motion([2, 3, 6], 16)) {
      special = 1;
      specialButton = pressed.hp ? 'hp' : 'lp';
    } else if (kick && this.motion([2, 1, 4], 16)) {
      special = 3;
      specialButton = pressed.hk ? 'hk' : 'lk';
    }
    if (special) exWanted = specialButton === 'hp' || specialButton === 'hk' || raw.buttons.ex;
    if (!special) {
      for (const [b, n] of [['s1', 1], ['s2', 2], ['s3', 3]] as const) {
        if (pressed[b]) {
          special = n;
          specialButton = b;
          exWanted = raw.buttons.ex || raw.buttons.hp || raw.buttons.hk;
          break;
        }
      }
    }
    let fatality = pressed.fat || (pressed.hp && this.motion([2, 5, 2, 6], 30, true));

    // the simple buttons. The direction picks the version: forward or down = power, and for
    // the special: alone = 1st, forward = 2nd, down = 3rd
    const power = fwd || down;
    const pick: 1 | 2 | 3 = down ? 3 : fwd ? 2 : 1;
    // COMBO pressed while still busy (finishing a move, landing) starts as soon as it can
    if (pressed.combo && !this.comboQueue.length) this.comboAsked = this.frame;
    if (this.frame - this.comboAsked <= 30 && !this.comboQueue.length && this.canAct()) {
      this.comboAsked = -100;
      const n = this.frame;
      // spaced so each press lands in the buffer just before the previous attack ends, even
      // when nothing connects; on a hit they chain sooner
      this.comboQueue = [
        { at: n, b: 'lp' },
        { at: n + 10, b: 'lk' },
        { at: n + 24, b: 'hp' },
        { at: n + 52, b: 's1' },
      ];
    }
    for (const q of this.comboQueue) {
      if (q.at !== this.frame) continue;
      if (q.b === 's1') {
        if (this.specialReady() && !special) {
          special = 1;
          specialButton = 'combo';
        }
      } else pressed[q.b] = true;
    }
    this.comboQueue = this.comboQueue.filter((q) => q.at > this.frame);
    if (pressed.punch) pressed[power ? 'hp' : 'lp'] = true;
    if (pressed.kick) pressed[power ? 'hk' : 'lk'] = true;
    if (pressed.special && !special) {
      special = pick;
      specialButton = 'special';
      exWanted = raw.buttons.ex;
    }
    if (pressed.finisher) {
      // EX special, or the fatality during FINISH THEM
      fatality = true;
      special = pick;
      specialButton = 'finisher';
      exWanted = true;
    }

    // input buffer: attacks and specials pressed a moment too early still come out
    for (const b of BUFFERED) {
      if (pressed[b]) this.buffered[b] = this.frame;
      const t = this.buffered[b];
      if (t !== undefined && this.frame - t <= BUFFER) pressed[b] = true;
      else delete this.buffered[b];
    }
    if (special && specialButton) this.bufSpecial = { n: special, button: specialButton, ex: exWanted, frame: this.frame };
    else if (this.bufSpecial && this.frame - this.bufSpecial.frame <= BUFFER) {
      special = this.bufSpecial.n;
      specialButton = this.bufSpecial.button;
      exWanted = this.bufSpecial.ex;
    } else this.bufSpecial = null;

    this.prev = cloneRaw(raw);
    const intent: Intent = {
      dir,
      fwd,
      back,
      up,
      down,
      held: { ...raw.buttons },
      pressed,
      special,
      exWanted,
      specialButton,
      dash,
      fatality,
    };
    this.last = intent;
    return intent;
  }

  /** True if the recent direction history contains `seq` in order within `window` frames. */
  private motion(seq: number[], window: number, strict = false): boolean {
    const hist = this.dirHistory.filter((h) => this.frame - h.frame <= window);
    if (!hist.length) return false;
    // the motion must end on the direction held now (so walking forward then ↓↘→ isn't read as →↓↘)
    const end = hist[hist.length - 1].dir;
    const want = seq[seq.length - 1];
    if (end !== want && (strict || !looseMatch(end, want))) return false;
    let i = seq.length - 1;
    for (let k = hist.length - 1; k >= 0 && i >= 0; k--) {
      const d = hist[k].dir;
      if (d === seq[i] || (!strict && looseMatch(d, seq[i]))) i--;
    }
    return i < 0;
  }

  /** Clear motion history and buffered presses (after a special fires, so it doesn't re-trigger). */
  flush() {
    this.dirHistory = [];
    this.consume();
  }

  /** forget buffered presses: the fighter acted on them */
  consume() {
    this.buffered = {};
    this.bufSpecial = null;
  }
}

// Allow slightly sloppy inputs: a diagonal counts for its neighbouring cardinal on pads/touch.
function looseMatch(actual: number, wanted: number): boolean {
  if (wanted === 6) return actual === 9;
  if (wanted === 4) return actual === 7;
  return false;
}

function cloneRaw(r: RawInput): RawInput {
  return { left: r.left, right: r.right, up: r.up, down: r.down, buttons: { ...r.buttons } };
}
