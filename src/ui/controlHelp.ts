import Phaser from 'phaser';
import { game } from '../state';

// What to call the six simple buttons on screen, for whatever the player is holding.

export type ControlKey = 'punch' | 'kick' | 'special' | 'block' | 'combo' | 'finisher';
export type Device = 'touch' | 'pad' | 'keys';

const LABELS: Record<Exclude<Device, 'touch'>, Record<ControlKey, string>> = {
  pad: { punch: 'X', kick: 'A', special: 'Y', block: 'B', combo: 'RB', finisher: 'RT' },
  keys: { punch: 'J', kick: 'K', special: 'L', block: 'I', combo: 'U', finisher: 'O' },
};

/** a connected gamepad wins (a tablet with a controller), then touch, then the keyboard */
export function controlDevice(scene: Phaser.Scene): Device {
  const gp = scene.input.gamepad;
  if (gp && gp.total > 0 && gp.getPad(0)?.connected) return 'pad';
  return game.isTouch ? 'touch' : 'keys';
}

/** "PUNCH" on touch, "PUNCH [J]" on keyboard, "PUNCH [X]" on a gamepad */
export function btn(dev: Device, k: ControlKey): string {
  const name = k.toUpperCase();
  return dev === 'touch' ? name : `${name} [${LABELS[dev][k]}]`;
}

/** the three specials' commands */
export function specialCommand(dev: Device, i: number): string {
  return `${['', 'forward + ', 'down + '][i]}${btn(dev, 'special')}`;
}

/** one line for menus: how to play on this device */
export function controlsLine(dev: Device): string {
  if (dev === 'touch') return 'Stick: move · PUNCH · KICK · SPECIAL · BLOCK · COMBO · FINISHER  (forward or down = power version)';
  const move = dev === 'pad' ? 'D-pad / stick' : 'WASD / arrows';
  const keys: ControlKey[] = ['punch', 'kick', 'special', 'block', 'combo', 'finisher'];
  return `${move}: move · ${keys.map((k) => btn(dev, k)).join(' · ')}`;
}
