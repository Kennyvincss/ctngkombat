import Phaser from 'phaser';
import { FONT_DISPLAY } from '../config';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** World-space visual effects. Everything here is cosmetic. */
export class Effects {
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  /** set false to skip expensive extras on slow devices */
  lowFx = false;

  constructor(private scene: Phaser.Scene, private depth = 50) {}

  private emitter(texture: string, color: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, key: string) {
    const id = `${key}-${color}`;
    let em = this.emitters.get(id);
    if (!em) {
      em = this.scene.add.particles(0, 0, texture, { ...cfg, tint: color, emitting: false });
      em.setDepth(this.depth + 5);
      this.emitters.set(id, em);
    }
    return em;
  }

  spark(x: number, y: number, color: number, big = false) {
    const em = this.emitter('px', color, {
      speed: { min: 180, max: big ? 720 : 480 },
      lifespan: { min: 160, max: big ? 420 : 300 },
      scale: { start: big ? 2.2 : 1.6, end: 0 },
      angle: { min: 0, max: 360 },
      blendMode: 'ADD',
    }, 'spark');
    em.explode(big ? 26 : 14, x, y);
    const s = this.scene.add.image(x, y, 'spark').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 6);
    s.setScale(big ? 1.6 : 1).setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({ targets: s, scale: s.scale * 1.6, alpha: 0, duration: big ? 200 : 140, onComplete: () => s.destroy() });
    const w = this.scene.add.image(x, y, 'dot').setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 6).setScale(big ? 5 : 3);
    this.scene.tweens.add({ targets: w, alpha: 0, scale: w.scale * 1.4, duration: 120, onComplete: () => w.destroy() });
  }

  blockSpark(x: number, y: number) {
    const em = this.emitter('px', 0x66bbff, {
      speed: { min: 120, max: 320 },
      lifespan: 220,
      scale: { start: 1.4, end: 0 },
      angle: { min: 0, max: 360 },
      blendMode: 'ADD',
    }, 'block');
    em.explode(10, x, y);
    this.shockwave(x, y, 0x66bbff, 0.6);
  }

  shockwave(x: number, y: number, color: number, scale = 1) {
    const r = this.scene.add.image(x, y, 'ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 4).setScale(0.2 * scale);
    this.scene.tweens.add({ targets: r, scale: 2.2 * scale, alpha: 0, duration: 320, onComplete: () => r.destroy() });
  }

  burst(x: number, y: number, color: number, count = 24, speed = 420, texture = 'px') {
    const em = this.emitter(texture, color, {
      speed: { min: speed * 0.3, max: speed },
      lifespan: { min: 300, max: 800 },
      scale: { start: texture === 'px' ? 2 : 0.8, end: 0 },
      angle: { min: 0, max: 360 },
      gravityY: 400,
      blendMode: texture === 'px' ? 'ADD' : 'NORMAL',
    }, `burst-${texture}`);
    em.explode(count, x, y);
  }

  confetti(x: number, y: number, count = 80) {
    const colors = [0xf5c542, 0xff3b6b, 0x3bd8ff, 0x7dff9a, 0xb26bff, 0xffffff];
    for (const c of colors) {
      const em = this.emitter('px', c, {
        speed: { min: 200, max: 700 },
        lifespan: { min: 900, max: 1800 },
        scale: { start: 2.2, end: 1 },
        angle: { min: 200, max: 340 },
        gravityY: 700,
        rotate: { min: 0, max: 360 },
      }, 'confetti');
      em.explode(Math.ceil(count / colors.length), x, y);
    }
  }

  pixelBurst(x: number, y: number, colors: number[], count = 90) {
    for (const c of colors) {
      const em = this.emitter('px', c, {
        speed: { min: 60, max: 520 },
        lifespan: { min: 600, max: 1400 },
        scale: { start: 3, end: 0.5 },
        angle: { min: 0, max: 360 },
        gravityY: 300,
      }, 'pixel');
      em.explode(Math.ceil(count / colors.length), x, y);
    }
  }

  dust(x: number, y: number) {
    const em = this.emitter('dot', 0x8a7a66, {
      speedX: { min: -220, max: 220 },
      speedY: { min: -120, max: -10 },
      lifespan: 500,
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
    }, 'dust');
    em.explode(14, x, y - 6);
  }

  /** floating text (damage numbers, small callouts) */
  popup(x: number, y: number, text: string, color: number, size = 26, rise = 60, life = 700) {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: hex(color), stroke: '#000', strokeThickness: Math.max(3, size / 6) })
      .setOrigin(0.5)
      .setDepth(this.depth + 20);
    t.setScale(0.6);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: 0, delay: life * 0.55, duration: life * 0.45, onComplete: () => t.destroy() });
    return t;
  }

  /** big stamp, e.g. "RUGGED", "LIQUIDATED" */
  stamp(x: number, y: number, text: string, color: number, size = 84, angle = -12, hold = 1200) {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: hex(color), stroke: '#000', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(this.depth + 30)
      .setAngle(angle)
      .setScale(3)
      .setAlpha(0);
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 160, ease: 'Quad.easeIn' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 300, onComplete: () => t.destroy() });
    return t;
  }

  /** a texture object that tweens somewhere then fades */
  fling(key: string, x: number, y: number, tx: number, ty: number, ms = 500, opts: { tint?: number; scale?: number; spin?: number; fade?: boolean } = {}) {
    const img = this.scene.add.image(x, y, key).setDepth(this.depth + 8).setScale(opts.scale ?? 1);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    this.scene.tweens.add({
      targets: img,
      x: tx,
      y: ty,
      angle: (opts.spin ?? 0) * 360,
      alpha: opts.fade === false ? 1 : 0,
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
    return img;
  }

  /** rising aura flare around a point */
  aura(x: number, y: number, color: number) {
    const em = this.emitter('dot', color, {
      speedY: { min: -260, max: -120 },
      speedX: { min: -40, max: 40 },
      lifespan: 600,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD',
    }, 'aura');
    for (let i = 0; i < 4; i++) em.explode(6, x - 50 + Math.random() * 100, y - Math.random() * 260);
    this.shockwave(x, y - 140, color, 1.3);
  }

  /** horizontal speed line streaks */
  speedLines(x: number, y: number, dir: number, color: number) {
    for (let i = 0; i < 3; i++) {
      const b = this.scene.add.image(x - dir * (20 + i * 30), y - 60 - Math.random() * 180, 'bolt').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 3);
      b.setFlipX(dir < 0).setScale(1.5, 0.6);
      this.scene.tweens.add({ targets: b, x: b.x - dir * 120, alpha: 0, duration: 220, onComplete: () => b.destroy() });
    }
  }
}
