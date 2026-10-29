# python3 pack.py <scratch> <id>...  -> converts the Blender renders into the shipped WebP files in ../art
import sys, os
from PIL import Image, ImageEnhance
scr = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
for tid in sys.argv[2:]:
    out = os.path.join(here, '..', 'art')
    im = Image.open(os.path.join(scr, f'table_{tid}_base.png')).convert('RGB').resize((800, 1600), Image.LANCZOS)
    im = ImageEnhance.Color(ImageEnhance.Contrast(im).enhance(1.14)).enhance(1.2)
    im.save(os.path.join(out, f'base_{tid}.webp'), 'WEBP', quality=80, method=6)
    rp = Image.open(os.path.join(scr, f'table_{tid}_ramp.png')).convert('RGBA').resize((800, 1600), Image.LANCZOS)
    rp.save(os.path.join(out, f'ramp_{tid}.webp'), 'WEBP', quality=82, method=6, alpha_quality=90)
    sp = Image.open(os.path.join(scr, f'sprites_{tid}.png')).convert('RGBA')
    sp.save(os.path.join(out, f'sprites_{tid}.webp'), 'WEBP', quality=90, method=6, alpha_quality=100)
    for n in (f'base_{tid}.webp', f'ramp_{tid}.webp', f'sprites_{tid}.webp', f'inserts_{tid}.json'):
        p = os.path.join(out, n)
        print(n, os.path.getsize(p) // 1024, 'KB' if os.path.exists(p) else 'missing')
