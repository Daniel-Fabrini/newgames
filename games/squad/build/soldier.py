"""Toy-soldier builder shared by units.py (game sprites) and tools/covers/squad.py (lobby cover)."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

PALETTES = {
    'blue': dict(armor='#2f74ff', armor2='#7cb6ff', dark='#1d2f66', cloth='#2a4ea6', skin='#e3a27c', visor='#0c1630', gun='#2b2f38', gun2='#9aa3b5', pack='#18306b'),
    'red': dict(armor='#e8273d', armor2='#ff7286', dark='#7a0f1d', cloth='#8f1424', skin='#d99472', visor='#2a0710', gun='#2b2a2e', gun2='#77707a', pack='#8a1020'),
    'grey': dict(armor='#9c9a98', armor2='#c4c1bd', dark='#5d5b5a', cloth='#6f6d6b', skin='#a8a6a4', visor='#3d3c3b', gun='#575656', gun2='#8a8888', pack='#6f6d6b'),
}


def M(pal, key, **kw):
    c = pal[key]
    rough = kw.pop('rough', 0.42 if key in ('cloth', 'dark', 'pack') else 0.3)
    return mat(f'{key}_{c}', c, rough=rough, coat=kw.pop('coat', 0.45 if key.startswith('armor') else 0.1), **kw)


class Rig:
    pass


def soldier(pal, kind='grunt', s=1.0):
    """Build a soldier facing -Y with feet at the origin. Returns a Rig of joints."""
    r = Rig()
    W = 1.0
    bulk = 1.0
    if kind == 'brute':
        W, bulk = 1.35, 1.3
    if kind.startswith('hero'):
        W, bulk = 1.15, 1.12
    A, A2, DK, CL, SK, VI, GN, GN2, PK = (M(pal, k) for k in ('armor', 'armor2', 'dark', 'cloth', 'skin', 'visor', 'gun', 'gun2', 'pack'))
    root = empty('root', (0, 0, 0))
    hips = empty('hips', (0, 0, 0.9), root)
    torso = empty('torso', (0, 0, 0.95), hips)
    r.root, r.hips, r.torso = root, hips, torso
    # legs
    r.thigh, r.shin = {}, {}
    for sd in (-1, 1):
        x = 0.12 * sd * W
        th = empty(f'thigh{sd}', (x, 0, 0.9), hips)
        sh = empty(f'shin{sd}', (x, 0, 0.5), th)
        limb((x, 0, 0.88), (x, 0, 0.52), 0.1 * bulk, CL, th)
        box((0.2 * bulk, 0.2, 0.2), (x, -0.06, 0.7), A, th, bevel=0.05)  # thigh plate
        limb((x, 0, 0.5), (x, 0.01, 0.14), 0.085 * bulk, CL, sh)
        box((0.2 * bulk, 0.12, 0.26), (x, -0.07, 0.33), A, sh, bevel=0.05)  # shin guard
        box((0.19 * bulk, 0.32, 0.14), (x, -0.05, 0.07), DK, sh, bevel=0.05)  # boot
        r.thigh[sd], r.shin[sd] = th, sh
    # pelvis / belt
    box((0.42 * W, 0.28 * bulk, 0.2), (0, 0, 0.93), DK, torso, bevel=0.06)
    # torso
    tz = 1.24
    box((0.52 * W, 0.34 * bulk, 0.5), (0, 0, tz), CL, torso, bevel=0.1)
    box((0.5 * W, 0.12, 0.42), (0, -0.14 * bulk, tz + 0.03), A, torso, bevel=0.08)  # chest plate
    box((0.3 * W, 0.06, 0.12), (0, -0.21 * bulk, tz - 0.1), A2, torso, bevel=0.03)  # plate highlight
    box((0.48 * W, 0.12, 0.4), (0, 0.13 * bulk, tz + 0.02), A, torso, bevel=0.08)  # back plate
    if kind != 'brute':
        box((0.36 * W, 0.18, 0.36), (0, 0.24 * bulk, tz + 0.02), PK, torso, bevel=0.06)  # backpack
        box((0.3 * W, 0.08, 0.1), (0, 0.33 * bulk, tz + 0.12), A2, torso, bevel=0.03)
    # shoulder pads
    for sd in (-1, 1):
        ball(0.15 * bulk, (0.31 * W * sd, 0, tz + 0.2), A, torso, scale=(1.1, 1.1, 0.78))
        ball(0.09 * bulk, (0.33 * W * sd, -0.02, tz + 0.27), A2, torso, scale=(1, 1, 0.5))
    # head
    hz = tz + 0.45
    ball(0.08, (0, 0, hz - 0.12), SK, torso)  # neck
    if kind == 'hero_gunner':
        ball(0.19, (0, 0, hz), SK, torso, scale=(0.95, 1, 1.08))
        ball(0.19, (0, 0.03, hz + 0.06), M(pal, 'hair', rough=0.6) if 'hair' in pal else DK, torso, scale=(1.0, 1.0, 0.75))  # hair
        ball(0.15, (0, -0.06, hz - 0.1), M(pal, 'hair', rough=0.6) if 'hair' in pal else DK, torso, scale=(1.05, 0.9, 0.85))  # beard
        box((0.3, 0.04, 0.04), (0, -0.18, hz + 0.05), DK, torso, bevel=0.01)  # brows
    else:
        ball(0.17, (0, 0, hz), SK, torso)
        helm = ball(0.215 * (1.1 if kind == 'brute' else 1), (0, 0.01, hz + 0.05), A, torso, scale=(1, 1.05, 0.88))
        torus(0.2 * (1.1 if kind == 'brute' else 1), 0.035, (0, 0.01, hz + 0.0), A2, torso)
        box((0.3, 0.08, 0.1), (0, -0.17, hz + 0.0), VI, torso, bevel=0.035)  # visor
        if kind == 'hero_rocket':
            box((0.06, 0.06, 0.18), (0.16, 0, hz + 0.2), A2, torso)  # antenna
    # weapon + arms
    sh_z = tz + 0.17
    if kind == 'shield':
        # big riot shield held in front by the left arm, pistol in the right hand
        shield = box((0.62, 0.07, 0.86), (-0.05, -0.42, 1.0), A, torso, bevel=0.05)
        box((0.5, 0.075, 0.12), (-0.05, -0.425, 1.24), A2, torso, bevel=0.02)
        box((0.16, 0.08, 0.06), (-0.05, -0.43, 1.32), VI, torso, bevel=0.02)  # view slot
        limb((-0.31, 0, sh_z), (-0.26, -0.22, 1.12), 0.07, CL, torso)
        limb((0.31, 0, sh_z), (0.26, -0.2, 1.12), 0.07, CL, torso)
        limb((0.26, -0.2, 1.12), (0.22, -0.42, 1.2), 0.065, CL, torso)
        box((0.07, 0.24, 0.09), (0.22, -0.52, 1.22), GN, torso, bevel=0.015)
    elif kind == 'brute' or kind == 'hero_heavy':
        # minigun at the hip
        gx, gz = 0.12, 1.02
        for i in range(6):
            a = i * math.pi / 3
            cyl(0.03, 0.8, (gx + 0.07 * math.cos(a), -0.6, gz + 0.07 * math.sin(a)), GN, torso, rot=(90, 0, 0), seg=10)
        cyl(0.13, 0.36, (gx, -0.22, gz), GN2, torso, rot=(90, 0, 0), seg=20, bevel=0.02)
        cyl(0.11, 0.06, (gx, -0.95, gz), GN2, torso, rot=(90, 0, 0), seg=20)
        box((0.24, 0.3, 0.22), (gx + 0.05, -0.05, gz - 0.02), GN, torso, bevel=0.04)
        box((0.18, 0.2, 0.2), (gx + 0.2, 0.1, gz - 0.16), A, torso, bevel=0.03)  # ammo box
        limb((0.32 * W, 0, sh_z), (0.36 * W, -0.05, gz + 0.08), 0.085 * bulk, CL, torso)
        limb((0.36 * W, -0.05, gz + 0.08), (0.22, -0.3, gz + 0.12), 0.08 * bulk, A, torso)
        limb((-0.32 * W, 0, sh_z), (-0.3 * W, -0.25, gz + 0.12), 0.085 * bulk, CL, torso)
        limb((-0.3 * W, -0.25, gz + 0.12), (0.05, -0.45, gz + 0.14), 0.08 * bulk, A, torso)
    elif kind == 'hero_rocket':
        # launcher tube on the right shoulder
        cyl(0.11, 1.25, (0.26, -0.15, sh_z + 0.18), A, torso, rot=(90, 0, 0), seg=20, bevel=0.01)
        cyl(0.13, 0.12, (0.26, -0.8, sh_z + 0.18), DK, torso, rot=(90, 0, 0), seg=20)
        cyl(0.13, 0.14, (0.26, 0.48, sh_z + 0.18), DK, torso, rot=(90, 0, 0), seg=20)
        cyl(0.08, 0.12, (0.26, -0.88, sh_z + 0.18), M(pal, 'gun2'), torso, rot=(90, 0, 0), seg=16, r2=0.02)
        box((0.07, 0.12, 0.18), (0.26, -0.3, sh_z + 0.03), GN, torso)
        limb((0.32 * W, 0, sh_z), (0.36, -0.15, sh_z - 0.22), 0.08, CL, torso)
        limb((0.36, -0.15, sh_z - 0.22), (0.27, -0.32, sh_z + 0.02), 0.075, A, torso)
        limb((-0.32 * W, 0, sh_z), (-0.14, -0.28, sh_z - 0.15), 0.08, CL, torso)
        limb((-0.14, -0.28, sh_z - 0.15), (0.2, -0.55, sh_z + 0.1), 0.075, A, torso)
    else:
        # assault rifle held at chest height, pointing forward (-Y)
        big = 1.25 if kind == 'hero_gunner' else 1.0
        gz = 1.3
        box((0.08 * big, 0.62 * big, 0.12 * big), (0.08, -0.42, gz), GN, torso, bevel=0.015)
        box((0.06 * big, 0.2, 0.1 * big), (0.08, -0.04, gz - 0.02), GN, torso, bevel=0.015)  # stock
        cyl(0.025 * big, 0.36 * big, (0.08, -0.86 * big + 0.1, gz + 0.02), GN2, torso, rot=(90, 0, 0), seg=10)
        box((0.06, 0.08, 0.2 * big), (0.08, -0.44, gz - 0.13), GN, torso, rot=(15, 0, 0))  # magazine
        box((0.05, 0.16, 0.05), (0.08, -0.5, gz + 0.09), GN2, torso, bevel=0.01)  # sight
        limb((0.31 * W, 0, sh_z), (0.3, -0.14, gz - 0.12), 0.072 * bulk, CL, torso)
        limb((0.3, -0.14, gz - 0.12), (0.1, -0.22, gz - 0.02), 0.066 * bulk, A, torso)
        limb((-0.31 * W, 0, sh_z), (-0.24, -0.26, gz - 0.12), 0.072 * bulk, CL, torso)
        limb((-0.24, -0.26, gz - 0.12), (0.06, -0.56, gz - 0.03), 0.066 * bulk, A, torso)
    root.scale = (s, s, s)
    return r


def pose(r, p, stride=32, knee=45, bob=0.035, lean=6):
    """Walk cycle at phase p in [0,1)."""
    a = math.sin(2 * math.pi * p)
    for sd in (-1, 1):
        sw = a * sd
        r.thigh[sd].rotation_euler = (math.radians(-stride * sw), 0, 0)
        # knee bends while the leg swings forward (lifted)
        lift = max(0.0, math.sin(2 * math.pi * p + (0 if sd > 0 else math.pi) + 0.6))
        r.shin[sd].rotation_euler = (math.radians(knee * lift), 0, 0)
    r.hips.location = (0, 0, 0.9 + bob * abs(math.cos(2 * math.pi * p)) - bob * 0.5)
    r.torso.rotation_euler = (math.radians(-lean), 0, math.radians(4 * a))
    bpy.context.view_layer.update()


def stance(r):
    """Planted, upright aiming stance for statues (legs spread sideways)."""
    r.thigh[-1].rotation_euler = (math.radians(-3), math.radians(-11), 0)
    r.thigh[1].rotation_euler = (math.radians(3), math.radians(11), 0)
    r.shin[-1].rotation_euler = (0, math.radians(6), 0)
    r.shin[1].rotation_euler = (0, math.radians(-6), 0)
    r.hips.location = (0, 0, 0.885)
    r.torso.rotation_euler = (math.radians(4), 0, math.radians(-6))
    bpy.context.view_layer.update()


