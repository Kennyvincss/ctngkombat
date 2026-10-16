import Phaser from 'phaser';
import type { StatusKind } from '../data/moveTypes';
import type { Fighter } from './Fighter';
import type { Entity, HitProps, HitResult, World } from './types';

const DEPTH = 40;

// ---------------------------------------------------------------- Projectile

export interface ProjectileOpts {
  art: string;
  x: number;
  y: number;
  vx: number;
  vy?: number;
  gravity?: number;
  damage: number;
  hits?: number;
  hitEvery?: number;
  life?: number;
  track?: number;
  bounceFloor?: number;
  bounceWall?: number;
  scale?: number;
  spin?: number;
  low?: boolean;
  radius?: number;
  color: number;
  status?: { kind: StatusKind; frames: number };
  ground?: boolean;
  knockdown?: boolean;
  limit?: boolean;
  /** called when it hits (for random effects etc.) */
  onHit?: (victim: Fighter, world: World) => void;
  tint?: number;
  unblockable?: boolean;
  chip?: number;
}

export class Projectile implements Entity {
  dead = false;
  clashes = true;
  limitsProjectiles: boolean;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private hitsLeft: number;
  private cooldown = 0;
  private id: number;
  private age = 0;
  private x: number;
  private y: number;
  private vx: number;
  private vy: number;
  private bouncesF: number;
  private bouncesW: number;

  constructor(readonly owner: Fighter, private o: ProjectileOpts, world: World) {
    this.x = o.x;
    this.y = o.y;
    this.vx = o.vx;
    this.vy = o.vy ?? 0;
    this.hitsLeft = o.hits ?? 1;
    this.bouncesF = o.bounceFloor ?? 0;
    this.bouncesW = o.bounceWall ?? 0;
    this.limitsProjectiles = o.limit ?? true;
    this.id = world.nextHitId();
    const s = world.phaser;
    this.glow = s.add.image(this.x, this.y, 'dot').setTint(o.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH - 1).setScale(3.2 * (o.scale ?? 1)).setAlpha(0.7);
    this.img = s.add.image(this.x, this.y, o.art).setDepth(DEPTH).setScale(o.scale ?? 1);
    if (o.tint !== undefined) this.img.setTint(o.tint);
    if (o.vx < 0) this.img.setFlipX(true);
  }

  update(world: World) {
    this.age++;
    const o = this.o;
    if (o.track && this.owner.opp) {
      const t = this.owner.opp;
      const ty = t.y - 160;
      const dy = ty - this.y;
      this.vy += Math.sign(dy) * Math.min(Math.abs(dy) * 0.02, 0.6) * o.track;
      this.vy *= 0.94;
      const dx = t.x - this.x;
      const want = Math.sign(dx) * Math.abs(this.vx);
      this.vx += (want - this.vx) * 0.02 * o.track;
    }
    if (o.gravity) this.vy += o.gravity;
    this.x += this.vx;
    this.y += this.vy;
    if (o.ground) this.y = world.groundY - (o.radius ?? 30);

    if (this.y > world.groundY - 14 && this.vy > 0) {
      if (this.bouncesF > 0) {
        this.bouncesF--;
        this.y = world.groundY - 14;
        this.vy = -Math.abs(this.vy) * 0.75 - 4;
        world.fx.dust(this.x, world.groundY);
      } else if (o.gravity) this.kill(world);
    }
    if (this.x < world.left - 40 || this.x > world.right + 40) {
      if (this.bouncesW > 0) {
        this.bouncesW--;
        this.vx = -this.vx;
        this.x = Phaser.Math.Clamp(this.x, world.left - 40, world.right + 40);
        this.img.setFlipX(this.vx < 0);
        world.fx.shockwave(this.x, this.y, o.color, 0.6);
        world.sfx.play('wall');
      } else if (this.x < world.left - 300 || this.x > world.right + 300) this.kill(world);
    }
    if (this.age > (o.life ?? 200)) this.kill(world);
    if (this.cooldown > 0 && --this.cooldown === 0) this.id = world.nextHitId();

    this.img.setPosition(this.x, this.y);
    this.glow.setPosition(this.x, this.y);
    if (o.spin) this.img.rotation += o.spin;
  }

  hitbox() {
    if (this.cooldown > 0) return null;
    const r = this.o.radius ?? 26;
    return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }

  props(): HitProps {
    const o = this.o;
    return {
      damage: o.damage,
      hitstun: 20,
      blockstun: 14,
      pushback: 6,
      type: o.unblockable ? 'unblockable' : o.low ? 'low' : 'mid',
      special: true,
      projectile: true,
      knockdown: o.knockdown && this.hitsLeft <= 1,
      color: o.color,
      chip: o.chip,
    };
  }

  hitId() {
    return this.id;
  }

  onConnect(result: HitResult, victim: Fighter, world: World) {
    if (result === 'whiff') return;
    if (result === 'hit') {
      if (this.o.status) victim.applyStatus(this.o.status.kind, this.o.status.frames);
      this.o.onHit?.(victim, world);
    }
    this.hitsLeft--;
    if (this.hitsLeft <= 0 || result === 'countered') this.kill(world);
    else {
      this.cooldown = this.o.hitEvery ?? 8;
      this.vx *= 0.5;
    }
  }

  onClash(world: World) {
    this.hitsLeft--;
    if (this.hitsLeft <= 0) this.kill(world);
    else this.cooldown = 6;
  }

  kill(world: World) {
    if (this.dead) return;
    this.dead = true;
    world.fx.burst(this.x, this.y, this.o.color, 12, 260);
  }

  destroy() {
    this.img.destroy();
    this.glow.destroy();
  }
}

// ---------------------------------------------------------------- Drop (falls from the sky)

export interface DropOpts {
  art: string;
  x: number;
  damage: number;
  delay: number;
  scale?: number;
  fallSpeed?: number;
  color: number;
  knockdown?: boolean;
  radius?: number;
  spin?: number;
}

export class Drop implements Entity {
  dead = false;
  clashes = false;
  private img: Phaser.GameObjects.Image;
  private marker: Phaser.GameObjects.Image;
  private y: number;
  private t = 0;
  private id: number;
  private landed = false;

  constructor(readonly owner: Fighter, private o: DropOpts, private world: World) {
    this.id = world.nextHitId();
    this.y = world.groundY - 900;
    const s = world.phaser;
    this.marker = s.add.image(o.x, world.groundY + 4, 'shadow').setTint(o.color).setDepth(DEPTH - 5).setAlpha(0.2).setScale(0.6 * (o.scale ?? 1), 1);
    this.img = s.add.image(o.x, this.y, o.art).setDepth(DEPTH + 2).setScale(o.scale ?? 1).setVisible(false);
  }

  update(world: World) {
    this.t++;
    const o = this.o;
    if (this.t < o.delay) {
      this.marker.setAlpha(0.2 + 0.4 * Math.abs(Math.sin(this.t * 0.3)));
      return;
    }
    this.img.setVisible(true);
    if (!this.landed) {
      this.y += o.fallSpeed ?? 24;
      if (o.spin) this.img.rotation += o.spin;
      const bottom = world.groundY - (this.img.displayHeight / 2);
      if (this.y >= bottom) {
        this.y = bottom;
        this.landed = true;
        world.fx.dust(o.x, world.groundY);
        world.fx.burst(o.x, world.groundY - 20, o.color, 10, 300);
        if ((o.scale ?? 1) > 0.9) world.shake(0.01, 160);
        world.sfx.play('thud');
        world.phaser.tweens.add({ targets: [this.img, this.marker], alpha: 0, duration: 300, delay: 120, onComplete: () => (this.dead = true) });
      }
    }
    this.img.setPosition(o.x, this.y);
  }

  hitbox() {
    if (this.t < this.o.delay || this.landed && this.t > this.o.delay + 200) return null;
    if (this.landed) return null;
    const r = this.o.radius ?? Math.max(this.img.displayWidth, 40) / 2;
    return { x: this.o.x - r, y: this.y - this.img.displayHeight / 2, w: r * 2, h: this.img.displayHeight };
  }

  props(): HitProps {
    return {
      damage: this.o.damage,
      hitstun: 22,
      blockstun: 14,
      pushback: 3,
      type: 'overhead',
      special: true,
      projectile: true,
      knockdown: this.o.knockdown,
      heavy: (this.o.scale ?? 1) > 0.9,
      color: this.o.color,
    };
  }

  hitId() {
    return this.id;
  }

  onConnect(result: HitResult) {
    if (result !== 'whiff') {
      this.landed = true;
      this.world.phaser.tweens.add({ targets: [this.img, this.marker], alpha: 0, duration: 200, onComplete: () => (this.dead = true) });
    }
  }

  destroy() {
    this.img.destroy();
    this.marker.destroy();
  }
}

// ---------------------------------------------------------------- Clone / decoy

export class Clone implements Entity {
  dead = false;
  clashes = true;
  private img: Phaser.GameObjects.Image;
  private t = 0;
  private id: number;
  private x: number;

  constructor(
    readonly owner: Fighter,
    private opts: { life: number; damage: number; walk: number; explodeRange: number; color: number },
    world: World,
  ) {
    this.id = world.nextHitId();
    this.x = owner.x;
    this.img = owner.view.ghost(0.75, opts.color, 0);
    this.img.setBlendMode(Phaser.BlendModes.NORMAL).clearTint().setTint(opts.color).setAlpha(0.7);
  }

  update(world: World) {
    this.t++;
    this.img.setAlpha(0.55 + 0.2 * Math.sin(this.t * 0.4));
    if (this.opts.walk) {
      const dir = Math.sign(this.owner.opp.x - this.x) || 1;
      this.x += dir * this.opts.walk;
      this.img.x = this.x;
      this.img.y = world.groundY + 18 - Math.abs(Math.sin(this.t * 0.25)) * 6;
    }
    if (this.t > this.opts.life) this.pop(world);
  }

  hitbox() {
    if (!this.opts.damage) return null;
    const r = this.opts.explodeRange;
    return { x: this.x - r, y: this.owner.world.groundY - 280, w: r * 2, h: 280 };
  }

  props(): HitProps {
    return { damage: this.opts.damage, hitstun: 24, blockstun: 14, pushback: 8, type: 'mid', special: true, projectile: true, knockdown: true, color: this.opts.color };
  }

  hitId() {
    return this.id;
  }

  onConnect(result: HitResult, _v: Fighter, world: World) {
    if (result !== 'whiff') this.pop(world);
  }

  onClash(world: World) {
    this.pop(world);
  }

  pop(world: World) {
    if (this.dead) return;
    this.dead = true;
    world.fx.burst(this.x, world.groundY - 150, this.opts.color, 30, 380);
    world.fx.shockwave(this.x, world.groundY - 150, this.opts.color);
  }

  destroy() {
    this.img.destroy();
  }
}

// ---------------------------------------------------------------- Trap

export class Trap implements Entity {
  dead = false;
  clashes = false;
  private img: Phaser.GameObjects.Image;
  private t = 0;
  private id: number;

  constructor(readonly owner: Fighter, private x: number, private o: { life: number; damage: number; stun: number; art: string; color: number }, world: World) {
    this.id = world.nextHitId();
    this.img = world.phaser.add.image(x, world.groundY - 14, o.art).setDepth(DEPTH - 3).setAlpha(0);
    world.phaser.tweens.add({ targets: this.img, alpha: 0.95, duration: 200 });
  }

  update(world: World) {
    this.t++;
    this.img.setAlpha(this.t < 20 ? this.t / 20 : 0.7 + 0.25 * Math.sin(this.t * 0.2));
    if (this.t > this.o.life) {
      this.dead = true;
      world.fx.burst(this.x, world.groundY - 10, this.o.color, 8, 200);
    }
  }

  hitbox() {
    if (this.t < 20) return null;
    return { x: this.x - 60, y: this.owner.world.groundY - 40, w: 120, h: 40 };
  }

  props(): HitProps {
    return { damage: this.o.damage, hitstun: this.o.stun, blockstun: 12, pushback: 2, type: 'low', special: true, projectile: true, color: this.o.color };
  }

  hitId() {
    return this.id;
  }

  onConnect(result: HitResult, victim: Fighter, world: World) {
    if (result === 'whiff') return;
    this.dead = true;
    world.fx.stamp(victim.x, victim.y - 330, 'LIQUIDATED', 0xff4444, 34, -6, 700);
    world.fx.burst(this.x, world.groundY - 10, this.o.color, 20, 400);
  }

  destroy() {
    this.img.destroy();
  }
}

// ---------------------------------------------------------------- Wave (status wave across the stage)

export class Wave implements Entity {
  dead = false;
  clashes = false;
  private ring: Phaser.GameObjects.Image;
  private t = 0;
  private id: number;
  private hit = false;
  private radius = 20;
  private x: number;
  private y: number;

  constructor(readonly owner: Fighter, private o: { status: StatusKind; frames: number; damage: number; color: number; art?: string }, world: World) {
    this.id = world.nextHitId();
    this.x = owner.x;
    this.y = owner.y - 150;
    this.ring = world.phaser.add.image(this.x, this.y, 'ring').setTint(o.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH).setScale(0.3);
    if (o.art) for (let i = 0; i < 6; i++) world.fx.fling(o.art, owner.x, owner.y - 150, owner.x + (Math.random() - 0.5) * 900, owner.y - 150 - Math.random() * 300, 520, { scale: 0.8 });
  }

  /** grows a fixed amount per logic frame (so hitstop / pause behave) */
  update() {
    this.t++;
    this.radius += 26;
    this.ring.setScale(this.radius / 58).setAlpha(Math.max(0, 1 - this.t / 32));
    if (this.t > 32) this.dead = true;
  }

  hitbox() {
    if (this.hit) return null;
    const r = this.radius;
    return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }

  props(): HitProps {
    return { damage: this.o.damage, hitstun: 14, blockstun: 10, pushback: 2, type: 'unblockable', special: true, projectile: true, color: this.o.color };
  }

  hitId() {
    return this.id;
  }

  onConnect(result: HitResult, victim: Fighter) {
    if (result === 'whiff' || result === 'countered') return;
    this.hit = true;
    victim.applyStatus(this.o.status, this.o.frames);
  }

  destroy() {
    this.ring.destroy();
  }
}

// ---------------------------------------------------------------- Screen-wide hazard (supers, cash rain)

export class Hazard implements Entity {
  dead = false;
  clashes = false;
  private t = 0;
  private id: number;
  private hitsDone = 0;

  constructor(
    readonly owner: Fighter,
    private o: { x0: number; x1: number; height: number; start: number; hits: number; every: number; damage: number; color: number; life: number; type?: 'mid' | 'unblockable'; chip?: number },
    world: World,
  ) {
    this.id = world.nextHitId();
  }

  update(world: World) {
    this.t++;
    if (this.t > this.o.start && (this.t - this.o.start) % this.o.every === 0 && this.hitsDone < this.o.hits) {
      this.id = world.nextHitId();
    }
    if (this.t > this.o.life) this.dead = true;
  }

  hitbox() {
    if (this.t < this.o.start || this.hitsDone >= this.o.hits) return null;
    const g = this.owner.world.groundY;
    return { x: this.o.x0, y: g - this.o.height, w: this.o.x1 - this.o.x0, h: this.o.height };
  }

  props(): HitProps {
    const last = this.hitsDone === this.o.hits - 1;
    return {
      damage: this.o.damage,
      hitstun: 30,
      blockstun: 20,
      pushback: 2,
      type: this.o.type ?? 'mid',
      special: true,
      projectile: true,
      knockdown: last,
      heavy: true,
      noScale: true,
      color: this.o.color,
      chip: this.o.chip ?? 0.25,
    };
  }

  hitId() {
    return this.id;
  }

  onConnect(result: HitResult) {
    if (result !== 'whiff') this.hitsDone++;
  }

  destroy() {}
}
