import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import type { MatchSetup } from '../data/types';
import { tuningFor } from '../data/tuning';
import { STAGES } from '../fight/stages';
import { sfx } from '../audio/Sfx';
import { fighterById, game } from '../state';
import { bodyText, fadeTo, goldText, ListMenu, menuBackdrop, MenuInput, muteButton, fitCamera, screenEdges, showDisconnected } from '../ui/ui';
import { walletRow } from '../ui/tip';
import { canShareFile, cardFile, cardFileName, cardShareText, downloadCard, drawResultCard, shareCard, type CardInfo } from '../ui/resultCard';
import { net } from '../net/Net';

interface WinData {
  setup: MatchSetup;
  winner: string;
  winnerSide: 0 | 1;
  fatality: boolean;
  flawless: boolean;
  /** rounds won by side 0 and side 1 */
  wins?: [number, number];
}

export class WinScene extends Phaser.Scene {
  private menu!: ListMenu;
  private input0!: MenuInput;
  /** the result card preview, while it's open */
  private cardView: { layer: Phaser.GameObjects.Container; menu: ListMenu } | null = null;
  private result!: WinData;

  constructor() {
    super('Win');
  }

  create(data: WinData) {
    this.result = data;
    this.cardView = null;
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
    bodyText(this, 900, 62, who, 32, '#d8cdb0').setOrigin(0.5);
    const name = goldText(this, 900, 136, f.name.toUpperCase(), 84);
    name.setShadow(0, 0, '#' + t.accent.toString(16).padStart(6, '0'), 24, true, true);
    if (f.handle) bodyText(this, 900, 198, f.handle, 26, '#bfb59a').setOrigin(0.5);

    const tags: string[] = [];
    if (data.fatality) tags.push('FATALITY');
    if (data.flawless) tags.push('FLAWLESS VICTORY');
    if (tags.length) goldText(this, 900, 244, tags.join('  ·  '), 32, { color: '#ff5a2a' });

    bodyText(this, 900, 302, `“${t.quote}”`, 26, '#ffffff', { wordWrap: { width: 600 }, align: 'center' }).setOrigin(0.5);
    this.tipStrip();

    if (online) {
      this.onlineMenu(data);
      this.input0 = new MenuInput(this, 0);
      muteButton(this);
      sfx.play('announce');
      return;
    }
    this.menu = new ListMenu(this, 900, 392, ['REMATCH', 'MY RESULT CARD', 'CHARACTER SELECT', 'TITLE'], (i) => {
      if (i === 1) {
        void this.openCard();
        return;
      }
      this.menu.enabled = false;
      if (i === 0) {
        const s = { ...data.setup, stage: Phaser.Utils.Array.GetRandom(STAGES).id };
        game.lastSetup = s;
        fadeTo(this, 'Versus', s);
      } else if (i === 1) fadeTo(this, 'Select', { mode: data.setup.mode, difficulty: data.setup.difficulty });
      else fadeTo(this, 'Title');
    }, 50, 36);
    this.input0 = new MenuInput(this, 0);
    muteButton(this);
    sfx.play('announce');
  }

  /** online: a rematch needs both players; either can go back to character select */
  private onlineMenu(data: WinData) {
    let wantMe = false;
    let wantThem = false;
    let gone = false;
    const status = bodyText(this, 900, 590, '', 22, '#ffd23f').setOrigin(0.5);
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
    this.menu = new ListMenu(this, 900, 392, ['REMATCH', 'MY RESULT CARD', 'CHARACTER SELECT', 'LEAVE'], (i) => {
      if (i === 1) {
        void this.openCard();
        return;
      }
      if (i === 0) {
        if (wantMe) return;
        wantMe = true;
        net.send({ t: 'rematch' });
        status.setText(wantThem ? 'Starting…' : 'Waiting for your opponent to accept…');
        tryRematch();
      } else if (i === 2) {
        net.send({ t: 'select' });
        go('Select', { mode: 'online', difficulty: 'normal' });
      } else {
        net.leave();
        go('Title');
      }
    }, 50, 36);
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

  // ---------------------------------------------------------------- tip the creator
  /** after every match: the creator's wallet with a COPY button (C on the keyboard) */
  private tipStrip() {
    const title = goldText(this, 900, 628, 'TIP THE CREATOR  ·  SOLANA', 24);
    const row = walletRow(this, 900, 672, 17, (ok) => {
      title.setText(ok ? 'COPIED!  THANK YOU' : 'TIP THE CREATOR  ·  SOLANA');
      this.time.delayedCall(2200, () => title.active && title.setText('TIP THE CREATOR  ·  SOLANA'));
    });
    void row;
    this.input.keyboard?.on('keydown-C', () => row.copy());
  }

  // ---------------------------------------------------------------- result card
  /** whose card: the player (P1 against the CPU, this device's side online, the winner locally) */
  private cardInfo(): CardInfo {
    const d = this.result;
    const s = d.setup;
    const mySide: 0 | 1 = s.mode === 'online' ? net.localSide : s.mode === 'cpu' ? 0 : d.winnerSide;
    const ids = [s.p1, s.p2];
    const wins = d.wins ?? [d.winnerSide === 0 ? 2 : 0, d.winnerSide === 1 ? 2 : 0];
    const won = mySide === d.winnerSide;
    const modeLabel =
      s.mode === 'cpu' ? `VS CPU  ·  ${s.difficulty.toUpperCase()}` : s.mode === 'online' ? 'ONLINE MATCH' : s.mode === 'versus' ? 'LOCAL VERSUS' : 'TRAINING';
    return {
      me: fighterById(ids[mySide]),
      opp: fighterById(ids[1 - mySide]),
      won,
      score: [wins[mySide], wins[1 - mySide]],
      fatality: d.fatality,
      flawless: d.flawless,
      mode: modeLabel,
    };
  }

  private async openCard() {
    if (this.cardView) return;
    this.menu.enabled = false;
    const info = this.cardInfo();
    const canvas = await drawResultCard(this, info);
    const file = await cardFile(canvas, cardFileName(info));
    if (!this.scene.isActive()) return;
    if (this.textures.exists('result-card')) this.textures.remove('result-card');
    this.textures.addCanvas('result-card', canvas);

    const e = screenEdges(this);
    const c = this.add.container(0, 0).setDepth(80);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, e.right - e.left + 40, e.bottom - e.top + 40, 0x050303, 1).setInteractive());
    const prevH = 620;
    const img = this.add.image(GAME_W / 2 - 200, GAME_H / 2, 'result-card').setDisplaySize((prevH * canvas.width) / canvas.height, prevH);
    c.add(img);
    c.add(goldText(this, 960, 150, info.won ? 'YOUR WIN CARD' : 'YOUR LOSE CARD', 46));
    c.add(bodyText(this, 960, 200, 'Save it and post it. Tag the fighters!', 24, '#d8cdb0').setOrigin(0.5));
    const status = bodyText(this, 960, 560, '', 22, '#7dff9a').setOrigin(0.5).setWordWrapWidth(460).setAlign('center');
    c.add(status);
    const share = !!file && game.isTouch && canShareFile(file);
    const labels = [...(share ? ['SHARE'] : []), 'DOWNLOAD', 'CLOSE'];
    const menu = new ListMenu(this, 960, 300, labels, (i) => {
      const what = labels[i];
      if (what === 'CLOSE') return this.closeCard();
      if (!file) return status.setColor('#ffb35a').setText("Couldn't make the image on this device.");
      if (what === 'SHARE') {
        void shareCard(file, cardShareText(info)).then((r) => {
          if (r === 'failed') {
            downloadCard(file);
            status.setColor('#7dff9a').setText('Saved the card. Post it from your photos or downloads.');
          } else if (r === 'shared') status.setColor('#7dff9a').setText('Shared!');
        });
      } else {
        downloadCard(file);
        status.setColor('#7dff9a').setText(game.isTouch ? 'Saved! Find it in your downloads or photos.' : 'Saved to your downloads folder.');
      }
    }, 72, 44).setDepth(81);
    c.add(bodyText(this, 960, 640, game.isTouch ? '' : 'Enter / gamepad A: choose   ·   Esc / gamepad B: close', 20, '#8c8270').setOrigin(0.5));
    this.cardView = { layer: c, menu };
  }

  private closeCard() {
    if (!this.cardView) return;
    sfx.play('back');
    this.cardView.menu.destroy();
    this.cardView.layer.destroy();
    this.cardView = null;
    this.menu.enabled = true;
  }

  update() {
    const p = this.input0.poll();
    if (this.cardView) {
      if (p.back) this.closeCard();
      else this.cardView.menu.handle(p);
      return;
    }
    this.menu.handle(p);
  }
}
