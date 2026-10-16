import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import type { MatchSetup } from '../data/types';
import { tuningFor } from '../data/tuning';
import { STAGES } from '../fight/stages';
import { sfx } from '../audio/Sfx';
import { fighterById } from '../state';
import { bodyText, fadeTo, goldText, menuBackdrop, fitCamera, showDisconnected } from '../ui/ui';
import { net } from '../net/Net';

/** Both cards slide in, "VS" slams down, hold, then fight. */
export class VersusScene extends Phaser.Scene {
  constructor() {
    super('Versus');
  }

  create(setup: MatchSetup) {
    fitCamera(this);
    this.cameras.main.fadeIn(200);
    menuBackdrop(this, 0x1a0503);
    const a = fighterById(setup.p1);
    const b = fighterById(setup.p2);

    // diagonal accent slabs
    const g = this.add.graphics();
    g.fillStyle(tuningFor(a.id).accent, 0.35);
    g.fillPoints([new Phaser.Geom.Point(-800, -400), new Phaser.Geom.Point(GAME_W / 2 + 80 + 40, -400), new Phaser.Geom.Point(GAME_W / 2 - 80 - 40, GAME_H + 400), new Phaser.Geom.Point(-800, GAME_H + 400)], true);
    g.fillStyle(tuningFor(b.id).accent, 0.35);
    g.fillPoints([new Phaser.Geom.Point(GAME_W / 2 + 80 + 40, -400), new Phaser.Geom.Point(GAME_W + 800, -400), new Phaser.Geom.Point(GAME_W + 800, GAME_H + 400), new Phaser.Geom.Point(GAME_W / 2 - 80 - 40, GAME_H + 400)], true);

    const cardH = 600;
    const cardW = cardH / 1.5;
    const left = this.add.image(-cardW, GAME_H / 2 - 10, `card-${a.id}`).setDisplaySize(cardW, cardH);
    const right = this.add.image(GAME_W + cardW, GAME_H / 2 - 10, `card-${b.id}`).setDisplaySize(cardW, cardH);
    this.tweens.add({ targets: left, x: 300, duration: 380, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: right, x: GAME_W - 300, duration: 380, ease: 'Cubic.easeOut' });

    const n1 = goldText(this, 300, GAME_H - 26, a.name.toUpperCase(), 40).setAlpha(0);
    const n2 = goldText(this, GAME_W - 300, GAME_H - 26, b.name.toUpperCase(), 40).setAlpha(0);
    this.tweens.add({ targets: [n1, n2], alpha: 1, delay: 300, duration: 200 });

    const vs = goldText(this, GAME_W / 2, GAME_H / 2, 'VS', 180, { strokeThickness: 16 }).setScale(4).setAlpha(0);
    vs.setShadow(0, 0, '#ff4500', 40, true, true);
    this.time.delayedCall(420, () => {
      this.tweens.add({
        targets: vs,
        scale: 1,
        alpha: 1,
        duration: 180,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sfx.play('announce');
          this.cameras.main.shake(260, 0.02);
          this.cameras.main.flash(120, 255, 180, 80);
        },
      });
    });

    const stage = STAGES.find((s) => s.id === setup.stage);
    if (stage) bodyText(this, GAME_W / 2, GAME_H / 2 + 130, stage.name, 28, '#d8cdb0').setOrigin(0.5);
    const tag = setup.mode === 'cpu' ? `CPU · ${setup.difficulty.toUpperCase()}` : setup.mode === 'online' ? `ONLINE MATCH · ROOM ${net.code}` : 'PLAYER 1 VS PLAYER 2';
    if (setup.mode === 'online') net.onClose(this, () => showDisconnected(this));
    bodyText(this, GAME_W / 2, 40, tag, 26, '#d8cdb0').setOrigin(0.5);

    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      fadeTo(this, 'Fight', setup, 300);
    };
    this.time.delayedCall(2600, go);
    // allow skipping after the slam
    this.time.delayedCall(900, () => {
      this.input.keyboard?.once('keydown', go);
      this.input.once('pointerdown', go);
    });
  }
}
