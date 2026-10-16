import Phaser from 'phaser';
import type { AnimKey } from '../data/normals';
import { FIGHTER_HEIGHT, GROUND_SHADOW_Y, type FighterView } from './FighterView';

// ---------------------------------------------------------------------------
// Skeletal fighter renderer. Each fighter is split (scripts/make_rigs.py) into
// body / arm / leg layers, each a skinned mesh bound to a small skeleton.
// Poses below move real limbs: jabs extend the arm, kicks raise the leg,
// crouches bend the knees with the feet planted, jumps tuck the legs.
// Rig space: cut-out pixels, y down, every fighter faces +x.
// ---------------------------------------------------------------------------

export interface RigMesh {
  name: string;
  v: number[];
  uv: number[];
  i: number[];
  w: [number, number][];
}

export interface RigData {
  w: number;
  h: number;
  atlas: [number, number];
  joints: Record<string, [number, number]>;
  leadArm: 'L' | 'R';
  leadLeg: 'L' | 'R';
  meshes: RigMesh[];
}

type V2 = { x: number; y: number };
// bone order (matches scripts/make_rigs.py): pelvis, torso, head, armL_up, armL_lo, armR_up, armR_lo, legL_up, legL_lo, legR_up, legR_lo
const D = Math.PI / 180;

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const angOf = (a: V2, b: V2) => Math.atan2(b.y - a.y, b.x - a.x);
const dist = (a: V2, b: V2) => Math.hypot(b.x - a.x, b.y - a.y);
const lerpAng = (a: number, b: number, k: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};
const rot = (p: V2, c: V2, th: number): V2 => {
  const s = Math.sin(th);
  const co = Math.cos(th);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
};

/** A limb target: absolute angles (degrees, 0 = forward, 90 = down, -90 = up) or IK foot offset. */
type Limb = { up: number; lo: number } | { ik: V2 } | null;

interface Pose {
  px: number; // pelvis offset (rig px)
  py: number;
  torso: number; // degrees, + leans forward
  head: number;
  armLead: Limb;
  armRear: Limb;
  legLead: Limb;
  legRear: Limb;
}

/** Display transform; tweens (fatalities) can animate these directly. */
class RigDisplay {
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  alpha = 1;
  visible = true;
  flipX = false;
  depth = 0;
  tintValue: number | null = null;
  fill = false;
  constructor(private view: RigView, readonly displayHeight: number) {}
  get angle() {
    return (this.rotation * 180) / Math.PI;
  }
  set angle(a: number) {
    this.rotation = (a * Math.PI) / 180;
  }
  get texture() {
    return { key: this.view.cutoutKey };
  }
  setTint(c: number) {
    this.tintValue = c;
    this.fill = false;
    return this;
  }
  setTintFill(c: number) {
    this.tintValue = c;
    this.fill = true;
    return this;
  }
  clearTint() {
    this.tintValue = null;
    this.fill = false;
    return this;
  }
  setVisible(v: boolean) {
    this.visible = v;
    return this;
  }
  setAngle(a: number) {
    this.angle = a;
    return this;
  }
  setAlpha(a: number) {
    this.alpha = a;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

export class RigView implements FighterView {
  readonly display: Phaser.GameObjects.Image;
  readonly height = FIGHTER_HEIGHT;
  private disp: RigDisplay;
  private meshes: Phaser.GameObjects.Mesh[] = [];
  private rest: RigMesh[];
  private shadow: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private glowColor: number | null = null;
  private _anim: AnimKey = 'idle';
  private t = 0;
  private facing = 1;
  private x = 0;
  private y = 0;
  private flashT = 0;
  private tint: number | null = null;
  private scale: number;
  private j: Record<string, V2> = {};
  private len: Record<string, number> = {};
  private restAng: Record<string, number> = {};
  private bend: Record<string, number> = {};
  private cur: Pose;
  private lead: { arm: 'L' | 'R'; leg: 'L' | 'R'; rArm: 'L' | 'R'; rLeg: 'L' | 'R' };
  private bonesT: { c: V2; r: V2; th: number }[] = [];
  private renderHook: () => void;

  constructor(
    private scene: Phaser.Scene,
    readonly fighterId: string,
    private rig: RigData,
    private accent: number,
    private depth: number,
    private artFacesRight: boolean,
  ) {
    this.scale = FIGHTER_HEIGHT / rig.h;
    this.disp = new RigDisplay(this, FIGHTER_HEIGHT);
    this.disp.depth = depth;
    this.display = this.disp as unknown as Phaser.GameObjects.Image;
    this.rest = rig.meshes;
    for (const [k, v] of Object.entries(rig.joints)) this.j[k] = { x: v[0], y: v[1] };
    const j = this.j;
    for (const s of ['l', 'r']) {
      this.len[`${s}up`] = dist(j[`${s}sh`], j[`${s}el`]);
      this.len[`${s}lo`] = dist(j[`${s}el`], j[`${s}wr`]);
      this.len[`${s}th`] = dist(j[`${s}hip`], j[`${s}kn`]);
      this.len[`${s}sn`] = dist(j[`${s}kn`], j[`${s}ank`]);
      this.restAng[`${s}up`] = angOf(j[`${s}sh`], j[`${s}el`]);
      this.restAng[`${s}lo`] = angOf(j[`${s}el`], j[`${s}wr`]);
      this.restAng[`${s}th`] = angOf(j[`${s}hip`], j[`${s}kn`]);
      this.restAng[`${s}sn`] = angOf(j[`${s}kn`], j[`${s}ank`]);
      // which way the knee bends at rest (keep it for IK)
      const h = j[`${s}hip`];
      const a = j[`${s}ank`];
      const k = j[`${s}kn`];
      const cross = (a.x - h.x) * (k.y - h.y) - (a.y - h.y) * (k.x - h.x);
      this.bend[s] = cross >= 0 ? 1 : -1;
    }
    this.lead = {
      arm: rig.leadArm,
      leg: rig.leadLeg,
      rArm: rig.leadArm === 'L' ? 'R' : 'L',
      rLeg: rig.leadLeg === 'L' ? 'R' : 'L',
    };
    this.cur = this.restPose();

    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(depth - 2).setScale(1.3, 1.4);
    this.glow = scene.add.image(0, 0, 'dot').setDepth(depth - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const key = `rig-${fighterId}`;
    rig.meshes.forEach((m, li) => {
      const mesh = scene.add.mesh(0, 0, key);
      const verts: number[] = [];
      for (let i = 0; i < m.v.length; i += 2) verts.push(0, 0);
      mesh.addVertices(verts, m.uv, m.i);
      mesh.hideCCW = false;
      mesh.setOrtho(scene.scale.width, scene.scale.height);
      mesh.ignoreDirtyCache = true;
      mesh.setDepth(depth + li * 0.01);
      this.meshes.push(mesh);
    });
    this.shield = scene.add.image(0, 0, 'shield').setOrigin(0, 1).setDepth(depth + 1).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    // keep meshes in sync every rendered frame (fatality tweens move the display while logic is paused)
    this.renderHook = () => this.render();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.renderHook);
  }

  get cutoutKey() {
    return `fighter-${this.fighterId}`;
  }

  get anim() {
    return this._anim;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setFacing(f: number) {
    this.facing = f >= 0 ? 1 : -1;
  }

  play(anim: AnimKey, opts?: { restart?: boolean }) {
    if (anim === this._anim && !opts?.restart) return;
    this._anim = anim;
    this.t = 0;
  }

  flash(color = 0xffffff, frames = 5) {
    this.flashT = frames;
    this.disp.setTintFill(color);
  }

  setTint(color: number | null) {
    this.tint = color;
    if (this.flashT <= 0) {
      if (color === null) this.disp.clearTint();
      else this.disp.setTint(color);
    }
  }

  setGlow(color: number | null) {
    this.glowColor = color;
    this.glow.setVisible(color !== null);
    if (color !== null) this.glow.setTint(color);
  }

  setAlpha(a: number) {
    this.disp.alpha = a;
  }

  setVisible(v: boolean) {
    this.disp.visible = v;
    this.shadow.setVisible(v);
    if (!v) {
      this.shield.setVisible(false);
      this.glow.setVisible(false);
    } else if (this.glowColor !== null) this.glow.setVisible(true);
  }

  setShield(on: boolean) {
    this.shield.setVisible(on && this.disp.visible);
  }

  ghost(alpha = 0.5, tint = this.accent, lifeMs = 260) {
    const d = this.disp;
    const g = this.scene.add
      .image(d.x, d.y, this.cutoutKey)
      .setOrigin(0.5, 1)
      .setScale(FIGHTER_HEIGHT / this.scene.textures.get(this.cutoutKey).getSourceImage().height)
      .setRotation(d.rotation)
      .setFlipX(!d.flipX !== this.artFacesRight)
      .setAlpha(alpha)
      .setTintFill(tint)
      .setDepth(this.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (lifeMs > 0) this.scene.tweens.add({ targets: g, alpha: 0, duration: lifeMs, onComplete: () => g.destroy() });
    return g;
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.renderHook);
    for (const m of this.meshes) m.destroy();
    this.shadow.destroy();
    this.shield.destroy();
    this.glow.destroy();
  }

  // ------------------------------------------------------------------ poses
  private restPose(): Pose {
    return { px: 0, py: 0, torso: 0, head: 0, armLead: null, armRear: null, legLead: { ik: { x: 0, y: 0 } }, legRear: { ik: { x: 0, y: 0 } } };
  }

  private get legLen() {
    const s = this.lead.leg.toLowerCase();
    return this.len[`${s}th`] + this.len[`${s}sn`];
  }

  /** The target pose for the current animation at frame t. */
  private target(): { pose: Pose; rate: number; rootRot: number; rootDy: number } {
    const t = this.t;
    const L = this.legLen;
    const p = this.restPose();
    let rate = 0.35;
    let rootRot = 0;
    let rootDy = 0;
    // a low guard: fists at chest height, never in front of the face (arms draw over the body)
    const guard = (k = 0.35) => {
      p.armLead = mixArm(this.restArm('lead'), { up: 25, lo: -45 }, k);
      p.armRear = mixArm(this.restArm('rear'), { up: 55, lo: -30 }, k);
    };
    switch (this._anim) {
      case 'idle': {
        const b = Math.sin(t * 0.09);
        p.py = b * 4 + 3;
        p.torso = b * 1.5;
        // stay close to the card's own pose, with a slight breathing sway
        p.armLead = mixArm(this.restArm('lead'), { up: -25, lo: -95 }, 0.06 + 0.04 * b);
        p.armRear = mixArm(this.restArm('rear'), { up: -5, lo: -95 }, 0.04);
        break;
      }
      case 'walk': {
        const ph = t * 0.24;
        p.py = 2 + Math.abs(Math.sin(ph)) * 5;
        p.torso = 4;
        p.legLead = { ik: { x: Math.sin(ph) * L * 0.22, y: -Math.max(0, Math.cos(ph)) * L * 0.12 } };
        p.legRear = { ik: { x: -Math.sin(ph) * L * 0.22, y: -Math.max(0, -Math.cos(ph)) * L * 0.12 } };
        guard(0.3);
        if (p.armLead && 'up' in p.armLead) p.armLead.up += Math.sin(ph) * 10;
        if (p.armRear && 'up' in p.armRear) p.armRear.up -= Math.sin(ph) * 10;
        break;
      }
      case 'crouch':
        p.py = L * 0.3;
        p.torso = 14;
        p.legLead = { ik: { x: L * 0.08, y: 0 } };
        p.legRear = { ik: { x: -L * 0.08, y: 0 } };
        guard(0.4);
        rate = 0.45;
        break;
      case 'flip':
      case 'flipBack': {
        // tucked somersault around the hips
        const k = Math.min(1, t / 34);
        rootRot = (this._anim === 'flip' ? 1 : -1) * Math.PI * 2 * (k < 1 ? k * k * (3 - 2 * k) : 1);
        this.pivotHip = true;
        p.py = -L * 0.05;
        p.legLead = { up: -60, lo: 60 };
        p.legRear = { up: -40, lo: 80 };
        p.armLead = { up: 40, lo: -10 };
        p.armRear = { up: 60, lo: 10 };
        p.torso = 20;
        p.head = 15;
        rate = 0.5;
        break;
      }
      case 'jump':
        p.py = -L * 0.05;
        p.legLead = { up: -15, lo: 70 };
        p.legRear = { up: 45, lo: 125 };
        p.armLead = mixArm(this.restArm('lead'), { up: 10, lo: -35 }, 0.5);
        p.armRear = mixArm(this.restArm('rear'), { up: 45, lo: -15 }, 0.5);
        p.torso = 6;
        rate = 0.3;
        break;
      case 'light': {
        const k = ease(Math.min(t, 5) / 5) * (t < 9 ? 1 : Math.max(0, 1 - (t - 9) / 6));
        guard();
        p.armLead = mixArm(p.armLead, { up: -4, lo: -2 }, k);
        p.torso = 8 * k;
        p.px = 10 * k;
        p.py = 3;
        rate = 0.7;
        break;
      }
      case 'heavy': {
        // wind-up power punch with the lead arm (the rear arm crossing over would cover the face)
        guard();
        const wind = t < 7 ? ease(t / 7) : 0;
        const k = t >= 7 ? ease(Math.min(t - 7, 4) / 4) * (t < 17 ? 1 : Math.max(0, 1 - (t - 17) / 8)) : 0;
        const pulled = mixUL(this.restArm('lead'), { up: 70, lo: -95 }, wind);
        p.armLead = t < 7 ? pulled : mixUL({ up: 70, lo: -95 }, { up: -4, lo: -2 }, k);
        p.torso = -10 * wind + 22 * k;
        p.px = -8 * wind + 28 * k;
        p.py = 5;
        p.legRear = { ik: { x: -L * 0.14 * k, y: 0 } };
        rate = 0.65;
        break;
      }
      case 'kick': {
        const k = ease(Math.min(t, 6) / 6) * (t < 12 ? 1 : Math.max(0, 1 - (t - 12) / 8));
        guard(0.3);
        p.legLead = k > 0.05 ? mixUL({ up: this.deg(this.restAng[`${this.lead.leg.toLowerCase()}th`]), lo: this.deg(this.restAng[`${this.lead.leg.toLowerCase()}sn`]) }, { up: -22, lo: -12 }, k) : { ik: { x: 0, y: 0 } };
        p.torso = -22 * k;
        p.py = -L * 0.06 * k;
        p.px = -8 * k;
        rate = 0.6;
        break;
      }
      case 'sweep': {
        const k = ease(Math.min(t, 7) / 7) * (t < 14 ? 1 : Math.max(0, 1 - (t - 14) / 8));
        p.py = L * 0.32;
        p.torso = 22;
        p.legRear = { ik: { x: -L * 0.15, y: 0 } };
        p.legLead = k > 0.05 ? { up: mixA(40, 12, k), lo: mixA(100, 8, k) } : { ik: { x: L * 0.1, y: 0 } };
        p.armLead = { up: 70, lo: 80 };
        p.armRear = { up: 100, lo: 90 };
        rate = 0.6;
        break;
      }
      case 'uppercut': {
        const k = ease(Math.min(t, 6) / 6) * (t < 14 ? 1 : Math.max(0, 1 - (t - 14) / 8));
        guard();
        p.armLead = mixArm(p.armLead, { up: -70, lo: -82 }, k);
        p.py = L * 0.15 * (1 - k) - L * 0.1 * k;
        p.torso = 10 - 16 * k;
        p.px = 8 * k;
        rate = 0.6;
        break;
      }
      case 'overhead': {
        const wind = t < 8 ? ease(t / 8) : 1;
        const k = t >= 8 ? ease(Math.min(t - 8, 5) / 5) : 0;
        const lead = mixUL({ up: -125, lo: -150 }, { up: 35, lo: 55 }, k);
        const rear = mixUL({ up: -110, lo: -140 }, { up: 50, lo: 70 }, k);
        p.armLead = wind < 1 ? mixUL(this.restArm('lead'), lead, wind) : lead;
        p.armRear = wind < 1 ? mixUL(this.restArm('rear'), rear, wind) : rear;
        p.torso = -10 * (1 - k) + 24 * k;
        p.px = 12 * k;
        p.py = L * 0.08 * k;
        rate = 0.6;
        break;
      }
      case 'special': {
        const k = ease(Math.min(t, 6) / 6) * (t < 18 ? 1 : Math.max(0, 1 - (t - 18) / 10));
        p.armLead = mixArm(this.restArm('lead'), { up: -6, lo: -4 }, k);
        p.armRear = mixArm(this.restArm('rear'), { up: 4, lo: 0 }, k);
        p.torso = 14 * k;
        p.px = 18 * k;
        p.py = 6;
        p.legRear = { ik: { x: -L * 0.14 * k, y: 0 } };
        rate = 0.55;
        break;
      }
      case 'cast': {
        const wind = t < 8 ? ease(t / 8) : 0;
        const k = t >= 8 ? ease(Math.min(t - 8, 6) / 6) : 0;
        p.armLead = mixArm(mixArm(this.restArm('lead'), { up: 120, lo: 150 }, wind), { up: -12, lo: -18 }, k);
        p.armRear = mixArm(mixArm(this.restArm('rear'), { up: 140, lo: 160 }, wind), { up: -20, lo: -30 }, k);
        p.torso = -8 * wind + 10 * k;
        p.px = 12 * k;
        p.py = 5;
        rate = 0.5;
        break;
      }
      case 'dash':
        p.torso = 22;
        p.px = 10;
        p.py = L * 0.06;
        p.armLead = { up: 130, lo: 160 };
        p.armRear = { up: 150, lo: 170 };
        p.legLead = { up: -10, lo: 60 };
        p.legRear = { up: 70, lo: 120 };
        rate = 0.5;
        break;
      case 'block':
        p.armLead = { up: -42, lo: -102 };
        p.armRear = { up: -25, lo: -96 };
        p.torso = -8;
        p.px = -6;
        p.py = L * 0.05;
        rate = 0.6;
        break;
      case 'hit': {
        const k = Math.max(0, 1 - t / 16);
        p.torso = -24 * k;
        p.head = -18 * k;
        p.px = -14 * k;
        p.armLead = mixArm(this.restArm('lead'), { up: 150, lo: 165 }, k * 0.8);
        p.armRear = mixArm(this.restArm('rear'), { up: 160, lo: 175 }, k * 0.8);
        rate = 0.7;
        break;
      }
      case 'knockdown': {
        const k = ease(t / 14);
        rootRot = -1.45 * k;
        rootDy = t > 14 && t < 22 ? -10 * Math.sin(((t - 14) / 8) * Math.PI) : 0;
        p.armLead = { up: 160, lo: 175 };
        p.armRear = { up: 170, lo: 178 };
        p.legLead = { up: 20, lo: 50 };
        p.legRear = { up: 40, lo: 80 };
        p.head = -10;
        rate = 0.3;
        break;
      }
      case 'getup': {
        const k = ease(t / 16);
        rootRot = -1.45 * (1 - k);
        p.py = L * 0.15 * (1 - k);
        guard(0.3 * k);
        rate = 0.4;
        break;
      }
      case 'win':
        rootDy = -Math.abs(Math.sin(t * 0.12)) * 34;
        p.armLead = { up: -82, lo: -94 };
        p.armRear = mixArm(this.restArm('rear'), { up: 60, lo: -40 }, 0.6);
        p.torso = -6;
        p.head = -8;
        p.legLead = Math.sin(t * 0.12) > 0.3 ? { up: 20, lo: 100 } : { ik: { x: 0, y: 0 } };
        break;
      case 'dizzy': {
        const w = Math.sin(t * 0.09);
        p.torso = w * 10;
        p.head = w * 12;
        p.px = Math.sin(t * 0.045) * 8;
        p.py = L * 0.06;
        p.armLead = { up: 95 + w * 8, lo: 98 };
        p.armRear = { up: 100 - w * 8, lo: 100 };
        rate = 0.2;
        break;
      }
      case 'grab': {
        const k = ease(Math.min(t, 6) / 6);
        p.armLead = mixArm(this.restArm('lead'), { up: 0, lo: -10 }, k);
        p.armRear = mixArm(this.restArm('rear'), { up: 8, lo: -5 }, k);
        p.torso = 14 * k;
        p.px = 16 * k;
        p.py = 6;
        rate = 0.6;
        break;
      }
      case 'stance':
        p.py = L * 0.12;
        p.torso = 8;
        guard(0.5);
        if (p.armLead && 'up' in p.armLead) p.armLead.up += Math.sin(t * 0.2) * 3;
        p.legLead = { ik: { x: L * 0.06, y: 0 } };
        p.legRear = { ik: { x: -L * 0.06, y: 0 } };
        break;
    }
    return { pose: p, rate, rootRot, rootDy };
  }

  private deg(r: number) {
    return r / D;
  }

  /** the arm's rest angles as a limb target (degrees) */
  private restArm(which: 'lead' | 'rear'): { up: number; lo: number } {
    const s = (which === 'lead' ? this.lead.arm : this.lead.rArm).toLowerCase();
    return { up: this.deg(this.restAng[`${s}up`]), lo: this.deg(this.restAng[`${s}lo`]) };
  }

  // ------------------------------------------------------------------ solve + skin
  /** called once per logic frame */
  tick() {
    this.t++;
    if (this.flashT > 0 && --this.flashT === 0) {
      if (this.tint === null) this.disp.clearTint();
      else this.disp.setTint(this.tint);
    }
    this.pivotHip = false;
    const { pose, rate, rootRot, rootDy } = this.target();
    const c = this.cur;
    c.px += (pose.px - c.px) * rate;
    c.py += (pose.py - c.py) * rate;
    c.torso += (pose.torso - c.torso) * rate;
    c.head += (pose.head - c.head) * rate;
    c.armLead = blendLimb(c.armLead, pose.armLead, rate, this.restArm('lead'));
    c.armRear = blendLimb(c.armRear, pose.armRear, rate, this.restArm('rear'));
    c.legLead = blendLimb(c.legLead, pose.legLead, rate, null);
    c.legRear = blendLimb(c.legRear, pose.legRear, rate, null);
    const snap = this._anim === 'knockdown' || this._anim === 'getup' || this.pivotHip;
    this.rootRot = snap ? rootRot : lerpAng(this.rootRot, rootRot, 0.3);
    this.rootDy = rootDy;

    const d = this.disp;
    d.flipX = this.facing < 0;
    d.x = this.x;
    d.y = this.y + 18 + this.rootDy;
    d.scaleX = this.scale;
    d.scaleY = this.scale;
    d.rotation = this.rootRot * this.facing;

    this.shadow.setPosition(this.x, GROUND_SHADOW_Y.value + 6);
    const air = Math.max(0, GROUND_SHADOW_Y.value - this.y);
    this.shadow.setScale(1.3 * Math.max(0.4, 1 - air / 400), 1.4).setAlpha(Math.max(0.3, 1 - air / 500));
    if (this.shield.visible) {
      const f = this.facing;
      this.shield.setPosition(this.x + 20 * f, this.y - 20);
      this.shield.setFlipX(f < 0).setOrigin(f < 0 ? 1 : 0, 1);
      this.shield.setAlpha(0.6 + 0.3 * Math.sin(this.t * 0.6));
    }
    if (this.glowColor !== null) {
      this.glow.setPosition(this.x, this.y - 170).setScale(9 + Math.sin(this.t * 0.2), 12).setAlpha(0.25 + 0.1 * Math.sin(this.t * 0.2));
    }
  }
  private rootRot = 0;
  private rootDy = 0;
  /** rotate around the hips (somersaults) instead of the feet */
  private pivotHip = false;
  private scratch = new Float32Array(0);

  private solveBones() {
    const j = this.j;
    const c = this.cur;
    const bt: { c: V2; r: V2; th: number }[] = [];
    const pelvisR = j.pelvis;
    const pelvisC = { x: pelvisR.x + c.px, y: pelvisR.y + c.py };
    const torsoTh = c.torso * D;
    // pelvis (waist) follows the torso a little
    bt[0] = { r: pelvisR, c: pelvisC, th: torsoTh * 0.25 };
    bt[1] = { r: pelvisR, c: pelvisC, th: torsoTh };
    const torsoPt = (p: V2) => {
      const q = rot(p, pelvisR, torsoTh);
      return { x: q.x + c.px, y: q.y + c.py };
    };
    const neckC = torsoPt(j.neck);
    bt[2] = { r: j.neck, c: neckC, th: torsoTh + c.head * D };
    // arms
    const sides: ['L' | 'R', Limb][] = [
      [this.lead.arm, c.armLead],
      [this.lead.rArm, c.armRear],
    ];
    for (const [S, limb] of sides) {
      const s = S.toLowerCase();
      const shR = j[`${s}sh`];
      const elR = j[`${s}el`];
      const shC = torsoPt(shR);
      let upA = this.restAng[`${s}up`] + torsoTh;
      let loA = this.restAng[`${s}lo`] + torsoTh;
      if (limb && 'up' in limb) {
        upA = limb.up * D;
        loA = limb.lo * D;
      }
      const elC = { x: shC.x + Math.cos(upA) * this.len[`${s}up`], y: shC.y + Math.sin(upA) * this.len[`${s}up`] };
      const bi = S === 'L' ? 3 : 5;
      bt[bi] = { r: shR, c: shC, th: upA - this.restAng[`${s}up`] };
      bt[bi + 1] = { r: elR, c: elC, th: loA - this.restAng[`${s}lo`] };
    }
    // legs
    const legs: ['L' | 'R', Limb][] = [
      [this.lead.leg, c.legLead],
      [this.lead.rLeg, c.legRear],
    ];
    for (const [S, limb] of legs) {
      const s = S.toLowerCase();
      const hipR = j[`${s}hip`];
      const knR = j[`${s}kn`];
      const hipC = (() => {
        const q = rot(hipR, pelvisR, torsoTh * 0.25);
        return { x: q.x + c.px, y: q.y + c.py };
      })();
      let thA = this.restAng[`${s}th`];
      let snA = this.restAng[`${s}sn`];
      const L1 = this.len[`${s}th`];
      const L2 = this.len[`${s}sn`];
      if (limb && 'up' in limb) {
        thA = limb.up * D;
        snA = limb.lo * D;
      } else {
        // two-bone IK: keep the foot on its target
        const off = limb && 'ik' in limb ? limb.ik : { x: 0, y: 0 };
        const A = { x: j[`${s}ank`].x + off.x, y: j[`${s}ank`].y + off.y };
        const dx = A.x - hipC.x;
        const dy = A.y - hipC.y;
        const dd = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.001);
        const base = Math.atan2(dy, dx);
        const cosA = (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd);
        const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
        thA = base - a * this.bend[s];
        const kn = { x: hipC.x + Math.cos(thA) * L1, y: hipC.y + Math.sin(thA) * L1 };
        snA = Math.atan2(A.y - kn.y, A.x - kn.x);
      }
      const knC = { x: hipC.x + Math.cos(thA) * L1, y: hipC.y + Math.sin(thA) * L1 };
      const bi = S === 'L' ? 7 : 9;
      bt[bi] = { r: hipR, c: hipC, th: thA - this.restAng[`${s}th`] };
      bt[bi + 1] = { r: knR, c: knC, th: snA - this.restAng[`${s}sn`] };
    }
    this.bonesT = bt;
  }

  /** Deform the meshes from the current pose + display transform. Runs every rendered frame. */
  private render() {
    const d = this.disp;
    const vis = d.visible && d.alpha > 0.01;
    for (const m of this.meshes) m.setVisible(vis);
    if (!vis) return;
    this.solveBones();
    const bt = this.bonesT;
    const j = this.j;
    const footX = j.pelvis.x;
    const footY = this.rig.h;
    // rotation pivot (display space, relative to the feet): hips for somersaults, feet otherwise
    const pivY = this.pivotHip ? (j.pelvis.y - footY) * d.scaleY : 0;
    const sx = d.scaleX * (d.flipX ? -1 : 1);
    const sy = d.scaleY;
    const cr = Math.cos(d.rotation);
    const sr = Math.sin(d.rotation);
    const tint = d.tintValue;
    this.meshes.forEach((mesh, li) => {
      const src = this.rest[li];
      const verts = mesh.vertices;
      mesh.x = d.x;
      mesh.y = d.y;
      mesh.setDepth(d.depth + li * 0.01);
      mesh.alpha = d.alpha;
      if (tint === null) {
        if (mesh.tintFill) mesh.tintFill = false;
        mesh.clearTint();
      } else {
        mesh.tintFill = d.fill;
        mesh.setTint(tint);
      }
      // skin each source vertex once, then copy to the mesh's per-corner vertices
      const nv = src.v.length / 2;
      const out = this.scratch.length >= nv * 2 ? this.scratch : (this.scratch = new Float32Array(nv * 2));
      for (let i = 0; i < nv; i++) {
        const vx = src.v[i * 2];
        const vy = src.v[i * 2 + 1];
        let x = 0;
        let y = 0;
        for (let k = 0; k < 2; k++) {
          const [b, w] = src.w[i * 2 + k];
          if (w <= 0) continue;
          const T = bt[b];
          const co = Math.cos(T.th);
          const s = Math.sin(T.th);
          const dx = vx - T.r.x;
          const dy = vy - T.r.y;
          x += (T.c.x + dx * co - dy * s) * w;
          y += (T.c.y + dx * s + dy * co) * w;
        }
        // to display space: feet at origin, scale, flip, rotate; mesh y axis points up
        const lx = (x - footX) * sx;
        const ly = (y - footY) * sy - pivY;
        out[i * 2] = lx * cr - ly * sr;
        out[i * 2 + 1] = -(lx * sr + ly * cr + pivY);
      }
      const idx = src.i;
      for (let k = 0, n = verts.length; k < n; k++) {
        const si = idx[k];
        verts[k].x = out[si * 2];
        verts[k].y = out[si * 2 + 1];
      }
    });
  }
}

// ---------------------------------------------------------------- limb helpers
function mixA(a: number, b: number, k: number) {
  return lerpAng(a * D, b * D, k) / D;
}

function mixArm(a: Limb, b: { up: number; lo: number }, k: number): Limb {
  if (!a || !('up' in a)) return k > 0.5 ? { ...b } : a;
  return { up: mixA(a.up, b.up, k), lo: mixA(a.lo, b.lo, k) };
}

function mixUL(a: { up: number; lo: number }, b: { up: number; lo: number }, k: number): { up: number; lo: number } {
  return { up: mixA(a.up, b.up, k), lo: mixA(a.lo, b.lo, k) };
}

/** ease the current limb toward its target */
function blendLimb(cur: Limb, tgt: Limb, k: number, rest: { up: number; lo: number } | null): Limb {
  if (tgt === null) {
    if (!rest) return tgt;
    tgt = rest;
  }
  if ('ik' in tgt) {
    if (cur && 'ik' in cur) return { ik: { x: cur.ik.x + (tgt.ik.x - cur.ik.x) * k, y: cur.ik.y + (tgt.ik.y - cur.ik.y) * k } };
    return tgt;
  }
  let from: { up: number; lo: number } | null = cur && 'up' in cur ? cur : rest;
  if (!from) return tgt;
  return { up: mixA(from.up, tgt.up, k), lo: mixA(from.lo, tgt.lo, k) };
}
