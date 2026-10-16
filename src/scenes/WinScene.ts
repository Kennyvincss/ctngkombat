import Phaser from 'phaser';
import { GAME_H } from '../config';
import type { MatchSetup } from '../data/types';
import { tuningFor } from '../data/tuning';
import { STAGES } from '../fight/stages';
import { sfx } from '../audio/Sfx';
import { fighterById, game } from '../state';
import { bodyText, fadeTo, goldText, ListMenu, menuBackdrop, MenuInput, muteButton, fitCamera, showDisconnected } from '../ui/ui';
import { net } from '../net/Net';

interface WinData {
  setup: MatchSetup;
  winner: string;
  winnerSide: 0 | 1;
  fatality: boolean;
  flawless: boolean;
}

export class WinScene extends Phaser.Scene {
  private menu!: ListMenu;
  private input0!: MenuInput;

  constructor() {
    super('Win');
  }

  create(data: WinData) {
    fitCamera(this);
    this.cameras.main.fadeIn(400);
    const f = fighterById(data.winner);
    const t = tuningFor(f.id);
    menuBackdrop(this, 0x2a0a04);

    const glow = this.add.image(330, GAME_H / 2, 'dot').setScale(30).setTint(t.accent).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 1200 });
    const card = this.add.image(330, GAME_H / 2, `card-${f.id}`).setDisplaySize(420, 630).setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 400 });
    this.tweens.add({ targets: card, y: card.y - 8, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });

    const online = data.setup.mode === 'online';
    const who =
      data.setup.mode === 'cpu'
        ? data.winnerSide === 0
          ? 'YOU WIN'
          : 'CPU WINS'
        : online
          ? data.winnerSide === net.localSide
            ? 'YOU WIN'
            : 'YOU LOSE'
          : data.setup.mode === 'versus'
            ? `PLAYER ${data.winnerSide + 1} WINS`
            : 'WINNER';
    bodyText(this, 900, 80, who, 34, '#d8cdb0').setOrigin(0.5);
    const name = goldText(this, 900, 160, f.name.toUpperCase(), 92);
    name.setShadow(0, 0, '#' + t.accent.toString(16).padStart(6, '0'), 24, true, true);
    if (f.handle) bodyText(this, 900, 230, f.handle, 28, '#bfb59a').setOrigin(0.5);

    const tags: string[] = [];
    if (data.fatality) tags.push('FATALITY');
    if (data.flawless) tags.push('FLAWLESS VICTORY');
    if (tags.length) goldText(this, 900, 285, tags.join('  ·  '), 34, { color: '#ff5a2a' });

    bodyText(this, 900, 350, `“${t.quote}”`, 30, '#ffffff', { wordWrap: { width: 600 }, align: 'center' }).setOrigin(0.5);

    if (online) {
      this.onlineMenu(data);
      this.input0 = new MenuInput(this, 0);
      muteButton(this);
      sfx.play('announce');
      return;
    }
    this.menu = new ListMenu(this, 900, 470, ['REMATCH', 'CHARACTER SELECT', 'TITLE'], (i) => {
      this.menu.enabled = false;
      if (i === 0) {
        const s = { ...data.setup, stage: Phaser.Utils.Array.GetRandom(STAGES).id };
        game.lastSetup = s;
        fadeTo(this, 'Versus', s);
      } else if (i === 1) fadeTo(this, 'Select', { mode: data.setup.mode, difficulty: data.setup.difficulty });
      else fadeTo(this, 'Title');
    }, 64, 42);
    this.input0 = new MenuInput(this, 0);
    muteButton(this);
    sfx.play('announce');
  }

  /** online: a rematch needs both players; either can go back to character select */
  private onlineMenu(data: WinData) {
    let wantMe = false;
    let wantThem = false;
    let gone = false;
    const status = bodyText(this, 900, 660, '', 24, '#ffd23f').setOrigin(0.5);
    const go = (key: string, payload?: object) => {
      if (gone) return;
      gone = true;
      this.menu.enabled = false;
      fadeTo(this, key, payload);
    };
    const tryRematch = () => {
      if (!wantMe || !wantThem || gone) return;
      if (net.role !== 'host') return; // the host starts it and sends the setup
      const s: MatchSetup = { ...data.setup, stage: Phaser.Utils.Array.GetRandom(STAGES).id, ...net.newMatch() };
      net.send({ t: 'start', setup: s });
      game.lastSetup = s;
      go('Versus', s);
    };
    this.menu = new ListMenu(this, 900, 470, ['REMATCH', 'CHARACTER SELECT', 'LEAVE'], (i) => {
      if (i === 0) {
        if (wantMe) return;
        wantMe = true;
        net.send({ t: 'rematch' });
        status.setText(wantThem ? 'Starting…' : 'Waiting for your opponent to accept…');
        tryRematch();
      } else if (i === 1) {
        net.send({ t: 'select' });
        go('Select', { mode: 'online', difficulty: 'normal' });
      } else {
        net.leave();
        go('Title');
      }
    }, 64, 42);
    net.listen(this, (m) => {
      if (m.t === 'rematch') {
        wantThem = true;
        status.setText(wantMe ? 'Starting…' : 'Your opponent wants a REMATCH');
        tryRematch();
      } else if (m.t === 'select') go('Select', { mode: 'online', difficulty: 'normal' });
      else if (m.t === 'start') {
        game.lastSetup = m.setup;
        go('Versus', m.setup);
      }
    });
    net.onClose(this, () => {
      if (!gone) showDisconnected(this);
    });
  }

  update() {
    const p = this.input0.poll();
    this.menu.handle(p);
  }
}
