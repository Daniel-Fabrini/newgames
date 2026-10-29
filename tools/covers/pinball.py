import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *
from rig import _mat
import bpy

# Pokemon-themed pinball machine: the real pre-rendered playfield (games/pinball/art/base_neon.webp) on a tilted cabinet slab.
new_scene('#4a7bff', '#0a1240', samples=int(os.environ.get('S', 128)))
ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'games', 'pinball', 'art', 'base_neon.webp')
tex_mat = image_material(ART, 0.3, 0.6, name='field')
_n = tex_mat.node_tree
_b = _n.nodes['Principled BSDF']
_t = [n for n in _n.nodes if n.type == 'TEX_IMAGE'][0]
_n.links.new(_t.outputs['Color'], _b.inputs['Emission Color'])
_b.inputs['Emission Strength'].default_value = 0.75
gold = glossy('#f0be3a', 0.25, 0.7, name='gold')
dark = glossy('#15151f', 0.35, 0.5, name='cab')
red = glossy('#e8262c', 0.15, 0.9, name='pbred')
white = glossy('#f6f6fa', 0.15, 0.9, name='pbwhite')
black = glossy('#101018', 0.25, 0.7, name='pbblack')
steel = metal('#d9dfe8', 0.08, name='steel')
objs = []
FW, FH = 2.6, 5.2
objs.append(box((FW + 0.5, FH + 0.5, 0.3), dark, loc=(0, 0, 0), bevel=0.12))
objs.append(plane((FW, FH), tex_mat, loc=(0, 0, 0.17)))
for sx in (-1, 1):
    objs.append(box((0.14, FH + 0.5, 0.45), gold, loc=(sx * (FW / 2 + 0.28), 0, 0.12), bevel=0.05))
objs.append(box((FW + 0.7, 0.14, 0.45), gold, loc=(0, FH / 2 + 0.28, 0.12), bevel=0.05))
objs.append(box((FW + 0.7, 0.14, 0.45), gold, loc=(0, -FH / 2 - 0.28, 0.12), bevel=0.05))
g = parent(objs, rot=(52, 0, 7))
# big Poke Ball hero in front of the table
bx, by, bz, br = -1.9, -2.5, 1.0, 0.95
objs2 = [sphere(br, white, loc=(bx, by, bz))]
cap = sphere(br * 1.003, red, loc=(bx, by, bz))
objs2.append(cap)
# cut the red sphere to the upper half by scaling a box mask? simple approach: stack hemisphere via cone-less trick
bpy.ops.mesh.primitive_uv_sphere_add(radius=br * 1.01, segments=64, ring_count=32, location=(bx, by, bz))
half = bpy.context.active_object
half.data.materials.append(red)
import bmesh
bm = bmesh.new()
bm.from_mesh(half.data)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
bm.to_mesh(half.data)
bm.free()
for p in half.data.polygons:
    p.use_smooth = True
bpy.data.objects.remove(cap, do_unlink=True)
band = torus(br * 1.005, 0.07, black, loc=(bx, by, bz))
btn = cylinder(0.26, 0.12, white, loc=(bx, by - br * 0.97, bz), rot=(90, 0, 0), bevel=0.02)
ring = torus(0.27, 0.06, black, loc=(bx, by - br * 0.97, bz), rot=(90, 0, 0))
sphere(0.34, steel, loc=(1.9, -2.7, 0.7))
podium('#c9971c', 4.2, 0.5, z=-2.4)
fit(0.72, 0.55)
render('pinball')
