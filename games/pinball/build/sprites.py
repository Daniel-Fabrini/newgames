# Blender: renders the live-sprite sheet (flipper, drop target, chrome ball) top-down on transparency, 2 px per table unit.
#   TID=neon COVER_TMP=<scratch> blender -b -P sprites.py  ->  <scratch>/sprites_<id>.png (640x160)
import os, sys, math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'tools', 'covers')))
import bpy, bmesh
from mathutils import Vector
from rig import glossy, metal, cylinder, sphere

TID = os.environ.get('TID', 'neon')
SCR = os.environ.get('COVER_TMP', '/tmp')
SAMPLES = int(os.environ.get('S', 96))
U = 0.01
FL = {'neon': ('#d8202c', '#ffffff'), 'space': ('#7a2fd0', '#ffd23a')}[TID]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 640, 160
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
nt = w.node_tree
nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputWorld')
bgn = nt.nodes.new('ShaderNodeBackground')
tc = nt.nodes.new('ShaderNodeTexCoord')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
ramp = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'], sep.inputs[0])
nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].position = 0.35
ramp.color_ramp.elements[0].color = (0.95, 0.97, 1.0, 1)
ramp.color_ramp.elements[1].position = 0.9
ramp.color_ramp.elements[1].color = (0.05, 0.08, 0.2, 1)
nt.links.new(ramp.outputs['Color'], bgn.inputs['Color'])
bgn.inputs['Strength'].default_value = 1.4
nt.links.new(bgn.outputs[0], out.inputs[0])


def light(kind, loc, energy, size=1.0, color=(1, 1, 1), angle=None):
    d = bpy.data.lights.new('l', kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size
    o = bpy.data.objects.new('l', d)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0.5, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


light('SUN', (-2, 2, 6), 3.0)
light('AREA', (-0.4, 0.4, 2.0), 160, size=1.0)
cd = bpy.data.cameras.new('cam')
cd.type = 'ORTHO'
cd.ortho_scale = 3.2
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = (0, 0, 8)
cam.rotation_euler = (0, 0, 0)


def P(ux, uy, z=0.0):  # sheet unit coords (0..320, 0..80; y down) -> world
    return ((ux - 160) * U, (40 - uy) * U, z)


def hull_obj(points, mat, name='h'):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in points]
    bmesh.ops.convex_hull(bm, input=vs)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def capsule_pts(x0, y0, r0, x1, y1, r1, z0, z1, n=28):
    pts = []
    for (cx, cy, r) in ((x0, y0, r0), (x1, y1, r1)):
        for k in range(n):
            a = 2 * math.pi * k / n
            for z in (z0, z1):
                pts.append((cx + r * U * math.cos(a), cy + r * U * math.sin(a), z))
    return pts


# ---- flipper: pivot at sheet unit (32,40), pointing +x, length 60, radii 9 -> 5.5
px, py, _ = P(32, 40)
tx = px + 60 * U
rub = glossy('#0c0c10', 0.7, 0.1, 'rubber')
body = glossy(FL[0], 0.2, 0.8, 'fbody')
stripe = glossy(FL[1], 0.25, 0.6, 'fstripe')
hull_obj(capsule_pts(px, py, 9.6, tx, py, 6.1, 0.0, 0.05), rub)
hull_obj(capsule_pts(px, py, 8.2, tx, py, 4.8, 0.05, 0.1), body)
hull_obj(capsule_pts(px, py, 3.6, tx - 6 * U, py, 2.2, 0.095, 0.115), stripe)
cap = cylinder(0.05, 0.05, metal('#dfe3ea', 0.1), loc=(px, py, 0.12), seg=32)
# ---- drop target (up) at unit (140,40)
dx, dy, _ = P(140, 40)
dt = glossy('#ffb020', 0.25, 0.8, 'drop')
hull_obj(capsule_pts(dx, dy - 0.05, 3.8, dx, dy + 0.05, 3.8, 0.0, 0.1, 20), dt)
hull_obj(capsule_pts(dx, dy - 0.05, 2.0, dx, dy + 0.05, 2.0, 0.1, 0.115, 16), glossy('#fff4c0', 0.2, 0.8, 'dh'))
# ---- chrome ball at unit (190,40)
bx, by, _ = P(190, 40)
chrome = bpy.data.materials.new('ballchrome')
chrome.use_nodes = True
b = chrome.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.9, 0.92, 0.96, 1)
b.inputs['Metallic'].default_value = 1.0
b.inputs['Roughness'].default_value = 0.03
sp = sphere(0.08, chrome, loc=(bx, by, 0.08), seg=48)
for p in sp.data.polygons:
    p.use_smooth = True

sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = os.path.join(SCR, f'sprites_{TID}.png')
bpy.ops.render.render(write_still=True)
print('sprites done')
