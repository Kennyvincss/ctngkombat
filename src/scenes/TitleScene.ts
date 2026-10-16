import Phaser from 'phaser';
import { GAME_H, GAME_SUBTITLE, GAME_TITLE, GAME_W } from '../config';
import { sfx } from '../audio/Sfx';
import { tuningFor } from '../data/tuning';
import { game } from '../state';
import { bodyText, fadeTo, fitCamera, goFullscreen, goldText, homeScreenTip, menuBackdrop, muteButton } from '../ui/ui';

export class TitleScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super('Title');
  }

  create() {
    fitCamera(this);
    this.started = false;
    this.cameras.main.fadeIn(400);
    menuBackdrop(this, 0x3d0c04);
    // start downloading the intro's soundtrack now so it's ready when the player taps
    if (!game.introPlayed) void fetch('assets/music/intro.mp3').catch(() => {});

    // slow parallax parade of fighter cut-outs
    const ids = Phaser.Utils.Array.Shuffle(game.roster.map((f) => f.id));
    const rows = [
      { y: 735, scale: 0.75, speed: 0.22, alpha: 0.38, depth: 2 },
      { y: 760, scale: 1.0, speed: 0.4, alpha: 0.55, depth: 3 },
    ];
    rows.forEach((row, ri) => {
      let x = -200 + ri * 120;
      ids.slice(ri * 12, ri * 12 + 16).forEach((id) => {
        const img = this.add.image(x, row.y, `fighter-${id}`).setOrigin(0.5, 1).setDepth(row.depth);
        img.setScale((330 / img.height) * row.scale).setAlpha(row.alpha);
        img.setTint(0x222222, 0x222222, tuningFor(id).accent, tuningFor(id).accent);
        img.setData('speed', row.speed);
        x += 210 * row.scale + 40;
      });
    });

    const shade = this.add.graphics().setDepth(4);
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.85, 0.85, 0, 0);
    shade.fillRect(-800, -400, GAME_W + 1600, 820);

    const logo = goldText(this, GAME_W / 2, 230, GAME_TITLE, 150, { strokeThickness: 14 }).setDepth(10);
    logo.setShadow(0, 0, '#ff6a00', 30, true, true);
    this.tweens.add({ targets: logo, scale: { from: 0.96, to: 1.02 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    bodyText(this, GAME_W / 2, 330, GAME_SUBTITLE, 34, '#ff9a4a').setOrigin(0.5).setDepth(10).setShadow(0, 0, '#ff3b00', 12, true, true);

    const prompt = goldText(this, GAME_W / 2, 470, game.isTouch ? 'TAP TO START' : 'PRESS ANY KEY', 46).setDepth(10);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 650, yoyo: true, repeat: -1 });

    bodyText(this, GAME_W / 2, GAME_H - 24, 'A fan-made parody fighting game. Not affiliated with any game studio.', 18, '#8c8270').setOrigin(0.5).setDepth(10);
    muteButton(this);

    const go = () => {
      if (this.started) return;
      this.started = true;
      sfx.unlock();
      sfx.play('announce');
      this.cameras.main.flash(200, 255, 200, 120);
      // first time this visit: the entry video, then the mode menu
      const intro = !game.introPlayed;
      // the theme song starts now, or after the intro (which has its own soundtrack)
      if (!intro) sfx.music(true);
      game.introPlayed = true;
      this.time.delayedCall(250, () => fadeTo(this, intro ? 'Intro' : 'Mode', intro ? { next: 'Mode' } : undefined));
    };
    const watch = bodyText(this, GAME_W / 2, 560, '▶  WATCH INTRO', 26, '#bfb59a').setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    watch.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.started) return;
      this.started = true;
      sfx.unlock();
      game.introPlayed = true;
      fadeTo(this, 'Intro', { next: 'Title' });
    });
    this.input.keyboard?.once('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') go();
      else this.input.keyboard?.once('keydown', go);
    });
    this.input.once('pointerdown', go);
    // phones: the first tap also takes the game full screen (browsers only allow it on a tap)
    this.input.once('pointerup', () => {
      if (game.isTouch) goFullscreen(this);
    });
    homeScreenTip(this, GAME_W / 2, GAME_H - 54);
    this.input.gamepad?.once('down', go);
  }

  update() {
    for (const obj of this.children.list) {
      const img = obj as Phaser.GameObjects.Image;
      const sp = img.getData?.('speed');
      if (!sp) continue;
      img.x -= sp;
      if (img.x < -220) img.x += GAME_W + 520;
    }
  }
}
