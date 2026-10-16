// Global, easy-to-change settings. Gameplay tuning lives in src/data/tuning.ts.

export const GAME_TITLE = 'TRENCHES KOMBAT';
export const GAME_SUBTITLE = 'THE CRYPTO TWITTER FIGHTING GAME';

export const GAME_W = 1280;
export const GAME_H = 720;

/** Logic runs at a fixed 60 Hz regardless of display refresh rate. */
export const STEP_MS = 1000 / 60;

export const FONT_DISPLAY = '"Anton", "Bebas Neue", Impact, "Arial Black", sans-serif';
export const FONT_BODY = '"Bebas Neue", "Anton", Impact, "Arial Narrow", sans-serif';

export const GOLD = '#f5c542';
export const GOLD_DARK = '#8a6412';
export const GOLD_HEX = 0xf5c542;

export const ROUNDS_TO_WIN = 2;
export const ROUND_TIME = 99;
export const FATALITY_WINDOW_S = 5;

/** the creator's Solana wallet, shown under TIP CREATOR on the menu */
export const TIP_WALLET = 'cbWr6BiA2PqfVuQwDHSqTzwKs9zhySnjc5v1wwPvBgh';

/** where the game lives (printed on the shareable result cards) */
export const SITE_URL = 'trencheskombat.vercel.app';
