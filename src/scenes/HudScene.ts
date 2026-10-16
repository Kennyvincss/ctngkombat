import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, GAME_H, GAME_W, GOLD_HEX, ROUNDS_TO_WIN } from '../config';
import { sfx } from '../audio/Sfx';
import type { Fighter } from '../fight/Fighter';
import { METER_BAR, METER_MAX, SPECIAL_COOLDOWN } from '../fight/Fighter';
import { game, stickDeadzone } from '../state';
import { emptyRaw, type Button } from '../systems/input';
import { bodyText, fitCamera, goFullscreen, goldText, screenEdges, stickSensitivityControl } from '../ui/ui';
import type { FightScene } from './FightScene';

const BAR_W = 480;
const BAR_H = 26;
const BAR_Y = 42;
const MOTIONS = ['↓↘→ + P', '→↓↘ + P', '↓↙← + K'];
const SHORTCUTS = [['O', 'L', ';'], ['Num 6', 'Num 3', 'Num .']];

type TouchKey = 'punch' | 'kick' | 'block' | 'special' | 'combo' | 'finisher';
interface TouchButton {
  c: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
  sub: Phaser.GameObjects.Text;
  color: number;
}

interface SideHud {
  hp: Phaser.GameObjects.Rectangle;
  trail: Phaser.GameObjects.Rectangle;
  trailV: number;
  meter: Phaser.GameObjects.Rectangle[];
  meterText: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Arc[];
  combo: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  special: Phaser.GameObjects.Text;
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
  private touchHeld: Partial<Record<TouchKey, boolean>> = {};
  private touchTapped: Partial<Record<TouchKey, boolean>> = {};
  private stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  private touchLayer: Phaser.GameObjects.Container | null = null;
  private stickBase: Phaser.GameObjects.Arc | null = null;
  private stickKnob: Phaser.GameObjects.Arc | null = null;
  private touchBtns: Partial<Record<TouchKey, TouchButton>> = {};
  private specialHint: Phaser.GameObjects.Text | null = null;
  /** scripted presses: fight frame they start on, button */
  private queue: { at: number; b: Button }[] = [];
  /** a press made by a touch button this frame, held for a few fight frames so it's seen */
  private taps: { until: number; b: Button }[] = [];
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
    this.touchTapped = {};
    this.touchLayer = null;
    this.stickBase = this.stickKnob = null;
    this.touchBtns = {};
    this.specialHint = null;
    this.queue = [];
    this.taps = [];
    this.stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  }

  create() {
    fitCamera(this);
    const f = this.fight;

    // top frame
    const top = this.add.graphics();
    top.fillStyle(0x000000, 0.55);
    top.fillRect(-800, -400, GAME_W + 1600, 496);

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
    if (game.isTouch) {
      // under the timer, away from the controls
      const pb = this.add.rectangle(GAME_W / 2, BAR_Y + 82, 92, 38, 0x000000, 0.55).setStrokeStyle(2, GOLD_HEX, 0.8).setInteractive();
      bodyText(this, GAME_W / 2, BAR_Y + 82, 'II PAUSE', 20, '#e8e2d0').setOrigin(0.5);
      pb.on('pointerdown', () => this.togglePause());
    } else {
      const pauseBtn = bodyText(this, GAME_W - 16, 110, 'II  ESC', 26, '#d8cdb0').setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      pauseBtn.on('pointerdown', () => this.togglePause());
    }

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
    // touch screens: the bottom corners belong to the joystick and buttons, so the meter goes up top
    const my = game.isTouch ? BAR_Y + 92 : GAME_H - 26;
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
    const special = game.isTouch
      ? bodyText(this, left ? mx0 + mw * 3 + 20 : mx0 - 12, my, '', 17, '#9cff9c').setOrigin(left ? 0 : 1, 0.5)
      : bodyText(this, left ? mx0 : mx0 + mw * 3 + 8, my - 22, '', 17, '#9cff9c').setOrigin(left ? 0 : 1, 0.5);
    return { hp, trail, trailV: 1, meter, meterText, pips, combo, status, special };
  }

  private buildTraining() {
    const f = this.fight;
    this.trainingText = bodyText(this, GAME_W / 2, game.isTouch ? 170 : 112, '', 20, '#9cff9c').setOrigin(0.5);
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
  //
  // Joystick on the left (move, jump, crouch) and six labelled buttons on the right:
  //   PUNCH / KICK      forward or down + button = the heavy version (power punch, uppercut, high kick, sweep)
  //   BLOCK             hold to guard (with down: low guard)
  //   SPECIAL           the fighter's special: neutral = 1st, forward = 2nd, down = 3rd (7 s cooldown)
  //   COMBO             punch, kick, power punch, then the special if it's ready
  //   FINISHER          EX special (1 bar of meter); after the last round, the fatality
  private buildTouch() {
    if (this.touchLayer) return;
    this.input.addPointer(4);
    this.layoutTouch();
    this.scale.on('resize', this.layoutTouch, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layoutTouch, this));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const e = screenEdges(this);
      if (p.worldX < e.left + (e.right - e.left) * 0.42 && p.worldY > 140 && this.stick.id < 0) {
        this.stick = { id: p.id, bx: p.worldX, by: p.worldY, dx: 0, dy: 0 };
        this.stickBase!.setPosition(p.worldX, p.worldY);
        this.stickKnob!.setPosition(p.worldX, p.worldY);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stick.id) return;
      const dx = p.worldX - this.stick.bx;
      const dy = p.worldY - this.stick.by;
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

  /** (re)place the touch controls against the real screen edges */
  private layoutTouch() {
    this.touchLayer?.destroy();
    this.touchHeld = {};
    this.touchBtns = {};
    this.stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
    const e = screenEdges(this);
    const layer = this.add.container(0, 0).setDepth(40);
    this.touchLayer = layer;

    const sx = e.left + 180;
    const sy = e.bottom - 170;
    this.stickBase = this.add.circle(sx, sy, 80, 0xffffff, 0.08).setStrokeStyle(3, 0xffffff, 0.35);
    this.stickKnob = this.add.circle(sx, sy, 38, GOLD_HEX, 0.45);
    const moveLabel = bodyText(this, sx, sy + 104, 'MOVE · JUMP · CROUCH', 16, '#d8cdb0').setOrigin(0.5).setAlpha(0.7);
    layer.add([this.stickBase, this.stickKnob, moveLabel]);

    const ft = this.fight.fighters[0];
    const R = e.right;
    const B = e.bottom;
    const r = 52;
    const btn = (x: number, y: number, label: string, key: TouchKey, color: number) => {
      const c = this.add.container(x, y);
      const circle = this.add.circle(0, 0, r, color, 0.22).setStrokeStyle(3, color, 0.85);
      const ring = this.add.graphics();
      const t = this.add.text(0, 0, label, { fontFamily: FONT_DISPLAY, fontSize: label.length > 6 ? '19px' : '22px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
      const sub = this.add.text(0, 20, '', { fontFamily: FONT_BODY, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      c.add([circle, ring, t, sub]);
      circle.setInteractive();
      const down = () => {
        this.touchHeld[key] = true;
        // latched until the next frame reads it, so even a very quick tap counts
        this.touchTapped[key] = true;
        circle.setFillStyle(color, 0.65);
      };
      const up = () => {
        this.touchHeld[key] = false;
        circle.setFillStyle(color, 0.22);
      };
      circle.on('pointerdown', down);
      circle.on('pointerup', up);
      circle.on('pointerout', up);
      layer.add(c);
      this.touchBtns[key] = { c, circle, ring, sub, color };
    };
    btn(R - 335, B - 80, 'PUNCH', 'punch', 0xffffff);
    btn(R - 205, B - 125, 'KICK', 'kick', 0xffffff);
    btn(R - 78, B - 175, 'BLOCK', 'block', 0x6bb8ff);
    btn(R - 375, B - 215, 'COMBO', 'combo', 0xff9a4a);
    btn(R - 245, B - 265, 'SPECIAL', 'special', ft.accent);
    btn(R - 115, B - 315, 'FINISHER', 'finisher', 0xffd23f);
    this.specialHint = bodyText(this, R - 245, B - 335, '', 16, '#e8e2d0').setOrigin(0.5).setAlpha(0.85);
    layer.add(this.specialHint);
  }

  /** which special the stick selects: neutral 1, forward 2, down 3 */
  private stickSpecial(): 1 | 2 | 3 {
    const t = stickDeadzone();
    const facing = this.fight.fighters[0].facing;
    if (this.stick.dy > t) return 3;
    if (this.stick.dx * facing > t) return 2;
    return 1;
  }

  private writeTouch() {
    const f = this.fight;
    const me = f.fighters[0];
    const r = emptyRaw();
    const t = stickDeadzone();
    r.left = this.stick.dx < -t;
    r.right = this.stick.dx > t;
    r.up = this.stick.dy < -t * 1.4;
    r.down = this.stick.dy > t;
    const fwd = this.stick.dx * me.facing > t;
    const heavy = fwd || r.down;

    const pressed = (k: TouchKey) => !!this.touchTapped[k];
    const blockTap = pressed('block');
    const tap = (b: Button) => this.taps.push({ until: f.frame + 3, b });
    if (pressed('punch')) tap(heavy ? 'hp' : 'lp');
    if (pressed('kick')) tap(heavy ? 'hk' : 'lk');
    if (pressed('special')) tap(`s${this.stickSpecial()}` as Button);
    if (pressed('finisher')) {
      const winner = f.fighters.find((x) => x.wins >= ROUNDS_TO_WIN);
      if (f.phase === 'finish' && winner === me) f.tryFatality(me);
      else {
        tap(`s${this.stickSpecial()}` as Button);
        tap('ex');
      }
    }
    if (pressed('combo') && !this.queue.length) {
      const n = f.frame;
      this.queue = [
        { at: n, b: 'lp' },
        { at: n + 8, b: 'lk' },
        { at: n + 16, b: 'hp' },
        { at: n + 28, b: 's1' },
      ];
    }
    this.touchTapped = {};

    // scripted combo presses (the special only if it's ready, so the combo never wastes it)
    for (const q of this.queue) if (f.frame >= q.at && (q.b !== 's1' || me.specialCD === 0)) tap(q.b);
    this.queue = this.queue.filter((q) => f.frame < q.at);
    this.taps = this.taps.filter((p) => f.frame < p.until);
    for (const p of this.taps) r.buttons[p.b] = true;
    r.buttons.block = !!this.touchHeld.block || blockTap;
    f.touch.state = r;

    // button states: cooldown ring on SPECIAL, FINISHER lights up when it can be used
    const sp = this.touchBtns.special;
    if (sp) {
      const cd = me.specialCD / SPECIAL_COOLDOWN;
      sp.ring.clear();
      if (cd > 0) {
        sp.ring.lineStyle(7, 0x000000, 0.55).beginPath().arc(0, 0, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd).strokePath();
        sp.sub.setText(`${Math.ceil(me.specialCD / 60)}s`);
      } else sp.sub.setText('');
      sp.c.setAlpha(cd > 0 ? 0.55 : 1);
      const name = me.data.specials[this.stickSpecial() - 1]?.name ?? '';
      this.specialHint?.setText(cd > 0 ? 'SPECIAL RECHARGING' : `${name.toUpperCase()}  (· → ↓)`);
    }
    const fin = this.touchBtns.finisher;
    if (fin) {
      const winner = f.fighters.find((x) => x.wins >= ROUNDS_TO_WIN);
      const fatal = f.phase === 'finish' && winner === me;
      const ready = fatal || (me.meter >= METER_BAR && me.specialCD === 0);
      fin.c.setAlpha(ready ? 1 : 0.45);
      fin.c.setScale(fatal ? 1 + 0.08 * Math.sin(f.frame / 4) : 1);
      fin.sub.setText(fatal ? 'FATALITY' : me.meter >= METER_BAR ? 'EX' : '1 BAR');
    }
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
      // a touch player with no touch controls on screen (P2 in versus) still gets a button
      if (humanWinner && game.isTouch && !this.touchLayer) {
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
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + 1600, GAME_H + 800, 0x000000, 0.7).setInteractive());
    c.add(goldText(this, GAME_W / 2, 150, 'PAUSED', 80));
    const items: [string, () => void][] = [
      ['RESUME', () => this.togglePause()],
      ['MOVE LIST', () => this.toggleMoveList()],
      [this.scale.isFullscreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else goFullscreen(this);
        this.togglePause();
      }],
      [sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', () => {
        sfx.toggleMute();
        this.togglePause();
        this.togglePause();
      }],
      ['CHARACTER SELECT', () => this.leave('Select')],
      ['QUIT TO TITLE', () => this.leave('Title')],
    ];
    items.forEach(([label, fn], i) => {
      const t = goldText(this, GAME_W / 2, 240 + i * 62, label, 40).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => {
        sfx.play('confirm');
        fn();
      });
      t.on('pointerover', () => t.setScale(1.08));
      t.on('pointerout', () => t.setScale(1));
      c.add(t);
    });
    if (game.isTouch) c.add(stickSensitivityControl(this, GAME_W / 2 + 60, 240 + items.length * 62 + 6));
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
    const y = game.isTouch ? 170 : 130;
    const lines: string[] = [];
    ft.data.specials.forEach((s, i) => {
      lines.push(`${s.name.toUpperCase()}`);
      lines.push(game.isTouch ? `   SPECIAL ${['(stick centred)', '+ forward', '+ down'][i]}` : `   ${MOTIONS[i]}   or  [${SHORTCUTS[0][i]}]`);
      lines.push(`   ${s.description}`);
    });
    lines.push('');
    lines.push('Specials recharge for 7 seconds after each use');
    lines.push(game.isTouch ? 'FINISHER: EX special (1 bar) · COMBO: punch, kick, power punch, special' : 'EX: special with a heavy button or [P] (1 bar)');
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
      s.special.setText(f.training ? '' : ft.specialCD > 0 ? `SPECIAL ${Math.ceil(ft.specialCD / 60)}s` : 'SPECIAL READY');
      s.special.setColor(ft.specialCD > 0 ? '#8a8270' : '#9cff9c');
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
      this.finishCountdown.setText(human ? (game.isTouch && winner!.side === 0 ? 'Tap FINISHER!' : '↓ ↓ → + HEAVY PUNCH') : '');
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
          const e = screenEdges(this);
          this.debugLabel().setPosition(sx + e.left, sy + e.top).setText(`${dir} ${btns.join('+')}`).setVisible(true);
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
