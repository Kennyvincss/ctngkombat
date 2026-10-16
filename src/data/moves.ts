import type { FighterMoves } from './moveTypes';

// Every fighter's three specials, in the same order as fighters.json.
// Each one is a configuration of a shared mechanic (see moveTypes.ts / mechanics.ts).
// Damage is total HP for the move (1000 HP is a normal fighter). Caps are enforced in code:
// 180 for specials, 220 for command grabs, 350 for supers.

export const MOVES: Record<string, FighterMoves> = {
  'promise-sol': [
    { mech: 'rush', startup: 6, speed: 17, frames: 16, recovery: 14, damage: 85, pass: true, afterimage: true, trail: 'dollar', shout: '$TRILLION FLEX', ai: 'mid' },
    { mech: 'projectile', art: 'solcoin', startup: 12, recovery: 18, damage: 18, speed: 12, shots: 5, interval: 5, spreadY: 90, spin: 0.3, scale: 0.9, ai: 'far' },
    { mech: 'decoy', startup: 3, distance: 230, recovery: 8, decoyLife: 70, decoyDamage: 60, invuln: 14, ai: 'defense' },
  ],
  onepeterr: [
    { mech: 'grab', startup: 6, range: 150, recovery: 28, damage: 180, heal: 60, banner: 'WINNER', art: 'cash', ai: 'close' },
    { mech: 'strike', startup: 14, active: 5, recovery: 24, damage: 120, type: 'overhead', box: { x: 0, y: -320, w: 170, h: 320 }, anim: 'overhead', charge: 60, unblockableCharged: true, knockdown: true, lunge: 3, art: 'candleG', ai: 'close' },
    { mech: 'drop', art: 'wallet', startup: 16, recovery: 22, damage: 32, count: 4, interval: 6, spread: 260, scale: 1.1, knockdown: false, ai: 'far' },
  ],
  unscripted: [
    { mech: 'projectile', art: 'callorb', startup: 16, recovery: 26, damage: 90, speed: 5, hits: 3, hitEvery: 10, track: 0.8, life: 230, scale: 1.2, radius: 30, ai: 'far' },
    { mech: 'counter', startup: 4, window: 30, recovery: 26, damage: 130, effect: 'knockdown', popup: '+420% PnL', popupColor: 0x16c784, ai: 'defense' },
    { mech: 'rush', startup: 6, speed: 13, frames: 20, recovery: 18, damage: 80, type: 'low', teleportCancel: true, anim: 'sweep', knockdown: true, ai: 'mid' },
  ],
  'king-sol': [
    { mech: 'drop', art: 'cybertruck', startup: 20, recovery: 26, damage: 140, count: 1, interval: 0, spread: 0, scale: 1.1, knockdown: true, fallSpeed: 30, warn: 24, radius: 110, ai: 'far' },
    { mech: 'string', startup: 6, hits: 5, interval: 6, damage: 18, advance: 4, recovery: 18, ender: 'cash', enderDamage: 60, art: 'cash', ai: 'close' },
    { mech: 'buff', startup: 10, recovery: 8, buffs: [{ kind: 'armor', amount: 3, frames: 360 }, { kind: 'projinvuln', amount: 1, frames: 300 }], art: 'crown', ai: 'buff' },
  ],
  degenbro: [
    { mech: 'projectile', art: 'garri', startup: 14, recovery: 20, damage: 30, speed: 7, shots: 3, interval: 8, vy: -12, gravity: 0.6, bounceFloor: 3, bounceWall: 1, spin: 0.2, life: 260, ai: 'far' },
    { mech: 'strike', startup: 16, active: 5, recovery: 22, damage: 120, type: 'overhead', box: { x: 0, y: -310, w: 170, h: 310 }, anim: 'overhead', wallBounce: true, lunge: 4, ai: 'close' },
    { mech: 'grab', startup: 4, range: 130, recovery: 26, damage: 170, run: { speed: 12, frames: 28, invuln: true }, banner: 'RUGGED', art: 'zero', ai: 'mid' },
  ],
  juniordip: [
    { mech: 'string', startup: 4, hits: 2, interval: 7, damage: 30, advance: 6, recovery: 20, ender: 'launch', enderDamage: 60, opener: 'low', ai: 'close' },
    { mech: 'rush', startup: 8, speed: 16, frames: 18, recovery: 16, damage: 110, charge: 50, knockdown: true, afterimage: true, ai: 'mid' },
    { mech: 'projectile', art: 'promo', startup: 8, recovery: 16, damage: 14, speed: 13, shots: 6, interval: 5, advance: 3, spreadY: 60, ai: 'far' },
  ],
  bloomstar: [
    { mech: 'string', startup: 5, hits: 4, interval: 6, damage: 20, advance: 3, recovery: 18, ender: 'highlow', enderDamage: 55, art: 'star', ai: 'close' },
    { mech: 'strike', startup: 5, active: 6, recovery: 22, damage: 100, type: 'mid', box: { x: -10, y: -440, w: 150, h: 320 }, anim: 'uppercut', pull: true, art: 'star', ai: 'antiair' },
    { mech: 'counter', startup: 3, window: 26, recovery: 26, damage: 60, effect: 'freeze', freeze: 70, popup: 'ANALYZING...', popupColor: 0xffb627, ai: 'defense' },
  ],
  'samuel-xeus': [
    { mech: 'projectile', art: 'thread', startup: 14, recovery: 22, damage: 96, speed: 8, hits: 4, hitEvery: 7, scale: 1.1, radius: 32, ai: 'far' },
    { mech: 'buff', startup: 6, recovery: 6, stance: 30, buffs: [{ kind: 'damage', amount: 30, frames: 420 }], art: 'book', ai: 'buff' },
    { mech: 'projectile', art: 'bubble', startup: 16, recovery: 22, damage: 25, speed: 7, shots: 4, interval: 10, ground: true, radius: 28, life: 200, ai: 'far' },
  ],
  achillas: [
    { mech: 'strike', startup: 10, active: 4, recovery: 18, damage: 85, type: 'mid', box: { x: 30, y: -240, w: 270, h: 70 }, anim: 'heavy', counterStun: 30, art: 'lens', ai: 'mid' },
    { mech: 'trap', startup: 12, recovery: 16, distance: 260, life: 420, damage: 90, stun: 40, art: 'trap', ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'projinvuln', amount: 1, frames: 300 }], art: 'gem', ai: 'buff' },
  ],
  'dami-defi': [
    { mech: 'projectile', art: 'gem', startup: 10, recovery: 14, damage: 70, speed: 12, low: true, y: 40, ai: 'far' },
    { mech: 'teleport', startup: 8, vanish: 14, dest: 'behind', recovery: 14, attack: { damage: 60, type: 'mid', box: { x: 0, y: -260, w: 150, h: 240 }, active: 4, anim: 'heavy' }, ai: 'mid' },
    { mech: 'rush', startup: 4, retreat: 14, speed: 18, frames: 14, recovery: 16, damage: 100, knockdown: true, afterimage: true, ai: 'mid' },
  ],
  'prudent-sammy': [
    { mech: 'buff', startup: 4, recovery: 6, stance: 40, buffs: [{ kind: 'armor', amount: 4, frames: 240 }], ai: 'defense' },
    { mech: 'strike', startup: 26, active: 6, recovery: 26, damage: 170, type: 'mid', box: { x: 0, y: -290, w: 190, h: 270 }, anim: 'heavy', knockdown: true, lunge: 3, ai: 'close' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'blockheal', amount: 14, frames: 480 }], ai: 'buff' },
  ],
  udy: [
    { mech: 'rush', startup: 6, speed: 14, frames: 16, recovery: 12, damage: 75, type: 'low', anim: 'sweep', knockdown: true, ai: 'mid' },
    { mech: 'decoy', startup: 4, distance: 0, recovery: 10, decoyLife: 70, invuln: 12, teleport: true, ai: 'defense' },
    { mech: 'buff', startup: 6, recovery: 6, buffs: [{ kind: 'trend', amount: 10, frames: 480 }], ai: 'buff' },
  ],
  'crypto-hak': [
    { mech: 'strike', startup: 7, active: 4, recovery: 14, damage: 75, type: 'mid', box: { x: 30, y: -240, w: 210, h: 90 }, anim: 'heavy', lunge: 6, ai: 'mid' },
    { mech: 'string', startup: 5, hits: 6, interval: 7, damage: 16, advance: 6, recovery: 18, ender: 'heavy', enderDamage: 50, ai: 'close' },
    { mech: 'status', startup: 14, recovery: 24, status: 'drain', frames: 0, delivery: 'wave', damage: 20, art: 'dollar', ai: 'far' },
  ],
  karo: [
    { mech: 'string', startup: 5, hits: 3, interval: 7, damage: 25, advance: 5, recovery: 20, ender: 'launch', enderDamage: 55, ai: 'close' },
    { mech: 'rush', startup: 4, speed: 16, frames: 16, recovery: 14, damage: 70, invuln: 'projectile', afterimage: true, ai: 'mid' },
    { mech: 'counter', startup: 3, window: 26, recovery: 24, damage: 70, effect: 'freeze', freeze: 80, popup: 'ICE COLD', popupColor: 0x7fd3ff, ai: 'defense' },
  ],
  illusions: [
    { mech: 'decoy', startup: 8, distance: 0, recovery: 14, decoyLife: 110, decoyDamage: 70, invuln: 6, walk: 5, ai: 'mid' },
    { mech: 'teleport', startup: 8, vanish: 12, dest: 'above', recovery: 14, attack: { damage: 95, type: 'overhead', box: { x: -40, y: -220, w: 180, h: 220 }, active: 14, anim: 'overhead', knockdown: true }, ai: 'mid' },
    { mech: 'status', startup: 14, recovery: 22, status: 'reverse', frames: 240, delivery: 'projectile', damage: 20, art: 'shadoworb', color: 0xff8a2a, ai: 'far' },
  ],
  fgs: [
    { mech: 'strike', startup: 22, active: 6, recovery: 24, damage: 160, type: 'overhead', box: { x: 0, y: -320, w: 180, h: 320 }, anim: 'overhead', knockdown: true, armor: true, art: 'statement', ai: 'close' },
    { mech: 'rush', startup: 10, speed: 15, frames: 20, recovery: 18, damage: 120, charge: 60, knockdown: true, ai: 'mid' },
    { mech: 'projectile', art: 'statement', startup: 14, recovery: 22, damage: 80, speed: 11, bounceWall: 2, life: 260, ai: 'far' },
  ],
  zaya: [
    { mech: 'drop', art: 'code', startup: 14, recovery: 22, damage: 22, count: 5, interval: 5, spread: 300, ai: 'far' },
    { mech: 'status', startup: 12, recovery: 20, status: 'purge', frames: 0, delivery: 'wave', damage: 10, art: 'code', ai: 'any' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'meter', amount: 1, frames: 360 }], art: 'code', ai: 'buff' },
  ],
  senpai: [
    { mech: 'grab', startup: 6, range: 150, recovery: 28, damage: 200, banner: 'NOTICED', art: 'book', ai: 'close' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'damage', amount: 25, frames: 420 }], art: 'book', ai: 'buff' },
    { mech: 'counter', startup: 3, window: 24, recovery: 24, damage: 60, effect: 'combo', freeze: 55, popup: 'DISCIPLINE', popupColor: 0x9cff57, ai: 'defense' },
  ],
  'ugly-grm': [
    { mech: 'strike', startup: 10, active: 5, recovery: 18, damage: 100, type: 'mid', box: { x: 20, y: -260, w: 200, h: 140 }, anim: 'heavy', ignoreArmor: true, lunge: 3, ai: 'mid' },
    { mech: 'strike', startup: 14, active: 5, recovery: 22, damage: 150, type: 'mid', box: { x: 0, y: -290, w: 135, h: 290 }, anim: 'heavy', knockdown: true, lunge: 2, ai: 'close' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'damage', amount: 15, frames: 480 }, { kind: 'speed', amount: 8, frames: 480 }], lowHp: true, ai: 'buff' },
  ],
  'one-random-guy': [
    {
      mech: 'random',
      labels: ['NOTHING HAPPENED', 'SMALL W', 'JACKPOT'],
      options: [
        { mech: 'buff', startup: 10, recovery: 14, buffs: [], art: 'question' },
        { mech: 'projectile', art: 'question', startup: 10, recovery: 18, damage: 35, speed: 11 },
        { mech: 'strike', startup: 10, active: 6, recovery: 18, damage: 170, type: 'mid', box: { x: 0, y: -290, w: 180, h: 280 }, anim: 'heavy', knockdown: true, lunge: 6, art: 'star' },
      ],
      ai: 'any',
    },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'damage', amount: 20, frames: 480 }, { kind: 'armor', amount: 1, frames: 480 }], lowHp: true, ai: 'buff' },
    { mech: 'rush', startup: 4, speed: 18, frames: 14, recovery: 14, damage: 80, afterimage: true, trail: 'bubble', ai: 'mid' },
  ],
  seunn: [
    { mech: 'strike', startup: 9, active: 4, recovery: 16, damage: 85, type: 'mid', box: { x: 30, y: -230, w: 230, h: 90 }, anim: 'heavy', art: 'briefcase', ai: 'mid' },
    { mech: 'grab', startup: 6, range: 150, recovery: 28, damage: 190, banner: 'DM OPEN', art: 'phone', ai: 'close' },
    { mech: 'strike', startup: 18, active: 6, recovery: 24, damage: 165, type: 'mid', box: { x: 0, y: -290, w: 180, h: 270 }, anim: 'heavy', knockdown: true, lunge: 5, art: 'briefcase', ai: 'close' },
  ],
  echo: [
    { mech: 'projectile', art: 'echo', startup: 12, recovery: 20, damage: 70, speed: 9, vy: -7, gravity: 0.35, bounceFloor: 4, bounceWall: 2, life: 280, ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'speed', amount: 20, frames: 420 }, { kind: 'damage', amount: 15, frames: 420 }], ai: 'buff' },
    { mech: 'buff', startup: 20, recovery: 14, buffs: [], heal: 110, art: 'heart', ai: 'buff' },
  ],
  salam: [
    { mech: 'buff', startup: 8, recovery: 8, purgeSelf: true, buffs: [{ kind: 'damage', amount: 10, frames: 300 }, { kind: 'speed', amount: 10, frames: 300 }], ai: 'buff' },
    { mech: 'rush', startup: 3, speed: 17, frames: 14, recovery: 12, damage: 55, invuln: 'projectile', afterimage: true, ai: 'mid' },
    { mech: 'strike', startup: 12, active: 6, recovery: 22, damage: 105, type: 'mid', box: { x: 0, y: -290, w: 170, h: 270 }, anim: 'heavy', knockdown: true, lunge: 4, lowHp: true, ai: 'close' },
  ],
  raviel: [
    { mech: 'projectile', art: 'chip', startup: 12, recovery: 22, damage: 22, speed: 10, shots: 3, interval: 7, hits: 2, hitEvery: 6, spreadY: 110, spin: 0.4, track: 0.25, ai: 'far' },
    { mech: 'strike', startup: 12, active: 5, recovery: 20, damage: 110, type: 'mid', box: { x: 0, y: -270, w: 170, h: 250 }, anim: 'heavy', armor: true, steal: 0.5, art: 'chip', ai: 'close' },
    { mech: 'rush', startup: 18, speed: 20, frames: 18, recovery: 40, damage: 170, knockdown: true, wallBounce: true, afterimage: true, trail: 'card', ai: 'mid' },
  ],
  rex: [
    { mech: 'buff', startup: 2, recovery: 4, buffs: [{ kind: 'invuln', amount: 1, frames: 50 }], ai: 'defense' },
    { mech: 'counter', startup: 2, window: 8, recovery: 34, damage: 170, effect: 'knockdown', popup: 'DIVINE', popupColor: 0xffd76a, ai: 'defense' },
    { mech: 'strike', startup: 12, active: 6, recovery: 20, damage: 130, type: 'mid', box: { x: 0, y: -280, w: 170, h: 260 }, anim: 'heavy', knockdown: true, lunge: 9, ai: 'mid' },
  ],
  noir: [
    { mech: 'rush', startup: 4, speed: 20, frames: 13, recovery: 12, damage: 70, pass: true, afterimage: true, ai: 'mid' },
    { mech: 'counter', startup: 3, window: 20, recovery: 24, damage: 70, effect: 'combo', freeze: 50, popup: 'SKILL ISSUE', popupColor: 0xffffff, ai: 'defense' },
    { mech: 'rush', startup: 8, speed: 15, frames: 16, recovery: 16, damage: 90, type: 'low', anim: 'sweep', knockdown: true, ai: 'mid' },
  ],
  rayan: [
    { mech: 'mobility', kind: 'airRedirect', startup: 4, recovery: 10, invuln: 10, damage: 75, ai: 'mid' },
    { mech: 'strike', startup: 14, active: 6, recovery: 24, damage: 150, type: 'mid', box: { x: 0, y: -350, w: 170, h: 350 }, anim: 'uppercut', charge: 60, launcher: true, art: 'dollar', ai: 'close' },
    { mech: 'string', startup: 5, hits: 6, interval: 9, damage: 15, advance: 4, recovery: 18, ender: 'knockdown', enderDamage: 50, speedup: true, ai: 'close' },
  ],
  yoshai: [
    { mech: 'mobility', kind: 'hop', startup: 3, recovery: 8, invuln: 22, ai: 'defense' },
    { mech: 'projectile', art: 'meme', startup: 12, recovery: 20, damage: 60, speed: 10, randomEffect: true, spin: 0.15, ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'damage', amount: 20, frames: 420 }, { kind: 'speed', amount: 15, frames: 420 }], art: 'promo', ai: 'buff' },
  ],
  'crypto-baddie': [
    { mech: 'strike', startup: 5, active: 6, recovery: 22, damage: 105, type: 'mid', box: { x: -10, y: -380, w: 150, h: 360 }, anim: 'uppercut', launcher: true, art: 'candleG', ai: 'antiair' },
    { mech: 'counter', startup: 3, window: 24, recovery: 24, damage: 130, effect: 'knockdown', popup: 'SOLD', popupColor: 0xea3943, ai: 'defense' },
    { mech: 'string', startup: 5, hits: 5, interval: 6, damage: 18, advance: 6, recovery: 18, ender: 'knockdown', enderDamage: 55, art: 'heart', ai: 'close' },
  ],
  arlecchino: [
    { mech: 'projectile', art: 'rust', startup: 14, recovery: 22, damage: 100, speed: 7, hits: 4, hitEvery: 8, spin: 0.2, scale: 1.2, radius: 30, ai: 'far' },
    { mech: 'status', startup: 14, recovery: 22, status: 'nospecials', frames: 300, delivery: 'projectile', damage: 25, art: 'code', speed: 10, ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'readinput', amount: 1, frames: 300 }], art: 'code', ai: 'defense' },
  ],
  laka: [
    { mech: 'teleport', startup: 6, vanish: 10, dest: 'behind', recovery: 14, slash: true, attack: { damage: 100, type: 'mid', box: { x: 0, y: -280, w: 170, h: 260 }, active: 5, anim: 'heavy', knockdown: true }, ai: 'mid' },
    { mech: 'projectile', art: 'shadoworb', startup: 12, recovery: 20, damage: 50, speed: 11, status: { kind: 'mark', frames: 300 }, ai: 'far' },
    { mech: 'super', cost: 300, damage: 350, ai: 'any' },
  ],
  // ---------------------------------------------------------------- batch 2
  skroot: [
    { mech: 'rush', startup: 6, speed: 14, frames: 16, recovery: 14, damage: 80, type: 'low', anim: 'sweep', knockdown: true, trail: 'smoke', shout: 'SKRRT SKRRT', ai: 'mid' },
    { mech: 'projectile', art: 'smoke', startup: 14, recovery: 20, damage: 75, speed: 6, hits: 3, hitEvery: 9, scale: 1.3, radius: 40, life: 150, color: 0xd8d8d8, ai: 'far' },
    { mech: 'grab', startup: 4, range: 130, recovery: 26, damage: 165, run: { speed: 12, frames: 26, invuln: false }, banner: 'PULLED UP', ai: 'mid' },
  ],
  otaobayom: [
    { mech: 'strike', startup: 20, active: 6, recovery: 24, damage: 155, type: 'overhead', box: { x: 0, y: -290, w: 170, h: 290 }, anim: 'overhead', knockdown: true, armor: true, art: 'crown', ai: 'close' },
    { mech: 'projectile', art: 'drum', startup: 14, recovery: 20, damage: 70, speed: 9, low: true, y: 30, ground: true, radius: 34, ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'armor', amount: 3, frames: 360 }], art: 'crown', ai: 'buff' },
  ],
  gafar: [
    { mech: 'trap', startup: 12, recovery: 16, distance: 280, life: 420, damage: 90, stun: 45, art: 'code', ai: 'far' },
    { mech: 'status', startup: 14, recovery: 22, status: 'drain', frames: 0, delivery: 'wave', damage: 20, art: 'flame', ai: 'far' },
    { mech: 'projectile', art: 'rocket', startup: 14, recovery: 22, damage: 90, speed: 8, vy: -13, gravity: 0.45, life: 200, spin: 0.05, knockdown: true, ai: 'far' },
  ],
  nipherme: [
    { mech: 'counter', startup: 3, window: 26, recovery: 24, damage: 70, effect: 'freeze', freeze: 75, popup: "DAVE'S READ", popupColor: 0xff2d78, ai: 'defense' },
    { mech: 'string', startup: 5, hits: 4, interval: 6, damage: 20, advance: 5, recovery: 18, ender: 'knockdown', enderDamage: 55, ai: 'close' },
    { mech: 'status', startup: 14, recovery: 22, status: 'lag', frames: 240, delivery: 'wave', damage: 15, art: 'leaf', ai: 'far' },
  ],
  limitlessdami: [
    { mech: 'strike', startup: 5, active: 6, recovery: 22, damage: 105, type: 'mid', box: { x: -10, y: -380, w: 150, h: 360 }, anim: 'uppercut', launcher: true, art: 'lightning', ai: 'antiair' },
    { mech: 'string', startup: 5, hits: 6, interval: 8, damage: 15, advance: 5, recovery: 18, ender: 'knockdown', enderDamage: 50, speedup: true, ai: 'close' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'speed', amount: 20, frames: 420 }, { kind: 'regen', amount: 90, frames: 180 }], ai: 'buff' },
  ],
  zyloinsol: [
    { mech: 'rush', startup: 3, speed: 22, frames: 12, recovery: 12, damage: 65, pass: true, afterimage: true, invuln: 'projectile', shout: '400ms', ai: 'mid' },
    { mech: 'projectile', art: 'bolt', startup: 12, recovery: 20, damage: 80, speed: 15, hits: 2, hitEvery: 6, scale: 2, radius: 26, color: 0x9945ff, ai: 'far' },
    { mech: 'teleport', startup: 8, vanish: 12, dest: 'above', recovery: 14, attack: { damage: 95, type: 'overhead', box: { x: -40, y: -220, w: 180, h: 220 }, active: 14, anim: 'overhead', knockdown: true }, ai: 'mid' },
  ],
  hundred: [
    { mech: 'strike', startup: 12, active: 5, recovery: 22, damage: 140, type: 'mid', box: { x: 30, y: -250, w: 230, h: 100 }, anim: 'heavy', charge: 60, unblockableCharged: true, knockdown: true, lunge: 5, art: 'dollar', ai: 'close' },
    { mech: 'string', startup: 5, hits: 8, interval: 5, damage: 12, advance: 4, recovery: 20, ender: 'heavy', enderDamage: 45, ai: 'close' },
    { mech: 'drop', art: 'rocket', startup: 18, recovery: 24, damage: 120, count: 1, interval: 0, spread: 0, scale: 1.6, knockdown: true, fallSpeed: 26, warn: 26, radius: 70, ai: 'far' },
  ],
  flipper: [
    { mech: 'strike', startup: 12, active: 6, recovery: 20, damage: 100, type: 'overhead', box: { x: 0, y: -300, w: 170, h: 300 }, anim: 'overhead', hop: 10, knockdown: true, lunge: 5, ai: 'mid' },
    { mech: 'status', startup: 12, recovery: 20, status: 'reverse', frames: 240, delivery: 'projectile', damage: 20, art: 'solcoin', speed: 11, ai: 'far' },
    { mech: 'projectile', art: 'eth', startup: 12, recovery: 20, damage: 75, speed: 11, bounceWall: 2, spin: 0.3, life: 240, ai: 'far' },
  ],
  '0xtochi': [
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'readinput', amount: 1, frames: 300 }], art: 'lens', ai: 'defense' },
    { mech: 'projectile', art: 'flame', startup: 12, recovery: 18, damage: 80, speed: 10, spin: 0.25, ai: 'far' },
    { mech: 'trap', startup: 12, recovery: 16, distance: 240, life: 420, damage: 85, stun: 45, art: 'paper', ai: 'far' },
  ],
  headboy: [
    { mech: 'status', startup: 12, recovery: 22, status: 'freeze', frames: 50, delivery: 'wave', damage: 30, art: 'ring', ai: 'mid' },
    { mech: 'grab', startup: 6, range: 150, recovery: 28, damage: 190, banner: 'DETENTION', art: 'book', ai: 'close' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'damage', amount: 25, frames: 420 }], art: 'crown', ai: 'buff' },
  ],
  digitek: [
    { mech: 'trap', startup: 12, recovery: 16, distance: 260, life: 420, damage: 90, stun: 40, art: 'candleG', ai: 'far' },
    { mech: 'string', startup: 5, hits: 4, interval: 6, damage: 20, advance: 3, recovery: 18, ender: 'highlow', enderDamage: 55, art: 'candleR', ai: 'close' },
    { mech: 'rush', startup: 8, speed: 16, frames: 18, recovery: 18, damage: 100, charge: 50, launcher: true, afterimage: true, trail: 'candleG', ai: 'mid' },
  ],
  '100x-arc': [
    { mech: 'projectile', art: 'basketball', startup: 14, recovery: 20, damage: 85, speed: 7, vy: -17, gravity: 0.55, bounceFloor: 1, spin: 0.2, life: 220, ai: 'far' },
    { mech: 'rush', startup: 4, speed: 17, frames: 15, recovery: 14, damage: 75, knockdown: true, afterimage: true, ai: 'mid' },
    { mech: 'strike', startup: 6, active: 6, recovery: 22, damage: 100, type: 'mid', box: { x: -10, y: -380, w: 150, h: 360 }, anim: 'uppercut', launcher: true, art: 'basketball', ai: 'antiair' },
  ],
  mystayor: [
    { mech: 'decoy', startup: 4, distance: 220, recovery: 10, decoyLife: 80, decoyDamage: 60, invuln: 14, ai: 'defense' },
    { mech: 'counter', startup: 3, window: 24, recovery: 24, damage: 90, effect: 'launch', popup: 'FORESEEN', popupColor: 0x6fa8ff, ai: 'defense' },
    { mech: 'projectile', art: 'callorb', startup: 16, recovery: 24, damage: 85, speed: 4.5, hits: 3, hitEvery: 10, track: 0.8, life: 240, scale: 1.1, radius: 30, color: 0x6fa8ff, ai: 'far' },
  ],
  evansofweb3: [
    { mech: 'grab', startup: 4, range: 130, recovery: 26, damage: 170, heal: 40, run: { speed: 11, frames: 26, invuln: false }, banner: 'ONBOARDED', art: 'heart', ai: 'mid' },
    { mech: 'drop', art: 'avatar', startup: 16, recovery: 22, damage: 24, count: 5, interval: 6, spread: 280, scale: 1.1, ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'speed', amount: 15, frames: 420 }, { kind: 'damage', amount: 15, frames: 420 }], art: 'candleG', ai: 'buff' },
  ],
};
