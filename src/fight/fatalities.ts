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
  unscripted: (k) => {
    k.chart(0, false);
    k.popups(['-87%', '-99%', 'LIQUIDATED', 'PnL: -$$$', 'why', 'nooo'], 0xea3943, 300, 14, 120, 240, 300);
    k.tintLoser(0xff6060, 600);
    k.banner('RAGE QUIT', 0xea3943, 1800);
    k.shake(2000, 600, 0.015);
    k.pixelate(2600, [0xea3943, 0x16e07a, 0x000000]);
    k.winPose(2800);
  },
  'king-sol': (k) => {
    k.rain('cash', 0, 40, 60, 360, 1);
    k.winnerTo(k.lx + (k.Wn.x < k.lx ? -10 : 10), 400, 400);
    k.shrink(900, 600);
    k.crown(k.Wn, 1500);
    k.banner('ALL HAIL THE KING', 0xffc22e, 1700);
    k.winPose(1900);
  },
  degenbro: (k) => {
    k.banner('GARRI: ALL-TIME HIGH', 0x16c784, 0);
    k.chart(200, true);
    k.rain('garri', 300, 14, 70, 200, 1.2);
    k.chart(1500, false);
    k.stamp('RUGGED', 0xea3943, 2200);
    k.dropOn('garri', 2500, 5);
    k.winPose(3000);
  },
  juniordip: (k) => {
    k.popups(['@reply guy: great post!', 'great post!!', 'pls notice', 'ser???', 'hello?', 'anyone?'], 0x4fb8ff, 0, 16, 120, 260, 300);
    k.banner('0 LIKES · 0 REPLIES', 0x8899aa, 1300);
    k.tintLoser(0x555555, 1400);
    k.fadeLoser(2200, 900);
    k.winPose(2400);
  },
  bloomstar: (k) => {
    k.scroll(['analyzing...', 'RSI: 99', 'MACD: confused', 'fib 0.618... 0.786...', 'support? resistance?', 'head and shoulders and knees and toes', 'overanalyzed', 'ERROR'], '#ffb627', 0, 1800);
    k.spin('star', 200, 1600, 3);
    k.bluescreen(2000, ['Opponent has over-analyzed and stopped responding.', '', 'Collecting error info: 100%']);
    k.winPose(3400);
  },
  'samuel-xeus': (k) => {
    k.banner('🧵 1/47', 0xd9ff2e, 0);
    k.scroll(Array.from({ length: 47 }, (_, i) => `${i + 1}/47  Let me explain why ${['DeFi', 'L2s', 'memecoins', 'narratives', 'liquidity'][i % 5]} matter...`), '#d9ff2e', 200, 2600);
    k.rain('thread', 500, 14, 120, 240, 1.2);
    k.tintLoser(0x777777, 1500);
    k.stamp('TL;DR', 0xd9ff2e, 2900);
    k.shrink(3100, 500);
    k.winPose(3300);
  },
  achillas: (k) => {
    k.spin('lens', 0, 1200, 2.4);
    k.chart(300, false);
    k.popups(['ENTRY ✓', 'TARGET ✓', 'STOP LOSS ✓', 'R:R 1:100'], 0x3dff8f, 600, 4, 300);
    k.stamp('STOPPED OUT', 0xea3943, 2200);
    k.pixelate(2600, [0x3dff8f, 0xea3943, 0xffffff]);
    k.winPose(2800);
  },
  'dami-defi': (k) => {
    k.banner('WHALE TRACKED', 0xff3355, 0);
    k.popups(['-12 SOL', '-40 SOL', '-200 SOL', 'balance: 0', 'tx failed', 'approve?'], 0xff3355, 300, 12, 140, 240, 280);
    k.rain('gem', 400, 12, 80, 240);
    k.at(800, () => {
      // wallet contents fly to the winner
      for (let i = 0; i < 20; i++) k.c.fx.fling('solcoin', k.lx, k.ly - 150, k.Wn.x, k.Wn.y - 160, 500 + i * 40, { scale: 0.7 });
    });
    k.stamp('DRAINED', 0xff3355, 2300);
    k.shrink(2600, 500);
    k.winPose(2800);
  },
  'prudent-sammy': (k) => {
    k.banner('...', 0xffb84d, 0);
    k.popups(['zzz', 'still waiting', 'patience...', 'any minute now'], 0xffb84d, 400, 4, 300);
    k.at(1600, () => k.L.setAngle(-12));
    k.banner('*yawn*', 0xffffff, 1700, k.ly - 340, 40);
    k.winnerTo(k.lx + (k.Wn.x < k.lx ? -120 : 120), 2200, 400);
    k.at(2650, () => k.c.fx.spark(k.lx, k.ly - 160, 0xffb84d, true));
    k.confetti(2700);
    k.winPose(2900);
  },
  udy: (k) => {
    k.banner('#1 TRENDING', 0xd8d8d8, 0);
    k.popups(['#UdyWins', '#Trending', '100K posts', 'viral', '#GG'], 0xd8d8d8, 200, 16, 110, 300, 320);
    k.winnerTo(k.lx, 1200, 300);
    k.at(1500, () => k.L.setAngle(-80));
    k.stamp('TRENDING', 0x1d9bf0, 2200);
    k.fadeLoser(2500, 700);
    k.winPose(2700);
  },
  'crypto-hak': (k) => {
    k.dropOn('invoice', 200, 1.3);
    k.popups(['GAS: 9,999 SOL', 'insufficient funds', 'tx stuck', 'retry?'], 0xff2b2b, 900, 6, 180);
    k.stamp('INSUFFICIENT FUNDS', 0xff2b2b, 2100, 64);
    k.pixelate(2700, [0xff2b2b, 0xffffff]);
    k.winPose(2900);
  },
  karo: (k) => {
    k.freeze(0);
    k.at(300, () => k.L.setAngle(8));
    k.banner('STAY COLD', 0x8fd6ff, 600);
    k.popups(['📸', 'pose', 'style 100', 'drip'], 0x8fd6ff, 900, 6, 160);
    k.flash(1800, 200, 230, 255);
    k.stamp('ICE COLD', 0x8fd6ff, 2200);
    k.winPose(2400);
  },
  illusions: (k) => {
    k.at(0, () => {
      for (let i = 0; i < 6; i++) {
        const g = k.c.loser.view.ghost(0.5, 0xff7a1a, 1600);
        k.s.tweens.add({ targets: g, x: g.x + (i - 2.5) * 110, duration: 600, ease: 'Sine.easeOut' });
      }
    });
    k.at(400, () => k.s.tweens.add({ targets: k.L, angle: 360 * 3, duration: 2000 }));
    k.banner('WHICH ONE IS REAL?', 0xff7a1a, 600);
    k.spin('echo', 800, 1600, 4);
    k.fadeLoser(2100, 800);
    k.banner('NONE OF THEM', 0xff7a1a, 2600, k.ly - 320, 46);
    k.winPose(2800);
  },
  fgs: (k) => {
    k.banner('OFFICIAL STATEMENT', 0xff8c42, 0);
    k.rain('statement', 200, 10, 90, 200, 1);
    k.dropOn('statement', 1300, 5);
    k.stamp('FINAL', 0xff8c42, 2000);
    k.winPose(2300);
  },
  zaya: (k) => {
    k.scroll(['$ compile opponent.ts', 'warning: skill issue', 'error TS2339: "defense" does not exist', 'optimizing...', 'removing dead code...', 'opponent: removed', 'Build succeeded.'], '#2be0ff', 0, 2200);
    k.rain('code', 300, 14, 80, 240);
    k.at(1500, () => k.L.setTint(0x2be0ff));
    k.pixelate(2400, [0x2be0ff, 0x2bff88, 0xffffff]);
    k.winPose(2600);
  },
  senpai: (k) => {
    k.banner('TRAINING ARC', 0x7cd957, 0);
    k.popups(['100 push-ups', '100 sit-ups', '10km run', 'again', 'AGAIN', 'one more set'], 0x7cd957, 200, 12, 160);
    k.at(400, () => k.s.tweens.add({ targets: k.L, y: k.L.y - 40, yoyo: true, repeat: 6, duration: 140 }));
    k.at(2200, () => k.s.tweens.add({ targets: k.L, angle: -90, duration: 400, ease: 'Bounce.easeOut' }));
    k.stamp('COLLAPSED', 0x7cd957, 2600);
    k.winPose(2800);
  },
  'ugly-grm': (k) => {
    k.banner('PURE UNFILTERED REALITY', 0x9b4dff, 0, k.ly - 400, 46);
    k.popups(['your bags', 'your PnL', 'your entries', 'your exits', 'reality'], 0x9b4dff, 300, 10, 140);
    k.flash(1700, 200, 120, 255);
    k.shake(1700, 500, 0.03);
    k.pixelate(2000, [0x9b4dff, 0xffffff, 0x000000]);
    k.winPose(2200);
  },
  'one-random-guy': (k) => {
    k.banner('WHO IS THIS GUY?', 0xff4d6d, 0);
    k.popups(['+1 follower', '+99 likes', '+7 reposts', 'NOTICED', '+12 replies', 'main character'], 0xff4d6d, 300, 16, 110, 300, 320);
    k.at(400, () => {
      for (let i = 0; i < 12; i++) k.c.fx.fling('heart', k.Wn.x, k.Wn.y - 300, k.Wn.x + (Math.random() - 0.5) * 300, k.Wn.y - 500, 900);
    });
    k.stamp('FINALLY NOTICED', 0xff4d6d, 2000, 72, k.c.winner.y - 380);
    k.confetti(2400);
    k.winPose(2500);
  },
  seunn: (k) => {
    k.banner('DEAL CLOSER', 0xff4b2b, 0);
    k.at(300, () => {
      const p = k.s.add.image(k.lx, k.ly - 200, 'briefcase').setDepth(92).setScale(0);
      k.s.tweens.add({ targets: p, scale: 3, duration: 500, ease: 'Back.easeOut' });
      k.s.tweens.add({ targets: p, alpha: 0, delay: 2000, duration: 300, onComplete: () => p.destroy() });
    });
    k.shrink(900, 700);
    k.stamp('SIGNED', 0xff4b2b, 1800);
    k.stamp('CLOSED', 0xffffff, 2500, 90, k.ly - 320);
    k.winPose(2700);
  },
  echo: (k) => {
    k.banner('GROWTH STRATEGY', 0x7a5cff, 0);
    k.at(300, () => k.s.tweens.add({ targets: k.L, scaleX: k.L.scaleX * 4, scaleY: k.L.scaleY * 4, duration: 1800, ease: 'Quad.easeIn' }));
    k.at(300, () => k.s.tweens.add({ targets: k.L, y: k.L.y - 600, delay: 1200, duration: 700, ease: 'Quad.easeIn' }));
    k.popups(['+10%', '+50%', '+200%', '+1000%'], 0x7a5cff, 500, 8, 180);
    k.stamp('OUTGROWN', 0x7a5cff, 2500);
    k.winPose(2700);
  },
  salam: (k) => {
    k.banner('NEW BEGINNINGS', 0xe6e6e6, 0);
    k.at(400, () => k.L.setTint(0xffffff));
    k.flash(900);
    k.popups(['Are you sure?', 'Delete opponent?', 'This cannot be undone'], 0xe6e6e6, 1000, 3, 250);
    k.stamp('DELETED', 0xe6e6e6, 2000);
    k.pixelate(2300, [0xffffff, 0xaaaaaa, 0x000000]);
    k.winPose(2500);
  },
  raviel: (k) => {
    k.banner('WELCOME TO THE CASINO', 0xe0263a, 0);
    k.spin('roulette', 200, 1800, 2.5);
    k.rain('chip', 400, 18, 60, 240);
    k.rain('card', 600, 10, 100, 240, 1.3);
    k.popups(['BET: ALL', 'RED...', 'BLACK!', 'house wins'], 0xe0263a, 900, 4, 300);
    k.stamp('BROKE', 0xe0263a, 2400);
    k.shrink(2700, 500);
    k.winPose(2900);
  },
  rex: (k) => {
    k.at(0, () => {
      const beam = k.s.add.rectangle(k.lx, k.ly - 600, 220, 1400, 0xfff2b0, 0).setDepth(84).setBlendMode(Phaser.BlendModes.ADD);
      k.s.tweens.add({ targets: beam, alpha: 0.6, duration: 600 });
      k.s.tweens.add({ targets: beam, alpha: 0, delay: 2600, duration: 400, onComplete: () => beam.destroy() });
    });
    k.banner('IF THE LORD WILLS', 0xffcc33, 200);
    k.at(800, () => k.s.tweens.add({ targets: k.L, y: k.L.y - 700, alpha: 0.2, duration: 2000, ease: 'Quad.easeIn' }));
    k.at(900, () => k.L.setTint(0xfff2b0));
    k.stamp('ASCENDED', 0xffcc33, 2500);
    k.winPose(2700);
  },
  noir: (k) => {
    k.at(0, () => k.c.winner.view.setVisible(false));
    k.at(0, () => k.c.fx.burst(k.Wn.x, k.Wn.y - 150, 0xe8323c, 20, 300));
    k.at(500, () => {
      const g = k.s.add.image(k.lx, k.ly - 160, 'slash').setDepth(95).setTint(0xffffff).setScale(3, 2).setBlendMode(Phaser.BlendModes.ADD);
      k.s.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
      k.c.sfx.play('slash');
    });
    k.at(800, () => {
      k.c.winner.view.setVisible(true);
      k.Wn.x = k.lx + (k.Wn.x < k.lx ? 220 : -220);
    });
    k.banner('...', 0xffffff, 1000);
    k.at(1800, () => k.s.tweens.add({ targets: k.L, angle: -90, duration: 300 }));
    k.stamp('NEVER SAW IT', 0xe8323c, 2100, 72);
    k.fadeLoser(2400, 500);
    k.winPose(2600);
  },
  rayan: (k) => {
    k.chart(0, true, 0x2f6bff);
    k.at(200, () => k.s.tweens.add({ targets: k.Wn, y: k.Wn.y - 160, duration: 1600, ease: 'Sine.easeInOut' }));
    k.popups(['$10K', '$100K', '$500K', '$1,000,000', '$9,999,999'], 0x2f6bff, 300, 5, 300, 120, 200);
    k.banner('OPPONENT: $0', 0xea3943, 1800);
    k.tintLoser(0x444444, 1800);
    k.at(2400, () => k.s.tweens.add({ targets: k.Wn, y: k.c.winner.y + 18, duration: 300 }));
    k.shrink(2400, 500);
    k.winPose(2800);
  },
  yoshai: (k) => {
    k.banner('MARKETING CAMPAIGN', 0x6fa8ff, 0);
    k.rain('promo', 200, 16, 70, 260);
    k.rain('meme', 400, 10, 110, 260);
    k.popups(['sponsored', 'ad', 'skip ad', 'BUY NOW', 'limited offer'], 0x6fa8ff, 600, 10, 120);
    k.at(1500, () => k.s.tweens.add({ targets: k.L, alpha: 0.25, duration: 800 }));
    k.stamp('IRRELEVANT', 0x6fa8ff, 2300);
    k.fadeLoser(2600, 400);
    k.winPose(2800);
  },
  'crypto-baddie': (k) => {
    k.chart(0, true);
    k.banner('ALL-TIME HIGH', 0x7dff4d, 300);
    k.at(1300, () => {
      const b = k.s.add.text(k.lx, k.ly - 360, 'SELL', { fontFamily: FONT_DISPLAY, fontSize: '64px', color: '#fff', backgroundColor: '#ea3943' }).setPadding(24, 4, 24, 4).setOrigin(0.5).setDepth(96).setScale(0);
      k.s.tweens.add({ targets: b, scale: 1, duration: 200, ease: 'Back.easeOut' });
      k.s.tweens.add({ targets: b, scale: 0.85, delay: 600, duration: 80, yoyo: true });
      k.s.tweens.add({ targets: b, alpha: 0, delay: 1400, duration: 300, onComplete: () => b.destroy() });
    });
    k.chart(1900, false);
    k.stamp('SOLD THE TOP', 0xea3943, 2300, 72);
    k.pixelate(2600, [0xea3943, 0x7dff4d]);
    k.winPose(2800);
  },
  arlecchino: (k) => {
    k.at(0, () => k.L.setTint(0xc4182f));
    k.rain('rust', 100, 10, 90, 220);
    k.popups(['segfault', 'panic!', 'stack overflow', 'null pointer', 'core dumped'], 0xc4182f, 300, 10, 120);
    k.bluescreen(1600, ['A fatal exception has occurred in OPPONENT.EXE', '', 'The system has been halted.']);
    k.stamp('CRASHED', 0xc4182f, 3000);
    k.winPose(3100);
  },
  laka: (k) => {
    k.chart(0, false, 0x9b30ff);
    k.at(300, () => {
      for (let i = 0; i < 16; i++) {
        k.s.time.delayedCall(i * 60, () => {
          const x = k.lx - 260 + i * 34;
          const fl = k.s.add.image(x, k.ly, 'flame').setScale(1.5 + Math.random()).setDepth(91).setTint(0xc77dff).setBlendMode(Phaser.BlendModes.ADD);
          k.s.tweens.add({ targets: fl, y: k.ly - 420, alpha: 0, duration: 1200, onComplete: () => fl.destroy() });
        });
      }
    });
    k.tintLoser(0x9b30ff, 600);
    k.banner('THE LAST CANDLE', 0x9b30ff, 900);
    k.shake(1200, 1000, 0.02);
    k.pixelate(2300, [0x9b30ff, 0xc77dff, 0x000000]);
    k.winPose(2500);
  },
  // ---------------------------------------------------------------- batch 2
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
  otaobayom: (k) => {
    k.banner('BY ROYAL DECREE', 0xff2b3d, 0);
    k.rain('crown', 200, 8, 80, 220, 0.8);
    k.at(900, () => {
      const scroll = k.s.add.rectangle(k.lx, k.ly - 150, 20, 320, 0xf5deb3).setStrokeStyle(4, 0xb8860b).setDepth(92);
      k.s.tweens.add({ targets: scroll, width: 300, duration: 500, ease: 'Back.easeOut' });
      k.s.tweens.add({ targets: scroll, width: 20, delay: 1500, duration: 400, onComplete: () => scroll.destroy() });
    });
    k.stamp('BANISHED', 0xff2b3d, 1500);
    k.shrink(2000, 400);
    k.winPose(2700);
  },
  gafar: (k) => {
    k.scroll(['git checkout -b hard-fork', 'deploying...', 'chain A: ok', 'chain B: ok', 'opponent: forked', 'consensus: lost'], '#2bff7a', 0, 1800);
    k.tintLoser(0x2bff7a, 600);
    k.at(1900, () => {
      const L = k.L;
      for (const dir of [-1, 1]) {
        const g = k.s.add.image(L.x, L.y, L.texture.key, L.frame.name).setOrigin(L.originX, L.originY).setScale(L.scaleX, L.scaleY).setFlipX(L.flipX).setTint(0x2bff7a).setAlpha(0.8).setDepth(L.depth);
        k.s.tweens.add({ targets: g, x: L.x + dir * 500, alpha: 0, duration: 1200, onComplete: () => g.destroy() });
      }
      L.setVisible(false);
      k.c.sfx.play('ko');
    });
    k.banner('HARD FORK', 0x2bff7a, 2000);
    k.winPose(2900);
  },
  nipherme: (k) => {
    k.at(0, () => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const leaf = k.s.add.image(k.lx, k.ly - 150, 'leaf').setDepth(92).setScale(0).setAngle((a * 180) / Math.PI).setTint(0xff6fa8);
        k.s.tweens.add({ targets: leaf, x: k.lx + Math.cos(a) * 90, y: k.ly - 150 + Math.sin(a) * 120, scale: 3, duration: 700, ease: 'Back.easeOut' });
        k.s.tweens.add({ targets: leaf, x: k.lx, y: k.ly - 150, scale: 4, delay: 1300, duration: 400 });
        k.s.tweens.add({ targets: leaf, alpha: 0, delay: 2500, duration: 400, onComplete: () => leaf.destroy() });
      }
    });
    k.banner('NIPPED IN THE BUD', 0xff2d78, 300);
    k.fadeLoser(1400, 300);
    k.confetti(2300);
    k.winPose(2600);
  },
  limitlessdami: (k) => {
    k.banner('TO INFINITY', 0x2f6bff, 0);
    k.at(400, () => {
      k.c.fx.shockwave(k.lx, k.ly - 40, 0x2f6bff, 2);
      k.s.tweens.add({ targets: k.L, y: k.L.y - 1600, scaleX: k.L.scaleX * 0.2, scaleY: k.L.scaleY * 0.2, duration: 1600, ease: 'Quad.easeIn' });
      k.c.sfx.play('hitHeavy');
    });
    k.at(2100, () => {
      const st = k.s.add.image(k.lx, k.ly - 600, 'star').setDepth(95).setScale(0.3).setTint(0xffffff);
      k.s.tweens.add({ targets: st, scale: 0.6, alpha: 0.4, yoyo: true, repeat: 4, duration: 180, onComplete: () => st.destroy() });
    });
    k.popups(['∞', 'no ceiling', 'still going', 'bye'], 0x2f6bff, 800, 4, 250);
    k.winPose(2600);
  },
  zyloinsol: (k) => {
    k.freeze(0);
    k.banner('NETWORK HALT', 0xa24bff, 200);
    k.at(700, () => {
      const bar = k.s.add.rectangle(k.lx - 200, k.ly - 380, 0, 22, 0x14f195).setOrigin(0, 0.5).setDepth(96);
      const box = k.s.add.rectangle(k.lx, k.ly - 380, 404, 28).setStrokeStyle(3, 0xffffff).setDepth(96);
      const t = k.s.add.text(k.lx, k.ly - 420, 'Restarting validators...', { fontFamily: FONT_BODY, fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(96);
      k.s.tweens.add({ targets: bar, width: 396, duration: 900, ease: 'Expo.easeOut' });
      k.s.tweens.add({ targets: bar, width: 380, duration: 400, yoyo: true, repeat: 2, delay: 900 });
      k.s.time.delayedCall(2700, () => [bar, box, t].forEach((o) => o.destroy()));
    });
    k.pixelate(2600, [0x9945ff, 0x14f195, 0x000000]);
    k.winPose(2800);
  },
  hundred: (k) => {
    k.at(0, () => {
      const t = k.s.add.text(k.lx, k.ly - 420, '1x', { fontFamily: FONT_DISPLAY, fontSize: '72px', color: '#ffc22e', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(96);
      const counter = { n: 1 };
      k.s.tweens.add({ targets: counter, n: 100, duration: 2000, ease: 'Cubic.easeIn', onUpdate: () => t.setText(`${Math.floor(counter.n)}x`) });
      k.s.time.delayedCall(2800, () => t.destroy());
    });
    for (let i = 0; i < 14; i++) k.at(i * 140, () => {
      k.c.fx.spark(k.lx + (Math.random() - 0.5) * 80, k.ly - 120 - Math.random() * 140, 0xffc22e, true);
      k.c.sfx.play('hit');
    });
    k.at(2100, () => {
      for (let i = 0; i < 26; i++) k.c.fx.fling('solcoin', k.lx, k.ly - 150, k.lx + (Math.random() - 0.5) * 600, k.ly - 300 - Math.random() * 300, 700, { spin: 1 });
      k.L.setVisible(false);
      k.c.sfx.play('ko');
    });
    k.winPose(2600);
  },
  flipper: (k) => {
    k.banner('HEADS OR TAILS?', 0x3b6bff, 0);
    k.at(400, () => {
      k.s.tweens.add({ targets: k.L, y: k.L.y - 300, duration: 450, yoyo: true, ease: 'Quad.easeOut' });
      k.s.tweens.add({ targets: k.L, scaleX: 0, duration: 120, yoyo: true, repeat: 3 });
      k.c.sfx.play('whoosh');
    });
    k.at(1400, () => k.s.tweens.add({ targets: k.L, angle: { from: -12, to: 12 }, duration: 140, yoyo: true, repeat: 3 }));
    k.stamp('FLIPPED', 0x3b6bff, 2100);
    k.shrink(2300, 400);
    k.winPose(2800);
  },
  '0xtochi': (k) => {
    k.banner('RESEARCH COMPLETE', 0xff8ad8, 0);
    k.rain('paper', 200, 36, 45, 120, 1.4);
    k.dropOn('paper', 1800, 5);
    k.popups(['page 1/1000', 'tokenomics', 'appendix C', 'DYOR'], 0xff8ad8, 400, 4, 300);
    k.winPose(2700);
  },
  headboy: (k) => {
    k.banner('DETENTION', 0x2be0c0, 0);
    k.at(300, () => {
      k.s.tweens.add({ targets: k.L, x: k.lx + (k.L.x < k.Wn.x ? -320 : 320), duration: 700, ease: 'Quad.easeInOut' });
      k.c.sfx.play('whoosh');
    });
    k.at(1100, () => {
      const hat = k.s.add.triangle(k.L.x, k.L.y - k.L.displayHeight - 40, 0, 90, 35, 0, 70, 90, 0xf5f5f5).setStrokeStyle(3, 0x222222).setDepth(93);
      const d = k.s.add.text(hat.x, hat.y + 18, 'D', { fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#c0392b' }).setOrigin(0.5).setDepth(94);
      k.s.time.delayedCall(2200, () => {
        hat.destroy();
        d.destroy();
      });
    });
    k.popups(['RING RING', 'SIT DOWN', 'NO TALKING', 'FACE THE WALL'], 0x2be0c0, 1300, 4, 250);
    k.tintLoser(0x888888, 1500);
    k.winPose(2600);
  },
  digitek: (k) => {
    k.banner('LIQUIDATION CASCADE', 0xea3943, 0);
    k.chart(100, false);
    k.at(700, () => {
      const c = k.s.add.image(k.lx, k.ly - 700, 'candleR').setDepth(92).setScale(3, 5);
      k.s.tweens.add({ targets: c, y: k.ly + 300, duration: 1200, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
      k.s.tweens.add({ targets: k.L, y: k.L.y + 500, delay: 700, duration: 700, ease: 'Quad.easeIn' });
    });
    k.popups(['-10%', '-30%', '-70%', 'MARGIN CALL'], 0xea3943, 900, 4, 250);
    k.shake(1400, 500, 0.02);
    k.winPose(2700);
  },
  '100x-arc': (k) => {
    k.banner('BUZZER BEATER', 0xf07a1a, 0);
    k.at(300, () => {
      const hoop = k.s.add.ellipse(k.lx, k.ly - 520, 180, 40).setStrokeStyle(8, 0xff5a1f).setDepth(93);
      const board = k.s.add.rectangle(k.lx, k.ly - 600, 260, 150, 0xffffff, 0.85).setStrokeStyle(4, 0x222222).setDepth(92);
      k.s.time.delayedCall(2600, () => {
        hoop.destroy();
        board.destroy();
      });
    });
    k.at(800, () => {
      k.s.tweens.add({ targets: k.L, y: k.L.y - 520, duration: 500, ease: 'Quad.easeOut' });
      k.s.tweens.add({ targets: k.L, y: k.L.y + 200, alpha: 0, delay: 600, duration: 400, ease: 'Quad.easeIn' });
      k.c.sfx.play('whoosh');
    });
    k.at(1800, () => k.c.sfx.play('announce'));
    k.banner('100 - 0', 0xffffff, 1900, k.ly - 300, 80);
    k.winPose(2700);
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
