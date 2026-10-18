import Phaser from 'phaser';
import { game } from '../state';

// Fighter art that isn't needed to reach the title screen: every select-screen thumbnail (~9 KB
// each), card (~100 KB each) and full-body cut-out (~50 KB each). Loading all of it up front made
// the loading screen grow with every fighter added, so the boot only loads a few cut-outs for the
// title, and this streams the rest in the background straight into the texture manager (not tied
// to any scene).
// A screen that needs a fighter's art right away either loads it in its own preload
// (preloadArt) or asks for it ahead of the queue (needArt).

type Kind = 'thumb' | 'card' | 'fighter';
interface Item {
  key: string;
  url: string;
}

/** downloads at once in the background (a request for art a screen is waiting on skips the line) */
const PARALLEL = 3;
/** how often to look again while a screen's own loading has the line */
const YIELD_MS = 400;

let textures: Phaser.Textures.TextureManager | null = null;
let phaser: Phaser.Game | null = null;
let waiting = false;
/** downloads that go first (the theme song the entry video is timed to) */
const priority = new Set<Promise<unknown>>();

/** a screen is downloading what it needs right now (the intro's fighters, a match's poses) */
function screenLoading() {
  return priority.size > 0 || (!!phaser && phaser.scene.getScenes(true).some((s) => s.load?.isLoading()));
}

/** hold the background downloads until this one is done (or 15 s, whichever comes first) */
export function goesFirst(p: Promise<unknown>) {
  const done = Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, 15000))]);
  priority.add(done);
  void done.then(() => {
    priority.delete(done);
    pump();
  });
}
const queue: Item[] = [];
const inflight = new Map<string, Promise<void>>();
let active = 0;

function item(id: string, kind: Kind): Item | null {
  const f = game.roster.find((r) => r.id === id);
  if (!f) return null;
  if (kind === 'thumb') return { key: `thumb-${id}`, url: `assets/thumbs/${id}.webp` };
  return kind === 'card' ? { key: `card-${id}`, url: f.card } : { key: `fighter-${id}`, url: `assets/fighters/${id}.webp` };
}

function have(key: string) {
  return !!textures && textures.exists(key);
}

function fetchItem(it: Item): Promise<void> {
  const running = inflight.get(it.key);
  if (running) return running;
  if (have(it.key)) return Promise.resolve();
  active++;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (textures && !textures.exists(it.key)) textures.addImage(it.key, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = it.url;
  }).finally(() => {
    active--;
    inflight.delete(it.key);
    pump();
  });
  inflight.set(it.key, p);
  return p;
}

function pump() {
  // background downloads wait while a screen loads its own files, so they never slow it down
  if (queue.length && screenLoading()) {
    if (!waiting) {
      waiting = true;
      setTimeout(() => {
        waiting = false;
        pump();
      }, YIELD_MS);
    }
    return;
  }
  while (active < PARALLEL && queue.length) {
    const it = queue.shift()!;
    if (!have(it.key) && !inflight.has(it.key)) void fetchItem(it);
  }
}

/** start downloading every fighter's thumbnail, then card, then cut-out, in this order of fighters */
export function startBackgroundArt(g: Phaser.Game, ids: string[]) {
  phaser = g;
  textures = g.textures;
  for (const kind of ['thumb', 'card', 'fighter'] as Kind[])
    for (const id of ids) {
      const it = item(id, kind);
      if (it && !have(it.key)) queue.push(it);
    }
  pump();
}

/** these fighters' art now, ahead of the background queue; resolves when it's in */
export function needArt(ids: string[], kinds: Kind[] = ['card']): Promise<void> {
  const wanted: Item[] = [];
  for (const id of ids) for (const k of kinds) {
    const it = item(id, k);
    if (it && !have(it.key)) wanted.push(it);
  }
  for (const it of wanted) {
    const at = queue.findIndex((q) => q.key === it.key);
    if (at >= 0) queue.splice(at, 1);
  }
  return Promise.all(wanted.map(fetchItem)).then(() => undefined);
}

/** in a scene's preload: load whatever of these fighters' art isn't in yet, so create() has it */
export function preloadArt(scene: Phaser.Scene, ids: string[], kinds: Kind[] = ['card']) {
  for (const id of new Set(ids)) for (const k of kinds) {
    const it = item(id, k);
    if (!it || scene.textures.exists(it.key)) continue;
    const at = queue.findIndex((q) => q.key === it.key);
    if (at >= 0) queue.splice(at, 1);
    // already downloading in the background: the scene still loads its own copy (the browser
    // serves it from its cache), and whichever lands second is skipped
    scene.load.image(it.key, it.url);
  }
}
