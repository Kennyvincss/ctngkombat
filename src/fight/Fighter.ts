import type { FighterData, FighterTuning } from '../data/types';
import { BODY, NORMALS, PHYS, type AttackSpec, type Box, type NormalKey } from '../data/normals';
import type { BuffKind, FighterMoves, StatusKind } from '../data/moveTypes';
import { Controller, type Intent } from '../systems/input';
import type { FighterView } from './FighterView';
import type { ActiveHit, HitInfo, HitProps, HitResult, World } from './types';
import { startSpecial, type Action } from './mechanics';

export type FState =
  | 'intro'
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'land'
  | 'dash'
  | 'attack'
  | 'special'
  | 'hitstun'
  | 'blockstun'
  | 'juggle'
  | 'knockdown'
  | 'getup'
  | 'grabbed'
  | 'frozen'
  | 'dizzy'
  | 'win'
  | 'ko';

interface NormalState {
  key: NormalKey;
  spec: AttackSpec;
  f: number;
  hitId: number;
  connected: HitResult | null;
  chain: number;
}

interface Buff {
  kind: BuffKind;
  amount: number;
  frames: number;
}

export const METER_MAX = 300;
export const METER_BAR = 100;
/** frames between two specials (7 seconds) */
export const SPECIAL_COOLDOWN = 7 * 60;

const NEUTRAL = new Set<FState>(['idle', 'walk', 'crouch', 'land']);

export class Fighter {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  health: number;
  maxHealth: number;
  meter = 0;
  state: FState = 'intro';
  sf = 0;
  stun = 0;
  opp!: Fighter;
  intent!: Intent;
  atk: NormalState | null = null;
  action: Action | null = null;
  invuln: 'none' | 'full' | 'projectile' | 'strike' = 'none';
  invulnT = 0;
  /** frames until the next special is allowed */
  specialCD = 0;
  buffs: Buff[] = [];
  status: Record<StatusKind, number> = { reverse: 0, lag: 0, nospecials: 0, purge: 0, drain: 0, mark: 0, freeze: 0 };
  comboHits = 0;
  juggleHits = 0;
  noJuggle = false;
  wallBouncePending = false;
  airAttackUsed = false;
  armorHits = 0;
  wins = 0;
  grabbedBy: Fighter | null = null;
  /** hits landed in a row (Trend Rider, Blockchain Flow) */
  streak = 0;
  /** suppresses input (round intro, fatality) */
  locked = true;

  constructor(
    readonly data: FighterData,
    readonly tuning: FighterTuning,
    readonly moves: FighterMoves,
    readonly side: 0 | 1,
    readonly ctrl: Controller,
    readonly view: FighterView,
    readonly world: World,
  ) {
    this.maxHealth = tuning.health;
    this.health = tuning.health;
    this.intent = ctrl.read(1);
  }

  get id() {
    return this.data.id;
  }
  get accent() {
    return this.tuning.accent;
  }
  get grounded() {
    return this.y >= this.world.groundY - 0.01;
  }
  get crouching() {
    return this.state === 'crouch' || (this.atk !== null && this.atk.key.startsWith('crouch')) || (this.state === 'blockstun' && this.intent.down);
  }
  get airborne() {
    return !this.grounded;
  }
  get alive() {
    return this.health > 0;
  }

  // ---------------------------------------------------------------- buffs
  addBuff(kind: BuffKind, amount: number, frames: number) {
    const existing = this.buffs.find((b) => b.kind === kind);
    if (existing) {
      existing.amount = kind === 'trend' ? Math.min(existing.amount + amount, 60) : Math.max(existing.amount, amount);
      existing.frames = Math.max(existing.frames, frames);
    } else this.buffs.push({ kind, amount, frames });
    if (kind === 'armor' && amount > 0) this.armorHits = Math.max(this.armorHits, amount);
    this.refreshGlow();
  }
  buff(kind: BuffKind): number {
    let v = 0;
    for (const b of this.buffs) if (b.kind === kind) v += b.amount || 1;
    return v;
  }
  hasBuff(kind: BuffKind) {
    return this.buffs.some((b) => b.kind === kind);
  }
  clearBuffs() {
    this.buffs = [];
    this.armorHits = 0;
    this.refreshGlow();
  }
  clearStatus() {
    for (const k of Object.keys(this.status) as StatusKind[]) this.status[k] = 0;
    this.ctrl.reversed = false;
    this.ctrl.lagFrames = 0;
    this.view.setTint(null);
  }
  applyStatus(kind: StatusKind, frames: number) {
    if (kind === 'purge') {
      if (this.buffs.length) this.world.callout(this, 'DEBUGGED', 0x2bff88);
      this.clearBuffs();
      return;
    }
    if (kind === 'drain') {
      this.meter = Math.max(0, this.meter - METER_BAR);
      this.world.callout(this, '-1 BAR', 0xff5555);
      return;
    }
    if (kind === 'freeze') {
      this.setState('frozen');
      this.stun = frames;
      this.vx = 0;
      this.view.setTint(0x99ddff);
      return;
    }
    this.status[kind] = Math.max(this.status[kind], frames);
    const label: Partial<Record<StatusKind, [string, number]>> = {
      reverse: ['CONTROLS REVERSED', 0xff66ff],
      lag: ['LAGGING', 0xffaa00],
      nospecials: ['COMPILE ERROR', 0xff4444],
      mark: ['MARKED', 0xb026ff],
    };
    const l = label[kind];
    if (l) this.world.callout(this, l[0], l[1]);
  }
  private refreshGlow() {
    if (this.hasBuff('invuln')) this.view.setGlow(0xffffff);
    else if (this.hasBuff('armor')) this.view.setGlow(0xffd23f);
    else if (this.hasBuff('damage')) this.view.setGlow(0xff3b3b);
    else if (this.hasBuff('speed') || this.hasBuff('trend')) this.view.setGlow(0x3bd8ff);
    else if (this.hasBuff('meter')) this.view.setGlow(0x2bff88);
    else if (this.hasBuff('projinvuln')) this.view.setGlow(0xa0a0ff);
    else if (this.hasBuff('readinput')) this.view.setGlow(0x2bff88);
    else if (this.hasBuff('blockheal') || this.hasBuff('regen')) this.view.setGlow(0x7dff9a);
    else this.view.setGlow(null);
  }

  get speedMult() {
    return 1 + (this.buff('speed') + this.buff('trend')) / 100;
  }
  /** outgoing damage multiplier from buffs */
  get damageMult() {
    return 1 + this.buff('damage') / 100;
  }
  /** low-health power: up to +70% at 1 hp */
  get lowHpMult() {
    return 1 + 0.7 * (1 - this.health / this.maxHealth);
  }

  // ---------------------------------------------------------------- frame update
  setState(s: FState) {
    this.state = s;
    this.sf = 0;
  }

  /** Per-frame tick of timers that run even in hitstop-free frames. */
  private tickTimers() {
    if (this.invulnT > 0 && --this.invulnT === 0) this.invuln = 'none';
    if (this.specialCD > 0) this.specialCD--;
    let changed = false;
    for (const b of this.buffs) {
      b.frames--;
      if (b.kind === 'regen' && b.frames >= 0) this.heal(b.amount / 180);
    }
    const before = this.buffs.length;
    this.buffs = this.buffs.filter((b) => b.frames > 0);
    if (this.buffs.length !== before) changed = true;
    if (!this.hasBuff('armor')) this.armorHits = 0;
    if (changed) this.refreshGlow();
    for (const k of Object.keys(this.status) as StatusKind[]) if (this.status[k] > 0) this.status[k]--;
    this.ctrl.reversed = this.status.reverse > 0;
    this.ctrl.lagFrames = this.status.lag > 0 ? 9 : 0;
    if (this.status.mark > 0) this.view.setTint(this.world.frame % 20 < 10 ? 0xd28cff : null);
    else if (this.state !== 'frozen') this.view.setTint(null);
  }

  update() {
    this.tickTimers();
    const intent = (this.intent = this.ctrl.read(this.facing));
    this.sf++;
    if (this.meter < METER_MAX && this.hasBuff('meter')) this.gainMeter(0.25);

    switch (this.state) {
      case 'intro':
      case 'win':
        this.vx = 0;
        break;
      case 'idle':
      case 'walk':
      case 'crouch':
      case 'land':
        if (this.state === 'land' && this.sf < 4) break;
        if (!this.locked) this.neutral(intent);
        else this.idle();
        break;
      case 'jump':
        if (this.atk) {
          // jump attacks run on top of the jump arc
          this.atk.f++;
          const s = this.atk.spec;
          if (this.atk.f >= s.startup + s.active + s.recovery) {
            this.atk = null;
            this.view.play('jump');
          }
        } else if (!this.locked && !this.airAttackUsed) {
          const n = this.normalPressed(intent);
          if (n) this.startNormal(n);
        }
        break;
      case 'dash':
        if (this.sf >= PHYS.dashFrames) this.idle();
        break;
      case 'attack':
        this.updateNormal(intent);
        break;
      case 'special':
        if (this.action) {
          const done = this.action.update();
          if (done) {
            this.action = null;
            if (this.state === 'special') this.grounded ? this.idle() : this.setState('jump');
          }
        } else this.idle();
        break;
      case 'hitstun':
      case 'blockstun':
        if (--this.stun <= 0 && this.grounded) {
          this.endCombo();
          this.idle();
          if (!this.locked) this.neutral(intent);
        }
        break;
      case 'frozen':
        if (--this.stun <= 0) {
          this.view.setTint(null);
          this.endCombo();
          this.grounded ? this.idle() : this.setState('juggle');
        }
        break;
      case 'juggle':
        // landing handled in physics
        break;
      case 'knockdown':
        if (this.sf > (this.health <= 0 ? 9999 : 34)) {
          this.setState('getup');
          this.view.play('getup', { restart: true });
          this.invuln = 'full';
          this.invulnT = 20;
        }
        break;
      case 'getup':
        if (this.sf > 18) {
          this.endCombo();
          this.idle();
        }
        break;
      case 'grabbed':
      case 'dizzy':
      case 'ko':
        this.vx = 0;
        break;
    }
    this.physics();
  }

  idle() {
    this.setState('idle');
    this.atk = null;
    this.view.play('idle');
  }

  private neutral(intent: Intent) {
    // specials first
    if (intent.special && this.tryStartSpecial(intent.special, intent)) return;
    const n = this.normalPressed(intent);
    if (n) {
      this.startNormal(n);
      return;
    }
    if (intent.held.block && !intent.up) {
      // block button: stand (or crouch) in guard instead of walking back
      const st = intent.down ? 'crouch' : 'idle';
      if (this.state !== st) this.setState(st);
      this.vx = 0;
      this.view.play(intent.down ? 'crouch' : 'block');
      return;
    }
    if (intent.up && this.grounded) {
      this.jump(intent.fwd ? 1 : intent.back ? -1 : 0);
      return;
    }
    if (intent.dash) {
      this.dash(intent.dash);
      return;
    }
    if (intent.down) {
      if (this.state !== 'crouch') this.setState('crouch');
      this.view.play('crouch');
      this.vx = 0;
      return;
    }
    const sp = this.tuning.walk * this.speedMult;
    if (intent.fwd) {
      if (this.state !== 'walk') this.setState('walk');
      this.vx = sp * this.facing;
      this.view.play('walk');
    } else if (intent.back) {
      if (this.state !== 'walk') this.setState('walk');
      this.vx = -sp * 0.8 * this.facing;
      this.view.play(this.opponentThreatening() ? 'block' : 'walk');
    } else {
      if (this.state !== 'idle') this.setState('idle');
      this.vx = 0;
      this.view.play('idle');
    }
  }

  /** opponent is attacking nearby, so holding back shows the guard pose */
  private opponentThreatening(): boolean {
    const o = this.opp;
    const near = Math.abs(o.x - this.x) < 420;
    if (!near) return false;
    return o.state === 'attack' || o.state === 'special' || this.world.entities.some((e) => e.owner === o && !e.dead);
  }

  jump(dir: number) {
    this.setState('jump');
    this.vy = PHYS.jumpVy;
    this.vx = dir * PHYS.jumpVx * this.facing * this.speedMult;
    this.y -= 1;
    this.airAttackUsed = false;
    // forward / back jumps are somersaults, like the arcade games
    this.view.play(dir > 0 ? 'flip' : dir < 0 ? 'flipBack' : 'jump', { restart: true });
    this.world.sfx.play('jump');
  }

  dash(dir: 1 | -1) {
    this.setState('dash');
    this.vx = (dir > 0 ? PHYS.dashSpeed : -PHYS.backdashSpeed) * this.facing * this.speedMult;
    this.view.play('dash', { restart: true });
    if (dir < 0) {
      this.invuln = 'full';
      this.invulnT = 7;
    }
    this.view.ghost(0.35);
    this.world.sfx.play('whoosh');
  }

  private normalPressed(intent: Intent): NormalKey | null {
    const p = intent.pressed;
    const btn = p.hp ? 'hp' : p.hk ? 'hk' : p.lp ? 'lp' : p.lk ? 'lk' : null;
    if (!btn) return null;
    const stance = this.airborne ? 'jump' : intent.down ? 'crouch' : 'stand';
    return `${stance}.${btn}` as NormalKey;
  }

  startNormal(key: NormalKey, chain = 0) {
    const spec = NORMALS[key];
    this.atk = { key, spec, f: 0, hitId: this.world.nextHitId(), connected: null, chain };
    if (this.airborne) {
      this.airAttackUsed = true;
      // stay in jump state; attack runs on top
    } else {
      this.setState('attack');
      this.vx = 0;
    }
    this.view.play(spec.anim, { restart: true });
    this.world.sfx.play(spec.heavy ? 'swingHeavy' : 'swing');
  }

  private updateNormal(intent: Intent) {
    const a = this.atk;
    if (!a) {
      this.idle();
      return;
    }
    a.f++;
    const s = a.spec;
    if (s.lunge && a.f <= s.startup + s.active) this.vx = s.lunge * this.facing;
    else this.vx *= 0.7;

    // cancels after the attack connected (hit or block)
    if (a.connected === 'hit' || a.connected === 'block') {
      if (intent.special && this.tryStartSpecial(intent.special, intent)) return;
      if (s.light && a.chain < 2) {
        const n = this.normalPressed(intent);
        if (n && a.f > s.startup) {
          this.startNormal(n, a.chain + 1);
          return;
        }
      }
    }
    if (a.f >= s.startup + s.active + s.recovery) {
      this.atk = null;
      this.idle();
    }
  }

  /** The hitbox active this frame, from a normal or a special action. */
  activeHit(): ActiveHit | null {
    const a = this.atk;
    if (a && !a.connected && a.f > a.spec.startup && a.f <= a.spec.startup + a.spec.active) {
      const s = a.spec;
      return {
        id: a.hitId,
        box: s.box,
        props: {
          damage: s.damage * this.tuning.damage,
          hitstun: s.hitstun,
          blockstun: s.blockstun,
          pushback: s.pushback,
          type: s.type,
          special: false,
          projectile: false,
          heavy: s.heavy,
          launcher: s.launcher,
          knockdown: s.knockdown,
          wallBounce: s.wallBounce,
        },
      };
    }
    if (this.action && this.action.hit) return this.action.hit;
    return null;
  }

  onConnect(result: HitResult) {
    if (this.atk) this.atk.connected = result;
    this.action?.onConnect?.(result);
  }

  /** In the startup of an attack: getting hit now is a counter-hit. */
  get inStartup(): boolean {
    if (this.atk) return this.atk.f <= this.atk.spec.startup;
    if (this.action) return this.action.inStartup();
    return false;
  }

  tryStartSpecial(n: 1 | 2 | 3, intent: Intent): boolean {
    // specials are a spice, not the meal: one every SPECIAL_COOLDOWN frames
    if (this.specialCD > 0) {
      this.ctrl.flush();
      return false;
    }
    if (this.status.nospecials > 0) {
      this.world.callout(this, 'ERROR: SPECIALS DISABLED', 0xff4444);
      this.ctrl.flush();
      return false;
    }
    const spec = this.moves[n - 1];
    const act = startSpecial(this, spec, n, intent);
    if (!act) return false;
    this.ctrl.flush();
    if (!this.world.training) this.specialCD = SPECIAL_COOLDOWN;
    this.atk = null;
    this.action = act;
    this.setState('special');
    return true;
  }

  spendMeter(amount: number): boolean {
    if (this.world.training) return true;
    if (this.meter < amount) return false;
    this.meter -= amount;
    return true;
  }

  gainMeter(n: number) {
    this.meter = Math.min(METER_MAX, this.meter + n * (this.hasBuff('meter') ? 2 : 1));
  }

  heal(n: number) {
    this.health = Math.min(this.maxHealth, this.health + n);
  }

  // ---------------------------------------------------------------- physics
  private physics() {
    if (this.state === 'grabbed' || this.state === 'frozen' && this.grounded) return;
    const air = this.airborne || this.vy < 0;
    if (air) {
      this.vy += PHYS.gravity * (this.state === 'juggle' ? 1.05 + this.juggleHits * 0.06 : 1);
      this.y += this.vy;
    }
    this.x += this.vx;

    if (!NEUTRAL.has(this.state) && this.state !== 'dash' && this.state !== 'special' && this.grounded) {
      this.vx *= PHYS.friction;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }
    if (this.state === 'dash') this.vx *= 0.9;

    // walls
    const w = this.world;
    if (this.x < w.left) {
      this.x = w.left;
      this.hitWall(1);
    } else if (this.x > w.right) {
      this.x = w.right;
      this.hitWall(-1);
    }

    // landing
    if (this.y >= w.groundY) {
      const wasAir = this.y > w.groundY || this.vy > 0;
      this.y = w.groundY;
      if (wasAir && this.vy > 0) {
        this.vy = 0;
        this.onLand();
      } else this.vy = Math.max(0, this.vy);
    }
  }

  private hitWall(outDir: number) {
    if (this.wallBouncePending && (this.state === 'juggle' || this.state === 'hitstun')) {
      this.wallBouncePending = false;
      this.vx = outDir * 6;
      this.vy = -10;
      this.setState('juggle');
      this.noJuggle = false;
      this.world.fx.shockwave(this.x, this.y - 150, 0xffffff);
      this.world.shake(0.012, 180);
      this.world.sfx.play('wall');
      this.world.callout(this, 'WALL BOUNCE', 0xffd23f);
    } else if (this.state !== 'special') this.vx = 0;
  }

  private onLand() {
    switch (this.state) {
      case 'jump':
        this.atk = null;
        this.setState('land');
        this.view.play('crouch', { restart: true });
        this.vx = 0;
        break;
      case 'juggle':
      case 'hitstun':
        this.setState('knockdown');
        this.view.play('knockdown', { restart: true });
        this.vx *= 0.3;
        this.world.shake(0.006, 120);
        this.world.fx.dust(this.x, this.y);
        this.world.sfx.play('thud');
        break;
      case 'special':
        this.action?.onLand?.();
        break;
      case 'ko':
        this.view.play('knockdown', { restart: true });
        this.vx = 0;
        this.world.fx.dust(this.x, this.y);
        this.world.sfx.play('thud');
        break;
    }
  }

  // ---------------------------------------------------------------- boxes
  hurtbox(): { x: number; y: number; w: number; h: number } | null {
    if (this.state === 'knockdown' || this.state === 'getup' || this.state === 'ko' || this.state === 'grabbed') return null;
    if (this.state === 'juggle' && (this.noJuggle || this.juggleHits >= 5)) return null;
    let h = BODY.standH;
    if (this.crouching || (this.action && this.action.lowProfile)) h = BODY.crouchH;
    if (this.airborne) h = BODY.airH;
    const top = this.y - h - (this.airborne ? 30 : 0);
    return { x: this.x - BODY.halfW, y: top, w: BODY.halfW * 2, h };
  }

  /** Convert a facing-relative box to world space. */
  worldBox(b: Box): { x: number; y: number; w: number; h: number } {
    const x = this.facing > 0 ? this.x + b.x : this.x - b.x - b.w;
    return { x, y: this.y + b.y, w: b.w, h: b.h };
  }

  // ---------------------------------------------------------------- defense
  private canBlock(type: HitProps['type']): boolean {
    if (type === 'unblockable') return false;
    if (this.airborne) return false;
    const st = this.state;
    const free = NEUTRAL.has(st) || st === 'blockstun' || (st === 'dash' && this.vx * this.facing < 0);
    if (!free) return false;
    const autoBlock = this.hasBuff('readinput');
    const wantsBlock = this.intent.back || autoBlock;
    if (!wantsBlock) return false;
    const low = this.intent.down;
    if (autoBlock) return true;
    if (type === 'low') return low;
    if (type === 'overhead') return !low;
    return true;
  }

  receiveHit(info: HitInfo): HitResult {
    if (!this.alive && this.state !== 'juggle') return 'whiff';
    // invulnerability
    if (this.invuln === 'full' || this.hasBuff('invuln')) return 'whiff';
    if ((this.invuln === 'projectile' || this.hasBuff('projinvuln')) && info.projectile) return 'whiff';
    if (this.invuln === 'strike' && !info.projectile) return 'whiff';

    // counter stances
    if (this.action?.onAttacked && this.action.onAttacked(info)) return 'countered';

    const attacker = info.attacker;
    const w = this.world;

    // block
    if (this.canBlock(info.type)) {
      const chip = info.special ? info.damage * (info.chip ?? 0.12) : 0;
      if (chip > 0 && !w.training) this.health = Math.max(1, this.health - chip);
      this.stun = info.blockstun;
      if (this.state !== 'blockstun') this.setState('blockstun');
      this.view.play(this.intent.down ? 'crouch' : 'block', { restart: true });
      this.view.setShield(true);
      w.phaser.time.delayedCall(140, () => this.view.setShield(false));
      this.pushback(info.dir, info.pushback * 0.9, attacker, info.projectile);
      this.gainMeter(info.damage * 0.05);
      attacker.gainMeter(info.damage * 0.04);
      const bh = this.buff('blockheal');
      if (bh) {
        this.heal(bh);
        w.fx.popup(this.x, this.y - 320, `+${Math.round(bh)}`, 0x7dff9a, 22);
      }
      w.fx.blockSpark(info.x, info.y);
      w.sfx.play('block');
      w.onHitLanded(attacker, this, chip, 'block');
      return 'block';
    }

    // damage
    let dmg = info.damage;
    if (!info.fixed) dmg *= attacker.damageMult;
    if (this.status.mark > 0) dmg *= 1.3;
    const counterHit = this.inStartup && (this.state === 'attack' || this.state === 'special');
    if (counterHit) dmg *= 1.15;
    if (!info.noScale) dmg *= Math.max(0.35, 1 - 0.1 * this.comboHits);

    // armor
    const armored = (this.armorHits > 0 || (this.hasBuff('armor') && this.buffs.find((b) => b.kind === 'armor')!.amount === 0)) || (this.action?.armored ?? false);
    if (armored && !info.ignoreArmor) {
      dmg *= 0.5;
      if (!w.training) this.health = Math.max(0, this.health - dmg);
      if (this.armorHits > 0) this.armorHits--;
      this.view.flash(0xffd23f, 4);
      w.fx.spark(info.x, info.y, 0xffd23f, info.heavy);
      w.sfx.play('armor');
      w.callout(this, 'ARMOR', 0xffd23f);
      attacker.gainMeter(dmg * 0.12);
      w.onHitLanded(attacker, this, dmg, 'armor');
      if (this.health <= 0) this.koFromHit(info);
      return 'armor';
    }

    if (!w.training) this.health = Math.max(0, this.health - dmg);
    else this.health = Math.max(1, this.health - dmg);
    this.comboHits++;
    this.streak = 0;
    attacker.streak++;
    if (attacker.hasBuff('trend')) attacker.addBuff('trend', 6, 240);
    if (info.steal) attacker.heal(dmg * info.steal);
    attacker.gainMeter(dmg * 0.14);
    this.gainMeter(dmg * 0.09);

    // interrupt whatever we were doing
    if (this.action) {
      this.action.onInterrupt?.();
      this.action = null;
    }
    this.atk = null;
    this.view.flash(0xffffff, 4);
    w.fx.spark(info.x, info.y, info.color ?? attacker.accent, info.heavy);
    w.sfx.play(info.heavy || dmg > 90 ? 'hitHeavy' : 'hit');
    if (info.heavy || dmg > 90) w.shake(0.008 + Math.min(dmg, 200) / 20000, 140);
    if (counterHit) w.callout(this, 'COUNTER', 0xff4040);

    if (this.health <= 0) {
      this.koFromHit(info);
      w.onHitLanded(attacker, this, dmg, 'hit');
      return 'hit';
    }

    if (info.freeze) {
      this.applyStatus('freeze', info.freeze);
      w.onHitLanded(attacker, this, dmg, 'hit');
      return 'hit';
    }

    const wasAir = this.airborne || this.state === 'juggle';
    if (info.pull && wasAir) {
      this.vy = 22;
      this.vx = 0;
      this.setState('juggle');
      this.noJuggle = true;
      this.view.play('hit', { restart: true });
    } else if (info.launcher) {
      this.setState('juggle');
      this.vy = wasAir ? -11 : -16;
      this.vx = info.dir * 2.5;
      this.juggleHits++;
      this.noJuggle = false;
      this.view.play('hit', { restart: true });
    } else if (info.wallBounce) {
      this.setState('juggle');
      this.vy = -9;
      this.vx = info.dir * 15;
      this.wallBouncePending = true;
      this.juggleHits++;
      this.noJuggle = false;
      this.view.play('hit', { restart: true });
    } else if (info.knockdown) {
      this.setState('juggle');
      this.vy = -8;
      this.vx = info.dir * 5;
      this.noJuggle = true;
      this.view.play('knockdown', { restart: true });
    } else if (wasAir) {
      this.setState('juggle');
      this.vy = Math.min(this.vy, -6);
      this.vx = info.dir * 3;
      this.juggleHits++;
      this.view.play('hit', { restart: true });
    } else {
      this.setState('hitstun');
      this.stun = info.hitstun + (counterHit ? info.counterStun ?? 6 : 0);
      this.view.play('hit', { restart: true });
      this.pushback(info.dir, info.pushback, attacker, info.projectile);
    }
    w.onHitLanded(attacker, this, dmg, 'hit');
    return 'hit';
  }

  private koFromHit(info: HitInfo) {
    this.atk = null;
    this.action = null;
    this.setState('ko');
    this.vy = -10;
    this.vx = info.dir * 6;
    this.y -= 1;
    this.view.play('hit', { restart: true });
  }

  /** Push the victim; if they're cornered, push the attacker back instead. */
  private pushback(dir: number, amount: number, attacker: Fighter, projectile: boolean) {
    this.vx = dir * amount;
    const cornered = (dir < 0 && this.x <= this.world.left + 4) || (dir > 0 && this.x >= this.world.right - 4);
    if (cornered && !projectile && attacker.grounded) attacker.vx = -dir * amount;
  }

  endCombo() {
    this.comboHits = 0;
    this.juggleHits = 0;
    this.noJuggle = false;
    this.wallBouncePending = false;
  }

  /** Put this fighter into a grabbed state (command grabs). */
  grabbed(by: Fighter) {
    this.atk = null;
    if (this.action) {
      this.action.onInterrupt?.();
      this.action = null;
    }
    this.grabbedBy = by;
    this.setState('grabbed');
    this.vx = 0;
    this.vy = 0;
    this.view.play('hit', { restart: true });
  }

  /** Can this fighter be command-grabbed right now? */
  grabbable(): boolean {
    if (this.airborne || this.invuln === 'full' || this.hasBuff('invuln')) return false;
    return !['knockdown', 'getup', 'ko', 'grabbed', 'juggle', 'win', 'dizzy'].includes(this.state);
  }

  /** Face the opponent (only when free to turn). */
  autoFace() {
    if (!this.grounded) return;
    if (!NEUTRAL.has(this.state) && this.state !== 'blockstun') return;
    const want = this.opp.x >= this.x ? 1 : -1;
    if (want !== this.facing && Math.abs(this.opp.x - this.x) > 4) this.facing = want;
  }

  syncView() {
    this.view.setFacing(this.facing);
    this.view.setPosition(this.x, this.y);
    this.view.tick();
  }

  resetForRound(x: number, facing: 1 | -1) {
    this.x = x;
    this.y = this.world.groundY;
    this.vx = this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth;
    this.atk = null;
    this.action = null;
    this.invuln = 'none';
    this.invulnT = 0;
    this.specialCD = 0;
    this.clearBuffs();
    this.clearStatus();
    this.endCombo();
    this.grabbedBy = null;
    this.locked = true;
    this.view.setVisible(true);
    this.view.setAlpha(1);
    this.setState('intro');
    this.view.play('idle', { restart: true });
  }
}
