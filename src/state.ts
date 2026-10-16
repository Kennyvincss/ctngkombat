import type { SpriteSet } from './fight/FighterView';
import type { FighterData, MatchSetup } from './data/types';

/** Game-wide state shared between scenes. */
export const game = {
  roster: [] as FighterData[],
  /** Phase B pose atlases per fighter, from assets/sprites/manifest.json (optional) */
  sprites: {} as Record<string, SpriteSet>,
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

// ---------------------------------------------------------------- player settings (kept on this device)

const STICK_KEY = 'trenches.stick';
export const STICK_LEVELS = 5;

function loadStick(): number {
  try {
    const v = Number(localStorage.getItem(STICK_KEY));
    return v >= 1 && v <= STICK_LEVELS ? v : 3;
  } catch {
    return 3;
  }
}

export const settings = {
  /** touch joystick sensitivity, 1 (needs a big push) to 5 (reacts to a small nudge) */
  stick: loadStick(),
};

export function setStickSensitivity(level: number) {
  settings.stick = Math.min(STICK_LEVELS, Math.max(1, Math.round(level)));
  try {
    localStorage.setItem(STICK_KEY, String(settings.stick));
  } catch {
    /* storage unavailable: setting just won't persist */
  }
}

/** how far (design px) the thumb must move before the stick counts as pushed */
export function stickDeadzone(): number {
  return [42, 33, 25, 18, 12][settings.stick - 1];
}
