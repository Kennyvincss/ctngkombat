import Phaser from 'phaser';
import { FATALITY_WINDOW_S, GAME_H, ROUND_TIME, ROUNDS_TO_WIN, STEP_MS } from '../config';
import { MOVES } from '../data/moves';
import { PHYS } from '../data/normals';
import { tuningFor, CPU_SETTINGS } from '../data/tuning';
import type { MatchSetup } from '../data/types';
import { sfx } from '../audio/Sfx';
import { CpuBrain } from '../fight/ai';
import { Effects } from '../fight/Effects';
import { Fighter } from '../fight/Fighter';
import { GROUND_SHADOW_Y, PuppetView, SpriteView, type FighterView } from '../fight/FighterView';
import { RigView, type RigData } from '../fight/RigView';
import { runFatality } from '../fight/fatalities';
import { buildStage } from '../fight/stages';
import type { ActiveHit, Entity, HitInfo, HitResult, World } from '../fight/types';
import { Controller, GamepadSource, KeyboardSource, KEYMAP_P1, KEYMAP_P2, KEYMAP_SOLO_EXTRA, MergedSource, ScriptedSource, type InputSource } from '../systems/input';
import { fighterById, game } from '../state';
import { Lockstep } from '../net/Lockstep';
import { net } from '../net/Net';
import { rng } from '../systems/rng';

export type Phase = 'intro' | 'fight' | 'ko' | 'finish' | 'fatality' | 'over' | 'paused';

/** the fight announcer's recorded lines (scripts/make_voices.py) */
const ANNOUNCER = ['round1', 'round2', 'round3', 'round4', 'round5', 'final', 'start', 'ko', 'draw', 'finish', 'fatality'];
const voice = (key: string) => `assets/voice/${key}.mp3`;
const ROUND_WORDS: Record<number, string> = { 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE' };

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class FightScene extends Phaser.Scene implements World {
  setup!: MatchSetup;
  fx!: Effects;
  sfx = sfx;
  frame = 0;
  entities: Entity[] = [];
  fighters!: [Fighter, Fighter];
  phase: Phase = 'intro';
  round = 1;
  timer = ROUND_TIME;
  touch = new ScriptedSource();
  cpu: CpuBrain | null = null;
  readonly left = PHYS.wallMargin;
  readonly right = PHYS.stageW - PHYS.wallMargin;
  readonly groundY = PHYS.groundY;
  private acc = 0;
  private stopFrames = 0;
  private slowmo = 0;
  private usedHits = new Set<number>();
  private hitId = 1;
  private stageFx: { update: (f: number) => void } = { update: () => {} };
  private finishTimer = 0;
  private winnerSide: 0 | 1 = 0;
  private fatalityDone = false;
  private trainingRefill = 0;
  /** simulation ticks (every fixed step, including hitstop and slow motion) */
  private tick = 0;
  /** round flow events, timed in ticks so both online players run them on the same tick */
  private timers: { at: number; fn: () => void }[] = [];
  /** online play: input exchange with the other player */
  lock: Lockstep | null = null;
  /** remembers the last few seconds of combo info for the HUD */
  combo = { side: 0, hits: 0, damage: 0, shownUntil: 0 };

  constructor() {
    super('Fight');
  }

  /** World API: the Phaser scene to create objects in */
  get phaser(): Phaser.Scene {
    return this;
  }

  get training() {
    return this.setup.mode === 'training';
  }

  get online() {
    return this.setup.mode === 'online';
  }

  /** the fighter this device controls (online guests play the right-hand fighter) */
  get localSide(): 0 | 1 {
    return this.lock ? this.lock.side : 0;
  }

  /** run fn after n simulation ticks */
  private later(ticks: number, fn: () => void) {
    this.timers.push({ at: this.tick + ticks, fn });
  }

  init(setup: MatchSetup) {
    this.setup = setup;
    this.frame = 0;
    this.entities = [];
    this.phase = 'intro';
    this.round = 1;
    this.timer = ROUND_TIME;
    this.acc = 0;
    this.stopFrames = 0;
    this.slowmo = 0;
    this.usedHits.clear();
    this.fatalityDone = false;
    this.touch = new ScriptedSource();
    this.cpu = null;
    this.tick = 0;
    this.timers = [];
    this.lock = null;
    rng.seed(setup.seed ?? Math.floor(Math.random() * 2 ** 32));
  }

  /** load the pose atlases (or skeletal rigs) for the two fighters in this match */
  preload() {
    for (const id of new Set([this.setup.p1, this.setup.p2])) {
      if (game.sprites[id]) {
        if (!this.textures.exists(`sprites-${id}`)) this.load.atlas(`sprites-${id}`, `assets/sprites/${id}.webp`, `assets/sprites/${id}.json`);
        continue;
      }
      if (!game.rigs.includes(id)) continue;
      if (!this.cache.json.exists(`rig-${id}`)) this.load.json(`rig-${id}`, `assets/rigs/${id}.json`);
      if (!this.textures.exists(`rig-${id}`)) this.load.image(`rig-${id}`, `assets/rigs/${id}.webp`);
    }
  }

  create() {
    this.cameras.main.fadeIn(300);
    // only keep this match's pose atlases and rig textures in GPU memory
    // (the intro manages its own: it preloads the next fighters while one is on screen)
    for (const f of this.setup.showcase ? [] : game.roster) {
      if (f.id === this.setup.p1 || f.id === this.setup.p2) continue;
      for (const key of [`rig-${f.id}`, `sprites-${f.id}`]) if (this.textures.exists(key)) this.textures.remove(key);
    }
    this.cameras.main.setBounds(-150, -100, PHYS.stageW + 300, GAME_H + 200);
    GROUND_SHADOW_Y.value = this.groundY;
    this.stageFx = buildStage(this, this.setup.stage ?? 'temple');
    this.fx = new Effects(this, 50);

    const solo = this.setup.mode !== 'versus';
    const p1Sources: InputSource[] = [new KeyboardSource(this, KEYMAP_P1, solo ? KEYMAP_SOLO_EXTRA : undefined), new GamepadSource(this, 0), this.touch];
    // the intro scripts the featured fighter: no player input
    let p1src: InputSource = this.setup.showcase ? this.touch : new MergedSource(p1Sources);
    let p2src: InputSource;
    if (this.online) {
      // this device's keyboard / pad / touch drive our fighter; the other comes over the network
      this.lock = new Lockstep(this.setup.match ?? 0, net.localSide, p1src);
      [p1src, p2src] = this.lock.sources;
      net.onClose(this, () => this.events.emit('netlost'));
    } else if (this.setup.mode === 'versus') {
      p2src = new MergedSource([new KeyboardSource(this, KEYMAP_P2), new GamepadSource(this, 1)]);
    } else {
      this.cpu = new CpuBrain(this.setup.difficulty);
      if (this.training) this.cpu.dummy = 'stand';
      p2src = this.cpu;
    }

    const f1 = this.makeFighter(this.setup.p1, 0, p1src);
    const f2 = this.makeFighter(this.setup.p2, 1, p2src);
    f1.opp = f2;
    f2.opp = f1;
    this.fighters = [f1, f2];
    if (this.cpu) this.cpu.me = f2;

    if (!this.setup.showcase) {
      this.scene.launch('Hud', { fight: this });
      this.scene.bringToTop('Hud');
    }

    // the announcer's lines for this match
    for (const key of ANNOUNCER) sfx.loadClip(voice(key));
    for (const f of [f1, f2]) sfx.loadClip(voice(`${f.id}-wins`));

    this.startRound();
    // the theme plays lower during fights; the intro's showcase fights keep the intro soundtrack
    if (!this.setup.showcase) {
      sfx.music(true);
      sfx.musicLevel('fight');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.setup.showcase) sfx.musicLevel('menu');
      for (const f of this.fighters) f.view.destroy();
      this.scene.stop('Hud');
      for (const e of this.entities) e.destroy();
      this.entities = [];
    });
  }

  private makeFighter(id: string, side: 0 | 1, src: InputSource) {
    const data = fighterById(id);
    const tuning = tuningFor(id);
    const sprites = game.sprites[id];
    const rig = this.cache.json.get(`rig-${id}`) as RigData | undefined;
    let view: FighterView;
    if (sprites && this.textures.exists(`sprites-${id}`)) view = new SpriteView(this, `sprites-${id}`, sprites, tuning.accent, 20 + side);
    else if (rig && this.textures.exists(`rig-${id}`)) view = new RigView(this, id, rig, tuning.accent, 20 + side, tuning.artFacesRight);
    else view = new PuppetView(this, `fighter-${id}`, tuning.artFacesRight, tuning.accent, 20 + side);
    const moves = MOVES[id];
    if (!moves) throw new Error(`No moves for ${id}`);
    return new Fighter(data, tuning, moves, side, new Controller(src), view, this);
  }

  // ------------------------------------------------------------------ World API
  addEntity(e: Entity) {
    this.entities.push(e);
  }

  hitstop(frames: number) {
    this.stopFrames = Math.max(this.stopFrames, frames);
  }

  shake(intensity: number, ms: number) {
    this.cameras.main.shake(ms, intensity);
  }

  callout(f: Fighter, text: string, color = 0xffffff) {
    this.fx.popup(f.x, f.y - 360, text, color, 26, 50, 900);
  }

  nextHitId() {
    return this.hitId++;
  }

  onHitLanded(attacker: Fighter, victim: Fighter, damage: number, result: HitResult) {
    if (result !== 'hit' && result !== 'armor') return;
    const side = attacker.side;
    if (this.combo.side !== side || victim.comboHits <= 1) {
      this.combo.side = side;
      this.combo.damage = 0;
    }
    this.combo.hits = victim.comboHits;
    this.combo.damage += damage;
    this.combo.shownUntil = this.frame + 90;
    if (this.training) this.trainingRefill = this.frame + 90;
  }

  // ------------------------------------------------------------------ rounds
  private startRound() {
    const [a, b] = this.fighters;
    const mid = PHYS.stageW / 2;
    a.resetForRound(mid - 230, 1);
    b.resetForRound(mid + 230, -1);
    for (const e of this.entities) e.destroy();
    this.entities = [];
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.slowmo = 0;
    if (this.training) {
      a.meter = 300;
      a.locked = false;
      b.locked = false;
      a.setState('idle');
      b.setState('idle');
      this.phase = 'fight';
      if (this.setup.showcase) {
        a.x = mid - 120;
        b.x = mid + 50;
        // the sparring partner is a faded silhouette so the featured fighter stands out
        b.view.setTint(0x16161e);
        b.view.setAlpha(0.4);
        return;
      }
      this.events.emit('announce', 'TRAINING', 1200);
      return;
    }
    const final = this.round === 3;
    this.events.emit('announce', final ? 'FINAL ROUND' : `ROUND ${ROUND_WORDS[this.round] ?? this.round}`, 1500);
    void sfx.clip(voice(final ? 'final' : `round${this.round}`));
    // START waits for the slow round call (up to ~1.5 s) to finish
    this.later(100, () => {
      if (this.phase !== 'intro') return;
      this.events.emit('announce', 'START', 700, true);
      void sfx.clip(voice('start'));
      this.cameras.main.flash(120, 255, 200, 120);
      for (const f of this.fighters) {
        f.locked = false;
        f.setState('idle');
      }
      this.phase = 'fight';
    });
  }

  private endRound(winner: Fighter | null, reason: 'ko' | 'time') {
    this.phase = 'ko';
    for (const f of this.fighters) f.locked = true;
    if (reason === 'ko') {
      this.events.emit('announce', 'K.O.', 1400, true);
      sfx.play('ko');
      void sfx.clip(voice('ko'));
      this.cameras.main.flash(200, 255, 255, 255);
      this.slowmo = 70;
    } else {
      this.events.emit('announce', 'TIME', 1400);
      sfx.play('announce');
    }
    if (winner) winner.wins++;
    const matchOver = !!winner && winner.wins >= ROUNDS_TO_WIN;
    this.later(132, () => {
      // "KARO WINS" / "DRAW"
      if (winner) {
        this.events.emit('announce', `${winner.data.name.toUpperCase()} WINS`, 2200);
        void sfx.clip(voice(`${winner.id}-wins`));
      } else {
        this.events.emit('announce', 'DRAW', 1000);
        void sfx.clip(voice('draw'));
      }
      // the longest "<name> wins" line runs ~2.6 s: let it finish before the next call
      if (matchOver) {
        this.later(160, () => this.finishThem(winner!));
        return;
      }
      if (winner) {
        winner.setState('win');
        winner.view.play('win');
      }
      this.later(winner ? 160 : 70, () => {
        this.round++;
        this.startRound();
      });
    });
  }

  private finishThem(winner: Fighter) {
    const loser = winner.opp;
    this.winnerSide = winner.side;
    // loser gets back up, dazed
    loser.health = Math.max(loser.health, 0);
    loser.y = this.groundY;
    loser.vx = loser.vy = 0;
    loser.setState('dizzy');
    loser.view.play('dizzy', { restart: true });
    winner.setState('idle');
    winner.locked = true;
    winner.view.play('idle');
    // stars over the loser
    const stars = this.add.particles(loser.x, loser.y - 340, 'star', {
      speed: 0,
      lifespan: 900,
      scale: { start: 0.4, end: 0.2 },
      frequency: 220,
      emitCallback: (p: Phaser.GameObjects.Particles.Particle) => {
        p.velocityX = 60;
      },
    }).setDepth(60);
    this.time.delayedCall(FATALITY_WINDOW_S * 1000 + 400, () => stars.destroy());
    this.events.emit('announce', 'FINISH THEM', 1600, true);
    sfx.play('announce');
    void sfx.clip(voice('finish'));
    this.phase = 'finish';
    this.finishTimer = FATALITY_WINDOW_S * 60;
    this.events.emit('finish', true);
    // the CPU sometimes performs its fatality
    if (this.cpu && winner === this.fighters[1]) {
      const chance = { easy: 0.4, normal: 0.7, hard: 1 }[this.setup.difficulty];
      if (Math.random() < chance) this.time.delayedCall(1500 + Math.random() * 1000, () => this.tryFatality(winner));
    }
  }

  /** called when the winner enters the fatality input in time */
  tryFatality(winner: Fighter) {
    if (this.phase !== 'finish' || this.fatalityDone || winner.side !== this.winnerSide) return;
    this.fatalityDone = true;
    this.phase = 'fatality';
    this.events.emit('finish', false);
    const loser = winner.opp;
    this.cameras.main.flash(300, 0, 0, 0);
    this.events.emit('darken', true);
    // zoom in on the loser
    this.tweens.add({ targets: this.cameras.main, zoom: 1.25, duration: 500, ease: 'Sine.easeInOut' });
    const cx = (winner.x + loser.x) / 2;
    this.cameras.main.pan(cx, this.groundY - 240, 500, 'Sine.easeInOut');
    const ms = runFatality({ scene: this, fx: this.fx, sfx, winner, loser });
    this.time.delayedCall(ms, () => {
      this.events.emit('announce', 'FATALITY', 2400, true);
      sfx.play('ko');
      void sfx.clip(voice('fatality'));
      this.cameras.main.flash(250, 255, 255, 255);
      this.time.delayedCall(2600, () => this.toWin(winner, true));
    });
  }

  private toWin(winner: Fighter, fatality: boolean) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.start('Win', {
        setup: this.setup,
        winner: winner.id,
        winnerSide: winner.side,
        fatality,
        flawless: winner.health >= winner.maxHealth,
        wins: [this.fighters[0].wins, this.fighters[1].wins],
      });
    });
  }

  // ------------------------------------------------------------------ main loop
  update(_t: number, delta: number) {
    if (this.phase === 'paused') return;
    this.acc += Math.min(delta, 100);
    let steps = 0;
    let stalled = false;
    while (this.acc >= STEP_MS && steps < 4) {
      if (this.lock && !this.lock.ready(this.tick)) {
        // the other player's input for this tick hasn't arrived: wait (don't bank time)
        this.acc = Math.min(this.acc, STEP_MS * 2);
        stalled = true;
        break;
      }
      this.acc -= STEP_MS;
      steps++;
      this.runTick();
    }
    if (this.lock) {
      this.lock.waitMs = stalled ? this.lock.waitMs + delta : 0;
      if (this.lock.desync && !this.desyncShown) {
        this.desyncShown = true;
        this.events.emit('netdesync');
      }
    }
    this.updateCamera();
  }
  private desyncShown = false;

  /** one fixed simulation tick */
  private runTick() {
    const t = this.tick;
    this.lock?.apply(t);
    this.tick++;
    if (this.timers.length) {
      const due = this.timers.filter((x) => x.at <= t);
      if (due.length) {
        this.timers = this.timers.filter((x) => x.at > t);
        for (const x of due) x.fn();
      }
    }
    if (this.slowmo > 0) {
      this.slowmo--;
      if (this.slowmo % 3 !== 0) {
        this.syncViews();
        return;
      }
    }
    this.step();
    this.lock?.check(t, () => this.fingerprint());
  }

  /** a number that differs if the two online games have drifted apart */
  private fingerprint(): number {
    let h = rng.state ^ this.frame;
    const mix = (v: number) => {
      h = Math.imul(h ^ (Math.round(v * 16) | 0), 0x01000193) >>> 0;
    };
    for (const f of this.fighters) {
      mix(f.x);
      mix(f.y);
      mix(f.health);
      mix(f.meter);
      mix(f.state.length + f.state.charCodeAt(0));
    }
    mix(this.entities.length);
    return h;
  }

  private step() {
    if (this.phase === 'fatality' || this.phase === 'over') return;
    if (this.stopFrames > 0) {
      this.stopFrames--;
      return;
    }
    this.frame++;
    const [a, b] = this.fighters;

    a.update();
    b.update();

    // fatality window
    if (this.phase === 'finish') {
      const w = this.fighters[this.winnerSide];
      if (w.intent.fatality || w.intent.pressed.fat) this.tryFatality(w);
      if (--this.finishTimer <= 0 && this.phase === 'finish') {
        this.phase = 'ko';
        const loser = w.opp;
        loser.setState('ko');
        loser.view.play('knockdown', { restart: true });
        w.setState('win');
        w.view.play('win');
        this.events.emit('finish', false);
        this.time.delayedCall(1800, () => this.toWin(w, false));
      }
    }

    this.pushboxes();
    for (const e of this.entities) e.update(this);
    this.resolveHits();
    this.resolveEntities();
    a.autoFace();
    b.autoFace();
    this.clampSeparation();
    this.syncViews();
    this.cleanupEntities();
    this.stageFx.update(this.frame);

    if (this.phase === 'fight') {
      if (!this.training && this.frame % 60 === 0) {
        this.timer = Math.max(0, this.timer - 1);
        if (this.timer === 0) {
          const winner = a.health === b.health ? null : a.health > b.health ? a : b;
          if (winner) {
            winner.opp.setState('ko');
            winner.opp.view.play('knockdown', { restart: true });
          }
          this.endRound(winner, 'time');
        }
      }
      if (!a.alive || !b.alive) {
        const winner = a.alive ? a : b.alive ? b : null;
        this.endRound(winner, 'ko');
      }
      if (this.training) this.trainingUpkeep();
    }
  }

  private trainingUpkeep() {
    const [a, b] = this.fighters;
    a.meter = 300;
    if (this.frame > this.trainingRefill && b.comboHits === 0) b.health = b.maxHealth;
    if (a.health < a.maxHealth * 0.5) a.health = a.maxHealth;
  }

  private pushboxes() {
    const [a, b] = this.fighters;
    if (a.action?.pass || b.action?.pass) return;
    if (a.state === 'grabbed' || b.state === 'grabbed') return;
    if (['knockdown', 'ko'].includes(a.state) || ['knockdown', 'ko'].includes(b.state)) return;
    const dy = Math.abs(a.y - b.y);
    if (dy > 200) return; // jumping over
    const minDist = 80;
    const dx = b.x - a.x;
    if (Math.abs(dx) < minDist) {
      const push = (minDist - Math.abs(dx)) / 2;
      const dir = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
      a.x -= dir * push;
      b.x += dir * push;
      // walls
      for (const f of [a, b]) f.x = Phaser.Math.Clamp(f.x, this.left, this.right);
      if (Math.abs(b.x - a.x) < minDist) {
        if (a.x <= this.left + 1 || a.x >= this.right - 1) b.x = a.x + dir * minDist;
        else a.x = b.x - dir * minDist;
      }
    }
  }

  private clampSeparation() {
    const [a, b] = this.fighters;
    const d = b.x - a.x;
    if (Math.abs(d) > PHYS.maxSeparation) {
      const over = (Math.abs(d) - PHYS.maxSeparation) / 2;
      a.x += Math.sign(d) * over;
      b.x -= Math.sign(d) * over;
    }
  }

  private resolveHits() {
    const [a, b] = this.fighters;
    // gather both first so simultaneous hits trade instead of the first one cancelling the second
    const pending: { att: Fighter; def: Fighter; hit: ActiveHit; box: { x: number; y: number; w: number; h: number } }[] = [];
    for (const [att, def] of [[a, b], [b, a]] as const) {
      const hit = att.activeHit();
      if (!hit || this.usedHits.has(hit.id)) continue;
      const hb = def.hurtbox();
      if (!hb) continue;
      const box = att.worldBox(hit.box);
      if (overlap(box, hb)) pending.push({ att, def, hit, box });
    }
    for (const { att, def, hit, box } of pending) {
      const info: HitInfo = {
        ...hit.props,
        attacker: att,
        x: (Math.max(box.x, def.x - 40) + Math.min(box.x + box.w, def.x + 40)) / 2,
        y: box.y + box.h / 2,
        dir: att.facing,
      };
      const r = def.receiveHit(info);
      if (r !== 'whiff') {
        this.usedHits.add(hit.id);
        att.onConnect(r);
        if (r === 'hit') this.hitstop(hit.props.heavy ? 9 : 6);
        if (r === 'block') this.hitstop(4);
      }
    }
  }

  private resolveEntities() {
    for (const e of this.entities) {
      if (e.dead) continue;
      const box = e.hitbox();
      if (!box) continue;
      const target = e.owner.opp;
      // projectile vs projectile
      if (e.clashes) {
        for (const o of this.entities) {
          if (o === e || o.dead || !o.clashes || o.owner === e.owner) continue;
          const ob = o.hitbox();
          if (ob && overlap(box, ob)) {
            e.onClash?.(this);
            o.onClash?.(this);
            this.fx.spark((box.x + ob.x) / 2 + box.w / 2, box.y + box.h / 2, 0xffffff, true);
            this.sfx.play('block');
          }
        }
        if (e.dead) continue;
      }
      const id = e.hitId();
      if (this.usedHits.has(id)) continue;
      const hb = target.hurtbox();
      if (!hb || !overlap(box, hb)) continue;
      const props = e.props();
      const info: HitInfo = { ...props, attacker: e.owner, x: box.x + box.w / 2, y: box.y + box.h / 2, dir: box.x + box.w / 2 < target.x ? 1 : -1 };
      const r = target.receiveHit(info);
      if (r !== 'whiff') {
        this.usedHits.add(id);
        e.onConnect?.(r, target, this);
        if (r === 'hit') this.hitstop(4);
      }
    }
    if (this.usedHits.size > 4000) {
      const keep = [...this.usedHits].slice(-500);
      this.usedHits = new Set(keep);
    }
  }

  private cleanupEntities() {
    const alive: Entity[] = [];
    for (const e of this.entities) {
      if (e.dead) e.destroy();
      else alive.push(e);
    }
    this.entities = alive;
  }

  private syncViews() {
    for (const f of this.fighters) f.syncView();
  }

  private updateCamera() {
    if (this.phase === 'fatality') return;
    const cam = this.cameras.main;
    const [a, b] = this.fighters;
    const dist = Math.abs(a.x - b.x);
    // the canvas fills the screen, so the view can be wider (phones) or taller (tablets) than 16:9;
    // never zoom out past the stage's edges
    const vw = cam.width;
    const vh = cam.height;
    const minZoom = Math.max(vw / (PHYS.stageW + 300), vh / (GAME_H + 200));
    const show = this.setup.showcase;
    const targetZoom = show ? 1.22 : Math.max(minZoom, Phaser.Math.Clamp(1.06 - (dist - 260) / 1800, 0.94, 1.06));
    cam.zoom += (targetZoom - cam.zoom) * (show ? 0.3 : 0.08);
    // showcase: the fighter stands right of centre, clear of the name card on the left
    const cx = show ? a.x - 150 : (a.x + b.x) / 2;
    const topY = Math.min(a.y, b.y);
    const cy = this.groundY - (vh / 2 - 80) / cam.zoom - Math.max(0, this.groundY - 200 - topY) * 0.25;
    const halfW = vw / 2 / cam.zoom;
    const x = Phaser.Math.Clamp(cx, -150 + halfW, PHYS.stageW + 150 - halfW);
    const sx = x - vw / 2;
    const sy = cy - vh / 2;
    cam.scrollX += (sx - cam.scrollX) * 0.18;
    cam.scrollY += (sy - cam.scrollY) * 0.18;
  }

  // ------------------------------------------------------------------ pause / training
  pause(on: boolean) {
    if (this.online) return;
    if (on && (this.phase === 'fight' || this.phase === 'intro')) {
      this.prevPhase = this.phase;
      this.phase = 'paused';
      this.tweens.pauseAll();
      this.time.paused = true;
    } else if (!on && this.phase === 'paused') {
      this.phase = this.prevPhase;
      this.tweens.resumeAll();
      this.time.paused = false;
    }
  }
  private prevPhase: Phase = 'fight';

  cycleDummy(): string {
    if (!this.cpu) return '';
    const order = ['stand', 'block', 'crouch', 'jump', 'cpu'] as const;
    const cur = this.cpu.dummy ?? 'cpu';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    this.cpu.dummy = next === 'cpu' ? null : next;
    return next === 'cpu' ? `CPU (${this.setup.difficulty.toUpperCase()})` : next.toUpperCase();
  }

  /** exposed for HUD */
  get cpuSettings() {
    return CPU_SETTINGS[this.setup.difficulty];
  }
}
