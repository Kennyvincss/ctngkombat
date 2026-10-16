import type { SpecialSpec } from '../data/moveTypes';
import type { Difficulty, FightClass } from '../data/types';
import { CPU_SETTINGS } from '../data/tuning';
import { emptyRaw, type Button, type InputSource, type RawInput } from '../systems/input';
import type { Fighter } from './Fighter';

// Preferred distance per class [min, max]
const RANGE: Record<FightClass, [number, number]> = {
  zoner: [420, 640],
  rushdown: [90, 170],
  defensive: [200, 300],
  balanced: [160, 280],
  trickster: [150, 380],
  powerhouse: [110, 200],
};

type Plan = 'approach' | 'retreat' | 'hold' | 'block' | 'crouchblock' | 'jumpin' | 'idle';

/** CPU opponent. Produces raw input each frame, like a player would. */
export class CpuBrain implements InputSource {
  me!: Fighter;
  private plan: Plan = 'idle';
  private planUntil = 0;
  private frame = 0;
  private press: Button | null = null;
  private pressHold = 0;
  private threatSeen = -1;
  private threatDecision: 'block' | 'ignore' | null = null;
  private lastSpecial = -999;
  /** training dummy behaviour, or null for full AI */
  dummy: 'stand' | 'block' | 'crouch' | 'jump' | null = null;
  enabled = true;

  constructor(private difficulty: Difficulty) {}

  private get cfg() {
    return CPU_SETTINGS[this.difficulty];
  }

  poll(): RawInput {
    this.frame++;
    const r = emptyRaw();
    if (!this.me || !this.enabled) return r;
    const me = this.me;
    const o = me.opp;
    if (this.dummy) return this.dummyInput(r);
    if (me.locked) return r;

    const dist = Math.abs(o.x - me.x);
    const fwdRight = me.facing > 0;
    const setDir = (fwd: boolean, back: boolean) => {
      r.right = fwdRight ? fwd : back;
      r.left = fwdRight ? back : fwd;
    };

    // ---------------- defense: react to threats
    const threat = this.threat(dist);
    if (threat) {
      if (this.threatSeen < 0) {
        this.threatSeen = this.frame;
        this.threatDecision = null;
      }
      if (this.threatDecision === null && this.frame - this.threatSeen >= this.cfg.react) {
        const cls = me.tuning.cls;
        const bonus = cls === 'defensive' ? 0.15 : 0;
        this.threatDecision = Math.random() < this.cfg.blockChance + bonus ? 'block' : 'ignore';
        // counters: read the attack with a counter stance
        if (this.threatDecision === 'block' && threat !== 'projectile' && Math.random() < 0.25) {
          const n = this.pickSpecial(['defense'], dist);
          if (n) {
            this.pressButton(`s${n}` as Button);
            this.threatDecision = 'ignore';
          }
        }
      }
      if (this.threatDecision === 'block') {
        setDir(false, true);
        r.down = threat === 'low';
        this.applyPress(r);
        return r;
      }
    } else {
      this.threatSeen = -1;
    }
    // keep holding block through blockstun
    if (me.state === 'blockstun') {
      setDir(false, true);
      r.down = o.atk?.spec.type === 'low';
      return r;
    }

    const free = ['idle', 'walk', 'crouch', 'land'].includes(me.state);
    const attacking = me.state === 'attack' || me.state === 'special';

    // ---------------- combos: chain / cancel after a hit
    if (me.state === 'attack' && me.atk?.connected === 'hit') {
      const roll = Math.random();
      if (roll < 0.25 + this.cfg.aggression * 0.4) {
        const n = this.pickSpecial(['close', 'mid', 'any'], dist);
        if (n && this.frame - this.lastSpecial > 30) this.pressButton(`s${n}` as Button);
        else if (me.atk.spec.light && me.atk.chain < 2) this.pressButton(Math.random() < 0.5 ? 'lp' : 'hp');
      }
    }

    if (free) {
      // ---------------- anti-air
      if (o.airborne && o.vy > -4 && dist < 280 && Math.random() < this.cfg.antiAir * 0.2) {
        const n = this.pickSpecial(['antiair'], dist);
        if (n) this.pressButton(`s${n}` as Button);
        else {
          r.down = true;
          this.pressButton('hp');
        }
      }
      // ---------------- punish whiffed moves
      else if (this.cfg.punish && this.opponentRecovering() && dist < 240) {
        const n = this.pickSpecial(['close', 'mid'], dist);
        if (n) this.pressButton(`s${n}` as Button);
        else this.pressButton('hp');
      }
      // ---------------- specials
      else if (Math.random() < this.cfg.specialChance && this.frame - this.lastSpecial > 50) {
        const tags: NonNullable<SpecialSpec['ai']>[] = dist > 380 ? ['far', 'buff', 'any'] : dist > 180 ? ['mid', 'far', 'any'] : ['close', 'mid', 'any'];
        const n = this.pickSpecial(tags, dist);
        if (n) {
          this.pressButton(`s${n}` as Button);
          // EX when rich in meter
          if (me.meter >= 200 && Math.random() < 0.4) r.buttons.ex = true;
        }
      }
      // ---------------- normals in range
      else if (dist < 175 && Math.random() < 0.06 + this.cfg.aggression * 0.08) {
        const opts: [Button, boolean][] = [['lp', false], ['lk', false], ['hp', false], ['hk', false], ['lk', true], ['hk', true], ['lp', true]];
        const [b, low] = opts[Math.floor(Math.random() * opts.length)];
        if (low) r.down = true;
        this.pressButton(b);
      }
    }

    // ---------------- movement plan
    if (this.frame >= this.planUntil) this.choosePlan(dist);
    if (free && !this.press) {
      switch (this.plan) {
        case 'approach':
          setDir(true, false);
          if (Math.random() < 0.004 * this.cfg.aggression * 4 && dist > 250) r.right = r.left = false;
          break;
        case 'retreat':
          setDir(false, true);
          break;
        case 'jumpin':
          setDir(true, false);
          r.up = true;
          this.plan = 'approach';
          break;
        case 'crouchblock':
          setDir(false, true);
          r.down = true;
          break;
        case 'block':
          setDir(false, true);
          break;
        default:
          break;
      }
    }
    // jump attacks: press a heavy on the way down
    if (me.state === 'jump' && !me.airAttackUsed && me.vy > 0 && dist < 200) this.pressButton(Math.random() < 0.5 ? 'hp' : 'hk');

    if (attacking) r.left = r.right = false;
    this.applyPress(r);
    return r;
  }

  private dummyInput(r: RawInput): RawInput {
    const me = this.me;
    const back = me.facing > 0 ? 'left' : 'right';
    switch (this.dummy) {
      case 'block':
        r[back] = true;
        break;
      case 'crouch':
        r[back] = true;
        r.down = true;
        break;
      case 'jump':
        r.up = this.frame % 70 < 2;
        break;
    }
    return r;
  }

  private threat(dist: number): 'high' | 'low' | 'projectile' | null {
    const me = this.me;
    const o = me.opp;
    const w = me.world;
    for (const e of w.entities) {
      if (e.owner !== o || e.dead) continue;
      const hb = e.hitbox();
      if (!hb) continue;
      const dx = hb.x + hb.w / 2 - me.x;
      const approaching = Math.abs(dx) < 340;
      if (approaching) return e.props().type === 'low' ? 'low' : 'projectile';
    }
    if (dist > 360) return null;
    if (o.state === 'attack' && o.atk) {
      const a = o.atk;
      if (a.f <= a.spec.startup + a.spec.active) return a.spec.type === 'low' ? 'low' : 'high';
    }
    if (o.state === 'special' && o.action) {
      if (o.action.lowProfile) return 'low';
      return 'high';
    }
    if (o.state === 'jump' && dist < 220 && o.vy > 0) return 'high';
    return null;
  }

  private opponentRecovering(): boolean {
    const o = this.me.opp;
    if (o.state === 'attack' && o.atk) {
      const a = o.atk;
      return a.f > a.spec.startup + a.spec.active + 2 && !a.connected;
    }
    if (o.state === 'special' && o.action && !o.action.inStartup() && !o.action.hit) return true;
    return false;
  }

  private choosePlan(dist: number) {
    const me = this.me;
    const [lo, hi] = RANGE[me.tuning.cls];
    const ag = this.cfg.aggression;
    let plan: Plan = 'hold';
    if (dist > hi) plan = Math.random() < 0.3 + ag * 0.6 ? 'approach' : 'hold';
    else if (dist < lo) plan = me.tuning.cls === 'zoner' || Math.random() < 0.3 ? 'retreat' : 'hold';
    else plan = Math.random() < ag * 0.5 ? 'approach' : Math.random() < 0.25 ? 'block' : 'hold';
    if (dist > 200 && dist < 420 && Math.random() < ag * 0.12) plan = 'jumpin';
    if (me.tuning.cls === 'defensive' && Math.random() < 0.25) plan = 'crouchblock';
    this.plan = plan;
    this.planUntil = this.frame + 20 + Math.floor(Math.random() * 40);
  }

  private pickSpecial(tags: NonNullable<SpecialSpec['ai']>[], dist: number): 1 | 2 | 3 | 0 {
    const me = this.me;
    if (me.status.nospecials > 0 || me.specialCD > 0) return 0;
    const options: (1 | 2 | 3)[] = [];
    me.moves.forEach((m, i) => {
      const tag = m.ai ?? 'any';
      if (!tags.includes(tag)) return;
      if (m.mech === 'super' && me.meter < m.cost) return;
      if (tag === 'buff' && me.buffs.length > 0) return;
      if (tag === 'close' && dist > 200) return;
      if (m.mech === 'grab' && dist > (m.run ? 500 : 170)) return;
      options.push((i + 1) as 1 | 2 | 3);
    });
    if (!options.length) return 0;
    this.lastSpecial = this.frame;
    return options[Math.floor(Math.random() * options.length)];
  }

  private pressButton(b: Button) {
    if (this.press) return;
    this.press = b;
    this.pressHold = 0;
  }

  /** Buttons need a press then a release so the controller sees an edge. */
  private applyPress(r: RawInput) {
    if (!this.press) return;
    this.pressHold++;
    if (this.pressHold <= 2) r.buttons[this.press] = true;
    if (this.pressHold >= 4) this.press = null;
  }
}
