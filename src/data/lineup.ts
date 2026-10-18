import type { FighterData } from './types';

/** the line-up opens with these, in this order */
const OPENERS = ['alon', 'ansem'];
/** the original six come in the middle, from this place in the line-up (0-based: 10th) */
const ORIGINALS_AT = 9;
/** straight after the original six */
const AFTER_ORIGINALS = ['solana-dave'];

/**
 * The running order of the intro and the select screen: the openers, then the newer fighters in
 * roster order, with the original six (roster order 1-6) and Solana Dave together in the middle.
 */
export function lineUp(roster: FighterData[]): FighterData[] {
  const pick = (ids: string[]) => ids.map((id) => roster.find((f) => f.id === id)).filter((f): f is FighterData => !!f);
  const middle = [...roster.filter((f) => f.order <= 6), ...pick(AFTER_ORIGINALS)];
  const openers = pick(OPENERS);
  const rest = roster.filter((f) => !middle.includes(f) && !openers.includes(f));
  const line = [...openers, ...rest];
  line.splice(Math.min(ORIGINALS_AT, line.length), 0, ...middle);
  return line;
}
