import Phaser from 'phaser';
import type { AnimKey } from '../data/normals';

/**
 * Everything the combat code needs from a fighter's visuals. Phase A uses a
 * single cut-out animated in code (PuppetView). Phase B can provide a sprite
 * per pose (SpriteView) without touching combat code.
 */
export interface FighterView {
  readonly display: Phaser.GameObjects.Image;
  /** world position of the feet */
  setPosition(x: number, y: number): void;
  setFacing(facing: number): void;
  play(anim: AnimKey, opts?: { restart?: boolean }): void;
  readonly anim: AnimKey;
  flash(color?: number, frames?: number): void;
  setTint(color: number | null): void;
  setGlow(color: number | null): void;
  setAlpha(a: number): void;
  setVisible(v: boolean): void;
  setShield(on: boolean): void;
  /** a faded copy left behind (dash trails, clones, decoys) */
  ghost(alpha?: number, tint?: number, lifeMs?: number): Phaser.GameObjects.Image;
  /** called once per logic frame */
  tick(): void;
  destroy(): void;
  /** world-space height of the drawn figure */
  readonly height: number;
}

export const FIGHTER_HEIGHT = 330;

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const pulse = (t: number, len: number) => Math.sin(Math.min(1, t / len) * Math.PI);

export class PuppetView implements FighterView {
  readonly display: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private _anim: AnimKey = 'idle';
  private t = 0;
  private facing = 1;
  private baseScale: number;
  private flashT = 0;
  private tint: number | null = null;
  private x = 0;
  private y = 0;
  private glowFx: Phaser.FX.Glow | null = null;
  readonly height = FIGHTER_HEIGHT;

  constructor(
    protected scene: Phaser.Scene,
    protected textureKey: string,
    protected artFacesRight: boolean,
    protected accent: number,
    depth: number,
  ) {
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(depth - 2).setScale(1.3, 1.4);
    this.display = scene.add.image(0, 0, textureKey).setOrigin(0.5, 1).setDepth(depth);
    this.shield = scene.add.image(0, 0, 'shield').setOrigin(0, 1).setDepth(depth + 1).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.baseScale = FIGHTER_HEIGHT / this.display.height;
    this.display.setScale(this.baseScale);
  }

  get anim() {
    return this._anim;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setFacing(f: number) {
    this.facing = f >= 0 ? 1 : -1;
  }

  play(anim: AnimKey, opts?: { restart?: boolean }) {
    if (anim === this._anim && !opts?.restart) return;
    this._anim = anim;
    this.t = 0;
    this.onAnim(anim);
  }

  /** Phase B hook: swap texture per pose. */
  protected onAnim(_anim: AnimKey) {}

  flash(color = 0xffffff, frames = 5) {
    this.flashT = frames;
    this.display.setTintFill(color);
  }

  setTint(color: number | null) {
    this.tint = color;
    if (this.flashT <= 0) this.applyTint();
  }

  private applyTint() {
    if (this.tint === null) this.display.clearTint();
    else this.display.setTint(this.tint);
  }

  setGlow(color: number | null) {
    const fx = this.display.preFX;
    if (!fx) return;
    if (color === null) {
      if (this.glowFx) {
        fx.remove(this.glowFx);
        this.glowFx = null;
      }
      return;
    }
    if (this.glowFx) this.glowFx.color = color;
    else this.glowFx = fx.addGlow(color, 3, 0, false, 0.1, 10);
  }

  setAlpha(a: number) {
    this.display.setAlpha(a);
  }

  setVisible(v: boolean) {
    this.display.setVisible(v);
    this.shadow.setVisible(v);
    if (!v) this.shield.setVisible(false);
  }

  setShield(on: boolean) {
    this.shield.setVisible(on && this.display.visible);
  }

  ghost(alpha = 0.5, tint = this.accent, lifeMs = 260) {
    const d = this.display;
    const g = this.scene.add
      .image(d.x, d.y, d.texture.key)
      .setOrigin(0.5, 1)
      .setScale(d.scaleX, d.scaleY)
      .setRotation(d.rotation)
      .setFlipX(d.flipX)
      .setAlpha(alpha)
      .setTintFill(tint)
      .setDepth(d.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (lifeMs > 0) {
      this.scene.tweens.add({ targets: g, alpha: 0, duration: lifeMs, onComplete: () => g.destroy() });
    }
    return g;
  }

  tick() {
    this.t++;
    if (this.flashT > 0 && --this.flashT === 0) this.applyTint();

    const t = this.t;
    const s = this.baseScale;
    const f = this.facing;
    let sx = 1;
    let sy = 1;
    let dx = 0;
    let dy = 0;
    let rot = 0;

    switch (this._anim) {
      case 'idle':
        sy = 1 + 0.014 * Math.sin(t * 0.09);
        sx = 1 - 0.008 * Math.sin(t * 0.09);
        break;
      case 'walk':
        dy = -Math.abs(Math.sin(t * 0.22)) * 7;
        rot = 0.04 * Math.sin(t * 0.22);
        break;
      case 'crouch':
        sy = 0.66;
        sx = 1.06;
        break;
      case 'jump':
        sy = 1.04;
        sx = 0.97;
        rot = 0.05;
        break;
      case 'flip':
      case 'flipBack':
        rot = (this._anim === 'flip' ? 1 : -1) * Math.PI * 2 * ease(Math.min(1, t / 34));
        break;
      case 'light':
        dx = 22 * pulse(t, 9);
        rot = 0.07 * pulse(t, 9);
        sx = 1 + 0.05 * pulse(t, 9);
        break;
      case 'heavy':
        dx = t < 6 ? -10 * ease(t / 6) : -10 + 46 * pulse(t - 6, 16);
        rot = t < 6 ? -0.05 : 0.12 * pulse(t - 6, 16);
        sx = 1 + 0.08 * pulse(t - 6, 16);
        sy = 1 - 0.04 * pulse(t - 6, 16);
        break;
      case 'kick':
        dx = 30 * pulse(t, 14);
        rot = -0.16 * pulse(t, 14);
        break;
      case 'sweep':
        sy = 0.62;
        sx = 1.12;
        dx = 34 * pulse(t, 16);
        rot = 0.12 * pulse(t, 16);
        break;
      case 'uppercut':
        sy = 1 + 0.12 * pulse(t, 14);
        sx = 1 - 0.05 * pulse(t, 14);
        dy = -26 * pulse(t, 14);
        rot = -0.1 * pulse(t, 14);
        dx = 12 * pulse(t, 14);
        break;
      case 'overhead':
        rot = t < 8 ? -0.12 * ease(t / 8) : 0.24 * pulse(t - 8, 14);
        dx = t < 8 ? -6 : 30 * pulse(t - 8, 14);
        break;
      case 'special':
        dx = 26 * pulse(t, 18);
        sx = 1 + 0.1 * pulse(t, 18);
        rot = 0.08 * pulse(t, 18);
        break;
      case 'cast':
        dx = t < 8 ? -12 * ease(t / 8) : -12 + 24 * ease((t - 8) / 6);
        rot = t < 8 ? -0.06 : 0.05;
        break;
      case 'dash':
        rot = 0.14;
        sx = 1.12;
        sy = 0.94;
        break;
      case 'block':
        rot = -0.08;
        dx = -8;
        sx = 0.97;
        break;
      case 'hit':
        dx = -18 * Math.max(0, 1 - t / 12);
        rot = -0.14 * Math.max(0, 1 - t / 14);
        dx += (t < 6 ? Math.sin(t * 3) * 4 : 0);
        break;
      case 'knockdown': {
        const k = ease(t / 14);
        rot = -1.45 * k;
        dy = t > 14 && t < 22 ? -10 * Math.sin(((t - 14) / 8) * Math.PI) : 0;
        break;
      }
      case 'getup': {
        const k = ease(t / 16);
        rot = -1.45 * (1 - k);
        break;
      }
      case 'win':
        dy = -Math.abs(Math.sin(t * 0.12)) * 34;
        sy = 1 + 0.03 * Math.sin(t * 0.24);
        break;
      case 'dizzy':
        rot = Math.sin(t * 0.09) * 0.13;
        dx = Math.sin(t * 0.045) * 6;
        break;
      case 'grab':
        dx = 28 * pulse(t, 12);
        rot = 0.1;
        break;
      case 'stance':
        sy = 0.92 + 0.02 * Math.sin(t * 0.2);
        sx = 1.04;
        break;
    }

    const d = this.display;
    const flip = (f > 0) !== this.artFacesRight;
    d.setFlipX(flip);
    d.setPosition(this.x + dx * f, this.y + 18 + dy);
    d.setScale(s * sx, s * sy);
    d.setRotation(rot * f);

    this.shadow.setPosition(this.x, GROUND_SHADOW_Y.value + 6);
    const air = Math.max(0, GROUND_SHADOW_Y.value - this.y);
    this.shadow.setScale(1.3 * Math.max(0.4, 1 - air / 400), 1.4).setAlpha(Math.max(0.3, 1 - air / 500));

    if (this.shield.visible) {
      this.shield.setPosition(this.x + 20 * f, this.y - 20);
      this.shield.setFlipX(f < 0).setOrigin(f < 0 ? 1 : 0, 1);
      this.shield.setAlpha(0.6 + 0.3 * Math.sin(t * 0.6));
    }
  }

  destroy() {
    this.display.destroy();
    this.shadow.destroy();
    this.shield.destroy();
  }
}

/** Ground height for shadows (set by the stage). */
export const GROUND_SHADOW_Y = { value: 640 };

/** One fighter's pose atlas, from assets/sprites/manifest.json. */
export interface SpriteSet {
  /** height in pixels of the idle pose inside the atlas (every pose shares that scale) */
  idleH: number;
  poses: string[];
}

/** animations without their own drawing borrow another pose */
const BORROW: Partial<Record<AnimKey, AnimKey>> = { flip: 'jump', flipBack: 'jump', stance: 'crouch' };

/**
 * Phase B: hand-drawn poses. Each fighter has one texture atlas (assets/sprites/<id>.webp)
 * with a frame per pose; frames carry their own pivot (the feet under the body), so
 * swapping poses keeps the fighter planted. A little code motion goes on top: breathing,
 * walk cycle, recoil, spins. Missing poses fall back to the closest one we have.
 */
export class SpriteView implements FighterView {
  readonly display: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private _anim: AnimKey = 'idle';
  private pose = '';
  private t = 0;
  private facing = 1;
  private x = 0;
  private y = 0;
  private flashT = 0;
  private tint: number | null = null;
  private glowFx: Phaser.FX.Glow | null = null;
  private readonly scale: number;
  readonly height = FIGHTER_HEIGHT;

  constructor(
    private scene: Phaser.Scene,
    atlas: string,
    private set: SpriteSet,
    private accent: number,
    depth: number,
  ) {
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(depth - 2).setScale(1.3, 1.4);
    this.display = scene.add.image(0, 0, atlas, 'idle').setDepth(depth);
    this.shield = scene.add.image(0, 0, 'shield').setOrigin(0, 1).setDepth(depth + 1).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.scale = FIGHTER_HEIGHT / set.idleH;
    this.display.setScale(this.scale);
    this.show('idle');
  }

  get anim() {
    return this._anim;
  }

  private has(pose: string) {
    return this.set.poses.includes(pose);
  }

  private show(pose: string) {
    if (!this.has(pose)) pose = 'idle';
    if (pose === this.pose) return;
    this.pose = pose;
    this.display.setFrame(pose);
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setFacing(f: number) {
    this.facing = f >= 0 ? 1 : -1;
  }

  play(anim: AnimKey, opts?: { restart?: boolean }) {
    if (anim === this._anim && !opts?.restart) return;
    this._anim = anim;
    this.t = 0;
    this.show(BORROW[anim] ?? anim);
  }

  flash(color = 0xffffff, frames = 5) {
    this.flashT = frames;
    this.display.setTintFill(color);
  }

  setTint(color: number | null) {
    this.tint = color;
    if (this.flashT <= 0) this.applyTint();
  }

  private applyTint() {
    if (this.tint === null) this.display.clearTint();
    else this.display.setTint(this.tint);
  }

  setGlow(color: number | null) {
    const fx = this.display.preFX;
    if (!fx) return;
    if (color === null) {
      if (this.glowFx) {
        fx.remove(this.glowFx);
        this.glowFx = null;
      }
      return;
    }
    if (this.glowFx) this.glowFx.color = color;
    else this.glowFx = fx.addGlow(color, 3, 0, false, 0.1, 10);
  }

  setAlpha(a: number) {
    this.display.setAlpha(a);
  }

  setVisible(v: boolean) {
    this.display.setVisible(v);
    this.shadow.setVisible(v);
    if (!v) this.shield.setVisible(false);
  }

  setShield(on: boolean) {
    this.shield.setVisible(on && this.display.visible);
  }

  ghost(alpha = 0.5, tint = this.accent, lifeMs = 260) {
    const d = this.display;
    const g = this.scene.add
      .image(d.x, d.y, d.texture.key, d.frame.name)
      .setOrigin(d.originX, d.originY)
      .setScale(d.scaleX, d.scaleY)
      .setRotation(d.rotation)
      .setFlipX(d.flipX)
      .setAlpha(alpha)
      .setTintFill(tint)
      .setDepth(d.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (lifeMs > 0) {
      this.scene.tweens.add({ targets: g, alpha: 0, duration: lifeMs, onComplete: () => g.destroy() });
    }
    return g;
  }

  tick() {
    const t = ++this.t;
    if (this.flashT > 0 && --this.flashT === 0) this.applyTint();

    let sx = 1;
    let sy = 1;
    let dx = 0;
    let dy = 0;
    let rot = 0;
    switch (this._anim) {
      case 'idle':
        sy = 1 + 0.012 * Math.sin(t * 0.09);
        sx = 1 - 0.006 * Math.sin(t * 0.09);
        break;
      case 'walk':
        // two-step cycle: stride pose and guard pose
        this.show(Math.floor(t / 9) % 2 === 0 ? 'walk' : 'idle');
        dy = -Math.abs(Math.sin(t * (Math.PI / 9))) * 5;
        break;
      case 'crouch':
      case 'stance':
        sy = 1 + 0.01 * Math.sin(t * 0.12);
        break;
      case 'flip':
      case 'flipBack':
        rot = (this._anim === 'flip' ? 1 : -1) * Math.PI * 2 * ease(Math.min(1, t / 34));
        break;
      case 'light':
      case 'heavy':
      case 'grab':
        dx = 8 * pulse(t, 10);
        break;
      case 'kick':
      case 'sweep':
      case 'uppercut':
      case 'overhead':
      case 'special':
        dx = 10 * pulse(t, 14);
        break;
      case 'cast':
        sy = 1 + 0.02 * pulse(t, 16);
        break;
      case 'dash':
        dx = 6;
        break;
      case 'hit':
        dx = -14 * Math.max(0, 1 - t / 12) + (t < 6 ? Math.sin(t * 3) * 4 : 0);
        break;
      case 'knockdown':
        dy = t > 14 && t < 22 ? -8 * Math.sin(((t - 14) / 8) * Math.PI) : 0;
        break;
      case 'win':
        dy = -Math.abs(Math.sin(t * 0.1)) * 10;
        break;
      case 'dizzy':
        rot = Math.sin(t * 0.09) * 0.06;
        dx = Math.sin(t * 0.045) * 5;
        break;
    }

    const d = this.display;
    const f = this.facing;
    d.setFlipX(f < 0);
    // spin about the middle of the body, not the feet
    const spin = this._anim === 'flip' || this._anim === 'flipBack';
    const lift = spin ? (d.height * this.scale) / 2 : 0;
    d.setOrigin(d.frame.pivotX, spin ? 0.5 : 1);
    d.setPosition(this.x + dx * f, this.y + 10 + dy - lift);
    d.setScale(this.scale * sx, this.scale * sy);
    d.setRotation(rot * f);

    this.shadow.setPosition(this.x, GROUND_SHADOW_Y.value + 6);
    const air = Math.max(0, GROUND_SHADOW_Y.value - this.y);
    this.shadow.setScale(1.3 * Math.max(0.4, 1 - air / 400), 1.4).setAlpha(Math.max(0.3, 1 - air / 500));

    if (this.shield.visible) {
      this.shield.setPosition(this.x + 20 * f, this.y - 20);
      this.shield.setFlipX(f < 0).setOrigin(f < 0 ? 1 : 0, 1);
      this.shield.setAlpha(0.6 + 0.3 * Math.sin(t * 0.6));
    }
  }

  destroy() {
    this.display.destroy();
    this.shadow.destroy();
    this.shield.destroy();
  }
}
