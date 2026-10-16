import type { FighterData, MatchSetup } from './data/types';

/** Game-wide state shared between scenes. */
export const game = {
  roster: [] as FighterData[],
  /** Phase B sprite poses per fighter, from assets/sprites/manifest.json (optional) */
  sprites: {} as Record<string, string[]>,
  /** fighters that have a skeletal rig in assets/rigs/ */
  rigs: [] as string[],
  lastSetup: null as MatchSetup | null,
  isTouch: false,
};

export function fighterById(id: string): FighterData {
  const f = game.roster.find((r) => r.id === id);
  if (!f) throw new Error(`Unknown fighter ${id}`);
  return f;
}

export function detectTouch(): boolean {
  try {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
