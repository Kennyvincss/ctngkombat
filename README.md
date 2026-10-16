# Trenches Kombat

A 2D anime-style fighting game in the spirit of Mortal Kombat, starring 47 fighters from the Crypto Twitter trenches. Pick a fighter, fight the CPU or a friend, then **FINISH THEM**.

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
- **Play Online**: fight a friend on their own phone or computer. One player picks CREATE ROOM and sends the 5-digit code; the other picks JOIN ROOM and types it in. Both pick fighters, then fight; after the match, REMATCH (both must accept), CHARACTER SELECT or LEAVE.

## Controls

| Action | Player 1 | Player 2 |
|---|---|---|
| Move / jump / crouch | `W A S D` (solo: arrows too) | Arrow keys |
| Light / heavy punch | `U` / `I` (solo: `Z` / `X`) | Numpad `4` / `5` |
| Light / heavy kick | `J` / `K` (solo: `C` / `V`) | Numpad `1` / `2` |
| Special 1 / 2 / 3 | `O` / `L` / `;` (solo: `Q` / `E` / `R`) | Numpad `6` / `3` / `.` |
| EX (spend 1 bar) | `P`, or use a heavy button | Numpad `0` |
| Pause | `Esc` | |
| Mute | `M` | |

**Touch** (phones and tablets, landscape): a movement control on the left and six labelled buttons on the right.

**CUSTOMIZE CONTROLS** (mode screen, or the pause menu during a fight): drag any control to put it anywhere, tap one and use − / + to resize it (60–160%), choose **ANALOG STICK** or **ARROWS** (four arrow buttons, diagonals work by pressing between two arrows) for movement, and set the stick sensitivity. RESET puts everything back. The layout is saved on the device as fractions of the screen, so it carries over to other screen sizes.

| Button | What it does |
|---|---|
| Stick / arrows | Move left and right, up to jump, down to crouch |
| PUNCH | Quick punch. With the stick forward: power punch. With the stick down: uppercut |
| KICK | Quick kick. With the stick forward: high kick. With the stick down: sweep |
| BLOCK | Hold to guard; hold with the stick down to block low attacks |
| SPECIAL | The fighter's special. Stick centred = 1st, forward = 2nd, down = 3rd. The label above shows which one |
| COMBO | Punch → kick → power punch, finished with the special if it's ready |
| FINISHER | EX special (needs 1 bar of meter). After the deciding round: the fatality |

- **Picking a fighter** asks to confirm ("PLAY AS …?" / "FIGHT AGAINST …?"): CONFIRM or CANCEL by tap, or Enter / Esc.
- **Specials recharge for 7 seconds** after each use (for the CPU too), so fights are won with punches, kicks and blocks. The HUD shows `SPECIAL READY` or the seconds left. Training mode has no cooldown.
- **Motion inputs** work for everyone: Special 1 = ↓↘→ + punch, Special 2 = →↓↘ + punch, Special 3 = ↓↙← + kick. Using the heavy button gives the EX version if you have a bar.
- **Charge moves** (Moon or Rug, Road to Millions, Full Gas, Seven Figure Arc) charge while you hold the button.
- **Fatality**: when "FINISH THEM" appears you have 5 seconds: ↓ ↓ → + heavy punch (FINISHER on touch).
- **Basics**: hold back to block, down-back for lows. Double-tap to dash. Light → light → heavy chains, and normals cancel into specials on hit. Crouching heavy punch launches, crouching heavy kick sweeps, jumping heavies are overheads.
- **Full screen**: the game fills any screen shape. On Android, iPad and desktop the first tap goes full screen (also in the pause menu). Safari on iPhone doesn't allow web pages to go full screen: use Share → Add to Home Screen and open Trenches Kombat from the home screen.
- Gamepads use the standard mapping: X/Y punches, A/B kicks, LB/RB/LT specials, RT EX, Start pauses.

## Intro

After the first tap on the title screen (once per visit, or any time from **WATCH INTRO**), an
intro plays: the title, then every fighter for 3.5 seconds performing their two flashiest
specials against a faded sparring partner while a deep announcer calls their name, then
"ENTER THE TRENCHES". It runs on the real fight engine (`src/scenes/IntroScene.ts`, FightScene in
showcase mode) and can be skipped (SKIP, Esc, Enter or Space).

The soundtrack (`public/assets/music/intro.mp3`) is synthesized from scratch by
`scripts/make_intro_music.py` (no samples, no licences): trailer-style drums, distorted bass, brass
stabs and risers at 137 BPM, where each fighter's 3.5 s is exactly two bars and every fighter
lands on a downbeat impact. The intro times itself by the soundtrack's clock. After adding
fighters, rerun the script so the track matches the new length.

In fights the same announcer calls ROUND ONE / ROUND TWO / FINAL ROUND, START, K.O., "<NAME> WINS"
(or DRAW) after every round, FINISH THEM and FATALITY, each shown on screen as it's said.

The announcer lines are in `public/assets/voice/` and are generated by `scripts/make_voices.py`:
[Piper](https://github.com/rhasspy/piper) text-to-speech with the "Ryan (high)" voice
(dataset: [RyanSpeech](https://www.kaggle.com/datasets/roholazandie/ryanspeech), CC BY-NC-SA 4.0,
so non-commercial use only), pitched down and processed with ffmpeg. Add a fighter's
pronunciation to `SAY` in that script and rerun it for that id.

## Online play

Online matches are peer to peer: the two browsers connect directly over WebRTC
([PeerJS](https://peerjs.com)). PeerJS's free public server only introduces the two players
(room code → connection); no game server is needed, so the game stays a static site.

- **Lockstep netcode** (`src/net/Lockstep.ts`): both games run the same fight and only send each
  other button states, 60 per second. Input is applied 3 frames (50 ms) after it is pressed, which
  gives it time to arrive; if the other player's input for a frame is late, the game waits for it
  ("WAITING FOR OPPONENT").
- **Determinism**: anything that changes the fight uses the seeded `rng` (`src/systems/rng.ts`),
  the round flow is timed in simulation ticks, and the fight math uses only plain arithmetic, so
  phones and computers with different browsers compute the same result. Every 2 seconds the two
  games compare a fingerprint of the fight; a mismatch shows "OUT OF SYNC" and logs to the console.
- **Versions**: both players must run the same build (each build has an id; mismatches are refused
  with a "refresh the page" message).
- **Limits**: some mobile networks and office/school Wi-Fi block direct connections; those players
  can't connect without a relay (TURN) server. Players far apart (different continents) will feel
  the delay. There is no random matchmaking, only room codes.
- **Testing locally**: run your own signalling server (`npx peerjs --port 9000`) and open the game
  with `?peer=127.0.0.1:9000` in two browser windows.

## How it's put together

```
public/
  fighters.json               roster: source of truth for names, handles, archetypes, special text, fatality text
  assets/cards/<id>.webp      downscaled fighter cards (select, VS and win screens)
  assets/thumbs/<id>.webp     select-grid thumbnails
  assets/fighters/<id>.png    background-removed cut-outs used in fights (Phase A puppets)
  assets/sprites/<id>.webp    Phase B pose atlas per fighter (20 hand-drawn poses) + <id>.json frame data
  assets/sprites/manifest.json  which fighters have pose atlases
  assets/voice/<id>.mp3       announcer lines for the intro
  assets/music/intro.mp3      the intro's soundtrack
source/cards/                 the original 1024×1536 card art
source/sheets/<id>.jpg        the 20-pose sheets the atlases are cut from (prompt: docs/POSE_PROMPTS.md)
scripts/                      asset pipeline (cut-outs, thumbnails, previews)
src/
  config.ts                   title, resolution, round rules
  data/
    tuning.ts                 per-fighter health, speed, damage, accent colour, win quote; CPU difficulty
    normals.ts                frame data for punches and kicks, physics constants
    moves.ts                  all 141 specials, each configured from the mechanic catalog
    moveTypes.ts              the mechanic catalog's data shapes
  fight/
    Fighter.ts                state machine, movement, blocking, hit reactions, juggles, buffs, status effects
    mechanics.ts              the 14 shared special mechanics (projectile, drop, rush, teleport, grab, counter, ...)
    entities.ts               projectiles, falling objects, clones, traps, waves, screen hazards
    fatalities.ts             47 cartoon fatalities (popups, confetti, stamps; no gore)
    ai.ts                     CPU opponent (3 difficulties, archetype-aware)
    FighterView.ts            FighterView interface, PuppetView (Phase A) and SpriteView (Phase B)
    art.ts                    code-drawn effect art (SOL coins, wallets, Cybertruck, garri, candles, ...)
    stages.ts                 the three arenas: Ruined Temple, Neon Chart City, Rain-Soaked Rooftop
    Effects.ts                hit sparks, shockwaves, popups, confetti
  net/                        online play: PeerJS connection (Net.ts) and lockstep input sync (Lockstep.ts)
  scenes/                     Boot, Title, Intro, Mode, Online, Select, Versus, Fight, Hud, Win, Controls
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

Every fighter has 20 hand-drawn poses (idle, walk, crouch, jump, block, light, heavy, kick, sweep,
uppercut, overhead, special, cast, dash, grab, hit, dizzy, knockdown, getup, win). They come from
one generated sheet per fighter, made with the prompt in `docs/POSE_PROMPTS.md` and kept in
`source/sheets/<id>.jpg`.

`scripts/slice_sheets.py` cuts each sheet into its 20 figures, removes the white background, scales
every pose so the idle pose is the same height for everyone, works out where the feet are under the
body and packs the poses into one atlas per fighter (`public/assets/sprites/<id>.webp` + `.json`):

```bash
python3 scripts/slice_sheets.py debug /tmp/check   # labelled previews: check every sheet split into 5 x 4
python3 scripts/slice_sheets.py build              # write the atlases and manifest.json
```

If a sheet has an extra figure or a bad pose, list it in `scripts/sheet_fixes.json`
(`drop` ignores a figure by row and position, `skip` leaves a pose out so the game borrows another).
To redo one fighter, replace their sheet and run `build` again.

Combat code only talks to the `FighterView` interface, so the renderer is swappable. `SpriteView`
(poses) is used when a fighter has an atlas, then `RigView` (skeletal rig of the card), then
`PuppetView` (the card cut-out).

## Decisions on the spec's open questions

- Title: **Trenches Kombat** (set in `src/config.ts`)
- Laka's handle: @Iaksalter
- The five names that differed between the roster and the cards: the cards were right. Those fighters are Crypto Hako, Amin, Shalli, Ugly and Praise (their ids and handles are unchanged).
- Several cards are based on existing anime/comic characters and NFT collections. Fine for a private fan project; they'd need original art before any public or commercial release.

This is a fan-made parody. It isn't affiliated with any game studio and uses no Mortal Kombat logos, fonts or audio.
