"""Lobby cover for War Command (Comando de Guerra): blue squad vs red horde in a canyon,
with a golden statue hero and a column of +1 reinforcement crates.
Uses the same toy-soldier builder as the in-game sprites (games/squad/build/soldier.py)."""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from props import *  # noqa: E402  (rig + helpers; import before the game's build dir joins the path)

sys.path.append(os.path.join(HERE, '..', '..', 'games', 'squad', 'build'))
import soldier as SO  # noqa: E402
import common as CM  # noqa: E402

random.seed(7)
S = int(os.environ.get('SAMPLES', 128))
new_scene('#ffb35a', '#3a1208', samples=S)

objs = []
# road slab + curbs
road = glossy('#d8cab0', 0.7, 0.05, name='road')
objs.append(box((7.6, 7.4, 0.6), glossy('#b8875a', 0.85, 0.0, name='floor'), (0, 2.0, -0.32), bevel=0.1))
objs.append(box((4.3, 7.4, 0.12), road, (0, 2.0, 0.0), bevel=0.03))

# canyon pillars (CC0 scans, sandstone tint) behind both sides
try:
    for i, (name, x, y, rz) in enumerate((('rock_face_01', -3.1, 2.6, 20), ('rock_face_02', 3.1, 2.4, -30), ('mountainside', -3.0, 5.0, 0), ('rock_face_01', 3.1, 5.2, 190))):
        rk = CM.append_model(name, 'LOD2' if name == 'mountainside' else None)
        o = rk[0]
        for extra in rk[1:]:
            bpy.data.objects.remove(extra, do_unlink=True)
        d = o.dimensions
        o.scale = (2.6 / max(d.x, d.y), 2.6 / max(d.x, d.y), 7.5 / d.z)
        o.rotation_euler = (0, 0, math.radians(rz))
        bpy.context.view_layer.update()
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        o.location = (x - sum(v.x for v in bb) / 8, y - sum(v.y for v in bb) / 8, -0.05 - min(v.z for v in bb))
        for m in o.data.materials:
            nt = m.node_tree
            b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b and b.inputs['Base Color'].links:
                src = b.inputs['Base Color'].links[0].from_socket
                hs = nt.nodes.new('ShaderNodeHueSaturation')
                hs.inputs['Saturation'].default_value = 0.4
                hs.inputs['Value'].default_value = 1.8
                mix = nt.nodes.new('ShaderNodeMix')
                mix.data_type = 'RGBA'
                mix.blend_type = 'MULTIPLY'
                mix.inputs['Factor'].default_value = 1.0
                mix.inputs['B'].default_value = (1.0, 0.68, 0.42, 1)
                nt.links.new(src, hs.inputs['Color'])
                nt.links.new(hs.outputs['Color'], mix.inputs['A'])
                nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
        objs.append(o)
except Exception as e:  # models missing: the cover still works without walls
    print('WARN rocks', e)

# golden statue hero on a stone pedestal (left)
ped = glossy('#d9d5cd', 0.6, 0.1, name='ped')
objs.append(box((1.3, 1.3, 0.85), ped, (-1.45, 1.3, 0.42), bevel=0.05))
num = text('30', glossy('#ffffff', 0.4, 0.2, name='num'), size=0.55, extrude=0.03, loc=(-1.45, 0.64, 0.44), rot=(90, 0, 0))
objs.append(num)
st = SO.soldier(SO.PALETTES['blue'], 'hero_heavy', 1.05)
SO.stance(st)
CM.set_all_materials(st.root, CM.gold())
st.root.location = (-1.45, 1.3, 0.85)
st.root.rotation_euler = (0, 0, math.radians(25))
objs.append(st.root)

# +1 crates column (right)
c1 = glossy('#2f7dff', 0.25, 0.8, name='crate')
for i in range(5):
    y = -0.4 + i * 0.95
    objs.append(box((0.8, 0.5, 0.6), c1, (1.7, y, 0.3), bevel=0.06, rot=(-12, 0, 0)))
    objs.append(text('+1', glossy('#ffffff', 0.3, 0.3, name='plus'), size=0.34, extrude=0.02, loc=(1.7, y - 0.3, 0.36), rot=(78, 0, 0)))

# red horde charging from the back
for i in range(14):
    x = random.uniform(-1.0, 1.0)
    y = 2.6 + random.uniform(0, 3.0)
    kind = 'shield' if i % 4 == 0 else 'grunt'
    r = SO.soldier(SO.PALETTES['red'], kind, 0.72)
    SO.pose(r, random.random())
    r.root.location = (x, y, 0)
    objs.append(r.root)
bru = SO.soldier(dict(SO.PALETTES['red'], armor='#c81d33', cloth='#4a0b14', dark='#2a0a10', armor2='#ff5a6e'), 'brute', 0.95)
SO.pose(bru, 0.2, stride=24)
bru.root.location = (0.25, 3.6, 0)
objs.append(bru.root)

# blue squad in front, seen from behind, firing
fl = flame('#ffd27a', 4.0, 'muzzle')
trc = flame('#fff1b0', 3.0, 'tracer')
for i in range(7):
    a = i * 2.4
    rad = 0.38 * math.sqrt(i + 0.5)
    x = 0.1 + math.cos(a) * rad
    y = -0.9 + math.sin(a) * rad * 0.8
    r = SO.soldier(SO.PALETTES['blue'], 'grunt', 0.78)
    SO.pose(r, random.random())
    r.root.rotation_euler = (0, 0, math.pi)
    r.root.location = (x, y, 0)
    objs.append(r.root)
    objs.append(sphere(0.08, fl, loc=(x - 0.06, y + 0.7, 1.03), seg=12))
    objs.append(cylinder(0.02, 1.1, trc, loc=(x - 0.06, y + 1.8 + (i % 3) * 0.4, 1.06), rot=(90, 0, 0), bevel=0, seg=8))

# golden power-up ring on the road
objs.append(torus(0.5, 0.05, flame('#ffc21a', 2.2, 'ring'), loc=(-0.45, 0.6, 0.08)))

parent(objs, loc=(0, 0.2, 0.05), rot=(18, 0, 0), scale=0.98)
render('squad')
