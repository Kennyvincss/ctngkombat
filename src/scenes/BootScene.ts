import Phaser from 'phaser';
import { GAME_H, GAME_W, GOLD_HEX } from '../config';
import type { FighterData } from '../data/types';
import type { SpriteSet } from '../fight/FighterView';
import { generateArt } from '../fight/art';
import { generateStages } from '../fight/stages';
import { detectTouch, game } from '../state';

/** Loads fighters.json, every card / thumbnail / cut-out, fonts and generated art. */
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
      for (const f of game.roster) {
        this.load.image(`card-${f.id}`, f.card);
        this.load.image(`thumb-${f.id}`, `assets/thumbs/${f.id}.webp`);
        // WebP copies of the PNG cut-outs: ~5x smaller downloads for players on phones
        this.load.image(`fighter-${f.id}`, `assets/fighters/${f.id}.webp`);
      }
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
    generateArt(this);
    generateStages(this);
    this.scene.start('Title');
  }
}
