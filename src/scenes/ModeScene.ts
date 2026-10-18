import Phaser from 'phaser';
import { GAME_H, GAME_W, GOLD_HEX } from '../config';
import type { Difficulty, GameMode } from '../data/types';
import { sfx } from '../audio/Sfx';
import { game } from '../state';
import { controlDevice, controlsLine } from '../ui/controlHelp';
import { addressRow } from '../ui/tip';
import { bodyText, fadeTo, goldText, ListMenu, menuBackdrop, MenuInput, muteButton, fitCamera } from '../ui/ui';

export class ModeScene extends Phaser.Scene {
  private menu!: ListMenu;
  private diffMenu: ListMenu | null = null;
  private input0!: MenuInput;
  private hint!: Phaser.GameObjects.Text;
  private hints: string[] = [];

  constructor() {
    super('Mode');
  }

  create() {
    fitCamera(this);
    this.cameras.main.fadeIn(250);
    menuBackdrop(this, 0x2a0a04);
    goldText(this, GAME_W / 2, 80, 'CHOOSE YOUR BATTLE', 64);
    this.input0 = new MenuInput(this, 0);
    this.diffMenu = null;

    const modes: { label: string; mode: GameMode | 'tip' | 'create'; hint: string }[] = [
      { label: 'VS CPU', mode: 'cpu', hint: 'Fight the computer. Pick your fighter, then your opponent.' },
      { label: 'VS PLAYER 2', mode: 'versus', hint: 'Two players on one keyboard (or two gamepads).' },
      { label: 'PLAY ONLINE', mode: 'online', hint: 'Fight a friend on their own device with a room code.' },
      { label: 'TRAINING', mode: 'training', hint: 'Infinite health and meter, with the move list on screen.' },
      { label: 'CREATE FIGHTER', mode: 'create', hint: 'Upload a picture and turn it into your own fighter.' },
      { label: 'CONTRACT ADDRESS', mode: 'tip', hint: 'The $TK contract address, with a button to copy it.' },
    ];
    this.menu = new ListMenu(this, GAME_W / 2, 176, modes.map((m) => m.label), (i) => {
      const m = modes[i].mode;
      if (m === 'tip') this.openTip();
      else if (m === 'create') {
        this.menu.enabled = false;
        fadeTo(this, 'Create');
      }
      else if (m === 'cpu') this.openDifficulty();
      else if (m === 'online') {
        this.menu.enabled = false;
        fadeTo(this, 'Online');
      } else this.go(m, 'normal');
    }, 56, 46);

    this.hint = bodyText(this, GAME_W / 2, 506, '', 26, '#d8cdb0').setOrigin(0.5);
    const controlsText = bodyText(this, GAME_W / 2, 640, '', 22, '#a89f88').setOrigin(0.5).setWordWrapWidth(1180).setAlign('center');
    // follows the device: plugging in a gamepad switches the help to its buttons
    const showControls = () => {
      const dev = controlDevice(this);
      controlsText.setText(dev === 'keys' ? `P1  ${controlsLine(dev)}\nP2  arrows · numpad 1 PUNCH · 2 KICK · 3 SPECIAL · 5 BLOCK · 4 COMBO · 6 FINISHER` : controlsLine(dev));
    };
    showControls();
    this.input.gamepad?.on('connected', showControls);
    this.input.gamepad?.on('disconnected', showControls);
    if (game.isTouch) {
      const bg = this.add.rectangle(GAME_W / 2, 562, 360, 52, 0x000000, 0.6).setStrokeStyle(2, 0xf5c542).setInteractive({ useHandCursor: true });
      goldText(this, GAME_W / 2, 562, '⚙  CUSTOMIZE CONTROLS', 30);
      bg.on('pointerup', () => {
        sfx.play('confirm');
        fadeTo(this, 'Controls', { from: 'Mode' });
      });
    }
    muteButton(this);

    const back = bodyText(this, 30, 30, '◄ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.back());

    this.hints = modes.map((m) => m.hint);
  }

  private openDifficulty() {
    this.menu.enabled = false;
    this.menu.setVisible(false);
    const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
    this.diffMenu = new ListMenu(this, GAME_W / 2, 230, ['EASY', 'NORMAL', 'HARD'], (i) => this.go('cpu', diffs[i]), 84, 58);
    this.diffMenu.select(1);
  }

  // ---------------------------------------------------------------- contract address
  private tip: { layer: Phaser.GameObjects.Container; copy: () => void } | null = null;

  private openTip() {
    this.menu.enabled = false;
    this.menu.setVisible(false);
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + 1600, GAME_H + 800, 0x050303, 1).setInteractive());
    c.add(goldText(this, GAME_W / 2, 200, 'CONTRACT ADDRESS', 64));
    c.add(bodyText(this, GAME_W / 2, 280, '$TK', 30, '#ff9a4a').setOrigin(0.5));

    const status = bodyText(this, GAME_W / 2, 430, '', 24, '#7dff9a').setOrigin(0.5);
    const row = addressRow(this, GAME_W / 2, 360, 24, (r) => {
      status.setColor(r === 'copied' ? '#7dff9a' : '#ffb35a');
      status.setText(r === 'copied' ? 'Copied!' : r === 'empty' ? 'The contract address is coming soon.' : "Couldn't copy on this device: the address is shown above.");
    });
    c.add([...row.objects, status]);
    const copy = row.copy;

    const close = this.add.rectangle(GAME_W / 2, 520, 220, 58, 0x000000, 0.6).setStrokeStyle(2, GOLD_HEX).setInteractive({ useHandCursor: true });
    c.add([close, goldText(this, GAME_W / 2, 520, 'CLOSE', 30)]);
    close.on('pointerup', () => this.back());
    if (!game.isTouch) c.add(bodyText(this, GAME_W / 2, 580, 'Enter / J / gamepad A: copy   ·   Esc / gamepad B: close', 20, '#8c8270').setOrigin(0.5));
    this.tip = { layer: c, copy };
  }

  private back() {
    sfx.play('back');
    if (this.tip) {
      this.tip.layer.destroy();
      this.tip = null;
      this.menu.enabled = true;
      this.menu.setVisible(true);
      return;
    }
    if (this.diffMenu) {
      this.diffMenu.destroy();
      this.diffMenu = null;
      this.menu.enabled = true;
      this.menu.setVisible(true);
      return;
    }
    fadeTo(this, 'Title');
  }

  private go(mode: GameMode, difficulty: Difficulty) {
    this.menu.enabled = false;
    if (this.diffMenu) this.diffMenu.enabled = false;
    fadeTo(this, 'Select', { mode, difficulty });
  }

  update() {
    const p = this.input0.poll();
    if (p.back) {
      this.back();
      return;
    }
    if (this.tip) {
      if (p.ok) this.tip.copy();
      return;
    }
    if (this.diffMenu) this.diffMenu.handle(p);
    else this.menu.handle(p);
    this.hint.setText(this.diffMenu ? 'Easy: learning the ropes. Normal: a fair fight. Hard: it punishes mistakes.' : this.hints[this.menu.index]);
  }
}
