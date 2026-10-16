// Generic normal attacks shared by every fighter (scaled by each fighter's `damage` tuning).
// Frame data is in 60 Hz frames. Boxes are relative to the fighter's feet:
// x is forward from body centre, y is up (negative), w/h are size.

export type HitType = 'high' | 'mid' | 'low' | 'overhead' | 'unblockable';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Puppet animation keys. Phase B sprite sheets will provide one image per key. */
export type AnimKey =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'flip'
  | 'flipBack'
  | 'light'
  | 'heavy'
  | 'kick'
  | 'sweep'
  | 'uppercut'
  | 'overhead'
  | 'special'
  | 'cast'
  | 'dash'
  | 'block'
  | 'hit'
  | 'knockdown'
  | 'getup'
  | 'win'
  | 'dizzy'
  | 'grab'
  | 'stance';

export interface AttackSpec {
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  type: HitType;
  box: Box;
  anim: AnimKey;
  heavy?: boolean;
  launcher?: boolean;
  knockdown?: boolean;
  wallBounce?: boolean;
  /** forward speed (px/frame) during startup + active */
  lunge?: number;
  /** light normals can chain */
  light?: boolean;
}

export type NormalKey =
  | 'stand.lp'
  | 'stand.hp'
  | 'stand.lk'
  | 'stand.hk'
  | 'crouch.lp'
  | 'crouch.hp'
  | 'crouch.lk'
  | 'crouch.hk'
  | 'jump.lp'
  | 'jump.hp'
  | 'jump.lk'
  | 'jump.hk';

export const NORMALS: Record<NormalKey, AttackSpec> = {
  'stand.lp': { damage: 32, startup: 4, active: 3, recovery: 7, hitstun: 15, blockstun: 10, pushback: 5, type: 'high', box: { x: 30, y: -250, w: 105, h: 60 }, anim: 'light', light: true },
  'stand.hp': { damage: 70, startup: 8, active: 4, recovery: 16, hitstun: 21, blockstun: 15, pushback: 8, type: 'mid', box: { x: 30, y: -240, w: 130, h: 110 }, anim: 'heavy', heavy: true, lunge: 2 },
  'stand.lk': { damage: 36, startup: 5, active: 3, recovery: 9, hitstun: 15, blockstun: 10, pushback: 6, type: 'mid', box: { x: 30, y: -150, w: 120, h: 60 }, anim: 'kick', light: true },
  'stand.hk': { damage: 80, startup: 10, active: 4, recovery: 18, hitstun: 22, blockstun: 16, pushback: 12, type: 'mid', box: { x: 30, y: -200, w: 150, h: 90 }, anim: 'kick', heavy: true, lunge: 2 },
  'crouch.lp': { damage: 26, startup: 4, active: 3, recovery: 7, hitstun: 14, blockstun: 9, pushback: 5, type: 'mid', box: { x: 30, y: -160, w: 100, h: 50 }, anim: 'light', light: true },
  'crouch.hp': { damage: 70, startup: 7, active: 5, recovery: 20, hitstun: 30, blockstun: 14, pushback: 4, type: 'mid', box: { x: 10, y: -330, w: 110, h: 200 }, anim: 'uppercut', heavy: true, launcher: true },
  'crouch.lk': { damage: 26, startup: 5, active: 3, recovery: 8, hitstun: 13, blockstun: 9, pushback: 6, type: 'low', box: { x: 30, y: -45, w: 120, h: 45 }, anim: 'sweep', light: true },
  'crouch.hk': { damage: 70, startup: 9, active: 4, recovery: 22, hitstun: 24, blockstun: 14, pushback: 10, type: 'low', box: { x: 30, y: -50, w: 160, h: 50 }, anim: 'sweep', heavy: true, knockdown: true },
  'jump.lp': { damage: 40, startup: 5, active: 6, recovery: 4, hitstun: 16, blockstun: 10, pushback: 5, type: 'high', box: { x: 20, y: -200, w: 100, h: 90 }, anim: 'light', light: true },
  'jump.hp': { damage: 72, startup: 7, active: 6, recovery: 6, hitstun: 20, blockstun: 14, pushback: 7, type: 'overhead', box: { x: 10, y: -170, w: 120, h: 130 }, anim: 'overhead', heavy: true },
  'jump.lk': { damage: 42, startup: 5, active: 7, recovery: 4, hitstun: 16, blockstun: 10, pushback: 5, type: 'high', box: { x: 20, y: -120, w: 110, h: 80 }, anim: 'kick', light: true },
  'jump.hk': { damage: 75, startup: 7, active: 6, recovery: 6, hitstun: 20, blockstun: 14, pushback: 8, type: 'overhead', box: { x: 10, y: -130, w: 140, h: 110 }, anim: 'kick', heavy: true },
};

export const BODY = {
  halfW: 42,
  standH: 290,
  crouchH: 180,
  airH: 240,
};

export const PHYS = {
  gravity: 0.95,
  jumpVy: -19.5,
  jumpVx: 5.2,
  dashSpeed: 13,
  dashFrames: 14,
  backdashSpeed: 12,
  backdashFrames: 14,
  friction: 0.8,
  stageW: 1600,
  wallMargin: 70,
  groundY: 640,
  maxSeparation: 980,
};
