# PIL: paints the playfield artwork (800x1600 = 2 px per table unit) and writes the insert list used by the game.
#   python3 art.py <scratch-dir> [table ids...]
# Reads fig_*.png (rendered by figures.py) from <scratch-dir>; writes paint_<id>.png and ../art/inserts_<id>.json
import sys, os, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

S = 2
W, H = 400 * S, 800 * S
SCR = sys.argv[1] if len(sys.argv) > 1 else '.'
IDS = sys.argv[2:] or ['neon', 'space']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
HERE = os.path.dirname(os.path.abspath(__file__))
XC, RING = 182, (182, 548)


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def font(sz):
    return ImageFont.truetype(FONT, int(sz * S))


def P(x, y):
    return (x * S, y * S)


def outline_mask():
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    pts = [P(200 + 186 * math.cos(math.pi + math.pi * i / 80), 200 + 186 * math.sin(math.pi + math.pi * i / 80)) for i in range(81)]
    pts += [P(386, 800), P(14, 800)]
    d.polygon(pts, fill=255)
    return m


def sunburst(pal, cx, cy, spec):
    """pal: list of (angle_from_deg, angle_to_deg, color_a, color_b) ; angles 0=right, clockwise (y down)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = xx - cx * S, yy - cy * S
    ang = (np.degrees(np.arctan2(dy, dx)) + 360) % 360
    rad = np.hypot(dx, dy) / S
    out = np.zeros((H, W, 3), np.float32)
    for a0, a1, ca, cb in spec:
        m = (ang >= a0) & (ang < a1)
        t = np.clip((rad - 60) / 380.0, 0, 1)[..., None]
        ca_, cb_ = np.array(hexc(ca), np.float32), np.array(hexc(cb), np.float32)
        col = ca_ * (1 - t) + cb_ * t
        # soft stripe inside each wedge
        k = ((ang - a0) / max(1, a1 - a0))[..., None]
        col = col * (0.88 + 0.22 * np.sin(k * math.pi))
        out[m] = col[m]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def fig(name, h, flip=False):
    im = Image.open(os.path.join(SCR, f'fig_{name}.png')).convert('RGBA')
    bb = im.getbbox()
    im = im.crop(bb)
    sc = h * S / im.height
    im = im.resize((max(1, int(im.width * sc)), int(h * S)), Image.LANCZOS)
    if flip:
        im = ImageOps_mirror(im)
    return im


def ImageOps_mirror(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def paste_fig(canvas, name, x, y, h, flip=False, shadow=True, tint=None, alpha=1.0, rot=0):
    """x,y = feet position (table units)."""
    im = fig(name, h, flip)
    if tint:
        r, g, b, a = im.split()
        col = Image.new('RGB', im.size, hexc(tint))
        im = Image.merge('RGBA', (col.split()[0], col.split()[1], col.split()[2], a))
    if alpha < 1:
        r, g, b, a = im.split()
        im = Image.merge('RGBA', (r, g, b, a.point(lambda v: int(v * alpha))))
    if rot:
        im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
    px, py = int(x * S - im.width / 2), int(y * S - im.height)
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        a = im.split()[3].point(lambda v: int(v * 0.5))
        sh.putalpha(a)
        sh = sh.filter(ImageFilter.GaussianBlur(3 * S))
        canvas.alpha_composite(sh, (px + 3 * S, py + 4 * S)) if px >= 0 and py >= 0 else None
    canvas.alpha_composite(im, (max(0, px), max(0, py))) if px >= 0 and py >= 0 else canvas.paste(im, (px, py), im)


def glowline(d, pts, col, w):
    d.line(pts, fill=col, width=int(w * S), joint='curve')


def star(d, cx, cy, r, col, n=5, inner=0.45, rot=-90):
    pts = []
    for i in range(n * 2):
        rr = r * (1 if i % 2 == 0 else inner)
        a = math.radians(rot + i * 180 / n)
        pts.append(P(cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=col)


def leaf_icon(d, cx, cy, r, col):
    pts = [P(cx, cy - r), P(cx + r * 0.8, cy - r * 0.1), P(cx + r * 0.2, cy + r), P(cx - r * 0.7, cy + r * 0.4), P(cx - r * 0.5, cy - r * 0.4)]
    d.polygon(pts, fill=col)
    d.line([P(cx - r * 0.5, cy + r * 0.8), P(cx + r * 0.3, cy - r * 0.5)], fill=(30, 90, 30), width=int(1.4 * S))


def drop_icon(d, cx, cy, r, col):
    d.polygon([P(cx, cy - r * 1.1), P(cx + r * 0.7, cy + r * 0.2), P(cx - r * 0.7, cy + r * 0.2)], fill=col)
    d.ellipse([P(cx - r * 0.72, cy - r * 0.2), P(cx + r * 0.72, cy + r * 1.1)], fill=col)


def flame_icon(d, cx, cy, r, col):
    d.polygon([P(cx, cy - r * 1.2), P(cx + r * 0.7, cy + r * 0.1), P(cx + r * 0.5, cy + r * 0.9), P(cx - r * 0.5, cy + r * 0.9), P(cx - r * 0.7, cy + r * 0.1), P(cx - r * 0.2, cy - r * 0.3)], fill=col)
    d.ellipse([P(cx - r * 0.3, cy + r * 0.1), P(cx + r * 0.3, cy + r * 0.8)], fill=(255, 230, 120))


def bolt_icon(d, cx, cy, r, col):
    d.polygon([P(cx + r * 0.2, cy - r), P(cx - r * 0.6, cy + r * 0.1), P(cx - r * 0.05, cy + r * 0.1), P(cx - r * 0.3, cy + r), P(cx + r * 0.6, cy - r * 0.2), P(cx + r * 0.05, cy - r * 0.2)], fill=col)


def eye_icon(d, cx, cy, r, col):
    d.ellipse([P(cx - r, cy - r * 0.6), P(cx + r, cy + r * 0.6)], fill=col)
    d.ellipse([P(cx - r * 0.4, cy - r * 0.4), P(cx + r * 0.4, cy + r * 0.4)], fill=(30, 30, 50))


def ball_icon(d, cx, cy, r, ring=True):
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=(250, 250, 250))
    d.pieslice([P(cx - r, cy - r), P(cx + r, cy + r)], 180, 360, fill=(230, 40, 40))
    d.line([P(cx - r, cy), P(cx + r, cy)], fill=(20, 20, 20), width=int(max(1, r * 0.22) * S))
    d.ellipse([P(cx - r * 0.3, cy - r * 0.3), P(cx + r * 0.3, cy + r * 0.3)], fill=(250, 250, 250), outline=(20, 20, 20), width=int(max(1, r * 0.14) * S))
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], outline=(20, 20, 20), width=int(max(1, r * 0.18) * S))


def plate(d, cx, cy, r, col, ring=(255, 240, 200)):
    d.ellipse([P(cx - r - 1.6, cy - r - 1.6), P(cx + r + 1.6, cy + r + 1.6)], fill=(20, 20, 30))
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=col, outline=ring, width=int(1.1 * S))


def map_ring(img, cx, cy, r, seed=3, psychic=False):
    """Procedural adventure map clipped to a circle."""
    rnd = np.random.RandomState(seed)
    n = int(2 * r * S)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / S
    field = np.zeros((n, n), np.float32)
    for _ in range(9):
        fx, fy, ph = rnd.uniform(0.02, 0.09, 3)
        gx, gy = rnd.uniform(-1, 1, 2)
        field += np.sin(xx * (fx + gx * 0.03) * 2 + yy * (fy + gy * 0.03) * 2 + ph * 40) * rnd.uniform(0.5, 1)
    field = (field - field.min()) / (field.max() - field.min())
    sea_a, sea_b = np.array([40, 130, 220], np.float32), np.array([110, 200, 255], np.float32)
    if psychic:
        sea_a, sea_b = np.array([70, 40, 150], np.float32), np.array([170, 120, 255], np.float32)
    col = np.zeros((n, n, 3), np.float32)
    t = (yy / (2 * r))[..., None]
    col[:] = sea_a * (1 - t) + sea_b * t
    land = field > 0.52
    sand = (field > 0.5) & (field <= 0.54)
    forest = field > 0.64
    hills = field > 0.74
    col[land] = np.array([110, 200, 80], np.float32)
    col[forest] = np.array([50, 150, 60], np.float32)
    col[hills] = np.array([150, 120, 80], np.float32)
    col[sand] = np.array([240, 220, 140], np.float32)
    if psychic:
        col[land] = np.array([140, 90, 200], np.float32)
        col[forest] = np.array([100, 60, 170], np.float32)
        col[hills] = np.array([200, 160, 240], np.float32)
        col[sand] = np.array([255, 200, 255], np.float32)
    m = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB').filter(ImageFilter.GaussianBlur(0.8))
    d = ImageDraw.Draw(m)
    # dotted route + town dots
    pts = [(rnd.uniform(0.2, 0.8) * n, rnd.uniform(0.2, 0.8) * n) for _ in range(6)]
    for i in range(len(pts) - 1):
        for k in range(14):
            t = k / 14
            x = pts[i][0] * (1 - t) + pts[i + 1][0] * t
            y = pts[i][1] * (1 - t) + pts[i + 1][1] * t
            d.ellipse([x - 1.6, y - 1.6, x + 1.6, y + 1.6], fill=(255, 255, 255))
    for p in pts:
        d.ellipse([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], fill=(240, 60, 60), outline=(255, 255, 255), width=2)
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, n - 1, n - 1], fill=255)
    img.paste(m, (int((cx - r) * S), int((cy - r) * S)), mask)


def paint(spec):
    tid = spec['id']
    mask = outline_mask()
    base = sunburst(None, RING[0], RING[1], spec['wedges']).convert('RGBA')
    img = Image.new('RGBA', (W, H), (8, 8, 14, 255))
    img.paste(base, (0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    rnd = random.Random(5)
    # night top area with dark center "mode" glow
    top = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(top)
    for r, a in [(260, 70), (200, 90), (140, 90), (90, 70)]:
        td.ellipse([P(XC - r, spec['mode_y'] - r), P(XC + r, spec['mode_y'] + r)], fill=hexc(spec['night']) + (a,))
    top = top.filter(ImageFilter.GaussianBlur(14 * S))
    img.alpha_composite(top)
    d = ImageDraw.Draw(img, 'RGBA')
    # sky strip along the top arc
    sky = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sky)
    for i in range(60):
        t = i / 60
        sd.ellipse([P(XC - 190 + i * 1.6, 12 + i * 1.8 - 190 + 110), P(XC + 190 - i * 1.6, 12 + i * 1.8 + 190 + 110)], outline=hexc(spec['sky'][0]) + (int(110 * (1 - t)),), width=S * 2)
    img.alpha_composite(sky)
    d = ImageDraw.Draw(img, 'RGBA')
    for _ in range(90):
        x, y = rnd.uniform(30, 350), rnd.uniform(18, 330)
        r = rnd.uniform(0.4, 1.3)
        d.ellipse([P(x - r, y - r), P(x + r, y + r)], fill=(255, 255, 255, rnd.randint(70, 200)))
    # fine halftone dots for texture
    dots = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    for yy in range(0, 800, 9):
        for xx in range(0, 400, 9):
            o = 4.5 if (yy // 9) % 2 else 0
            dd.ellipse([P(xx + o - 1.1, yy - 1.1), P(xx + o + 1.1, yy + 1.1)], fill=(255, 255, 255, 16))
    img.alpha_composite(dots)
    d = ImageDraw.Draw(img, 'RGBA')

    # --- apron (red/black) below the flippers
    ap = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ad = ImageDraw.Draw(ap)
    ad.polygon([P(14, 680), P(150, 740), P(214, 740), P(350, 680), P(350, 800), P(14, 800)], fill=hexc(spec['apron']) + (255,))
    ad.polygon([P(14, 720), P(130, 772), P(234, 772), P(350, 720), P(350, 800), P(14, 800)], fill=(14, 14, 20, 255))
    for k in range(0, 360, 14):
        ad.ellipse([P(30 + k - 2, 790 - 2), P(30 + k + 2, 790 + 2)], fill=(60, 60, 72, 255))
    img.alpha_composite(ap.filter(ImageFilter.GaussianBlur(0.6)))
    d = ImageDraw.Draw(img, 'RGBA')

    # --- bowl at the top with emblem
    cx, cy = XC, 54
    d.ellipse([P(cx - 56, cy - 22), P(cx + 56, cy + 22)], fill=hexc(spec['bowl']) + (255,), outline=(255, 255, 255, 255), width=int(1.5 * S))
    d.arc([P(cx - 52, cy - 18), P(cx + 52, cy + 18)], 200, 340, fill=(255, 210, 60, 255), width=int(3 * S))
    d.arc([P(cx - 44, cy - 12), P(cx + 44, cy + 12)], 200, 340, fill=(230, 50, 50, 255), width=int(3 * S))
    # --- lane plates
    for i, l in enumerate(spec['lanes']):
        x, c, icon = l
        plate(d, x, 88, 12.5, hexc(c) + (255,))
        icon(d, x, 88, 6.2, (255, 255, 255, 255))
    # --- ring + map
    cxr, cyr = RING
    for r, col in [(88, (20, 20, 30)), (85, hexc(spec['ring']))]:
        d.ellipse([P(cxr - r, cyr - r), P(cxr + r, cyr + r)], fill=col + (255,) if len(col) == 3 else col)
    d.ellipse([P(cxr - 74, cyr - 74), P(cxr + 74, cyr + 74)], fill=(255, 255, 255, 255))
    d.ellipse([P(cxr - 71, cyr - 71), P(cxr + 71, cyr + 71)], fill=(30, 30, 40, 255))
    map_ring(img, cxr, cyr, 68, seed=spec['seed'], psychic=spec.get('psychic', False))
    d = ImageDraw.Draw(img, 'RGBA')
    for k in range(24):
        a = math.radians(k * 15)
        x, y = cxr + 79.5 * math.cos(a), cyr + 79.5 * math.sin(a)
        d.ellipse([P(x - 2.6, y - 2.6), P(x + 2.6, y + 2.6)], fill=(255, 255, 255, 230))
    # --- central badge (big ball + silhouette)
    bx, by = XC, spec['badge_y']
    d.ellipse([P(bx - 38, by - 38), P(bx + 38, by + 38)], fill=(20, 20, 40, 255))
    d.pieslice([P(bx - 35, by - 35), P(bx + 35, by + 35)], 180, 360, fill=hexc(spec['badge'][0]) + (255,))
    d.pieslice([P(bx - 35, by - 35), P(bx + 35, by + 35)], 0, 180, fill=(245, 245, 250, 255))
    d.line([P(bx - 35, by), P(bx + 35, by)], fill=(20, 20, 40, 255), width=4 * S)
    d.ellipse([P(bx - 36, by - 36), P(bx + 36, by + 36)], outline=(20, 20, 40, 255), width=3 * S)
    for r in range(3):
        a = math.radians(-90 + r * 120)
    # --- chevrons / panels
    for (x, y, rot, c) in spec['chevrons']:
        ch = Image.new('RGBA', (60 * S, 40 * S), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch)
        cd.polygon([(5 * S, 30 * S), (30 * S, 5 * S), (55 * S, 30 * S), (55 * S, 38 * S), (30 * S, 15 * S), (5 * S, 38 * S)], fill=hexc(c) + (255,), outline=(20, 20, 20, 255))
        ch = ch.rotate(rot, expand=True, resample=Image.BICUBIC).resize((int(ch.width * 0.45), int(ch.height * 0.45)), Image.LANCZOS)
        img.alpha_composite(ch, (int(x * S - ch.width / 2), int(y * S - ch.height / 2)))
    d = ImageDraw.Draw(img, 'RGBA')
    # mission panel
    mp = Image.new('RGBA', (90 * S, 78 * S), (0, 0, 0, 0))
    md = ImageDraw.Draw(mp)
    md.rounded_rectangle([2 * S, 2 * S, 88 * S, 76 * S], radius=8 * S, fill=hexc(spec['panel']) + (255,), outline=(255, 245, 200, 255), width=2 * S)
    for i, name in enumerate(spec['mission_labels']):
        yy = 14 + i * 16
        md.ellipse([8 * S, (yy - 5.5) * S, 19 * S, (yy + 5.5) * S], fill=(30, 20, 20, 255), outline=(255, 255, 255, 255), width=int(1.3 * S))
        md.text((26 * S, yy * S), name, font=font(8.2), fill=(255, 255, 255, 255), anchor='lm', stroke_width=int(0.8 * S), stroke_fill=(60, 20, 0, 255))
    mp = mp.rotate(spec['panel_rot'], expand=True, resample=Image.BICUBIC)
    px, py = spec['panel_pos']
    th_ = math.radians(spec['panel_rot'])
    spec['mission_pts'] = []
    for i in range(4):
        dx, dy = 13.5 - 45, (14 + i * 16) - 39
        spec['mission_pts'].append((px + dx * math.cos(th_) + dy * math.sin(th_), py - dx * math.sin(th_) + dy * math.cos(th_)))
    img.alpha_composite(mp, (int(px * S - mp.width / 2), int(py * S - mp.height / 2)))
    d = ImageDraw.Draw(img, 'RGBA')


    # --- wedge borders, glossy bands
    for a0 in spec.get('borders', [200, 225, 250, 292, 318, 340]):
        a = math.radians(a0)
        p1 = (RING[0] + 92 * math.cos(a), RING[1] + 92 * math.sin(a))
        p2 = (RING[0] + 560 * math.cos(a), RING[1] + 560 * math.sin(a))
        d.line([P(*p1), P(*p2)], fill=(10, 10, 20, 200), width=int(4.5 * S))
        d.line([P(*p1), P(*p2)], fill=(255, 255, 255, 230), width=int(2 * S))
    for r_, a_ in [(130, 46), (190, 34), (250, 26)]:
        d.arc([P(RING[0] - r_, RING[1] - r_), P(RING[0] + r_, RING[1] + r_)], 182, 358, fill=(255, 255, 255, a_), width=int(3 * S))
    # --- big faint balls on the red apron zone
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for (bx_, by_, br_) in [(70, 690, 34), (294, 690, 34), (182, 676, 22)]:
        ball_icon(od, bx_, by_, br_)
    ov.putalpha(ov.split()[3].point(lambda v: int(v * 0.22)))
    img.alpha_composite(ov)
    d = ImageDraw.Draw(img, 'RGBA')
    # --- emblem hexagon with a red R in the bumper area
    ex, ey = spec['emblem']
    hexp = [P(ex + 36 * math.cos(math.radians(30 + 60 * k)), ey + 36 * math.sin(math.radians(30 + 60 * k))) for k in range(6)]
    d.polygon(hexp, fill=(14, 20, 60, 235), outline=(255, 255, 255, 255))
    hexq = [P(ex + 31 * math.cos(math.radians(30 + 60 * k)), ey + 31 * math.sin(math.radians(30 + 60 * k))) for k in range(6)]
    d.polygon(hexq, outline=hexc(spec['emblem_col']) + (255,))
    d.text(P(ex, ey + 1), 'R', font=font(40), fill=hexc(spec['emblem_col']) + (255,), anchor='mm', stroke_width=int(2 * S), stroke_fill=(255, 255, 255, 255))

    # --- tapered colour lanes pointing at the ring, with a badge at the far end
    sl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sl)
    for (ang, col, ic, rin, rout) in spec['strips']:
        a0 = math.radians(ang)
        def pt(r, da):
            return P(RING[0] + r * math.cos(a0 + math.radians(da)), RING[1] + r * math.sin(a0 + math.radians(da)))
        poly = [pt(rin, -3.6), pt(rout, -6.5), pt(rout, 6.5), pt(rin, 3.6)]
        sd.polygon(poly, fill=hexc(col) + (235,))
        sd.line(poly + [poly[0]], fill=(255, 255, 255, 255), width=int(1.6 * S))
        sd.line([pt(rin + 8, 0), pt(rout - 14, 0)], fill=(255, 255, 255, 120), width=int(1.2 * S))
    sl = sl.filter(ImageFilter.GaussianBlur(0.5))
    img.alpha_composite(sl)
    d = ImageDraw.Draw(img, 'RGBA')
    for (ang, col, ic, rin, rout) in spec['strips']:
        bx_ = RING[0] + (rout + 4) * math.cos(math.radians(ang))
        by_ = RING[1] + (rout + 4) * math.sin(math.radians(ang))
        plate(d, bx_, by_, 9.5, hexc(col) + (255,))
        ic(d, bx_, by_, 5, (255, 255, 255, 255))

    # --- scenery bits: lightning, grass, flames
    for (zx, zy, zc) in spec.get('bolts', []):
        pts = [P(zx, zy), P(zx - 9, zy + 16), P(zx + 2, zy + 16), P(zx - 10, zy + 38), P(zx + 14, zy + 10), P(zx + 3, zy + 10), P(zx + 12, zy - 6)]
        d.polygon(pts, fill=hexc(zc) + (230,), outline=(255, 255, 255, 255))
    for (gx, gy) in spec.get('grass', []):
        for k in range(5):
            d.polygon([P(gx + k * 5 - 3, gy), P(gx + k * 5, gy - 12 - (k % 2) * 5), P(gx + k * 5 + 3, gy)], fill=(40, 150, 50, 255), outline=(15, 70, 25, 255))
    for (fx_, fy_) in spec.get('flames', []):
        flame_icon(d, fx_, fy_, 7, (255, 140, 30, 255))
    # --- hazard signs
    for (sx_, sy_) in spec['signs']:
        d.polygon([P(sx_, sy_ - 9), P(sx_ + 10, sy_ + 8), P(sx_ - 10, sy_ + 8)], fill=(255, 215, 40, 255), outline=(20, 20, 20, 255))
        d.line([P(sx_ - 3, sy_ - 1), P(sx_ + 3, sy_ + 5)], fill=(20, 20, 20, 255), width=int(1.6 * S))
        d.line([P(sx_ + 3, sy_ - 1), P(sx_ - 3, sy_ + 5)], fill=(20, 20, 20, 255), width=int(1.6 * S))
    # --- logo on apron
    d.text(P(300, 779), 'POKÉMON', font=font(15), fill=(255, 205, 30, 255), anchor='mm', stroke_width=int(2.2 * S), stroke_fill=(30, 70, 170, 255))
    ball_icon(d, 52, 776, 9)
    # --- inserts plates (arrows etc) from spec
    inserts = []
    def ins(x, y, r, color, group, idx=0, shape='dot', rot=0):
        inserts.append(dict(x=x, y=y, r=r, color=color, group=group, idx=idx, shape=shape, rot=rot))
        plate(d, x, y, r, (20, 20, 30, 255), ring=hexc(color))
        if shape == 'dot':
            d.ellipse([P(x - r * 0.62, y - r * 0.62), P(x + r * 0.62, y + r * 0.62)], fill=hexc(color) + (90,))
    for i in range(5):
        ins(140 + i * 21, spec['mult_y'], 6.2, '#ffd23a', 'mult', i)
    for i in range(12):
        a = math.radians(-90 + i * 30)
        ins(cxr + 80 * math.cos(a), cyr + 80 * math.sin(a), 3.6, '#ffffff', 'ring', i)
    for i, (x, y) in enumerate(spec['arrows']):
        ins(x, y, 7, spec['arrow_color'], 'arrow', i)
    for i in range(4):
        px_, py_ = spec['mission_pts'][i]
        ins(px_, py_, 5.2, '#ffe45a', 'mission', i)
    for i in range(spec.get('amb', 16)):
        x, y = rnd.uniform(40, 330), rnd.uniform(320, 520)
        if abs(x - XC) < 20 and abs(y - spec['badge_y']) < 50:
            continue
        ins(x, y, 3.0, rnd.choice(['#ffffff', '#ffd23a', '#7fe9ff']), 'amb', i)
    # --- characters
    for (name, x, y, h, flip, kw) in spec['figs']:
        paste_fig(img, name, x, y, h, flip, **kw)
    d = ImageDraw.Draw(img, 'RGBA')
    # launch lane plate (dark) with chevrons + label
    lane = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lane)
    ld.rectangle([P(352, 205), P(384, 800)], fill=(10, 12, 20, 200))
    for y in range(230, 770, 40):
        ld.polygon([P(360, y + 10), P(369, y), P(378, y + 10), P(378, y + 15), P(369, y + 5), P(360, y + 15)], fill=hexc(spec['arrow_color']) + (170,))
    img.alpha_composite(lane)
    # vignette + final mask
    vg = Image.new('L', (W, H), 0)
    vd = ImageDraw.Draw(vg)
    vd.rectangle([0, 0, W, H], fill=0)
    vig = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.clip(((np.hypot((xx / W - 0.5) * 1.2, (yy / H - 0.5)) - 0.35) * 1.1), 0, 1)
    vig = Image.fromarray(np.dstack([np.zeros((H, W, 3), np.uint8), (v * 150).astype(np.uint8)]), 'RGBA')
    img.alpha_composite(vig)
    out = Image.new('RGBA', (W, H), (6, 6, 10, 255))
    out.paste(img, (0, 0), mask)
    out.convert('RGB').save(os.path.join(SCR, f'paint_{tid}.png'))
    with open(os.path.join(HERE, '..', 'art', f'inserts_{tid}.json'), 'w') as f:
        json.dump(inserts, f, separators=(',', ':'))
    print('painted', tid, len(inserts), 'inserts')


NEON = dict(
    id='neon', seed=4, night='#1b2a6e', sky=['#3a6bd8'], mode_y=300, bowl='#2d7fd6', ring='#e23636', apron='#d92b2b', badge_y=426, badge=('#e23636',),
    wedges=[(180, 200, '#1c6a2c', '#2f9a3c'), (200, 225, '#2fae45', '#58d04e'), (225, 250, '#1d62c8', '#2e86e6'), (250, 270, '#36a8f0', '#6ccaff'),
            (270, 292, '#1a2c78', '#27409c'), (292, 318, '#ffb52e', '#ffd666'), (318, 340, '#ff7a1c', '#ff9a3c'), (340, 360, '#d92b2b', '#f0503c'),
            (0, 60, '#b01e1e', '#d92b2b'), (60, 120, '#9a1818', '#c42626'), (120, 180, '#b01e1e', '#d92b2b')],
    lanes=[(137, '#2fa83c', leaf_icon), (182, '#2a7fe0', drop_icon), (227, '#f07a1c', flame_icon)],
    chevrons=[(46, 476, 0, '#ff9a2a'), (46, 452, 0, '#ff7a1c'), (46, 428, 0, '#ff5a1c'), (322, 350, 0, '#ff9a2a'), (322, 326, 0, '#ff7a1c')],
    arrows=[(46, 482), (46, 458), (46, 434), (322, 356), (322, 332), (322, 308)], arrow_color='#ff8a2a',
    emblem=(182, 242), emblem_col='#e23636', borders=[200, 225, 250, 292, 318, 340], strips=[(238, '#1f6fd8', drop_icon, 112, 232), (254, '#2fa8e8', eye_icon, 112, 236), (286, '#f0b020', bolt_icon, 112, 236), (302, '#e86a1c', flame_icon, 112, 232)], signs=[(78, 420), (286, 420), (44, 600), (320, 600)], bolts=[(296, 150, '#ffe14a'), (338, 190, '#ffe14a'), (40, 160, '#ffffff')], grass=[(24, 560), (24, 590), (60, 520), (36, 470)], flames=[(344, 540), (330, 575), (300, 440)], mult_y=372, panel='#f08a1c', panel_rot=-12, panel_pos=(300, 502), mission_labels=['DISCOVER', 'CATCH', 'TRAIN', 'BATTLE'],
    mission_pts=[(286 - 2, 478 + 2), (284, 494), (282, 510), (280, 526)],
    figs=[('meowth', 182, 74, 40, False, {}), ('pikachu', 322, 138, 56, True, {}), ('eevee', 94, 535, 46, False, {}),
          ('bulbasaur', 138, 628, 36, False, {}), ('squirtle', 182, 636, 40, False, {}), ('charmander', 226, 628, 38, True, {}),
          ('mewtwo', XC, 474, 74, False, dict(tint='#3a2478', alpha=0.7, shadow=False)), ('snorlax', 182, 800, 54, False, {})],
)
SPACE = dict(
    id='space', seed=9, night='#2a0f55', sky=['#7a3cff'], mode_y=300, bowl='#6a3cd0', ring='#b030d0', apron='#8a1fb0', badge_y=426, badge=('#7a2fd0',), psychic=True,
    wedges=[(180, 200, '#14305c', '#1f5090'), (200, 225, '#2a9cc0', '#58d0e8'), (225, 250, '#5a2fc0', '#8a5aef'), (250, 270, '#b02fd0', '#d870f0'),
            (270, 292, '#2a1068', '#40208c'), (292, 318, '#e83a8a', '#ff7ab0'), (318, 340, '#ff8a2a', '#ffb050'), (340, 360, '#7a1fa8', '#a83cd0'),
            (0, 60, '#601a8a', '#8a2ab0'), (60, 120, '#4a1470', '#701f9c'), (120, 180, '#601a8a', '#8a2ab0')],
    lanes=[(122, '#e8407a', bolt_icon), (162, '#f0c020', star_icon if False else bolt_icon), (202, '#38c0e8', eye_icon), (242, '#a050f0', flame_icon)],
    chevrons=[(318, 476, 0, '#ff5aa0'), (318, 452, 0, '#ff3a8a'), (46, 520, 0, '#ff9a2a'), (46, 498, 0, '#ff7a1c')],
    arrows=[(46, 526), (46, 504), (318, 482), (318, 458), (318, 434), (46, 548)], arrow_color='#ff5aa0',
    emblem=(182, 296), emblem_col='#c040f0', borders=[200, 225, 250, 292, 318, 340], strips=[(238, '#38c0e8', eye_icon, 112, 232), (254, '#e8407a', bolt_icon, 112, 236), (286, '#f07a1c', flame_icon, 112, 236), (302, '#a050f0', leaf_icon, 112, 232)], signs=[(78, 420), (286, 420), (44, 600), (320, 600)], bolts=[(330, 190, '#7ae8ff'), (296, 150, '#7ae8ff'), (50, 190, '#ff7ad8')], grass=[], flames=[(344, 560), (330, 590)], mult_y=350, panel='#c02a8a', panel_rot=12, panel_pos=(78, 502), mission_labels=['DISCOVER', 'CATCH', 'TRAIN', 'BATTLE'],
    mission_pts=[(56, 478 + 2), (58, 494), (60, 510), (62, 526)],
    figs=[('mewtwo', 182, 86, 54, False, {}), ('meowth', 326, 142, 50, True, {}), ('ditto', 300, 520, 26, False, {}),
          ('eevee', 140, 628, 38, False, {}), ('pikachu', 182, 636, 42, False, {}), ('squirtle', 226, 628, 36, True, {}),
          ('charmander', 70, 640, 30, False, {}), ('snorlax', 182, 800, 54, False, {})],
)

if __name__ == '__main__':
    for t in IDS:
        paint({'neon': NEON, 'space': SPACE}[t])
