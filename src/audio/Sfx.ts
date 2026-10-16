// Synthesized sound effects and a procedural dark-trap loop (Web Audio, no files).
// Everything is generated at runtime, so there are no licensing questions.

const STORE_KEY = 'trenches.muted';

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(m: boolean) {
  try {
    localStorage.setItem(STORE_KEY, m ? '1' : '0');
  } catch {
    /* storage unavailable: setting just won't persist */
  }
}

export type SfxName =
  | 'hit'
  | 'hitHeavy'
  | 'block'
  | 'armor'
  | 'swing'
  | 'swingHeavy'
  | 'whoosh'
  | 'dash'
  | 'jump'
  | 'thud'
  | 'wall'
  | 'projectile'
  | 'summon'
  | 'teleport'
  | 'slash'
  | 'grab'
  | 'counter'
  | 'buff'
  | 'status'
  | 'charge'
  | 'super'
  | 'ko'
  | 'select'
  | 'confirm'
  | 'back'
  | 'announce'
  | 'fatality'
  | 'coin';

class Synth {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  private noise: AudioBuffer;
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    const len = this.ctx.sampleRate * 1;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get now() {
    return this.ctx.currentTime;
  }

  env(g: GainNode, t: number, a: number, peak: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }

  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, out: AudioNode = this.sfx, t = this.now) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hiss(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, q = 1, out: AudioNode = this.sfx, t = this.now) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bf = this.ctx.createBiquadFilter();
    bf.type = filter;
    bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t);
    bf.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, vol, dur);
    src.connect(bf).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    const t = this.now;
    switch (name) {
      case 'hit':
        this.hiss(0.09, 0.7, 'bandpass', 2200, 600, 1.2);
        this.tone('sine', 180, 60, 0.12, 0.6);
        break;
      case 'hitHeavy':
        this.hiss(0.18, 0.9, 'lowpass', 3000, 200, 0.8);
        this.tone('sine', 140, 40, 0.28, 0.9);
        this.tone('square', 90, 40, 0.12, 0.2);
        break;
      case 'block':
        this.tone('square', 1300, 1100, 0.06, 0.18);
        this.tone('triangle', 2100, 1800, 0.12, 0.2);
        this.hiss(0.05, 0.3, 'highpass', 4000, 3000);
        break;
      case 'armor':
        this.tone('square', 700, 500, 0.1, 0.22);
        this.tone('sine', 120, 70, 0.15, 0.5);
        break;
      case 'swing':
        this.hiss(0.1, 0.25, 'bandpass', 900, 2800, 2);
        break;
      case 'swingHeavy':
        this.hiss(0.18, 0.35, 'bandpass', 500, 2200, 2);
        break;
      case 'whoosh':
      case 'dash':
        this.hiss(0.22, 0.35, 'bandpass', 400, 3000, 1.5);
        break;
      case 'jump':
        this.tone('triangle', 220, 520, 0.12, 0.2);
        break;
      case 'thud':
        this.tone('sine', 110, 35, 0.3, 0.8);
        this.hiss(0.12, 0.3, 'lowpass', 800, 100);
        break;
      case 'wall':
        this.tone('sine', 90, 30, 0.35, 0.9);
        this.hiss(0.2, 0.5, 'lowpass', 1500, 100);
        break;
      case 'projectile':
        this.tone('sawtooth', 880, 220, 0.2, 0.18);
        this.tone('sine', 440, 110, 0.2, 0.25);
        break;
      case 'summon':
        [0, 0.06, 0.12].forEach((d, i) => this.tone('triangle', 330 * (1 + i * 0.5), 330 * (1 + i * 0.5), 0.14, 0.18, this.sfx, t + d));
        break;
      case 'teleport':
        this.tone('sine', 200, 1600, 0.12, 0.25);
        this.tone('sine', 1600, 300, 0.18, 0.2, this.sfx, t + 0.12);
        break;
      case 'slash':
        this.hiss(0.16, 0.5, 'highpass', 2000, 7000, 1);
        break;
      case 'grab':
        this.tone('sine', 160, 80, 0.2, 0.7);
        this.hiss(0.08, 0.4, 'bandpass', 1200, 400);
        break;
      case 'counter':
        this.tone('sine', 1320, 1320, 0.5, 0.25);
        this.tone('sine', 1980, 1980, 0.4, 0.15);
        break;
      case 'buff':
        [0, 0.05, 0.1, 0.15].forEach((d, i) => this.tone('sine', 523 * Math.pow(1.26, i), 523 * Math.pow(1.26, i), 0.3, 0.12, this.sfx, t + d));
        break;
      case 'status':
        this.tone('sawtooth', 300, 120, 0.4, 0.15);
        this.tone('sine', 600, 200, 0.3, 0.15);
        break;
      case 'charge':
        this.tone('triangle', 200, 900, 0.3, 0.2);
        break;
      case 'super':
        this.tone('sawtooth', 60, 30, 1.4, 0.5);
        this.hiss(1.2, 0.6, 'lowpass', 4000, 80, 0.7);
        this.tone('sine', 880, 110, 1.0, 0.2);
        break;
      case 'ko':
        this.tone('sine', 120, 25, 1.2, 1);
        this.hiss(0.8, 0.7, 'lowpass', 5000, 60, 0.7);
        break;
      case 'select':
        this.tone('square', 660, 660, 0.04, 0.08);
        break;
      case 'confirm':
        this.tone('square', 523, 523, 0.07, 0.1);
        this.tone('square', 784, 784, 0.12, 0.1, this.sfx, t + 0.07);
        break;
      case 'back':
        this.tone('square', 392, 262, 0.1, 0.1);
        break;
      case 'announce':
        // dark brass-ish stab
        [110, 131, 165].forEach((f) => this.tone('sawtooth', f, f * 0.98, 0.9, 0.16));
        this.tone('sine', 55, 50, 0.9, 0.5);
        break;
      case 'fatality':
        [55, 82, 110, 131].forEach((f) => this.tone('sawtooth', f, f * 0.95, 2.2, 0.15));
        this.hiss(1.5, 0.4, 'lowpass', 2000, 60, 0.5);
        break;
      case 'coin':
        this.tone('square', 988, 988, 0.06, 0.1);
        this.tone('square', 1319, 1319, 0.2, 0.1, this.sfx, t + 0.06);
        break;
    }
  }

  // ------------------------------------------------------------ music
  // 140 bpm dark trap: 808s, rolling hats, clap, minor bell motif.
  startMusic() {
    if (this.musicTimer !== null) return;
    this.step = 0;
    this.nextTime = this.now + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule() {
    const sixteenth = 60 / 140 / 4;
    while (this.nextTime < this.now + 0.12) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 128;
    }
  }

  private playStep(step: number, t: number, len: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 8;
    const roots = [45, 45, 41, 41, 48, 48, 43, 44]; // A A F F C C G G#  (midi)
    const root = roots[bar];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const m = this.music;
    // kick + 808
    if ([0, 7, 10].includes(s) || (bar % 2 === 1 && s === 14)) {
      this.tone('sine', 150, 45, 0.18, 0.9, m, t);
      this.tone('sine', hz(root - 12), hz(root - 12) * 0.97, 0.45, 0.55, m, t);
    }
    // clap
    if (s === 4 || s === 12) {
      this.hiss(0.16, 0.45, 'bandpass', 1500, 1100, 0.8, m, t);
      this.hiss(0.08, 0.3, 'highpass', 3000, 2500, 1, m, t + 0.01);
    }
    // hats with rolls
    const roll = bar % 4 === 3 && s >= 12;
    if (s % 2 === 0 || roll) {
      this.hiss(0.03, roll ? 0.12 : 0.16, 'highpass', 8000, 7000, 1, m, t);
      if (roll) this.hiss(0.03, 0.1, 'highpass', 8000, 7000, 1, m, t + len / 2);
    }
    // bell motif (minor pentatonic over the root)
    const motif = [0, -1, 7, -1, 12, -1, 10, 7, -1, -1, 3, -1, 7, -1, 5, -1];
    if (motif[s] >= 0 && bar % 2 === 0) this.tone('triangle', hz(root + 24 + motif[s]), hz(root + 24 + motif[s]), 0.25, 0.07, m, t);
    // pad
    if (s === 0) {
      for (const iv of [0, 3, 7]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        o.type = 'sawtooth';
        o.frequency.value = hz(root + 12 + iv);
        o.detune.value = (Math.random() - 0.5) * 14;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len * 16);
        o.connect(f).connect(g).connect(m);
        o.start(t);
        o.stop(t + len * 16 + 0.1);
      }
    }
  }
}

/** Facade used by the game: safe to call before audio is unlocked. */
export class Sfx {
  private synth: Synth | null = null;
  muted = loadMuted();
  private wantMusic = false;

  /** Call from a user gesture (browsers block audio until then). */
  unlock() {
    if (!this.synth) {
      try {
        this.synth = new Synth();
      } catch {
        return;
      }
    }
    if (this.synth.ctx.state === 'suspended') void this.synth.ctx.resume();
    this.applyMute();
    if (this.wantMusic) this.synth.startMusic();
  }

  play(name: SfxName) {
    if (!this.synth || this.muted) return;
    try {
      this.synth.play(name);
    } catch {
      /* ignore audio glitches */
    }
  }

  private clips = new Map<string, Promise<AudioBuffer | null>>();

  /** fetch and decode a recorded clip (announcer voice) ahead of time; needs unlock() first */
  loadClip(url: string) {
    const synth = this.synth;
    if (!synth || this.clips.has(url)) return;
    this.clips.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => synth.ctx.decodeAudioData(b))
        .catch(() => null),
    );
  }

  /** play a recorded clip; the music dips underneath it */
  async clip(url: string, gain = 1.1) {
    const synth = this.synth;
    if (!synth || this.muted) return;
    this.loadClip(url);
    const buf = await this.clips.get(url);
    if (!buf) return;
    const ctx = synth.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(synth.master);
    const t = ctx.currentTime;
    const m = synth.music.gain;
    m.cancelScheduledValues(t);
    m.setTargetAtTime(0.1, t, 0.04);
    m.setTargetAtTime(0.32, t + buf.duration, 0.25);
    src.start();
  }

  private track: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /**
   * Play a recorded music track on the music bus instead of the synthesized loop (the intro's
   * soundtrack). Resolves once it's playing, or false if audio is off or the file failed.
   */
  async playTrack(url: string, gain = 2.2): Promise<boolean> {
    const synth = this.synth;
    if (!synth) return false;
    this.loadClip(url);
    const buf = await this.clips.get(url);
    if (!buf) return false;
    this.stopTrack(0);
    synth.stopMusic();
    const src = synth.ctx.createBufferSource();
    src.buffer = buf;
    const g = synth.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(synth.music);
    src.start();
    this.track = { src, gain: g };
    return true;
  }

  /** fade the track out; the synthesized music comes back if it was on */
  stopTrack(fadeMs = 400) {
    const synth = this.synth;
    const tr = this.track;
    this.track = null;
    if (!synth || !tr) return;
    const t = synth.ctx.currentTime;
    tr.gain.gain.setTargetAtTime(0, t, Math.max(0.001, fadeMs / 4000));
    tr.src.stop(t + fadeMs / 1000 + 0.05);
    if (this.wantMusic) synth.startMusic();
  }

  /** everything the game plays, as a stream (for recording trailers); needs unlock() first */
  captureStream(): MediaStream | null {
    const synth = this.synth;
    if (!synth) return null;
    const dest = synth.ctx.createMediaStreamDestination();
    synth.master.connect(dest);
    return dest.stream;
  }

  music(on: boolean) {
    this.wantMusic = on;
    if (!this.synth) return;
    if (on) this.synth.startMusic();
    else this.synth.stopMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    saveMuted(this.muted);
    this.applyMute();
    return this.muted;
  }

  private applyMute() {
    if (this.synth) this.synth.master.gain.value = this.muted ? 0 : 0.8;
  }
}

export const sfx = new Sfx();
