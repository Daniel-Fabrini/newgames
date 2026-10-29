#!/usr/bin/env bash
# Rebuilds every picture of "Detetive dos Personagens":  ./build.sh [sceneId ...]
# Needs: node + playwright (chromium) and python3 + Pillow (WebP). ~25 s render + ~2 min encode.
set -euo pipefail
cd "$(dirname "$0")"
node render.mjs "$@"
if [ "$#" -eq 0 ]; then node render.mjs --icons; fi
python3 encode.py "$@"
