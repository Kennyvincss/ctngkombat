# The Trenches: build spec

A 2D anime-style fighting game in the spirit of Mortal Kombat. The roster is 31 people from the Crypto Twitter (X) community, each with their own fighter card, archetype, three special moves and a fatality.

This folder contains everything you need:

- `SPEC.md` (this file): what to build
- `fighters.json`: the full roster data (name, handle, archetype, specials, fatality, card image path), in roster order
- `assets/cards/01-promise-sol.webp` … `31-laka.webp`: the finished anime fighter card for each fighter, 1024×1536 WebP, with gold frames and nameplates

`fighters.json` is the source of truth for fighter data. Load it at runtime; don't hard-code fighter stats into game logic.

---

## 1. Goal

Build a playable browser fighting game that:

1. Opens on a title screen, then a character-select screen showing all 31 cards
2. Lets the player pick a fighter and face either the CPU or a second local player
3. Plays best-of-3 rounds with health bars, a timer and a super meter
4. Gives every fighter their three listed special moves as real, working mechanics
5. Ends with "FINISH THEM", a fatality input window, the fighter's fatality, then a win screen

It has to run in a desktop browser (keyboard) and on a phone (touch controls), since most players will open it from a link on X.

## 2. Tech

- **Stack:** TypeScript + Vite + Phaser 3. Use Phaser for the game loop, input, cameras, tweens, particles and scenes.
- **Output:** a static build (`dist/`) that can be hosted anywhere (Vercel, Netlify, GitHub Pages). No backend.
- **Resolution:** 1280×720 logical, scaled to fit with `Phaser.Scale.FIT`. Landscape on phones, with a "rotate your phone" prompt in portrait.
- **Performance:** 60 fps on a mid-range phone. Downscale card art for in-game use (keep the originals for the select screen).

## 3. Art direction

- **Style:** 2D anime, cel-shaded, dark arena backgrounds with glowing embers, gold-and-black UI. Everything matches the cards.
- **Typography:** a bold condensed display face for names and announcer text, such as Bebas Neue or Anton from Google Fonts. Gold text with a dark outline.
- **Color:** each fighter has an accent color. Sample it from their card (the dominant glow color, e.g. Promise.sol red, Onepeterr electric blue, Unscripted green, Echo violet). Use it for their health-bar trim, hit sparks, special-move effects and select-screen highlight.
- **No Mortal Kombat branding.** Don't use the MK dragon logo, the MK wordmark, MK fonts, MK announcer audio or MK character names. "FIGHT", "FINISH THEM" and "FATALITY" are generic genre phrases and are fine to use as on-screen text.

### Fighting sprites (important)

The cards are **portraits, not sprite sheets**. Each card is one static pose with a background and frame. The fight scene needs fighters without backgrounds, at a consistent scale, facing each other. Build this in two phases:

**Phase A: playable now, cut-out puppets (build this first)**
- For each card, make a background-removed cut-out (output as PNG with transparency) of the fighter: crop out the frame and nameplate, then remove the background. Use an automated tool such as `rembg` in a build script. Save the results to `assets/fighters/<id>.png` and commit them.
- Animate that single cut-out in code with Phaser tweens: idle breathing (scale-Y bob), walk (bob plus lean), attack (fast lunge, squash/stretch, short rotation), hit (knockback, white flash, shake), block (lean back, blue shield flash), knockdown (rotate, fall, bounce), victory (hop plus glow).
- Flip horizontally so each fighter faces the opponent.
- Special moves get their identity from code-drawn effects and projectiles (see section 6), not from new poses.

**Phase B: later, real multi-pose sprites**
- Keep the fighter renderer behind an interface (`FighterView`) so a fighter can switch from "cut-out puppet" to "sprite sheet" without touching combat code.
- The planned sprite set per fighter is idle, walk, crouch, jump, light, heavy, special 1, special 2, special 3, block, hit, knockdown and win. These will be generated as separate images later.
- If a `assets/sprites/<id>/` folder exists, use it. Otherwise fall back to the Phase A puppet.

## 4. Screens / scenes

1. **Boot/Preload:** load `fighters.json`, cards, cut-outs, fonts and sounds. Show a progress bar.
2. **Title:** "THE TRENCHES" logo (working title, keep it configurable), "Press any key / Tap to start", and a slow parallax of fighter cut-outs in the background.
3. **Mode select:** vs CPU, vs Player 2 (local), Training (infinite health, move list visible).
4. **Character select:**
   - A grid of all 31 fighters (cropped card thumbnails) in roster order
   - A large preview of the full card for the hovered fighter on the P1 side (and the P2 side in 2P mode)
   - Name, handle, archetype, and the three specials with descriptions
   - Random-select tile
   - Keyboard, gamepad and touch all work
5. **Versus screen:** both full cards slide in from the sides, "VS" slams in the middle, a 2-second hold, then the fight starts.
6. **Fight:** see section 5.
7. **Fatality sequence:** see section 7.
8. **Win screen:** the winner's full card, name in gold, a short win quote, then Rematch / Character select / Title.

## 5. Core fight systems

**Stage**
- A flat ground plane, left and right walls (corner pressure matters), and a camera that follows both fighters with slight zoom.
- At least 3 arena backgrounds in the card art style: ruined temple with embers, neon chart city at night, rain-soaked rooftop. Pick one randomly or match it to the P2 fighter.

**HUD**
- Health bars at top left and top right with name and handle, a round-win pips row, and a 99-second timer.
- A super meter (3 segments) at the bottom of each side.

**Rules**
- Best of 3 rounds. At time-out, the fighter with more health wins the round.
- Round intro: "ROUND 1" then "FIGHT".

**Movement**
- Walk forward and back, crouch, jump (neutral, forward, back) and dash (double-tap).
- Holding back blocks high, and holding down-back blocks low. Chip damage on specials only.

**Normals**
- Light punch, heavy punch, light kick and heavy kick. Standing, crouching and jumping versions all share the same animation in Phase A, but have different hitboxes and properties: crouching heavy kick is a low sweep, and jumping heavy is an overhead.
- Simple chains: light into light into heavy. Normals cancel into specials on hit.

**Hit system**
- Hitboxes and hurtboxes are defined per move in data.
- Each move gets damage, startup, active and recovery frames, hitstun, blockstun, pushback, hit type (high/mid/low/overhead), and flags (launcher, wall bounce, knockdown, armor, invincibility, projectile).
- Hit-pause of a few frames, screen shake on heavy hits, and accent-colored hit sparks.

**Super meter**
- Fills on dealing and taking damage. One bar enhances a special (the EX version: more hits, armor or damage).
- Moves whose description implies a meter effect use the meter system, e.g. "Gas Fee drains the opponent's meter" and "Compile builds meter faster".

**Inputs**

| Action | Keyboard P1 | Keyboard P2 | Touch |
|---|---|---|---|
| Move | WASD | Arrow keys | Left-thumb virtual stick |
| Light punch / Heavy punch | U / I | Numpad 4 / 5 | Buttons |
| Light kick / Heavy kick | J / K | Numpad 1 / 2 | Buttons |
| Special 1 / 2 / 3 | Motion inputs below, **or** O / L / ; shortcut keys | Motion inputs or Numpad 6 / 3 / . | Three dedicated special buttons |

- Motion inputs work for all fighters: Special 1 = ↓↘→ + punch, Special 2 = →↓↘ + punch, Special 3 = ↓↙← + kick.
- Charge moves (like Moon or Rug) charge while the special button is held.
- Gamepad support uses the Phaser gamepad plugin with standard mapping.

**CPU opponent**
- Three difficulty levels. It walks into range, uses normals, blocks some fraction of attacks, punishes whiffed specials on Hard, and uses each fighter's specials in a way that suits the archetype: zoners keep distance and throw projectiles, rushdown fighters close in, and defensive fighters block more and counter.

## 6. Special moves: shared mechanic catalog

Every special in `fighters.json` maps to one or more of these reusable mechanics. Build the catalog once, then configure each fighter's three specials in a data file (`moves.ts` or `moves.json`) keyed by fighter id. Each special also needs a unique visual effect themed to its name, like the SOL coins, wallets or Cybertruck below.

| Mechanic | Behavior | Examples |
|---|---|---|
| Projectile | Travels forward, hits once or several times, and can be destroyed by other projectiles | Giveaway Rain, Unscripted Call (tracking), Thread Storm, Echo Chamber (bounces), Statement (wall-bounce), Shadow Bid (marks the target) |
| Aerial drop | An object falls from above onto the opponent's position | Cybertruck Drop, Blessing Drop (wallets), Code Rain, Promo Rain |
| Rush / dash strike | Fast forward movement with a hitbox; some pass through the opponent or projectiles | Trillion Flex (afterimage trail), Road to Millions (chargeable), Full Gas, Moving Man, Prodigy-style rushes |
| Teleport | Disappears, then reappears behind or near the opponent | Whale Track, Violet Rift (with a slash), Mischief-style teleports, Forever on Motion (slide that cancels into a teleport) |
| Backdash / decoy | Moves back and leaves a fake body or clone | Trench Escape, Fakeout, Illusion Clone |
| Command grab | Short-range unblockable grab | ONEPETERWIN (heals self), DM Open, Senpai Notice, $0 Opportunity (invincible run into a grab) |
| Counter stance | If hit during the window, auto-punish | PnL Flex (shows a green PnL popup), Analysis Paralysis (freeze), Cold Blooded (freeze), Discipline, Skill Check, Divine Timing (tight window), Sell Button |
| Armor / buff | Temporary armor, a damage or speed buff, or healing | Logic Build, Prudent Guard, Masterclass, Guidance, Growth Strategy, Marketing Push, Community Boost (heal), Patience (heal while blocking), If the Lord Wills (invincibility) |
| Overhead / launcher | Hit-type properties | Moon or Rug (charge, unblockable when full), Mudu Smash (wall bounce), Green Candle (launcher uppercut), Dip & Rip (low into launch), Bill Smash |
| Status effect | Affects the opponent's state | Perception Warp (reverses controls), Hate Mail-style input lag, Compile Error (disables specials), Debug (removes buffs), Gas Fee (drains meter), Debug Mode (shows next input) |
| Low-health power-up | Scales with the user's missing health | Raw Energy, Almost Famous, Second Chance |
| Random | Picks a random property set each use | Random Chance, Meme Magic (meme-sticker projectile with random effects) |
| Multi-hit string | An auto-combo series | Payroll (ends in cash rain), Onchain Pressure, Beautiful Obsession, Blockchain Flow (builds speed), Bloom Barrage (ends high or low) |
| Super | Full-screen, costs the full meter | Final Candle (Laka) |

**Balance targets**
- Every fighter should be able to win a round against the Normal CPU.
- No special should do more than 18% damage, except command grabs (22%) and supers (35%).
- Fighters keep their archetype: powerhouses are slower but hit harder, and tricksters are faster but have less health.

Put tuning values (health, walk speed, damage) in data so they're easy to adjust.

## 7. Fatalities

- When the final round is won, the loser stands dazed. "FINISH THEM" appears, and the winner has 5 seconds to enter a fatality input (the same input for everyone: ↓ ↓ → + heavy punch, or a "FATALITY" button on touch).
- Success plays a **comedic, cartoon fatality sequence** themed to the text in `fighters.json`. For example, Promise.sol buries the opponent in endless giveaway-comment popups until they burst into confetti, and Gas Fee sends a giant invoice that crushes them.
- **Keep fatalities cartoonish, not gory.** Use flashes, popups, confetti, pixel bursts, money, charts and stamp effects ("RUGGED", "LIQUIDATED"). No blood, dismemberment or realistic violence, since these are real people's likenesses.
- Then "FATALITY", a slow-mo freeze frame, and the win screen.
- If no input is entered in time, the normal win plays.

## 8. Audio

- Placeholder royalty-free hit sounds, a whoosh, a block clank, a KO hit, and a looping dark-trap/arcade music track. Use CC0 sources, or generate simple sounds with jsfxr.
- Announcer lines appear as large on-screen text for now. Add an option for voice clips later.
- Include a mute toggle, and remember the setting.

## 9. Roster (31 fighters, in order)

Full data is in `fighters.json`. The card file is `assets/cards/NN-<id>.webp`.

| # | Fighter | Handle | Archetype |
|---|---|---|---|
| 1 | Promise.sol | @sol_promise | Trickster / High mobility |
| 2 | Onepeterr | @Onepeterrr | Powerhouse / Pressure |
| 3 | Unscripted | @UnscriptedPnL | Zoner / Mental warfare |
| 4 | King.sol | @teddi_speaks | All-rounder / Balanced |
| 5 | degenBRO | @degenBRO__ | Unpredictable chaos |
| 6 | Juniordip | @Juniordip0 | Rushdown / Young blood |
| 7 | Bloomstar | @bloomstarbms | Technical / Mix-up |
| 8 | Samuel Xeus | @SamuelXeus | Educator / Balanced pressure |
| 9 | Achillas | @Achillas_lens | Precision / Footsies |
| 10 | Dami-Defi | @DamiDefi | Slippery / Hit-and-run |
| 11 | Prudent Sammy | @PrudentSammy | Defensive / Patient |
| 12 | Udy | @udyszn | Slippery trickster |
| 13 | Crypto Hak | @cryptohak0 | Aggressive pressure |
| 14 | Karo | @karoblaq | Stylish all-rounder |
| 15 | Illusions | @illusionsW3 | Mind game specialist |
| 16 | FGS | @fgsbilll | Heavy hitter |
| 17 | Zaya | @zayacodes | Technical / Zoning |
| 18 | Senpai | @Senpai_o1 | Mentorship fighter |
| 19 | Ugly Grm | @uglygrm | Unorthodox brawler |
| 20 | One Random Guy | @onerandomguyyyy | Underdog / Comeback |
| 21 | Seunn | @thisisseunn | Business / Clean fighter |
| 22 | Echo | @demolaW3 | Support / Utility |
| 23 | Salam | @salamfvr | Fresh start / Adaptive |
| 24 | Raviel | @ifwraviel | Aggressive nightmare |
| 25 | Rex | @IfwRex | Faithful brawler |
| 26 | Noir | @dyknoir | Skilled mover |
| 27 | Rayan | @theyfwRayan | Seven figure climber |
| 28 | Yoshai | @meetyoshai | Creative / Unorthodox |
| 29 | Crypto Baddie | @cryptobaddiee1 | Aggressive memecoin queen |
| 30 | Arlecchino | @ms_arlecchino | Technical / Developer |
| 31 | Laka | *(handle TBD)* | Dark avenger / Rushdown |

**Nameplate note:** five cards show a different name in their printed nameplate than the roster name: Crypto Hak → "CRYPTO HAKO", Illusions → "AMIN", FGS → "SHALLI", Ugly Grm → "UGLY", One Random Guy → "PRAISE". This is recorded as `cardNameplate` in `fighters.json`. **In-game UI uses `name`.** Treat these as possible errors in the card art until the owner confirms.

## 10. Milestones

Build and check each milestone before moving on.

1. **Skeleton:** Vite + Phaser + TS project, scene flow (Boot → Title → Mode → Select → VS → Fight → Win) with placeholders. `fighters.json` loads, and the select screen shows all 31 cards.
2. **Cut-outs:** a script that generates `assets/fighters/<id>.png` from the cards. Manually review all 31 and fix any bad crops.
3. **Core fighting:** two fighters on stage with movement, normals, blocking, hit detection, health, rounds, timer and HUD. Use one generic moveset for everyone first.
4. **Mechanic catalog:** build every mechanic in section 6 and test each one in Training mode.
5. **Per-fighter specials:** wire all 93 specials (31 × 3) with their effects. Training mode shows the move list.
6. **CPU:** three difficulty levels.
7. **Fatalities:** all 31.
8. **Polish:** arenas, audio, the VS screen, touch controls, mobile scaling, the mute toggle and a loading screen.
9. **Deploy:** a production build with a hosting-ready `dist/`.

## 11. Acceptance checklist

- [ ] All 31 fighters appear on the select screen with the correct card, name and handle, in roster order
- [ ] Every fighter has 3 working specials matching their descriptions, plus a fatality
- [ ] Full match flow works vs CPU and vs local P2
- [ ] Training mode with infinite health and a visible move list
- [ ] Playable on a phone in landscape with touch controls at 60 fps
- [ ] No Mortal Kombat logos, fonts or assets anywhere
- [ ] Fatalities are cartoonish, with no gore
- [ ] Fighter data and tuning live in data files, not scattered through the code

## 12. Open questions for the owner

- Final game title (currently "The Trenches")
- Laka's X handle
- Confirm the five nameplate mismatches in section 9
- Whether to commission or generate multi-pose sprites later (Phase B)
- Several cards are based on PFPs of existing anime and comic characters and NFT collections. That's fine for a private fan project among friends, but those fighters would need fully original art before any public or commercial release.
