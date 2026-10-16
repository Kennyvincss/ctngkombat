#!/usr/bin/env python3
"""Build skeletal rigs from the fighter cut-outs.

For each fighter with joints in scripts/joints.json this writes
  public/assets/rigs/<id>.webp  texture atlas: body, both arms and both legs as separate layers
  public/assets/rigs/<id>.json  joints + one skinned mesh per layer (vertices, uvs, triangles, bone weights)

Layers: the arms and legs are cut out along capsules around their bones. The body layer has the
front limbs removed and the torso behind them inpainted, so a punch reveals torso instead of a hole.
Draw order (back to front): rear leg, lead leg, body, rear arm, lead arm.

Everything is stored in "rig space": cut-out pixels, mirrored if needed so every fighter faces right.

Usage:  python3 scripts/make_rigs.py [id ...]
Needs:  pip install pillow numpy scipy opencv-python-headless
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CUTOUTS = ROOT / "public" / "assets" / "fighters"
OUT = ROOT / "public" / "assets" / "rigs"
JOINTS = Path(__file__).with_name("joints.json")

CELL = 14  # mesh grid size in pixels

# bone indices (shared with src/fight/rig.ts)
BONES = ["pelvis", "torso", "head", "armL_up", "armL_lo", "armR_up", "armR_lo", "legL_up", "legL_lo", "legR_up", "legR_lo"]
B = {n: i for i, n in enumerate(BONES)}


def seg_dist(p, a, b):
    """distance from points p (N,2) to segment a-b, and the projection t in [0,1]"""
    ab = b - a
    L2 = max(1e-6, float(ab @ ab))
    t = np.clip(((p - a) @ ab) / L2, 0, 1)
    proj = a + t[:, None] * ab
    return np.linalg.norm(p - proj, axis=1), t


def capsule_mask(shape, pts, radii):
    """union of capsules along a polyline"""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    P = np.stack([xx.ravel(), yy.ravel()], 1).astype(float)
    m = np.zeros(h * w, bool)
    for (a, b), r in zip(zip(pts[:-1], pts[1:]), radii):
        d, _ = seg_dist(P, np.array(a, float), np.array(b, float))
        m |= d <= r
    return m.reshape(h, w)


def limb_width(alpha, a, b):
    """estimate a limb's half-width by scanning across the middle of the bone"""
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    L = np.linalg.norm(d)
    if L < 1:
        return 20.0
    n = np.array([-d[1], d[0]]) / L
    widths = []
    for t in (0.35, 0.5, 0.65):
        c = a + d * t
        span = 0
        for side in (1, -1):
            k = 0
            while k < 120:
                x, y = (c + n * side * (k + 1)).astype(int)
                if not (0 <= x < alpha.shape[1] and 0 <= y < alpha.shape[0]) or alpha[y, x] < 60:
                    break
                k += 1
            span += k
        widths.append(span / 2)
    return float(np.median(widths))


def build(fid, J, facing_right):
    im = Image.open(CUTOUTS / f"{fid}.png").convert("RGBA")
    a = np.asarray(im).copy()
    if not facing_right:  # mirror so the rig faces right
        a = a[:, ::-1].copy()
        J = {k: [im.width - 1 - v[0], v[1]] for k, v in J.items()}
    h, w = a.shape[:2]
    alpha = a[..., 3]
    j = {k: np.array(v, float) for k, v in J.items()}

    hip_mid = (j["lhip"] + j["rhip"]) / 2
    sh_mid = (j["lsh"] + j["rsh"]) / 2
    torso_len = np.linalg.norm(sh_mid - hip_mid)
    neck = j.get("neck", sh_mid + (sh_mid - hip_mid) * 0.12)
    head = j.get("head", sh_mid + (sh_mid - hip_mid) * 0.75)
    pelvis = hip_mid
    joints = {"pelvis": pelvis, "neck": neck, "head": head}
    for s in "lr":
        for k in ("sh", "el", "wr", "hip", "kn", "ank"):
            joints[f"{s}{k}"] = j[f"{s}{k}"]

    # extend wrists into fists and ankles to the bottom of the image
    def ext(p0, p1, f):
        return p1 + (p1 - p0) * f

    layers = {}
    claimed = np.zeros((h, w), bool)
    limb_masks = {}
    for side in "lr":
        sh, el, wr = joints[f"{side}sh"], joints[f"{side}el"], joints[f"{side}wr"]
        fist = ext(el, wr, 0.45)
        r_up = np.clip(limb_width(alpha, sh, el), torso_len * 0.13, torso_len * 0.32)
        r_lo = np.clip(limb_width(alpha, el, wr), torso_len * 0.11, torso_len * 0.3)
        m = capsule_mask((h, w), [sh, el, wr, fist], [r_up, r_lo, r_lo * 1.25]) & (alpha > 0)
        limb_masks[f"arm{side.upper()}"] = (m, [sh, el, fist])
    for side in "lr":
        hp, kn, an = joints[f"{side}hip"], joints[f"{side}kn"], joints[f"{side}ank"]
        foot = an + (an - kn) * 0.35
        foot[1] = max(foot[1], h + 10)
        r_up = np.clip(limb_width(alpha, hp, kn), torso_len * 0.18, torso_len * 0.45)
        r_lo = np.clip(limb_width(alpha, kn, an), torso_len * 0.15, torso_len * 0.42)
        top = hp + (hp - kn) / max(1, np.linalg.norm(hp - kn)) * r_up * 0.6
        m = capsule_mask((h, w), [top, hp, kn, foot], [r_up, r_up, r_lo]) & (alpha > 0)
        limb_masks[f"leg{side.upper()}"] = (m, [hp, kn, foot])

    # the head always stays with the body: no limb may take pixels from it
    head_c = (head + neck) / 2
    head_r = max(np.linalg.norm(head - neck) * 0.62, torso_len * 0.22)
    head_zone = capsule_mask((h, w), [head_c, head_c + 0.01], [head_r])
    for k in list(limb_masks):
        m, pts = limb_masks[k]
        limb_masks[k] = (m & ~head_zone, pts)

    # resolve overlaps: legs split by nearest leg bone, arms take priority over legs
    yy, xx = np.mgrid[0:h, 0:w]
    P = np.stack([xx.ravel(), yy.ravel()], 1).astype(float)

    def near(mask_key):
        m, pts = limb_masks[mask_key]
        d = np.full(h * w, 1e9)
        for p0, p1 in zip(pts[:-1], pts[1:]):
            dd, _ = seg_dist(P, p0, p1)
            d = np.minimum(d, dd)
        return d.reshape(h, w)

    for pair in (("legL", "legR"), ("armL", "armR")):
        both = limb_masks[pair[0]][0] & limb_masks[pair[1]][0]
        if both.any():
            d0, d1 = near(pair[0]), near(pair[1])
            m0, p0 = limb_masks[pair[0]]
            m1, p1 = limb_masks[pair[1]]
            limb_masks[pair[0]] = (m0 & ~(both & (d1 < d0)), p0)
            limb_masks[pair[1]] = (m1 & ~(both & (d0 <= d1)), p1)
    arms = limb_masks["armL"][0] | limb_masks["armR"][0]
    for k in ("legL", "legR"):
        m, p = limb_masks[k]
        limb_masks[k] = (m & ~arms, p)

    # everything below the waist that isn't an arm belongs to the nearest leg
    hip_y = pelvis[1]
    solid = alpha > 0
    low = solid & ~arms & (yy > hip_y + torso_len * 0.1)
    dL, dR = near("legL"), near("legR")
    limb_masks["legL"] = (limb_masks["legL"][0] | (low & (dL <= dR)), limb_masks["legL"][1])
    limb_masks["legR"] = (limb_masks["legR"][0] | (low & (dR < dL)), limb_masks["legR"][1])

    # pieces cut off from the main body (fingers, coat tips) go to the nearest limb
    rest = solid & ~arms & ~((limb_masks["legL"][0] | limb_masks["legR"][0]) & (yy > hip_y + torso_len * 0.08))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(rest.astype(np.uint8), connectivity=8)
    if n > 2:
        main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        stray = (lab > 0) & (lab != main) & ~head_zone
        dists = {k: near(k) for k in limb_masks}
        stack = np.stack([dists[k] for k in limb_masks])
        keys = list(limb_masks)
        choice = np.argmin(stack, axis=0)
        for i, k in enumerate(keys):
            m, pts = limb_masks[k]
            limb_masks[k] = (m | (stray & (choice == i)), pts)
        arms = limb_masks["armL"][0] | limb_masks["armR"][0]

    # which limbs lead (are further forward = +x in rig space)
    lead_arm = "L" if joints["lwr"][0] >= joints["rwr"][0] else "R"
    lead_leg = "L" if joints["lank"][0] >= joints["rank"][0] else "R"

    # body: everything not in an arm, and not in a leg below the hips
    legs_low = (limb_masks["legL"][0] | limb_masks["legR"][0]) & (yy > hip_y + torso_len * 0.08)
    body_alpha = alpha.copy()
    removed = (arms | legs_low) & (alpha > 0)
    # keep a little shoulder overlap in the body so arm roots never leave a hole
    shoulder_keep = np.zeros((h, w), bool)
    for s in "lr":
        shoulder_keep |= capsule_mask((h, w), [joints[f"{s}sh"], joints[f"{s}sh"] + 0.01], [torso_len * 0.16])
    removed &= ~shoulder_keep
    body_alpha[removed] = 0
    # inpaint the torso behind removed arms: pixels inside the closed body silhouette
    k = int(max(9, torso_len * 0.35)) | 1
    closed = cv2.morphologyEx((body_alpha > 128).astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    fill = (closed > 0) & (body_alpha < 128) & arms & (yy < hip_y + torso_len * 0.2)
    rgb = np.ascontiguousarray(a[..., :3][..., ::-1])
    hole = ((body_alpha < 128) & ((closed > 0) | arms)).astype(np.uint8) * 255
    inpainted = cv2.inpaint(rgb, hole, 7, cv2.INPAINT_TELEA)[..., ::-1]
    body_rgb = a[..., :3].copy()
    body_rgb[fill] = inpainted[fill]
    body_alpha = np.where(fill, 255, body_alpha)

    def layer_img(mask, rgb=None):
        img = np.zeros((h, w, 4), np.uint8)
        img[..., :3] = a[..., :3] if rgb is None else rgb
        img[..., 3] = np.where(mask, alpha, 0) if mask is not None else 0
        return img

    imgs = {
        "body": np.dstack([body_rgb, body_alpha]).astype(np.uint8),
        "armL": layer_img(limb_masks["armL"][0]),
        "armR": layer_img(limb_masks["armR"][0]),
        "legL": layer_img(limb_masks["legL"][0]),
        "legR": layer_img(limb_masks["legR"][0]),
    }

    # pack layers into an atlas (cropped to their bounds, 2 px padding)
    crops = {}
    for name, img in imgs.items():
        ys, xs = np.where(img[..., 3] > 4)
        if len(xs) == 0:
            continue
        x0, x1 = max(0, xs.min() - 2), min(w, xs.max() + 3)
        y0, y1 = max(0, ys.min() - 2), min(h, ys.max() + 3)
        crops[name] = (x0, y0, x1, y1, img[y0:y1, x0:x1])
    # simple shelf packing
    order = sorted(crops, key=lambda n: -(crops[n][3] - crops[n][1]))
    AW = 1024
    x = y = shelf = 0
    place = {}
    for n in order:
        cw, ch = crops[n][2] - crops[n][0], crops[n][3] - crops[n][1]
        if x + cw > AW:
            x, y, shelf = 0, y + shelf + 2, 0
        place[n] = (x, y)
        x += cw + 2
        shelf = max(shelf, ch)
    AH = y + shelf
    atlas = np.zeros((AH, AW, 4), np.uint8)
    for n, (ax, ay) in place.items():
        x0, y0, x1, y1, img = crops[n]
        atlas[ay:ay + (y1 - y0), ax:ax + (x1 - x0)] = img

    # meshes with skin weights
    jpts = {k: v.tolist() for k, v in joints.items()}
    meshes = []
    draw = [f"leg{'R' if lead_leg == 'L' else 'L'}", f"leg{lead_leg}", "body", f"arm{'R' if lead_arm == 'L' else 'L'}", f"arm{lead_arm}"]
    for name in draw:
        if name not in crops:
            continue
        x0, y0, x1, y1, img = crops[name]
        ax, ay = place[name]
        cols = max(1, math.ceil((x1 - x0) / CELL))
        rows = max(1, math.ceil((y1 - y0) / CELL))
        verts, uvs, wts, idx = [], [], [], []
        vid = {}
        la = img[..., 3]

        def vert(cx, cy):
            key = (cx, cy)
            if key in vid:
                return vid[key]
            px = min(x0 + cx * CELL, x1)
            py = min(y0 + cy * CELL, y1)
            vid[key] = len(verts)
            verts.append([float(px), float(py)])
            uvs.append([float((ax + px - x0) / AW), float((ay + py - y0) / AH)])
            return vid[key]

        for cy in range(rows):
            for cx in range(cols):
                sx0, sy0 = cx * CELL, cy * CELL
                cell = la[sy0:sy0 + CELL + 1, sx0:sx0 + CELL + 1]
                if cell.size == 0 or cell.max() < 6:
                    continue
                v00, v10, v01, v11 = vert(cx, cy), vert(cx + 1, cy), vert(cx, cy + 1), vert(cx + 1, cy + 1)
                idx += [v00, v01, v10, v10, v01, v11]
        V = np.array(verts, float)
        # weights: up to 2 bones per vertex
        if name.startswith("arm"):
            s = name[-1].lower()
            sh, el, wr = joints[f"{s}sh"], joints[f"{s}el"], joints[f"{s}wr"]
            up, lo = B[f"arm{name[-1]}_up"], B[f"arm{name[-1]}_lo"]
            _, t_up = seg_dist(V, sh, el)
            d_up, _ = seg_dist(V, sh, el)
            d_lo, _ = seg_dist(V, el, ext(el, wr, 0.6))
            # blend across the elbow
            blend = np.clip((d_up - d_lo) / (torso_len * 0.12) * 0.5 + 0.5, 0, 1)
            near_sh = np.clip(1 - np.linalg.norm(V - sh, axis=1) / (torso_len * 0.25), 0, 1) * (t_up < 0.15)
            for i in range(len(V)):
                wl = blend[i] * (1 - near_sh[i])
                if near_sh[i] > 0:
                    wts.append([[B["torso"], float(near_sh[i] * 0.6)], [up, float(1 - near_sh[i] * 0.6)]])
                else:
                    wts.append([[up, float(1 - wl)], [lo, float(wl)]])
        elif name.startswith("leg"):
            s = name[-1].lower()
            hp, kn, an = joints[f"{s}hip"], joints[f"{s}kn"], joints[f"{s}ank"]
            up, lo = B[f"leg{name[-1]}_up"], B[f"leg{name[-1]}_lo"]
            d_up, _ = seg_dist(V, hp, kn)
            d_lo, _ = seg_dist(V, kn, an + (an - kn) * 2)
            blend = np.clip((d_up - d_lo) / (torso_len * 0.15) * 0.5 + 0.5, 0, 1)
            above = V[:, 1] < hp[1]
            for i in range(len(V)):
                if above[i]:
                    wts.append([[B["pelvis"], 0.5], [up, 0.5]])
                else:
                    wts.append([[up, float(1 - blend[i])], [lo, float(blend[i])]])
        else:
            # body: pelvis at the waist, torso above, head above the neck
            for i in range(len(V)):
                y = V[i, 1]
                if y < neck[1]:
                    k = float(np.clip((neck[1] - y) / (torso_len * 0.15), 0, 1))
                    wts.append([[B["head"], k], [B["torso"], 1 - k]])
                else:
                    k = float(np.clip((y - (pelvis[1] - torso_len * 0.25)) / (torso_len * 0.3), 0, 1))
                    wts.append([[B["pelvis"], k], [B["torso"], 1 - k]])
        meshes.append({
            "name": name,
            "v": [round(c, 1) for p in verts for c in p],
            "uv": [round(c, 5) for p in uvs for c in p],
            "i": idx,
            "w": [[b, round(wt, 3)] for vw in wts for b, wt in (vw if len(vw) == 2 else vw + [[0, 0]])],
        })

    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(OUT / f"{fid}.webp", "WEBP", quality=90, method=6)
    rig = {
        "w": w,
        "h": h,
        "atlas": [int(AW), int(AH)],
        "joints": {k: [round(v[0], 1), round(v[1], 1)] for k, v in jpts.items()},
        "leadArm": lead_arm,
        "leadLeg": lead_leg,
        "meshes": meshes,
    }
    (OUT / f"{fid}.json").write_text(json.dumps(rig, separators=(",", ":")))
    return rig


def main():
    data = json.loads(JOINTS.read_text())
    only = set(sys.argv[1:])
    for fid, entry in data.items():
        if only and fid not in only:
            continue
        rig = build(fid, entry["joints"], entry["facesRight"])
        nv = sum(len(m["v"]) // 2 for m in rig["meshes"])
        nt = sum(len(m["i"]) // 3 for m in rig["meshes"])
        print(f"{fid}: {nv} verts, {nt} tris, atlas {rig['atlas']}", flush=True)


if __name__ == "__main__":
    main()
