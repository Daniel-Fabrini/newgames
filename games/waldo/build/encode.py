#!/usr/bin/env python3
"""Encode raw renders (build/out/*.png + json) into the game's assets.

  python3 encode.py [id ...]      ->  ../scenes/<id>.webp, <id>_s.webp, <id>.json, ../sprites/*.webp, scenes/index.json
Each scene is encoded to <= BUDGET bytes by trying a ladder of sizes/qualities.
"""
import json, os, sys, io
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('WALDO_OUT', os.path.join(HERE, 'out'))
SCENES = os.path.join(HERE, '..', 'scenes')
SPR = os.path.join(HERE, '..', 'sprites')
BUDGET = int(os.environ.get('WALDO_BUDGET', 800 * 1024))
os.makedirs(SCENES, exist_ok=True)
os.makedirs(SPR, exist_ok=True)

def enc(im, q, method=5):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=method)
    return b.getvalue()

def fit(im):
    W, H = im.size
    for scale in (1.0, 0.9, 0.8):
        s = im if scale == 1.0 else im.resize((round(W * scale), round(H * scale)), Image.LANCZOS)
        lo, hi, best = 34, 82, None
        while lo <= hi:
            mid = (lo + hi) // 2
            data = enc(s, mid)
            if len(data) <= BUDGET:
                best = (mid, data)
                lo = mid + 1
            else:
                hi = mid - 1
        if best and best[0] >= 44:
            return s.size, best
    return s.size, best or (34, enc(s, 34))

ids = [a for a in sys.argv[1:] if not a.startswith('-')]
if not ids:
    ids = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.png') and os.path.exists(os.path.join(OUT, f[:-4] + '.json')))
index = {}
for sid in ids:
    im = Image.open(os.path.join(OUT, sid + '.png')).convert('RGB')
    meta = json.load(open(os.path.join(OUT, sid + '.json')))
    (iw, ih), (q, data) = fit(im)
    open(os.path.join(SCENES, sid + '.webp'), 'wb').write(data)
    prev = im.resize((480, round(480 * im.height / im.width)), Image.LANCZOS)
    prev.save(os.path.join(SCENES, sid + '_s.webp'), 'WEBP', quality=72, method=5)
    meta['iw'], meta['ih'] = iw, ih
    json.dump(meta, open(os.path.join(SCENES, sid + '.json'), 'w'), separators=(',', ':'))
    print(f'{sid}: {iw}x{ih} q{q} {len(data)//1024} KB')
# sprites (icons)
icons = os.path.join(OUT, 'icons')
if os.path.isdir(icons):
    for f in sorted(os.listdir(icons)):
        if f.endswith('.png'):
            Image.open(os.path.join(icons, f)).convert('RGBA').save(os.path.join(SPR, f[:-4] + '.webp'), 'WEBP', lossless=True, quality=90, method=5)
    print('sprites:', len(os.listdir(SPR)))
