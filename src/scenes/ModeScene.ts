import Phaser from 'phaser';
import { GAME_W } from '../config';
import type { Difficulty, GameMode } from '../data/types';
import { sfx } from '../audio/Sfx';
import { game } from '../state';
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

    const modes: { label: string; mode: GameMode; hint: string }[] = [
      { label: 'VS CPU', mode: 'cpu', hint: 'Fight the computer. Pick your fighter, then your opponent.' },
      { label: 'VS PLAYER 2', mode: 'versus', hint: 'Two players on one keyboard (or two gamepads).' },
      { label: 'PLAY ONLINE', mode: 'online', hint: 'Fight a friend on their own device with a room code.' },
      { label: 'TRAINING', mode: 'training', hint: 'Infinite health and meter, with the move list on screen.' },
    ];
    this.menu = new ListMenu(this, GAME_W / 2, 200, modes.map((m) => m.label), (i) => {
      const m = modes[i].mode;
      if (m === 'cpu') this.openDifficulty();
      else if (m === 'online') {
        this.menu.enabled = false;
        fadeTo(this, 'Online');
      } else this.go(m, 'normal');
    }, 72, 54);

    this.hint = bodyText(this, GAME_W / 2, 494, '', 26, '#d8cdb0').setOrigin(0.5);
    const controls = game.isTouch
      ? 'TOUCH: left thumb = move   ·   buttons = attacks and specials'
      : 'P1: WASD move · U/I punch · J/K kick · O/L/; specials · P = EX        P2: arrows · numpad 4/5 punch · 1/2 kick · 6/3/. specials';
    bodyText(this, GAME_W / 2, 640, controls, 22, '#a89f88').setOrigin(0.5).setWordWrapWidth(1180).setAlign('center');
    if (game.isTouch) {
      const bg = this.add.rectangle(GAME_W / 2, 562, 360, 52, 0x000000, 0.6).setStrokeStyle(2, 0xf5c542).setInteractive({ useHandCursor: true });
      goldText(this, GAME_W / 2, 562, '⚙  CUSTOMIZE CONTROLS', 30);
      bg.on('pointerup', () => {
        sfx.play('confirm');
        fadeTo(this, 'Controls', { from: 'Mode' });
      });
    }
    bodyText(this, GAME_W / 2, 680, 'Motion inputs: ↓↘→+P · →↓↘+P · ↓↙←+K       Fatality: ↓↓→ + heavy punch', 20, '#8c8270').setOrigin(0.5);
    muteButton(this);

    const back = bodyText(this, 30, 30, '◀ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
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

  private back() {
    sfx.play('back');
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
    if (this.diffMenu) this.diffMenu.handle(p);
    else this.menu.handle(p);
    this.hint.setText(this.diffMenu ? 'Easy: learning the ropes. Normal: a fair fight. Hard: it punishes mistakes.' : this.hints[this.menu.index]);
  }
}
