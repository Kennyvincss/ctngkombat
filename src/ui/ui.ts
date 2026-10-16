import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, GOLD, GAME_W } from '../config';
import { sfx } from '../audio/Sfx';
import { emptyRaw, GamepadSource, KeyboardSource, KEYMAP_P1, KEYMAP_P2, KEYMAP_SOLO_EXTRA, MergedSource, type InputSource, type RawInput } from '../systems/input';

export function goldText(scene: Phaser.Scene, x: number, y: number, text: string, size = 48, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT_DISPLAY,
    fontSize: `${size}px`,
    color: GOLD,
    stroke: '#1a0f00',
    strokeThickness: Math.max(4, Math.round(size / 8)),
    ...opts,
  });
  t.setOrigin(0.5);
  // vertical gold gradient
  const grad = t.context.createLinearGradient(0, 0, 0, t.height);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.45, '#f5c542');
  grad.addColorStop(1, '#b07a12');
  t.setFill(grad);
  return t;
}

export function bodyText(scene: Phaser.Scene, x: number, y: number, text: string, size = 22, color = '#e8e2d0', opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
  return scene.add.text(x, y, text, { fontFamily: FONT_BODY, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 3, ...opts });
}

/** Dark arena backdrop with drifting embers, shared by menu screens. */
export function menuBackdrop(scene: Phaser.Scene, tint = 0x3a0d05) {
  const g = scene.add.graphics();
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x050505),
      Phaser.Display.Color.ValueToColor(tint),
      steps,
      i,
    );
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, (720 / steps) * i, GAME_W, 720 / steps + 1);
  }
  scene.add
    .particles(0, 0, 'ember', {
      x: { min: 0, max: GAME_W },
      y: 740,
      lifespan: 6000,
      speedY: { min: -90, max: -30 },
      speedX: { min: -20, max: 20 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff7a1a, 0xffb347, 0xff3b1a],
      frequency: 80,
      blendMode: 'ADD',
    })
    .setDepth(1);
  return g;
}

/** Small speaker toggle in the top-right corner. */
export function muteButton(scene: Phaser.Scene, x = GAME_W - 34, y = 30) {
  const t = bodyText(scene, x, y, sfx.muted ? 'SOUND OFF' : 'SOUND ON', 20, '#bfb59a').setOrigin(1, 0.5).setDepth(1000);
  t.setInteractive({ useHandCursor: true });
  t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
    e.stopPropagation();
    sfx.unlock();
    const m = sfx.toggleMute();
    t.setText(m ? 'SOUND OFF' : 'SOUND ON');
  });
  scene.input.keyboard?.on('keydown-M', () => {
    const m = sfx.toggleMute();
    t.setText(m ? 'SOUND OFF' : 'SOUND ON');
  });
  return t;
}

// ---------------------------------------------------------------- menu input

export interface MenuPress {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  ok: boolean;
  back: boolean;
}

/** Edge-triggered menu navigation with key repeat, for one player (keyboard + gamepad). */
export class MenuInput {
  private src: InputSource;
  private prev: RawInput = emptyRaw();
  private holdT: Record<string, number> = {};
  private extraOk: Phaser.Input.Keyboard.Key[] = [];
  private extraBack: Phaser.Input.Keyboard.Key[] = [];
  // start "pressed" so a key held over from the previous screen doesn't fire here
  private prevOk = true;
  private prevBack = true;

  constructor(scene: Phaser.Scene, player: 0 | 1, solo = true) {
    const kb = new KeyboardSource(scene, player === 0 ? KEYMAP_P1 : KEYMAP_P2, player === 0 && solo ? KEYMAP_SOLO_EXTRA : undefined);
    this.src = new MergedSource([kb, new GamepadSource(scene, player)]);
    const k = scene.input.keyboard!;
    const KC = Phaser.Input.Keyboard.KeyCodes;
    if (player === 0) {
      this.extraOk = [k.addKey(KC.ENTER, true, false), k.addKey(KC.SPACE, true, false)];
      this.extraBack = [k.addKey(KC.ESC, true, false), k.addKey(KC.BACKSPACE, true, false)];
    } else {
      this.extraOk = [k.addKey(KC.NUMPAD_ADD, true, false)];
      this.extraBack = [k.addKey(KC.NUMPAD_SUBTRACT, true, false)];
    }
  }

  poll(): MenuPress {
    const r = this.src.poll();
    const p = this.prev;
    const rep = (name: 'up' | 'down' | 'left' | 'right', now: boolean, was: boolean) => {
      if (!now) {
        this.holdT[name] = 0;
        return false;
      }
      if (!was) {
        this.holdT[name] = 0;
        return true;
      }
      this.holdT[name] = (this.holdT[name] ?? 0) + 1;
      return this.holdT[name] > 22 && this.holdT[name] % 6 === 0;
    };
    const okNow = r.buttons.lp || r.buttons.start || this.extraOk.some((k) => k.isDown);
    const backNow = r.buttons.hp || this.extraBack.some((k) => k.isDown);
    const out: MenuPress = {
      up: rep('up', r.up, p.up),
      down: rep('down', r.down, p.down),
      left: rep('left', r.left, p.left),
      right: rep('right', r.right, p.right),
      ok: okNow && !this.prevOk,
      back: backNow && !this.prevBack,
    };
    this.prevOk = okNow;
    this.prevBack = backNow;
    this.prev = r;
    return out;
  }
}

/** A vertical list menu with keyboard/gamepad/touch. */
export class ListMenu {
  index = 0;
  private items: Phaser.GameObjects.Text[] = [];
  private marker: Phaser.GameObjects.Text;
  enabled = true;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    labels: string[],
    private onPick: (i: number) => void,
    gap = 70,
    size = 48,
  ) {
    labels.forEach((l, i) => {
      const t = goldText(scene, x, y + i * gap, l, size).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => {
        sfx.unlock();
        this.select(i);
        this.pick();
      });
      this.items.push(t);
    });
    this.marker = goldText(scene, 0, 0, '▶', size * 0.6);
    this.select(0, true);
  }

  select(i: number, silent = false) {
    if (i === this.index && !silent) return;
    this.index = (i + this.items.length) % this.items.length;
    this.items.forEach((t, k) => {
      t.setAlpha(k === this.index ? 1 : 0.45);
      t.setScale(k === this.index ? 1.08 : 1);
    });
    const it = this.items[this.index];
    this.marker.setPosition(it.x - it.width / 2 - 34, it.y);
    if (!silent) sfx.play('select');
  }

  handle(p: MenuPress) {
    if (!this.enabled) return;
    if (p.up) this.select(this.index - 1);
    if (p.down) this.select(this.index + 1);
    if (p.ok) this.pick();
  }

  pick() {
    if (!this.enabled) return;
    sfx.play('confirm');
    const it = this.items[this.index];
    this.scene.tweens.add({ targets: it, scale: 1.2, yoyo: true, duration: 80 });
    this.onPick(this.index);
  }

  setVisible(v: boolean) {
    this.items.forEach((t) => t.setVisible(v));
    this.marker.setVisible(v);
  }

  destroy() {
    this.items.forEach((t) => t.destroy());
    this.marker.destroy();
  }
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 250) {
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
