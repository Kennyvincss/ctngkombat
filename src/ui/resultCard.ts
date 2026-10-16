import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, SITE_URL } from '../config';
import type { FighterData } from '../data/types';
import { tuningFor } from '../data/tuning';

// The shareable result card: a 1080×1350 image (good for X and Instagram) of a finished match,
// drawn with the 2D canvas API from the fighters' card art. A WIN card puts the player's fighter
// in gold light and stamps the opponent K.O.; a LOSE card greys the player out and stamps REKT.

export interface CardInfo {
  me: FighterData;
  opp: FighterData;
  won: boolean;
  /** rounds won: [me, opponent] */
  score: [number, number];
  fatality: boolean;
  flawless: boolean;
  /** e.g. "VS CPU · HARD" */
  mode: string;
}

const W = 1080;
const H = 1350;
const CARD_W = 430;
const CARD_H = 645;
const CARD_Y = 345;

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function font(size: number, display = true) {
  return `${size}px ${display ? FONT_DISPLAY : FONT_BODY}`;
}

/** the card art in grey and darkened (no canvas filters: Safari doesn't have them everywhere) */
function greyed(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) * 0.55;
    p[i] = p[i + 1] = p[i + 2] = l;
  }
  x.putImageData(d, 0, 0);
  return c;
}

function centred(x: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number, fill: string | CanvasGradient, opts: { display?: boolean; stroke?: string; glow?: string } = {}) {
  x.font = font(size, opts.display ?? true);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  // shrink to fit the width
  const max = W - 80;
  const w = x.measureText(text).width;
  if (w > max) x.font = font(Math.floor((size * max) / w), opts.display ?? true);
  if (opts.glow) {
    x.shadowColor = opts.glow;
    x.shadowBlur = 30;
  }
  if (opts.stroke) {
    x.lineWidth = Math.max(4, size / 9);
    x.strokeStyle = opts.stroke;
    x.lineJoin = 'round';
    x.strokeText(text, cx, y);
  }
  x.fillStyle = fill;
  x.fillText(text, cx, y);
  x.shadowBlur = 0;
}

function stamp(x: CanvasRenderingContext2D, text: string, cx: number, cy: number) {
  x.save();
  x.translate(cx, cy);
  x.rotate(-0.25);
  x.font = font(118);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const w = x.measureText(text).width + 60;
  x.lineWidth = 10;
  x.strokeStyle = '#ff2d3a';
  x.strokeRect(-w / 2, -78, w, 156);
  x.fillStyle = '#ff2d3a';
  x.fillText(text, 0, 6);
  x.restore();
}

function drawCard(x: CanvasRenderingContext2D, scene: Phaser.Scene, f: FighterData, left: number, winner: boolean, stampText: string) {
  const key = `card-${f.id}`;
  const img = scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as CanvasImageSource) : null;
  const accent = hex(tuningFor(f.id).accent);
  x.save();
  if (winner) {
    x.shadowColor = accent;
    x.shadowBlur = 60;
  }
  x.fillStyle = '#000';
  x.fillRect(left, CARD_Y, CARD_W, CARD_H);
  x.shadowBlur = 0;
  if (img) x.drawImage(winner ? img : greyed(img, CARD_W, CARD_H), left, CARD_Y, CARD_W, CARD_H);
  x.lineWidth = winner ? 8 : 4;
  x.strokeStyle = winner ? '#f5c542' : '#3a3a3a';
  x.strokeRect(left, CARD_Y, CARD_W, CARD_H);
  x.restore();
  if (winner) {
    const crown = scene.textures.exists('crown') ? (scene.textures.get('crown').getSourceImage() as CanvasImageSource) : null;
    // the crown sits on the card's top edge
    if (crown) x.drawImage(crown, left + CARD_W / 2 - 60, CARD_Y - 52, 120, 80);
  } else stamp(x, stampText, left + CARD_W / 2, CARD_Y + CARD_H / 2);
  // name and handle under the card
  const cx = left + CARD_W / 2;
  x.font = font(54);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let size = 54;
  while (x.measureText(f.name.toUpperCase()).width > CARD_W && size > 30) x.font = font(--size);
  x.fillStyle = winner ? '#f5c542' : '#8a8378';
  x.fillText(f.name.toUpperCase(), cx, CARD_Y + CARD_H + 48);
  if (f.handle) {
    x.font = font(32, false);
    x.fillStyle = winner ? '#e8e2d0' : '#6f6a61';
    x.fillText(f.handle, cx, CARD_Y + CARD_H + 92);
  }
}

/** draw the card; resolves once the fonts are ready so the text comes out right */
export async function drawResultCard(scene: Phaser.Scene, info: CardInfo): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(font(100)), document.fonts.load(font(40, false))]);
  } catch {
    /* fall back to whatever font is there */
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const winnerData = info.won ? info.me : info.opp;
  const accent = hex(tuningFor(winnerData.id).accent);

  // background: dark arena, the winner's colour glowing behind their card
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070404');
  bg.addColorStop(1, info.won ? '#3a1205' : '#36060c');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const gx = info.won ? 85 + CARD_W / 2 : 565 + CARD_W / 2;
  const glow = x.createRadialGradient(gx, CARD_Y + CARD_H / 2, 40, gx, CARD_Y + CARD_H / 2, 560);
  glow.addColorStop(0, accent + '88');
  glow.addColorStop(1, accent + '00');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);

  // title and the result
  const gold = x.createLinearGradient(0, 60, 0, 150);
  gold.addColorStop(0, '#fff1b8');
  gold.addColorStop(1, '#e0a020');
  centred(x, 'TRENCHES KOMBAT', W / 2, 104, 88, gold, { stroke: '#1a0f00', glow: '#ff4500' });
  if (info.won) {
    const g = x.createLinearGradient(0, 180, 0, 300);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(1, '#f5a020');
    centred(x, 'VICTORY', W / 2, 238, 150, g, { stroke: '#2a1200', glow: '#ffb000' });
  } else centred(x, 'DEFEAT', W / 2, 238, 150, '#ff2d3a', { stroke: '#2a0005', glow: '#ff0020' });

  // the two cards, VS between them
  drawCard(x, scene, info.me, 85, info.won, 'REKT');
  drawCard(x, scene, info.opp, 565, !info.won, 'K.O.');
  x.beginPath();
  x.arc(W / 2, CARD_Y + CARD_H / 2, 54, 0, Math.PI * 2);
  x.fillStyle = '#0b0705';
  x.fill();
  x.lineWidth = 5;
  x.strokeStyle = '#f5c542';
  x.stroke();
  centred(x, 'VS', W / 2, CARD_Y + CARD_H / 2 + 3, 50, '#f5c542');

  // score, tags, mode
  centred(x, `${info.score[0]}  –  ${info.score[1]}`, W / 2, 1136, 76, '#ffffff', { stroke: '#000' });
  const tags: string[] = [];
  if (info.won) {
    if (info.fatality) tags.push('FATALITY');
    if (info.flawless) tags.push('FLAWLESS VICTORY');
  } else {
    if (info.fatality) tags.push("GOT FATALITY'D");
    if (info.flawless) tags.push('FLAWLESS DEFEAT');
    if (!tags.length) tags.push('BACK TO THE TRENCHES');
  }
  if (tags.length) centred(x, tags.join('  ·  '), W / 2, 1192, 44, info.won ? '#ff7a2a' : '#ff5a5a', { display: false, stroke: '#000' });
  centred(x, info.mode, W / 2, 1236, 30, '#a89f88', { display: false });

  // footer
  x.fillStyle = '#000000cc';
  x.fillRect(0, H - 82, W, 82);
  x.fillStyle = '#f5c542';
  x.fillRect(0, H - 82, W, 3);
  centred(x, `PLAY FREE  ·  ${SITE_URL.toUpperCase()}`, W / 2, H - 40, 40, '#f5c542', { display: false });
  return c;
}

export function cardFileName(info: CardInfo) {
  return `trenches-kombat-${info.me.id}-vs-${info.opp.id}-${info.won ? 'win' : 'loss'}.jpg`;
}

/** what to say when sharing the card */
export function cardShareText(info: CardInfo) {
  const s = `${info.score[0]}-${info.score[1]}`;
  return info.won
    ? `I just beat ${info.opp.name} as ${info.me.name} in Trenches Kombat (${s})${info.fatality ? ' with a FATALITY' : ''}. Your turn: ${SITE_URL}`
    : `${info.opp.name} sent my ${info.me.name} back to the trenches (${s}). Rematch? ${SITE_URL}`;
}

/** the card as an image file, made ahead of time so SHARE can open the share sheet straight
 *  from the tap (phones only allow that inside the tap itself) */
export function cardFile(c: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((res) => c.toBlob((b) => res(b ? new File([b], name, { type: 'image/jpeg' }) : null), 'image/jpeg', 0.92));
}

/** save the card as an image file */
export function downloadCard(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** can this device share this file (phones: straight to X, WhatsApp, Photos)? */
export function canShareFile(file: File): boolean {
  try {
    return !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** open the share sheet with the card (call straight from a tap) */
export async function shareCard(file: File, text: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
