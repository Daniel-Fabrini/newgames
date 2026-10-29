import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from props import *

new_scene('#ffb24f', '#4a1a06', samples=int(os.environ.get('S', 96)))
objs = []
PW, PD = 5.4, 3.4
wood = glossy('#5a2e12', 0.2, 0.9, name='wood')
objs.append(box((PW + 0.7, PD + 0.7, 0.6), wood, loc=(0, 0, 0.3), bevel=0.18))
gA, gB = glossy('#2fb857', 0.6, 0.0, name='grassA'), glossy('#25a04a', 0.6, 0.0, name='grassB')
n = 9
for i in range(n):
    objs.append(box((PW / n, PD, 0.1), gA if i % 2 == 0 else gB, loc=(-PW / 2 + PW * (i + 0.5) / n, 0, 0.62), bevel=0.0))
line = matte('#f4fff6', 0.5, name='line')
objs.append(box((0.07, PD, 0.12), line, loc=(0, 0, 0.66), bevel=0.0))
objs.append(torus(0.75, 0.04, line, loc=(0, 0, 0.68)))
dark = matte('#0c1117', 0.8, name='goaldark')
for sx in (-1, 1):
    objs.append(box((0.5, 1.5, 0.16), dark, loc=(sx * (PW / 2 + 0.05), 0, 0.68), bevel=0.04))
    objs.append(box((0.9, 1.9, 0.12), line, loc=(sx * (PW / 2 - 0.45), 0, 0.66), bevel=0.0))
    objs.append(box((0.8, 1.8, 0.14), gA if sx < 0 else gB, loc=(sx * (PW / 2 - 0.45), 0, 0.665), bevel=0.0))
steel = metal('#dfe5ec', 0.1, name='rodsteel')
rubber = glossy('#15161a', 0.6, 0.2, name='grip')
white = glossy('#f6f6f6', 0.3, 0.6, name='kitwhite')
red = glossy('#d8202a', 0.25, 0.7, name='kitred')
black = glossy('#141414', 0.3, 0.6, name='kitblack')
blue = glossy('#2f7cff', 0.2, 0.8, name='kitblue')
skin = glossy('#ffd8b5', 0.35, 0.4, name='skin')
hair = glossy('#7a4f2a', 0.4, 0.4, name='hair')
shoe = glossy('#15171c', 0.3, 0.6, name='shoe')
# crest decal on the pitch (user's club crest, pitch decal only)
img = bpy.data.images.load(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'games', 'foosball', 'assets', 'crest.png')))
cm = bpy.data.materials.new('crest'); cm.use_nodes = True
nt = cm.node_tree; nt.nodes.clear()
o_ = nt.nodes.new('ShaderNodeOutputMaterial'); mx_ = nt.nodes.new('ShaderNodeMixShader')
tr_ = nt.nodes.new('ShaderNodeBsdfTransparent'); pb_ = nt.nodes.new('ShaderNodeBsdfPrincipled'); tx_ = nt.nodes.new('ShaderNodeTexImage')
tx_.image = img; pb_.inputs['Roughness'].default_value = 0.5
nt.links.new(tx_.outputs['Color'], pb_.inputs['Base Color']); nt.links.new(tx_.outputs['Alpha'], mx_.inputs['Fac'])
nt.links.new(tr_.outputs[0], mx_.inputs[1]); nt.links.new(pb_.outputs[0], mx_.inputs[2]); nt.links.new(mx_.outputs[0], o_.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=1)
cr = bpy.context.active_object; cr.dimensions = (2.1, 2.4, 0); bpy.ops.object.transform_apply(scale=True)
cr.rotation_euler = (0, 0, math.radians(90)); cr.location = (0, 0, 0.7); cr.data.materials.append(cm)
objs.append(cr)
def rod(x, kit, ys):
    z = 1.5
    objs.append(cylinder(0.055, PD + 1.9, steel, loc=(x, 0, z), rot=(90, 0, 0), bevel=0.0, seg=24))
    sgn = 1 if kit is white else -1
    objs.append(cylinder(0.14, 0.7, rubber, loc=(x, sgn * (PD / 2 + 1.25), z), rot=(90, 0, 0), bevel=0.04, seg=32))
    for y in ys:
        objs.append(box((0.32, 0.36, 0.62), kit, loc=(x, y, z - 0.46), bevel=0.08))
        if kit is white:
            objs.append(box((0.34, 0.09, 0.64), red, loc=(x - 0.0, y - 0.06, z - 0.46), bevel=0.02))
            objs.append(box((0.34, 0.07, 0.64), black, loc=(x, y + 0.04, z - 0.46), bevel=0.02))
        objs.append(box((0.3, 0.3, 0.2), black if kit is white else white, loc=(x, y, z - 0.9), bevel=0.05))
        objs.append(box((0.34, 0.4, 0.2), shoe, loc=(x, y, 0.85), bevel=0.05))
        for sx_ in (-1, 1):
            objs.append(box((0.1, 0.3, 0.1), kit, loc=(x + sx_ * 0.24, y + (0.12 if kit is white else -0.12), z - 0.12), bevel=0.03))
            objs.append(sphere(0.06, skin, loc=(x + sx_ * 0.24, y + (0.29 if kit is white else -0.29), z - 0.12)))
        objs.append(sphere(0.2, skin, loc=(x, y, z + 0.02)))
        objs.append(sphere(0.205, hair, loc=(x, y, z + 0.1), scale=(1, 1, 0.6)))
rod(-2.0, blue, [0.0])
rod(-0.8, white, [-1.0, 0.0, 1.0])
rod(0.5, blue, [-1.0, 0.0, 1.0])
rod(1.8, white, [-0.4, 0.4])
slab = parent(objs, loc=(0, 0.5, 2.0), rot=(46, 0, -16))
soccer_ball(1.0, loc=(-0.3, -2.5, 1.0), rot=(20, 10, 40))

fit(0.78, -0.35)
render('foosball')
