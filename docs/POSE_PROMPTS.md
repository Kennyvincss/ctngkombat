# Trenches Kombat: pose prompts

Use this to get real fighting poses for every fighter from a **free** image tool
(Gemini, ChatGPT free, Microsoft Designer / Bing Image Creator, Meta AI, or Grok).
Send the images back to me and I'll cut them out and wire them into the game.

---

## How to do it (per fighter)

1. Open the image tool and **upload the fighter's card** (the card image is the reference).
2. Paste the **MASTER PROMPT** below.
3. Replace `[CHARACTER]` with that fighter's description from the list at the bottom.
4. Replace `[POSE]` with a pose from the pose list.
5. Download the result and name it `<fighter-id>-<pose>.png`, for example `king-sol-kick.png`.
6. Repeat for the next pose. In the same chat, after the first image you can just say
   *"Same character, same style, same size. Now: [POSE]"*.

**Saving your free daily limit:** use the **SHEET PROMPT** instead. It puts 6 poses in one
image and I split them myself. Name those `<fighter-id>-sheet1.png`, `-sheet2.png` and so on.

---

## MASTER PROMPT (one pose per image)

```
Using the uploaded card as the character reference, draw the SAME character:
[CHARACTER]

Pose: [POSE]

Rules:
- Exact same face, hair, outfit, colours and accessories as the card. Same anime cel-shaded art style.
- Full body, head to toe, nothing cropped. Feet near the bottom edge.
- Side view of a 2D fighting game: the character faces RIGHT (profile or 3/4 side view), like a Mortal Kombat or Street Fighter sprite.
- Realistic human proportions and balance. Upright, athletic fighter posture.
- Plain solid flat background, pure white (#FFFFFF). No scenery, no frame, no name plate, no text, no logo, no floor, no shadow, no glow, no particles, no speed lines.
- Character centred, same size and camera distance every time, filling about 85% of the image height.
- Portrait image, 2:3 ratio.
```

## SHEET PROMPT (6 poses in one image)

```
Using the uploaded card as the character reference, make a 2D fighting game sprite sheet of the SAME character:
[CHARACTER]

A 3 x 2 grid of 6 separate full-body poses, all facing RIGHT (side view), all the same size, evenly spaced, not touching or overlapping:
1. [POSE 1]  2. [POSE 2]  3. [POSE 3]
4. [POSE 4]  5. [POSE 5]  6. [POSE 6]

Rules:
- Exact same face, hair, outfit, colours and accessories as the card in every pose. Same anime cel-shaded style.
- Full body head to toe in every cell, nothing cropped.
- Realistic human proportions and balance, like Mortal Kombat / Street Fighter sprites.
- Plain solid flat white background (#FFFFFF) everywhere. No frames, no grid lines, no text, no labels, no numbers, no shadows, no effects.
- Landscape image, 3:2 ratio.
```

Suggested sheets:

- **Sheet 1:** idle, walk, crouch, jump, block, hit
- **Sheet 2:** light, heavy, kick, sweep, uppercut, overhead
- **Sheet 3:** special, cast, dash, grab, dizzy, win
- **Sheet 4:** knockdown, getup *(only 2 poses here, so ask for a 2 x 1 grid)*

---

## POSE LIST

Copy the text after the arrow into `[POSE]`. The word in **bold** is the file name.

| File name | Paste this as the pose |
|---|---|
| **idle** | → standing fighting stance, body turned sideways, knees slightly bent, feet shoulder-width apart, both fists raised in guard near the chin |
| **walk** | → walking forward in fighting stance, front foot stepping forward, fists up in guard |
| **crouch** | → crouching low in guard, knees deeply bent, fists up protecting the face |
| **jump** | → jumping in the air, knees tucked up towards the chest, fists up, feet off the ground |
| **light** | → quick jab: front arm fully extended straight forward at head height in a fist, rear fist guarding the chin |
| **heavy** | → powerful straight punch: rear arm fully extended forward in a fist, hips and shoulders rotated into the punch, front foot planted |
| **kick** | → high side kick: front leg fully extended straight forward at chest height, body leaning back for balance, standing on the back leg, fists up |
| **sweep** | → low leg sweep: crouched very low with one hand on the ground, front leg extended straight out along the floor |
| **uppercut** | → rising uppercut: rear fist driving straight up above the head, body rising from a crouch, heels lifting off the ground |
| **overhead** | → overhead hammer strike: both fists joined, swinging down from above the head towards the front |
| **special** | → special move: both palms pushed forward together at chest height, legs in a wide strong stance, like releasing an energy blast |
| **cast** | → summoning: one arm raised high with an open hand, other hand forward, confident stance |
| **dash** | → dashing forward fast: body leaning far forward, one leg stretched back, arms swept back |
| **block** | → blocking: both forearms raised in front of the face and chest, body leaning back slightly, knees bent |
| **hit** | → getting hit in the face: head snapped back, body bending backwards, arms flung out, one foot lifting |
| **knockdown** | → knocked down: lying flat on the back on the ground, arms and legs loose, head on the left side, feet on the right |
| **getup** | → getting up from the ground: one knee down, one hand pushing off the floor, rising |
| **win** | → victory pose: standing tall, one fist raised high in the air, confident smile |
| **dizzy** | → dazed and stunned: wobbling, knees buckling, arms hanging loose, head tilted, eyes unfocused |
| **grab** | → grabbing: both arms reaching forward to grab the opponent by the collar, leaning forward |

**Most important first:** if you can only do a few, do **idle, walk, light, heavy, kick, jump,
crouch, block, hit, knockdown, win** (in that order). Any pose you skip falls back to the current
animated cut-out, so the game keeps working with whatever you send.

You don't need flips or back-flips. I spin the **jump** image in code.

---

## CHARACTER DESCRIPTIONS (paste as `[CHARACTER]`)

| Fighter id (file name) | Paste this |
|---|---|
| **promise-sol** | young woman with amber eyes, white hooded head wrap with red splatter pattern, red cloth mask over nose and mouth, long white open coat with red splatter, black fitted pants with red straps, black fingerless gloves, black boots |
| **onepeterr** | young man with messy silver-white hair, pale skin, one glowing blue eye, long black trench coat with red lining, black outfit with straps and buckles, heavy black combat boots |
| **unscripted** | mysterious man in a dark green hooded long cloak, face shadowed under the hood with glowing green eyes, black clothes underneath, white bandage wrapped on one forearm, dark boots |
| **king-sol** | anthropomorphic brown bear with a yellow cap and round dark glasses, black-and-white striped long-sleeve shirt, black and gold vest, gold chain, baggy black cargo pants, brown boots |
| **degenbro** | muscular purple gorilla with spiky yellow hair, rainbow visor sunglasses, open purple and gold vest over a bare chest, gold chain, black spiked wristbands, baggy black pants with gold trim, purple-and-black sneakers |
| **juniordip** | figure in a puffy all-white hooded snowsuit, face hidden behind a black visor band, black gloves, white boots, glowing white halo ring above the head |
| **bloomstar** | man in an all-black hooded techwear jacket with the hood up, black cap, black sunglasses, orange bandana mask with a Bitcoin logo over the lower face, headphones around the neck, black fingerless gloves, baggy black cargo pants, black sneakers |
| **samuel-xeus** | teal green-skinned man with long black dreadlocks under a red, yellow and green rasta beanie, round glasses, cigar in mouth, black tracksuit with neon yellow-green stripes and lettering |
| **achillas** | stocky man with short curly reddish-brown hair and calm closed eyes, long white coat with red vein patterns, black shirt, black pants with red trim, white-and-red armoured boots, holding a glowing teal spear |
| **dami-defi** | furry red creature with a black cap with an orange Bitcoin logo, rainbow mirrored sunglasses, blue-and-black plaid flannel shirt, baggy black pants, red, black and white sneakers |
| **prudent-sammy** | man with spiky light-blond hair, black headband, thick black glasses and a short beard, shiny red puffer jacket over a white t-shirt, baggy black cargo pants, white, red and black high-top sneakers |
| **udy** | young dark-skinned man with a grey-and-black plaid cap, black hoodie with a white script logo on the back, baggy dark grey cargo pants, grey sneakers |
| **crypto-hak** | (black-and-white ink style with red accents) man with messy dark hair and stubble, black suit jacket over a white shirt, loosened dark tie, dark trousers, black shoes |
| **karo** | young man with short blond hair and a serious face, long dark-brown coat with a big fur collar, brown leather outfit with belts, dark pants, brown boots |
| **illusions** | woman in a black hijab and niqab with purple trim, golden eyes, long flowing dark-brown and black robe with a purple scarf, dark shoes |
| **fgs** | chibi-style man with a red pompadour, big brown eyes and a cigarette in his mouth, sharp black suit, white shirt, black tie, black shoes, gold pistol tucked in his belt (fights with fists) |
| **zaya** | young woman with wavy dark-brown hair, red-and-white trucker cap with a code </> logo, white short-sleeve shirt with a loose black tie, very baggy black pants, red-and-white sneakers |
| **senpai** | young man with messy black hair and glasses, long olive-green coat, black shirt, baggy black cargo pants, black fingerless gloves, grey sneakers, small orange book tucked in his coat pocket |
| **ugly-grm** | young man with messy dark navy hair and glowing purple eyes, black hoodie, baggy black cargo pants with straps, black boots |
| **one-random-guy** | young dark-skinned man with a black cap, black parka with a tan fur-trimmed hood, black sweater vest over a white shirt with a red tie, baggy black pants, black-and-white sneakers |
| **seunn** | character with a grey stone Moai statue head and grey stone skin, white fedora with a green band, gold sunglasses, cigarette, red-and-white palm-print Hawaiian shirt, cream wide trousers, gold watch, brown monogram briefcase in one hand |
| **echo** | bald young man with pale skin and a serious face, black high-collar coat with purple lining, black tactical pants, black gloves, black camera on a strap |
| **salam** | dark shadow silhouette of a young man with curly hair, tattered flowing black cloak, entire body pure black with a thin white rim light (monochrome) |
| **raviel** | shirtless pale muscular young man with messy blond-white hair and grey eyes, white-and-red open shirt hanging off his arms, black pants with a belt, black shoes |
| **rex** | young brown-skinned man with short dreadlocks and blue eyes, black polo shirt with the number 3 and a crest, baggy black cargo pants with a chain, black-and-white sneakers |
| **noir** | (black-and-white ink style with red accents) young man with messy black hair and a black mask over the lower face, white open kimono-style coat with black kanji and ink splatter, black wide hakama pants, black shoes, katana held in hand |
| **rayan** | chibi-style boy with big blue eyes and black hair, blue snapback cap worn backwards with "SOL" and a gold crown, black suit jacket, white shirt, blue-and-white striped tie, black pants, blue-and-white sneakers |
| **yoshai** | tan-skinned muscular young man with messy brown hair and blue eyes, oversized grey t-shirt with a cracked pattern, baggy black pants, dark shoes |
| **crypto-baddie** | young brown-skinned woman with long brown dreadlocks and round glasses, black t-shirt with "Cryptobaddie" written on it, baggy olive cargo pants, pink-and-white sneakers, beaded bracelets |
| **arlecchino** | woman with long silver-white hair and red eyes, black gothic armoured outfit with red accents, short red-lined cape, black gloves, black thigh-high boots |
| **laka** | young man with spiky black hair and one glowing purple eye, dark purple-black high-collar robe open at the chest, purple sash, black pants, black boots |

---

## Sending them back

- Name each file `<fighter-id>-<pose>.png` (or `<fighter-id>-sheet1.png` for sheets).
- Send them here in the chat, as single images or a zip. A few fighters at a time is fine.
- White or plain backgrounds are fine; I remove the background myself.
- If one pose comes out wrong (facing left, cropped feet, different outfit), just redo that one.
  In the same chat say: *"Same character but facing right, full body, feet visible."*
