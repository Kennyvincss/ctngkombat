#!/usr/bin/env python3
"""Build game assets from the source fighter cards.

For every card in source/cards/NN-<id>.webp this writes:
  public/assets/fighters/<id>.png  background-removed cut-out (Phase A puppet, master copy)
  public/assets/fighters/<id>.webp the same cut-out as WebP, which is what the game loads
  public/assets/cards/<id>.webp    downscaled full card for select / VS / win screens
  public/assets/thumbs/<id>.webp   square head-and-shoulders thumbnail for the select grid

Usage:  python3 scripts/make_assets.py [id ...]
Needs:  pip install "rembg[cpu]" pillow numpy scipy
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "cards"
OUT_FIGHTERS = ROOT / "public" / "assets" / "fighters"
OUT_CARDS = ROOT / "public" / "assets" / "cards"
OUT_THUMBS = ROOT / "public" / "assets" / "thumbs"

CARD_W, CARD_H = 1024, 1536
FRAME_INSET = 48                       # gold frame border on every side
CUT_BOTTOM = 1290                      # nameplate top: the figure is cut here
FADE = 60                              # px of alpha fade above the cut (legs fade into stage fog)
CUTOUT_HEIGHT = 520                    # in-game texture height
DEFAULT_MODEL = "birefnet-general"     # best on dark-on-dark cards; ~1 image per process (memory)
PREVIEW_SIZE = (480, 720)
THUMB = 160

# Manual overrides after reviewing results: id -> dict
OVERRIDES: dict = {}


_sessions: dict = {}


def sessions(name: str):
    if name not in _sessions:
        _sessions[name] = new_session(name)
    return _sessions[name]


def process(card_path: Path) -> dict:
    fid = card_path.stem.split("-", 1)[1]
    ov = OVERRIDES.get(fid, {})
    card = Image.open(card_path).convert("RGB")
    assert card.size == (CARD_W, CARD_H), card.size

    # 1. remove background on the card minus its frame
    bottom = ov.get("cut_bottom", CUT_BOTTOM)
    inset = card.crop((FRAME_INSET, FRAME_INSET, CARD_W - FRAME_INSET, bottom))
    sess = sessions(ov.get("model", DEFAULT_MODEL))
    cut = remove(inset, session=sess, post_process_mask=True)
    alpha = np.asarray(cut.getchannel("A")).copy()

    # 2. fade the legs out above the nameplate cut
    ramp = np.linspace(1.0, 0.0, FADE)[:, None]
    alpha[-FADE:] = (alpha[-FADE:] * ramp).astype(np.uint8)

    # 3. keep the main figure: largest blob plus any big blobs touching it
    solid = alpha > 100
    labels, n = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    if n > 1:
        sizes = ndimage.sum(solid, labels, range(1, n + 1))
        keep_ratio = ov.get("keep_ratio", 0.12)
        keep = {i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * keep_ratio}
        alpha[~np.isin(labels, list(keep))] = 0

    # soften the hard edge left by the nameplate cut
    a_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.6))
    cut.putalpha(a_img)

    # 4. trim and scale
    bbox = a_img.point(lambda v: 255 if v > 24 else 0).getbbox()
    fig = cut.crop(bbox)
    scale = CUTOUT_HEIGHT / fig.height
    fig = fig.resize((max(1, round(fig.width * scale)), CUTOUT_HEIGHT), Image.LANCZOS)
    OUT_FIGHTERS.mkdir(parents=True, exist_ok=True)
    fig.save(OUT_FIGHTERS / f"{fid}.png", optimize=True)
    fig.save(OUT_FIGHTERS / f"{fid}.webp", "WEBP", quality=88, method=6)

    # 5. preview card
    OUT_CARDS.mkdir(parents=True, exist_ok=True)
    card.resize(PREVIEW_SIZE, Image.LANCZOS).save(OUT_CARDS / f"{fid}.webp", quality=86)

    # 6. thumbnail around the head: top of the figure, centred on its upper mass
    full_alpha = np.zeros((CARD_H, CARD_W), np.uint8)
    full_alpha[FRAME_INSET:bottom, FRAME_INSET:CARD_W - FRAME_INSET] = alpha
    rows = np.where(full_alpha.max(axis=1) > 100)[0]
    top = int(rows[0]) if len(rows) else 100
    band = full_alpha[top:top + 220] > 100
    cols = np.where(band.any(axis=0))[0]
    cx = int(cols.mean()) if len(cols) else CARD_W // 2
    side = ov.get("thumb_side", 460)
    tx = min(max(cx - side // 2, 0), CARD_W - side)
    ty = min(max(top - 40 + ov.get("thumb_dy", 0), 0), CARD_H - side)
    OUT_THUMBS.mkdir(parents=True, exist_ok=True)
    card.crop((tx, ty, tx + side, ty + side)).resize((THUMB, THUMB), Image.LANCZOS).save(
        OUT_THUMBS / f"{fid}.webp", quality=85)

    return {"id": fid, "cutout": {"w": fig.width, "h": fig.height}}


def main():
    only = set(sys.argv[1:])
    for card_path in sorted(SRC.glob("*.webp")):
        fid = card_path.stem.split("-", 1)[1]
        if only and fid not in only:
            continue
        print(process(card_path), flush=True)


if __name__ == "__main__":
    main()
