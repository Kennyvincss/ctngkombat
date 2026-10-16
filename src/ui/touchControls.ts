import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, GOLD_HEX } from '../config';
import { settings } from '../state';
import { screenEdges } from './ui';

// ---------------------------------------------------------------------------
// The touch controls' shapes and positions, shared by the fight HUD and the
// CUSTOMIZE CONTROLS editor. Players can move and resize every control; their
// layout is stored as fractions of the screen so it survives other screen sizes.
// ---------------------------------------------------------------------------

export type ButtonId = 'punch' | 'kick' | 'block' | 'special' | 'combo' | 'finisher';
export type ControlId = 'move' | ButtonId;
export const BUTTON_IDS: ButtonId[] = ['punch', 'kick', 'block', 'special', 'combo', 'finisher'];
export const CONTROL_IDS: ControlId[] = ['move', ...BUTTON_IDS];

export const BUTTON_R = 52;
export const STICK_R = 80;
export const DPAD_R = 92;
export const MIN_SIZE = 0.6;
export const MAX_SIZE = 1.6;

export const BUTTON_LOOK: Record<ButtonId, { label: string; color: number | 'accent' }> = {
  punch: { label: 'PUNCH', color: 0xffffff },
  kick: { label: 'KICK', color: 0xffffff },
  block: { label: 'BLOCK', color: 0x6bb8ff },
  special: { label: 'SPECIAL', color: 'accent' },
  combo: { label: 'COMBO', color: 0xff9a4a },
  finisher: { label: 'FINISHER', color: 0xffd23f },
};

/** a control's centre (design coordinates) and size multiplier */
export interface Spot {
  x: number;
  y: number;
  s: number;
}

/** the default layout, pinned to the real screen edges */
export function defaultSpots(scene: Phaser.Scene): Record<ControlId, Spot> {
  const e = screenEdges(scene);
  const R = e.right;
  const B = e.bottom;
  return {
    move: { x: e.left + 180, y: B - 170, s: 1 },
    punch: { x: R - 335, y: B - 80, s: 1 },
    kick: { x: R - 205, y: B - 125, s: 1 },
    block: { x: R - 78, y: B - 175, s: 1 },
    combo: { x: R - 375, y: B - 215, s: 1 },
    special: { x: R - 245, y: B - 265, s: 1 },
    finisher: { x: R - 115, y: B - 315, s: 1 },
  };
}

/** the layout to use now: the player's saved spots, else the defaults */
export function resolveSpots(scene: Phaser.Scene): Record<ControlId, Spot> {
  const e = screenEdges(scene);
  const w = e.right - e.left;
  const h = e.bottom - e.top;
  const spots = defaultSpots(scene);
  for (const id of CONTROL_IDS) {
    const o = settings.layout[id];
    if (!o) continue;
    spots[id] = { x: e.left + o.fx * w, y: e.top + o.fy * h, s: Phaser.Math.Clamp(o.s, MIN_SIZE, MAX_SIZE) };
  }
  return spots;
}

/** the screen-relative form stored in settings */
export function toStored(scene: Phaser.Scene, spot: Spot) {
  const e = screenEdges(scene);
  return { fx: (spot.x - e.left) / (e.right - e.left), fy: (spot.y - e.top) / (e.bottom - e.top), s: spot.s };
}

export interface ButtonParts {
  c: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
  sub: Phaser.GameObjects.Text;
  color: number;
}

export function drawButton(scene: Phaser.Scene, id: ButtonId, spot: Spot, accent: number): ButtonParts {
  const look = BUTTON_LOOK[id];
  const color = look.color === 'accent' ? accent : look.color;
  const r = BUTTON_R;
  const c = scene.add.container(spot.x, spot.y).setScale(spot.s);
  const circle = scene.add.circle(0, 0, r, color, 0.22).setStrokeStyle(3, color, 0.85);
  const ring = scene.add.graphics();
  const t = scene.add
    .text(0, 0, look.label, { fontFamily: FONT_DISPLAY, fontSize: look.label.length > 6 ? '19px' : '22px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
    .setOrigin(0.5);
  const sub = scene.add.text(0, 20, '', { fontFamily: FONT_BODY, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
  c.add([circle, ring, t, sub]);
  return { c, circle, ring, sub, color };
}

export interface MoveParts {
  c: Phaser.GameObjects.Container;
  /** analog: the moving knob */
  knob?: Phaser.GameObjects.Arc;
  base?: Phaser.GameObjects.Arc;
  /** arrows: left, right, up, down pads */
  pads?: Phaser.GameObjects.Rectangle[];
  /** radius of the drawn control before scaling */
  r: number;
}

/** the movement control: an analog stick, or four arrow pads in a cross */
export function drawMove(scene: Phaser.Scene, spot: Spot, label = true): MoveParts {
  const c = scene.add.container(spot.x, spot.y).setScale(spot.s);
  if (settings.move === 'analog') {
    const base = scene.add.circle(0, 0, STICK_R, 0xffffff, 0.08).setStrokeStyle(3, 0xffffff, 0.35);
    const knob = scene.add.circle(0, 0, 38, GOLD_HEX, 0.45);
    c.add([base, knob]);
    if (label) c.add(scene.add.text(0, STICK_R + 22, 'MOVE · JUMP · CROUCH', { fontFamily: FONT_BODY, fontSize: '16px', color: '#d8cdb0' }).setOrigin(0.5).setAlpha(0.7));
    return { c, knob, base, r: STICK_R };
  }
  const pads: Phaser.GameObjects.Rectangle[] = [];
  const d = 58;
  const size = 62;
  const arrows: [number, number, string][] = [
    [-d, 0, '◀'],
    [d, 0, '▶'],
    [0, -d, '▲'],
    [0, d, '▼'],
  ];
  c.add(scene.add.circle(0, 0, DPAD_R + 4, 0xffffff, 0.05).setStrokeStyle(2, 0xffffff, 0.2));
  for (const [x, y, glyph] of arrows) {
    const pad = scene.add.rectangle(x, y, size, size, 0xffffff, 0.14).setStrokeStyle(3, 0xffffff, 0.6);
    pads.push(pad);
    c.add([pad, scene.add.text(x, y, glyph, { fontFamily: FONT_BODY, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5)]);
  }
  return { c, pads, r: DPAD_R };
}

/**
 * Direction from a thumb on the arrow pad: 8-way by angle, nothing in the middle.
 * dx, dy are relative to the pad centre in unscaled units.
 */
export function dpadDirection(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < 18) return { x: 0, y: 0 };
  const a = Math.atan2(dy, dx); // 0 = right, π/2 = down
  const sector = Math.round(a / (Math.PI / 4)); // -4..4
  const dirs: Record<number, [number, number]> = {
    0: [1, 0],
    1: [1, 1],
    2: [0, 1],
    3: [-1, 1],
    4: [-1, 0],
    [-4]: [-1, 0],
    [-3]: [-1, -1],
    [-2]: [0, -1],
    [-1]: [1, -1],
  };
  const [x, y] = dirs[sector];
  return { x, y };
}
