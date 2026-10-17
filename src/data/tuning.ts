import type { FighterTuning } from './types';

// Per-fighter tuning. Archetypes keep their identity: powerhouses are slower with
// more health and harder normals, tricksters are faster with less health.
// accent: the dominant glow colour of the card. artFacesRight: which way the card art faces.

type Row = [cls: FighterTuning['cls'], health: number, walk: number, damage: number, artFacesRight: boolean, accent: number, quote: string];

const T: Record<string, Row> = {
  'promise-sol': ['trickster', 900, 4.4, 0.95, false, 0xff2d55, 'Like, RT and follow for a chance to win. You did not win.'],
  onepeterr: ['powerhouse', 1100, 3.4, 1.15, false, 0x2f8bff, 'Congratulations. You have been selected... as the loser.'],
  arlecchino: ['zoner', 940, 3.6, 0.95, false, 0xc4182f, 'Segmentation fault: opponent not found.'],
  skroot: ['rushdown', 980, 4.4, 1.0, false, 0xff8a1f, 'Skrrt. You blinked.'],
  mystayor: ['trickster', 940, 4.2, 0.95, false, 0x6fa8ff, "The future was written. You just couldn't read it."],
  evansofweb3: ['balanced', 1000, 4.0, 1.0, false, 0xd94bff, 'Welcome to Web3. Now get out.'],
};

/** everyone moves this much faster than the walk speeds in the table (relative speeds stay) */
const WALK_SCALE = 1.3;

export function tuningFor(id: string): FighterTuning {
  const r = T[id] ?? ['balanced', 1000, 3.8, 1, true, 0xf5c542, 'Victory.'];
  return { cls: r[0], health: r[1], walk: r[2] * WALK_SCALE, damage: r[3], artFacesRight: r[4], accent: r[5], quote: r[6] };
}

export const CPU_SETTINGS = {
  easy: { react: 22, blockChance: 0.15, specialChance: 0.008, aggression: 0.35, punish: false, antiAir: 0.1 },
  normal: { react: 12, blockChance: 0.45, specialChance: 0.018, aggression: 0.55, punish: false, antiAir: 0.35 },
  hard: { react: 6, blockChance: 0.75, specialChance: 0.03, aggression: 0.7, punish: true, antiAir: 0.7 },
};
