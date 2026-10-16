import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { ModeScene } from './scenes/ModeScene';
import { SelectScene } from './scenes/SelectScene';
import { VersusScene } from './scenes/VersusScene';
import { FightScene } from './scenes/FightScene';
import { HudScene } from './scenes/HudScene';
import { WinScene } from './scenes/WinScene';
import { ControlsScene } from './scenes/ControlsScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#000000',
  scale: {
    // fill the whole screen: 1280×720 is always visible, wider/taller screens see more around it
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,
    activePointers: 6,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  fps: { target: 60 },
  scene: [BootScene, TitleScene, ModeScene, SelectScene, VersusScene, FightScene, HudScene, WinScene, ControlsScene],
});

// handy for debugging in the console
(window as unknown as { trenches: Phaser.Game }).trenches = game;
