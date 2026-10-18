import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY } from '../config';
import type { FighterData, FightClass } from '../data/types';
import type { SpecialSpec } from '../data/moveTypes';
import { MOVES } from '../data/moves';
import { lineUp } from '../data/lineup';
import { setTuning } from '../data/tuning';
import { FINISHERS, setFinisher } from '../fight/fatalities';
import { game, setCustomDataMaker } from '../state';
import { buildRig, madeBody, segment, validJoints, type Joints } from './autoRig';

// Fighters made by players (CREATE FIGHTER on the mode menu). Each is kept on the player's device
// (localStorage) and plays like any other fighter: the uploaded picture is the in-game cut-out,
// a card and a select-screen thumbnail are drawn from it, and the style, specials and finisher come
// from the pools below. Online, both players' fighters are swapped when the match connects.

export interface CustomFighter {
  id: string;
  name: string;
  /** X handle without the @, may be empty */
  handle: string;
  style: FightClass;
  /** three indices into SPECIALS */
  moves: [number, number, number];
  finisher: number;
  accent: number;
  /** the in-game cut-out (data URL) */
  art: string;
  /** the original picture, scaled down (data URL; only on the maker's device, for re-cutting) */
  photo?: string;
  /** how the background was removed */
  cut?: 'soft' | 'strong' | 'off';
  /**
   * how they move: 'drawn' puts the picture on a drawn fighter's body, 'own' moves the picture's
   * own arms and legs (joints placed by the player), 'classic' (or missing) moves it as one piece
   */
  body?: BodyKind;
  /** where the joints are on the picture (for 'own') */
  joints?: Joints;
  /** the picture was mirrored to face right (re-cutting the original picture mirrors it again) */
  flip?: boolean;
}

export type BodyKind = 'drawn' | 'own' | 'classic';
export const BODIES: BodyKind[] = ['drawn', 'own', 'classic'];

export const MAX_CUSTOM = 6;
const KEY = 'trenches.customFighters';

export const STYLES: { key: FightClass; label: string; blurb: string; row: [number, number, number]; kit: [number, number, number] }[] = [
  { key: 'balanced', label: 'ALL-ROUNDER', blurb: 'Good at everything. A safe first pick.', row: [1000, 4.0, 1.0], kit: [12, 13, 14] },
  { key: 'rushdown', label: 'RUSHDOWN', blurb: 'Fast and in your face. Less health.', row: [960, 4.4, 1.05], kit: [0, 1, 2] },
  { key: 'powerhouse', label: 'POWERHOUSE', blurb: 'Slow, tanky, hits like a truck.', row: [1100, 3.3, 1.15], kit: [3, 4, 5] },
  { key: 'trickster', label: 'TRICKSTER', blurb: 'Teleports, decoys and mind games.', row: [920, 4.5, 0.95], kit: [6, 7, 8] },
  { key: 'zoner', label: 'ZONER', blurb: 'Fills the screen with projectiles.', row: [960, 3.7, 1.0], kit: [9, 10, 11] },
  { key: 'defensive', label: 'DEFENSIVE', blurb: 'Counters, armour and healing.', row: [1060, 3.6, 1.0], kit: [15, 16, 17] },
];

/** every special a made fighter can have: one of the shared mechanics, configured */
export const SPECIALS: { name: string; description: string; spec: SpecialSpec }[] = [
  // rushdown
  { name: 'Dash Strike', description: 'Dashes forward through the opponent.', spec: { mech: 'rush', startup: 5, speed: 18, frames: 14, recovery: 14, damage: 85, pass: true, afterimage: true, ai: 'mid' } },
  { name: 'Flurry', description: 'A fast chain of punches that ends in a launcher.', spec: { mech: 'string', startup: 5, hits: 4, interval: 6, damage: 18, advance: 4, recovery: 18, ender: 'launch', enderDamage: 60, ai: 'close' } },
  { name: 'Rising Uppercut', description: 'An uppercut that knocks jumpers out of the air.', spec: { mech: 'strike', startup: 5, active: 6, recovery: 22, damage: 100, type: 'mid', box: { x: -10, y: -440, w: 150, h: 320 }, anim: 'uppercut', launcher: true, pull: true, ai: 'antiair' } },
  // powerhouse
  { name: 'Shoulder Charge', description: 'Charges forward with armour and knocks down.', spec: { mech: 'rush', startup: 10, speed: 14, frames: 18, recovery: 20, damage: 120, invuln: 'projectile', knockdown: true, wallBounce: true, ai: 'mid' } },
  { name: 'Power Slam', description: 'Grabs the opponent and slams them into the floor.', spec: { mech: 'grab', startup: 6, range: 150, recovery: 28, damage: 190, banner: 'SLAMMED', ai: 'close' } },
  { name: 'Ground Pound', description: 'Smashes the ground: a low hit with armour.', spec: { mech: 'strike', startup: 16, active: 6, recovery: 24, damage: 125, type: 'low', box: { x: 0, y: -80, w: 220, h: 80 }, anim: 'overhead', knockdown: true, armor: true, ai: 'close' } },
  // trickster
  { name: 'Shadow Step', description: 'Vanishes and strikes from behind.', spec: { mech: 'teleport', startup: 6, vanish: 12, dest: 'behind', recovery: 14, attack: { damage: 70, type: 'mid', box: { x: 0, y: -260, w: 150, h: 240 }, active: 4, anim: 'heavy' }, ai: 'mid' } },
  { name: 'Decoy', description: 'Leaves a fake copy behind and slips away.', spec: { mech: 'decoy', startup: 3, distance: 230, recovery: 8, decoyLife: 70, decoyDamage: 60, invuln: 14, ai: 'defense' } },
  { name: 'Dive Bomb', description: 'Leaps up and dives down at an angle.', spec: { mech: 'mobility', kind: 'airRedirect', startup: 6, recovery: 14, invuln: 10, damage: 80, ai: 'mid' } },
  // zoner
  { name: 'Energy Ball', description: 'Fires a ball of energy.', spec: { mech: 'projectile', art: 'callorb', startup: 12, recovery: 18, damage: 75, speed: 10, scale: 1.1, ai: 'far' } },
  { name: 'Homing Orb', description: 'A slow orb that follows the opponent and hits three times.', spec: { mech: 'projectile', art: 'shadoworb', startup: 16, recovery: 24, damage: 85, speed: 4.5, hits: 3, hitEvery: 10, track: 0.8, life: 240, scale: 1.1, radius: 30, ai: 'far' } },
  { name: 'Meteor Shower', description: 'Rocks rain down on the opponent.', spec: { mech: 'drop', art: 'gem', startup: 16, recovery: 22, damage: 30, count: 4, interval: 6, spread: 260, ai: 'far' } },
  // all-rounder
  { name: 'Fireball', description: 'Throws a ball of fire.', spec: { mech: 'projectile', art: 'flame', startup: 12, recovery: 18, damage: 70, speed: 10, scale: 1.2, ai: 'far' } },
  { name: 'Spin Kick', description: 'A spinning kick that hits several times.', spec: { mech: 'strike', startup: 7, active: 12, recovery: 20, damage: 90, type: 'mid', box: { x: 0, y: -280, w: 180, h: 200 }, anim: 'kick', hits: 3, hitEvery: 4, ai: 'close' } },
  { name: 'Counter', description: 'Catches an attack and knocks the opponent down.', spec: { mech: 'counter', startup: 3, window: 26, recovery: 24, damage: 90, effect: 'knockdown', popup: 'COUNTER', ai: 'defense' } },
  // defensive
  { name: 'Iron Wall', description: 'Armour up: shrugs off a few hits.', spec: { mech: 'buff', startup: 6, recovery: 8, buffs: [{ kind: 'armor', amount: 3, frames: 300 }], art: 'shield', ai: 'buff' } },
  { name: 'Second Wind', description: 'Heals over a few seconds.', spec: { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'regen', amount: 120, frames: 360 }], art: 'heart', ai: 'buff' } },
  { name: 'Parry', description: 'Catches attacks and projectiles and launches the opponent.', spec: { mech: 'counter', startup: 3, window: 24, recovery: 24, damage: 80, effect: 'launch', projectiles: true, popup: 'PARRY', ai: 'defense' } },
  // extras for any style
  { name: 'Lightning Call', description: 'A bolt of lightning strikes the opponent.', spec: { mech: 'drop', art: 'lightning', startup: 14, recovery: 20, damage: 100, count: 1, interval: 0, spread: 0, fallSpeed: 40, warn: 18, knockdown: true, ai: 'far' } },
  { name: 'Ice Shard', description: 'A shard of ice that freezes on hit.', spec: { mech: 'projectile', art: 'ice', startup: 12, recovery: 18, damage: 60, speed: 11, status: { kind: 'freeze', frames: 40 }, ai: 'far' } },
  { name: 'Snare', description: 'Sets a trap on the floor that stuns.', spec: { mech: 'trap', startup: 12, recovery: 16, distance: 260, life: 420, damage: 90, stun: 40, art: 'trap', ai: 'far' } },
  { name: 'Power Up', description: 'Faster and stronger for a few seconds.', spec: { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'speed', amount: 20, frames: 300 }, { kind: 'damage', amount: 15, frames: 300 }], art: 'bolt', ai: 'buff' } },
  { name: 'Candle Rain', description: 'Green candles fall from the sky.', spec: { mech: 'drop', art: 'candleG', startup: 16, recovery: 22, damage: 28, count: 5, interval: 6, spread: 280, ai: 'far' } },
];

export const styleOf = (key: FightClass) => STYLES.find((s) => s.key === key) ?? STYLES[0];

// ---------------------------------------------------------------- storage (this device)

export function loadCustoms(): CustomFighter[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(valid).slice(0, MAX_CUSTOM) : [];
  } catch {
    return [];
  }
}

/** save the list; false when the device is out of storage space */
export function saveCustoms(list: CustomFighter[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** a fighter received from the other player (or read from storage) has sane values */
export function valid(c: unknown): c is CustomFighter {
  const f = c as CustomFighter;
  return (
    !!f &&
    typeof f.id === 'string' &&
    /^my-[a-z0-9]{4,16}$/.test(f.id) &&
    typeof f.name === 'string' &&
    f.name.length > 0 &&
    f.name.length <= 16 &&
    typeof f.handle === 'string' &&
    f.handle.length <= 20 &&
    STYLES.some((s) => s.key === f.style) &&
    Array.isArray(f.moves) &&
    f.moves.length === 3 &&
    f.moves.every((m) => Number.isInteger(m) && m >= 0 && m < SPECIALS.length) &&
    Number.isInteger(f.finisher) &&
    f.finisher >= 0 &&
    f.finisher < FINISHERS.length &&
    Number.isInteger(f.accent) &&
    typeof f.art === 'string' &&
    f.art.startsWith('data:image/') &&
    f.art.length < 600_000 &&
    (f.body === undefined || BODIES.includes(f.body)) &&
    (f.body !== 'own' || validJoints(f.joints))
  );
}

export function newId() {
  return 'my-' + Math.random().toString(36).slice(2, 10);
}

/** what goes over the network to the other player: no original photo */
export function forNetwork(f: CustomFighter): CustomFighter {
  const { photo: _photo, ...rest } = f;
  return rest;
}

// ---------------------------------------------------------------- making it playable

setCustomDataMaker((f, order) => fighterData(f, order));

export function fighterData(f: CustomFighter, order: number): FighterData {
  const fin = FINISHERS[f.finisher] ?? FINISHERS[0];
  return {
    id: f.id,
    order,
    name: f.name,
    handle: f.handle ? '@' + f.handle : null,
    cardNameplate: f.name.toUpperCase(),
    archetype: `Player-made / ${styleOf(f.style).label.toLowerCase().replace(/^./, (c) => c.toUpperCase())}`,
    playstyle: styleOf(f.style).blurb,
    specials: f.moves.map((m) => ({ name: SPECIALS[m].name, description: SPECIALS[m].description })),
    fatality: `${fin.name}: ${fin.description}`,
    card: '',
    custom: true,
  };
}

/** register a fighter's gameplay data and textures; resolves when its picture is ready */
export async function register(scene: Phaser.Scene, f: CustomFighter): Promise<void> {
  const st = styleOf(f.style);
  setTuning(f.id, [f.style, st.row[0], st.row[1], st.row[2], true, f.accent, 'Made in the trenches.']);
  MOVES[f.id] = f.moves.map((m) => SPECIALS[m].spec) as [SpecialSpec, SpecialSpec, SpecialSpec];
  setFinisher(f.id, f.finisher);
  const art = await imageFrom(f.art);
  const tex = scene.textures;
  for (const k of [`fighter-${f.id}`, `card-${f.id}`, `thumb-${f.id}`, `rig-${f.id}`]) if (tex.exists(k)) tex.remove(k);
  const cut = document.createElement('canvas');
  cut.width = art.width;
  cut.height = art.height;
  cut.getContext('2d')!.drawImage(art, 0, 0);
  // on a drawn body, the whole figure is what the card, thumbnail and effects show
  const figure = f.body === 'drawn' ? madeBody(cut, f.accent).art : cut;
  tex.addCanvas(`fighter-${f.id}`, figure);
  tex.addCanvas(`card-${f.id}`, drawCard(figure, f.name, f.accent));
  tex.addCanvas(`thumb-${f.id}`, drawThumb(figure, f.accent));
  pictures.set(f.id, { f, cut });
}

/** made fighters' cut-outs, for building their rigs when they first fight */
const pictures = new Map<string, { f: CustomFighter; cut: HTMLCanvasElement }>();

/**
 * Make sure a made fighter with moving limbs has its rig (texture `rig-<id>` and json `rig-<id>`).
 * Built the first time they fight (cutting a picture into limbs takes a moment). False when the
 * fighter moves as one piece, or the rig can't be drawn (no WebGL).
 */
export function ensureRig(scene: Phaser.Scene, id: string): boolean {
  const p = pictures.get(id);
  if (!p || !p.f.body || p.f.body === 'classic' || scene.game.renderer.type !== Phaser.WEBGL) return false;
  if (scene.textures.exists(`rig-${id}`) && scene.cache.json.exists(`rig-${id}`)) return true;
  try {
    const made = p.f.body === 'drawn' ? madeBody(p.cut, p.f.accent) : null;
    const { rig, atlas } = made ? buildRig(made.layers, made.joints) : buildRig(segment(p.cut, p.f.joints!), p.f.joints!);
    if (scene.cache.json.exists(`rig-${id}`)) scene.cache.json.remove(`rig-${id}`);
    scene.cache.json.add(`rig-${id}`, rig);
    scene.textures.addCanvas(`rig-${id}`, atlas);
    return true;
  } catch (e) {
    console.warn('rig failed for', id, e);
    return false;
  }
}

function imageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('bad fighter picture'));
    img.src = src;
  });
}

/** the fighters this mode's select screen offers: the cast, then made fighters */
export function selectable(online = false, side: 0 | 1 = 0): FighterData[] {
  const made = online ? (side === 0 ? [...game.customs, ...game.remoteCustoms] : [...game.remoteCustoms, ...game.customs]) : game.customs;
  const seen = new Set<string>();
  const extra = made.filter((f) => !seen.has(f.id) && seen.add(f.id)).map((f, i) => fighterData(f, 1000 + i));
  return [...lineUp(game.roster), ...extra];
}

// ---------------------------------------------------------------- card and thumbnail

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** a 480×720 card in the cast's style: gold frame, the fighter in their colour, a nameplate */
export function drawCard(art: CanvasImageSource & { width: number; height: number }, name: string, accent: number): HTMLCanvasElement {
  const W = 480;
  const H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  // background: dark, the fighter's colour glowing behind them
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07060a');
  bg.addColorStop(1, '#1a0d06');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, 330);
  glow.addColorStop(0, hex(accent) + 'aa');
  glow.addColorStop(1, hex(accent) + '00');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);
  // sparks
  x.fillStyle = hex(accent);
  for (let i = 0; i < 40; i++) {
    const r = ((i * 9301 + 49297) % 233280) / 233280;
    const r2 = ((i * 4271 + 1033) % 9973) / 9973;
    x.globalAlpha = 0.25 + r2 * 0.5;
    x.fillRect(30 + r * (W - 60), 40 + r2 * (H - 200), 3, 3);
  }
  x.globalAlpha = 1;
  // the fighter, as big as fits above the nameplate
  const boxW = W - 70;
  const boxH = H - 190;
  const s = Math.min(boxW / art.width, boxH / art.height);
  const dw = art.width * s;
  const dh = art.height * s;
  x.shadowColor = hex(accent);
  x.shadowBlur = 24;
  x.drawImage(art, (W - dw) / 2, 40 + boxH - dh, dw, dh);
  x.shadowBlur = 0;
  // gold frame
  const gold = x.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#fff1b8');
  gold.addColorStop(0.5, '#d49a22');
  gold.addColorStop(1, '#fff1b8');
  x.strokeStyle = gold;
  x.lineWidth = 14;
  x.strokeRect(9, 9, W - 18, H - 18);
  x.strokeStyle = '#2a1a05';
  x.lineWidth = 3;
  x.strokeRect(20, 20, W - 40, H - 40);
  // nameplate
  const ny = H - 108;
  x.fillStyle = '#0b0705';
  x.beginPath();
  x.moveTo(44, ny + 34);
  x.lineTo(70, ny);
  x.lineTo(W - 70, ny);
  x.lineTo(W - 44, ny + 34);
  x.lineTo(W - 70, ny + 68);
  x.lineTo(70, ny + 68);
  x.closePath();
  x.fill();
  x.strokeStyle = gold;
  x.lineWidth = 4;
  x.stroke();
  // crown
  x.fillStyle = gold;
  x.beginPath();
  x.moveTo(W / 2 - 22, ny - 4);
  x.lineTo(W / 2 - 22, ny - 22);
  x.lineTo(W / 2 - 11, ny - 12);
  x.lineTo(W / 2, ny - 28);
  x.lineTo(W / 2 + 11, ny - 12);
  x.lineTo(W / 2 + 22, ny - 22);
  x.lineTo(W / 2 + 22, ny - 4);
  x.closePath();
  x.fill();
  let size = 44;
  x.font = `${size}px ${FONT_DISPLAY}`;
  const label = name.toUpperCase();
  while (x.measureText(label).width > W - 160 && size > 20) x.font = `${--size}px ${FONT_DISPLAY}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = gold;
  x.fillText(label, W / 2, ny + 36);
  // small "made by a player" mark
  x.font = `16px ${FONT_BODY}`;
  x.fillStyle = '#a89f88';
  x.fillText('CREATED IN TRENCHES KOMBAT', W / 2, H - 22);
  return c;
}

/** a 160×160 head-and-shoulders thumbnail */
export function drawThumb(art: CanvasImageSource & { width: number; height: number }, accent: number): HTMLCanvasElement {
  const T = 160;
  const c = document.createElement('canvas');
  c.width = T;
  c.height = T;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(T / 2, T / 2, 10, T / 2, T / 2, T * 0.75);
  g.addColorStop(0, hex(accent));
  g.addColorStop(1, '#0a0705');
  x.fillStyle = g;
  x.fillRect(0, 0, T, T);
  // the top of the figure: a square as wide as the figure (at most 70% of its height)
  const side = Math.min(art.width, art.height * 0.7);
  x.drawImage(art, (art.width - side) / 2, 0, side, side, 0, 0, T, T);
  return c;
}
