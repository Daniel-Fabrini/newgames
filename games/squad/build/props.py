"""Props + canyon sprites for War Command.

Run:  SQUAD_TMP=/tmp/sq $BLENDER -b --factory-startup -P games/squad/build/props.py [-- only=<prefix>]

  ped_big / ped_small   stone pedestals (number drawn by the game on the front face)
  crate                 blue reinforcement block (+N drawn by the game)
  w0..w4                weapon pickups (smg, rifle, lmg, minigun, plasma)
  ring                  golden power-up ring lying on the road
  rock0..rock5          canyon wall pillars (Poly Haven CC0 scans, tinted sandstone)
  stone0..stone1        small boulders for the road side
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


def want(n):
    return not ONLY or n.startswith(ONLY)


def clear_scene():
    for o in list(bpy.context.scene.objects):
        if o.type not in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(o, do_unlink=True)


reset()
STONE = mat('stone', '#d8d4cc', rough=0.7, coat=0.0)
STONE2 = mat('stone2', '#b9b4aa', rough=0.75, coat=0.0)

# ---------------------------------------------------------------- pedestals
if want('ped'):
    for nm, w, h, ppm in (('ped_big', 1.9, 1.15, 64), ('ped_small', 1.15, 0.75, 64)):
        box((w, w, h), (0, 0, h / 2), STONE, bevel=0.07)
        box((w * 1.04, w * 1.04, 0.1), (0, 0, 0.05), STONE2, bevel=0.03)
        box((w * 0.96, w * 0.96, 0.06), (0, 0, h - 0.0), STONE2, bevel=0.025)
        camera(ppm, int(w * ppm * 1.25), int((h * 0.8 + w * 0.62) * ppm * 1.2), look=(0, 0, h * 0.45))
        shoot(nm, ppm, {'face': (0, -w / 2, h * 0.47), 'top': (0, 0, h)})
        clear_scene()

# ---------------------------------------------------------------- crate (+N block)
if want('crate'):
    B1 = mat('crate', '#2f7dff', rough=0.25, coat=0.8)
    B2 = mat('crate2', '#8cc4ff', rough=0.2, coat=0.8)
    box((1.3, 0.75, 0.85), (0, 0, 0.425), B1, bevel=0.09)
    box((1.18, 0.05, 0.7), (0, -0.37, 0.43), B2, bevel=0.03)
    box((1.1, 0.06, 0.62), (0, -0.39, 0.43), B1, bevel=0.03)
    camera(64, 110, 100, look=(0, 0, 0.45))
    shoot('crate', 64, {'face': (0, -0.42, 0.43)})
    clear_scene()

# ---------------------------------------------------------------- weapons
GM = mat('gunmetal', '#2d3240', rough=0.3, metal=0.6)
GM2 = mat('gunlight', '#8b93a6', rough=0.25, metal=0.8)
ACC = mat('gunblue', '#2f7dff', rough=0.25, coat=0.6)
ACCY = mat('gunyellow', '#ffc23a', rough=0.25, coat=0.6)
GLOW = mat('plasma', '#5ff3ff', rough=0.2, emit='#5ff3ff', estr=6)


def gun(kind):
    root = empty('gun', (0, 0, 0))
    if kind == 0:  # smg
        box((0.55, 0.08, 0.14), (0, 0, 0), ACC, root, bevel=0.02)
        box((0.18, 0.07, 0.1), (-0.34, 0, 0.0), GM, root, bevel=0.02)
        cyl(0.025, 0.25, (0.38, 0, 0.03), GM2, root, rot=(0, 90, 0), seg=12)
        box((0.07, 0.06, 0.28), (0.08, 0, -0.18), GM, root, rot=(0, -8, 0))
        box((0.06, 0.06, 0.16), (-0.12, 0, -0.12), GM, root, rot=(0, 15, 0))
    elif kind == 1:  # assault rifle
        box((0.7, 0.08, 0.13), (0, 0, 0), GM, root, bevel=0.02)
        box((0.32, 0.07, 0.12), (-0.48, 0, -0.03), ACC, root, bevel=0.02)
        box((0.3, 0.085, 0.09), (0.28, 0, 0.0), ACC, root, bevel=0.02)
        cyl(0.022, 0.42, (0.62, 0, 0.03), GM2, root, rot=(0, 90, 0), seg=12)
        box((0.08, 0.06, 0.26), (0.1, 0, -0.17), GM, root, rot=(0, -22, 0))
        box((0.06, 0.06, 0.14), (-0.14, 0, -0.11), GM, root, rot=(0, 15, 0))
    elif kind == 2:  # lmg
        box((0.85, 0.1, 0.16), (0, 0, 0), GM, root, bevel=0.02)
        box((0.3, 0.09, 0.14), (-0.55, 0, -0.03), ACCY, root, bevel=0.02)
        cyl(0.04, 0.6, (0.72, 0, 0.03), GM2, root, rot=(0, 90, 0), seg=12)
        box((0.2, 0.16, 0.18), (0.05, 0.05, -0.15), ACCY, root, bevel=0.02)
        box((0.32, 0.1, 0.05), (0.15, 0, 0.12), GM2, root, bevel=0.01)
    elif kind == 3:  # minigun
        for i in range(6):
            a = i * math.pi / 3
            cyl(0.028, 0.95, (0.35, 0.06 * math.cos(a), 0.06 * math.sin(a)), GM2, root, rot=(0, 90, 0), seg=10)
        cyl(0.12, 0.32, (-0.1, 0, 0), ACCY, root, rot=(0, 90, 0), seg=20, bevel=0.02)
        box((0.3, 0.2, 0.2), (-0.38, 0, -0.02), GM, root, bevel=0.04)
        cyl(0.11, 0.05, (0.82, 0, 0), GM, root, rot=(0, 90, 0), seg=20)
    else:  # plasma cannon
        cyl(0.11, 0.8, (0.05, 0, 0), ACC, root, rot=(0, 90, 0), seg=24, bevel=0.02)
        for x in (-0.15, 0.1, 0.35):
            torus(0.12, 0.025, (x, 0, 0), GM2, root, rot=(0, 90, 0))
        cyl(0.06, 0.82, (0.06, 0, 0), GLOW, root, rot=(0, 90, 0), seg=16)
        cyl(0.13, 0.12, (0.5, 0, 0), GM, root, rot=(0, 90, 0), seg=24, r2=0.07)
        box((0.25, 0.08, 0.2), (-0.25, 0, -0.17), GM, root, bevel=0.03)
    return root


for k in range(5):
    if not want(f'w{k}'):
        continue
    g = gun(k)
    g.scale = (1.15, 1.7, 1.7)
    g.rotation_euler = (math.radians(10), math.radians(-12), math.radians(-28))
    g.location = (0, 0, 0)
    camera(96, 150, 104, look=(0.05, 0, 0))
    shoot(f'w{k}', 96)
    clear_scene()

# ---------------------------------------------------------------- power-up ring
if want('ring'):
    G = mat('ringgold', '#ffb51f', rough=0.25, metal=0.7, emit='#ff9d00', estr=0.8)
    torus(1.25, 0.09, (0, 0, 0.06), G)
    torus(0.95, 0.035, (0, 0, 0.04), mat('ringglow', '#ffd75a', emit='#ffc21a', estr=1.5))
    camera(64, 190, 130, look=(0, 0, 0.05))
    shoot('ring', 64)
    clear_scene()


# ---------------------------------------------------------------- canyon pillars (CC0 scans)
def sandstone(objs, tint=(1.0, 0.7, 0.45), bright=1.9):
    for o in objs:
        for m in o.data.materials:
            if not m or not m.use_nodes:
                continue
            nt = m.node_tree
            b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if not b or not b.inputs['Base Color'].links:
                continue
            src = b.inputs['Base Color'].links[0].from_socket
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Saturation'].default_value = 0.35
            hs.inputs['Value'].default_value = bright
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            mix.inputs['B'].default_value = (*tint, 1)
            nt.links.new(src, hs.inputs['Color'])
            nt.links.new(hs.outputs['Color'], mix.inputs['A'])
            nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])


ROCKS = [
    ('rock_face_01', None, 0, 1.0),
    ('rock_face_02', None, 15, 1.0),
    ('mountainside', 'LOD2', 0, 1.0),
    ('namaqualand_cliff_01', 'LOD2', 0, 1.0),
    ('rock_face_01', None, 160, 1.0),
    ('mountainside', 'LOD2', 200, 1.0),
]
for i, (name, lod, rz, _) in enumerate(ROCKS):
    if not want(f'rock{i}'):
        continue
    reset(world_color='#e9d6bd', world_strength=0.8, sun=4.5, sun_dir=(-40, 0, -25), rim=0.8)
    objs = append_model(name, lod)
    if not objs:
        print('MISSING', name)
        continue
    o = objs[0]
    for x in objs[1:]:
        bpy.data.objects.remove(x, do_unlink=True)
    o.location = (0, 0, 0)
    o.rotation_euler = (0, 0, math.radians(rz))
    bpy.context.view_layer.update()
    # normalise: ~6.5 m wide, 15 m tall pillar, base on the ground
    d = o.dimensions
    o.scale = (6.0 / max(d.x, d.y), 6.0 / max(d.x, d.y), 21.0 / d.z)
    bpy.context.view_layer.update()
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    cx = sum(v.x for v in bb) / 8
    cy = sum(v.y for v in bb) / 8
    mz = min(v.z for v in bb)
    o.location = (-cx, -cy, -mz)
    sandstone([o])
    camera(36, 330, 760, look=(0, 0, 9.5))
    shoot(f'rock{i}', 36)
    clear_scene()

for i, (name, rz) in enumerate((('namaqualand_boulder_02', 30), ('namaqualand_boulder_02', 200))):
    if not want(f'stone{i}'):
        continue
    reset(world_color='#e9d6bd', world_strength=0.8, sun=4.5, rim=0.8)
    objs = append_model(name, 'LOD2')
    o = objs[0]
    for x in objs[1:]:
        bpy.data.objects.remove(x, do_unlink=True)
    o.rotation_euler = (0, 0, math.radians(rz))
    o.scale = (0.7, 0.7, 0.9)
    bpy.context.view_layer.update()
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    o.location = (-sum(v.x for v in bb) / 8, -sum(v.y for v in bb) / 8, -min(v.z for v in bb))
    sandstone([o])
    camera(64, 130, 80, look=(0, 0, 0.3))
    shoot(f'stone{i}', 64)
    clear_scene()
print('PROPS DONE')
