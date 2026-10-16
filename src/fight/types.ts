import type Phaser from 'phaser';
import type { Box, HitType } from '../data/normals';
import type { Fighter } from './Fighter';
import type { Effects } from './Effects';
import type { Sfx } from '../audio/Sfx';

export interface HitProps {
  damage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  type: HitType;
  special: boolean;
  projectile: boolean;
  heavy?: boolean;
  launcher?: boolean;
  knockdown?: boolean;
  wallBounce?: boolean;
  ignoreArmor?: boolean;
  /** pull an airborne target to the ground */
  pull?: boolean;
  /** freeze target for N frames */
  freeze?: number;
  /** heal attacker by this fraction of damage */
  steal?: number;
  /** extra hitstun on counter-hit */
  counterStun?: number;
  /** chip damage multiplier on block (specials only) */
  chip?: number;
  color?: number;
  /** skip combo scaling (supers, grabs) */
  noScale?: boolean;
  /** this hit ignores low-health and buffs (fixed damage) */
  fixed?: boolean;
}

export interface HitInfo extends HitProps {
  attacker: Fighter;
  /** where to draw the spark */
  x: number;
  y: number;
  /** direction the victim is pushed (+1 = right) */
  dir: number;
}

export type HitResult = 'hit' | 'block' | 'armor' | 'whiff' | 'countered';

export interface ActiveHit {
  /** hits with the same id only connect once */
  id: number;
  box: Box;
  props: HitProps;
}

export interface Entity {
  owner: Fighter;
  dead: boolean;
  /** projectiles clash with other projectiles */
  clashes: boolean;
  /** for one-projectile-at-a-time rule */
  limitsProjectiles?: boolean;
  update(world: World): void;
  /** world-space hitbox, or null when not hitting this frame */
  hitbox(): { x: number; y: number; w: number; h: number } | null;
  props(): HitProps;
  hitId(): number;
  onConnect?(result: HitResult, victim: Fighter, world: World): void;
  onClash?(world: World): void;
  destroy(): void;
}

export interface World {
  phaser: Phaser.Scene;
  fx: Effects;
  sfx: Sfx;
  frame: number;
  training: boolean;
  entities: Entity[];
  addEntity(e: Entity): void;
  hitstop(frames: number): void;
  shake(intensity: number, ms: number): void;
  /** small on-screen callout above a fighter, e.g. "COUNTER" */
  callout(f: Fighter, text: string, color?: number): void;
  onHitLanded(attacker: Fighter, victim: Fighter, damage: number, result: HitResult): void;
  left: number;
  right: number;
  groundY: number;
  nextHitId(): number;
}
