import Phaser from 'phaser';
import { PHYS } from '../data/normals';

// Three code-drawn arenas in the card art style: dark, glowing, ember-lit.
// Textures are generated on demand for the chosen stage only (keeps phone GPU memory low).

export interface StageDef {
  id: string;
  name: string;
  ambient: number;
}

export const STAGES: StageDef[] = [
  { id: 'temple', name: 'RUINED TEMPLE', ambient: 0xff7a1a },
  { id: 'neon', name: 'NEON CHART CITY', ambient: 0xb026ff },
  { id: 'rooftop', name: 'RAIN-SOAKED ROOFTOP', ambient: 0x4fb8ff },
];

const W = PHYS.stageW + 400; // generous width so zoom/shake never shows an edge
const H = 720;
const G = PHYS.groundY;

type Ctx = CanvasRenderingContext2D;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function vgrad(c: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function glow(c: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- temple
function templeFar(c: Ctx, w: number, h: number) {
  c.fillStyle = vgrad(c, 0, h, [[0, '#120302'], [0.4, '#4a1004'], [0.68, '#b8410d'], [1, '#2a0a03']]);
  c.fillRect(0, 0, w, h);
  // blood-orange sun hanging above the ruins
  glow(c, w * 0.6, h * 0.34, 200, 'rgba(255,170,60,0.85)');
  c.fillStyle = '#ffcf7a';
  c.beginPath();
  c.arc(w * 0.6, h * 0.34, 46, 0, Math.PI * 2);
  c.fill();
  const r = rand(7);
  c.fillStyle = '#1e0805';
  c.beginPath();
  c.moveTo(0, h * 0.8);
  for (let x = 0; x <= w; x += 40) c.lineTo(x, h * 0.7 - r() * 60 - Math.sin(x / 140) * 26);
  c.lineTo(w, h);
  c.lineTo(0, h);
  c.fill();
  // distant stepped temples
  c.fillStyle = '#140504';
  for (const [tx, sc] of [[w * 0.3, 1], [w * 0.75, 0.7]] as const) {
    for (let i = 0; i < 5; i++) c.fillRect(tx - (110 - i * 18) * sc, h * 0.78 - (i + 1) * 16 * sc, (220 - i * 36) * sc, 17 * sc);
  }
}

function templeMid(c: Ctx, w: number, _h: number) {
  const r = rand(11);
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * (w / 9) + r() * 60;
    const top = G - 260 - r() * 220;
    const broken = r() > 0.4;
    const pw = 60 + r() * 30;
    c.fillStyle = '#1f0c07';
    c.fillRect(x, top, pw, G - top);
    // rim light
    c.fillStyle = 'rgba(255,120,40,0.35)';
    c.fillRect(x + pw - 6, top, 6, G - top);
    // capital
    c.fillStyle = '#2a120a';
    c.fillRect(x - 10, top - 14, pw + 20, 18);
    if (broken) {
      c.fillStyle = '#000';
      c.beginPath();
      c.moveTo(x - 12, top - 14);
      c.lineTo(x + pw * 0.4, top - 14 - 30 * r());
      c.lineTo(x + pw + 12, top - 14);
      c.closePath();
      c.globalCompositeOperation = 'destination-out';
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    // hanging banner
    if (r() > 0.6) {
      c.fillStyle = '#5c0d0d';
      c.fillRect(x + 10, top + 30, pw - 20, 120);
      c.fillStyle = '#c99a2e';
      c.fillRect(x + 10, top + 30, pw - 20, 6);
    }
  }
  // braziers
  for (const bx of [w * 0.12, w * 0.88]) {
    c.fillStyle = '#2b160b';
    c.fillRect(bx - 10, G - 150, 20, 150);
    c.fillStyle = '#3b2110';
    c.fillRect(bx - 34, G - 165, 68, 20);
    glow(c, bx, G - 190, 120, 'rgba(255,140,40,0.85)');
  }
}

function templeFloor(c: Ctx, w: number, h: number) {
  c.fillStyle = vgrad(c, G - 20, h, [[0, '#2e140b'], [0.3, '#1a0a05'], [1, '#050201']]);
  c.fillRect(0, G - 20, w, h - G + 20);
  const r = rand(3);
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = 2;
  for (let y = G; y < h; y += 26 + (y - G) * 0.3) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  for (let x = 0; x < w; x += 90) {
    c.beginPath();
    c.moveTo(x, G - 20);
    c.lineTo(x + (x - w / 2) * 0.25, h);
    c.stroke();
  }
  // glowing lava cracks
  c.strokeStyle = 'rgba(255,110,30,0.75)';
  c.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    let x = r() * w;
    let y = G + r() * (h - G);
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 60;
      y += r() * 14;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = vgrad(c, G - 22, G + 6, [[0, 'rgba(255,140,60,0.35)'], [1, 'rgba(255,140,60,0)']]);
  c.fillRect(0, G - 22, w, 28);
}

// ---------------------------------------------------------------- neon chart city
function neonFar(c: Ctx, w: number, h: number) {
  c.fillStyle = vgrad(c, 0, h, [[0, '#03010a'], [0.55, '#1a0638'], [0.8, '#4a0f6e'], [1, '#12021f']]);
  c.fillRect(0, 0, w, h);
  const r = rand(5);
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 120; i++) {
    c.globalAlpha = r() * 0.8;
    c.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5);
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {
    const bw = 20 + r() * 50;
    const bh = 60 + r() * 220;
    const x = r() * w;
    c.fillStyle = '#0d0420';
    c.fillRect(x, h * 0.82 - bh, bw, bh + h);
    c.fillStyle = r() > 0.5 ? 'rgba(80,220,255,0.6)' : 'rgba(255,80,220,0.5)';
    for (let wy = h * 0.82 - bh + 6; wy < h * 0.82; wy += 8) for (let wx = x + 3; wx < x + bw - 3; wx += 6) if (r() > 0.7) c.fillRect(wx, wy, 2, 3);
  }
}

function neonMid(c: Ctx, w: number, _h: number) {
  const r = rand(9);
  for (let i = 0; i < 12; i++) {
    const x = i * (w / 12) + r() * 40;
    const bw = 110 + r() * 60;
    const top = 120 + r() * 220;
    c.fillStyle = '#100626';
    c.fillRect(x, top, bw, G - top);
    c.fillStyle = 'rgba(178,38,255,0.25)';
    c.fillRect(x, top, 3, G - top);
    for (let wy = top + 14; wy < G - 30; wy += 22) {
      for (let wx = x + 12; wx < x + bw - 16; wx += 20) {
        if (r() > 0.55) {
          c.fillStyle = r() > 0.5 ? '#2be0ff' : '#ff4fd8';
          c.globalAlpha = 0.08 + r() * 0.3;
          c.fillRect(wx, wy, 7, 9);
        }
      }
    }
    c.globalAlpha = 1;
  }
  // giant chart billboard
  const bx = w / 2 - 300;
  const by = 30;
  c.fillStyle = 'rgba(5,10,20,0.92)';
  c.fillRect(bx, by, 600, 260);
  c.strokeStyle = '#2be0ff';
  c.lineWidth = 4;
  c.strokeRect(bx, by, 600, 260);
  glow(c, bx + 300, by + 130, 360, 'rgba(43,224,255,0.25)');
  let price = 170;
  for (let i = 0; i < 28; i++) {
    const open = price;
    price += (r() - 0.42) * 40;
    price = Math.max(30, Math.min(230, price));
    const up = price < open;
    c.fillStyle = up ? '#16c784' : '#ea3943';
    const x = bx + 20 + i * 20.5;
    const y0 = by + Math.min(open, price);
    c.fillRect(x + 6, y0 - 10 - r() * 10, 2, Math.abs(open - price) + 26);
    c.fillRect(x, y0, 14, Math.max(4, Math.abs(open - price)));
  }
  c.font = '28px Anton, Impact, sans-serif';
  c.fillStyle = '#16c784';
  c.fillText('$TK  +420.69%', bx + 20, by + 245);
  // neon sign
  c.font = '54px Anton, Impact, sans-serif';
  c.shadowColor = '#ff2fd2';
  c.shadowBlur = 24;
  c.fillStyle = '#ffb8f2';
  c.fillText('WAGMI', w * 0.12, 210);
  c.shadowColor = '#2be0ff';
  c.fillStyle = '#c8f6ff';
  c.fillText('NGMI', w * 0.8, 260);
  c.shadowBlur = 0;
}

function neonFloor(c: Ctx, w: number, h: number) {
  c.fillStyle = vgrad(c, G - 20, h, [[0, '#1a0a33'], [0.2, '#0b0418'], [1, '#020006']]);
  c.fillRect(0, G - 20, w, h - G + 20);
  const r = rand(21);
  for (let i = 0; i < 60; i++) {
    c.fillStyle = r() > 0.5 ? 'rgba(43,224,255,0.18)' : 'rgba(255,79,216,0.16)';
    const x = r() * w;
    c.fillRect(x, G, 2 + r() * 8, 20 + r() * 70);
  }
  c.strokeStyle = 'rgba(178,38,255,0.6)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, G - 18);
  c.lineTo(w, G - 18);
  c.stroke();
  c.setLineDash([60, 40]);
  c.strokeStyle = 'rgba(255,220,80,0.4)';
  c.beginPath();
  c.moveTo(0, G + 50);
  c.lineTo(w, G + 50);
  c.stroke();
  c.setLineDash([]);
}

// ---------------------------------------------------------------- rooftop
function roofFar(c: Ctx, w: number, h: number) {
  c.fillStyle = vgrad(c, 0, h, [[0, '#05080e'], [0.6, '#1a2536'], [1, '#0b1018']]);
  c.fillRect(0, 0, w, h);
  const r = rand(13);
  for (let i = 0; i < 14; i++) {
    c.fillStyle = `rgba(60,80,110,${0.15 + r() * 0.2})`;
    c.beginPath();
    c.ellipse(r() * w, r() * h * 0.4, 150 + r() * 200, 30 + r() * 40, 0, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 70; i++) {
    const bw = 15 + r() * 40;
    const bh = 40 + r() * 200;
    const x = r() * w;
    c.fillStyle = '#0a0f17';
    c.fillRect(x, h * 0.85 - bh, bw, bh + h);
    c.fillStyle = 'rgba(255,200,90,0.5)';
    for (let wy = h * 0.85 - bh + 5; wy < h * 0.85; wy += 7) for (let wx = x + 2; wx < x + bw - 2; wx += 5) if (r() > 0.75) c.fillRect(wx, wy, 2, 2);
  }
  glow(c, w * 0.3, h * 0.85, 300, 'rgba(255,190,90,0.15)');
}

function roofMid(c: Ctx, w: number, _h: number) {
  const r = rand(17);
  // water tower
  const tx = w * 0.2;
  c.fillStyle = '#121a24';
  c.fillRect(tx - 70, G - 380, 140, 170);
  c.beginPath();
  c.moveTo(tx - 80, G - 380);
  c.lineTo(tx, G - 440);
  c.lineTo(tx + 80, G - 380);
  c.fill();
  c.fillRect(tx - 60, G - 210, 8, 210);
  c.fillRect(tx + 52, G - 210, 8, 210);
  c.fillStyle = 'rgba(79,184,255,0.25)';
  c.fillRect(tx + 64, G - 380, 6, 170);
  // AC units and antenna
  for (let i = 0; i < 5; i++) {
    const x = w * 0.4 + i * 220 + r() * 60;
    c.fillStyle = '#18212c';
    c.fillRect(x, G - 70 - r() * 30, 120, 100);
    c.fillStyle = '#0e141c';
    c.beginPath();
    c.arc(x + 60, G - 30, 26, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#0e141c';
  c.fillRect(w * 0.82, G - 520, 6, 520);
  c.fillRect(w * 0.82 - 40, G - 470, 86, 4);
  glow(c, w * 0.82 + 3, G - 525, 30, 'rgba(255,40,40,0.9)');
  // neon sign
  c.font = '64px Anton, Impact, sans-serif';
  c.shadowColor = '#4fb8ff';
  c.shadowBlur = 28;
  c.fillStyle = '#d6f0ff';
  c.fillText('HODL', w * 0.58, G - 300);
  c.shadowBlur = 0;
  c.fillStyle = '#0e141c';
  c.fillRect(w * 0.58 - 10, G - 290, 200, 8);
  c.fillRect(w * 0.58 + 20, G - 282, 6, 282);
  c.fillRect(w * 0.58 + 160, G - 282, 6, 282);
  // railing
  c.fillStyle = '#0b1118';
  c.fillRect(0, G - 110, w, 8);
  for (let x = 0; x < w; x += 46) c.fillRect(x, G - 110, 5, 110);
}

function roofFloor(c: Ctx, w: number, h: number) {
  c.fillStyle = vgrad(c, G - 20, h, [[0, '#28323e'], [0.25, '#151c25'], [1, '#05070a']]);
  c.fillRect(0, G - 20, w, h - G + 20);
  const r = rand(29);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const y = G + 10 + r() * (h - G - 20);
    c.fillStyle = 'rgba(150,200,255,0.10)';
    c.beginPath();
    c.ellipse(x, y, 60 + r() * 120, 6 + r() * 10, 0, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 40; i++) {
    c.fillStyle = 'rgba(214,240,255,0.08)';
    c.fillRect(r() * w, G, 2, 30 + r() * 60);
  }
  c.fillStyle = 'rgba(79,184,255,0.25)';
  c.fillRect(0, G - 20, w, 3);
}

const DRAW: Record<string, [Function, Function, Function]> = {
  temple: [templeFar, templeMid, templeFloor],
  neon: [neonFar, neonMid, neonFloor],
  rooftop: [roofFar, roofMid, roofFloor],
};

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext(), w, h);
  t.refresh();
}

/**
 * A small picture of a stage as the fight camera first sees it (for the arena picker).
 * Drawn on plain canvases at a reduced size, so it adds nothing to the game's textures until asked.
 */
export function stageThumb(scene: Phaser.Scene, id: string, tw = 480, th = 270): string {
  const key = `stage-thumb-${id}`;
  if (scene.textures.exists(key)) return key;
  const [far, mid, floor] = (DRAW[id] ?? DRAW.temple) as unknown as ((c: Ctx, w: number, h: number) => void)[];
  const layer = (draw: (c: Ctx, w: number, h: number) => void, w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!, w, h);
    return c;
  };
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const x = out.getContext('2d')!;
  x.scale(tw / 1280, th / 720);
  // the fight camera starts centred on the stage
  const scrollX = PHYS.stageW / 2 - 640;
  x.drawImage(layer(far, 960, 400), -100 - scrollX * 0.25, -40, 960 * 2.1, 400 * 2);
  x.drawImage(layer(mid, W, H), -200 - scrollX * 0.6, 0);
  x.drawImage(layer(floor, W, H), -200 - scrollX, 0);
  const fog = x.createLinearGradient(0, G - 10, 0, G + 130);
  fog.addColorStop(0, 'rgba(0,0,0,0)');
  fog.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = fog;
  x.fillRect(0, G - 10, 1280, 140);
  scene.textures.addCanvas(key, out);
  return key;
}

/** Nothing heavy at boot; stages are drawn when a fight starts. */
export function generateStages(_scene: Phaser.Scene) {}

/** Build the chosen stage into the scene. Returns an updater for animated bits. */
export function buildStage(scene: Phaser.Scene, id: string): { update: (frame: number) => void } {
  // free other stages' textures
  for (const s of STAGES) {
    if (s.id === id) continue;
    for (const l of ['far', 'mid', 'floor']) if (scene.textures.exists(`stage-${s.id}-${l}`)) scene.textures.remove(`stage-${s.id}-${l}`);
  }
  const [far, mid, floor] = DRAW[id] ?? DRAW.temple;
  makeTex(scene, `stage-${id}-far`, 960, 400, far as (c: Ctx, w: number, h: number) => void);
  makeTex(scene, `stage-${id}-mid`, W, H, mid as (c: Ctx, w: number, h: number) => void);
  makeTex(scene, `stage-${id}-floor`, W, H, floor as (c: Ctx, w: number, h: number) => void);

  const x0 = -200;
  scene.add.image(-100, -40, `stage-${id}-far`).setOrigin(0, 0).setScale(2.1, 2).setScrollFactor(0.25, 0.4).setDepth(-30);
  scene.add.image(x0, 0, `stage-${id}-mid`).setOrigin(0, 0).setScrollFactor(0.6, 0.8).setDepth(-20);
  scene.add.image(x0, 0, `stage-${id}-floor`).setOrigin(0, 0).setDepth(-10);

  // atmosphere
  const fog = scene.add.graphics().setDepth(-5);
  fog.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
  fog.fillRect(-300, G - 10, W + 400, 140);

  let update: (frame: number) => void = () => {};
  if (id === 'temple') {
    scene.add
      .particles(0, 0, 'ember', {
        x: { min: -200, max: PHYS.stageW + 200 },
        y: { min: G - 40, max: G + 40 },
        lifespan: 4200,
        speedY: { min: -120, max: -40 },
        speedX: { min: -30, max: 30 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xff7a1a, 0xffb347, 0xff3b1a],
        frequency: 60,
        blendMode: 'ADD',
      })
      .setDepth(30);
    for (const bx of [-200 + W * 0.12, -200 + W * 0.88]) {
      scene.add
        .particles(0, 0, 'flame', {
          x: { min: bx - 20, max: bx + 20 },
          y: G - 175,
          lifespan: 500,
          speedY: { min: -140, max: -60 },
          scale: { start: 0.8, end: 0 },
          alpha: { start: 0.9, end: 0 },
          frequency: 40,
          blendMode: 'ADD',
        })
        .setScrollFactor(0.6, 0.8)
        .setDepth(-19);
    }
  } else if (id === 'neon') {
    scene.add
      .particles(0, 0, 'dot', {
        x: { min: -200, max: PHYS.stageW + 200 },
        y: { min: 0, max: G },
        lifespan: 5000,
        speedY: { min: -15, max: 15 },
        speedX: { min: -15, max: 15 },
        scale: { start: 0.25, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: [0x2be0ff, 0xff4fd8, 0xb026ff],
        frequency: 120,
        blendMode: 'ADD',
      })
      .setDepth(-4);
    const ticker = scene.add
      .text(0, G + 60, '  $TK ▲ 420%   $TK ▲ 69%   $TK ▲ 4.2%   $TK ▲ 1000%   $TK ▲ 12%   $TK ▲ 100x  ', {
        fontFamily: 'Anton, Impact, sans-serif',
        fontSize: '22px',
        color: '#2be0ff',
      })
      .setAlpha(0.35)
      .setDepth(-8);
    update = (f) => {
      ticker.x = PHYS.stageW - ((f * 1.2) % (PHYS.stageW + ticker.width));
    };
  } else if (id === 'rooftop') {
    scene.add
      .particles(0, 0, 'px', {
        x: { min: -400, max: PHYS.stageW + 400 },
        y: -40,
        lifespan: 900,
        speedY: { min: 900, max: 1200 },
        speedX: { min: -260, max: -200 },
        scaleX: 0.35,
        scaleY: { min: 4, max: 7 },
        rotate: 12,
        alpha: { start: 0.45, end: 0.2 },
        tint: 0xb8d8ff,
        quantity: 3,
        frequency: 16,
      })
      .setDepth(35);
    const flash = scene.add.rectangle(PHYS.stageW / 2, 360, PHYS.stageW + 1200, 1400, 0xdde8ff, 0).setDepth(-15).setScrollFactor(0.6);
    update = (f) => {
      if (f % 480 === 300 || f % 480 === 310) {
        flash.setAlpha(0.35);
        scene.tweens.add({ targets: flash, alpha: 0, duration: 260 });
      }
    };
  }
  return { update };
}
