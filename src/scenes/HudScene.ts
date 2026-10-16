import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, GAME_H, GAME_W, GOLD_HEX, ROUNDS_TO_WIN } from '../config';
import { sfx } from '../audio/Sfx';
import type { Fighter } from '../fight/Fighter';
import { METER_BAR, METER_MAX, SPECIAL_COOLDOWN } from '../fight/Fighter';
import { game, settings, stickDeadzone } from '../state';
import { btn, controlDevice, specialCommand } from '../ui/controlHelp';
import { BUTTON_IDS, BUTTON_R, drawButton, drawMove, dpadDirection, resolveSpots, type ButtonId, type ButtonParts, type MoveParts, type Spot } from '../ui/touchControls';
import { emptyRaw, type Button } from '../systems/input';
import { MenuInput, bodyText, fitCamera, goFullscreen, goldText, screenEdges, showDisconnected } from '../ui/ui';
import { net } from '../net/Net';
import type { FightScene } from './FightScene';

const BAR_W = 480;
const BAR_H = 26;
const BAR_Y = 42;

type TouchKey = ButtonId;

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
  /** the pause menu's items, for keyboard / gamepad navigation */
  private pauseMenu: { items: Phaser.GameObjects.Text[]; fns: (() => void)[]; index: number } | null = null;
  private menuIn!: MenuInput;
  private touchHeld: Partial<Record<TouchKey, boolean>> = {};
  private touchTapped: Partial<Record<TouchKey, boolean>> = {};
  private stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  private touchLayer: Phaser.GameObjects.Container | null = null;
  private move: MoveParts | null = null;
  private moveSpot: Spot = { x: 0, y: 0, s: 1 };
  private touchBtns: Partial<Record<TouchKey, ButtonParts & { s: number }>> = {};
  private specialHint: Phaser.GameObjects.Text | null = null;
  /** scripted presses: fight frame they start on, button */
  /** a press made by a touch button this frame, held for a few fight frames so it's seen */
  private taps: { until: number; b: Button }[] = [];
  private padPrevStart = false;
  private waitText: Phaser.GameObjects.Text | null = null;

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
    this.move = null;
    this.touchBtns = {};
    this.specialHint = null;
    this.taps = [];
    this.waitText = null;
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
    if (f.online) {
      this.waitText = bodyText(this, GAME_W / 2, GAME_H / 2 + 60, '', 30, '#ffd23f').setOrigin(0.5).setDepth(70).setVisible(false);
      f.events.on('netlost', () => showDisconnected(this));
      f.events.on('netdesync', () => bodyText(this, GAME_W / 2, BAR_Y + 120, 'OUT OF SYNC: finish the round, then rematch', 18, '#ff6060').setOrigin(0.5).setDepth(70));
    }
    // fade the HUD out during fatalities so the show takes the whole screen
    f.events.on('darken', (on: boolean) => this.tweens.add({ targets: this.cameras.main, alpha: on ? 0.12 : 1, duration: 300 }));
    f.events.on('finish', this.showFinish, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      f.events.off('announce', this.announce, this);
      f.events.off('finish', this.showFinish, this);
      f.events.off('darken');
      f.events.off('netlost');
      f.events.off('netdesync');
    });

    // pause
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.pauseKeys = [this.input.keyboard!.addKey(KC.ESC), this.input.keyboard!.addKey(KC.BACKSPACE)];
    this.menuIn = new MenuInput(this, 0);
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
  // Movement (analog stick or arrow pad) and six labelled buttons, placed and sized as the
  // player set them in CUSTOMIZE CONTROLS (src/ui/touchControls.ts has the defaults):
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
      // back to touch after a gamepad hid the buttons
      this.touchLayer?.setVisible(true);
      const mv = this.move;
      if (!mv || this.stick.id >= 0) return;
      const sp = this.moveSpot;
      // a generous zone around the movement control; the analog stick re-centres under the thumb
      const zone = mv.r * sp.s * (settings.move === 'analog' ? 1.9 : 1.35);
      if (Math.hypot(p.worldX - sp.x, p.worldY - sp.y) > zone) return;
      if (settings.move === 'analog') {
        this.stick = { id: p.id, bx: p.worldX, by: p.worldY, dx: 0, dy: 0 };
        mv.c.setPosition(p.worldX, p.worldY);
      } else {
        this.stick = { id: p.id, bx: sp.x, by: sp.y, dx: 0, dy: 0 };
        this.trackThumb(p);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.stick.id) this.trackThumb(p);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stick.id) return;
      this.stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
      this.move?.c.setPosition(this.moveSpot.x, this.moveSpot.y);
      this.move?.knob?.setPosition(0, 0);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  /** thumb position relative to the movement control, in unscaled units */
  private trackThumb(p: Phaser.Input.Pointer) {
    const sc = this.moveSpot.s;
    let dx = (p.worldX - this.stick.bx) / sc;
    let dy = (p.worldY - this.stick.by) / sc;
    if (settings.move === 'analog') {
      const len = Math.hypot(dx, dy);
      const k = len > 70 ? 70 / len : 1;
      dx *= k;
      dy *= k;
      this.move?.knob?.setPosition(dx, dy);
    }
    this.stick.dx = dx;
    this.stick.dy = dy;
  }

  /** held direction: x -1/0/1 (left/right on screen), y -1/0/1 (up/down) */
  private readDir(): { x: number; y: number } {
    if (this.stick.id < 0) return { x: 0, y: 0 };
    const { dx, dy } = this.stick;
    if (settings.move === 'arrows') return dpadDirection(dx, dy);
    const t = stickDeadzone();
    return { x: dx < -t ? -1 : dx > t ? 1 : 0, y: dy < -t * 1.4 ? -1 : dy > t ? 1 : 0 };
  }

  /** (re)place the touch controls where the player set them */
  layoutTouch() {
    this.touchLayer?.destroy();
    this.touchHeld = {};
    this.touchBtns = {};
    this.stick = { id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
    const spots = resolveSpots(this);
    this.moveSpot = spots.move;
    const layer = this.add.container(0, 0).setDepth(40);
    this.touchLayer = layer;

    this.move = drawMove(this, spots.move);
    layer.add(this.move.c);

    const ft = this.fight.fighters[this.fight.localSide];
    for (const id of BUTTON_IDS) {
      const spot = spots[id];
      const parts = drawButton(this, id, spot, ft.accent);
      const { circle, color } = parts;
      circle.setInteractive();
      const down = () => {
        this.touchHeld[id] = true;
        // latched until the next frame reads it, so even a very quick tap counts
        this.touchTapped[id] = true;
        circle.setFillStyle(color, 0.65);
      };
      const up = () => {
        this.touchHeld[id] = false;
        circle.setFillStyle(color, 0.22);
      };
      circle.on('pointerdown', down);
      circle.on('pointerup', up);
      circle.on('pointerout', up);
      layer.add(parts.c);
      this.touchBtns[id] = { ...parts, s: spot.s };
    }
    const sp = spots.special;
    this.specialHint = bodyText(this, sp.x, sp.y - BUTTON_R * sp.s - 20, '', 16, '#e8e2d0').setOrigin(0.5).setAlpha(0.85);
    layer.add(this.specialHint);
  }

  /** which special the direction selects: neutral 1, forward 2, down 3 */
  private stickSpecial(): 1 | 2 | 3 {
    const d = this.readDir();
    if (d.y > 0) return 3;
    if (d.x * this.fight.fighters[this.fight.localSide].facing > 0) return 2;
    return 1;
  }

  private writeTouch() {
    const f = this.fight;
    const me = f.fighters[f.localSide];
    const r = emptyRaw();
    const d = this.readDir();
    r.left = d.x < 0;
    r.right = d.x > 0;
    r.up = d.y < 0;
    r.down = d.y > 0;
    // light up the arrow pads being pressed
    this.move?.pads?.forEach((pad, i) => pad.setFillStyle(0xffffff, [d.x < 0, d.x > 0, d.y < 0, d.y > 0][i] ? 0.5 : 0.14));

    // the buttons send the simple inputs; the fighter's Controller does the rest (power
    // versions, which special, COMBO, FINISHER), same as on keyboard and gamepad.
    // A tap stays down for 3 frames so even a very quick one is seen.
    const pressed = (k: TouchKey) => !!this.touchTapped[k];
    const blockTap = pressed('block');
    const tap = (b: Button) => this.taps.push({ until: f.frame + 3, b });
    if (pressed('punch')) tap('punch');
    if (pressed('kick')) tap('kick');
    if (pressed('special')) tap('special');
    if (pressed('finisher')) tap('finisher');
    if (pressed('combo')) tap('combo');
    this.touchTapped = {};
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
      fin.c.setScale(fin.s * (fatal ? 1 + 0.08 * Math.sin(f.frame / 4) : 1));
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
      const humanWinner = winner && (winner.side === this.fight.localSide || this.fight.setup.mode === 'versus');
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
  /** highlight a pause menu item (keyboard / gamepad / hover) */
  private selectPause(i: number) {
    const m = this.pauseMenu;
    if (!m) return;
    m.index = (i + m.items.length) % m.items.length;
    m.items.forEach((t, k) => t.setScale(k === m.index ? 1.1 : 1).setAlpha(k === m.index ? 1 : 0.6));
  }

  private togglePause() {
    const f = this.fight;
    if (this.pauseLayer) {
      this.pauseLayer.destroy();
      this.pauseLayer = null;
      this.pauseMenu = null;
      f.pause(false);
      return;
    }
    if (f.phase !== 'fight' && f.phase !== 'intro') return;
    // online the fight can't stop for one player: the menu opens over the running fight
    if (!f.online) f.pause(true);
    sfx.play('select');
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + 1600, GAME_H + 800, 0x000000, 0.7).setInteractive());
    c.add(goldText(this, GAME_W / 2, 150, f.online ? 'MENU' : 'PAUSED', 80));
    if (f.online) c.add(bodyText(this, GAME_W / 2, 200, 'Online matches keep running while this menu is open', 20, '#ff9a4a').setOrigin(0.5));
    const items: [string, () => void][] = f.online
      ? [
          ['RESUME', () => this.togglePause()],
          ['MOVE LIST', () => this.toggleMoveList()],
          [sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', () => {
            sfx.toggleMute();
            this.togglePause();
            this.togglePause();
          }],
          ['LEAVE MATCH', () => {
            net.leave();
            this.leave('Title');
          }],
        ]
      : [
      ['RESUME', () => this.togglePause()],
      ['MOVE LIST', () => this.toggleMoveList()],
      ...(game.isTouch ? ([['CUSTOMIZE CONTROLS', () => this.openControls()]] as [string, () => void][]) : []),
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
    const menu: { items: Phaser.GameObjects.Text[]; fns: (() => void)[]; index: number } = { items: [], fns: [], index: 0 };
    items.forEach(([label, fn], i) => {
      const t = goldText(this, GAME_W / 2, 236 + i * 60, label, 38).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => {
        sfx.play('confirm');
        fn();
      });
      t.on('pointerover', () => this.selectPause(i));
      c.add(t);
      menu.items.push(t);
      menu.fns.push(fn);
    });
    this.pauseLayer = c;
    this.pauseMenu = menu;
    this.selectPause(0);
  }

  /** the controls editor, over the paused fight */
  private openControls() {
    this.cameras.main.setVisible(false);
    this.scene.launch('Controls', { from: 'Hud' });
    const ed = this.scene.get('Controls');
    ed.events.once('closed', () => {
      this.cameras.main.setVisible(true);
      if (this.touchLayer) this.layoutTouch();
    });
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
    const ft = this.fight.fighters[this.fight.localSide];
    const c = this.add.container(0, 0).setDepth(this.pauseLayer ? 110 : 30);
    const w = 470;
    const x = 20;
    const y = game.isTouch ? 170 : 130;
    const lines: string[] = [];
    const dev = controlDevice(this);
    ft.data.specials.forEach((s, i) => {
      lines.push(`${specialCommand(dev, i)}  —  ${s.name.toUpperCase()}`);
      lines.push(`   ${s.description}`);
    });
    lines.push('');
    lines.push(`${btn(dev, 'punch')} · ${btn(dev, 'kick')}: hold forward or down for the power version`);
    lines.push(`${btn(dev, 'block')}, or hold back: guard (with down: low guard)`);
    lines.push(`${btn(dev, 'combo')}: punch, kick, power punch, then the special`);
    lines.push(`${btn(dev, 'finisher')}: EX special (1 bar of meter)`);
    lines.push(`FATALITY: ${btn(dev, 'finisher')} at FINISH THEM  —  ${ft.data.fatality}`);
    lines.push('Specials recharge for 7 seconds after each use · double-tap to dash');
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
    let toggled = false;
    if (this.pauseKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
      this.togglePause();
      toggled = true;
    }
    const pad = this.input.gamepad?.getPad(0);
    const start = !!pad?.buttons[9]?.pressed || !!pad?.buttons[8]?.pressed;
    if (start && !this.padPrevStart) {
      this.togglePause();
      toggled = true;
    }
    this.padPrevStart = start;
    // the pause menu: up / down to choose, A (or Enter, J) to pick, B to resume
    const mp = this.menuIn.poll();
    const m = this.pauseMenu;
    if (m && !toggled) {
      if (mp.up) this.selectPause(m.index - 1);
      if (mp.down) this.selectPause(m.index + 1);
      if (mp.up || mp.down) sfx.play('select');
      if (mp.ok) {
        sfx.play('confirm');
        m.fns[m.index]();
      } else if (mp.back) this.togglePause();
    }
    // a gamepad on a phone or tablet: hide the touch buttons while it's in use
    if (this.touchLayer && pad?.connected && (pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a.getValue()) > 0.5))) this.touchLayer.setVisible(false);

    if (game.isTouch) this.writeTouch();
    if (this.waitText) {
      const w = f.lock?.waitMs ?? 0;
      this.waitText.setVisible(w > 700).setText(`WAITING FOR OPPONENT… ${Math.floor(w / 1000)}s`);
    }

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
      const human = winner && (winner.side === f.localSide || f.setup.mode === 'versus');
      const dev = controlDevice(this);
      const key = winner?.side === 1 && f.setup.mode === 'versus' ? 'FINISHER [NUM 6]' : btn(dev, 'finisher');
      this.finishCountdown.setText(human ? (dev === 'touch' && winner!.side === f.localSide ? 'Tap FINISHER!' : `Press ${key}!`) : '');
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
