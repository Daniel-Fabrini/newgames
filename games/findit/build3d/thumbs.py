"""Render the tray icons: every prop that is a target in some scene, alone,
in a 3/4 studio view on a transparent background.

    blender -b --factory-startup -P thumbs.py -- <scenes_dir> <png_out_dir>

Then post_thumbs (in post.py) turns the PNGs into small WebP files.
"""
import glob
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import lib  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
scenes_dir, out_dir = argv[0], argv[1]
os.makedirs(out_dir, exist_ok=True)
keys = set()
for f in glob.glob(os.path.join(scenes_dir, '*.json')):
    d = json.load(open(f))
    for it in d.get('items', []):
        if it.get('t'):
            keys.add(it['a'])
todo = [k for k in sorted(keys) if not os.path.exists(os.path.join(out_dir, k.replace('/', '__') + '.png'))]
print(f'thumbs: {len(keys)} keys, {len(todo)} to render', flush=True)

for key in todo:
    lib.reset()
    lib._loaded.clear()
    lib._protos.clear()
    try:
        p = lib.proto(key)
    except Exception as e:  # noqa: BLE001
        print('  skip', key, e, flush=True)
        continue
    objs = p.instance((0, 0, 0))
    mn, mx = lib.aabb_of(objs)
    c = (mn + mx) / 2
    d = Vector((0.62, -1.0, 0.55)).normalized()
    cam_d = bpy.data.cameras.new('cam')
    cam_d.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_d)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = c + d * 10
    lib.look_at(cam, c)
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for o in objs:
        for v in o.bound_box:
            q = inv @ (o.matrix_world @ Vector(v))
            xs.append(q.x)
            ys.append(q.y)
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cam_d.ortho_scale = max(w, h) * 1.08
    cam_d.shift_x = ((max(xs) + min(xs)) / 2) / cam_d.ortho_scale
    cam_d.shift_y = ((max(ys) + min(ys)) / 2) / cam_d.ortho_scale
    cam_d.clip_end = 100
    lib.world_hdri('comfy_cafe', strength=0.8)
    size = max(mx - mn)
    lib.area_light('key', c + Vector((-1.5, -2.0, 2.0)) * size, c, size=size * 1.5, power=60 * size * size + 5, temp=5200)
    lib.area_light('rim', c + Vector((1.8, 1.5, 1.5)) * size, c, size=size, power=40 * size * size + 3, temp=4200)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 256
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    sc.render.filepath = os.path.join(out_dir, key.replace('/', '__') + '.png')
    bpy.ops.render.render(write_still=True)
    print('  ok', key, flush=True)
