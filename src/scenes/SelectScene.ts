import Phaser from 'phaser';
import { FONT_BODY, GAME_W } from '../config';
import type { Difficulty, FighterData, GameMode, MatchSetup } from '../data/types';
import { tuningFor } from '../data/tuning';
import { STAGES } from '../fight/stages';
import { sfx } from '../audio/Sfx';
import { game } from '../state';
import { controlDevice, specialCommand } from '../ui/controlHelp';
import { bodyText, fadeTo, goldText, menuBackdrop, MenuInput, muteButton, fitCamera, showDisconnected } from '../ui/ui';
import { net } from '../net/Net';
import { selectable } from '../custom/customFighters';

const GAP = 4;
const GRID_TOP = 94;
/** the space between the two side previews that the grid gets */
const GRID_W = 820;
const GRID_H = 400;

/** big portraits while the roster is small, shrinking to fit (up to 10 across) as it grows */
function gridLayout(count: number) {
  const cols = count <= 8 ? Math.ceil(count / 2) : Math.min(10, count);
  const rows = Math.ceil(count / cols);
  const tile = Math.min(130, Math.floor((GRID_W - (cols - 1) * GAP) / cols), Math.floor((GRID_H - (rows - 1) * GAP) / rows));
  const x0 = GAME_W / 2 - (cols * tile + (cols - 1) * GAP) / 2 + tile / 2;
  const y0 = GRID_TOP + (GRID_H - (rows * tile + (rows - 1) * GAP)) / 2;
  return { cols, rows, tile, x0, y0 };
}
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
  private grid = gridLayout(1);
  /** the cast, then fighters made by players (this device's, and online the opponent's) */
  private roster: FighterData[] = [];
  private title!: Phaser.GameObjects.Text;
  private leaving = false;
  /** which cursor the mouse/touch and solo keyboard drive */
  private active = 0;
  /** the open "PLAY AS …?" question */
  private ask: { p: number; id: string; layer: Phaser.GameObjects.Container; btns: Phaser.GameObjects.Rectangle[]; sel: number } | null = null;

  constructor() {
    super('Select');
  }

  init(data: { mode?: GameMode; difficulty?: Difficulty }) {
    this.mode = data.mode ?? game.lastSetup?.mode ?? 'cpu';
    this.difficulty = data.difficulty ?? game.lastSetup?.difficulty ?? 'normal';
    this.leaving = false;
    this.active = 0;
    this.ask = null;
    this.cursors = [];
    this.sides = [];
    this.tiles = [];
    this.roster = selectable(this.mode === 'online', this.mode === 'online' ? net.localSide : 0);
  }

  private get online() {
    return this.mode === 'online';
  }

  /** online: which cursor this device controls */
  private get me(): 0 | 1 {
    return this.online ? net.localSide : 0;
  }

  private get count() {
    return this.roster.length + 1; // + random tile
  }

  create() {
    fitCamera(this);
    this.cameras.main.fadeIn(250);
    menuBackdrop(this, 0x240804);
    this.title = goldText(this, GAME_W / 2, 50, 'SELECT YOUR FIGHTER', 54);
    muteButton(this);
    const back = bodyText(this, 30, 30, '◄ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.back());

    // grid
    this.grid = gridLayout(this.count);
    const TILE = this.grid.tile;
    for (let i = 0; i < this.count; i++) {
      const { x, y } = this.tilePos(i);
      const c = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, TILE, TILE, 0x0a0705).setStrokeStyle(2, 0x6b4d16);
      c.add(bg);
      if (i < this.roster.length) {
        const f = this.roster[i];
        const img = this.add.image(0, 0, `thumb-${f.id}`).setDisplaySize(TILE - 4, TILE - 4);
        c.add(img);
        const strip = this.add.rectangle(0, TILE / 2 - 3, TILE - 4, 4, tuningFor(f.id).accent);
        c.add(strip);
      } else {
        c.add(goldText(this, 0, 0, '?', 46));
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
      const cx = s === 0 ? 118 : GAME_W - 118;
      const card = this.add.image(cx, 250, `card-${this.roster[0].id}`).setDisplaySize(200, 300);
      const name = goldText(this, cx, 436, '', 38);
      const sub = bodyText(this, s === 0 ? 20 : GAME_W - 20, 500, '', 22, '#d8cdb0').setOrigin(s === 0 ? 0 : 1, 0);
      const specials = this.add
        .text(s === 0 ? 20 : GAME_W - 20, 530, '', { fontFamily: FONT_BODY, fontSize: '19px', color: '#e8e2d0', lineSpacing: 3, wordWrap: { width: 600 }, align: s === 0 ? 'left' : 'right' })
        .setOrigin(s === 0 ? 0 : 1, 0);
      const lockText = goldText(this, cx, 250, '', 46).setAngle(-8).setVisible(false);
      this.sides.push({ card, name, sub, specials, lockText, shownId: '' });
    }

    const labels = this.online
      ? net.localSide === 0
        ? ['YOU', 'RIVAL']
        : ['RIVAL', 'YOU']
      : this.mode === 'versus'
        ? ['P1', 'P2']
        : this.mode === 'training'
          ? ['P1', 'DUMMY']
          : ['P1', 'CPU'];
    for (const p of [0, 1] as const) {
      const frame = this.add.rectangle(0, 0, TILE + 6, TILE + 6).setStrokeStyle(4, P_COLORS[p]).setDepth(5);
      const tag = this.add
        .text(0, 0, labels[p], { fontFamily: FONT_BODY, fontSize: '18px', color: '#fff', backgroundColor: '#' + P_COLORS[p].toString(16) })
        .setPadding(4, 0, 4, 0)
        .setOrigin(0.5)
        .setDepth(6);
      this.cursors.push({ index: p === 0 ? 0 : Math.min(this.grid.cols - 1, this.count - 1), locked: false, pick: null, frame, tag });
    }
    // In 1-player modes the second cursor appears after P1 locks in.
    if (this.mode !== 'versus' && !this.online) this.setCursorVisible(1, false);
    if (this.online) {
      this.active = this.me;
      this.title.setText('SELECT YOUR FIGHTER · ONLINE');
      net.listen(this, (m) => {
        const them = (1 - this.me) as 0 | 1;
        if (m.t === 'cursor') this.move(them, m.i, true, true);
        else if (m.t === 'lock') this.lockIn(them, m.id);
        else if (m.t === 'unlock') this.unlock(them);
        else if (m.t === 'start') this.launch(m.setup);
      });
      net.onClose(this, () => showDisconnected(this));
      // tell the other player where our cursor starts
      this.time.delayedCall(200, () => net.send({ t: 'cursor', i: this.cursors[this.me].index }));
    }

    this.inputs = [new MenuInput(this, 0, this.mode !== 'versus'), new MenuInput(this, 1)];
    // restore last picks for quick rematches
    if (game.lastSetup && game.lastSetup.mode === this.mode) {
      const i1 = this.roster.findIndex((f) => f.id === game.lastSetup!.p1);
      const i2 = this.roster.findIndex((f) => f.id === game.lastSetup!.p2);
      if (i1 >= 0) this.cursors[0].index = i1;
      if (i2 >= 0) this.cursors[1].index = i2;
    }
    this.refresh();
  }

  private tilePos(i: number) {
    const { cols, tile, x0, y0 } = this.grid;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // a short last row sits centred
    const inRow = Math.min(cols, this.count - row * cols);
    return { x: x0 + ((cols - inRow) * (tile + GAP)) / 2 + col * (tile + GAP), y: y0 + row * (tile + GAP) + tile / 2 };
  }

  private setCursorVisible(p: number, v: boolean) {
    this.cursors[p].frame.setVisible(v);
    this.cursors[p].tag.setVisible(v);
    this.sides[p].card.setVisible(v);
    this.sides[p].name.setVisible(v);
    this.sides[p].sub.setVisible(v);
    this.sides[p].specials.setVisible(v);
  }

  private move(p: number, index: number, absolute = false, remote = false) {
    const c = this.cursors[p];
    if (c.locked) return;
    const n = absolute ? index : index;
    if (n === c.index) return;
    c.index = Phaser.Math.Clamp(n, 0, this.count - 1);
    if (!remote) sfx.play('select');
    if (this.online && !remote && p === this.me) net.send({ t: 'cursor', i: c.index });
    this.refresh();
  }

  private step(p: number, dx: number, dy: number) {
    const c = this.cursors[p];
    if (c.locked) return;
    const { cols, rows } = this.grid;
    let col = c.index % cols;
    let row = Math.floor(c.index / cols);
    col = (col + dx + cols) % cols;
    row = (row + dy + rows) % rows;
    let i = row * cols + col;
    if (i >= this.count) i = dy !== 0 ? col : this.count - 1;
    this.move(p, i);
  }

  /** a pick asks first: "PLAY AS …?" with CONFIRM / CANCEL */
  private confirm(p: number) {
    const c = this.cursors[p];
    if (c.locked || this.leaving || this.ask) return;
    if (p === 1 && this.mode !== 'versus' && !this.online && !this.cursors[0].locked) return;
    if (this.online && p !== this.me) return;
    const random = c.index >= this.roster.length;
    const id = random ? Phaser.Utils.Array.GetRandom(this.roster).id : this.roster[c.index].id;
    sfx.play('select');
    this.openAsk(p, id, random);
  }

  private openAsk(p: number, id: string, random: boolean) {
    const f = this.roster.find((r) => r.id === id) as FighterData;
    const accent = tuningFor(id).accent;
    const layer = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(GAME_W / 2, 360, GAME_W + 1600, 720 + 800, 0x000000, 0.7).setInteractive();
    const panel = this.add.rectangle(GAME_W / 2, 360, 640, 400, 0x0a0705, 0.96).setStrokeStyle(4, accent);
    const card = this.add.image(GAME_W / 2 - 180, 352, `card-${id}`).setDisplaySize(200, 300);
    const question =
      this.mode === 'versus'
        ? `PLAYER ${p + 1}: PLAY AS`
        : p === 0
          ? 'PLAY AS'
          : this.mode === 'training'
            ? 'TRAIN AGAINST'
            : 'FIGHT AGAINST';
    const q = bodyText(this, GAME_W / 2 + 120, 210, (random ? 'RANDOM PICK · ' : '') + question, 24, '#d8cdb0').setOrigin(0.5);
    const name = goldText(this, GAME_W / 2 + 120, 262, f.name.toUpperCase() + '?', f.name.length > 11 ? 44 : 56);
    const sub = bodyText(this, GAME_W / 2 + 120, 326, `${f.handle ?? ''}\n${f.archetype}`, 20, '#bfb59a').setOrigin(0.5).setAlign('center');
    layer.add([dim, panel, card, q, name, sub]);
    let armed = -1;
    const btns = (['CONFIRM', 'CANCEL'] as const).map((label, i) => {
      const x = GAME_W / 2 + 30 + i * 190;
      const bg = this.add.rectangle(x, 470, 170, 58, i === 0 ? 0x8a5a00 : 0x2a1a10, 1).setStrokeStyle(3, 0xf5c542).setInteractive({ useHandCursor: true });
      const t = goldText(this, x, 470, label, 32);
      bg.on('pointerover', () => this.askSelect(i));
      // act only on a full tap of the button: the tap that opened this box may lift over it
      bg.on('pointerdown', () => (armed = i));
      bg.on('pointerup', () => {
        if (armed === i) i === 0 ? this.askYes() : this.askNo();
      });
      layer.add([bg, t]);
      return bg;
    });
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 120 });
    this.ask = { p, id, layer, btns, sel: 0 };
    this.askSelect(0);
  }

  private askSelect(i: number) {
    if (!this.ask) return;
    this.ask.sel = i;
    this.ask.btns.forEach((b, k) => b.setStrokeStyle(k === i ? 5 : 2, k === i ? 0xffffff : 0xf5c542));
  }

  private askYes() {
    const a = this.ask;
    if (!a) return;
    a.layer.destroy();
    this.ask = null;
    this.lockIn(a.p, a.id);
  }

  private askNo() {
    if (!this.ask) return;
    sfx.play('back');
    this.ask.layer.destroy();
    this.ask = null;
  }

  private lockIn(p: number, id: string) {
    const c = this.cursors[p];
    if (c.locked) return;
    c.locked = true;
    c.pick = id;
    sfx.play('confirm');
    if (this.online && p === this.me) net.send({ t: 'lock', id });
    const side = this.sides[p];
    this.showFighter(p, c.pick);
    side.lockText.setText(this.mode === 'versus' || this.online || p === 0 ? 'LOCKED IN' : this.mode === 'training' ? 'DUMMY' : 'OPPONENT').setVisible(true).setScale(2).setAlpha(0);
    this.tweens.add({ targets: side.lockText, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.cameras.main.flash(120, 255, 210, 120);
    if (this.mode !== 'versus' && !this.online && p === 0) {
      this.active = 1;
      this.setCursorVisible(1, true);
      this.title.setText(this.mode === 'training' ? 'CHOOSE A TRAINING DUMMY' : 'CHOOSE YOUR OPPONENT');
      this.refresh();
    }
    if (this.cursors.every((k) => k.locked)) this.start();
  }

  /** online: a player changed their mind */
  private unlock(p: number) {
    const c = this.cursors[p];
    if (!c.locked) return;
    c.locked = false;
    c.pick = null;
    this.sides[p].lockText.setVisible(false);
    this.refresh();
  }

  private back() {
    sfx.play('back');
    if (this.online) {
      if (this.cursors[this.me].locked) {
        if (this.leaving) return;
        this.unlock(this.me);
        net.send({ t: 'unlock' });
        return;
      }
      net.leave();
      fadeTo(this, 'Online');
      return;
    }
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
    const setup: MatchSetup = {
      mode: this.mode,
      difficulty: this.difficulty,
      p1: this.cursors[0].pick!,
      p2: this.cursors[1].pick!,
      stage: Phaser.Utils.Array.GetRandom(STAGES).id,
    };
    if (this.online) {
      // the room's creator decides the stage and the shared random seed
      if (net.role !== 'host') return;
      Object.assign(setup, net.newMatch());
      net.send({ t: 'start', setup });
    }
    this.launch(setup);
  }

  private launch(setup: MatchSetup) {
    if (this.leaving) return;
    this.leaving = true;
    game.lastSetup = setup;
    this.time.delayedCall(600, () => fadeTo(this, this.mode === 'training' ? 'Fight' : 'Versus', setup));
  }

  private showFighter(p: number, id: string | null) {
    const side = this.sides[p];
    if (!id) {
      side.card.setTexture('card-' + this.roster[0].id).setTint(0x111111);
      side.name.setText('RANDOM');
      side.sub.setText('Feeling lucky?');
      side.specials.setText('');
      side.shownId = '';
      return;
    }
    if (side.shownId === id) return;
    side.shownId = id;
    const f = this.roster.find((r) => r.id === id) as FighterData;
    side.card.setTexture(`card-${id}`).clearTint().setDisplaySize(200, 300);
    side.name.setText(f.name.toUpperCase());
    const handle = f.handle ?? '';
    side.sub.setText(`${handle}${handle ? '  ·  ' : ''}${f.archetype}`);
    const dev = controlDevice(this);
    side.specials.setText(f.specials.map((s, i) => `${s.name.toUpperCase()}  [${specialCommand(dev, i)}]\n   ${s.description}`).join('\n'));
    this.tweens.add({ targets: side.card, scaleX: { from: side.card.scaleX * 0.9, to: side.card.scaleX }, duration: 120 });
  }

  private refresh() {
    for (const p of [0, 1]) {
      const c = this.cursors[p];
      const { x, y } = this.tilePos(c.index);
      const both = this.cursors[0].index === this.cursors[1].index && this.cursors[1].frame.visible;
      c.frame.setPosition(x, y);
      c.frame.setSize(this.grid.tile + 6 + (both && p === 1 ? 8 : 0), this.grid.tile + 6 + (both && p === 1 ? 8 : 0));
      c.frame.setStrokeStyle(4, P_COLORS[p], c.locked ? 1 : 0.9);
      c.tag.setPosition(x + (p === 0 ? -this.grid.tile / 4 : this.grid.tile / 4), y - this.grid.tile / 2 - 6);
      if (!c.locked) this.showFighter(p, c.index < this.roster.length ? this.roster[c.index].id : null);
    }
  }

  update(t: number) {
    if (this.leaving) return;
    if (this.ask) {
      // the player who picked answers the question (P1's controls in 1-player modes)
      const src = this.mode === 'versus' ? this.inputs[this.ask.p] : this.inputs[0];
      const press = src.poll();
      if (press.left || press.right) this.askSelect(1 - this.ask.sel);
      if (press.ok) this.ask.sel === 0 ? this.askYes() : this.askNo();
      else if (press.back) this.askNo();
      return;
    }
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
