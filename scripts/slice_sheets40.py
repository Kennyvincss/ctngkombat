"""Cut the 40-pose sprite sheets in source/sheets40/<id>.jpg into pose atlases.

The generator doesn't keep to one layout (8 to 12 figures a row, poses out of order, sometimes
labels under them), so this works in two steps:

  python3 scripts/slice_sheets40.py detect <outdir> [id ...]
      finds every figure, numbers them in reading order and writes <outdir>/<id>.png with the
      numbers drawn on the sheet (and <outdir>/<id>.json with the boxes)
  python3 scripts/slice_sheets40.py build [id ...]
      cuts the figures named in scripts/sheet_labels40.json ({"<id>": {"<pose>": n}}) into
      public/assets/sprites/<id>.webp + <id>.json and updates manifest.json

Poses not listed for a fighter are simply missing; the game borrows the closest one it has.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from slice_sheets import IDLE_PX, OUT, ROOT, body_x, pack  # noqa: E402

SHEETS = os.path.join(ROOT, 'source', 'sheets40')
LABELS = os.path.join(ROOT, 'scripts', 'sheet_labels40.json')

# every pose the 40-pose prompt asks for (docs/SPRITE_PROMPTS_BATCH5.md)
POSES = [
    'idle', 'idle2', 'walk', 'walk2', 'walkback', 'crouch', 'dash', 'block',
    'jumpup', 'jump', 'land', 'airkick', 'airpunch', 'crouchblock', 'grab', 'toss',
    'light', 'heavy', 'crouchpunch', 'uppercut', 'kick', 'sweep', 'backkick', 'knee',
    'elbow', 'overhead', 'special', 'cast', 'charge', 'throw', 'slam', 'taunt',
    'hit', 'gut', 'dizzy', 'blown', 'knockdown', 'getup', 'intro', 'win',
]


def figure_mask(rgb):
    """Everything that isn't the (near-white or light grey) background reachable from the border."""
    f = rgb.astype(np.int16)
    border = np.concatenate([f[0], f[-1], f[:, 0], f[:, -1]])
    bg = np.median(border, 0)
    diff = np.abs(f - bg).max(2)
    bgish = diff < 26
    lab, _ = ndi.label(bgish)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    m = ~np.isin(lab, edge[edge > 0])
    m = ndi.binary_opening(m, iterations=1)
    return ndi.binary_fill_holes(m)


def detect(rgb):
    """Figures on the sheet: [{'box': [x0, y0, x1, y1], 'id': label}] in reading order, plus the label image."""
    h, w = rgb.shape[:2]
    mask = figure_mask(rgb)
    lab, n = ndi.label(ndi.binary_dilation(mask, iterations=3))
    lab[~mask] = 0
    objs = ndi.find_objects(lab)
    areas = ndi.sum(lab > 0, lab, range(1, n + 1))
    boxes = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in objs]
    big_area = np.median(np.sort(areas)[-30:]) if n >= 30 else np.median(areas)
    cores = [i for i in range(n) if areas[i] >= big_area * 0.18 and boxes[i][3] - boxes[i][1] > h * 0.06]
    core_h = np.median([boxes[i][3] - boxes[i][1] for i in cores])
    out = np.zeros_like(lab)
    for i in cores:
        out[lab == i + 1] = i + 1
    for i in range(n):
        if i in cores or areas[i] < 30:
            continue
        x0, y0, x1, y1 = boxes[i]
        bh = y1 - y0
        # a word of a label: short, wide-ish, sitting under a figure's feet
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        best, bd = None, 1e9
        for k in cores:
            a0, b0, a1, b1 = boxes[k]
            pad = core_h * 0.12
            if a0 - pad <= cx <= a1 + pad and b0 - pad <= cy <= b1 + pad * 0.3:
                d = abs(cx - (a0 + a1) / 2)
                if d < bd:
                    best, bd = k, d
        if best is not None:
            out[lab == i + 1] = best + 1
        elif bh > core_h * 0.25 and areas[i] > big_area * 0.03:
            # an effect on its own (energy blast, a thrown rock): keep it as its own numbered item
            out[lab == i + 1] = i + 1
            cores.append(i)
    items = []
    for i in cores:
        yy, xx = np.nonzero(out == i + 1)
        if len(yy) == 0:
            continue
        items.append(dict(id=int(i + 1), box=[int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]))
    # reading order: rows by the figures' feet, left to right
    items.sort(key=lambda c: c['box'][3])
    rows, cur = [], []
    for c in items:
        if cur and c['box'][3] - cur[-1]['box'][3] > core_h * 0.45:
            rows.append(cur)
            cur = []
        cur.append(c)
    rows.append(cur)
    ordered = [c for r in rows for c in sorted(r, key=lambda c: c['box'][0])]
    return mask, out, ordered


def cut(rgb, lab, c):
    x0, y0, x1, y1 = c['box']
    sub = lab[y0:y1, x0:x1] == c['id']
    crop = rgb[y0:y1, x0:x1].astype(np.float32)
    inner = ndi.binary_erosion(sub, iterations=2)
    band = sub & ~inner
    lum = crop.mean(2)
    a = np.where(band, np.clip((255 - lum) / 170, 0, 1), sub.astype(np.float32))
    safe = np.maximum(a, 0.05)[..., None]
    col = np.where(band[..., None], (crop - (1 - a[..., None]) * 255) / safe, crop)
    rgba = np.dstack([np.clip(col, 0, 255).astype(np.uint8), (a * 255).astype(np.uint8)])
    return rgba, sub


def sheet_ids(only):
    ids = sorted(fn.rsplit('.', 1)[0] for fn in os.listdir(SHEETS))
    return [i for i in ids if not only or i in only]


def load(fid):
    fn = next(f for f in os.listdir(SHEETS) if f.rsplit('.', 1)[0] == fid)
    return np.array(Image.open(os.path.join(SHEETS, fn)).convert('RGB'))


def cmd_detect(outdir, only=()):
    os.makedirs(outdir, exist_ok=True)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
    except OSError:
        font = None
    for fid in sheet_ids(only):
        rgb = load(fid)
        _, _, items = detect(rgb)
        im = Image.fromarray(rgb)
        d = ImageDraw.Draw(im)
        for n, c in enumerate(items):
            x0, y0, x1, y1 = c['box']
            d.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=3)
            d.rectangle([x0, y0, x0 + 46, y0 + 34], fill=(255, 0, 0))
            d.text((x0 + 3, y0 + 1), str(n), fill=(255, 255, 255), font=font)
        im.save(os.path.join(outdir, f'{fid}.png'))
        json.dump([c['box'] for c in items], open(os.path.join(outdir, f'{fid}.json'), 'w'))
        print(fid, len(items))


def cmd_build(only=()):
    labels = json.load(open(LABELS))
    mp = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(mp)) if os.path.exists(mp) else {}
    for fid in sheet_ids(only):
        if fid not in labels:
            print('NO LABELS', fid)
            continue
        spec = labels[fid]
        rgb = load(fid)
        _, lab, items = detect(rgb)
        cuts = {p: cut(rgb, lab, items[n]) for p, n in spec.items() if p in POSES and n is not None}
        if 'idle' not in cuts:
            print('NO IDLE', fid)
            continue
        s = IDLE_PX * spec.get('_scale', 1) / cuts['idle'][1].shape[0]
        images, anchors = {}, {}
        for pose, (rgba, sub) in cuts.items():
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
        print(fid, len(images), 'poses', atlas.size, os.path.getsize(os.path.join(OUT, f'{fid}.webp')) // 1024, 'KB')
    json.dump(manifest, open(mp, 'w'), indent=1)


if __name__ == '__main__':
    if sys.argv[1] == 'detect':
        cmd_detect(sys.argv[2], sys.argv[3:])
    else:
        cmd_build(sys.argv[2:])
