import Phaser from 'phaser';

// Code-drawn textures for projectiles, drops and effects. Each one is drawn once
// with the Canvas 2D API at boot and cached as a Phaser texture.

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

const FONT = 'Anton, "Bebas Neue", Impact, sans-serif';

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function star(c: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outer: number, inner: number) {
  c.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, fill: string, stroke?: string) {
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (stroke) {
    c.lineWidth = Math.max(2, size / 7);
    c.strokeStyle = stroke;
    c.strokeText(s, x, y);
  }
  c.fillStyle = fill;
  c.fillText(s, x, y);
}

const ART: Record<string, [number, number, Draw]> = {
  px: [4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); }],
  dot: [32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
  }],
  ember: [8, 8, (c) => {
    const g = c.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, '#fff');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 8);
  }],
  spark: [64, 64, (c) => {
    c.fillStyle = '#fff';
    star(c, 32, 32, 8, 31, 6);
    c.fill();
  }],
  soapbubble: [56, 56, (c) => {
    // a see-through bubble: a pale rim, a soft fill and a highlight
    const g = c.createRadialGradient(22, 20, 2, 28, 28, 27);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(160,230,255,0.12)');
    g.addColorStop(0.9, 'rgba(200,170,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.8)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(28, 28, 26, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.ellipse(19, 17, 6, 3.5, -0.6, 0, Math.PI * 2);
    c.fill();
  }],
  ring: [128, 128, (c) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(64, 64, 58, 0, Math.PI * 2);
    c.stroke();
  }],
  shadow: [160, 36, (c) => {
    const g = c.createRadialGradient(80, 18, 0, 80, 18, 80);
    g.addColorStop(0, 'rgba(0,0,0,0.65)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.save();
    c.scale(1, 36 / 160);
    c.fillRect(0, 0, 160, 160);
    c.restore();
  }],
  shield: [120, 240, (c) => {
    const g = c.createLinearGradient(0, 0, 120, 0);
    g.addColorStop(0, 'rgba(80,170,255,0)');
    g.addColorStop(0.6, 'rgba(80,170,255,0.35)');
    g.addColorStop(1, 'rgba(160,220,255,0.9)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(40, 120, 76, 116, 0, -Math.PI / 2, Math.PI / 2);
    c.fill();
  }],
  solcoin: [44, 44, (c) => {
    const g = c.createLinearGradient(0, 0, 44, 44);
    g.addColorStop(0, '#9945ff');
    g.addColorStop(1, '#14f195');
    c.fillStyle = g;
    c.beginPath();
    c.arc(22, 22, 20, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#0b0b16';
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate(22, 13 + i * 9);
      c.transform(1, 0, -0.35, 1, 0, 0);
      c.fillRect(-10, -2.5, 20, 5);
      c.restore();
    }
  }],
  wallet: [60, 46, (c) => {
    rr(c, 2, 6, 56, 38, 8);
    c.fillStyle = '#6b3d1e';
    c.fill();
    c.strokeStyle = '#2b1609';
    c.lineWidth = 3;
    c.stroke();
    rr(c, 30, 16, 28, 18, 5);
    c.fillStyle = '#8a5530';
    c.fill();
    c.stroke();
    c.fillStyle = '#f5c542';
    c.beginPath();
    c.arc(40, 25, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3d8f3d';
    c.fillRect(8, 2, 22, 8);
  }],
  cybertruck: [240, 100, (c) => {
    c.fillStyle = '#c9ccd1';
    c.strokeStyle = '#3a3d42';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(6, 70);
    c.lineTo(10, 48);
    c.lineTo(110, 10);
    c.lineTo(232, 44);
    c.lineTo(234, 70);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#20242a';
    c.beginPath();
    c.moveTo(70, 34);
    c.lineTo(110, 18);
    c.lineTo(160, 32);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    c.fillRect(214, 46, 20, 4);
    c.fillStyle = '#e33';
    c.fillRect(6, 52, 8, 4);
    for (const x of [52, 186]) {
      c.fillStyle = '#111';
      c.beginPath();
      c.arc(x, 74, 20, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#666';
      c.beginPath();
      c.arc(x, 74, 9, 0, Math.PI * 2);
      c.fill();
    }
  }],
  cash: [64, 30, (c) => {
    c.fillStyle = '#7fbf6a';
    c.fillRect(1, 1, 62, 28);
    c.strokeStyle = '#2f5e26';
    c.lineWidth = 2;
    c.strokeRect(3, 3, 58, 24);
    c.fillStyle = '#cfe8c4';
    c.beginPath();
    c.ellipse(32, 15, 10, 10, 0, 0, Math.PI * 2);
    c.fill();
    text(c, '$', 32, 16, 16, '#2f5e26');
  }],
  garri: [60, 40, (c) => {
    c.fillStyle = '#f2e3b3';
    c.beginPath();
    c.ellipse(30, 14, 26, 9, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 40; i++) {
      c.fillStyle = i % 2 ? '#e8d08a' : '#fff6d6';
      c.fillRect(8 + Math.random() * 44, 8 + Math.random() * 12, 2, 2);
    }
    c.fillStyle = '#c0392b';
    c.beginPath();
    c.moveTo(3, 14);
    c.quadraticCurveTo(30, 54, 57, 14);
    c.closePath();
    c.fill();
    c.fillStyle = '#e74c3c';
    c.fillRect(10, 20, 40, 3);
  }],
  thread: [70, 50, (c) => {
    rr(c, 2, 2, 66, 46, 6);
    c.fillStyle = '#f7f7f2';
    c.fill();
    c.fillStyle = '#1d9bf0';
    c.beginPath();
    c.arc(12, 12, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#555';
    for (let i = 0; i < 4; i++) c.fillRect(8, 22 + i * 6, 50 - (i % 2) * 14, 3);
    text(c, '1/47', 50, 12, 11, '#1d9bf0');
  }],
  candleG: [24, 80, (c) => {
    c.fillStyle = '#16c784';
    c.fillRect(11, 0, 2, 80);
    c.fillRect(3, 14, 18, 50);
    c.strokeStyle = '#b8ffd9';
    c.lineWidth = 2;
    c.strokeRect(3, 14, 18, 50);
  }],
  candleR: [24, 80, (c) => {
    c.fillStyle = '#ea3943';
    c.fillRect(11, 0, 2, 80);
    c.fillRect(3, 14, 18, 50);
    c.strokeStyle = '#ffc2c5';
    c.lineWidth = 2;
    c.strokeRect(3, 14, 18, 50);
  }],
  callorb: [56, 56, (c) => {
    const g = c.createRadialGradient(28, 28, 2, 28, 28, 28);
    g.addColorStop(0, '#d8ffe9');
    g.addColorStop(0.5, '#16c784');
    g.addColorStop(1, 'rgba(22,199,132,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 56, 56);
    c.fillStyle = '#04331f';
    c.beginPath();
    c.moveTo(28, 12);
    c.lineTo(40, 28);
    c.lineTo(32, 28);
    c.lineTo(32, 42);
    c.lineTo(24, 42);
    c.lineTo(24, 28);
    c.lineTo(16, 28);
    c.closePath();
    c.fill();
  }],
  code: [66, 40, (c) => {
    rr(c, 1, 1, 64, 38, 6);
    c.fillStyle = 'rgba(6,20,14,0.92)';
    c.fill();
    c.strokeStyle = '#2bff88';
    c.lineWidth = 2;
    c.stroke();
    text(c, '</>', 33, 21, 22, '#2bff88');
  }],
  rust: [52, 52, (c) => {
    c.fillStyle = '#e8743b';
    star(c, 26, 26, 10, 25, 19);
    c.fill();
    c.fillStyle = '#2a1206';
    c.beginPath();
    c.arc(26, 26, 11, 0, Math.PI * 2);
    c.fill();
    text(c, 'R', 26, 27, 16, '#e8743b');
  }],
  bubble: [76, 50, (c) => {
    rr(c, 2, 2, 72, 34, 14);
    c.fillStyle = '#ffffff';
    c.fill();
    c.beginPath();
    c.moveTo(16, 34);
    c.lineTo(10, 48);
    c.lineTo(28, 35);
    c.fill();
    text(c, 'gm ser', 38, 20, 17, '#1d9bf0');
  }],
  statement: [60, 78, (c) => {
    c.fillStyle = '#fbfbf5';
    c.fillRect(2, 2, 56, 74);
    c.strokeStyle = '#333';
    c.lineWidth = 2;
    c.strokeRect(2, 2, 56, 74);
    text(c, 'STATEMENT', 30, 12, 10, '#b3261e');
    c.fillStyle = '#777';
    for (let i = 0; i < 7; i++) c.fillRect(8, 22 + i * 7, i % 3 === 2 ? 26 : 44, 2);
    text(c, '$$$', 30, 68, 12, '#1a7f37');
  }],
  echo: [72, 72, (c) => {
    c.strokeStyle = '#b26bff';
    for (let i = 0; i < 3; i++) {
      c.globalAlpha = 1 - i * 0.28;
      c.lineWidth = 5 - i;
      c.beginPath();
      c.arc(36, 36, 12 + i * 11, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#efe0ff';
    c.beginPath();
    c.arc(36, 36, 7, 0, Math.PI * 2);
    c.fill();
  }],
  chip: [48, 48, (c) => {
    c.fillStyle = '#c0392b';
    c.beginPath();
    c.arc(24, 24, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) {
      c.save();
      c.translate(24, 24);
      c.rotate((i * Math.PI) / 4);
      c.fillRect(-3, -22, 6, 7);
      c.restore();
    }
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(24, 24, 12, 0, Math.PI * 2);
    c.stroke();
  }],
  card: [42, 58, (c) => {
    rr(c, 1, 1, 40, 56, 5);
    c.fillStyle = '#fff';
    c.fill();
    c.strokeStyle = '#222';
    c.lineWidth = 2;
    c.stroke();
    text(c, 'A', 11, 11, 13, '#c0392b');
    text(c, '♠', 21, 32, 24, '#111');
  }],
  gem: [44, 44, (c) => {
    c.fillStyle = '#5ef2ff';
    c.beginPath();
    c.moveTo(22, 40);
    c.lineTo(4, 16);
    c.lineTo(12, 6);
    c.lineTo(32, 6);
    c.lineTo(40, 16);
    c.closePath();
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(4, 16);
    c.lineTo(40, 16);
    c.moveTo(22, 40);
    c.lineTo(16, 16);
    c.lineTo(22, 6);
    c.lineTo(28, 16);
    c.closePath();
    c.stroke();
  }],
  star: [48, 48, (c) => {
    c.fillStyle = '#ffb627';
    star(c, 24, 25, 5, 22, 10);
    c.fill();
    c.strokeStyle = '#fff3c4';
    c.lineWidth = 2;
    c.stroke();
  }],
  meme: [60, 60, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(30, 30, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f2d14b';
    c.beginPath();
    c.arc(30, 30, 24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(21, 25, 4, 0, Math.PI * 2);
    c.arc(39, 25, 4, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#222';
    c.beginPath();
    c.arc(30, 32, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
  }],
  shadoworb: [52, 52, (c) => {
    const g = c.createRadialGradient(26, 26, 2, 26, 26, 26);
    g.addColorStop(0, '#f1d6ff');
    g.addColorStop(0.35, '#8b2bff');
    g.addColorStop(0.7, 'rgba(40,0,80,0.8)');
    g.addColorStop(1, 'rgba(40,0,80,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 52, 52);
  }],
  promo: [62, 30, (c) => {
    c.fillStyle = '#ffd400';
    c.beginPath();
    c.moveTo(12, 2);
    c.lineTo(60, 2);
    c.lineTo(60, 28);
    c.lineTo(12, 28);
    c.lineTo(2, 15);
    c.closePath();
    c.fill();
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(12, 15, 3, 0, Math.PI * 2);
    c.fill();
    text(c, 'PROMO', 37, 16, 13, '#d0021b');
  }],
  trap: [130, 40, (c) => {
    rr(c, 1, 6, 128, 32, 4);
    c.fillStyle = 'rgba(8,30,20,0.85)';
    c.fill();
    c.strokeStyle = '#2bff88';
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(6, 32);
    c.lineTo(30, 20);
    c.lineTo(50, 28);
    c.lineTo(80, 12);
    c.lineTo(100, 18);
    c.lineTo(124, 8);
    c.stroke();
  }],
  lens: [96, 96, (c) => {
    c.strokeStyle = '#39ff8f';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(48, 48, 34, 0, Math.PI * 2);
    c.moveTo(48, 4);
    c.lineTo(48, 30);
    c.moveTo(48, 66);
    c.lineTo(48, 92);
    c.moveTo(4, 48);
    c.lineTo(30, 48);
    c.moveTo(66, 48);
    c.lineTo(92, 48);
    c.stroke();
    c.fillStyle = '#39ff8f';
    c.beginPath();
    c.arc(48, 48, 4, 0, Math.PI * 2);
    c.fill();
  }],
  slash: [200, 80, (c) => {
    const g = c.createLinearGradient(0, 0, 200, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, '#fff');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 60);
    c.quadraticCurveTo(110, -10, 200, 30);
    c.quadraticCurveTo(110, 20, 0, 60);
    c.fill();
  }],
  // CZ: a plain gold coin (no symbol)
  goldcoin: [44, 44, (c) => {
    const g = c.createLinearGradient(0, 0, 44, 44);
    g.addColorStop(0, '#fff1a8');
    g.addColorStop(0.5, '#f3ba2f');
    g.addColorStop(1, '#b07a0c');
    c.fillStyle = g;
    c.beginPath();
    c.arc(22, 22, 20, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff6d0';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = 'rgba(120,80,0,0.6)';
    c.beginPath();
    c.arc(22, 22, 13, 0, Math.PI * 2);
    c.stroke();
  }],
  // Jelitics: a drawing stylus, tip forward, and a glowing sketch stroke
  stylus: [90, 20, (c) => {
    c.fillStyle = '#1a1a22';
    c.beginPath();
    c.roundRect(4, 5, 66, 10, 5);
    c.fill();
    c.fillStyle = '#3a3a48';
    c.fillRect(14, 6, 30, 3);
    c.fillStyle = '#2be0ff';
    c.beginPath();
    c.moveTo(70, 5);
    c.lineTo(88, 10);
    c.lineTo(70, 15);
    c.closePath();
    c.fill();
  }],
  sketch: [200, 80, (c) => {
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(43,224,255,0.35)';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(10, 58);
    c.bezierCurveTo(60, 10, 120, 70, 190, 20);
    c.stroke();
    c.strokeStyle = '#d8fbff';
    c.lineWidth = 5;
    c.stroke();
  }],
  flame: [48, 72, (c) => {
    const g = c.createRadialGradient(24, 52, 2, 24, 44, 34);
    g.addColorStop(0, '#fff6d0');
    g.addColorStop(0.3, '#ffb000');
    g.addColorStop(0.7, '#ff3d00');
    g.addColorStop(1, 'rgba(255,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(24, 0);
    c.quadraticCurveTo(48, 40, 38, 62);
    c.quadraticCurveTo(24, 76, 10, 62);
    c.quadraticCurveTo(0, 40, 24, 0);
    c.fill();
  }],
  crown: [90, 60, (c) => {
    c.fillStyle = '#f5c542';
    c.strokeStyle = '#7a5410';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(6, 54);
    c.lineTo(4, 14);
    c.lineTo(26, 32);
    c.lineTo(45, 4);
    c.lineTo(64, 32);
    c.lineTo(86, 14);
    c.lineTo(84, 54);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#e0245e';
    c.beginPath();
    c.arc(45, 40, 6, 0, Math.PI * 2);
    c.fill();
  }],
  heart: [44, 40, (c) => {
    c.fillStyle = '#f91880';
    c.beginPath();
    c.moveTo(22, 38);
    c.bezierCurveTo(-8, 16, 8, -6, 22, 10);
    c.bezierCurveTo(36, -6, 52, 16, 22, 38);
    c.fill();
  }],
  phone: [44, 74, (c) => {
    rr(c, 2, 2, 40, 70, 7);
    c.fillStyle = '#111';
    c.fill();
    rr(c, 6, 10, 32, 52, 3);
    c.fillStyle = '#1d9bf0';
    c.fill();
    text(c, 'DM', 22, 36, 16, '#fff');
  }],
  book: [48, 58, (c) => {
    c.fillStyle = '#e67e22';
    c.fillRect(4, 2, 40, 54);
    c.fillStyle = '#fff3e0';
    c.fillRect(40, 4, 6, 50);
    text(c, 'WEB3', 24, 22, 13, '#3b1d00');
    text(c, '101', 24, 38, 13, '#3b1d00');
  }],
  briefcase: [70, 52, (c) => {
    c.fillStyle = '#5a3a1a';
    rr(c, 2, 12, 66, 38, 5);
    c.fill();
    c.strokeStyle = '#c9a227';
    c.lineWidth = 3;
    c.strokeRect(24, 2, 22, 12);
    c.fillStyle = '#c9a227';
    c.fillRect(30, 26, 10, 8);
  }],
  invoice: [180, 230, (c) => {
    c.fillStyle = '#fffdf6';
    c.fillRect(4, 4, 172, 222);
    c.strokeStyle = '#222';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 172, 222);
    text(c, 'INVOICE', 90, 30, 30, '#111');
    c.fillStyle = '#999';
    for (let i = 0; i < 6; i++) c.fillRect(20, 60 + i * 16, 140 - (i % 2) * 40, 4);
    text(c, 'GAS FEE', 90, 170, 26, '#b3261e');
    text(c, '9,999 $TK', 90, 200, 22, '#b3261e');
  }],
  dollar: [40, 40, (c) => text(c, '$', 20, 22, 36, '#7fff7f', '#0a3d0a')],
  zero: [60, 60, (c) => text(c, '$0', 30, 32, 42, '#ffd400', '#3d2a00')],
  question: [40, 50, (c) => text(c, '?', 20, 27, 44, '#ffffff', '#222')],
  lightning: [40, 90, (c) => {
    c.fillStyle = '#7fd3ff';
    c.beginPath();
    c.moveTo(24, 0);
    c.lineTo(6, 50);
    c.lineTo(20, 50);
    c.lineTo(12, 90);
    c.lineTo(36, 36);
    c.lineTo(22, 36);
    c.lineTo(32, 0);
    c.closePath();
    c.fill();
  }],
  leaf: [36, 22, (c) => {
    c.fillStyle = '#ff8a2a';
    c.beginPath();
    c.ellipse(18, 11, 16, 8, 0.3, 0, Math.PI * 2);
    c.fill();
  }],
  bolt: [64, 24, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, '#fff');
    c.fillStyle = g;
    rr(c, 0, 6, 64, 12, 6);
    c.fill();
  }],
  mic: [36, 64, (c) => {
    c.fillStyle = '#ddd';
    rr(c, 8, 2, 20, 34, 10);
    c.fill();
    c.fillStyle = '#555';
    c.fillRect(16, 36, 4, 18);
    c.fillRect(8, 54, 20, 4);
  }],
  roulette: [120, 120, (c) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i === 0 ? '#1a7f37' : i % 2 ? '#c0392b' : '#111';
      c.beginPath();
      c.moveTo(60, 60);
      c.arc(60, 60, 56, (i * Math.PI) / 8, ((i + 1) * Math.PI) / 8);
      c.closePath();
      c.fill();
    }
    c.strokeStyle = '#f5c542';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(60, 60, 56, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#f5c542';
    c.beginPath();
    c.arc(60, 60, 12, 0, Math.PI * 2);
    c.fill();
  }],
  ice: [140, 300, (c) => {
    const g = c.createLinearGradient(0, 0, 140, 300);
    g.addColorStop(0, 'rgba(200,240,255,0.65)');
    g.addColorStop(1, 'rgba(90,170,255,0.45)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(20, 0);
    c.lineTo(120, 10);
    c.lineTo(140, 150);
    c.lineTo(126, 300);
    c.lineTo(10, 296);
    c.lineTo(0, 140);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.stroke();
  }],
  // ---- batch 2 fighters
  basketball: [52, 52, (c) => {
    c.fillStyle = '#f07a1a';
    c.beginPath();
    c.arc(26, 26, 24, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3a1a00';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(26, 26, 24, 0, Math.PI * 2);
    c.moveTo(2, 26);
    c.lineTo(50, 26);
    c.moveTo(26, 2);
    c.lineTo(26, 50);
    c.stroke();
    c.beginPath();
    c.arc(4, 26, 18, -Math.PI / 2.4, Math.PI / 2.4);
    c.stroke();
    c.beginPath();
    c.arc(48, 26, 18, Math.PI - Math.PI / 2.4, Math.PI + Math.PI / 2.4);
    c.stroke();
  }],
  eth: [44, 68, (c) => {
    const pts: [number, number][][] = [
      [[22, 0], [42, 34], [22, 44]],
      [[22, 0], [2, 34], [22, 44]],
      [[22, 48], [42, 38], [22, 68]],
      [[22, 48], [2, 38], [22, 68]],
    ];
    const fills = ['#8fa8ff', '#c9d4ff', '#6f86ff', '#a9b9ff'];
    pts.forEach((tri, i) => {
      c.fillStyle = fills[i];
      c.beginPath();
      c.moveTo(tri[0][0], tri[0][1]);
      c.lineTo(tri[1][0], tri[1][1]);
      c.lineTo(tri[2][0], tri[2][1]);
      c.closePath();
      c.fill();
    });
  }],
  rocket: [40, 90, (c) => {
    c.fillStyle = '#e8e8f0';
    c.beginPath();
    c.moveTo(20, 0);
    c.quadraticCurveTo(36, 22, 32, 64);
    c.lineTo(8, 64);
    c.quadraticCurveTo(4, 22, 20, 0);
    c.fill();
    c.fillStyle = '#ff3b3b';
    c.beginPath();
    c.moveTo(8, 50);
    c.lineTo(0, 70);
    c.lineTo(10, 64);
    c.moveTo(32, 50);
    c.lineTo(40, 70);
    c.lineTo(30, 64);
    c.fill();
    c.fillStyle = '#3bb0ff';
    c.beginPath();
    c.arc(20, 28, 6, 0, Math.PI * 2);
    c.fill();
    const g = c.createLinearGradient(0, 64, 0, 90);
    g.addColorStop(0, '#ffe066');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(10, 64);
    c.lineTo(30, 64);
    c.lineTo(20, 90);
    c.fill();
  }],
  smoke: [96, 72, (c) => {
    for (const [x, y, r] of [[30, 44, 24], [52, 32, 28], [70, 46, 22], [46, 52, 20]]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(230,230,230,0.9)');
      g.addColorStop(1, 'rgba(160,160,160,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }],
  drum: [70, 40, (c) => {
    c.strokeStyle = '#ffd36b';
    c.lineWidth = 5;
    for (const r of [10, 22, 34]) {
      c.beginPath();
      c.arc(4, 36, r, -Math.PI / 2.2, 0);
      c.stroke();
    }
  }],
  avatar: [48, 48, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(24, 24, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3b82f6';
    c.beginPath();
    c.arc(24, 24, 19, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(24, 19, 7, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(24, 38, 12, Math.PI, 0);
    c.fill();
  }],
  paper: [56, 72, (c) => {
    c.fillStyle = '#fbfbf2';
    rr(c, 2, 2, 52, 68, 3);
    c.fill();
    c.strokeStyle = '#999';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#9aa';
    for (let y = 14; y < 64; y += 7) c.fillRect(9, y, 38 - ((y * 7) % 13), 2);
    text(c, 'WP', 28, 12, 10, '#333');
  }],
  // ---------------------------------------------------------------- batch 4
  rug: [150, 34, (c) => {
    rr(c, 8, 4, 134, 26, 3);
    c.fillStyle = '#9e1b2a';
    c.fill();
    c.strokeStyle = '#e8b64a';
    c.lineWidth = 3;
    rr(c, 13, 8, 124, 18, 2);
    c.stroke();
    c.fillStyle = '#e8b64a';
    star(c, 75, 17, 4, 7, 3);
    c.fill();
    c.strokeStyle = '#f3d27a';
    c.lineWidth = 1.5;
    for (let y = 6; y <= 28; y += 4) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(8, y);
      c.moveTo(142, y);
      c.lineTo(150, y);
      c.stroke();
    }
  }],
  page: [44, 56, (c) => {
    c.shadowColor = '#b26bff';
    c.shadowBlur = 8;
    c.fillStyle = '#141018';
    rr(c, 5, 5, 34, 46, 2);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#a64bff';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#7d5aa6';
    for (let y = 13; y < 46; y += 6) c.fillRect(10, y, 24 - ((y * 5) % 9), 2);
  }],
  ratio: [110, 50, (c) => {
    rr(c, 3, 3, 104, 34, 8);
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = '#e0245e';
    c.lineWidth = 3;
    c.stroke();
    c.beginPath();
    c.moveTo(20, 36);
    c.lineTo(14, 48);
    c.lineTo(32, 36);
    c.fill();
    text(c, 'RATIO', 55, 21, 22, '#e0245e');
  }],
  puddle: [130, 40, (c) => {
    const g = c.createRadialGradient(65, 26, 4, 65, 26, 64);
    g.addColorStop(0, '#9fe8ff');
    g.addColorStop(0.5, '#2a8dff');
    g.addColorStop(1, 'rgba(20,60,200,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(65, 28, 62, 11, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#c8f4ff';
    c.lineWidth = 2;
    for (const [x, y, r] of [[40, 20, 6], [70, 14, 8], [96, 22, 5], [58, 26, 4]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
    }
  }],
  blueflame: [48, 72, (c) => {
    const g = c.createRadialGradient(24, 52, 2, 24, 44, 34);
    g.addColorStop(0, '#f0fbff');
    g.addColorStop(0.3, '#6fd0ff');
    g.addColorStop(0.7, '#1f5bff');
    g.addColorStop(1, 'rgba(0,40,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(24, 0);
    c.quadraticCurveTo(48, 40, 38, 62);
    c.quadraticCurveTo(24, 76, 10, 62);
    c.quadraticCurveTo(0, 40, 24, 0);
    c.fill();
  }],
  crescent: [70, 110, (c) => {
    c.shadowColor = '#39ff6a';
    c.shadowBlur = 14;
    const g = c.createLinearGradient(0, 0, 70, 0);
    g.addColorStop(0, 'rgba(57,255,106,0.2)');
    g.addColorStop(0.6, '#8dffb0');
    g.addColorStop(1, '#ffffff');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(20, 6);
    c.quadraticCurveTo(80, 55, 20, 104);
    c.quadraticCurveTo(52, 55, 20, 6);
    c.fill();
  }],
};

export function generateArt(scene: Phaser.Scene) {
  for (const [key, [w, h, draw]] of Object.entries(ART)) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) continue;
    const ctx = tex.getContext();
    draw(ctx, w, h);
    tex.refresh();
  }
}

export const ART_KEYS = Object.keys(ART);
