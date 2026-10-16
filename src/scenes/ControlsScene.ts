import Phaser from 'phaser';
import { GAME_H, GAME_W, GOLD_HEX } from '../config';
import { sfx } from '../audio/Sfx';
import { saveControls, settings, type MoveMode } from '../state';
import {
  BUTTON_LOOK,
  BUTTON_R,
  CONTROL_IDS,
  defaultSpots,
  drawButton,
  drawMove,
  MAX_SIZE,
  MIN_SIZE,
  resolveSpots,
  toStored,
  type ControlId,
  type Spot,
} from '../ui/touchControls';
import { bodyText, fadeTo, fitCamera, goldText, menuBackdrop, screenEdges, stickSensitivityControl } from '../ui/ui';

/**
 * CUSTOMIZE CONTROLS: drag any touch control to move it, tap one and use − / + to resize it,
 * pick analog stick or arrow buttons for movement. Opened from the mode screen or the pause menu.
 */
export class ControlsScene extends Phaser.Scene {
  private from: 'Mode' | 'Hud' = 'Mode';
  private spots!: Record<ControlId, Spot>;
  private changed = new Set<ControlId>();
  private views: Partial<Record<ControlId, Phaser.GameObjects.Container>> = {};
  private selected: ControlId = 'punch';
  private selRing!: Phaser.GameObjects.Graphics;
  private sizeText!: Phaser.GameObjects.Text;
  private moveBtns: { mode: MoveMode; bg: Phaser.GameObjects.Rectangle }[] = [];
  private sens!: Phaser.GameObjects.Container;

  constructor() {
    super('Controls');
  }

  init(data: { from?: 'Mode' | 'Hud' }) {
    this.from = data.from ?? 'Mode';
    this.changed = new Set(Object.keys(settings.layout) as ControlId[]);
    this.views = {};
    this.moveBtns = [];
    this.selected = 'punch';
  }

  create() {
    fitCamera(this);
    if (this.from === 'Mode') menuBackdrop(this, 0x1a0804);
    else this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + 1600, GAME_H + 800, 0x000000, 0.6).setInteractive();

    goldText(this, GAME_W / 2, 36, 'CUSTOMIZE CONTROLS', 44).setDepth(20);
    bodyText(this, GAME_W / 2, 74, 'Drag a control to move it  ·  tap one, then − / + to change its size', 19, '#d8cdb0').setOrigin(0.5).setDepth(20);

    // movement: analog or arrows
    bodyText(this, GAME_W / 2 - 150, 118, 'MOVEMENT', 24, '#e8e2d0').setOrigin(1, 0.5).setDepth(20);
    (['analog', 'arrows'] as MoveMode[]).forEach((mode, i) => {
      const x = GAME_W / 2 - 60 + i * 150;
      const bg = this.add.rectangle(x, 118, 136, 42, 0x000000, 0.6).setStrokeStyle(2, GOLD_HEX).setDepth(20).setInteractive({ useHandCursor: true });
      bodyText(this, x, 118, mode === 'analog' ? 'ANALOG STICK' : 'ARROWS', 20, '#ffffff').setOrigin(0.5).setDepth(21);
      bg.on('pointerdown', () => this.setMoveMode(mode));
      this.moveBtns.push({ mode, bg });
    });

    this.sens = stickSensitivityControl(this, GAME_W / 2 + 40, 166).setDepth(20);

    // size of the selected control
    bodyText(this, GAME_W / 2 - 150, 214, 'SIZE', 24, '#e8e2d0').setOrigin(1, 0.5).setDepth(20);
    this.roundBtn(GAME_W / 2 - 110, 214, '−', () => this.resize(-0.1));
    this.sizeText = bodyText(this, GAME_W / 2 + 10, 214, '', 22, '#ffffff').setOrigin(0.5).setDepth(20);
    this.roundBtn(GAME_W / 2 + 130, 214, '+', () => this.resize(0.1));

    this.textButton(GAME_W / 2 - 110, 268, 'RESET', 0x6b4d16, () => this.reset());
    this.textButton(GAME_W / 2 + 110, 268, 'DONE', 0x8a5a00, () => this.done());

    this.selRing = this.add.graphics().setDepth(15);
    this.spots = resolveSpots(this);
    for (const id of CONTROL_IDS) this.drawControl(id);
    this.refresh();

    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
      const id = obj.getData('id') as ControlId;
      const e = screenEdges(this);
      const r = this.radius(id);
      const nx = Phaser.Math.Clamp(x, e.left + r * 0.6, e.right - r * 0.6);
      const ny = Phaser.Math.Clamp(y, e.top + r * 0.6, e.bottom - r * 0.6);
      obj.setPosition(nx, ny);
      this.spots[id] = { ...this.spots[id], x: nx, y: ny };
      this.changed.add(id);
      this.refresh();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.done());
  }

  private radius(id: ControlId) {
    const base = id === 'move' ? (settings.move === 'analog' ? 80 : 92) : BUTTON_R;
    return base * this.spots[id].s;
  }

  private drawControl(id: ControlId) {
    this.views[id]?.destroy();
    const spot = this.spots[id];
    const c = id === 'move' ? drawMove(this, spot).c : drawButton(this, id, spot, 0xff5ad1).c;
    const r = id === 'move' ? (settings.move === 'analog' ? 80 : 92) : BUTTON_R;
    c.setDepth(10).setData('id', id);
    c.setInteractive(new Phaser.Geom.Circle(0, 0, r * 1.1), Phaser.Geom.Circle.Contains);
    this.input.setDraggable(c);
    c.on('pointerdown', () => {
      this.selected = id;
      sfx.play('select');
      this.refresh();
    });
    this.views[id] = c;
  }

  private refresh() {
    const sp = this.spots[this.selected];
    this.selRing.clear().lineStyle(4, GOLD_HEX, 1).strokeCircle(sp.x, sp.y, this.radius(this.selected) + 10);
    const name = this.selected === 'move' ? 'MOVEMENT' : BUTTON_LOOK[this.selected].label;
    this.sizeText.setText(`${name}  ${Math.round(sp.s * 100)}%`);
    for (const b of this.moveBtns) b.bg.setFillStyle(b.mode === settings.move ? 0x8a5a00 : 0x000000, b.mode === settings.move ? 0.9 : 0.6);
    this.sens.setAlpha(settings.move === 'analog' ? 1 : 0.35);
  }

  private setMoveMode(mode: MoveMode) {
    if (settings.move === mode) return;
    settings.move = mode;
    sfx.play('select');
    this.drawControl('move');
    this.refresh();
  }

  private resize(d: number) {
    const id = this.selected;
    const s = Phaser.Math.Clamp(Math.round((this.spots[id].s + d) * 10) / 10, MIN_SIZE, MAX_SIZE);
    this.spots[id] = { ...this.spots[id], s };
    this.views[id]?.setScale(s);
    this.changed.add(id);
    sfx.play('select');
    this.refresh();
  }

  private reset() {
    sfx.play('back');
    this.spots = defaultSpots(this);
    this.changed.clear();
    for (const id of CONTROL_IDS) this.drawControl(id);
    this.refresh();
  }

  private done() {
    // only controls the player touched are pinned; the rest keep following the screen edges
    settings.layout = {};
    for (const id of this.changed) settings.layout[id] = toStored(this, this.spots[id]);
    saveControls();
    sfx.play('confirm');
    if (this.from === 'Mode') {
      fadeTo(this, 'Mode');
      return;
    }
    this.events.emit('closed');
    this.scene.stop();
  }

  private roundBtn(x: number, y: number, sign: string, fn: () => void) {
    const ring = this.add.circle(x, y, 22, 0x000000, 0.5).setStrokeStyle(2, GOLD_HEX).setDepth(20).setInteractive({ useHandCursor: true });
    bodyText(this, x, y - 1, sign, 36, '#f5c542').setOrigin(0.5).setDepth(21);
    ring.on('pointerdown', fn);
  }

  private textButton(x: number, y: number, label: string, color: number, fn: () => void) {
    const bg = this.add.rectangle(x, y, 180, 50, color, 0.9).setStrokeStyle(3, GOLD_HEX).setDepth(20).setInteractive({ useHandCursor: true });
    goldText(this, x, y, label, 32).setDepth(21);
    bg.on('pointerup', fn);
  }
}

