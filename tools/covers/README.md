# Cover renders

`rig.py` is the shared Blender studio (camera, lights, gradient backdrop, materials, output).
One script per game (`<id>.py`) builds the hero object and calls `render('<id>')`, which writes
`assets/covers/<id>.webp` (640x800). Nothing here runs in the app.

    BLENDER=<blender 4.2+ binary>
    COVER_TMP=/tmp $BLENDER -b -P tools/covers/<id>.py
