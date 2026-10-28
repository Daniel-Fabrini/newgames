#!/usr/bin/env python3
"""Download Poly Haven (CC0) assets into the local build cache.

Usage:
    HOG3D_CACHE=/path/to/cache python3 fetch.py models brass_vase_01 Lantern_01 ...
    HOG3D_CACHE=/path/to/cache python3 fetch.py textures dark_paneled_wood ...
    HOG3D_CACHE=/path/to/cache python3 fetch.py hdris comfy_cafe ...
    HOG3D_CACHE=/path/to/cache python3 fetch.py scenes          # everything the recipes use

Models are fetched as .blend at 1k (textures next to it, as the .blend expects),
textures as 2k JPG maps, HDRIs as 2k (lighting) or 4k (visible sky) .hdr files.
Nothing is downloaded twice.
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = 'https://api.polyhaven.com'
CACHE = os.environ.get('HOG3D_CACHE') or os.path.expanduser('~/.cache/hog3d')
UA = {'User-Agent': 'da-games-hog3d-build/1.0'}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(tmp, dest)
    return True


def model(asset, res='1k'):
    root = os.path.join(CACHE, 'models', asset)
    blend = os.path.join(root, f'{asset}.blend')
    if os.path.exists(blend):
        return blend
    files = get_json(f'{API}/files/{asset}')
    entry = files['blend'][res]['blend']
    jobs = [(entry['url'], os.path.join(root, f'{asset}.part.blend'))]
    for rel, inc in entry.get('include', {}).items():
        jobs.append((inc['url'], os.path.join(root, rel)))
    for url, dest in jobs[1:]:
        download(url, dest)
    download(jobs[0][0], jobs[0][1])
    os.replace(jobs[0][1], blend)
    return blend


MAPS = {'Diffuse': 'diff', 'nor_gl': 'nor', 'Rough': 'rough', 'arm': 'arm', 'Displacement': 'disp'}


def texture(asset, res='2k'):
    root = os.path.join(CACHE, 'textures', asset)
    done = os.path.join(root, '.ok')
    if os.path.exists(done):
        return root
    files = get_json(f'{API}/files/{asset}')
    for key, short in MAPS.items():
        if key in files and res in files[key]:
            download(files[key][res]['jpg']['url'], os.path.join(root, f'{short}.jpg'))
    open(done, 'w').close()
    return root


def hdri(asset, res='2k'):
    dest = os.path.join(CACHE, 'hdris', f'{asset}_{res}.hdr')
    if not os.path.exists(dest):
        files = get_json(f'{API}/files/{asset}')
        download(files['hdri'][res]['hdr']['url'], dest)
    return dest


def run(kind, names, workers=6):
    fn = {'models': model, 'textures': texture, 'hdris': hdri}[kind]

    def one(n):
        try:
            if ':' in n:
                name, res = n.split(':', 1)
                fn(name, res)
            else:
                fn(n)
            return n, None
        except Exception as e:  # noqa: BLE001 - report and keep going
            return n, e

    bad = []
    with ThreadPoolExecutor(workers) as ex:
        for n, err in ex.map(one, names):
            if err:
                bad.append(n)
                print(f'  ! {kind} {n}: {err}', flush=True)
    print(f'{kind}: {len(names) - len(bad)}/{len(names)} ready', flush=True)
    return bad


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    kind, names = argv[0], argv[1:]
    if kind == 'scenes':
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from recipes import all_requirements  # noqa: E402

        req = all_requirements(names or None)
        bad = run('models', sorted(req['models']))
        bad += run('textures', sorted(req['textures']))
        bad += run('hdris', sorted(req['hdris']))
        return 1 if bad else 0
    return 1 if run(kind, names) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
