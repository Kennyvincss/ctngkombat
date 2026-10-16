import type { FighterTuning } from './types';

// Per-fighter tuning. Archetypes keep their identity: powerhouses are slower with
// more health and harder normals, tricksters are faster with less health.
// accent: the dominant glow colour of the card. artFacesRight: which way the card art faces.

type Row = [cls: FighterTuning['cls'], health: number, walk: number, damage: number, artFacesRight: boolean, accent: number, quote: string];

const T: Record<string, Row> = {
  'promise-sol': ['trickster', 900, 4.4, 0.95, false, 0xff2d55, 'Like, RT and follow for a chance to win. You did not win.'],
  onepeterr: ['powerhouse', 1100, 3.4, 1.15, false, 0x2f8bff, 'Congratulations. You have been selected... as the loser.'],
  unscripted: ['zoner', 950, 3.6, 1.0, false, 0x16e07a, 'No script. No mercy. Green PnL only.'],
  'king-sol': ['balanced', 1000, 3.8, 1.05, false, 0xffc22e, 'Payroll is out. Your name was not on it.'],
  degenbro: ['powerhouse', 1050, 3.6, 1.1, false, 0xa24bff, 'Garri for everyone. You bought the top.'],
  juniordip: ['rushdown', 950, 4.4, 1.0, true, 0x4fb8ff, 'Young, hungry and already ahead of you.'],
  bloomstar: ['balanced', 1000, 4.0, 1.0, false, 0xff9a1f, 'I saw that combo three charts ago.'],
  'samuel-xeus': ['balanced', 1000, 3.8, 1.0, true, 0xd9ff2e, 'Class dismissed. Read the thread next time.'],
  achillas: ['balanced', 1000, 3.8, 1.05, false, 0x3dff8f, 'Entry, target, stop loss. You hit all three.'],
  'dami-defi': ['trickster', 920, 4.4, 0.95, false, 0xff3355, 'Gem found. It was not you.'],
  'prudent-sammy': ['defensive', 1080, 3.3, 1.05, true, 0xffb84d, 'Patience pays. Impatience pays me.'],
  udy: ['trickster', 900, 4.5, 0.95, false, 0xd8d8d8, 'Blink and the trend already moved on.'],
  'crypto-hak': ['rushdown', 980, 4.2, 1.05, false, 0xff2b2b, 'Onchain pressure. Offchain tears.'],
  karo: ['balanced', 1000, 4.0, 1.0, true, 0x8fd6ff, 'Stay cold. Stay stylish. Stay winning.'],
  illusions: ['trickster', 920, 4.0, 0.95, true, 0xff7a1a, 'Were you even fighting me?'],
  fgs: ['powerhouse', 1120, 3.2, 1.2, false, 0xff8c42, 'The statement is final.'],
  zaya: ['zoner', 950, 3.6, 0.95, false, 0x2be0ff, 'Build succeeded. You did not.'],
  senpai: ['balanced', 1000, 3.8, 1.0, true, 0x7cd957, 'Lesson one: never challenge senpai.'],
  'ugly-grm': ['powerhouse', 1060, 3.6, 1.1, true, 0x9b4dff, 'Ugly truth: you lost.'],
  'one-random-guy': ['balanced', 960, 4.0, 1.0, true, 0xff4d6d, 'Just one random guy. Remember the name anyway.'],
  seunn: ['balanced', 1000, 3.8, 1.05, false, 0xff4b2b, 'Deal closed. Pleasure doing business.'],
  echo: ['zoner', 980, 3.8, 0.95, true, 0x7a5cff, 'Your losses will echo for weeks.'],
  salam: ['balanced', 1000, 4.0, 1.0, true, 0xe6e6e6, 'Every round is a fresh start. Except yours.'],
  raviel: ['rushdown', 980, 4.2, 1.05, true, 0xe0263a, 'The house always wins.'],
  rex: ['defensive', 1060, 3.6, 1.05, false, 0xffcc33, 'If the Lord wills, I win. He willed it.'],
  noir: ['trickster', 920, 4.6, 1.0, false, 0xe8323c, 'You never even saw me move.'],
  rayan: ['balanced', 980, 4.2, 1.0, false, 0x2f6bff, 'Seven figures. Zero losses today.'],
  yoshai: ['trickster', 940, 4.2, 0.95, false, 0x6fa8ff, 'Marketed you right out of relevance.'],
  'crypto-baddie': ['rushdown', 960, 4.4, 1.0, false, 0x7dff4d, 'Sold the top. That was you.'],
  arlecchino: ['zoner', 940, 3.6, 0.95, false, 0xc4182f, 'Segmentation fault: opponent not found.'],
  laka: ['rushdown', 950, 4.5, 1.05, false, 0x9b30ff, 'The last candle burns for me.'],
  // batch 2
  skroot: ['rushdown', 980, 4.4, 1.0, false, 0xff8a1f, 'Skrrt. You blinked.'],
  otaobayom: ['powerhouse', 1100, 3.3, 1.15, false, 0xff2b3d, 'Kneel. The palace has spoken.'],
  gafar: ['zoner', 960, 3.6, 0.95, true, 0x2bff7a, 'Shipped. Deployed. Done.'],
  nipherme: ['defensive', 1040, 3.7, 1.0, false, 0xff2d78, 'I saw that coming two candles ago.'],
  limitlessdami: ['rushdown', 980, 4.4, 1.05, true, 0x2f6bff, 'Limits are for other people.'],
  zyloinsol: ['trickster', 920, 4.6, 0.95, false, 0xa24bff, 'Faster than your confirmation.'],
  hundred: ['powerhouse', 1080, 3.4, 1.15, false, 0xffc22e, 'I only play for the 100x.'],
  flipper: ['trickster', 920, 4.5, 0.95, false, 0x3b6bff, 'In, out, profit. Flipped.'],
  '0xtochi': ['zoner', 950, 3.8, 0.95, false, 0xff8ad8, "DYOR. I did. You didn't."],
  headboy: ['balanced', 1020, 3.8, 1.05, false, 0x2be0c0, 'Line up. Class is in session.'],
  digitek: ['balanced', 1000, 4.0, 1.0, false, 0x4fffd0, 'Textbook breakout. You were the resistance.'],
  '100x-arc': ['zoner', 960, 3.8, 1.0, false, 0xc9d6ff, 'Nothing but net.'],
  mystayor: ['trickster', 940, 4.2, 0.95, false, 0x6fa8ff, "The future was written. You just couldn't read it."],
  evansofweb3: ['balanced', 1000, 4.0, 1.0, false, 0xd94bff, 'Welcome to Web3. Now get out.'],
  // batch 3
  codexbt: ['trickster', 930, 4.4, 0.95, false, 0xff2030, 'Patched you out of the game.'],
  swazy: ['powerhouse', 1120, 3.2, 1.15, false, 0x2bd46b, "Everything's going down. Starting with you."],
  // batch 4
  rugway: ['trickster', 940, 4.2, 0.95, false, 0xa64bff, 'I was watching the whole time.'],
  hate: ['zoner', 960, 3.6, 1.0, false, 0x3a8dff, 'Now you know my name.'],
  xeverade: ['balanced', 1000, 4.0, 1.05, false, 0x39ff6a, 'Perfect entry. Perfect exit.'],
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
