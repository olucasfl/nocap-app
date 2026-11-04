"""Fuzil M4 do Counter Fox a partir do modelo M4 (usdz) enviado pelo Lucas (fora do repositório).

Peças: Body (tudo que não se mexe), Magazine, Bolt (ferrolho/alça de carregar) e Trigger. Boca para +X, ~0,85 m, origem no gatilho,
materiais do Counter Fox (as texturas do arquivo não são usadas).

    python tools/art/m4_from_ref.py "<scene.usdc>" tools/art/out
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import material, photo, studio, flatten_for_gltf  # noqa: E402

SRC, OUT = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=SRC)
ROLE = {'mag_low_M4_0': 'Magazine', 'zatvor_low_M4_0': 'Bolt', 'kurok_low_M4_0': 'Trigger'}
parts = {}
for o in list(bpy.data.objects):
    if o.type == 'MESH':
        if o.name == 'puli_low_M4_0':
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            parts[o.name] = o
bpy.context.view_layer.update()
for o in parts.values():
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
groups = {}
for n, o in parts.items():
    groups.setdefault(ROLE.get(n, 'Body'), []).append(o)
final = {}
for role, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = role
    final[role] = j
# no arquivo a boca aponta para -Y: gira 90 graus em Z (boca para +X); ~0,85 m (o arquivo tem 4,4 unidades)
rig = bpy.data.objects.new('M4', None)
bpy.context.collection.objects.link(rig)
for j in final.values():
    j.parent = rig
rig.rotation_euler = (0, 0, math.pi / 2)
rig.scale = (0.19, 0.19, 0.19)
bpy.context.view_layer.update()
c = sum((final['Trigger'].matrix_world @ Vector(b) for b in final['Trigger'].bound_box), Vector()) / 8
rig.location = -c
bpy.context.view_layer.update()

dark = material('darksteel', (0.035, 0.037, 0.042), metal=0.7, rough=0.45, wear=0.7, bump=0.08, scale=80)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.33, wear=0.8, bump=0.1, scale=60)
poly = material('polymer', (0.02, 0.022, 0.025), metal=0.0, rough=0.7, wear=0.3, scale=30)
sand = material('sand', (0.33, 0.27, 0.17), metal=0.0, rough=0.6, wear=0.3, scale=30)
PICK = {'Body': dark, 'Magazine': poly, 'Bolt': steel, 'Trigger': steel}
for role, j in final.items():
    j.data.materials.clear()
    j.data.materials.append(PICK[role])
    for p in j.data.polygons:
        p.use_smooth = False
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'm4-lado.png'), (0.0, -1.9, 0.0), (0.0, 0, -0.04), lens=50)
photo(os.path.join(OUT, 'm4-34.png'), (0.85, -1.45, 0.45), (0.0, 0, -0.04), lens=50)
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'm4.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO m4', {k: len(v.data.polygons) for k, v in final.items()})
