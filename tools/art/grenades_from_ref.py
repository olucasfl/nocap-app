"""Granadas do Counter Fox a partir dos modelos enviados pelo Lucas em .usdz (fora do repositório): a granada de fragmentação (F1) e a
granada de luz (flash). Usa só a geometria (reduzida) e materiais do Counter Fox; as texturas dos arquivos não são usadas.

    python tools/art/grenades_from_ref.py "<F1 scene.usdc>" "<flash scene.usdc>" tools/art/out
"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import material, photo, studio, flatten_for_gltf  # noqa: E402

FRAG, FLASH, OUT = sys.argv[-3], sys.argv[-2], sys.argv[-1]


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.usd_import(filepath=path)
    for o in list(bpy.data.objects):
        if o.type == 'MESH':
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    return [o for o in bpy.data.objects if o.type == 'MESH']


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = name
    return j


def bake(objs):
    """Leva a posição/giro/escala do arquivo para dentro da malha (transform_apply)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def center_origin(o, scale, c=None):
    """Origem no centro da peça (ou em `c`), escala em metros. Devolve o centro usado."""
    bpy.context.view_layer.update()
    if c is None:
        c = sum((o.matrix_world @ Vector(b) for b in o.bound_box), Vector()) / 8
    for v in o.data.vertices:
        v.co = (v.co - c) * scale
    return c


# --- fragmentação
(frag,) = load(FRAG)[:1]
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.33, wear=0.8, bump=0.1, scale=60)
olive = material('olive', (0.1, 0.14, 0.06), metal=0.5, rough=0.5, wear=0.6, bump=0.1, scale=40)
fox = material('foxaccent', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)
gray = material('flashgray', (0.55, 0.57, 0.6), metal=0.6, rough=0.4, wear=0.5, scale=40)
frag.name = 'Grenade'
bake([frag])
center_origin(frag, 1.0)
frag.data.materials.clear()
frag.data.materials.append(olive)
for p in frag.data.polygons:
    p.use_smooth = False
studio(res=(640, 640), samples=32)
photo(os.path.join(OUT, 'frag-34.png'), (0.28, -0.32, 0.12), (0, 0, 0), lens=60)
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'frag.glb'), export_format='GLB', export_apply=True, export_animations=False)

# --- luz
parts = load(FLASH)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.33, wear=0.8, bump=0.1, scale=60)
olive = material('olive', (0.1, 0.14, 0.06), metal=0.5, rough=0.5, wear=0.6, bump=0.1, scale=40)
fox = material('foxaccent', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)
gray = material('flashgray', (0.55, 0.57, 0.6), metal=0.6, rough=0.4, wear=0.5, scale=40)
lever = [o for o in parts if o.name.startswith('hendler')]
rest = [o for o in parts if o not in lever]
body = join(rest, 'Body')
lev = join(lever, 'Lever')
bake([body, lev])
# a alavanca e o corpo usam o MESMO centro e a mesma escala (antes só o corpo era centrado e a alavanca ficava deslocada)
c = center_origin(body, 0.5)
center_origin(lev, 0.5, c)
for o, mat in ((body, gray), (lev, fox)):
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = False
studio(res=(640, 640), samples=32)
photo(os.path.join(OUT, 'flash-34.png'), (0.28, -0.32, 0.1), (0, 0, 0), lens=60)
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'flash.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO granadas')
