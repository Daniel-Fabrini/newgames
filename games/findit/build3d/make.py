#!/usr/bin/env python3
"""Render scenes and write the game data, one scene after the other.

    BLENDER=/path/to/blender HOG3D_CACHE=/path/to/cache \
        python3 make.py [scene_id ...] [--preview] [--work DIR] [--py /path/to/python-with-opencv]

Without ids, every scene in recipes.py is built. Renders land in --work
(default: $HOG3D_CACHE/../renders/<id>) and post.py writes the WebP/JSON into
../scenes/. Then thumbs.py renders any missing tray icons and index.py
refreshes scenes/index.js.
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import recipes  # noqa: E402


def main(argv):
    blender = os.environ.get('BLENDER', 'blender')
    cache = os.environ.get('HOG3D_CACHE') or os.path.expanduser('~/.cache/hog3d')
    py = sys.executable
    if '--py' in argv:
        py = argv[argv.index('--py') + 1]
    work = os.path.join(os.path.dirname(cache.rstrip('/')), 'renders')
    if '--work' in argv:
        work = argv[argv.index('--work') + 1]
    flags = [a for a in argv if a.startswith('--')]
    ids = [a for a in argv if not a.startswith('--') and a in recipes.SCENES] or list(recipes.SCENES)
    preview = '--preview' in flags
    out_scenes = os.path.join(HERE, '..', 'scenes')
    for sid in ids:
        out = os.path.join(work, sid + ('_p' if preview else ''))
        t = time.time()
        cmd = [blender, '-b', '--factory-startup', '-P', os.path.join(HERE, 'build_scene.py'), '--', sid, out] + (['--preview'] if preview else [])
        r = subprocess.run(cmd, env={**os.environ, 'HOG3D_CACHE': cache, 'PYTHONUNBUFFERED': '1'}, capture_output=True, text=True)
        log = r.stdout + r.stderr
        with open(out + '.log', 'w') as f:
            f.write(log)
        if r.returncode != 0 or not os.path.exists(os.path.join(out, 'passes.exr')):
            print(f'{sid}: render FAILED (see {out}.log)', flush=True)
            continue
        print(f'{sid}: rendered in {time.time() - t:.0f}s', flush=True)
        if not preview:
            subprocess.run([py, '-I', os.path.join(HERE, 'post.py'), out, sid, out_scenes], check=False)
    if not preview and '--no-thumbs' not in flags:
        thumbs = os.path.join(work, 'thumbs')
        subprocess.run([blender, '-b', '--factory-startup', '-P', os.path.join(HERE, 'thumbs.py'), '--', out_scenes, thumbs],
                       env={**os.environ, 'HOG3D_CACHE': cache}, capture_output=True, text=True)
        subprocess.run([py, '-I', os.path.join(HERE, 'post.py'), '--thumbs', thumbs, out_scenes], check=False)
        subprocess.run([py, '-I', os.path.join(HERE, 'post.py'), '--index', out_scenes], check=False)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
