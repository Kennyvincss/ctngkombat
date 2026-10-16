import type { AnimKey, Box, HitType } from './normals';

// The shared mechanic catalog (SPEC section 6). Every special in moves.ts is one
// of these specs. Damage is in HP (a normal fighter has 1000).

export type StatusKind =
  | 'reverse' // Perception Warp: reversed left/right
  | 'lag' // input lag
  | 'nospecials' // Compile Error
  | 'purge' // Debug: removes buffs
  | 'drain' // Gas Fee: drains meter
  | 'mark' // Shadow Bid: takes bonus damage
  | 'freeze'; // can't act

export type BuffKind =
  | 'armor' // absorbs hits (amount = hits, 0 = unlimited for duration)
  | 'damage' // outgoing damage multiplier (amount = +%)
  | 'speed' // move speed multiplier (amount = +%)
  | 'invuln' // fully invincible
  | 'projinvuln' // projectiles pass through
  | 'meter' // meter gain multiplier
  | 'blockheal' // heals while blocking (amount = hp per blocked hit)
  | 'trend' // Trend Rider: speed stacks on hit
  | 'readinput' // Debug Mode: shows the opponent's input + auto-block
  | 'regen'; // heal over time (amount = total hp)

export interface BuffSpec {
  kind: BuffKind;
  amount: number;
  frames: number;
}

interface Common {
  /** short label shown when the move fires (defaults to the special's name) */
  shout?: string;
  /** hex colour for this move's effects (defaults to fighter accent) */
  color?: number;
  /** damage scales up with the user's missing health (Raw Energy, Almost Famous, Second Chance) */
  lowHp?: boolean;
  /** CPU hint: when to use it */
  ai?: 'far' | 'mid' | 'close' | 'antiair' | 'any' | 'defense' | 'buff';
}

export interface ProjectileSpec extends Common {
  mech: 'projectile';
  art: string;
  startup: number;
  recovery: number;
  damage: number;
  speed: number;
  shots?: number;
  interval?: number;
  hits?: number;
  hitEvery?: number;
  vy?: number;
  gravity?: number;
  life?: number;
  /** homing turn rate toward the opponent (0..1) */
  track?: number;
  bounceFloor?: number;
  bounceWall?: number;
  /** spawn height above the feet */
  y?: number;
  scale?: number;
  spin?: number;
  /** hits low */
  low?: boolean;
  /** walks along the ground (summons) */
  ground?: boolean;
  /** user advances while firing (px/frame) */
  advance?: number;
  /** random vertical spread of shots */
  spreadY?: number;
  /** apply a status on hit */
  status?: { kind: StatusKind; frames: number };
  /** Meme Magic: each shot rolls a random effect */
  randomEffect?: boolean;
  /** hitbox radius */
  radius?: number;
  knockdown?: boolean;
}

export interface DropSpec extends Common {
  mech: 'drop';
  art: string;
  startup: number;
  recovery: number;
  damage: number;
  count: number;
  interval: number;
  spread: number;
  scale?: number;
  fallSpeed?: number;
  knockdown?: boolean;
  radius?: number;
  /** how long the warning marker shows before the drop */
  warn?: number;
}

export interface RushSpec extends Common {
  mech: 'rush';
  startup: number;
  speed: number;
  frames: number;
  recovery: number;
  damage: number;
  hits?: number;
  hitEvery?: number;
  /** passes through the opponent */
  pass?: boolean;
  invuln?: 'projectile' | 'full';
  /** max frames of charge (hold the button) */
  charge?: number;
  afterimage?: boolean;
  type?: HitType;
  launcher?: boolean;
  knockdown?: boolean;
  wallBounce?: boolean;
  /** move back for N frames first (fake retreat) */
  retreat?: number;
  /** turns into a grab on contact */
  grab?: { damage: number; banner?: string };
  trail?: string;
  box?: Box;
  anim?: AnimKey;
  /** ends in a teleport behind the opponent if the button is pressed again */
  teleportCancel?: boolean;
  /** also hits as an anti-air hop */
  hop?: boolean;
}

export interface TeleportSpec extends Common {
  mech: 'teleport';
  startup: number;
  vanish: number;
  dest: 'behind' | 'front' | 'above';
  recovery: number;
  attack?: { damage: number; type: HitType; box: Box; active: number; anim: AnimKey; knockdown?: boolean };
  slash?: boolean;
}

export interface DecoySpec extends Common {
  mech: 'decoy';
  startup: number;
  distance: number;
  recovery: number;
  decoyLife: number;
  /** teleport behind the opponent instead of backdashing */
  teleport?: boolean;
  /** decoy explodes for damage if touched / when it expires near the opponent */
  decoyDamage?: number;
  invuln: number;
  /** the clone walks toward the opponent at this speed and explodes on contact */
  walk?: number;
}

export interface GrabSpec extends Common {
  mech: 'grab';
  startup: number;
  range: number;
  recovery: number;
  damage: number;
  heal?: number;
  banner?: string;
  run?: { speed: number; frames: number; invuln: boolean };
  art?: string;
}

export interface CounterSpec extends Common {
  mech: 'counter';
  startup: number;
  window: number;
  recovery: number;
  damage: number;
  effect: 'freeze' | 'launch' | 'knockdown' | 'combo';
  popup?: string;
  popupColor?: number;
  freeze?: number;
  projectiles?: boolean;
}

export interface BuffMoveSpec extends Common {
  mech: 'buff';
  startup: number;
  recovery: number;
  buffs: BuffSpec[];
  heal?: number;
  purgeSelf?: boolean;
  /** stays in a stance (can't attack) for this many frames */
  stance?: number;
  art?: string;
}

export interface StrikeSpec extends Common {
  mech: 'strike';
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  type: HitType;
  box: Box;
  anim: AnimKey;
  hits?: number;
  hitEvery?: number;
  launcher?: boolean;
  wallBounce?: boolean;
  knockdown?: boolean;
  lunge?: number;
  charge?: number;
  unblockableCharged?: boolean;
  ignoreArmor?: boolean;
  /** pulls an airborne opponent down (anti-air) */
  pull?: boolean;
  /** heals the user by a fraction of damage dealt */
  steal?: number;
  /** armor during startup */
  armor?: boolean;
  /** stuns longer on counter-hit */
  counterStun?: number;
  /** ends high or low at random */
  mixup?: boolean;
  art?: string;
  /** hop forward into the air during the move */
  hop?: number;
  /** freezes the target for N frames on hit */
  freeze?: number;
}

export interface StatusMoveSpec extends Common {
  mech: 'status';
  startup: number;
  recovery: number;
  status: StatusKind;
  frames: number;
  delivery: 'projectile' | 'wave';
  damage?: number;
  art?: string;
  speed?: number;
}

export interface StringSpec extends Common {
  mech: 'string';
  startup: number;
  hits: number;
  interval: number;
  damage: number;
  advance: number;
  recovery: number;
  ender: 'cash' | 'launch' | 'highlow' | 'knockdown' | 'heavy';
  enderDamage: number;
  speedup?: boolean;
  art?: string;
  /** hit type of the first hit (e.g. 'low' for Dip & Rip) */
  opener?: HitType;
}

export interface RandomSpec extends Common {
  mech: 'random';
  options: SpecialSpec[];
  labels: string[];
}

export interface SuperSpec extends Common {
  mech: 'super';
  cost: number;
  damage: number;
}

export interface TrapSpec extends Common {
  mech: 'trap';
  startup: number;
  recovery: number;
  distance: number;
  life: number;
  damage: number;
  stun: number;
  art: string;
}

export interface MobilitySpec extends Common {
  mech: 'mobility';
  kind: 'airRedirect' | 'hop';
  startup: number;
  recovery: number;
  invuln: number;
  /** the dive at the end hits for this much */
  damage?: number;
}

export type SpecialSpec =
  | ProjectileSpec
  | DropSpec
  | RushSpec
  | TeleportSpec
  | DecoySpec
  | GrabSpec
  | CounterSpec
  | BuffMoveSpec
  | StrikeSpec
  | StatusMoveSpec
  | StringSpec
  | RandomSpec
  | SuperSpec
  | TrapSpec
  | MobilitySpec;

export type FighterMoves = [SpecialSpec, SpecialSpec, SpecialSpec];
