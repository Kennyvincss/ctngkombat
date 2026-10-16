// Shapes of the data files. fighters.json is the source of truth for roster text;
// tuning.ts, moves.ts and fatalities.ts add gameplay data keyed by fighter id.

export interface SpecialText {
  name: string;
  description: string;
}

export interface FighterData {
  id: string;
  order: number;
  name: string;
  handle: string | null;
  cardNameplate: string;
  archetype: string;
  playstyle?: string;
  specials: SpecialText[];
  fatality: string;
  card: string;
}

export type GameMode = 'cpu' | 'versus' | 'training' | 'online';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface MatchSetup {
  mode: GameMode;
  difficulty: Difficulty;
  p1: string;
  p2: string;
  stage?: string;
  /** online: shared random seed and match number (both players use the same) */
  seed?: number;
  match?: number;
  /** intro showcase: scripted fighter vs a shadow sparring partner, no HUD */
  showcase?: boolean;
}

/** How a fighter's CPU plays and how its stats lean. */
export type FightClass = 'zoner' | 'rushdown' | 'defensive' | 'balanced' | 'trickster' | 'powerhouse';

export interface FighterTuning {
  cls: FightClass;
  health: number;
  walk: number; // px per frame
  damage: number; // multiplier on normals
  /** true if the art faces right on the card */
  artFacesRight: boolean;
  accent: number;
  quote: string;
}
