import Phaser from 'phaser';
import { FONT_BODY, GAME_W } from '../config';
import type { Difficulty, FighterData, GameMode, MatchSetup } from '../data/types';
import { tuningFor } from '../data/tuning';
import { STAGES } from '../fight/stages';
import { sfx } from '../audio/Sfx';
import { game } from '../state';
import { bodyText, fadeTo, goldText, menuBackdrop, MenuInput, muteButton } from '../ui/ui';

const COLS = 8;
const TILE = 78;
const GAP = 6;
const GRID_X = GAME_W / 2 - (COLS * TILE + (COLS - 1) * GAP) / 2 + TILE / 2;
const GRID_Y = 132;
const MOTIONS = ['↓↘→ + P', '→↓↘ + P', '↓↙← + K'];
const P_COLORS = [0xff3b3b, 0x3b9dff];

interface Cursor {
  index: number;
  locked: boolean;
  pick: string | null;
  frame: Phaser.GameObjects.Rectangle;
  tag: Phaser.GameObjects.Text;
}

interface Side {
  card: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  specials: Phaser.GameObjects.Text;
  lockText: Phaser.GameObjects.Text;
  shownId: string;
}

export class SelectScene extends Phaser.Scene {
  private mode: GameMode = 'cpu';
  private difficulty: Difficulty = 'normal';
  private cursors: Cursor[] = [];
  private sides: Side[] = [];
  private inputs: MenuInput[] = [];
  private tiles: Phaser.GameObjects.Container[] = [];
  private title!: Phaser.GameObjects.Text;
  private leaving = false;
  /** which cursor the mouse/touch and solo keyboard drive */
  private active = 0;

  constructor() {
    super('Select');
  }

  init(data: { mode?: GameMode; difficulty?: Difficulty }) {
    this.mode = data.mode ?? game.lastSetup?.mode ?? 'cpu';
    this.difficulty = data.difficulty ?? game.lastSetup?.difficulty ?? 'normal';
    this.leaving = false;
    this.active = 0;
    this.cursors = [];
    this.sides = [];
    this.tiles = [];
  }

  private get count() {
    return game.roster.length + 1; // + random tile
  }

  create() {
    this.cameras.main.fadeIn(250);
    menuBackdrop(this, 0x240804);
    this.title = goldText(this, GAME_W / 2, 50, 'SELECT YOUR FIGHTER', 54);
    muteButton(this);
    const back = bodyText(this, 30, 30, '◀ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.back());

    // grid
    for (let i = 0; i < this.count; i++) {
      const { x, y } = this.tilePos(i);
      const c = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, TILE, TILE, 0x0a0705).setStrokeStyle(2, 0x6b4d16);
      c.add(bg);
      if (i < game.roster.length) {
        const f = game.roster[i];
        const img = this.add.image(0, 0, `thumb-${f.id}`).setDisplaySize(TILE - 4, TILE - 4);
        c.add(img);
        const strip = this.add.rectangle(0, TILE / 2 - 3, TILE - 4, 4, tuningFor(f.id).accent);
        c.add(strip);
      } else {
        c.add(goldText(this, 0, 0, '?', 52));
      }
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        if (!game.isTouch) this.move(this.active, i, true);
      });
      bg.on('pointerdown', () => {
        sfx.unlock();
        this.move(this.active, i, true);
        this.confirm(this.active);
      });
      this.tiles.push(c);
    }

    // previews + info for both sides
    for (const s of [0, 1] as const) {
      const cx = s === 0 ? 148 : GAME_W - 148;
      const card = this.add.image(cx, 262, `card-${game.roster[0].id}`).setDisplaySize(240, 360);
      const name = goldText(this, cx, 470, '', 38);
      const sub = bodyText(this, s === 0 ? 20 : GAME_W - 20, 500, '', 22, '#d8cdb0').setOrigin(s === 0 ? 0 : 1, 0);
      const specials = this.add
        .text(s === 0 ? 20 : GAME_W - 20, 530, '', { fontFamily: FONT_BODY, fontSize: '19px', color: '#e8e2d0', lineSpacing: 3, wordWrap: { width: 600 }, align: s === 0 ? 'left' : 'right' })
        .setOrigin(s === 0 ? 0 : 1, 0);
      const lockText = goldText(this, cx, 262, '', 46).setAngle(-8).setVisible(false);
      this.sides.push({ card, name, sub, specials, lockText, shownId: '' });
    }

    const labels = this.mode === 'versus' ? ['P1', 'P2'] : this.mode === 'training' ? ['P1', 'DUMMY'] : ['P1', 'CPU'];
    for (const p of [0, 1] as const) {
      const frame = this.add.rectangle(0, 0, TILE + 6, TILE + 6).setStrokeStyle(4, P_COLORS[p]).setDepth(5);
      const tag = this.add
        .text(0, 0, labels[p], { fontFamily: FONT_BODY, fontSize: '18px', color: '#fff', backgroundColor: '#' + P_COLORS[p].toString(16) })
        .setPadding(4, 0, 4, 0)
        .setOrigin(0.5)
        .setDepth(6);
      this.cursors.push({ index: p === 0 ? 0 : Math.min(7, this.count - 1), locked: false, pick: null, frame, tag });
    }
    // In 1-player modes the second cursor appears after P1 locks in.
    if (this.mode !== 'versus') this.setCursorVisible(1, false);

    this.inputs = [new MenuInput(this, 0, this.mode !== 'versus'), new MenuInput(this, 1)];
    // restore last picks for quick rematches
    if (game.lastSetup && game.lastSetup.mode === this.mode) {
      const i1 = game.roster.findIndex((f) => f.id === game.lastSetup!.p1);
      const i2 = game.roster.findIndex((f) => f.id === game.lastSetup!.p2);
      if (i1 >= 0) this.cursors[0].index = i1;
      if (i2 >= 0) this.cursors[1].index = i2;
    }
    this.refresh();
  }

  private tilePos(i: number) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { x: GRID_X + col * (TILE + GAP), y: GRID_Y + row * (TILE + GAP) + TILE / 2 };
  }

  private setCursorVisible(p: number, v: boolean) {
    this.cursors[p].frame.setVisible(v);
    this.cursors[p].tag.setVisible(v);
    this.sides[p].card.setVisible(v);
    this.sides[p].name.setVisible(v);
    this.sides[p].sub.setVisible(v);
    this.sides[p].specials.setVisible(v);
  }

  private move(p: number, index: number, absolute = false) {
    const c = this.cursors[p];
    if (c.locked) return;
    const n = absolute ? index : index;
    if (n === c.index) return;
    c.index = Phaser.Math.Clamp(n, 0, this.count - 1);
    sfx.play('select');
    this.refresh();
  }

  private step(p: number, dx: number, dy: number) {
    const c = this.cursors[p];
    if (c.locked) return;
    let col = c.index % COLS;
    let row = Math.floor(c.index / COLS);
    const rows = Math.ceil(this.count / COLS);
    col = (col + dx + COLS) % COLS;
    row = (row + dy + rows) % rows;
    let i = row * COLS + col;
    if (i >= this.count) i = dy !== 0 ? col : this.count - 1;
    this.move(p, i);
  }

  private confirm(p: number) {
    const c = this.cursors[p];
    if (c.locked || this.leaving) return;
    if (p === 1 && this.mode !== 'versus' && !this.cursors[0].locked) return;
    c.locked = true;
    c.pick = c.index >= game.roster.length ? Phaser.Utils.Array.GetRandom(game.roster).id : game.roster[c.index].id;
    sfx.play('confirm');
    const side = this.sides[p];
    this.showFighter(p, c.pick);
    side.lockText.setText(this.mode === 'versus' || p === 0 ? 'LOCKED IN' : this.mode === 'training' ? 'DUMMY' : 'OPPONENT').setVisible(true).setScale(2).setAlpha(0);
    this.tweens.add({ targets: side.lockText, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.cameras.main.flash(120, 255, 210, 120);
    if (this.mode !== 'versus' && p === 0) {
      this.active = 1;
      this.setCursorVisible(1, true);
      this.title.setText(this.mode === 'training' ? 'CHOOSE A TRAINING DUMMY' : 'CHOOSE YOUR OPPONENT');
      this.refresh();
    }
    if (this.cursors.every((k) => k.locked)) this.start();
  }

  private back() {
    sfx.play('back');
    // unlock the most recent pick first
    for (const p of [1, 0]) {
      const c = this.cursors[p];
      if (c.locked) {
        c.locked = false;
        c.pick = null;
        this.sides[p].lockText.setVisible(false);
        if (this.mode !== 'versus' && p === 0) {
          this.active = 0;
          this.setCursorVisible(1, false);
          this.title.setText('SELECT YOUR FIGHTER');
        }
        this.refresh();
        return;
      }
    }
    fadeTo(this, 'Mode');
  }

  private start() {
    this.leaving = true;
    const setup: MatchSetup = {
      mode: this.mode,
      difficulty: this.difficulty,
      p1: this.cursors[0].pick!,
      p2: this.cursors[1].pick!,
      stage: Phaser.Utils.Array.GetRandom(STAGES).id,
    };
    game.lastSetup = setup;
    this.time.delayedCall(600, () => fadeTo(this, this.mode === 'training' ? 'Fight' : 'Versus', setup));
  }

  private showFighter(p: number, id: string | null) {
    const side = this.sides[p];
    if (!id) {
      side.card.setTexture('card-' + game.roster[0].id).setTint(0x111111);
      side.name.setText('RANDOM');
      side.sub.setText('Feeling lucky?');
      side.specials.setText('');
      side.shownId = '';
      return;
    }
    if (side.shownId === id) return;
    side.shownId = id;
    const f = game.roster.find((r) => r.id === id) as FighterData;
    side.card.setTexture(`card-${id}`).clearTint().setDisplaySize(240, 360);
    side.name.setText(f.name.toUpperCase());
    const handle = f.handle ?? '';
    side.sub.setText(`${handle}${handle ? '  ·  ' : ''}${f.archetype}`);
    side.specials.setText(f.specials.map((s, i) => `${s.name.toUpperCase()}  [${MOTIONS[i]}]\n   ${s.description}`).join('\n'));
    this.tweens.add({ targets: side.card, scaleX: { from: side.card.scaleX * 0.9, to: side.card.scaleX }, duration: 120 });
  }

  private refresh() {
    for (const p of [0, 1]) {
      const c = this.cursors[p];
      const { x, y } = this.tilePos(c.index);
      const both = this.cursors[0].index === this.cursors[1].index && this.cursors[1].frame.visible;
      c.frame.setPosition(x, y);
      c.frame.setSize(TILE + 6 + (both && p === 1 ? 8 : 0), TILE + 6 + (both && p === 1 ? 8 : 0));
      c.frame.setStrokeStyle(4, P_COLORS[p], c.locked ? 1 : 0.9);
      c.tag.setPosition(x + (p === 0 ? -TILE / 4 : TILE / 4), y - TILE / 2 - 6);
      if (!c.locked) this.showFighter(p, c.index < game.roster.length ? game.roster[c.index].id : null);
    }
  }

  update(t: number) {
    if (this.leaving) return;
    for (const p of [0, 1] as const) {
      // in 1P modes, P1's controls drive whichever cursor is active
      const src = this.mode === 'versus' ? this.inputs[p] : p === 0 ? this.inputs[0] : null;
      if (!src) continue;
      const press = src.poll();
      const target = this.mode === 'versus' ? p : this.active;
      if (press.back) {
        this.back();
        return;
      }
      if (press.left) this.step(target, -1, 0);
      if (press.right) this.step(target, 1, 0);
      if (press.up) this.step(target, 0, -1);
      if (press.down) this.step(target, 0, 1);
      if (press.ok) this.confirm(target);
    }
    // pulse active frames
    for (const c of this.cursors) c.frame.setAlpha(c.locked ? 1 : 0.65 + 0.35 * Math.sin(t / 120));
  }
}
