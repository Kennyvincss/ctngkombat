# Trenches Kombat

A 2D anime-style fighting game in the spirit of Mortal Kombat, starring 31 fighters from the Crypto Twitter trenches. Pick a fighter, fight the CPU or a friend, then **FINISH THEM**.

Built with TypeScript, Vite and Phaser 3. It runs in a desktop browser (keyboard or gamepad) and on phones (touch controls, landscape). The full design brief is in [`SPEC.md`](SPEC.md).

## Run it

```bash
npm install
npm run dev        # local dev server with hot reload
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

`dist/` is a static site with relative paths, so it can be hosted anywhere: Vercel, Netlify, GitHub Pages, or any folder on a web server.

## Modes

- **VS CPU**: pick your fighter, then your opponent. Easy, Normal or Hard.
- **VS Player 2**: two players on one keyboard, or two gamepads.
- **Training**: infinite health and meter, move list on screen, and a dummy you can switch between stand, block, crouch-block, jump and CPU (`T`).

## Controls

| Action | Player 1 | Player 2 | Touch |
|---|---|---|---|
| Move / jump / crouch | `W A S D` (solo: arrows too) | Arrow keys | Left-thumb stick |
| Light / heavy punch | `U` / `I` (solo: `Z` / `X`) | Numpad `4` / `5` | LP / HP |
| Light / heavy kick | `J` / `K` (solo: `C` / `V`) | Numpad `1` / `2` | LK / HK |
| Special 1 / 2 / 3 | `O` / `L` / `;` (solo: `Q` / `E` / `R`) | Numpad `6` / `3` / `.` | SP1 / SP2 / SP3 |
| EX (spend 1 bar) | `P`, or use a heavy button | Numpad `0` | EX |
| Pause | `Esc` | | `II` |
| Mute | `M` | | Sound toggle |

- **Motion inputs** work for everyone: Special 1 = ↓↘→ + punch, Special 2 = →↓↘ + punch, Special 3 = ↓↙← + kick. Using the heavy button gives the EX version if you have a bar.
- **Charge moves** (Moon or Rug, Road to Millions, Full Gas, Seven Figure Arc) charge while you hold the button.
- **Fatality**: when "FINISH THEM" appears you have 5 seconds: ↓ ↓ → + heavy punch (or the FATALITY button on touch).
- **Basics**: hold back to block, down-back for lows. Double-tap to dash. Light → light → heavy chains, and normals cancel into specials on hit. Crouching heavy punch launches, crouching heavy kick sweeps, jumping heavies are overheads.
- Gamepads use the standard mapping: X/Y punches, A/B kicks, LB/RB/LT specials, RT EX, Start pauses.

## How it's put together

```
public/
  fighters.json               roster: source of truth for names, handles, archetypes, special text, fatality text
  assets/cards/<id>.webp      downscaled fighter cards (select, VS and win screens)
  assets/thumbs/<id>.webp     select-grid thumbnails
  assets/fighters/<id>.png    background-removed cut-outs used in fights (Phase A puppets)
  assets/sprites/manifest.json  Phase B sprite sheets (empty for now)
source/cards/                 the original 1024×1536 card art
scripts/                      asset pipeline (cut-outs, thumbnails, previews)
src/
  config.ts                   title, resolution, round rules
  data/
    tuning.ts                 per-fighter health, speed, damage, accent colour, win quote; CPU difficulty
    normals.ts                frame data for punches and kicks, physics constants
    moves.ts                  all 93 specials, each configured from the mechanic catalog
    moveTypes.ts              the mechanic catalog's data shapes
  fight/
    Fighter.ts                state machine, movement, blocking, hit reactions, juggles, buffs, status effects
    mechanics.ts              the 14 shared special mechanics (projectile, drop, rush, teleport, grab, counter, ...)
    entities.ts               projectiles, falling objects, clones, traps, waves, screen hazards
    fatalities.ts             31 cartoon fatalities (popups, confetti, stamps; no gore)
    ai.ts                     CPU opponent (3 difficulties, archetype-aware)
    FighterView.ts            FighterView interface, PuppetView (Phase A) and SpriteView (Phase B)
    art.ts                    code-drawn effect art (SOL coins, wallets, Cybertruck, garri, candles, ...)
    stages.ts                 the three arenas: Ruined Temple, Neon Chart City, Rain-Soaked Rooftop
    Effects.ts                hit sparks, shockwaves, popups, confetti
  scenes/                     Boot, Title, Mode, Select, Versus, Fight, Hud, Win
  audio/Sfx.ts                synthesized sound effects and a procedural dark-trap loop (no audio files)
```

### Tuning

Everything gameplay-related lives in data files:

- **Health, walk speed, damage, accent colour, win quote:** `src/data/tuning.ts`
- **A special's damage, speed, startup and so on:** that fighter's entry in `src/data/moves.ts`
- **Punches and kicks:** `src/data/normals.ts`
- **CPU behaviour per difficulty:** `CPU_SETTINGS` in `src/data/tuning.ts`

Damage caps from the spec are enforced in code (`src/fight/mechanics.ts`): 18% of a standard health bar for specials, 22% for command grabs and 35% for supers, including EX, charge and low-health bonuses.

### Regenerating the fighter cut-outs

The cut-outs in `public/assets/fighters/` were generated from `source/cards/` with [rembg](https://github.com/danielgatis/rembg) using the BiRefNet model, which handles the dark-on-dark cards best. To rebuild them (for example after replacing a card):

```bash
pip install "rembg[cpu]" pillow numpy scipy
scripts/make_all_assets.sh          # all fighters (one process per card; BiRefNet is memory hungry)
python3 scripts/make_assets.py laka # just one fighter
```

Each card's frame is cropped, the nameplate is cut off (the legs fade out there and sit in the stage's ground fog), the background is removed and the result is scaled to 520 px tall.

### Phase B: real sprites

Combat code only talks to the `FighterView` interface. To give a fighter real poses, add images to `public/assets/sprites/<id>/<pose>.png` and list them in `public/assets/sprites/manifest.json`:

```json
{ "laka": ["idle", "walk", "crouch", "jump", "light", "heavy", "special", "block", "hit", "knockdown", "win"] }
```

Poses that exist replace the cut-out for that animation; anything missing falls back to the Phase A puppet.

## Decisions on the spec's open questions

- Title: **Trenches Kombat** (set in `src/config.ts`)
- Laka's handle: @Iaksalter
- The five names that differed between the roster and the cards: the cards were right. Those fighters are Crypto Hako, Amin, Shalli, Ugly and Praise (their ids and handles are unchanged).
- Several cards are based on existing anime/comic characters and NFT collections. Fine for a private fan project; they'd need original art before any public or commercial release.

This is a fan-made parody. It isn't affiliated with any game studio and uses no Mortal Kombat logos, fonts or audio.
