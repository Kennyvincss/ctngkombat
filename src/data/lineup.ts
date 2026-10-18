import type { FighterData } from './types';

/** the line-up opens with these, in this order */
const OPENERS = ['alon', 'ansem'];
/** the original six come in the middle, from this place in the line-up (0-based: 10th) */
const ORIGINALS_AT = 9;

/**
 * The running order of the intro and the select screen: the openers, then the newer fighters in
 * roster order, with the original six (roster order 1-6) together in the middle.
 */
export function lineUp(roster: FighterData[]): FighterData[] {
  const originals = roster.filter((f) => f.order <= 6);
  const openers = OPENERS.map((id) => roster.find((f) => f.id === id)).filter((f): f is FighterData => !!f);
  const rest = roster.filter((f) => !originals.includes(f) && !openers.includes(f));
  const line = [...openers, ...rest];
  line.splice(Math.min(ORIGINALS_AT, line.length), 0, ...originals);
  return line;
}
