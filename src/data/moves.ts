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
  arlecchino: [
    { mech: 'projectile', art: 'rust', startup: 14, recovery: 22, damage: 100, speed: 7, hits: 4, hitEvery: 8, spin: 0.2, scale: 1.2, radius: 30, ai: 'far' },
    { mech: 'status', startup: 14, recovery: 22, status: 'nospecials', frames: 300, delivery: 'projectile', damage: 25, art: 'code', speed: 10, ai: 'far' },
    { mech: 'buff', startup: 8, recovery: 8, buffs: [{ kind: 'readinput', amount: 1, frames: 300 }], art: 'code', ai: 'defense' },
  ],
  skroot: [
    { mech: 'rush', startup: 6, speed: 14, frames: 16, recovery: 14, damage: 80, type: 'low', anim: 'sweep', knockdown: true, trail: 'smoke', shout: 'SKRRT SKRRT', ai: 'mid' },
    { mech: 'projectile', art: 'smoke', startup: 14, recovery: 20, damage: 75, speed: 6, hits: 3, hitEvery: 9, scale: 1.3, radius: 40, life: 150, color: 0xd8d8d8, ai: 'far' },
    { mech: 'grab', startup: 4, range: 130, recovery: 26, damage: 165, run: { speed: 12, frames: 26, invuln: false }, banner: 'PULLED UP', ai: 'mid' },
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
