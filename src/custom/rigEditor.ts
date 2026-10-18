import Phaser from 'phaser';
import { GAME_W, STEP_MS } from '../config';
import { sfx } from '../audio/Sfx';
import type { AnimKey } from '../data/normals';
import { RigView } from '../fight/RigView';
import { bodyText, goldText, type MenuInput } from '../ui/ui';
import { buildRig, guessJoints, JOINT_NAMES, madeBody, mirror, segment, type JointName, type Joints } from './autoRig';

// The MOVES screen of CREATE FIGHTER: the made fighter fighting in a loop (jab, kick, uppercut, …)
// so the player sees their limbs move. For a whole-body picture the player also drags the joints
// (head, shoulders, elbows, wrists, hips, knees, ankles) onto the picture, and the preview follows.

export interface RigEditInput {
  /** the cut-out: the whole figure ('own') or the head for a drawn body ('drawn') */
  art: HTMLCanvasElement;
  body: 'drawn' | 'own';
  joints: Joints | null;
  accent: number;
}

export interface RigEditResult {
  art: HTMLCanvasElement;
  joints: Joints | null;
  /** the picture was mirrored */
  flipped: boolean;
}

const LOOP: [AnimKey, number, string][] = [
  ['idle', 70, 'STANCE'],
  ['walk', 70, 'WALK'],
  ['light', 36, 'JAB'],
  ['heavy', 44, 'POWER PUNCH'],
  ['kick', 50, 'KICK'],
  ['uppercut', 50, 'UPPERCUT'],
  ['sweep', 50, 'SWEEP'],
  ['crouch', 50, 'CROUCH'],
  ['jump', 50, 'JUMP'],
  ['special', 60, 'SPECIAL'],
  ['block', 44, 'BLOCK'],
  ['win', 90, 'WIN POSE'],
];

const BONES: [JointName | 'pelvis', JointName | 'pelvis'][] = [
  ['head', 'neck'],
  ['neck', 'lsh'],
  ['neck', 'rsh'],
  ['lsh', 'lel'],
  ['lel', 'lwr'],
  ['rsh', 'rel'],
  ['rel', 'rwr'],
  ['neck', 'pelvis'],
  ['lhip', 'rhip'],
  ['lhip', 'lkn'],
  ['lkn', 'lank'],
  ['rhip', 'rkn'],
  ['rkn', 'rank'],
];

const DOT_COLOUR = (k: JointName) => (k[0] === 'l' ? 0xffd23f : k[0] === 'r' ? 0x4fb8ff : 0xffffff);
const PREVIEW_ID = 'rigpreview';

export function openRigEditor(scene: Phaser.Scene, input: RigEditInput, menu: MenuInput): Promise<RigEditResult | null> {
  return new Promise((resolve) => {
    const own = input.body === 'own';
    const webgl = scene.game.renderer.type === Phaser.WEBGL;
    let art = input.art;
    let joints: Joints | null = own ? (input.joints ?? guessJoints(art)) : null;
    let flipped = false;
    let view: RigView | null = null;
    let sel = 0;
    let done = false;

    const layer = scene.add.container(0, 0).setDepth(100);
    const dim = scene.add.rectangle(GAME_W / 2, 360, GAME_W + 1600, 720 + 800, 0x07040a, 0.97).setInteractive();
    layer.add(dim);
    layer.add(goldText(scene, GAME_W / 2, 40, own ? 'PLACE THE JOINTS' : 'YOUR FIGHTER IN ACTION', 46));
    layer.add(
      bodyText(
        scene,
        GAME_W / 2,
        80,
        own
          ? 'Drag each dot onto its joint. Gold: one arm and leg, blue: the other. They should face right ►'
          : 'Your picture on a fighter’s body: every limb moves. They should face right ► (FLIP if not).',
        19,
        '#d8cdb0',
      ).setOrigin(0.5),
    );

    // ---------------------------------------------------------- the picture with its joints
    const PIC = { x: 330, y: 372, w: 440, h: 540 };
    let pic: Phaser.GameObjects.Image | null = null;
    let fit = { s: 1, x0: 0, y0: 0 };
    const bones = scene.add.graphics();
    const dots: Phaser.GameObjects.Arc[] = [];
    const ring = scene.add.circle(0, 0, 15).setStrokeStyle(3, 0xffffff).setVisible(false);
    if (own) {
      layer.add(scene.add.rectangle(PIC.x, PIC.y, PIC.w + 16, PIC.h + 16, 0x1a1210).setStrokeStyle(2, 0x6b4d16));
      pic = scene.add.image(PIC.x, PIC.y, '__WHITE');
      layer.add([pic, bones]);
      for (const k of JOINT_NAMES) {
        const d = scene.add.circle(0, 0, 9, DOT_COLOUR(k)).setStrokeStyle(2, 0x000000);
        d.setInteractive(new Phaser.Geom.Circle(9, 9, 22), Phaser.Geom.Circle.Contains);
        scene.input.setDraggable(d);
        d.on('pointerdown', () => select(JOINT_NAMES.indexOf(k)));
        d.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => moveJoint(k, x, y));
        d.on('dragend', () => rebuildSoon());
        dots.push(d);
      }
      layer.add(dots);
      layer.add(ring);
    }

    const showPicture = () => {
      if (!pic) return;
      if (scene.textures.exists('rig-edit-art')) scene.textures.remove('rig-edit-art');
      scene.textures.addCanvas('rig-edit-art', art);
      const s = Math.min(PIC.w / art.width, PIC.h / art.height);
      pic.setTexture('rig-edit-art').setDisplaySize(art.width * s, art.height * s);
      fit = { s, x0: PIC.x - (art.width * s) / 2, y0: PIC.y - (art.height * s) / 2 };
      placeDots();
    };
    const placeDots = () => {
      if (!joints) return;
      JOINT_NAMES.forEach((k, i) => dots[i].setPosition(fit.x0 + joints![k][0] * fit.s, fit.y0 + joints![k][1] * fit.s));
      drawBones();
      select(sel, true);
    };
    const drawBones = () => {
      if (!joints) return;
      const at = (k: JointName | 'pelvis') => {
        const p = k === 'pelvis' ? [(joints!.lhip[0] + joints!.rhip[0]) / 2, (joints!.lhip[1] + joints!.rhip[1]) / 2] : joints![k];
        return { x: fit.x0 + p[0] * fit.s, y: fit.y0 + p[1] * fit.s };
      };
      bones.clear();
      for (const [a, b] of BONES) {
        const A = at(a);
        const B = at(b);
        const col = a[0] === 'l' || b[0] === 'l' ? 0xffd23f : a[0] === 'r' || b[0] === 'r' ? 0x4fb8ff : 0xffffff;
        bones.lineStyle(7, 0x000000, 0.6).lineBetween(A.x, A.y, B.x, B.y);
        bones.lineStyle(3, col, 0.95).lineBetween(A.x, A.y, B.x, B.y);
      }
    };
    const moveJoint = (k: JointName, x: number, y: number) => {
      if (!joints) return;
      const jx = Phaser.Math.Clamp((x - fit.x0) / fit.s, 0, art.width - 1);
      const jy = Phaser.Math.Clamp((y - fit.y0) / fit.s, 0, art.height - 1);
      joints[k] = [Math.round(jx), Math.round(jy)];
      placeDots();
    };
    function select(i: number, silent = false) {
      sel = i;
      const d = dots[i];
      ring.setVisible(!!d);
      if (d) ring.setPosition(d.x, d.y);
      buttons.forEach((b, k) => b.bg.setStrokeStyle(k === buttons.length - 1 && i === dots.length ? 5 : 3, k === buttons.length - 1 && i === dots.length ? 0xffffff : 0xf5c542));
      if (!silent) sfx.play('select');
    }

    // ---------------------------------------------------------- the live preview
    const PX = own ? 930 : GAME_W / 2;
    const FLOOR = 610;
    layer.add(scene.add.rectangle(PX, 372, 440, 556, 0x120b07).setStrokeStyle(2, 0x6b4d16));
    layer.add(scene.add.rectangle(PX, FLOOR + 2, 400, 4, 0x6b4d16));
    const moveName = goldText(scene, PX, 632, '', 28);
    layer.add(moveName);
    if (!webgl) layer.add(bodyText(scene, PX, 360, 'This device can’t show moving limbs:\nyour fighter will move as one piece here.', 22, '#ffcf5a').setOrigin(0.5).setAlign('center'));

    const rebuild = () => {
      if (!webgl || done) return;
      view?.destroy();
      view = null;
      const key = `rig-${PREVIEW_ID}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      try {
        const built = own ? buildRig(segment(art, joints!), joints!) : (() => {
          const m = madeBody(art, input.accent);
          return buildRig(m.layers, m.joints);
        })();
        scene.textures.addCanvas(key, built.atlas);
        view = new RigView(scene, PREVIEW_ID, built.rig, input.accent, 104, true);
        view.setFacing(1);
        step = 0;
        loopAt = 0;
        view.play(LOOP[0][0], { restart: true });
        moveName.setText(LOOP[0][2]);
      } catch (e) {
        console.warn('preview rig failed', e);
      }
    };
    let pending: Phaser.Time.TimerEvent | null = null;
    const rebuildSoon = () => {
      pending?.remove();
      pending = scene.time.delayedCall(120, rebuild);
    };

    // the loop of moves, at the fight's 60 steps a second
    let acc = 0;
    let step = 0;
    let loopAt = 0;
    const tick = (_t: number, dt: number) => {
      if (done) return;
      poll();
      if (!view) return;
      acc += Math.min(dt, 100);
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        step++;
        if (step >= LOOP[loopAt][1]) {
          loopAt = (loopAt + 1) % LOOP.length;
          step = 0;
          view.play(LOOP[loopAt][0], { restart: true });
          moveName.setText(LOOP[loopAt][2]);
        }
        const jump = LOOP[loopAt][0] === 'jump' ? Math.sin((step / LOOP[loopAt][1]) * Math.PI) * 110 : 0;
        view.setPosition(PX, FLOOR - jump);
        view.tick();
      }
    };
    scene.events.on('update', tick);

    // ---------------------------------------------------------- buttons
    const close = (r: RigEditResult | null) => {
      if (done) return;
      done = true;
      pending?.remove();
      scene.events.off('update', tick);
      view?.destroy();
      layer.destroy();
      for (const k of ['rig-edit-art', `rig-${PREVIEW_ID}`]) if (scene.textures.exists(k)) scene.textures.remove(k);
      resolve(r);
    };
    const finish = () => {
      sfx.play('confirm');
      close({ art, joints, flipped });
    };
    const flip = () => {
      sfx.play('select');
      const m = mirror(art, joints ?? undefined);
      art = m.art;
      if (m.joints) joints = m.joints;
      flipped = !flipped;
      showPicture();
      rebuild();
    };
    const auto = () => {
      sfx.play('select');
      joints = guessJoints(art);
      placeDots();
      rebuild();
    };
    const specs: [string, () => void][] = own
      ? [
          ['AUTO PLACE', auto],
          ['FLIP', flip],
          ['DONE', finish],
        ]
      : [
          ['FLIP', flip],
          ['DONE', finish],
        ];
    const BX = own ? 930 : GAME_W / 2;
    const buttons = specs.map(([label, fn], i) => {
      const x = BX + (i - (specs.length - 1) / 2) * 150;
      const bg = scene.add.rectangle(x, 684, 136, 46, label === 'DONE' ? 0x8a5a00 : 0x2a1a10).setStrokeStyle(3, 0xf5c542).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        sfx.unlock();
        fn();
      });
      layer.add([bg, goldText(scene, x, 684, label, 24)]);
      return { bg, fn };
    });
    const back = bodyText(scene, 30, 30, '◄ BACK', 24, '#bfb59a').setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      sfx.play('back');
      close(null);
    });
    layer.add(back);
    if (own) layer.add(bodyText(scene, PIC.x, 684, 'Arrows move the ringed dot · OK: next', 17, '#8f8672').setOrigin(0.5));

    // keyboard / pad: arrows nudge the selected joint, OK moves on (past the last joint: DONE)
    const poll = () => {
      const p = menu.poll();
      if (p.back) {
        sfx.play('back');
        return close(null);
      }
      if (!own) {
        if (p.ok) finish();
        if (p.left || p.right) flip();
        return;
      }
      if (p.ok) {
        if (sel >= dots.length) return finish();
        select(sel + 1);
      }
      const k = JOINT_NAMES[sel];
      if (k && joints && (p.left || p.right || p.up || p.down)) {
        const dx = (p.right ? 4 : 0) - (p.left ? 4 : 0);
        const dy = (p.down ? 4 : 0) - (p.up ? 4 : 0);
        moveJoint(k, fit.x0 + (joints[k][0] + dx / fit.s) * fit.s, fit.y0 + (joints[k][1] + dy / fit.s) * fit.s);
        rebuildSoon();
      }
    };

    showPicture();
    select(0, true);
    rebuild();
  });
}
