import Phaser from 'phaser';
import { FONT_DISPLAY, GAME_H, GAME_W, GOLD_HEX } from '../config';
import { sfx } from '../audio/Sfx';
import { MOVES } from '../data/moves';
import type { SpecialSpec } from '../data/moveTypes';
import { tuningFor } from '../data/tuning';
import type { MatchSetup } from '../data/types';
import { STAGES } from '../fight/stages';
import type { FightScene } from './FightScene';
import { game } from '../state';
import { bodyText, fitCamera, goldText, screenEdges } from '../ui/ui';
import { emptyRaw, type Button } from '../systems/input';

/** the theme song's beat grid (measured: 143.96 BPM, first downbeat 0.296 s into the file) */
const BAR_MS = (4 * 60000) / 143.957;
const FIRST_BAR_MS = 296;
/** how long each fighter is on screen: 2 bars of the song */
const SEGMENT_MS = 2 * BAR_MS;
/** the title card fills the song's first 2 bars, so every fighter lands on a downbeat */
const TITLE_MS = FIRST_BAR_MS + 2 * BAR_MS;
/** fighters whose pose atlases are loaded ahead of time */
const PRELOAD_AHEAD = 2;
/** the two sparring partners the fighters show their moves on (each other when it's their turn) */
const SPARRING = ['onepeterr', 'skroot'];

/** most eye-catching mechanics first: the intro shows each fighter's two best */
const SHOWINESS: SpecialSpec['mech'][] = ['super', 'drop', 'projectile', 'rush', 'teleport', 'string', 'strike', 'grab', 'status', 'random', 'trap', 'decoy', 'mobility', 'buff', 'counter'];

function bestTwo(id: string): (1 | 2 | 3)[] {
  const moves = MOVES[id] ?? [];
  return ([1, 2, 3] as const)
    .map((n) => ({ n, rank: SHOWINESS.indexOf(moves[n - 1]?.mech ?? 'counter') }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2)
    .map((x) => x.n);
}

/**
 * The entry video: a title card, then every fighter in roster order for ~3.5 s each, performing
 * their two flashiest specials while a deep announcer calls their name, then "ENTER THE
 * TRENCHES". It drives the real fight engine (FightScene in showcase mode) underneath.
 * Skippable at any time (SKIP button, Esc, Enter, Space, any gamepad button).
 */
export class IntroScene extends Phaser.Scene {
  private next = 'Mode';
  private index = -1;
  private done = false;
  private overlay: Phaser.GameObjects.Container | null = null;
  private counter!: Phaser.GameObjects.Text;
  private timers: Phaser.Time.TimerEvent[] = [];
  /** when the intro started (performance.now); the clock if the song can't play */
  private t0 = 0;
  /** the clock follows the theme song's playback position */
  private synced = false;
  private lastSong = 0;
  private wrapMs = 0;
  /** when the song's position last moved (to notice a stall) */
  private lastClock = -1;
  private lastMoved = 0;

  constructor() {
    super('Intro');
  }

  init(data: { next?: string }) {
    this.next = data.next ?? 'Mode';
    this.index = -1;
    this.done = false;
    this.overlay = null;
    this.timers = [];
    this.synced = false;
    this.lastSong = 0;
    this.wrapMs = 0;
    this.lastClock = -1;
    this.lastMoved = performance.now();
  }

  create() {
    fitCamera(this);
    const e = screenEdges(this);
    // cinematic letterbox
    this.add.rectangle(GAME_W / 2, e.top, e.right - e.left + 20, 140, 0x000000).setOrigin(0.5, 0).setDepth(5);
    this.add.rectangle(GAME_W / 2, e.bottom, e.right - e.left + 20, 90, 0x000000).setOrigin(0.5, 1).setDepth(5);

    const skip = this.add.container(e.right - 110, e.top + 50).setDepth(50).setName('skip');
    const bg = this.add.rectangle(0, 0, 170, 52, 0x000000, 0.6).setStrokeStyle(2, GOLD_HEX).setInteractive({ useHandCursor: true });
    skip.add([bg, goldText(this, 0, 0, 'SKIP ▶', 30)]);
    bg.on('pointerup', () => this.finish());
    for (const k of ['ESC', 'ENTER', 'SPACE']) this.input.keyboard?.once(`keydown-${k}`, () => this.finish());
    this.input.gamepad?.once('down', () => this.finish());
    this.counter = bodyText(this, e.left + 30, e.top + 50, '', 22, '#8c8270').setOrigin(0, 0.5).setDepth(50).setName('counter');

    // voices: decode them all up front (small files); atlases: a couple of fighters ahead
    sfx.unlock();
    for (const f of game.roster) sfx.loadClip(`assets/voice/${f.id}.mp3`);
    sfx.loadClip('assets/voice/title.mp3');
    sfx.loadClip('assets/voice/enter.mp3');
    this.preload(0);

    // the theme song sets the clock: every fighter lands on its downbeat (wait up to 3 s for it)
    let started = false;
    const begin = () => {
      if (started || this.done) return;
      started = true;
      this.t0 = performance.now();
      this.titleCard();
    };
    void sfx.playThemeFromStart().then((ok) => {
      if (!started) this.synced = ok;
      begin();
    });
    this.time.delayedCall(3000, begin);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const t of this.timers) t.remove();
      this.scene.stop('Fight');
    });
  }

  private at(ms: number, fn: () => void) {
    this.timers.push(this.time.delayedCall(ms, fn));
  }

  /** ms into the song (or since the intro began, if the song isn't playing) */
  private clock(): number {
    const now = performance.now();
    const t = this.synced ? sfx.themeTime() : null;
    if (t === null) return now - this.t0;
    // the song loops: keep counting past its end (only with a much longer roster)
    if (t * 1000 < this.lastSong - 1000) this.wrapMs += this.lastSong;
    const ms = t * 1000 + this.wrapMs;
    if (ms !== this.lastClock) {
      this.lastClock = ms;
      this.lastMoved = now;
    } else if (now - this.lastMoved > 1200) {
      // the song stalled (slow network): carry on with our own clock from here
      this.synced = false;
      this.t0 = now - ms;
      return ms;
    }
    this.lastSong = t * 1000;
    return ms;
  }

  /** run fn at a fixed point of the song (ms into it), even if loading ran late */
  private atClock(ms: number, fn: () => void) {
    this.at(Math.max(0, ms - this.clock()), fn);
  }

  /** queue pose atlases for the next fighters, and free ones already shown */
  private preload(from: number) {
    for (let i = from; i < Math.min(game.roster.length, from + PRELOAD_AHEAD + 1); i++) {
      const id = game.roster[i].id;
      if (game.sprites[id] && !this.textures.exists(`sprites-${id}`)) this.load.atlas(`sprites-${id}`, `assets/sprites/${id}.webp`, `assets/sprites/${id}.json`);
    }
    for (const dummy of SPARRING) {
      if (game.sprites[dummy] && !this.textures.exists(`sprites-${dummy}`)) this.load.atlas(`sprites-${dummy}`, `assets/sprites/${dummy}.webp`, `assets/sprites/${dummy}.json`);
    }
    if (!this.load.isLoading()) this.load.start();
    // keep the fighter on screen (from - 1) and the one before it (its scene may still be closing)
    // (both possible sparring partners always stay loaded)
    const keep = new Set([...game.roster.slice(Math.max(0, from - 2), from + PRELOAD_AHEAD + 1).map((f) => f.id), ...SPARRING]);
    for (const f of game.roster) if (!keep.has(f.id) && this.textures.exists(`sprites-${f.id}`) && game.lastSetup?.p1 !== f.id && game.lastSetup?.p2 !== f.id) this.textures.remove(`sprites-${f.id}`);
  }

  private dummyFor(id: string) {
    return id === SPARRING[0] ? SPARRING[1] : SPARRING[0];
  }

  // ---------------------------------------------------------------- cards
  private titleCard() {
    const c = this.add.container(0, 0).setDepth(20);
    const e = screenEdges(this);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, e.right - e.left + 20, e.bottom - e.top + 20, 0x050303));
    const logo = goldText(this, GAME_W / 2, GAME_H / 2 - 20, 'TRENCHES KOMBAT', 130, { strokeThickness: 14 }).setScale(3).setAlpha(0);
    logo.setShadow(0, 0, '#ff4500', 36, true, true);
    const sub = bodyText(this, GAME_W / 2, GAME_H / 2 + 80, `${game.roster.length} FIGHTERS FROM THE CRYPTO TWITTER TRENCHES`, 30, '#ff9a4a').setOrigin(0.5).setAlpha(0);
    c.add([logo, sub]);
    // the logo slams down on the song's second beat
    this.atClock(FIRST_BAR_MS + BAR_MS / 4 - 260, () => {
      this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 260, ease: 'Quad.easeIn' });
      this.at(260, () => this.cameras.main.shake(300, 0.012));
      void sfx.clip('assets/voice/title.mp3', 1.2);
    });
    this.at(1100, () => this.tweens.add({ targets: sub, alpha: 1, duration: 400 }));
    this.atClock(TITLE_MS, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() });
      this.nextFighter();
    });
  }

  private endCard() {
    this.scene.stop('Fight');
    const c = this.add.container(0, 0).setDepth(20);
    const e = screenEdges(this);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, e.right - e.left + 20, e.bottom - e.top + 20, 0x050303));
    const a = goldText(this, GAME_W / 2, GAME_H / 2 - 60, `${game.roster.length} FIGHTERS. ONE TRENCH.`, 76).setAlpha(0);
    const b = goldText(this, GAME_W / 2, GAME_H / 2 + 40, 'ENTER THE TRENCHES', 96, { strokeThickness: 12 }).setScale(2).setAlpha(0);
    b.setShadow(0, 0, '#ff4500', 30, true, true);
    c.add([a, b]);
    this.tweens.add({ targets: a, alpha: 1, duration: 400 });
    // ENTER THE TRENCHES slams on the next downbeat
    this.atClock(TITLE_MS + SEGMENT_MS * game.roster.length + BAR_MS - 240, () => {
      this.tweens.add({ targets: b, scale: 1, alpha: 1, duration: 240, ease: 'Quad.easeIn' });
      this.at(240, () => this.cameras.main.shake(300, 0.012));
      void sfx.clip('assets/voice/enter.mp3', 1.2);
    });
    this.atClock(TITLE_MS + SEGMENT_MS * game.roster.length + BAR_MS + 2600, () => this.finish());
  }

  // ---------------------------------------------------------------- fighters
  private nextFighter() {
    if (this.done) return;
    this.index++;
    if (this.index >= game.roster.length) {
      this.endCard();
      return;
    }
    const f = game.roster[this.index];
    this.preload(this.index + 1);
    const start = () => {
      if (this.done) return;
      const setup: MatchSetup = {
        mode: 'training',
        difficulty: 'normal',
        p1: f.id,
        p2: this.dummyFor(f.id),
        stage: STAGES[Math.floor(this.index / 5) % STAGES.length].id,
        showcase: true,
        seed: this.index + 1,
      };
      if (this.scene.isActive('Fight')) this.scene.stop('Fight');
      this.scene.launch('Fight', setup);
      this.scene.bringToTop('Intro');
      const fight = this.scene.get('Fight') as FightScene;
      fight.events.once(Phaser.Scenes.Events.CREATE, () => this.perform(fight, f.id));
    };
    // wait for this fighter's poses if they're still downloading
    if (game.sprites[f.id] && !this.textures.exists(`sprites-${f.id}`) && this.load.isLoading()) this.load.once(Phaser.Loader.Events.COMPLETE, start);
    else start();
  }

  private perform(fight: FightScene, id: string) {
    if (this.done) return;
    const f = game.roster.find((r) => r.id === id)!;
    const t = tuningFor(id);
    this.counter.setText(`${String(this.index + 1).padStart(2, '0')} / ${game.roster.length}`);
    this.cameras.main.flash(140, 255, 255, 255);
    this.at(120, () => void sfx.clip(`assets/voice/${id}.mp3`));

    // name card, lower left
    this.overlay?.destroy();
    const e = screenEdges(this);
    const x0 = e.left + 60;
    const c = this.add.container(0, 0).setDepth(10);
    const stripe = this.add.rectangle(x0 - 20, GAME_H - 200, 14, 120, t.accent).setOrigin(0, 0.5);
    const name = this.add
      .text(x0, GAME_H - 228, f.name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '92px', color: '#ffffff', stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0, 0.5);
    name.setShadow(0, 0, '#' + t.accent.toString(16).padStart(6, '0'), 28, true, true);
    const sub = bodyText(this, x0 + 4, GAME_H - 165, `${f.handle ?? ''}   ·   ${f.archetype.toUpperCase()}`, 24, '#d8cdb0').setOrigin(0, 0.5);
    c.add([stripe, name, sub]);
    c.setX(-700);
    this.tweens.add({ targets: c, x: 0, duration: 260, ease: 'Back.easeOut' });
    this.overlay = c;

    // the two flashiest specials
    const [first, second] = bestTwo(id);
    const press = (b: Button, frames = 4) => {
      const r = emptyRaw();
      r.buttons[b] = true;
      fight.touch.state = r;
      this.at(frames * 17, () => (fight.touch.state = { ...r, buttons: { ...r.buttons, [b]: false } }));
    };
    this.at(350, () => press(`s${first}` as Button));
    if (second) this.at(1850, () => press(`s${second}` as Button));
    this.atClock(TITLE_MS + SEGMENT_MS * (this.index + 1), () => this.nextFighter());
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    try {
      localStorage.setItem('trenches.introSeen', '1');
    } catch {
      /* fine */
    }
    for (const t of this.timers) t.remove();
    // the theme song simply carries on into the menus
    sfx.music(true);
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Fight');
      this.scene.start(this.next);
    });
  }
}
