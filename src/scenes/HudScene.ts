import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, GAME_H, GAME_W, GOLD_HEX, ROUNDS_TO_WIN } from '../config';
import { sfx } from '../audio/Sfx';
import type { Fighter } from '../fight/Fighter';
import { METER_BAR, METER_MAX } from '../fight/Fighter';
import { game } from '../state';
import { emptyRaw, type Button } from '../systems/input';
import { bodyText, goldText } from '../ui/ui';
import type { FightScene } from './FightScene';

const BAR_W = 480;
const BAR_H = 26;
const BAR_Y = 42;
const MOTIONS = ['↓↘→ + P', '→↓↘ + P', '↓↙← + K'];
const SHORTCUTS = [['O', 'L', ';'], ['Num 6', 'Num 3', 'Num .']];

interface SideHud {
  hp: Phaser.GameObjects.Rectangle;
  trail: Phaser.GameObjects.Rectangle;
  trailV: number;
  meter: Phaser.GameObjects.Rectangle[];
  meterText: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Arc[];
  combo: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

export class HudScene extends Phaser.Scene {
  private fight!: FightScene;
  private sides: SideHud[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private announceText!: Phaser.GameObjects.Text;
  private pauseLayer: Phaser.GameObjects.Container | null = null;
  private moveList: Phaser.GameObjects.Container | null = null;
  private trainingText: Phaser.GameObjects.Text | null = null;
  private fatalityBtn: Phaser.GameObjects.Container | null = null;
  private finishCountdown: Phaser.GameObjects.Text | null = null;
  private pauseKeys: Phaser.Input.Keyboard.Key[] = [];
  private touchHeld: Partial<Record<Button, boolean>> = {};
  private stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  private stickBase: Phaser.GameObjects.Arc | null = null;
  private stickKnob: Phaser.GameObjects.Arc | null = null;
  private padPrevStart = false;

  constructor() {
    super('Hud');
  }

  init(data: { fight: FightScene }) {
    this.fight = data.fight;
    this.sides = [];
    this.pauseLayer = null;
    this.moveList = null;
    this.trainingText = null;
    this.fatalityBtn = null;
    this.touchHeld = {};
    this.stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  }

  create() {
    const f = this.fight;

    // top frame
    const top = this.add.graphics();
    top.fillStyle(0x000000, 0.55);
    top.fillRect(0, 0, GAME_W, 96);

    for (const side of [0, 1] as const) this.sides.push(this.buildSide(side, f.fighters[side]));

    // timer
    this.add.rectangle(GAME_W / 2, BAR_Y + 4, 92, 70, 0x0a0705).setStrokeStyle(3, GOLD_HEX);
    this.timerText = goldText(this, GAME_W / 2, BAR_Y + 6, '99', 50);
    if (f.training) this.timerText.setText('∞');

    this.announceText = this.add
      .text(GAME_W / 2, GAME_H / 2 - 60, '', { fontFamily: FONT_DISPLAY, fontSize: '110px', color: '#f5c542', stroke: '#2a0a00', strokeThickness: 14 })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
    this.announceText.setShadow(0, 0, '#ff4500', 30, true, true);

    f.events.on('announce', this.announce, this);
    // fade the HUD out during fatalities so the show takes the whole screen
    f.events.on('darken', (on: boolean) => this.tweens.add({ targets: this.cameras.main, alpha: on ? 0.12 : 1, duration: 300 }));
    f.events.on('finish', this.showFinish, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      f.events.off('announce', this.announce, this);
      f.events.off('finish', this.showFinish, this);
      f.events.off('darken');
    });

    // pause
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.pauseKeys = [this.input.keyboard!.addKey(KC.ESC), this.input.keyboard!.addKey(KC.BACKSPACE)];
    const pauseBtn = bodyText(this, GAME_W - 16, 110, game.isTouch ? 'II' : 'II  ESC', 26, '#d8cdb0').setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    pauseBtn.on('pointerdown', () => this.togglePause());

    if (f.training) this.buildTraining();
    if (game.isTouch) this.buildTouch();
    else this.input.on('pointerdown', () => {
      // a touch on a "desktop" (e.g. touchscreen laptop) enables touch controls
      if (!game.isTouch && this.input.activePointer.wasTouch) {
        game.isTouch = true;
        this.buildTouch();
      }
    });
  }

  // ---------------------------------------------------------------- build
  private buildSide(side: 0 | 1, ft: Fighter): SideHud {
    const left = side === 0;
    const x0 = left ? 100 : GAME_W - 100 - BAR_W;
    const accent = ft.accent;
    // portrait
    const px = left ? 46 : GAME_W - 46;
    this.add.rectangle(px, BAR_Y + 10, 76, 76, 0x000000).setStrokeStyle(3, accent);
    this.add.image(px, BAR_Y + 10, `thumb-${ft.id}`).setDisplaySize(72, 72).setFlipX(!left);
    // health bar
    this.add.rectangle(x0 + BAR_W / 2, BAR_Y, BAR_W + 8, BAR_H + 8, 0x000000).setStrokeStyle(2, GOLD_HEX);
    this.add.rectangle(x0 + BAR_W / 2, BAR_Y, BAR_W, BAR_H, 0x3a0b0b);
    const trail = this.add.rectangle(left ? x0 + BAR_W : x0, BAR_Y, BAR_W, BAR_H, 0xff3030).setOrigin(left ? 1 : 0, 0.5);
    const hp = this.add.rectangle(left ? x0 + BAR_W : x0, BAR_Y, BAR_W, BAR_H, 0xf5c542).setOrigin(left ? 1 : 0, 0.5);
    this.add.rectangle(x0 + BAR_W / 2, BAR_Y - BAR_H / 2 + 3, BAR_W, 4, 0xffffff, 0.25);
    // accent trim
    this.add.rectangle(x0 + BAR_W / 2, BAR_Y + BAR_H / 2 + 6, BAR_W, 3, accent);
    // name + handle
    const nx = left ? x0 : x0 + BAR_W;
    goldText(this, 0, 0, ft.data.name.toUpperCase(), 28).setOrigin(left ? 0 : 1, 0.5).setPosition(nx, BAR_Y + 34);
    const nameW = this.children.list[this.children.list.length - 1] as Phaser.GameObjects.Text;
    if (ft.data.handle) bodyText(this, nx + (left ? nameW.width + 12 : -nameW.width - 12), BAR_Y + 34, ft.data.handle, 18, '#bfb59a').setOrigin(left ? 0 : 1, 0.5);
    // round pips near the timer
    const pips: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
      const cx = left ? GAME_W / 2 - 64 - i * 22 : GAME_W / 2 + 64 + i * 22;
      pips.push(this.add.circle(cx, BAR_Y + 34, 7, 0x222222).setStrokeStyle(2, GOLD_HEX));
    }
    // super meter (3 segments) at the bottom
    const meter: Phaser.GameObjects.Rectangle[] = [];
    const mw = 92;
    const my = GAME_H - 26;
    const mx0 = left ? 60 : GAME_W - 60 - mw * 3 - 8;
    for (let i = 0; i < 3; i++) {
      const x = mx0 + i * (mw + 4);
      this.add.rectangle(x + mw / 2, my, mw, 14, 0x111111).setStrokeStyle(2, 0x6b4d16);
      meter.push(this.add.rectangle(x, my, 0, 10, accent).setOrigin(0, 0.5));
    }
    const meterText = goldText(this, left ? mx0 - 24 : mx0 + mw * 3 + 8 + 24, my, '0', 26);
    const combo = this.add
      .text(left ? 30 : GAME_W - 30, 230, '', { fontFamily: FONT_DISPLAY, fontSize: '52px', color: '#ffffff', stroke: '#000', strokeThickness: 8, align: left ? 'left' : 'right' })
      .setOrigin(left ? 0 : 1, 0.5)
      .setAlpha(0);
    const status = bodyText(this, left ? 100 : GAME_W - 100, BAR_Y + 58, '', 18, '#ff9a9a').setOrigin(left ? 0 : 1, 0.5);
    return { hp, trail, trailV: 1, meter, meterText, pips, combo, status };
  }

  private buildTraining() {
    const f = this.fight;
    this.trainingText = bodyText(this, GAME_W / 2, 112, '', 20, '#9cff9c').setOrigin(0.5);
    const label = () => this.trainingText!.setText(`TRAINING  ·  DUMMY: ${f.cpu?.dummy ? f.cpu.dummy.toUpperCase() : 'CPU'}  ·  [T] change dummy  ·  [M] move list`);
    label();
    this.input.keyboard?.on('keydown-T', () => {
      f.cycleDummy();
      label();
      sfx.play('select');
    });
    this.input.keyboard?.on('keydown-M', () => this.toggleMoveList());
    this.trainingText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      f.cycleDummy();
      label();
    });
    this.toggleMoveList();
  }

  // ---------------------------------------------------------------- touch controls
  private buildTouch() {
    if (this.stickBase) return;
    this.input.addPointer(4);
    this.stickBase = this.add.circle(170, GAME_H - 170, 80, 0xffffff, 0.08).setStrokeStyle(3, 0xffffff, 0.35).setDepth(40);
    this.stickKnob = this.add.circle(170, GAME_H - 170, 38, GOLD_HEX, 0.45).setDepth(41);

    const btn = (x: number, y: number, r: number, label: string, b: Button, color: number) => {
      const c = this.add.container(x, y).setDepth(40);
      const circle = this.add.circle(0, 0, r, color, 0.28).setStrokeStyle(3, color, 0.8);
      const t = this.add.text(0, 0, label, { fontFamily: FONT_BODY, fontSize: `${Math.round(r * 0.55)}px`, color: '#ffffff' }).setOrigin(0.5);
      c.add([circle, t]);
      circle.setInteractive();
      const down = () => {
        this.touchHeld[b] = true;
        circle.setFillStyle(color, 0.7);
      };
      const up = () => {
        this.touchHeld[b] = false;
        circle.setFillStyle(color, 0.28);
      };
      circle.on('pointerdown', down);
      circle.on('pointerup', up);
      circle.on('pointerout', up);
      return c;
    };
    const bx = GAME_W - 120;
    const by = GAME_H - 120;
    btn(bx - 110, by - 40, 46, 'LP', 'lp', 0xffffff);
    btn(bx, by - 90, 46, 'HP', 'hp', 0xff6b6b);
    btn(bx - 90, by + 60, 46, 'LK', 'lk', 0xffffff);
    btn(bx + 20, by + 20, 46, 'HK', 'hk', 0xff6b6b);
    const ft = this.fight.fighters[0];
    const sp = ft.data.specials;
    btn(bx - 280, by - 190, 40, 'SP1', 's1', ft.accent);
    btn(bx - 180, by - 220, 40, 'SP2', 's2', ft.accent);
    btn(bx - 80, by - 230, 40, 'SP3', 's3', ft.accent);
    btn(bx + 40, by - 210, 34, 'EX', 'ex', 0xffd23f);
    // tiny labels with special names
    bodyText(this, bx - 180, by - 280, sp.map((s, i) => `${i + 1}: ${s.name}`).join('   '), 16, '#d8cdb0').setOrigin(0.5).setDepth(40).setAlpha(0.8);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < GAME_W * 0.45 && p.y > 140 && this.stick.id < 0) {
        this.stick = { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 };
        this.stickBase!.setPosition(p.x, p.y);
        this.stickKnob!.setPosition(p.x, p.y);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stick.id) return;
      const dx = p.x - this.stick.bx;
      const dy = p.y - this.stick.by;
      const len = Math.hypot(dx, dy);
      const max = 70;
      const k = len > max ? max / len : 1;
      this.stick.dx = dx * k;
      this.stick.dy = dy * k;
      this.stickKnob!.setPosition(this.stick.bx + this.stick.dx, this.stick.by + this.stick.dy);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stick.id) return;
      this.stick.id = -1;
      this.stick.dx = this.stick.dy = 0;
      this.stickKnob!.setPosition(this.stickBase!.x, this.stickBase!.y);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  private writeTouch() {
    const r = emptyRaw();
    const t = 26;
    r.left = this.stick.dx < -t;
    r.right = this.stick.dx > t;
    r.up = this.stick.dy < -t * 1.4;
    r.down = this.stick.dy > t;
    for (const [b, v] of Object.entries(this.touchHeld)) r.buttons[b as Button] = !!v;
    this.fight.touch.state = r;
  }

  // ---------------------------------------------------------------- announcer, finish
  private announce(text: string, ms = 1000, big = false) {
    const t = this.announceText;
    this.tweens.killTweensOf(t);
    t.setText(text).setFontSize(big ? 132 : 104).setScale(2.4).setAlpha(0);
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.5, text === 'FATALITY' || text === 'FINISH THEM' ? '#ff3b1a' : '#f5c542');
    grad.addColorStop(1, '#8a2a00');
    t.setFill(grad);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 250 });
  }

  private showFinish(on: boolean) {
    if (on) {
      const winner = this.fight.fighters.find((f) => f.wins >= ROUNDS_TO_WIN);
      const humanWinner = winner && (winner.side === 0 || this.fight.setup.mode === 'versus');
      this.finishCountdown = bodyText(this, GAME_W / 2, GAME_H - 90, '', 30, '#ff9a4a').setOrigin(0.5).setDepth(60);
      if (humanWinner && game.isTouch && winner!.side === 0) {
        const c = this.add.container(GAME_W / 2, GAME_H - 160).setDepth(60);
        const bg = this.add.rectangle(0, 0, 300, 76, 0x8a0000).setStrokeStyle(4, 0xff3b1a).setInteractive({ useHandCursor: true });
        const tx = goldText(this, 0, 0, 'FATALITY', 46);
        c.add([bg, tx]);
        this.tweens.add({ targets: c, scale: 1.08, yoyo: true, repeat: -1, duration: 300 });
        bg.on('pointerdown', () => this.fight.tryFatality(winner!));
        this.fatalityBtn = c;
      }
    } else {
      this.fatalityBtn?.destroy();
      this.fatalityBtn = null;
      this.finishCountdown?.destroy();
      this.finishCountdown = null;
    }
  }

  // ---------------------------------------------------------------- pause + move list
  private togglePause() {
    const f = this.fight;
    if (this.pauseLayer) {
      this.pauseLayer.destroy();
      this.pauseLayer = null;
      f.pause(false);
      return;
    }
    if (f.phase !== 'fight' && f.phase !== 'intro') return;
    f.pause(true);
    sfx.play('select');
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7).setInteractive());
    c.add(goldText(this, GAME_W / 2, 170, 'PAUSED', 80));
    const items: [string, () => void][] = [
      ['RESUME', () => this.togglePause()],
      ['MOVE LIST', () => this.toggleMoveList()],
      [sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', () => {
        sfx.toggleMute();
        this.togglePause();
        this.togglePause();
      }],
      ['CHARACTER SELECT', () => this.leave('Select')],
      ['QUIT TO TITLE', () => this.leave('Title')],
    ];
    items.forEach(([label, fn], i) => {
      const t = goldText(this, GAME_W / 2, 290 + i * 70, label, 44).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        sfx.play('confirm');
        fn();
      });
      t.on('pointerover', () => t.setScale(1.08));
      t.on('pointerout', () => t.setScale(1));
      c.add(t);
    });
    this.pauseLayer = c;
  }

  private leave(key: 'Select' | 'Title') {
    const f = this.fight;
    f.pause(false);
    f.phase = 'over';
    this.scene.stop('Hud');
    f.scene.start(key, key === 'Select' ? { mode: f.setup.mode, difficulty: f.setup.difficulty } : undefined);
  }

  private toggleMoveList() {
    if (this.moveList) {
      this.moveList.destroy();
      this.moveList = null;
      return;
    }
    const ft = this.fight.fighters[0];
    const c = this.add.container(0, 0).setDepth(this.pauseLayer ? 110 : 30);
    const w = 470;
    const x = 20;
    const y = 130;
    const lines: string[] = [];
    ft.data.specials.forEach((s, i) => {
      lines.push(`${s.name.toUpperCase()}`);
      lines.push(`   ${MOTIONS[i]}   or  [${SHORTCUTS[0][i]}]${game.isTouch ? ' / SP' + (i + 1) : ''}`);
      lines.push(`   ${s.description}`);
    });
    lines.push('');
    lines.push('EX: special with a heavy button or [P] (1 bar)');
    lines.push('Chains: light → light → heavy · cancel into specials on hit');
    lines.push('Crouch HP = launcher · crouch HK = sweep · jump heavy = overhead');
    lines.push('Dash: double-tap · Block: hold back (down-back for lows)');
    lines.push(`FATALITY: ↓ ↓ → + HP  —  ${ft.data.fatality}`);
    const text = this.add.text(x + 14, y + 44, lines.join('\n'), { fontFamily: FONT_BODY, fontSize: '17px', color: '#e8e2d0', lineSpacing: 2, wordWrap: { width: w - 28 } });
    const bg = this.add.rectangle(x, y, w, text.height + 60, 0x000000, 0.72).setOrigin(0, 0).setStrokeStyle(2, ft.accent);
    const title = goldText(this, x + 14, y + 22, `${ft.data.name.toUpperCase()} · MOVE LIST`, 26).setOrigin(0, 0.5);
    c.add([bg, title, text]);
    if (game.isTouch) {
      bg.setInteractive().on('pointerdown', () => this.toggleMoveList());
    }
    this.moveList = c;
  }

  // ---------------------------------------------------------------- per frame
  update() {
    const f = this.fight;
    if (!f.fighters) return;
    // pause keys / gamepad start
    if (this.pauseKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) this.togglePause();
    const pad = this.input.gamepad?.getPad(0);
    const start = !!pad?.buttons[9]?.pressed;
    if (start && !this.padPrevStart) this.togglePause();
    this.padPrevStart = start;

    if (game.isTouch) this.writeTouch();

    f.fighters.forEach((ft, i) => {
      const s = this.sides[i];
      const v = Phaser.Math.Clamp(ft.health / ft.maxHealth, 0, 1);
      s.hp.width = BAR_W * v;
      s.hp.fillColor = v < 0.25 ? 0xff5a2a : 0xf5c542;
      if (s.trailV > v) s.trailV = Math.max(v, s.trailV - 0.006);
      else s.trailV = v;
      s.trail.width = BAR_W * s.trailV;
      // meter
      const bars = Math.floor(ft.meter / METER_BAR);
      s.meter.forEach((m, k) => {
        const fill = Phaser.Math.Clamp((ft.meter - k * METER_BAR) / METER_BAR, 0, 1);
        m.width = 92 * fill;
        m.setAlpha(fill >= 1 ? 0.75 + 0.25 * Math.sin(f.frame / 6) : 0.6);
      });
      s.meterText.setText(ft.meter >= METER_MAX ? 'MAX' : String(bars));
      s.pips.forEach((p, k) => p.setFillStyle(k < ft.wins ? 0xf5c542 : 0x222222));
      // statuses
      const st: string[] = [];
      if (ft.status.reverse) st.push('REVERSED');
      if (ft.status.lag) st.push('LAG');
      if (ft.status.nospecials) st.push('NO SPECIALS');
      if (ft.status.mark) st.push('MARKED');
      for (const b of ft.buffs) st.push(b.kind === 'projinvuln' ? 'PROJ-IMMUNE' : b.kind === 'readinput' ? 'DEBUG MODE' : b.kind.toUpperCase());
      s.status.setText(st.join(' · '));
      s.status.setColor(ft.buffs.length && !ft.status.reverse && !ft.status.nospecials ? '#9cff9c' : '#ff9a9a');
    });

    // combo counter
    const cb = f.combo;
    for (const i of [0, 1]) {
      const s = this.sides[i];
      const show = cb.side === i && cb.hits >= 2 && f.frame < cb.shownUntil;
      if (show) {
        const pct = Math.round((cb.damage / f.fighters[1 - i].maxHealth) * 100);
        s.combo.setText(`${cb.hits} HITS\n${pct}%`);
        s.combo.setAlpha(1);
      } else if (s.combo.alpha > 0) s.combo.setAlpha(Math.max(0, s.combo.alpha - 0.05));
    }

    if (!f.training) this.timerText.setText(String(f.timer).padStart(2, '0'));
    if (this.finishCountdown && f.phase === 'finish') {
      const winner = f.fighters.find((x) => x.wins >= ROUNDS_TO_WIN);
      const human = winner && (winner.side === 0 || f.setup.mode === 'versus');
      this.finishCountdown.setText(human ? (game.isTouch && winner!.side === 0 ? 'Tap FATALITY!' : '↓ ↓ → + HEAVY PUNCH') : '');
    }

    // Debug Mode buff: show the opponent's next input above their head
    const reader = f.fighters.find((ft) => ft.hasBuff('readinput'));
    if (!reader && this.dbg) this.dbg.setVisible(false);
    for (const ft of reader ? [reader] : []) {
      {
        const o = ft.opp.ctrl.last;
        if (o) {
          const btns = (Object.keys(o.held) as Button[]).filter((k) => o.held[k] && k !== 'start').map((k) => k.toUpperCase());
          const dir = ['', '↙', '↓', '↘', '←', '·', '→', '↖', '↑', '↗'][o.dir];
          const cam = f.cameras.main;
          const sx = (ft.opp.x - cam.worldView.x) * cam.zoom;
          const sy = (ft.opp.y - 400 - cam.worldView.y) * cam.zoom;
          this.debugLabel().setPosition(sx, sy).setText(`${dir} ${btns.join('+')}`).setVisible(true);
        }
      }
    }
  }

  private dbg: Phaser.GameObjects.Text | null = null;
  private debugLabel() {
    if (!this.dbg) this.dbg = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '22px', color: '#2bff88', backgroundColor: '#000a' }).setOrigin(0.5).setDepth(45);
    return this.dbg;
  }
}
