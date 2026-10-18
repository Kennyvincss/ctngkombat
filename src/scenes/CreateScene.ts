import Phaser from 'phaser';
import { FONT_BODY, GAME_H, GAME_W } from '../config';
import { sfx } from '../audio/Sfx';
import { game } from '../state';
import { FINISHERS } from '../fight/fatalities';
import { accentOf, cutOut, hsv, loadImage, portrait, type CutLevel } from '../custom/cutout';
import { BODIES, drawCard, MAX_CUSTOM, newId, register, saveCustoms, SPECIALS, STYLES, styleOf, type BodyKind, type CustomFighter } from '../custom/customFighters';
import { guessJoints, JOINT_NAMES, madeBody, mirror, type Joints } from '../custom/autoRig';
import { openRigEditor } from '../custom/rigEditor';
import { openPictureForm } from '../custom/pictureForm';
import { bodyText, fadeTo, fitCamera, goldText, menuBackdrop, MenuInput, muteButton } from '../ui/ui';

// CREATE FIGHTER: a player uploads a picture, names it, picks a style, three specials, a finisher
// and a colour, and saves it to this device. It then shows up at the end of the select screen in
// every mode (online, the other player gets it for that match).

type RowKey = 'slot' | 'picture' | 'cut' | 'body' | 'moves' | 'style' | 'm0' | 'm1' | 'm2' | 'finisher' | 'colour' | 'save' | 'delete';

const CUTS: CutLevel[] = ['soft', 'strong', 'off'];
const CUT_LABEL: Record<CutLevel, string> = { soft: 'REMOVED', strong: 'REMOVED (STRONG)', off: 'KEPT' };
const BODY_LABEL: Record<BodyKind, string> = { drawn: 'FIGHTER BODY', own: 'MY PICTURE’S BODY', classic: 'CLASSIC' };
/** a picture this much taller than wide shows a whole body (else it's a PFP: it gets a drawn body) */
const FULL_BODY_RATIO = 1.8;
/** colour choices: auto (from the picture), then a ring of hues */
const HUES = [-1, 0, 0.08, 0.15, 0.3, 0.45, 0.55, 0.62, 0.75, 0.85];

interface Draft {
  id: string | null;
  name: string;
  handle: string;
  photo: string;
  cut: CutLevel;
  style: number;
  moves: [number, number, number];
  finisher: number;
  hue: number;
  /** the cut-out for the current picture and background choice */
  art: HTMLCanvasElement | null;
  autoAccent: number;
  body: BodyKind;
  /** joints on the picture, for its own body */
  joints: Joints | null;
  /** the picture is mirrored */
  flip: boolean;
}

export class CreateScene extends Phaser.Scene {
  private input0!: MenuInput;
  private rows: { key: RowKey; label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Rectangle }[] = [];
  private sel = 0;
  private slot = 0;
  private draft!: Draft;
  private card!: Phaser.GameObjects.Image;
  private help!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private busy = false;
  private leaving = false;

  constructor() {
    super('Create');
  }

  create() {
    fitCamera(this);
    this.cameras.main.fadeIn(250);
    menuBackdrop(this, 0x1a0a24);
    goldText(this, GAME_W / 2, 52, 'CREATE YOUR FIGHTER', 54);
    this.input0 = new MenuInput(this, 0);
    this.busy = false;
    this.leaving = false;
    this.sel = 1;
    this.slot = game.customs.length < MAX_CUSTOM ? game.customs.length : 0;

    const back = bodyText(this, 30, 30, '◄ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.back());
    muteButton(this);

    // (the scene object is reused between visits: drop the last visit's placeholder)
    this.placeholderText = null;
    // the card area: tapping it (before there's a card) uploads a picture
    const cardArea = this.add.rectangle(250, 372, 330, 495, 0x1a1210).setStrokeStyle(3, 0x6b4d16).setInteractive({ useHandCursor: true });
    cardArea.on('pointerdown', () => this.uploadFromCard());
    this.card = this.add.image(250, 372, '__WHITE').setDisplaySize(330, 495).setVisible(false).setInteractive({ useHandCursor: true });
    this.card.on('pointerdown', () => this.uploadFromCard());
    this.help = bodyText(this, 840, 604, '', 20, '#d8cdb0').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(700);
    this.status = bodyText(this, GAME_W / 2, GAME_H - 26, '', 22, '#7dff9a').setOrigin(0.5);

    const keys: RowKey[] = ['slot', 'picture', 'cut', 'body', 'moves', 'style', 'm0', 'm1', 'm2', 'finisher', 'colour', 'save', 'delete'];
    const labels: Record<RowKey, string> = {
      slot: 'FIGHTER',
      picture: 'PICTURE & NAME',
      cut: 'BACKGROUND',
      body: 'BODY',
      moves: 'MOVES',
      style: 'STYLE',
      m0: 'SPECIAL 1',
      m1: 'SPECIAL 2',
      m2: 'SPECIAL 3',
      finisher: 'FINISHER',
      colour: 'COLOUR',
      save: 'SAVE FIGHTER',
      delete: 'DELETE',
    };
    this.rows = keys.map((key, i) => {
      const y = 104 + i * 38.5;
      const hit = this.add.rectangle(840, y, 700, 36, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      const action = key === 'save' || key === 'delete';
      const label = action ? goldText(this, 840, y, labels[key], 30) : bodyText(this, 500, y, labels[key], 24, '#bfb59a').setOrigin(0, 0.5);
      const value = goldText(this, 1180, y, '', 24).setOrigin(1, 0.5);
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        sfx.unlock();
        this.select(i);
        // tapping the left part of a value steps back, the right part steps forward
        if (this.isCycler(key)) this.change(p.worldX < 1000 ? -1 : 1);
        else this.activate();
      });
      return { key, label, value, hit };
    });
    this.loadSlot(this.slot);
    this.select(this.sel, true);
  }

  // ---------------------------------------------------------------- drafts

  private loadSlot(i: number) {
    this.slot = i;
    const c = game.customs[i];
    if (c) {
      this.draft = {
        id: c.id,
        name: c.name,
        handle: c.handle,
        photo: c.photo ?? '',
        cut: c.cut ?? 'soft',
        style: Math.max(0, STYLES.findIndex((s) => s.key === c.style)),
        moves: [...c.moves],
        finisher: c.finisher,
        hue: 0,
        art: null,
        autoAccent: c.accent,
        body: c.body ?? 'classic',
        joints: c.joints ?? null,
        flip: c.flip ?? false,
      };
      // the saved cut-out is what it plays with; a picture lets them re-cut it
      void loadImage(c.art).then((img) => {
        if (this.draft.id !== c.id) return;
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        cv.getContext('2d')!.drawImage(img, 0, 0);
        this.draft.art = cv;
        this.refresh();
      });
    } else {
      this.draft = {
        id: null,
        name: '',
        handle: '',
        photo: '',
        cut: 'soft',
        style: 0,
        moves: [...STYLES[0].kit],
        finisher: 0,
        hue: 0,
        art: null,
        autoAccent: 0xf5c542,
        body: 'drawn',
        joints: null,
        flip: false,
      };
    }
    this.refresh();
  }

  private accent() {
    const h = HUES[this.draft.hue];
    return h < 0 ? this.draft.autoAccent : hsv(h, 0.85, 1);
  }

  /** cut the picture out again for the current background choice */
  private async recut() {
    if (!this.draft.photo) return;
    const img = await loadImage(this.draft.photo);
    let art: HTMLCanvasElement | null = null;
    if (this.draft.cut !== 'off') {
      art = cutOut(img, this.draft.cut);
      if (!art) {
        this.say("Couldn't separate the background on this picture, so it's kept.", '#ffcf5a');
        this.draft.cut = 'off';
      }
    }
    art = art ?? portrait(img);
    if (this.draft.flip) art = mirror(art).art;
    this.draft.art = art;
    this.draft.autoAccent = accentOf(art);
    // a new cut-out: the joints are guessed again
    this.draft.joints = this.draft.body === 'own' ? guessJoints(art) : null;
    this.refresh();
  }

  // ---------------------------------------------------------------- the screen

  private isCycler(k: RowKey) {
    return k !== 'picture' && k !== 'moves' && k !== 'save' && k !== 'delete';
  }

  private select(i: number, silent = false) {
    const visible = this.rows.map((r, k) => (r.hit.visible ? k : -1)).filter((k) => k >= 0);
    if (!visible.includes(i)) i = visible[0];
    this.sel = i;
    this.rows.forEach((r, k) => {
      const on = k === i;
      r.label.setAlpha(on ? 1 : 0.7);
      r.value.setAlpha(on ? 1 : 0.75);
      r.label.setScale(on && !this.isCycler(r.key) && r.key !== 'picture' ? 1.08 : 1);
    });
    if (!silent) sfx.play('select');
    this.updateHelp();
  }

  private updateHelp() {
    const d = this.draft;
    const key = this.rows[this.sel].key;
    const text: Record<RowKey, string> = {
      slot: `Make up to ${MAX_CUSTOM} fighters. They're saved on this device.`,
      picture: 'Upload a picture (a PFP works) and name your fighter.',
      cut: 'Plain backgrounds cut out best. KEPT turns the picture into a framed portrait.',
      body: {
        drawn: 'Your picture becomes the head of a full fighter: arms, legs, punches and kicks all move. Best for PFPs.',
        own: "Your picture's own arms and legs move. For full-body pictures: open MOVES to place the joints.",
        classic: 'The whole picture moves as one piece.',
      }[d.body],
      moves: d.body === 'own' ? 'Place the joints on your picture and watch your fighter move.' : 'Watch your fighter punch, kick and jump.',
      style: styleOf(STYLES[d.style].key).blurb,
      m0: SPECIALS[d.moves[0]].description,
      m1: SPECIALS[d.moves[1]].description,
      m2: SPECIALS[d.moves[2]].description,
      finisher: FINISHERS[d.finisher].description,
      colour: 'Their glow, card and effects. AUTO picks it from the picture.',
      save: d.id ? 'Save your changes.' : 'Save this fighter. Then pick them at the end of the select screen.',
      delete: 'Delete this fighter from this device.',
    };
    this.help.setText(text[key] + (this.isCycler(key) ? '\n◄ ► to change' : ''));
  }

  private refresh() {
    const d = this.draft;
    const val: Partial<Record<RowKey, string>> = {
      slot: `◄ ${this.slot < game.customs.length ? game.customs[this.slot].name.toUpperCase() : 'NEW FIGHTER'} ►`,
      picture: d.name ? d.name.toUpperCase() + (d.handle ? `  @${d.handle}` : '') : 'TAP TO UPLOAD',
      cut: `◄ ${d.photo ? CUT_LABEL[d.cut] : '—'} ►`,
      body: `◄ ${BODY_LABEL[d.body]} ►`,
      moves: d.art ? (d.body === 'own' ? 'PLACE JOINTS ►' : 'SEE THEM ►') : '—',
      style: `◄ ${STYLES[d.style].label} ►`,
      m0: `◄ ${SPECIALS[d.moves[0]].name.toUpperCase()} ►`,
      m1: `◄ ${SPECIALS[d.moves[1]].name.toUpperCase()} ►`,
      m2: `◄ ${SPECIALS[d.moves[2]].name.toUpperCase()} ►`,
      finisher: `◄ ${FINISHERS[d.finisher].name.toUpperCase()} ►`,
      colour: `◄ ${HUES[d.hue] < 0 ? 'AUTO' : '●'} ►`,
    };
    for (const r of this.rows) {
      r.value.setText(val[r.key] ?? '');
      if (r.key === 'colour') r.value.setColor('#' + this.accent().toString(16).padStart(6, '0'));
    }
    const del = this.rows.find((r) => r.key === 'delete')!;
    for (const o of [del.hit, del.label, del.value]) o.setVisible(!!d.id);
    const moves = this.rows.find((r) => r.key === 'moves')!;
    for (const o of [moves.hit, moves.label, moves.value]) o.setVisible(d.body !== 'classic');
    // the live card
    const tex = this.textures;
    if (tex.exists('card-preview')) tex.remove('card-preview');
    if (d.art) {
      const figure = d.body === 'drawn' ? madeBody(d.art, this.accent()).art : d.art;
      tex.addCanvas('card-preview', drawCard(figure, d.name || 'YOUR FIGHTER', this.accent()));
      this.card.setTexture('card-preview').setDisplaySize(330, 495).setVisible(true);
    } else {
      this.card.setVisible(false);
      this.placeholder();
    }
    this.placeholderText?.setVisible(!d.art);
    this.updateHelp();
  }

  private placeholderText: Phaser.GameObjects.Text | null = null;

  private placeholder() {
    if (this.placeholderText) return;
    this.placeholderText = this.add
      .text(250, 372, 'UPLOAD A\nPICTURE', { fontFamily: FONT_BODY, fontSize: '40px', color: '#6b4d16', align: 'center' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.placeholderText.on('pointerdown', () => this.uploadFromCard());
  }

  private uploadFromCard() {
    if (this.busy || this.leaving) return;
    sfx.unlock();
    this.select(this.rows.findIndex((r) => r.key === 'picture'), true);
    void this.activate();
  }

  private say(text: string, color = '#7dff9a') {
    this.status.setText(text).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.status);
    this.tweens.add({ targets: this.status, alpha: 0, delay: 3500, duration: 600 });
  }

  // ---------------------------------------------------------------- changing things

  private change(dir: number) {
    const d = this.draft;
    const key = this.rows[this.sel].key;
    const wrap = (v: number, n: number) => (v + dir + n) % n;
    switch (key) {
      case 'slot': {
        const n = Math.min(MAX_CUSTOM, game.customs.length + 1);
        this.loadSlot(wrap(this.slot, n));
        break;
      }
      case 'cut':
        if (!d.photo) return;
        d.cut = CUTS[wrap(CUTS.indexOf(d.cut), CUTS.length)];
        void this.recut();
        break;
      case 'body':
        d.body = BODIES[wrap(BODIES.indexOf(d.body), BODIES.length)];
        if (d.body === 'own' && !d.joints && d.art) d.joints = guessJoints(d.art);
        break;
      case 'style': {
        const was = STYLES[d.style].kit;
        d.style = wrap(d.style, STYLES.length);
        // moves still on the old style's kit follow the new style
        d.moves = d.moves.map((m, i) => (m === was[i] ? STYLES[d.style].kit[i] : m)) as [number, number, number];
        break;
      }
      case 'm0':
      case 'm1':
      case 'm2': {
        const i = Number(key[1]);
        let m = d.moves[i];
        // no move twice
        do m = wrap(m, SPECIALS.length);
        while (d.moves.includes(m) && m !== d.moves[i]);
        d.moves[i] = m;
        break;
      }
      case 'finisher':
        d.finisher = wrap(d.finisher, FINISHERS.length);
        break;
      case 'colour':
        d.hue = wrap(d.hue, HUES.length);
        break;
      default:
        return;
    }
    sfx.play('select');
    this.refresh();
  }

  private async activate() {
    if (this.busy) return;
    const key = this.rows[this.sel].key;
    if (key === 'picture') {
      this.busy = true;
      sfx.play('confirm');
      const kb = this.input.keyboard;
      kb?.disableGlobalCapture();
      const r = await openPictureForm({ photo: this.draft.photo, name: this.draft.name, handle: this.draft.handle });
      kb?.enableGlobalCapture();
      this.busy = false;
      if (!r || this.leaving) return;
      const newPicture = r.photo !== this.draft.photo;
      Object.assign(this.draft, r);
      if (newPicture) {
        this.draft.cut = 'soft';
        this.draft.hue = 0;
        this.draft.flip = false;
        this.draft.body = 'drawn';
        await this.recut();
        // a whole-body picture moves its own limbs; a PFP gets a fighter's body
        const a = this.draft.art;
        if (a && (this.draft.cut as CutLevel) !== 'off' && a.height / a.width >= FULL_BODY_RATIO) {
          this.draft.body = 'own';
          this.draft.joints = guessJoints(a);
        }
        this.refresh();
      } else this.refresh();
    } else if (key === 'moves') await this.editMoves();
    else if (key === 'save') await this.save();
    else if (key === 'delete') this.remove();
    else this.change(1);
  }

  /** the MOVES screen: the fighter in action (and the joints, for their own body) */
  private async editMoves() {
    const d = this.draft;
    if (!d.art || d.body === 'classic') {
      if (!d.art) this.say('Upload a picture first.', '#ff5a5a');
      return;
    }
    this.busy = true;
    sfx.play('confirm');
    const r = await openRigEditor(this, { art: d.art, body: d.body, joints: d.joints, accent: this.accent() }, this.input0);
    this.busy = false;
    if (!r || this.leaving) return;
    d.art = r.art;
    d.joints = r.joints;
    if (r.flipped) d.flip = !d.flip;
    this.refresh();
  }

  private async save() {
    const d = this.draft;
    if (!d.art || !d.name) {
      this.say('Upload a picture and give your fighter a name first.', '#ff5a5a');
      sfx.play('back');
      return;
    }
    this.busy = true;
    // PNG keeps the cut-out's transparency; shrink it if it's very big
    let art = d.art.toDataURL('image/webp', 0.9);
    if (!art.startsWith('data:image/webp')) art = d.art.toDataURL('image/png');
    /** the saved picture's size against the cut-out's (joints scale with it) */
    let k = 1;
    if (art.length > 550_000) {
      const c = document.createElement('canvas');
      k = 0.75;
      c.width = Math.round(d.art.width * 0.75);
      c.height = Math.round(d.art.height * 0.75);
      c.getContext('2d')!.drawImage(d.art, 0, 0, c.width, c.height);
      art = c.toDataURL('image/png');
    }
    const f: CustomFighter = {
      id: d.id ?? newId(),
      name: d.name,
      handle: d.handle,
      style: STYLES[d.style].key,
      moves: [...d.moves],
      finisher: d.finisher,
      accent: this.accent(),
      art,
      photo: d.photo,
      cut: d.cut,
      body: d.body,
      joints: d.body === 'own' ? scaleJoints(d.joints ?? guessJoints(d.art), k) : undefined,
      flip: d.flip,
    };
    const list = [...game.customs];
    const at = list.findIndex((c) => c.id === f.id);
    if (at >= 0) list[at] = f;
    else list.push(f);
    if (!saveCustoms(list)) {
      // out of space: try again without the original pictures (the fighters still play)
      const slim = list.map((c) => (c.id === f.id ? c : { ...c, photo: undefined }));
      if (!saveCustoms(slim)) {
        this.busy = false;
        this.say("This device is out of space. Delete a fighter and try again.", '#ff5a5a');
        return;
      }
    }
    game.customs = list;
    await register(this, f);
    this.draft.id = f.id;
    this.slot = list.indexOf(f);
    this.busy = false;
    sfx.play('confirm');
    this.cameras.main.flash(150, 255, 210, 120);
    this.say(`${f.name.toUpperCase()} SAVED! Pick them at the end of the select screen.`);
    this.refresh();
  }

  private remove() {
    const id = this.draft.id;
    if (!id) return;
    const list = game.customs.filter((c) => c.id !== id);
    saveCustoms(list);
    game.customs = list;
    sfx.play('back');
    this.say('Fighter deleted.', '#ffcf5a');
    this.loadSlot(Math.min(this.slot, list.length));
    this.select(0, true);
  }

  private back() {
    if (this.leaving || this.busy) return;
    this.leaving = true;
    sfx.play('back');
    fadeTo(this, 'Mode');
  }

  update() {
    if (this.leaving || this.busy) return;
    const p = this.input0.poll();
    const visible = this.rows.map((r, k) => (r.hit.visible ? k : -1)).filter((k) => k >= 0);
    const at = visible.indexOf(this.sel);
    if (p.up) this.select(visible[(at - 1 + visible.length) % visible.length]);
    if (p.down) this.select(visible[(at + 1) % visible.length]);
    if (p.left && this.isCycler(this.rows[this.sel].key)) this.change(-1);
    if (p.right && this.isCycler(this.rows[this.sel].key)) this.change(1);
    if (p.ok) void this.activate();
    if (p.back) this.back();
  }
}

function scaleJoints(J: Joints, k: number): Joints {
  const out = {} as Joints;
  for (const n of JOINT_NAMES) out[n] = [Math.round(J[n][0] * k), Math.round(J[n][1] * k)];
  return out;
}
