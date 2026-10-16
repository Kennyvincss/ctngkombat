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
  /** the intro plays once per visit (and from WATCH INTRO on the title screen) */
  introPlayed: false,
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

const CONTROLS_KEY = 'trenches.controls';

export type MoveMode = 'analog' | 'arrows';
/** a touch control's saved place: fractions of the screen, and a size multiplier */
export interface StoredSpot {
  fx: number;
  fy: number;
  s: number;
}

function loadControls(): { move: MoveMode; layout: Record<string, StoredSpot> } {
  try {
    const raw = JSON.parse(localStorage.getItem(CONTROLS_KEY) ?? '{}');
    const layout: Record<string, StoredSpot> = {};
    for (const [k, v] of Object.entries(raw.layout ?? {})) {
      const o = v as StoredSpot;
      if ([o.fx, o.fy, o.s].every((n) => typeof n === 'number' && isFinite(n))) layout[k] = o;
    }
    return { move: raw.move === 'arrows' ? 'arrows' : 'analog', layout };
  } catch {
    return { move: 'analog', layout: {} };
  }
}

const controls = loadControls();

export const settings = {
  /** touch joystick sensitivity, 1 (needs a big push) to 5 (reacts to a small nudge) */
  stick: loadStick(),
  /** touch movement: analog stick or arrow buttons */
  move: controls.move,
  /** touch controls the player moved or resized (missing = default place) */
  layout: controls.layout,
};

export function saveControls() {
  try {
    localStorage.setItem(CONTROLS_KEY, JSON.stringify({ move: settings.move, layout: settings.layout }));
  } catch {
    /* storage unavailable: setting just won't persist */
  }
}

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
