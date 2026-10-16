"""Slice the 20-pose sprite sheets in source/sheets/<id>.jpg into per-pose PNGs.

Sheet layout (see docs/POSE_PROMPTS.md): 5 columns x 4 rows, in the order of POSES below.

Output: public/assets/sprites/<id>.webp + <id>.json (one texture atlas per fighter, one
frame per pose, pivot at the feet) and manifest.json listing the poses.

Usage:
  python3 scripts/slice_sheets.py debug <outdir> [id ...]   # labelled previews for checking the split
  python3 scripts/slice_sheets.py build [id ...]            # write the atlases (all, or just these)

Per-sheet fixes live in scripts/sheet_fixes.json:
  {"<id>": {"drop": [[row, index], ...], "skip": ["dizzy", ...], "scale": 0.85}}
  drop: figures to ignore (duplicates), index is left-to-right within the row
  skip: poses that came out wrong; the game falls back to the animated cut-out
  scale: draw this fighter smaller/larger than the common idle height
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'source', 'sheets')
OUT = os.path.join(ROOT, 'public', 'assets', 'sprites')
POSES = [
    ['idle', 'walk', 'crouch', 'jump', 'block'],
    ['light', 'heavy', 'kick', 'sweep', 'uppercut'],
    ['overhead', 'special', 'cast', 'dash', 'grab'],
    ['hit', 'dizzy', 'knockdown', 'getup', 'win'],
]
# idle height in the output PNGs; the game scales by idle height so every pose shares one scale
IDLE_PX = 380


def load_fixes():
    p = os.path.join(ROOT, 'scripts', 'sheet_fixes.json')
    return json.load(open(p)) if os.path.exists(p) else {}


def figure_mask(rgb):
    """Everything that is not the near-white background reachable from the border."""
    f = rgb.astype(np.int16)
    mx, mn = f.max(2), f.min(2)
    bgish = (mn > 228) & (mx - mn < 22)
    lab, _ = ndi.label(bgish)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    fig = ~bg
    fig = ndi.binary_opening(fig, iterations=1)
    return ndi.binary_fill_holes(fig)


def row_cuts(mask):
    """Three horizontal cut lines between the four rows: the emptiest line near each quarter."""
    h = mask.shape[0]
    proj = cv2.GaussianBlur(mask.sum(1).astype(np.float32).reshape(-1, 1), (1, 9), 0).ravel()
    cuts = []
    for k in (1, 2, 3):
        lo, hi = int(h * (k / 4 - 0.1)), int(h * (k / 4 + 0.1))
        cuts.append(lo + int(np.argmin(proj[lo:hi])))
    return [0] + cuts + [h]


def figures(rgb, fixes):
    h, w = rgb.shape[:2]
    mask = figure_mask(rgb)
    full, _ = ndi.label(ndi.binary_dilation(mask, iterations=2))
    full[~mask] = 0
    ys = row_cuts(mask)
    fl = np.zeros(mask.shape, np.int32)
    nid = 0
    rows = []
    for ri in range(4):
        y0, y1 = ys[ri], ys[ri + 1]
        band = fl[y0:y1]
        lab, n = ndi.label(ndi.binary_dilation(mask[y0:y1], iterations=2))
        lab[~mask[y0:y1]] = 0
        objs = ndi.find_objects(lab)
        areas = ndi.sum(lab > 0, lab, range(1, n + 1))
        med = np.median(np.sort(areas)[-5:])
        big, frag = [], []
        for i in range(n):
            if areas[i] >= med * 0.3:
                big.append(i)
            elif areas[i] >= med * 0.004:
                # a piece of something whose body lives in another row (a swoosh tip): drop it
                parent = np.bincount(full[y0:y1][lab == i + 1]).argmax()
                inside = (full[y0:y1] == parent).sum() / max(1, (full == parent).sum())
                if inside > 0.5:
                    frag.append(i)
        ids = []
        for i in big:
            nid += 1
            band[lab == i + 1] = nid
            ids.append(nid)

        def bbox(k):
            yy, xx = np.nonzero(band == k)
            return xx.min(), yy.min(), xx.max() + 1, yy.max() + 1

        for i in frag:
            y, x = objs[i]
            fb = (x.start, y.start, x.stop, y.stop)

            def dist(k):
                b = bbox(k)
                dx = max(b[0] - fb[2], fb[0] - b[2], 0)
                dy = max(b[1] - fb[3], fb[1] - b[3], 0)
                return dx * dx + dy * dy
            k = min(ids, key=dist)
            if dist(k) ** 0.5 < 0.06 * w:
                band[lab == i + 1] = k
        # figures the sheet says to ignore (an extra pose the generator added)
        drop = {d[1] for d in fixes.get('drop', []) if d[0] == ri}
        if drop:
            order = sorted(ids, key=lambda k: bbox(k)[0])
            for j, k in enumerate(order):
                if j in drop:
                    band[band == k] = 0
                    ids.remove(k)
        # too many: a big effect (energy blast, swoosh) got counted; merge the smallest into its neighbour
        while len(ids) > 5:
            k = min(ids, key=lambda k: int((band == k).sum()))
            bk = bbox(k)

            def gap(j):
                b = bbox(j)
                dx = max(b[0] - bk[2], bk[0] - b[2], 0)
                dy = max(b[1] - bk[3], bk[1] - b[3], 0)
                return dx * dx + dy * dy
            near = min((j for j in ids if j != k), key=gap)
            band[band == k] = near
            ids.remove(k)
        # figures touching side by side: cut the widest at its thinnest column
        for _ in range(3):
            if len(ids) >= 5:
                break
            k = max(ids, key=lambda k: bbox(k)[2] - bbox(k)[0])
            x0, by0, x1, by1 = bbox(k)
            m = band[by0:by1, x0:x1] == k
            proj = m.sum(0).astype(float)
            lo, hi = int(len(proj) * 0.3), int(len(proj) * 0.7)
            c = lo + int(np.argmin(proj[lo:hi]))
            nid += 1
            sub = band[:, x0 + c:x1]
            sub[sub == k] = nid
            ids.append(nid)
        ids.sort(key=lambda k: bbox(k)[0])
        row = []
        for k in ids:
            x0, by0, x1, by1 = bbox(k)
            row.append(dict(id=k, box=[x0, by0 + y0, x1, by1 + y0]))
        rows.append(row)
    return mask, fl, rows


def cut(rgb, mask, fl, c):
    x0, y0, x1, y1 = c['box']
    sub = fl[y0:y1, x0:x1] == c['id']
    crop = rgb[y0:y1, x0:x1].astype(np.float32)
    # soft edge: in a thin band along the outline, treat whiteness as transparency and
    # un-mix the white background out of the colour (removes the light fringe on dark stages)
    inner = ndi.binary_erosion(sub, iterations=2)
    band = sub & ~inner
    lum = crop.mean(2)
    a = np.where(band, np.clip((255 - lum) / 170, 0, 1), sub.astype(np.float32))
    a = np.maximum(a, ndi.binary_erosion(sub, iterations=1) * 0.0)
    safe = np.maximum(a, 0.05)[..., None]
    col = np.where(band[..., None], (crop - (1 - a[..., None]) * 255) / safe, crop)
    rgba = np.dstack([np.clip(col, 0, 255).astype(np.uint8), (a * 255).astype(np.uint8)])
    return rgba, sub


def body_x(sub, pose):
    """Horizontal anchor: the densest vertical column (torso / standing leg)."""
    h, w = sub.shape
    if pose in ('knockdown', 'getup', 'dash'):
        return w / 2
    col = sub.sum(0).astype(np.float32)
    k = max(3, int(h * 0.12)) | 1
    col = cv2.GaussianBlur(col.reshape(1, -1), (k, 1), 0).ravel()
    return float(np.argmax(col))


def sheet_files(only):
    return [fn for fn in sorted(os.listdir(SHEETS)) if not only or fn.rsplit('.', 1)[0] in only]


def debug(outdir, only=()):
    from PIL import ImageDraw
    os.makedirs(outdir, exist_ok=True)
    fixes = load_fixes()
    for fn in sheet_files(only):
        fid = fn.rsplit('.', 1)[0]
        rgb = np.array(Image.open(os.path.join(SHEETS, fn)).convert('RGB'))
        mask, lab, rows = figures(rgb, fixes.get(fid, {}))
        im = Image.fromarray(rgb).convert('RGB')
        d = ImageDraw.Draw(im)
        counts = [len(r) for r in rows]
        for ri, r in enumerate(rows):
            for k, c in enumerate(r):
                x0, y0, x1, y1 = c['box']
                d.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=4)
                name = POSES[ri][k] if k < 5 else 'EXTRA'
                d.rectangle([x0, y0, x0 + 150, y0 + 30], fill=(0, 0, 0))
                d.text((x0 + 4, y0 + 6), f'{ri},{k} {name}', fill=(255, 255, 0))
        im.thumbnail((900, 900))
        im.save(os.path.join(outdir, f'{fid}.png'))
        print(fid, counts, 'OK' if counts == [5, 5, 5, 5] else 'CHECK')


def pack(images, width=2048, pad=2):
    """Shelf-pack images (tallest first) into one atlas; returns (atlas, {name: (x, y, w, h)})."""
    order = sorted(images, key=lambda k: -images[k].height)
    x = y = shelf = 0
    pos = {}
    for k in order:
        im = images[k]
        if x + im.width > width:
            x, y, shelf = 0, y + shelf + pad, 0
        pos[k] = (x, y, im.width, im.height)
        x += im.width + pad
        shelf = max(shelf, im.height)
    atlas = Image.new('RGBA', (width, y + shelf), (0, 0, 0, 0))
    for k, (px, py, _, _) in pos.items():
        atlas.paste(images[k], (px, py))
    return atlas, pos


def build(only=()):
    fixes = load_fixes()
    mp = os.path.join(OUT, 'manifest.json')
    # rebuilding some fighters keeps the others' entries
    manifest = json.load(open(mp)) if only and os.path.exists(mp) else {}
    os.makedirs(OUT, exist_ok=True)
    for fn in sheet_files(only):
        fid = fn.rsplit('.', 1)[0]
        fx = fixes.get(fid, {})
        rgb = np.array(Image.open(os.path.join(SHEETS, fn)).convert('RGB'))
        mask, fl, rows = figures(rgb, fx)
        if [len(r) for r in rows] != [5, 5, 5, 5]:
            print('SKIP', fid, [len(r) for r in rows])
            continue
        cuts = {}
        for ri, r in enumerate(rows):
            for k, c in enumerate(r):
                cuts[POSES[ri][k]] = cut(rgb, mask, fl, c)
        # optional per-sheet size tweak (e.g. tall hair or wings make a fighter look oversized)
        s = IDLE_PX * fx.get('scale', 1) / cuts['idle'][1].shape[0]
        images, anchors = {}, {}
        for pose, (rgba, sub) in cuts.items():
            if pose in fx.get('skip', []):
                continue
            im = Image.fromarray(rgba, 'RGBA')
            images[pose] = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
            anchors[pose] = round(body_x(sub, pose) / sub.shape[1], 3)
        atlas, pos = pack(images)
        atlas.save(os.path.join(OUT, f'{fid}.webp'), quality=88, method=6)
        frames = {
            k: {
                'frame': {'x': x, 'y': y, 'w': w, 'h': h},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h},
                'sourceSize': {'w': w, 'h': h},
                'pivot': {'x': anchors[k], 'y': 1},
            }
            for k, (x, y, w, h) in pos.items()
        }
        json.dump({'frames': frames, 'meta': {'image': f'{fid}.webp', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': 1}},
                  open(os.path.join(OUT, f'{fid}.json'), 'w'), separators=(',', ':'))
        manifest[fid] = {'idleH': IDLE_PX, 'poses': sorted(images)}
        print(fid, atlas.size, os.path.getsize(os.path.join(OUT, f'{fid}.webp')) // 1024, 'KB')
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)


if __name__ == '__main__':
    if sys.argv[1] == 'debug':
        debug(sys.argv[2], sys.argv[3:])
    else:
        build(sys.argv[2:])
