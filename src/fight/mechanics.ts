import Phaser from 'phaser';
import type {
  BuffMoveSpec,
  CounterSpec,
  DecoySpec,
  DropSpec,
  GrabSpec,
  MobilitySpec,
  ProjectileSpec,
  RushSpec,
  SpecialSpec,
  StatusMoveSpec,
  StrikeSpec,
  StringSpec,
  SuperSpec,
  TeleportSpec,
  TrapSpec,
} from '../data/moveTypes';
import type { AnimKey, Box, HitType } from '../data/normals';
import type { Intent, Button } from '../systems/input';
import type { Fighter } from './Fighter';
import { METER_BAR } from './Fighter';
import { Clone, Drop, Hazard, Projectile, Trap, Wave } from './entities';
import type { ActiveHit, HitInfo, HitProps, HitResult } from './types';

// ---------------------------------------------------------------------------
// An Action is a running special move. The Fighter calls update() each frame
// until it returns true. `hit` is the hitbox active this frame (if any).
// ---------------------------------------------------------------------------

export interface Action {
  hit: ActiveHit | null;
  lowProfile: boolean;
  armored: boolean;
  /** pushboxes ignore this fighter (passes through the opponent) */
  pass: boolean;
  update(): boolean;
  inStartup(): boolean;
  onConnect?(r: HitResult): void;
  onInterrupt?(): void;
  /** counter stances: return true to cancel the incoming hit */
  onAttacked?(info: HitInfo): boolean;
  onLand?(): void;
}

export const DAMAGE_CAP = 180;
export const GRAB_CAP = 220;
export const SUPER_CAP = 350;

const BODY_BOX: Box = { x: -10, y: -270, w: 130, h: 250 };

abstract class BaseAction implements Action {
  f = 0;
  hit: ActiveHit | null = null;
  lowProfile = false;
  armored = false;
  pass = false;
  protected startup = 0;
  protected readonly color: number;

  constructor(protected u: Fighter, protected ex: boolean, protected spec: SpecialSpec, protected button: Button | null) {
    this.color = spec.color ?? u.accent;
  }

  get w() {
    return this.u.world;
  }
  get opp() {
    return this.u.opp;
  }

  abstract update(): boolean;

  inStartup() {
    return this.f <= this.startup;
  }

  /**
   * Per-hit damage: the move's total (scaled for EX, charge and low health) is
   * capped (SPEC: 18% for specials, 22% grabs, 35% supers) then split over its hits.
   */
  dmg(base: number, o: { hits?: number; mult?: number; cap?: number } = {}) {
    let d = base * (this.ex ? 1.3 : 1) * (o.mult ?? 1);
    if (this.spec.lowHp) d *= this.u.lowHpMult;
    return Math.min(o.cap ?? DAMAGE_CAP, d) / (o.hits ?? 1);
  }

  props(base: number, o: Partial<HitProps> = {}): HitProps {
    return this.propsRaw(this.dmg(base), o);
  }

  propsRaw(damage: number, o: Partial<HitProps> = {}): HitProps {
    return {
      damage,
      hitstun: 22,
      blockstun: 16,
      pushback: 9,
      type: 'mid',
      special: true,
      projectile: false,
      color: this.color,
      ...o,
    };
  }

  setHit(box: Box, props: HitProps, newId = false) {
    if (!this.hit || newId) this.hit = { id: this.w.nextHitId(), box, props };
    else {
      this.hit.box = box;
      this.hit.props = props;
    }
  }

  held(): boolean {
    if (!this.button) return false;
    return this.u.intent.held[this.button];
  }

  play(anim: AnimKey, restart = true) {
    this.u.view.play(anim, { restart });
  }

  faceOpp() {
    this.u.facing = this.opp.x >= this.u.x ? 1 : -1;
  }
}

// ---------------------------------------------------------------- projectile

class ProjectileAction extends BaseAction {
  private fired = 0;
  constructor(u: Fighter, ex: boolean, private s: ProjectileSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('cast');
  }
  update() {
    this.f++;
    const s = this.s;
    const shots = (s.shots ?? 1) + (this.ex && (s.shots ?? 1) > 1 ? 2 : 0);
    const interval = s.interval ?? 6;
    if (this.f >= s.startup && this.fired < shots && (this.f - s.startup) % interval === 0) {
      this.fire(this.fired, shots);
      this.fired++;
    }
    if (s.advance && this.fired < shots && this.f >= s.startup) this.u.vx = s.advance * this.u.facing;
    else this.u.vx *= 0.7;
    const end = s.startup + (shots - 1) * interval + s.recovery;
    return this.f >= end;
  }
  private fire(i: number, shots: number) {
    const s = this.s;
    const u = this.u;
    const y = u.y - (s.y ?? 190) + (s.spreadY ? (Math.random() - 0.5) * s.spreadY : 0);
    let tint: number | undefined;
    let onHit: ((v: Fighter) => void) | undefined;
    let status = s.status;
    const hits = (s.hits ?? 1) + (this.ex && (s.hits ?? 1) > 1 ? 1 : 0);
    if (s.randomEffect) {
      const roll = Math.floor(Math.random() * 4);
      tint = [0xff5d5d, 0x7dd3ff, 0xb57dff, 0x7dff9a][roll];
      if (roll === 0) onHit = (v) => v.world.fx.popup(v.x, v.y - 330, 'CRINGE', 0xff5d5d, 28);
      if (roll === 1) status = { kind: 'freeze', frames: 36 };
      if (roll === 2) status = { kind: 'reverse', frames: 150 };
      if (roll === 3) onHit = () => u.heal(30);
    }
    this.w.addEntity(
      new Projectile(
        u,
        {
          art: s.art,
          x: u.x + u.facing * 70,
          y,
          vx: s.speed * u.facing * (this.ex ? 1.2 : 1),
          vy: s.vy,
          gravity: s.gravity,
          // barrages: the whole volley shares the damage cap
          damage: this.dmg(s.damage * shots, { hits: hits * shots }),
          hits,
          hitEvery: s.hitEvery,
          life: s.life,
          track: s.track,
          bounceFloor: s.bounceFloor,
          bounceWall: s.bounceWall,
          scale: s.scale,
          spin: s.spin,
          low: s.low,
          radius: s.radius,
          color: tint ?? this.color,
          status,
          ground: s.ground,
          knockdown: s.knockdown,
          limit: i === 0,
          tint,
          onHit,
        },
        this.w,
      ),
    );
    this.w.sfx.play('projectile');
  }
}

// ---------------------------------------------------------------- drop from the sky

class DropAction extends BaseAction {
  constructor(u: Fighter, ex: boolean, private s: DropSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('cast');
    this.w.fx.aura(u.x, u.y, this.color);
  }
  update() {
    this.f++;
    const s = this.s;
    if (this.f === s.startup) {
      const count = s.count + (this.ex ? Math.max(1, Math.floor(s.count / 2)) : 0);
      const tx = this.opp.x;
      for (let i = 0; i < count; i++) {
        const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * s.spread + (Math.random() - 0.5) * 40;
        const x = Phaser.Math.Clamp(tx + off, this.w.left - 20, this.w.right + 20);
        this.w.addEntity(
          new Drop(this.u, { art: s.art, x, damage: this.dmg(s.damage * count, { hits: count }), delay: (s.warn ?? 18) + i * s.interval, scale: s.scale, fallSpeed: s.fallSpeed, color: this.color, knockdown: s.knockdown, radius: s.radius, spin: (Math.random() - 0.5) * 0.3 }, this.w),
        );
      }
      this.w.sfx.play('summon');
    }
    return this.f >= s.startup + s.recovery;
  }
}

// ---------------------------------------------------------------- rush / dash strike

class RushAction extends BaseAction {
  private phase: 'charge' | 'retreat' | 'rush' | 'grab' | 'recover' = 'charge';
  private pf = 0;
  private charge = 0;
  private hitsDone = 0;
  private grabT = 0;
  private teleported = false;
  constructor(u: Fighter, ex: boolean, private s: RushSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup + (s.retreat ?? 0);
    this.lowProfile = s.type === 'low';
    this.play(s.charge ? 'stance' : 'dash');
    if (s.invuln === 'full') u.invuln = 'full';
    if (s.invuln === 'projectile') u.invuln = 'projectile';
    u.invulnT = 999;
  }
  private get chargeMult() {
    return this.s.charge ? 1 + 0.6 * (this.charge / this.s.charge) : 1;
  }
  update() {
    this.f++;
    this.pf++;
    const s = this.s;
    const u = this.u;
    switch (this.phase) {
      case 'charge':
        u.vx = 0;
        if (s.charge && this.held() && this.charge < s.charge) {
          this.charge++;
          if (this.charge % 6 === 0) this.w.fx.aura(u.x, u.y, this.color);
          if (this.charge === s.charge) {
            this.w.callout(u, 'MAX', 0xffd23f);
            u.view.flash(0xffd23f, 4);
          }
          return false;
        }
        if (this.pf >= s.startup) {
          this.phase = s.retreat ? 'retreat' : 'rush';
          this.pf = 0;
          this.play(s.retreat ? 'walk' : s.anim ?? 'dash');
          if (!s.retreat) this.w.sfx.play('dash');
          if (s.hop) u.vy = -10;
        }
        return false;
      case 'retreat':
        u.vx = -9 * u.facing;
        if (this.pf % 4 === 0) u.view.ghost(0.25);
        if (this.pf >= (s.retreat ?? 0)) {
          this.phase = 'rush';
          this.pf = 0;
          this.play(s.anim ?? 'dash');
          this.w.sfx.play('dash');
          this.faceOpp();
        }
        return false;
      case 'rush': {
        const speed = s.speed * (s.charge ? 0.8 + 0.4 * (this.charge / s.charge) : 1) * u.speedMult;
        u.vx = speed * u.facing;
        this.pass = !!s.pass;
        if (s.afterimage && this.pf % 3 === 0) u.view.ghost(0.45);
        if (this.pf % 5 === 0) this.w.fx.speedLines(u.x, u.y, u.facing, this.color);
        if (s.trail && this.pf % 4 === 0) this.w.fx.fling(s.trail, u.x - u.facing * 40, u.y - 80 - Math.random() * 160, u.x - u.facing * 160, u.y - 200, 500, { scale: 0.8 });
        const hits = (s.hits ?? 1) + (this.ex ? 1 : 0);
        if (this.hitsDone < hits) {
          const kd = this.hitsDone === hits - 1;
          this.setHit(
            s.box ?? (s.type === 'low' ? { x: -10, y: -120, w: 140, h: 120 } : BODY_BOX),
            this.propsRaw(this.dmg(s.damage, { hits, mult: this.chargeMult }), {
              type: s.type ?? 'mid',
              launcher: kd && s.launcher,
              knockdown: kd && s.knockdown,
              wallBounce: kd && s.wallBounce,
              heavy: kd,
              pushback: s.pass ? 2 : 10,
              hitstun: 26,
            }),
          );
        } else this.hit = null;
        // teleport cancel (Forever on Motion)
        if (s.teleportCancel && !this.teleported && this.button && this.u.intent.pressed[this.button] && this.pf > 4) {
          this.teleported = true;
          u.view.ghost(0.6);
          u.x = Phaser.Math.Clamp(this.opp.x + (this.opp.x > u.x ? 110 : -110), this.w.left, this.w.right);
          this.w.fx.shockwave(u.x, u.y - 140, this.color);
          this.w.sfx.play('teleport');
          this.faceOpp();
          this.phase = 'recover';
          this.pf = 0;
          this.hit = null;
          return false;
        }
        if (this.pf >= s.frames) {
          this.phase = 'recover';
          this.pf = 0;
          this.hit = null;
          this.pass = false;
          u.invuln = 'none';
          u.invulnT = 0;
          this.play('idle');
        }
        return false;
      }
      case 'grab':
        this.grabT++;
        u.vx = 0;
        this.opp.x = u.x + u.facing * 95;
        this.opp.y = this.w.groundY;
        if (this.grabT === 30 && s.grab) {
          this.opp.grabbedBy = null;
          this.opp.receiveHit({
            ...this.propsRaw(this.dmg(s.grab.damage, { cap: GRAB_CAP }), { type: 'unblockable', ignoreArmor: true, knockdown: true, noScale: true, heavy: true, fixed: false }),
            attacker: u,
            x: this.opp.x,
            y: this.opp.y - 160,
            dir: u.facing,
          });
          this.w.hitstop(8);
          return true;
        }
        if (this.grabT % 6 === 0) this.w.fx.burst(this.opp.x, this.opp.y - 160, this.color, 6, 200);
        return false;
      case 'recover':
        u.vx *= 0.75;
        return this.pf >= s.recovery;
    }
  }
  onConnect(r: HitResult) {
    if (r === 'whiff') return;
    this.hitsDone++;
    this.hit = null;
    if (this.s.grab && r === 'hit' && this.opp.grabbable() || (this.s.grab && r === 'block' && this.opp.grabbable())) {
      // turn into a grab
      this.opp.grabbed(this.u);
      this.phase = 'grab';
      this.u.invuln = 'full';
      this.u.invulnT = 32;
      this.play('grab');
      if (this.s.grab.banner) this.w.fx.stamp(this.u.x, this.u.y - 360, this.s.grab.banner, this.color, 50, -8, 700);
      return;
    }
    if (!this.s.pass && this.hitsDone >= (this.s.hits ?? 1) + (this.ex ? 1 : 0)) {
      this.phase = 'recover';
      this.pf = 0;
      this.u.vx = -3 * this.u.facing;
      this.u.invuln = 'none';
      this.u.invulnT = 0;
    }
  }
  onInterrupt() {
    this.u.invuln = 'none';
    this.u.invulnT = 0;
  }
}

// ---------------------------------------------------------------- teleport

class TeleportAction extends BaseAction {
  private phase: 'start' | 'gone' | 'attack' | 'recover' = 'start';
  private pf = 0;
  private landed = false;
  constructor(u: Fighter, ex: boolean, private s: TeleportSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('cast');
  }
  update() {
    this.f++;
    this.pf++;
    const s = this.s;
    const u = this.u;
    u.vx = 0;
    switch (this.phase) {
      case 'start':
        if (this.pf >= s.startup) {
          this.phase = 'gone';
          this.pf = 0;
          u.view.ghost(0.7, this.color, 300);
          this.w.fx.burst(u.x, u.y - 150, this.color, 24, 300);
          u.view.setVisible(false);
          u.invuln = 'full';
          u.invulnT = 999;
          this.pass = true;
          this.w.sfx.play('teleport');
        }
        return false;
      case 'gone':
        if (this.pf >= s.vanish) {
          const o = this.opp;
          let x = o.x;
          const side = u.x < o.x ? 1 : -1; // where we are now relative to them
          if (s.dest === 'behind') x = o.x + side * 115;
          else if (s.dest === 'front') x = o.x - side * 140;
          if (x < this.w.left || x > this.w.right) x = o.x - side * 115;
          u.x = Phaser.Math.Clamp(x, this.w.left, this.w.right);
          if (s.dest === 'above') {
            u.x = o.x;
            u.y = this.w.groundY - 320;
            u.vy = 6;
          }
          u.view.setVisible(true);
          this.faceOpp();
          this.w.fx.burst(u.x, u.y - 150, this.color, 24, 300);
          this.w.fx.shockwave(u.x, u.y - 150, this.color);
          u.invuln = 'none';
          u.invulnT = 0;
          this.pass = false;
          this.phase = s.attack ? 'attack' : 'recover';
          this.pf = 0;
          if (s.attack) {
            this.play(s.attack.anim);
            if (s.slash) this.slashFx();
          } else this.play('idle');
        }
        return false;
      case 'attack': {
        const a = s.attack!;
        if (this.pf <= a.active && !this.landed) this.setHit(a.box, this.props(a.damage, { type: a.type, knockdown: a.knockdown, heavy: true }));
        else this.hit = null;
        if (this.pf > a.active) {
          this.phase = 'recover';
          this.pf = 0;
        }
        return false;
      }
      case 'recover':
        this.hit = null;
        return this.pf >= s.recovery && this.u.grounded;
    }
  }
  private slashFx() {
    const u = this.u;
    const img = this.w.phaser.add.image(u.x + u.facing * 60, u.y - 160, 'slash').setTint(this.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(60).setFlipX(u.facing < 0).setScale(1.4);
    this.w.phaser.tweens.add({ targets: img, alpha: 0, scaleX: 2, duration: 240, onComplete: () => img.destroy() });
    this.w.sfx.play('slash');
  }
  onConnect(r: HitResult) {
    if (r === 'whiff') return;
    this.hit = null;
    this.landed = true;
  }
  onInterrupt() {
    this.u.view.setVisible(true);
    this.u.invuln = 'none';
  }
}

// ---------------------------------------------------------------- backdash / decoy

class DecoyAction extends BaseAction {
  constructor(u: Fighter, ex: boolean, private s: DecoySpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('dash');
  }
  update() {
    this.f++;
    const s = this.s;
    const u = this.u;
    if (this.f === s.startup) {
      this.w.addEntity(
        new Clone(u, { life: s.decoyLife, damage: s.decoyDamage ? this.dmg(s.decoyDamage) : 0, walk: s.walk ?? 0, explodeRange: 70, color: this.color }, this.w),
      );
      u.invuln = 'full';
      u.invulnT = s.invuln;
      if (s.walk) {
        // stay put; the clone does the work
        this.w.sfx.play('summon');
      } else if (s.teleport) {
        const side = u.x < this.opp.x ? 1 : -1;
        u.x = Phaser.Math.Clamp(this.opp.x + side * 120, this.w.left, this.w.right);
        this.faceOpp();
        this.w.fx.burst(u.x, u.y - 150, this.color, 20, 300);
        this.w.sfx.play('teleport');
      } else {
        u.vx = -(s.distance / 10) * u.facing;
        this.w.sfx.play('whoosh');
      }
    }
    if (this.f > s.startup && this.f < s.startup + 10 && !s.teleport && !s.walk) {
      if (this.f % 3 === 0) u.view.ghost(0.3);
    } else if (this.f >= s.startup + 10) u.vx *= 0.7;
    return this.f >= s.startup + 10 + s.recovery;
  }
}

// ---------------------------------------------------------------- command grab

class GrabAction extends BaseAction {
  private phase: 'run' | 'reach' | 'hold' | 'whiff' = 'reach';
  private pf = 0;
  constructor(u: Fighter, ex: boolean, private s: GrabSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    if (s.run) {
      this.phase = 'run';
      this.play('dash');
      if (s.run.invuln) {
        u.invuln = 'full';
        u.invulnT = s.run.frames;
      }
      if (s.art) this.w.fx.popup(u.x, u.y - 340, s.shout ?? '', this.color, 30);
    } else this.play('grab');
  }
  private inRange() {
    return Math.abs(this.opp.x - this.u.x) <= this.s.range + (this.ex ? 30 : 0) && this.opp.grabbable();
  }
  update() {
    this.f++;
    this.pf++;
    const s = this.s;
    const u = this.u;
    switch (this.phase) {
      case 'run':
        u.vx = s.run!.speed * u.facing;
        if (this.pf % 3 === 0) u.view.ghost(0.4);
        if (s.art && this.pf % 5 === 0) this.w.fx.fling(s.art, u.x, u.y - 200, u.x - u.facing * 100, u.y - 300, 400);
        if (this.inRange() || this.pf >= s.run!.frames) {
          this.phase = 'reach';
          this.pf = 0;
          u.vx = 0;
          this.play('grab');
        }
        return false;
      case 'reach':
        u.vx = 0;
        if (this.pf >= s.startup) {
          if (this.inRange()) {
            this.opp.grabbed(u);
            this.phase = 'hold';
            this.pf = 0;
            u.invuln = 'full';
            u.invulnT = 40;
            this.w.sfx.play('grab');
            if (s.banner) this.w.fx.stamp(u.x, u.y - 370, s.banner, this.color, 54, -8, 900);
            if (s.art) for (let i = 0; i < 6; i++) this.w.fx.fling(s.art, this.opp.x, this.opp.y - 180, this.opp.x + (Math.random() - 0.5) * 300, this.opp.y - 350 - Math.random() * 100, 700, { spin: 1 });
          } else {
            this.phase = 'whiff';
            this.pf = 0;
            this.play('idle');
          }
        }
        return false;
      case 'hold':
        this.opp.x = u.x + u.facing * 90;
        this.opp.y = this.w.groundY;
        if (this.pf % 8 === 0) {
          this.w.fx.spark(this.opp.x, this.opp.y - 180, this.color, false);
          this.w.sfx.play('hit');
          this.opp.view.flash(0xffffff, 2);
        }
        if (this.pf === 36) {
          this.opp.grabbedBy = null;
          this.opp.receiveHit({
            ...this.propsRaw(this.dmg(s.damage, { cap: GRAB_CAP }), { type: 'unblockable', ignoreArmor: true, knockdown: true, noScale: true, heavy: true }),
            attacker: u,
            x: this.opp.x,
            y: this.opp.y - 170,
            dir: u.facing,
          });
          if (s.heal) {
            u.heal(this.dmg(s.heal));
            this.w.fx.popup(u.x, u.y - 340, `+${Math.round(this.dmg(s.heal))} HP`, 0x7dff9a, 28);
          }
          this.w.shake(0.014, 200);
          this.w.hitstop(6);
          return true;
        }
        return false;
      case 'whiff':
        return this.pf >= s.recovery;
    }
  }
  onInterrupt() {
    if (this.opp.state === 'grabbed') this.opp.idle();
    this.opp.grabbedBy = null;
  }
}

// ---------------------------------------------------------------- counter stance

class CounterAction extends BaseAction {
  private phase: 'start' | 'window' | 'punish' | 'recover' = 'start';
  private pf = 0;
  private pending: HitInfo | null = null;
  constructor(u: Fighter, ex: boolean, private s: CounterSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('stance');
  }
  update() {
    this.f++;
    this.pf++;
    const s = this.s;
    this.u.vx = 0;
    switch (this.phase) {
      case 'start':
        if (this.pf >= s.startup) {
          this.phase = 'window';
          this.pf = 0;
          this.u.view.setGlow(this.color);
          this.u.view.flash(this.color, 3);
        }
        return false;
      case 'window':
        if (this.pf % 6 === 0) this.w.fx.aura(this.u.x, this.u.y, this.color);
        if (this.pf >= s.window + (this.ex ? 10 : 0)) {
          this.phase = 'recover';
          this.pf = 0;
          this.u.view.setGlow(null);
          this.play('idle');
        }
        return false;
      case 'punish':
        // the punish lands one frame after the incoming hit is cancelled
        if (this.pending && this.pf >= 1) {
          const p = this.pending;
          this.pending = null;
          if (p.attacker.opp.alive && this.opp.alive) this.opp.receiveHit(p);
        }
        return this.pf >= 18;
      case 'recover':
        return this.pf >= s.recovery;
    }
  }
  onAttacked(info: HitInfo): boolean {
    if (this.phase !== 'window') return false;
    if (info.projectile && !this.s.projectiles) return false;
    const s = this.s;
    const a = info.attacker;
    this.phase = 'punish';
    this.pf = 0;
    this.u.view.setGlow(null);
    this.u.invuln = 'full';
    this.u.invulnT = 24;
    this.faceOpp();
    this.play('heavy');
    this.w.hitstop(10);
    this.w.sfx.play('counter');
    this.w.callout(this.u, 'COUNTERED!', this.color);
    this.w.fx.shockwave(this.u.x, this.u.y - 150, this.color, 1.4);
    if (s.popup) this.popupCard(s.popup, s.popupColor ?? 0x16c784);
    if (info.projectile) return true;
    const base = { attacker: this.u, x: a.x, y: a.y - 170, dir: this.u.facing };
    const hp = this.props(s.damage, { type: 'unblockable', heavy: true, ignoreArmor: true, noScale: true });
    if (s.effect === 'launch') hp.launcher = true;
    if (s.effect === 'knockdown') hp.knockdown = true;
    if (s.effect === 'freeze' || s.effect === 'combo') hp.freeze = s.freeze ?? (s.effect === 'combo' ? 50 : 70);
    this.pending = { ...hp, ...base };
    return true;
  }
  private popupCard(text: string, color: number) {
    const scene = this.w.phaser;
    const x = this.u.x;
    const y = this.u.y - 380;
    const bg = scene.add.rectangle(x, y, 220, 90, 0x0b0f14, 0.95).setStrokeStyle(3, color).setDepth(80);
    const t = scene.add.text(x, y, text, { fontFamily: 'Anton, Impact, sans-serif', fontSize: '34px', color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0.5).setDepth(81);
    for (const o of [bg, t]) {
      o.setScale(0.3);
      scene.tweens.add({ targets: o, scale: 1, duration: 160, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: o, alpha: 0, y: y - 40, delay: 900, duration: 300, onComplete: () => o.destroy() });
    }
  }
  onInterrupt() {
    this.u.view.setGlow(null);
  }
}

// ---------------------------------------------------------------- buffs / stances / heals

class BuffAction extends BaseAction {
  constructor(u: Fighter, ex: boolean, private s: BuffMoveSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play(s.stance ? 'stance' : 'cast');
  }
  update() {
    this.f++;
    const s = this.s;
    const u = this.u;
    u.vx = 0;
    if (this.f === s.startup) {
      if (s.purgeSelf) {
        u.clearStatus();
        this.w.fx.popup(u.x, u.y - 340, 'RESET', 0xffffff, 30);
      }
      for (const b of s.buffs) {
        let amount = b.amount;
        if (s.lowHp) amount *= u.lowHpMult;
        u.addBuff(b.kind, Math.round(amount * (this.ex ? 1.3 : 1)), Math.round(b.frames * (this.ex ? 1.4 : 1)));
      }
      if (s.heal) {
        const h = this.dmg(s.heal);
        u.heal(h);
        this.w.fx.popup(u.x, u.y - 340, `+${Math.round(h)} HP`, 0x7dff9a, 30);
      }
      this.w.fx.aura(u.x, u.y, this.color);
      if (s.art) for (let i = 0; i < 6; i++) this.w.fx.fling(s.art, u.x, u.y - 150, u.x + (Math.random() - 0.5) * 260, u.y - 300 - Math.random() * 160, 700, { spin: 0.5 });
      this.w.sfx.play('buff');
    }
    if (s.stance && this.f > s.startup && this.f % 8 === 0) this.w.fx.aura(u.x, u.y, this.color);
    return this.f >= s.startup + (s.stance ?? 0) + s.recovery;
  }
}

// ---------------------------------------------------------------- strikes (overheads, launchers, pokes, charges)

class StrikeAction extends BaseAction {
  private phase: 'charge' | 'startup' | 'active' | 'recover' = 'startup';
  private pf = 0;
  private charge = 0;
  private hitsDone = 0;
  private cool = 0;
  private type: HitType;
  constructor(u: Fighter, ex: boolean, private s: StrikeSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.type = s.type;
    if (s.mixup) this.type = Math.random() < 0.5 ? 'overhead' : 'low';
    this.lowProfile = this.type === 'low';
    if (s.charge) this.phase = 'charge';
    this.armored = !!s.armor || ex && !!s.charge;
    this.play(s.charge ? 'stance' : 'cast');
  }
  private get full() {
    return !!this.s.charge && this.charge >= this.s.charge;
  }
  update() {
    this.f++;
    this.pf++;
    const s = this.s;
    const u = this.u;
    switch (this.phase) {
      case 'charge':
        u.vx = 0;
        if (this.held() && this.charge < s.charge!) {
          this.charge++;
          if (this.charge % 5 === 0) this.w.fx.aura(u.x, u.y, this.full ? 0xffffff : this.color);
          if (this.charge === s.charge) {
            this.w.callout(u, s.unblockableCharged ? 'UNBLOCKABLE' : 'MAX', 0xffffff);
            u.view.flash(0xffffff, 6);
            this.w.sfx.play('charge');
          }
          return false;
        }
        this.phase = 'startup';
        this.pf = 0;
        this.play('cast');
        return false;
      case 'startup':
        if (s.lunge) u.vx = s.lunge * u.facing * 0.5;
        else u.vx *= 0.6;
        if (this.pf >= s.startup) {
          this.phase = 'active';
          this.pf = 0;
          this.armored = false;
          this.play(this.type === 'low' ? 'sweep' : this.type === 'overhead' ? 'overhead' : s.anim);
          this.w.sfx.play('swingHeavy');
          if (s.hop) {
            u.vy = -s.hop;
            u.y -= 1;
          }
          if (s.art) this.w.fx.fling(s.art, u.x + u.facing * 90, u.y - 180, u.x + u.facing * 200, u.y - 200, 300, { scale: 1.2 });
          if (s.mixup) this.w.callout(u, this.type === 'low' ? 'LOW!' : 'HIGH!', this.color);
        }
        return false;
      case 'active': {
        if (s.lunge) u.vx = s.lunge * u.facing;
        const hits = (s.hits ?? 1) + (this.ex && (s.hits ?? 1) > 1 ? 1 : 0);
        const every = s.hitEvery ?? s.active;
        if (this.cool > 0) {
          this.cool--;
          this.hit = null;
        } else if (this.hitsDone < hits && this.pf <= s.active + (hits - 1) * every) {
          const last = this.hitsDone === hits - 1;
          const cm = s.charge ? 1 + 0.6 * (this.charge / s.charge) : 1;
          this.setHit(
            s.box,
            this.propsRaw(this.dmg(s.damage, { hits, mult: cm }), {
              type: this.full && s.unblockableCharged ? 'unblockable' : this.type,
              launcher: last && s.launcher,
              wallBounce: last && s.wallBounce,
              knockdown: last && s.knockdown,
              heavy: last,
              ignoreArmor: s.ignoreArmor,
              pull: s.pull,
              steal: s.steal,
              counterStun: s.counterStun,
              freeze: last ? s.freeze : undefined,
              hitstun: 24,
            }),
          );
        } else this.hit = null;
        if (this.pf > s.active + (hits - 1) * every) {
          this.phase = 'recover';
          this.pf = 0;
          this.hit = null;
        }
        return false;
      }
      case 'recover':
        u.vx *= 0.7;
        if (this.pf === 6) this.play('idle');
        return this.pf >= s.recovery && u.grounded;
    }
  }
  onConnect(r: HitResult) {
    if (r === 'whiff') return;
    this.hitsDone++;
    this.hit = null;
    this.cool = this.s.hitEvery ?? this.s.active;
    if (r === 'hit' && this.s.steal) this.w.fx.popup(this.u.x, this.u.y - 340, '+HP', 0x7dff9a, 24);
  }
}

// ---------------------------------------------------------------- status moves (waves / status projectiles)

class StatusAction extends BaseAction {
  constructor(u: Fighter, ex: boolean, private s: StatusMoveSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('cast');
  }
  update() {
    this.f++;
    const s = this.s;
    const u = this.u;
    u.vx = 0;
    if (this.f === s.startup) {
      const frames = Math.round(s.frames * (this.ex ? 1.5 : 1));
      if (s.delivery === 'wave') {
        this.w.addEntity(new Wave(u, { status: s.status, frames, damage: s.damage ? this.dmg(s.damage) : 0, color: this.color, art: s.art }, this.w));
      } else {
        this.w.addEntity(
          new Projectile(u, { art: s.art ?? 'shadoworb', x: u.x + u.facing * 70, y: u.y - 180, vx: (s.speed ?? 9) * u.facing, damage: this.dmg(s.damage ?? 20), color: this.color, status: { kind: s.status, frames }, life: 160 }, this.w),
        );
      }
      this.w.sfx.play('status');
    }
    return this.f >= s.startup + s.recovery;
  }
}

// ---------------------------------------------------------------- multi-hit strings

class StringAction extends BaseAction {
  private hitN = 0;
  private next: number;
  private activeUntil = 0;
  private blocked = false;
  private landed = false;
  private enderType: HitType = 'mid';
  constructor(u: Fighter, ex: boolean, private s: StringSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.next = s.startup;
    if (s.ender === 'highlow') this.enderType = Math.random() < 0.5 ? 'overhead' : 'low';
    this.play('cast');
  }
  private get total() {
    return this.s.hits + (this.ex ? 2 : 0);
  }
  /** keeps the whole string under the damage cap */
  private get capScale() {
    const s = this.s;
    const full = this.dmg(s.damage, { cap: 1e9 }) * (this.total - 1) + this.dmg(s.enderDamage, { cap: 1e9 });
    return Math.min(1, DAMAGE_CAP / full);
  }
  update() {
    this.f++;
    const s = this.s;
    const u = this.u;
    if (this.f > this.activeUntil) this.hit = null;
    if (this.hitN < this.total && this.f === this.next) {
      const last = this.hitN === this.total - 1;
      const anims: AnimKey[] = ['light', 'kick', 'heavy'];
      this.play(last ? (this.enderType === 'low' ? 'sweep' : this.enderType === 'overhead' ? 'overhead' : s.ender === 'launch' ? 'uppercut' : 'heavy') : anims[this.hitN % 3]);
      u.vx = s.advance * u.facing;
      this.setHit(
        { x: 0, y: -260, w: 150, h: 230 },
        this.propsRaw(this.dmg(last ? s.enderDamage : s.damage) * this.capScale, {
          type: last ? this.enderType : this.hitN === 0 && s.opener ? s.opener : 'mid',
          launcher: last && s.ender === 'launch',
          knockdown: last && (s.ender === 'knockdown' || s.ender === 'cash' || s.ender === 'heavy'),
          heavy: last,
          hitstun: last ? 26 : 20,
          blockstun: 14,
          pushback: last ? 10 : 1.5,
        }),
        true,
      );
      this.activeUntil = this.f + 3;
      if (s.art) this.w.fx.fling(s.art, u.x + u.facing * 80, u.y - 180, u.x + u.facing * 180, u.y - 260, 400, { scale: 0.8 });
      this.w.sfx.play(last ? 'swingHeavy' : 'swing');
      this.hitN++;
      const gap = s.speedup ? Math.max(4, s.interval - this.hitN) : s.interval;
      this.next = this.f + gap;
      if (s.speedup && this.hitN > 2) u.view.ghost(0.3);
    }
    u.vx *= 0.85;
    // the first two hits whiffed completely: stop early (it's punishable)
    if (this.hitN >= 2 && this.f > this.activeUntil && !this.landed && !this.blocked && this.hitN < this.total) {
      this.hitN = this.total;
      this.next = this.f;
    }
    return this.hitN >= this.total && this.f >= this.next + s.recovery;
  }
  private cashRain() {
    for (let i = 0; i < 10; i++) {
      this.w.addEntity(new Drop(this.u, { art: 'cash', x: this.opp.x + (Math.random() - 0.5) * 200, damage: 0, delay: 4 + i * 2, scale: 0.9, fallSpeed: 14, color: 0x7fbf6a, spin: 0.2 }, this.w));
    }
  }
  onConnect(r: HitResult) {
    this.hit = null;
    if (r === 'hit') this.landed = true;
    if (r === 'block') this.blocked = true;
    if (r === 'hit' && this.s.ender === 'cash' && this.hitN === this.total) this.cashRain();
  }
}

// ---------------------------------------------------------------- super (full meter)

class SuperAction extends BaseAction {
  constructor(u: Fighter, ex: boolean, private s: SuperSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = 30;
    this.play('stance');
    u.invuln = 'full';
    u.invulnT = 50;
    this.w.hitstop(24);
    this.w.phaser.cameras.main.flash(300, 120, 40, 200);
    this.w.callout(u, 'FINAL CANDLE', this.color);
    this.w.sfx.play('super');
  }
  update() {
    this.f++;
    const u = this.u;
    u.vx = 0;
    if (this.f === 10) {
      const w = this.w;
      w.addEntity(new Hazard(u, { x0: w.left - 100, x1: w.right + 100, height: 420, start: 16, hits: 5, every: 7, damage: this.dmg(this.s.damage, { hits: 5, cap: SUPER_CAP }), color: this.color, life: 70, chip: 0.3 }, w));
      // the screen ignites: candles burst up across the stage
      for (let i = 0; i < 26; i++) {
        const x = w.left - 60 + ((w.right - w.left + 120) * i) / 25;
        w.phaser.time.delayedCall(i * 18, () => {
          const c = w.phaser.add.image(x, w.groundY + 60, i % 3 === 0 ? 'candleR' : 'candleG').setScale(1.6, 3 + Math.random() * 2).setDepth(45).setTint(i % 2 ? 0xb026ff : 0xffffff);
          const fl = w.phaser.add.image(x, w.groundY - 40, 'flame').setScale(1.4 + Math.random()).setDepth(46).setTint(0xc77dff).setBlendMode(Phaser.BlendModes.ADD);
          w.phaser.tweens.add({ targets: c, y: w.groundY - 140, duration: 260, yoyo: true, hold: 500, onComplete: () => c.destroy() });
          w.phaser.tweens.add({ targets: fl, y: w.groundY - 380, alpha: 0, duration: 900, onComplete: () => fl.destroy() });
        });
      }
      w.shake(0.02, 900);
    }
    return this.f >= 80;
  }
}

// ---------------------------------------------------------------- trap

class TrapAction extends BaseAction {
  constructor(u: Fighter, ex: boolean, private s: TrapSpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    this.play('cast');
  }
  update() {
    this.f++;
    const s = this.s;
    const u = this.u;
    u.vx = 0;
    if (this.f === s.startup) {
      // only one trap at a time
      for (const e of this.w.entities) if (e.owner === u && e instanceof Trap) e.dead = true;
      const x = Phaser.Math.Clamp(u.x + u.facing * s.distance, this.w.left, this.w.right);
      this.w.addEntity(new Trap(u, x, { life: s.life, damage: this.dmg(s.damage), stun: s.stun, art: s.art, color: this.color }, this.w));
      this.w.fx.fling(s.art, u.x, u.y - 120, x, this.w.groundY - 14, 220, { fade: true });
      this.w.sfx.play('summon');
    }
    return this.f >= s.startup + s.recovery;
  }
}

// ---------------------------------------------------------------- mobility

class MobilityAction extends BaseAction {
  private redirected = false;
  private dove = false;
  constructor(u: Fighter, ex: boolean, private s: MobilitySpec, b: Button | null) {
    super(u, ex, s, b);
    this.startup = s.startup;
    u.invuln = 'full';
    u.invulnT = s.invuln;
    if (s.kind === 'hop') {
      // roll/hop through the opponent to their other side
      this.pass = true;
      this.play('dash');
    } else {
      this.play('jump');
    }
  }
  update() {
    this.f++;
    const s = this.s;
    const u = this.u;
    if (s.kind === 'hop') {
      if (this.f === s.startup) {
        const dist = this.opp.x - u.x;
        u.vx = Math.sign(dist || u.facing) * Math.max(10, Math.min(18, Math.abs(dist) / 12 + 6));
        u.vy = -9;
        u.y -= 1;
        this.w.sfx.play('whoosh');
      }
      if (this.f > s.startup && this.f % 3 === 0) u.view.ghost(0.35);
      if (this.f > s.startup + 4 && u.grounded) {
        this.pass = false;
        u.vx = 0;
        this.faceOpp();
        return this.f >= s.startup + 4 + s.recovery;
      }
      return false;
    }
    // airRedirect: jump, then at the apex dash toward where the stick points (or over the opponent), then dive
    if (this.f === s.startup) {
      u.vy = -17;
      u.vx = 2 * u.facing;
      u.y -= 1;
      this.w.sfx.play('jump');
    }
    if (!this.redirected && this.f > s.startup + 12) {
      this.redirected = true;
      const i = u.intent;
      let dir = i.back ? -u.facing : i.fwd ? u.facing : Math.sign(this.opp.x - u.x) || u.facing;
      if (!i.back && !i.fwd && Math.abs(this.opp.x - u.x) < 260) dir = Math.sign(this.opp.x - u.x) || 1; // cross over
      u.vx = dir * 13;
      u.vy = 2;
      u.view.flash(this.color, 3);
      this.w.fx.shockwave(u.x, u.y - 140, this.color, 0.8);
      this.w.sfx.play('dash');
      this.play('kick');
    }
    if (this.redirected && s.damage && !u.grounded && !this.dove) {
      this.setHit({ x: -20, y: -170, w: 140, h: 150 }, this.props(s.damage, { type: 'overhead', heavy: true }));
    } else this.hit = null;
    if (this.redirected && this.f % 3 === 0) u.view.ghost(0.4);
    if (this.redirected && u.grounded) {
      u.vx *= 0.5;
      this.hit = null;
      this.faceOpp();
      return true;
    }
    return this.f > 120;
  }
  onConnect() {
    this.hit = null;
    this.dove = true;
  }
  onLand() {
    this.u.vx *= 0.5;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function startSpecial(u: Fighter, spec: SpecialSpec, n: 1 | 2 | 3, intent: Intent): Action | null {
  const w = u.world;
  // super: costs the full meter
  if (spec.mech === 'super') {
    if (!w.training && u.meter < spec.cost) {
      w.callout(u, 'NEED FULL METER', 0xaaaaaa);
      return null;
    }
    u.spendMeter(spec.cost);
    return new SuperAction(u, false, spec, intent.specialButton);
  }
  // one projectile on screen at a time
  if ((spec.mech === 'projectile' || (spec.mech === 'status' && spec.delivery === 'projectile')) && w.entities.some((e) => e.owner === u && !e.dead && e.limitsProjectiles)) {
    return null;
  }
  let ex = false;
  if (intent.exWanted && (u.meter >= METER_BAR || w.training)) {
    u.spendMeter(METER_BAR);
    ex = true;
  }
  if (spec.mech === 'random') {
    const i = Math.floor(Math.random() * spec.options.length);
    w.callout(u, spec.labels[i], spec.color ?? u.accent);
    return startSpecial(u, spec.options[i], n, { ...intent, exWanted: ex });
  }
  const name = u.data.specials[n - 1]?.name ?? '';
  w.callout(u, (ex ? 'EX ' : '') + (spec.shout ?? name).toUpperCase(), ex ? 0xffd23f : spec.color ?? u.accent);
  if (ex) {
    u.view.flash(0xffd23f, 6);
    w.fx.shockwave(u.x, u.y - 150, 0xffd23f, 1.2);
  }
  const b = intent.specialButton;
  switch (spec.mech) {
    case 'projectile':
      return new ProjectileAction(u, ex, spec, b);
    case 'drop':
      return new DropAction(u, ex, spec, b);
    case 'rush':
      return new RushAction(u, ex, spec, b);
    case 'teleport':
      return new TeleportAction(u, ex, spec, b);
    case 'decoy':
      return new DecoyAction(u, ex, spec, b);
    case 'grab':
      return new GrabAction(u, ex, spec, b);
    case 'counter':
      return new CounterAction(u, ex, spec, b);
    case 'buff':
      return new BuffAction(u, ex, spec, b);
    case 'strike':
      return new StrikeAction(u, ex, spec, b);
    case 'status':
      return new StatusAction(u, ex, spec, b);
    case 'string':
      return new StringAction(u, ex, spec, b);
    case 'trap':
      return new TrapAction(u, ex, spec, b);
    case 'mobility':
      return new MobilityAction(u, ex, spec, b);
  }
  return null;
}
