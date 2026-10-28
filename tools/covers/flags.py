import os, sys, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from globe import globe_material
subprocess.check_call(['python3', '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flagstrip.py')], env=dict(os.environ))
new_scene('#2f8cff', '#04163f', samples=int(os.environ.get('SAMPLES', 128)))
Z = 1.35
sphere(1.7, globe_material(ocean='#1250c8', thresh=0.53), loc=(0, 0, Z))
strip = image_material(os.path.join(TMP, 'flagstrip.png'), rough=0.5, coat=0.15)
from mathutils import Euler
from mathutils import Matrix
def band(R, h, rot, off, spin=0):
    bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=h, vertices=128, end_fill_type='NOTHING')
    o = bpy.context.active_object
    o.data.materials.append(strip)
    for p in o.data.polygons: p.use_smooth = True
    s = o.modifiers.new('s', 'SOLIDIFY'); s.thickness = 0.08; s.offset = 1
    b = o.modifiers.new('b', 'BEVEL'); b.width = 0.02; b.segments = 3
    e = Euler(tuple(math.radians(r) for r in rot))
    ax = e.to_matrix() @ Vector((0, 0, 1))
    o.location = Vector((0, 0, Z)) + ax * off
    o.rotation_euler = (e.to_matrix() @ Matrix.Rotation(math.radians(spin), 3, 'Z')).to_euler()
    return o
band(1.5, 0.6, (-12, -18, 0), 0.98)
band(1.5, 0.6, (-12, -18, 0), -0.98, 150)
shadow_catcher(0.0)
render('flags')
