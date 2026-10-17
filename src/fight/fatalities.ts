import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY } from '../config';
import type { Fighter } from './Fighter';
import type { Effects } from './Effects';
import type { Sfx } from '../audio/Sfx';

// Comedic, cartoon fatalities (SPEC section 7): popups, confetti, money, charts and
// stamps. No blood, no gore. Each script runs ~4 seconds, then the scene shows FATALITY.

export interface FatalityCtx {
  scene: Phaser.Scene;
  fx: Effects;
  sfx: Sfx;
  winner: Fighter;
  loser: Fighter;
}

type Script = (k: Kit) => void;

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Building blocks shared by all fatalities. */
class Kit {
  readonly L: Phaser.GameObjects.Image;
  readonly Wn: Phaser.GameObjects.Image;
  readonly lx: number;
  readonly ly: number;
  readonly top: number;
  constructor(readonly c: FatalityCtx) {
    this.L = c.loser.view.display;
    this.Wn = c.winner.view.display;
    this.lx = c.loser.x;
    this.ly = c.loser.y;
    this.top = c.loser.y - 300;
  }
  get s() {
    return this.c.scene;
  }
  at(ms: number, fn: () => void) {
    this.s.time.delayedCall(ms, fn);
  }
  /** many social-media popup cards around the loser */
  popups(texts: string[], color: number, start: number, count: number, every = 90, spreadX = 260, spreadY = 300) {
    for (let i = 0; i < count; i++) {
      this.at(start + i * every, () => {
        const x = this.lx + (Math.random() - 0.5) * spreadX * 2;
        const y = this.ly - 60 - Math.random() * spreadY;
        const t = texts[i % texts.length];
        const box = this.s.add.container(x, y).setDepth(90);
        const txt = this.s.add.text(0, 0, t, { fontFamily: FONT_BODY, fontSize: '22px', color: '#111' }).setOrigin(0.5);
        const bg = this.s.add.rectangle(0, 0, txt.width + 24, 38, 0xffffff).setStrokeStyle(3, color);
        box.add([bg, txt]);
        box.setScale(0.2).setAngle((Math.random() - 0.5) * 16);
        this.s.tweens.add({ targets: box, scale: 1, duration: 140, ease: 'Back.easeOut' });
        this.s.tweens.add({ targets: box, alpha: 0, delay: 1400, duration: 300, onComplete: () => box.destroy() });
        this.c.sfx.play('select');
      });
    }
  }
  /** things raining onto the loser */
  rain(art: string, start: number, count: number, every = 60, spread = 220, scale = 1) {
    for (let i = 0; i < count; i++) {
      this.at(start + i * every, () => {
        const x = this.lx + (Math.random() - 0.5) * spread * 2;
        const img = this.s.add.image(x, this.ly - 760, art).setDepth(88).setScale(scale).setAngle(Math.random() * 360);
        this.s.tweens.add({
          targets: img,
          y: this.ly - 20 - Math.random() * 60,
          angle: img.angle + 180,
          duration: 520 + Math.random() * 200,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.s.tweens.add({ targets: img, alpha: 0, delay: 600, duration: 300, onComplete: () => img.destroy() });
          },
        });
      });
    }
  }
  stamp(text: string, color: number, at: number, size = 96, y = this.ly - 200) {
    this.at(at, () => {
      this.c.fx.stamp(this.lx, y, text, color, size, -10, 1600);
      this.c.sfx.play('hitHeavy');
      this.s.cameras.main.shake(180, 0.01);
    });
  }
  banner(text: string, color: number, at: number, y = this.ly - 400, size = 54) {
    this.at(at, () => {
      const t = this.s.add.text(this.lx, y, text, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color: hex(color), stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(95).setScale(0);
      this.s.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
      this.s.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 300, onComplete: () => t.destroy() });
    });
  }
  tintLoser(color: number, at: number) {
    this.at(at, () => this.L.setTint(color));
  }
  shake(at: number, ms = 300, amt = 0.015) {
    this.at(at, () => this.s.cameras.main.shake(ms, amt));
  }
  flash(at: number, r = 255, g = 255, b = 255) {
    this.at(at, () => this.s.cameras.main.flash(200, r, g, b));
  }
  /** loser bursts into confetti */
  confetti(at: number) {
    this.at(at, () => {
      this.c.fx.confetti(this.lx, this.ly - 150, 140);
      this.c.fx.shockwave(this.lx, this.ly - 150, 0xffffff, 2);
      this.L.setVisible(false);
      this.c.sfx.play('ko');
    });
  }
  /** loser breaks into pixels */
  pixelate(at: number, colors: number[]) {
    this.at(at, () => {
      this.c.fx.pixelBurst(this.lx, this.ly - 150, colors, 160);
      this.L.setVisible(false);
      this.c.sfx.play('ko');
    });
  }
  /** loser shrinks to nothing */
  shrink(at: number, ms = 700) {
    this.at(at, () => this.s.tweens.add({ targets: this.L, scaleX: 0, scaleY: 0, duration: ms, ease: 'Back.easeIn' }));
  }
  fadeLoser(at: number, ms = 600) {
    this.at(at, () => this.s.tweens.add({ targets: this.L, alpha: 0, duration: ms }));
  }
  /** a big object falls and squishes the loser flat */
  dropOn(art: string, at: number, scale = 1.6) {
    this.at(at, () => {
      const img = this.s.add.image(this.lx, this.ly - 900, art).setDepth(92).setScale(scale);
      this.s.tweens.add({
        targets: img,
        y: this.ly - (img.displayHeight / 2) + 10,
        duration: 380,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.s.tweens.add({ targets: this.L, scaleY: this.L.scaleY * 0.08, duration: 90 });
          this.c.fx.dust(this.lx, this.ly);
          this.c.fx.burst(this.lx, this.ly - 30, 0xffffff, 30, 400);
          this.s.cameras.main.shake(300, 0.025);
          this.c.sfx.play('wall');
        },
      });
    });
  }
  /** red chart line crashing behind the loser */
  chart(at: number, up = false, color = up ? 0x16c784 : 0xea3943) {
    this.at(at, () => {
      const g = this.s.add.graphics().setDepth(85);
      const pts: { x: number; y: number }[] = [];
      let y = up ? this.ly - 40 : this.ly - 420;
      for (let i = 0; i < 14; i++) {
        pts.push({ x: this.lx - 300 + i * 46, y });
        y += up ? -(10 + Math.random() * 30) : 10 + Math.random() * 34;
        y += (Math.random() - 0.5) * 30;
      }
      let n = 0;
      const ev = this.s.time.addEvent({
        delay: 50,
        repeat: pts.length - 2,
        callback: () => {
          n++;
          g.clear();
          g.lineStyle(8, color, 1);
          g.beginPath();
          g.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i <= n; i++) g.lineTo(pts[i].x, pts[i].y);
          g.strokePath();
        },
      });
      void ev;
      this.s.tweens.add({ targets: g, alpha: 0, delay: 2600, duration: 400, onComplete: () => g.destroy() });
    });
  }
  /** full-screen blue screen of death */
  bluescreen(at: number, lines: string[]) {
    this.at(at, () => {
      const cam = this.s.cameras.main;
      const w = cam.width / cam.zoom;
      const h = cam.height / cam.zoom;
      const x = cam.midPoint.x;
      const y = cam.midPoint.y;
      const r = this.s.add.rectangle(x, y, w + 40, h + 40, 0x0a52c7).setDepth(200);
      const t = this.s.add
        .text(x - w / 2 + 60, y - h / 2 + 80, [':(', '', ...lines].join('\n'), { fontFamily: FONT_BODY, fontSize: '34px', color: '#fff', lineSpacing: 8 })
        .setDepth(201);
      this.c.sfx.play('status');
      this.s.time.delayedCall(1300, () => {
        r.destroy();
        t.destroy();
        this.L.setVisible(false);
      });
    });
  }
  crown(target: Phaser.GameObjects.Image, at: number) {
    this.at(at, () => {
      const top = target.y - target.displayHeight;
      const cr = this.s.add.image(target.x, top - 300, 'crown').setOrigin(0.5, 1).setDepth(93).setScale(1.3);
      this.s.tweens.add({ targets: cr, y: top + 6, duration: 500, ease: 'Bounce.easeOut' });
      this.c.fx.aura(target.x, target.y, 0xffd23f);
      this.c.sfx.play('coin');
    });
  }
  freeze(at: number) {
    this.at(at, () => {
      this.L.setTint(0x99ddff);
      const ice = this.s.add.image(this.lx, this.ly + 10, 'ice').setOrigin(0.5, 1).setDepth(this.L.depth + 1).setScale(1.3, 1.15).setAlpha(0);
      this.s.tweens.add({ targets: ice, alpha: 1, duration: 300 });
      this.c.fx.burst(this.lx, this.ly - 150, 0xbfefff, 40, 300);
      this.c.sfx.play('counter');
    });
  }
  winnerTo(x: number, at: number, ms = 300) {
    this.at(at, () => {
      this.c.winner.view.ghost(0.5);
      this.s.tweens.add({ targets: this.Wn, x, duration: ms, ease: 'Quad.easeInOut' });
    });
  }
  /** big spinning thing behind the loser */
  spin(art: string, at: number, ms = 1500, scale = 2.5) {
    this.at(at, () => {
      const img = this.s.add.image(this.lx, this.ly - 160, art).setDepth(this.L.depth - 1).setScale(0).setAlpha(0.9);
      this.s.tweens.add({ targets: img, scale, angle: 720, duration: ms, ease: 'Cubic.easeOut' });
      this.s.tweens.add({ targets: img, alpha: 0, delay: ms, duration: 400, onComplete: () => img.destroy() });
    });
  }
  /** scrolling wall of text (threads, code) */
  scroll(lines: string[], color: string, at: number, ms = 2200, bg = 0x05070a) {
    this.at(at, () => {
      const x = this.lx;
      const y = this.ly - 200;
      const box = this.s.add.rectangle(x, y, 420, 340, bg, 0.92).setDepth(96).setStrokeStyle(3, 0xffffff);
      const t = this.s.add.text(x - 190, y + 170, lines.join('\n'), { fontFamily: FONT_BODY, fontSize: '22px', color, lineSpacing: 4 }).setDepth(97);
      const mask = box.createGeometryMask();
      t.setMask(mask);
      box.setVisible(true);
      this.s.tweens.add({ targets: t, y: y - 170 - t.height, duration: ms });
      this.s.time.delayedCall(ms, () => {
        t.destroy();
        box.destroy();
      });
    });
  }
  /** victory hops (views aren't ticked during fatalities, so animate directly) */
  winPose(at: number) {
    this.at(at, () => {
      this.s.tweens.add({ targets: this.Wn, y: this.Wn.y - 36, duration: 220, yoyo: true, repeat: 3, ease: 'Sine.easeOut' });
      this.c.fx.aura(this.Wn.x, this.c.winner.y, this.c.winner.accent);
    });
  }
  sound(name: Parameters<Sfx['play']>[0], at: number) {
    this.at(at, () => this.c.sfx.play(name));
  }
}

const COMMENTS = ['GIVEAWAY!!', 'drop wallet', 'me pls', 'SOL addy 👇', 'pick me', 'done ✅', 'tagged 3', 'when winner??', 'LFG', 'ser pls', 'following'];

const SCRIPTS: Record<string, Script> = {
  'promise-sol': (k) => {
    k.popups(COMMENTS, 0xff2d55, 0, 28, 70, 300, 340);
    k.rain('solcoin', 600, 18, 60, 240, 0.8);
    k.banner('ROAD TO A MILLION', 0xff2d55, 300);
    k.shake(2200, 500, 0.02);
    k.confetti(2700);
    k.winPose(2900);
  },
  onepeterr: (k) => {
    k.banner('GIVEAWAY ENTRY #1', 0x2f8bff, 0);
    k.spin('roulette', 400, 1800, 2.2);
    k.popups(['spinning...', 'spinning...', 'and the loser is...'], 0x2f8bff, 600, 3, 500);
    k.stamp('LOSER', 0xff3b3b, 2400);
    k.rain('wallet', 2500, 10, 50, 220, 1.1);
    k.confetti(3200);
    k.winPose(3300);
  },
  arlecchino: (k) => {
    k.at(0, () => k.L.setTint(0xc4182f));
    k.rain('rust', 100, 10, 90, 220);
    k.popups(['segfault', 'panic!', 'stack overflow', 'null pointer', 'core dumped'], 0xc4182f, 300, 10, 120);
    k.bluescreen(1600, ['A fatal exception has occurred in OPPONENT.EXE', '', 'The system has been halted.']);
    k.stamp('CRASHED', 0xc4182f, 3000);
    k.winPose(3100);
  },
  skroot: (k) => {
    k.banner('DONUTS', 0xff8a1f, 0);
    k.at(200, () => {
      for (let i = 0; i < 16; i++) {
        k.at(i * 90, () => {
          const a = (i / 16) * Math.PI * 4;
          k.c.fx.fling('smoke', k.lx + Math.cos(a) * 160, k.ly - 60, k.lx + Math.cos(a) * 220, k.ly - 140, 700, { scale: 1.6 });
        });
      }
    });
    k.winnerTo(k.lx + 180, 300, 300);
    k.winnerTo(k.lx - 180, 700, 300);
    k.winnerTo(k.lx + 180, 1100, 300);
    k.fadeLoser(1500, 700);
    k.stamp('GG', 0xffffff, 2400, 120, k.ly - 40);
    k.winPose(2900);
  },
  mystayor: (k) => {
    k.banner('VANISHING ACT', 0x6fa8ff, 0);
    k.at(400, () => {
      const cloth = k.s.add.rectangle(k.lx, k.ly - 160, 260, 360, 0x7a1f2b).setStrokeStyle(4, 0xffd23f).setDepth(93).setScale(1, 0);
      k.s.tweens.add({ targets: cloth, scaleY: 1, duration: 300 });
      k.s.time.delayedCall(1400, () => {
        k.L.setVisible(false);
        k.s.tweens.add({ targets: cloth, y: cloth.y - 600, alpha: 0, duration: 500, onComplete: () => cloth.destroy() });
        const duck = k.s.add.text(k.lx, k.ly - 20, '🦆', { fontSize: '64px' }).setOrigin(0.5, 1).setDepth(93);
        k.s.time.delayedCall(1600, () => duck.destroy());
        k.c.sfx.play('coin');
      });
    });
    k.spin('ring', 300, 1400, 2);
    k.winPose(2600);
  },
  evansofweb3: (k) => {
    k.banner('SPACES ENDED', 0xd94bff, 0);
    k.at(300, () => {
      const mic = k.s.add.image(k.lx, k.ly - 380, 'mic').setDepth(94).setScale(2);
      const x = k.s.add.text(k.lx, k.ly - 380, '✕', { fontFamily: FONT_DISPLAY, fontSize: '110px', color: '#ff3b3b' }).setOrigin(0.5).setDepth(95).setScale(0);
      k.s.tweens.add({ targets: x, scale: 1, delay: 500, duration: 200, ease: 'Back.easeOut' });
      k.s.time.delayedCall(2300, () => {
        mic.destroy();
        x.destroy();
      });
    });
    k.popups(['muted', 'left the Space', 'speaker removed', 'gm?'], 0xd94bff, 900, 4, 250);
    k.rain('avatar', 900, 12, 70, 240);
    k.fadeLoser(1800, 800);
    k.winPose(2800);
  },
};

const DEFAULT: Script = (k) => {
  k.popups(['GG', 'EZ', 'L'], 0xf5c542, 0, 10, 100);
  k.confetti(1500);
  k.winPose(1600);
};

/** Runs a fatality. Resolves after the script (~3.4 s). */
export function runFatality(ctx: FatalityCtx): number {
  const k = new Kit(ctx);
  ctx.sfx.play('fatality');
  (SCRIPTS[ctx.winner.id] ?? DEFAULT)(k);
  return 3600;
}
