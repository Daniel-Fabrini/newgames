"""Soldier / enemy / hero sprites for War Command (Comando de Guerra).

Run:  SQUAD_TMP=/tmp/sq $BLENDER -b --factory-startup -P games/squad/build/units.py [-- only=<prefix>]

Builds chunky toy-like armoured soldiers out of primitives with a tiny joint rig
(hips, legs, knees) and renders walk cycles from the game's camera angle:
  blue_*   player squad seen from behind (8 frames)
  red_*    enemy rifleman seen from the front (8)
  shd_*    enemy shield bearer (8)
  bru_*    enemy heavy / mini-boss (8)
  dead_*   grey corpse falling (4), dbru_* grey heavy falling (4)
  h<k>_statue / h<k>_live   golden statue + coloured hero, 3/4 front
  h<k>_*   hero walking from behind (6)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

ONLY = ''
if '--' in sys.argv:
    for a in sys.argv[sys.argv.index('--') + 1:]:
        if a.startswith('only='):
            ONLY = a[5:]

from soldier import PALETTES, soldier, pose, stance  # noqa: E402


def want(name):
    return not ONLY or name.startswith(ONLY)


def clear_scene():
    for o in list(bpy.context.scene.objects):
        if o.type not in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(o, do_unlink=True)


PPM = 64  # pixels per metre for normal units
N = 8

# ---------------------------------------------------------------- player squad (from behind)
reset(world_strength=1.0, sun=3.2, hdri=1.0)
if want('blue'):
    r = soldier(PALETTES['blue'])
    r.root.rotation_euler = (0, 0, math.pi)
    BP = 90
    camera(BP, 124, 186, look=(0, 0, 0.92))
    for i in range(N):
        pose(r, i / N)
        shoot(f'blue_{i}', BP)
    clear_scene()

# ---------------------------------------------------------------- enemies (facing camera)
if want('red'):
    r = soldier(PALETTES['red'])
    camera(PPM, 88, 132, look=(0, -0.1, 0.92))
    for i in range(N):
        pose(r, i / N)
        shoot(f'red_{i}', PPM)
    clear_scene()
if want('shd'):
    r = soldier(PALETTES['red'], 'shield')
    camera(PPM, 88, 132, look=(0, -0.1, 0.92))
    for i in range(N):
        pose(r, i / N, stride=26)
        shoot(f'shd_{i}', PPM)
    clear_scene()
if want('bru'):
    pal = dict(PALETTES['red'], armor='#c81d33', cloth='#4a0b14', dark='#2a0a10', armor2='#ff5a6e')
    r = soldier(pal, 'brute', 1.35)
    camera(PPM, 150, 210, look=(0, -0.3, 1.3))
    for i in range(N):
        pose(r, i / N, stride=24, knee=35, bob=0.05)
        shoot(f'bru_{i}', PPM)
    clear_scene()

# ---------------------------------------------------------------- corpses falling backwards, grey
if want('dead'):
    for kind, nm, sc, cw, ch, lk in (('grunt', 'dead', 1.0, 180, 130, (0.75, 0.0, 0.55)), ('brute', 'dbru', 1.35, 280, 210, (1.0, 0.0, 0.8))):
        r = soldier(PALETTES['grey'], kind, sc)
        camera(PPM, cw, ch, look=lk)
        pose(r, 0.1)
        for i, ang in enumerate((18, 45, 70, 88)):
            r.root.rotation_euler = (math.radians(-10), math.radians(ang), 0)
            r.root.location = (0.1 * i, 0.05 * i, 0)
            bpy.context.view_layer.update()
            shoot(f'{nm}_{i}', PPM)
        clear_scene()

# ---------------------------------------------------------------- heroes
HEROES = {
    'gunner': ('hero_gunner', dict(PALETTES['blue'], armor='#3b6fe0', cloth='#5b5a3c', armor2='#8fc0ff', hair='#3a2416')),
    'heavy': ('hero_heavy', dict(PALETTES['blue'], armor='#2a5fd6', cloth='#263459', armor2='#ffd34d')),
    'rocket': ('hero_rocket', dict(PALETTES['blue'], armor='#1f8f6a', cloth='#2c3f36', armor2='#ffd34d', dark='#1a2a24')),
}
HPPM = 120
for k, (kind, pal) in HEROES.items():
    if not want('h' + k):
        continue
    # statue / live: 3/4 front, wide stance, turned toward the road centre (+X)
    for variant in ('live', 'statue'):
        r = soldier(pal, kind, 1.25)
        stance(r)
        r.root.rotation_euler = (0, 0, math.radians(18))
        if variant == 'statue':
            set_all_materials(r.root, gold())
        camera(HPPM, 300, 354, look=(0.1, -0.2, 1.15))
        shoot(f'h{k}_{variant}', HPPM)
        clear_scene()
    # walking with the squad, seen from behind
    r = soldier(pal, kind, 1.25)
    r.root.rotation_euler = (0, 0, math.pi)
    camera(96, 204, 284, look=(0, 0.2, 1.15))
    for i in range(6):
        pose(r, i / 6, stride=26)
        shoot(f'h{k}_{i}', 96)
    clear_scene()
print('UNITS DONE')
