#!/usr/bin/env python3
"""Verify and trim die-cut stills.
For every <base>.png (alpha cut) with a <base>.opaque.png twin (same clip, page untouched):
  - maxDiffOpaque: max |cut - twin| (RGB, 0-255) over pixels the cut marks fully opaque -> must be ~0 (the cut is the real rendering)
  - alpha stats: share of transparent / partial / opaque pixels, alpha bbox
  - trims both files to the alpha bbox + margin (same box, so they stay aligned) unless --no-trim
usage: alpha_check.py [--no-trim] [--margin N] base1 [base2 ...]   (base = path without .png)
prints JSON lines
"""
import json, sys
import numpy as np
from PIL import Image

args = sys.argv[1:]
trim = '--no-trim' not in args
margin = 12
if '--margin' in args:
    margin = int(args[args.index('--margin') + 1])
bases = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] != '--margin')]
for base in bases:
    cut = Image.open(base + '.png').convert('RGBA')
    a = np.asarray(cut).astype(np.int16)
    out = {'file': base + '.png', 'size': list(cut.size)}
    alpha = a[..., 3]
    out['alpha'] = {'transparent': round(float((alpha == 0).mean()), 4), 'partial': round(float(((alpha > 0) & (alpha < 255)).mean()), 4), 'opaque': round(float((alpha == 255).mean()), 4)}
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0:
        out['error'] = 'empty cut'
        print(json.dumps(out, ensure_ascii=False)); continue
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    out['alphaBBox'] = [x0, y0, x1, y1]
    try:
        tw = Image.open(base + '.opaque.png').convert('RGB')
        t = np.asarray(tw).astype(np.int16)
        if t.shape[:2] == a.shape[:2]:
            m = alpha == 255
            d = np.abs(a[..., :3] - t)[m]
            out['maxDiffOpaque'] = int(d.max()) if d.size else None
            out['p999DiffOpaque'] = float(np.percentile(d.max(axis=1), 99.9)) if d.size else None
            # shift-tolerant: the same rendering may be pixel-snapped 1-2 px differently once the rest of the page is hidden
            # (composited layers are re-rasterised); compare each opaque pixel with the best match within +-2 px
            best = None
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    sh = np.roll(np.roll(t, dy, axis=0), dx, axis=1)
                    dd = np.abs(a[..., :3] - sh).max(axis=2)
                    best = dd if best is None else np.minimum(best, dd)
            bm = best[m]
            # perceptual: both blurred (sigma ~1.2 px at device scale) -> what remains is real content difference, not AA/snapping
            from PIL import ImageFilter
            ab = np.asarray(Image.fromarray(a[..., :3].astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.int16)
            tb = np.asarray(tw.filter(ImageFilter.GaussianBlur(1.2))).astype(np.int16)
            inner = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9))) > 0   # away from the cut edge
            db = np.abs(ab - tb).max(axis=2)[inner]
            out['blurredDiff'] = {'p99': float(np.percentile(db, 99)) if db.size else None, 'p999': float(np.percentile(db, 99.9)) if db.size else None}
            out['shiftTolerant'] = {'p99': float(np.percentile(bm, 99)) if bm.size else None, 'p999': float(np.percentile(bm, 99.9)) if bm.size else None, 'max': int(bm.max()) if bm.size else None}
        else:
            out['maxDiffOpaque'] = 'size mismatch'
    except FileNotFoundError:
        tw = None
    if trim:
        X0, Y0 = max(0, x0 - margin), max(0, y0 - margin)
        X1, Y1 = min(cut.size[0], x1 + margin), min(cut.size[1], y1 + margin)
        if (X0, Y0, X1, Y1) != (0, 0, cut.size[0], cut.size[1]):
            cut.crop((X0, Y0, X1, Y1)).save(base + '.png', optimize=True)
            if tw is not None:
                tw.crop((X0, Y0, X1, Y1)).save(base + '.opaque.png', optimize=True)
        out['trimmedTo'] = [X1 - X0, Y1 - Y0]
    print(json.dumps(out, ensure_ascii=False))
