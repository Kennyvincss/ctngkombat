import Phaser from 'phaser';
import { fitCamera } from '../ui/ui';
import { CREATE_FIGHTER, GAME_H, GAME_W, GOLD_HEX } from '../config';
import type { FighterData } from '../data/types';
import type { SpriteSet } from '../fight/FighterView';
import { generateArt } from '../fight/art';
import { generateStages } from '../fight/stages';
import { detectTouch, game } from '../state';
import { loadCustoms, register } from '../custom/customFighters';
import { lineUp } from '../data/lineup';
import { startBackgroundArt } from '../systems/artLoader';

/** the title screen's parade of fighters: this many cut-outs load before the title (the rest stream in) */
const TITLE_FIGHTERS = 8;

/**
 * Loads fighters.json, a few cut-outs for the title, fonts and generated art. Thumbnails, cards
 * and the other cut-outs stream in after the title shows (artLoader).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const w = GAME_W;
    const h = GAME_H;
    const label = this.add.text(w / 2, h / 2 - 40, 'LOADING TRENCHES KOMBAT', { fontFamily: 'Impact, sans-serif', fontSize: '28px', color: '#f5c542' }).setOrigin(0.5);
    const frame = this.add.rectangle(w / 2, h / 2 + 10, 520, 22).setStrokeStyle(2, GOLD_HEX);
    const bar = this.add.rectangle(w / 2 - 256, h / 2 + 10, 0, 14, GOLD_HEX).setOrigin(0, 0.5);
    this.load.on('progress', (v: number) => (bar.width = 512 * v));
    this.load.on('complete', () => {
      label.destroy();
      frame.destroy();
      bar.destroy();
    });

    this.load.json('fighters', 'fighters.json');
    this.load.on('filecomplete-json-fighters', (_k: string, _t: string, data: FighterData[]) => {
      game.roster = [...data].sort((a, b) => a.order - b.order);
      // WebP copies of the PNG cut-outs: ~5x smaller downloads for players on phones
      for (const f of Phaser.Utils.Array.Shuffle([...game.roster]).slice(0, TITLE_FIGHTERS)) this.load.image(`fighter-${f.id}`, `assets/fighters/${f.id}.webp`);
    });
    // Phase B pose atlases (loaded per match by the fight scene)
    this.load.json('sprites', 'assets/sprites/manifest.json');
    this.load.on('filecomplete-json-sprites', (_k: string, _t: string, data: Record<string, SpriteSet>) => {
      game.sprites = data && typeof data === 'object' ? data : {};
    });
    // skeletal rigs available (loaded per match by the fight scene)
    this.load.json('rigs', 'assets/rigs/index.json');
    this.load.on('filecomplete-json-rigs', (_k: string, _t: string, data: string[]) => {
      game.rigs = Array.isArray(data) ? data : [];
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key !== 'sprites') console.warn('Failed to load', file.src);
    });
  }

  async create() {
    fitCamera(this);
    game.isTouch = detectTouch();
    // wait for the Google Fonts (canvas text needs them loaded), but never block forever
    try {
      await Promise.race([
        Promise.all([document.fonts.load('40px "Anton"'), document.fonts.load('40px "Bebas Neue"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* fall back to Impact */
    }
    // whatever goes wrong here, the game still goes on to the title (a black screen helps no one)
    try {
      generateArt(this);
      generateStages(this);
      // fighters this player made, kept on this device
      game.customs = CREATE_FIGHTER ? loadCustoms() : [];
      const ok = await Promise.all(game.customs.map((f) => register(this, f).then(() => true, () => false)));
      game.customs = game.customs.filter((_, i) => ok[i]);
      // everything else downloads while the player is on the title and menus
      startBackgroundArt(this.game, lineUp(game.roster).map((f) => f.id));
    } catch (e) {
      console.error('boot step failed', e);
    }
    this.scene.start('Title');
  }
}
