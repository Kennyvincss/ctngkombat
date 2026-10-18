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
  /** every script's timings start this many ms in (after the beatdown) */
  offset = 0;
  constructor(readonly c: FatalityCtx) {
    this.L = c.loser.view.display;
    this.Wn = c.winner.view.display;
  }
  /** where the loser is drawn (the beatdown knocks them back) */
  get lx() {
    return this.c.loser.x + this.c.loser.show.dx;
  }
  get ly() {
    return this.c.loser.y;
  }
  get top() {
    return this.ly - 300;
  }
  get s() {
    return this.c.scene;
  }
  at(ms: number, fn: () => void) {
    this.s.time.delayedCall(ms + this.offset, fn);
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
  // batch 5 (generated by scripts/batch5_fighters.py)
  cupsey: (k) => {
    k.banner('OPERATION ABSORB', 0xffd21f, 200);
    k.rain('soapbubble', 300, 26, 50, 260, 1.2);
    k.shrink(1400);
    k.confetti(2300);
    k.winPose(2500);
  },
  cented: (k) => {
    k.freeze(200);
    k.banner('FREEZER BURN', 0x6fd3ff, 300);
    k.rain('ice', 300, 14, 60, 200);
    k.rain('flame', 1300, 18, 50, 220, 1.2);
    k.flash(1500, 255, 140, 60);
    k.fadeLoser(1800, 700);
    k.winPose(2600);
  },
  tekkers: (k) => {
    k.banner('STREET RULES', 0xff7a1a, 200);
    k.popups(['POW', 'BAM', 'OOF', 'CRACK', 'WHAM'], 0xff7a1a, 300, 14, 70);
    k.shake(1500, 500, 0.025);
    k.stamp('K.O.', 0xff2d3a, 1800);
    k.fadeLoser(2000, 700);
    k.winPose(2600);
  },
  dior: (k) => {
    k.pixelate(200, [0x000000, 0xffffff, 0x888888]);
    k.banner('BLACK AND WHITE', 0xffffff, 400);
    k.flash(1200);
    k.fadeLoser(1400, 900);
    k.winPose(2500);
  },
  poorgoat: (k) => {
    k.banner('WALLET CHECK', 0xff8c1a, 200);
    k.popups(['$0.00', 'insufficient funds', 'declined', 'gas?'], 0xff8c1a, 400, 10, 110);
    k.rain('zero', 900, 14, 70, 240);
    k.stamp('BROKE', 0xff2d3a, 2000);
    k.winPose(2600);
  },
  otta: (k) => {
    k.banner('UNBLINKING', 0x8a4dff, 200);
    k.rain('shadoworb', 300, 16, 70, 240);
    k.pixelate(1300, [0x000000, 0x2a0050, 0x8a4dff]);
    k.fadeLoser(1600, 900);
    k.winPose(2600);
  },
  unipcs: (k) => {
    k.banner('SYSTEM SHUTDOWN', 0xffd21f, 200);
    k.bluescreen(500, ['FATAL ERROR', 'OPPONENT.EXE has stopped', 'Uninstalling...']);
    k.pixelate(1700, [0xffd21f, 0x222222, 0x00e0ff]);
    k.fadeLoser(1900, 600);
    k.winPose(2600);
  },
  heat: (k) => {
    k.banner('OVERHEAT', 0xff4b1f, 200);
    k.rain('flame', 300, 24, 50, 240, 1.2);
    k.flash(1300, 255, 120, 40);
    k.shrink(1500);
    k.winPose(2600);
  },
  dylaneth: (k) => {
    k.banner('GOLD RUSH', 0xff4fc8, 200);
    k.rain('star', 300, 26, 45, 260);
    k.confetti(1300);
    k.shrink(1500);
    k.winPose(2600);
  },
  midtermdev: (k) => {
    k.banner('MIDTERM EXAM', 0x23d5ff, 200);
    k.scroll(['Q1: what is a blockchain?', 'Q2: why did you buy the top?', 'Q3: explain yourself', 'GRADE: F'], '#23d5ff', 400);
    k.stamp('F', 0xff2d3a, 2400, 160);
    k.winPose(2800);
  },
  alon: (k) => {
    k.banner('CASHED OUT', 0xffd21f, 200);
    k.rain('cash', 300, 30, 40, 260);
    k.popups(['JACKPOT', '777', 'all in', 'paid'], 0xffd21f, 600, 10, 110);
    k.fadeLoser(1800, 700);
    k.winPose(2600);
  },
  ansem: (k) => {
    k.banner('MARKET MAKER', 0xffc22e, 200);
    k.chart(400, false);
    k.rain('candleR', 900, 14, 70, 240);
    k.stamp('REKT', 0xff2d3a, 2100);
    k.winPose(2700);
  },
  seyong: (k) => {
    k.banner('LOW TIDE', 0xff9a3a, 200);
    k.rain('soapbubble', 300, 30, 40, 280, 1.3);
    k.shake(1200, 600, 0.02);
    k.fadeLoser(1500, 900);
    k.winPose(2600);
  },
  'ethan-prosper': (k) => {
    k.banner('STORM FRONT', 0xffe14d, 200);
    k.rain('lightning', 300, 18, 60, 220, 1.3);
    k.flash(600); k.flash(1100); k.flash(1600);
    k.fadeLoser(1800, 600);
    k.winPose(2600);
  },
  orangie: (k) => {
    k.banner('STREAM ENDED', 0xff8a1f, 200);
    k.popups(['GG', 'W', 'L', 'clip it', 'RIP'], 0xff8a1f, 400, 14, 80);
    k.fadeLoser(1600, 900);
    k.stamp('OFFLINE', 0xff2d3a, 2200);
    k.winPose(2700);
  },
  kimchi: (k) => {
    k.banner('EXTRA SPICY', 0xff3b30, 200);
    k.rain('flame', 300, 22, 50, 220);
    k.popups(['HOT', 'SPICY', 'WATER!!', 'too hot'], 0xff3b30, 500, 10, 100);
    k.fadeLoser(1800, 700);
    k.winPose(2600);
  },
  lynk: (k) => {
    k.banner('BROKEN LINK', 0x4fb8ff, 200);
    k.popups(['buffering...', 'lag', '404', 'reconnecting'], 0x4fb8ff, 400, 10, 110);
    k.pixelate(1500, [0x4fb8ff, 0xffffff, 0x000000]);
    k.fadeLoser(1800, 600);
    k.winPose(2600);
  },
  sling: (k) => {
    k.banner('HURRICANE', 0x23e0d0, 200);
    k.spin('smoke', 300, 1600, 3);
    k.shake(900, 800, 0.02);
    k.fadeLoser(1500, 600);
    k.winPose(2600);
  },
  daumen: (k) => {
    k.banner('BIG SMILE', 0xffd21f, 200);
    k.popups(['why is it smiling', 'help', ':)', ':))))'], 0xffd21f, 400, 12, 90);
    k.shake(1500, 600, 0.02);
    k.fadeLoser(1800, 700);
    k.winPose(2600);
  },
  yenni: (k) => {
    k.banner('CAT NAP', 0xff6fc8, 200);
    k.rain('heart', 300, 24, 50, 240);
    k.popups(['zzz', 'purr', 'mrrp'], 0xff6fc8, 900, 8, 140);
    k.shrink(1600);
    k.winPose(2600);
  },
  'jack-duval': (k) => {
    k.banner('AVALANCHE', 0x5f8aff, 200);
    k.rain('ice', 300, 30, 40, 280, 1.3);
    k.shake(800, 1200, 0.025);
    k.fadeLoser(1600, 800);
    k.winPose(2600);
  },
  smokez: (k) => {
    k.banner('UP IN SMOKE', 0x2bd46b, 200);
    k.rain('smoke', 300, 22, 50, 240, 1.4);
    k.fadeLoser(1200, 1000);
    k.winPose(2600);
  },
  rektober: (k) => {
    k.banner('RED OCTOBER', 0xff2d3a, 200);
    k.chart(400, false);
    k.rain('leaf', 800, 24, 50, 260);
    k.stamp('REKT', 0xff2d3a, 2100);
    k.winPose(2700);
  },
  marcell: (k) => {
    k.banner('CORRUPTED', 0xff4fe0, 200);
    k.pixelate(400, [0xff4fe0, 0x23e0d0, 0xffe14d, 0x000000]);
    k.bluescreen(1300, ['DATA CORRUPTED', 'opponent.png not found']);
    k.fadeLoser(1800, 600);
    k.winPose(2600);
  },
  imsheepsol: (k) => {
    k.banner('COUNTING SHEEP', 0xffd27a, 200);
    k.popups(['1', '2', '3', 'zzz', 'baa'], 0xffd27a, 400, 12, 100);
    k.fadeLoser(1600, 900);
    k.winPose(2600);
  },
  chairman: (k) => {
    k.banner('MOTION DENIED', 0x4fb8ff, 200);
    k.stamp('DENIED', 0xff2d3a, 600);
    k.pixelate(1200, [0x4fb8ff, 0xffffff, 0x0a1a3a]);
    k.fadeLoser(1600, 700);
    k.winPose(2600);
  },
  'the-detective': (k) => {
    k.banner('CASE CLOSED', 0xffd21f, 200);
    k.scroll(['EVIDENCE #1: bought the top', 'EVIDENCE #2: sold the bottom', 'VERDICT: retired'], '#ffd21f', 400);
    k.stamp('RETIRED', 0xff2d3a, 2400);
    k.winPose(2900);
  },
  'the-solstice': (k) => {
    k.banner('TOTAL ECLIPSE', 0xe0263a, 200);
    k.flash(400, 0, 0, 0);
    k.rain('slash', 600, 18, 60, 240);
    k.fadeLoser(1400, 800);
    k.flash(2200, 255, 80, 80);
    k.winPose(2600);
  },
  appie: (k) => {
    k.banner('BUBBLE TROUBLE', 0xa24bff, 200);
    k.rain('soapbubble', 300, 30, 40, 260, 1.5);
    k.shrink(1300);
    k.popups(['POP'], 0xff7ad5, 1900, 1, 100);
    k.winPose(2600);
  },
  scharo: (k) => {
    k.banner('SOLD OUT', 0xd8d8d8, 200);
    k.popups(['0 bids', 'floor: 0', 'delisted', 'no offers'], 0xd8d8d8, 400, 10, 110);
    k.stamp('DELISTED', 0xff2d3a, 1900);
    k.fadeLoser(2100, 600);
    k.winPose(2700);
  },
  pattyice: (k) => {
    k.freeze(200);
    k.banner('DEEP FREEZE', 0x4fd8ff, 300);
    k.rain('ice', 500, 24, 50, 220);
    k.shake(1500, 400, 0.02);
    k.fadeLoser(1700, 500);
    k.winPose(2600);
  },
  bancrypto: (k) => {
    k.banner('BANNED', 0xe0263a, 200);
    k.popups(['account suspended', 'violated ToS', 'appeal denied'], 0xe0263a, 400, 8, 140);
    k.stamp('BANNED', 0xff2d3a, 1600);
    k.fadeLoser(1900, 600);
    k.winPose(2600);
  },
  latuche: (k) => {
    k.banner('LEAP OF FAITH', 0xff9a3a, 200);
    k.shrink(400, 1200);
    k.shake(1700, 500, 0.03);
    k.winPose(2600);
  },
  'dani-worldwide': (k) => {
    k.banner('SET IN STONE', 0xffc22e, 200);
    k.freeze(400);
    k.pixelate(1000, [0xe8e2d0, 0xbab3a0, 0x8a8378]);
    k.stamp('EXHIBIT', 0xffc22e, 2000);
    k.winPose(2700);
  },
  realist: (k) => {
    k.banner('COLD TRUTH', 0xb0b0b0, 200);
    k.scroll(['your bags are down 94%', 'the team left', 'it is not coming back'], '#e8e8e8', 400);
    k.fadeLoser(2100, 600);
    k.winPose(2700);
  },
  cap100x: (k) => {
    k.banner('100X', 0x2f6bff, 200);
    k.popups(['x10', 'x25', 'x50', 'x75', 'x100'], 0x2f6bff, 300, 15, 70);
    k.pixelate(1500, [0x2f6bff, 0x0a1a3a, 0xffffff]);
    k.fadeLoser(1800, 600);
    k.winPose(2600);
  },
  sanity100x: (k) => {
    k.banner('DOWN THE RABBIT HOLE', 0xff6fa8, 200);
    k.spin('ring', 300, 1500, 2.5);
    k.shrink(1100, 900);
    k.winPose(2600);
  },
  deecayz: (k) => {
    k.banner('THUNDERSTORM', 0xffd21f, 200);
    k.rain('lightning', 300, 22, 50, 220, 1.3);
    k.flash(700); k.flash(1300); k.flash(1900);
    k.fadeLoser(2000, 500);
    k.winPose(2600);
  },
  'solana-dave': (k) => {
    k.banner('NETWORK CONGESTION', 0x14f195, 200);
    k.rain('solcoin', 300, 30, 40, 260);
    k.popups(['tx failed', 'retrying', 'dropped', 'slot skipped'], 0x9945ff, 600, 10, 110);
    k.fadeLoser(1900, 600);
    k.winPose(2600);
  },
  eezzy: (k) => {
    k.freeze(200);
    k.banner('DIRECTORS CUT', 0x4fb8ff, 300);
    k.rain('ice', 500, 18, 60, 220);
    k.scroll(['THE END', 'starring: Eezzy', 'special thanks: you, for losing'], '#4fb8ff', 1100, 1800);
    k.winPose(3000);
  },
  tjr: (k) => {
    k.banner('MARGIN CALL', 0x2bff88, 200);
    k.chart(500, false);
    k.popups(['margin call', '-100%', 'liquidated', 'stop loss hit', 'rekt'], 0xea3943, 700, 12, 100);
    k.stamp('LIQUIDATED', 0xea3943, 1900);
    k.fadeLoser(2100, 600);
    k.winPose(2700);
  },
};

/** finishers a player can give the fighter they made (see custom/customFighters.ts) */
export const FINISHERS: { name: string; description: string; script: Script }[] = [
  {
    name: 'Rugged',
    description: 'Draws the opponent’s chart. It only goes down.',
    script: (k) => {
      k.banner('RUGGED', 0xff2d3a, 200);
      k.chart(400, false);
      k.rain('candleR', 900, 14, 70, 240);
      k.stamp('REKT', 0xff2d3a, 2100);
      k.winPose(2700);
    },
  },
  {
    name: 'To the Moon',
    description: 'Green candles carry the winner up while the opponent watches from the floor.',
    script: (k) => {
      k.banner('TO THE MOON', 0x16c784, 200);
      k.chart(400, true);
      k.rain('candleG', 800, 18, 60, 260);
      k.confetti(1800);
      k.fadeLoser(1900, 600);
      k.winPose(2500);
    },
  },
  {
    name: 'Deep Freeze',
    description: 'Freezes the opponent solid, then shatters the ice.',
    script: (k) => {
      k.freeze(200);
      k.banner('DEEP FREEZE', 0x4fd8ff, 300);
      k.rain('ice', 500, 24, 50, 220);
      k.shake(1500, 400, 0.02);
      k.fadeLoser(1700, 500);
      k.winPose(2600);
    },
  },
  {
    name: 'Blue Screen',
    description: 'Crashes the opponent like an old computer.',
    script: (k) => {
      k.banner('BLUE SCREEN', 0x2f6bff, 200);
      k.bluescreen(500, ['FATAL ERROR', 'OPPONENT.EXE has stopped', 'Uninstalling...']);
      k.pixelate(1700, [0x2f6bff, 0xffffff, 0x000000]);
      k.fadeLoser(1900, 600);
      k.winPose(2600);
    },
  },
  {
    name: 'Ratioed',
    description: 'Buries the opponent in a comment section until they log off.',
    script: (k) => {
      k.banner('RATIOED', 0xe0245e, 200);
      k.popups(['L', 'ratio', 'cope', 'skill issue', 'who asked', 'GG'], 0xe0245e, 300, 18, 70);
      k.rain('ratio', 900, 12, 80, 240);
      k.fadeLoser(2000, 600);
      k.winPose(2600);
    },
  },
  {
    name: 'Thunderstruck',
    description: 'Lightning strikes over and over until nothing is left standing.',
    script: (k) => {
      k.banner('THUNDERSTRUCK', 0xffe14d, 200);
      k.rain('lightning', 300, 18, 60, 220, 1.3);
      k.flash(600);
      k.flash(1200);
      k.flash(1800);
      k.fadeLoser(2000, 500);
      k.winPose(2600);
    },
  },
];

/** give a fighter one of the FINISHERS (fighters made by players) */
export function setFinisher(id: string, finisher: number) {
  SCRIPTS[id] = (FINISHERS[finisher] ?? FINISHERS[0]).script;
}

const DEFAULT: Script = (k) => {
  k.popups(['GG', 'EZ', 'L'], 0xf5c542, 0, 10, 100);
  k.confetti(1500);
  k.winPose(1600);
};

/**
 * The serious part of every finisher: the winner closes the distance and beats the loser down
 * with a real combo (jab, power punch, kick, uppercut that launches them, a slam on the way down)
 * before the fighter's own finisher plays. Drawn only: the fight's simulation is already over.
 * Returns how long it takes (ms).
 */
/** how long the beatdown takes (ms); the fight keeps drawing the fighters' movement until then */
export const BEATDOWN_MS = 1750;

function beatdown(c: FatalityCtx): number {
  const { scene: s, fx, sfx, winner: W, loser: L } = c;
  const dir = Math.sign(L.x - W.x) || 1;
  const close = (Math.abs(L.x - W.x) - 160) * dir;
  const cam = s.cameras.main;
  const at = (ms: number, fn: () => void) => s.time.delayedCall(ms, fn);
  const move = (f: typeof W, dx: number, dy: number, ms: number, ease = 'Cubic.easeOut') =>
    // only the axes that move, so a sideways drift doesn't pin a launch or a leap to the ground
    s.tweens.add({ targets: f.show, ...(dx ? { dx: f.show.dx + dx } : {}), ...(dy ? { dy: f.show.dy + dy } : {}), duration: ms, ease });
  /** a hit landing on the loser: sparks at the impact, the loser recoils */
  const impact = (pose: Parameters<typeof W.view.play>[0], height: number, push: number, big: boolean, color = 0xffffff) => {
    W.view.play(pose, { restart: true });
    at(70, () => {
      fx.spark(L.x + L.show.dx - dir * 30, L.y + L.show.dy - height, big ? 0xffd23f : color, big);
      L.view.play('hit', { restart: true });
      L.view.flash(0xffffff, 3);
      move(L, push * dir, 0, 160);
      sfx.play(big ? 'hitHeavy' : 'hit');
      cam.shake(big ? 160 : 90, big ? 0.012 : 0.006);
    });
  };
  // 1. close in
  W.view.play('dash', { restart: true });
  fx.speedLines(W.x, W.y - 150, dir, W.accent);
  sfx.play('dash');
  move(W, close, 0, 220, 'Quad.easeOut');
  // 2. the combo, getting heavier
  at(240, () => impact('light', 230, 14, false));
  at(400, () => impact('heavy', 210, 22, false));
  at(580, () => impact('kick', 170, 30, true));
  at(780, () => {
    // 3. uppercut: the loser is launched into the air
    W.view.play('uppercut', { restart: true });
    at(70, () => {
      fx.spark(L.x + L.show.dx - dir * 20, L.y - 260, 0xffd23f, true);
      fx.shockwave(L.x + L.show.dx, L.y - 220, W.accent, 1.2);
      L.view.play('knockdown', { restart: true });
      sfx.play('hitHeavy');
      sfx.play('whoosh');
      cam.shake(200, 0.016);
      cam.flash(90, 255, 255, 255);
      s.tweens.add({ targets: L.show, dy: -250, duration: 280, ease: 'Quad.easeOut' });
      move(L, 70 * dir, 0, 700, 'Sine.easeOut');
    });
  });
  // 4. the winner leaps after them and slams them back down
  at(1000, () => {
    W.view.play('jump', { restart: true });
    s.tweens.add({ targets: W.show, dy: -200, duration: 180, ease: 'Quad.easeOut' });
    move(W, 60 * dir, 0, 400);
    sfx.play('jump');
  });
  at(1180, () => {
    // both come crashing down together
    W.view.play('overhead', { restart: true });
    s.tweens.add({ targets: [L.show, W.show], dy: 0, duration: 160, ease: 'Quad.easeIn' });
  });
  at(1340, () => {
    // impact with the floor
    fx.shockwave(L.x + L.show.dx, L.y - 10, W.accent, 1.8);
    fx.dust(L.x + L.show.dx, L.y);
    fx.spark(L.x + L.show.dx, L.y - 60, 0xff3b30, true);
    L.view.play('knockdown', { restart: true });
    sfx.play('thud');
    sfx.play('hitHeavy');
    cam.shake(320, 0.025);
    cam.flash(160, 200, 20, 20);
    fx.popup(L.x + L.show.dx, L.y - 330, '5 HIT  BRUTAL', 0xff3b30, 40, 70, 1100);
  });
  // 5. the winner stands over them
  at(1560, () => W.view.play('win', { restart: true }));
  return BEATDOWN_MS;
}

/** Runs a fatality: the beatdown, then the fighter's finisher. Returns how long it all takes (ms). */
export function runFatality(ctx: FatalityCtx): number {
  // the winner's own state stops replaying their idle pose, so the beatdown's poses hold
  ctx.winner.setState('win');
  const lead = beatdown(ctx);
  const k = new Kit(ctx);
  k.offset = lead;
  ctx.scene.time.delayedCall(lead, () => ctx.sfx.play('fatality'));
  (SCRIPTS[ctx.winner.id] ?? DEFAULT)(k);
  return lead + 3600;
}
