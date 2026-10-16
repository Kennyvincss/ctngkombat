import Phaser from 'phaser';
import { GAME_H, GAME_W, GOLD_HEX } from '../config';
import { sfx } from '../audio/Sfx';
import { BUILD_ID, net, type NetMsg } from '../net/Net';
import { bodyText, copyText, fadeTo, fitCamera, goldText, ListMenu, menuBackdrop, MenuInput, muteButton } from '../ui/ui';

/**
 * PLAY ONLINE: create a room (get a 5-digit code to send to a friend) or join one by code.
 * When the two connect they swap build ids (both must run the same version) and go to
 * character select together.
 */
export class OnlineScene extends Phaser.Scene {
  private menu: ListMenu | null = null;
  private input0!: MenuInput;
  private layer: Phaser.GameObjects.Container | null = null;
  private status!: Phaser.GameObjects.Text;
  private digits = '';
  private digitText: Phaser.GameObjects.Text | null = null;
  private mode: 'menu' | 'host' | 'join' | 'connecting' = 'menu';
  private leaving = false;

  constructor() {
    super('Online');
  }

  init() {
    this.menu = null;
    this.layer = null;
    this.digits = '';
    this.digitText = null;
    this.mode = 'menu';
    this.leaving = false;
  }

  create() {
    fitCamera(this);
    this.cameras.main.fadeIn(250);
    menuBackdrop(this, 0x0a1a2a);
    goldText(this, GAME_W / 2, 80, 'PLAY ONLINE', 64);
    this.status = bodyText(this, GAME_W / 2, GAME_H - 60, '', 24, '#d8cdb0').setOrigin(0.5).setAlign('center').setWordWrapWidth(1100);
    const back = bodyText(this, 30, 30, '◀ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.back());
    muteButton(this);
    this.input0 = new MenuInput(this, 0);
    net.leave();
    this.showMenu();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.mode !== 'join') return;
      if (/^[0-9]$/.test(e.key)) this.typeDigit(e.key);
      else if (e.key === 'Backspace') this.typeDigit('⌫');
      else if (e.key === 'Enter') this.typeDigit('JOIN');
      else if (e.key === 'Escape') this.back();
    });
    net.listen(this, (m) => this.onMessage(m));
    net.onClose(this, () => {
      if (this.leaving) return;
      this.status.setText('The other player disconnected.');
      this.showMenu();
    });
  }

  private clear() {
    this.menu?.destroy();
    this.menu = null;
    this.layer?.destroy();
    this.layer = this.add.container(0, 0);
    this.digitText = null;
  }

  private showMenu() {
    this.clear();
    this.mode = 'menu';
    this.layer!.add(bodyText(this, GAME_W / 2, 150, 'Fight a friend on their own phone or computer. One of you creates a room, the other joins with the code.', 24, '#d8cdb0').setOrigin(0.5).setAlign('center').setWordWrapWidth(900));
    this.menu = new ListMenu(this, GAME_W / 2, 300, ['CREATE ROOM', 'JOIN ROOM'], (i) => (i === 0 ? this.createRoom() : this.showJoin()), 90, 56);
  }

  private async createRoom() {
    this.clear();
    this.mode = 'host';
    this.status.setText('Creating room…');
    try {
      const code = await net.host(() => this.connected());
      if (this.mode !== 'host') return;
      this.layer!.add(bodyText(this, GAME_W / 2, 190, 'YOUR ROOM CODE', 30, '#d8cdb0').setOrigin(0.5));
      const t = goldText(this, GAME_W / 2, 290, code.split('').join(' '), 120, { strokeThickness: 12 });
      this.layer!.add(t);
      this.tweens.add({ targets: t, scale: { from: 0.96, to: 1.03 }, yoyo: true, repeat: -1, duration: 900 });
      this.layer!.add(bodyText(this, GAME_W / 2, 400, 'Send this code to your friend. They pick PLAY ONLINE → JOIN ROOM and type it in.', 24, '#ffffff').setOrigin(0.5).setAlign('center').setWordWrapWidth(900));
      this.addButton(GAME_W / 2 - 130, 490, 'COPY CODE', () => {
        void copyText(code).then((ok) => this.status.setText(ok ? 'Code copied. Paste it to your friend.' : `Your code is ${code}`));
      });
      this.addButton(GAME_W / 2 + 130, 490, 'CANCEL', () => this.back());
      this.status.setText('Waiting for your opponent to join…');
    } catch (e) {
      this.status.setText((e as Error).message);
      this.showMenu();
    }
  }

  private showJoin() {
    this.clear();
    this.mode = 'join';
    this.digits = '';
    this.layer!.add(bodyText(this, GAME_W / 2, 150, "ENTER YOUR FRIEND'S ROOM CODE", 28, '#d8cdb0').setOrigin(0.5));
    this.digitText = goldText(this, GAME_W / 2, 220, '', 84, { strokeThickness: 10 });
    this.layer!.add(this.digitText);
    this.renderDigits();
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'JOIN'];
    keys.forEach((k, i) => {
      const x = GAME_W / 2 + ((i % 3) - 1) * 130;
      const y = 320 + Math.floor(i / 3) * 76;
      const join = k === 'JOIN';
      const bg = this.add.rectangle(x, y, 116, 64, join ? 0x8a5a00 : 0x000000, join ? 0.95 : 0.6).setStrokeStyle(2, GOLD_HEX).setInteractive({ useHandCursor: true });
      const t = join ? goldText(this, x, y, k, 32) : bodyText(this, x, y, k, 34, '#ffffff').setOrigin(0.5);
      bg.on('pointerdown', () => {
        sfx.unlock();
        this.typeDigit(k);
      });
      this.layer!.add([bg, t]);
    });
    this.status.setText('');
  }

  private renderDigits() {
    this.digitText?.setText(Array.from({ length: 5 }, (_, i) => this.digits[i] ?? '_').join(' '));
  }

  private typeDigit(k: string) {
    if (this.mode !== 'join') return;
    if (k === '⌫') this.digits = this.digits.slice(0, -1);
    else if (k === 'JOIN') {
      if (this.digits.length === 5) this.joinRoom(this.digits);
      else this.status.setText('Room codes have 5 digits.');
      return;
    } else if (this.digits.length < 5) this.digits += k;
    sfx.play('select');
    this.renderDigits();
  }

  private async joinRoom(code: string) {
    this.mode = 'connecting';
    this.status.setText(`Joining room ${code}…`);
    try {
      await net.join(code);
      this.connected();
    } catch (e) {
      this.status.setText((e as Error).message);
      net.leave();
      this.mode = 'join';
    }
  }

  /** both sides: the data channel is open, check versions */
  private connected() {
    this.status.setText('Connected! Checking versions…');
    net.send({ t: 'hello', v: BUILD_ID });
  }

  private onMessage(m: NetMsg) {
    if (m.t !== 'hello') return;
    if (m.v !== BUILD_ID) {
      this.status.setText('You and your friend are on different versions of the game. Both refresh the page, then try again.');
      net.leave();
      this.showMenu();
      return;
    }
    sfx.play('confirm');
    this.cameras.main.flash(150, 255, 210, 120);
    this.status.setText('Connected!');
    this.leaving = true;
    this.time.delayedCall(500, () => fadeTo(this, 'Select', { mode: 'online', difficulty: 'normal' }));
  }

  private addButton(x: number, y: number, label: string, fn: () => void) {
    const bg = this.add.rectangle(x, y, 230, 58, 0x000000, 0.6).setStrokeStyle(2, GOLD_HEX).setInteractive({ useHandCursor: true });
    const t = goldText(this, x, y, label, 30);
    bg.on('pointerup', fn);
    this.layer!.add([bg, t]);
  }

  private back() {
    sfx.play('back');
    if (this.mode === 'menu') {
      this.leaving = true;
      net.leave();
      fadeTo(this, 'Mode');
      return;
    }
    net.leave();
    this.status.setText('');
    this.showMenu();
  }

  update() {
    const p = this.input0.poll();
    if (this.mode === 'menu' && this.menu) {
      if (p.back) this.back();
      else this.menu.handle(p);
    } else if (p.back && this.mode !== 'join') this.back();
  }
}
