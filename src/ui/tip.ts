import Phaser from 'phaser';
import { GOLD_HEX, TIP_WALLET } from '../config';
import { sfx } from '../audio/Sfx';
import { copyText, goldText } from './ui';

// The creator's wallet address in a box with a small COPY button beside it, shared by the
// TIP CREATOR panel (menu) and the tip strip on the results screen.

export interface WalletRow {
  objects: Phaser.GameObjects.GameObject[];
  /** copy the address (call from a tap / click / key press) */
  copy: () => void;
}

/**
 * @param onCopied called with whether the copy worked (to show a message)
 */
export function walletRow(scene: Phaser.Scene, cx: number, y: number, fontSize: number, onCopied: (ok: boolean) => void): WalletRow {
  // a font with lowercase letters: Solana addresses are case-sensitive (the game's fonts are all caps)
  const addr = scene.add
    .text(0, 0, TIP_WALLET, { fontFamily: '"Courier New", ui-monospace, Menlo, Consolas, monospace', fontSize: `${fontSize}px`, fontStyle: 'bold', color: '#ffffff' })
    .setOrigin(0, 0.5);
  const h = Math.round(fontSize * 2.4);
  const boxW = addr.width + fontSize * 1.6;
  const btnW = Math.round(fontSize * 5);
  const total = boxW + 10 + btnW;
  const x0 = cx - total / 2;
  const box = scene.add.rectangle(x0, y, boxW, h, 0x0d0b08, 0.95).setOrigin(0, 0.5).setStrokeStyle(2, 0x6b5a2e);
  addr.setPosition(x0 + fontSize * 0.8, y);
  // the box was made after the text (it needed the text's width): keep the text on top
  scene.children.bringToTop(addr);
  const bx = x0 + boxW + 10 + btnW / 2;
  const btn = scene.add.rectangle(bx, y, btnW, h, 0x2a1d05, 1).setStrokeStyle(2, GOLD_HEX).setInteractive({ useHandCursor: true });
  const label = goldText(scene, bx, y, 'COPY', Math.round(fontSize * 1.15));
  const copy = () => {
    void copyText(TIP_WALLET).then((ok) => {
      sfx.play(ok ? 'confirm' : 'select');
      if (label.active) label.setText(ok ? 'COPIED ✓' : 'COPY');
      onCopied(ok);
      scene.time.delayedCall(2000, () => label.active && label.setText('COPY'));
    });
  };
  btn.on('pointerup', copy);
  return { objects: [box, addr, btn, label], copy };
}
