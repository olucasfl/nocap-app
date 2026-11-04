"""Submetralhadora do Counter Fox a partir do modelo MP5 (com silenciador e empunhadura) enviado pelo Lucas (fora do repositório).

Entrada: o .obj do arquivo `low export final` (peça única). Divide as partes soltas, nomeia as que se mexem no jogo (Magazine,
Trigger) e junta o resto em Body. Boca para +X, ~0,85 m, origem no gatilho, materiais do Counter Fox (as texturas do arquivo não
são usadas).

    python tools/art/smg_from_ref.py "<low export final.obj>" tools/art/out
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
bpy.ops.wm.obj_import(filepath=SRC)
o = [x for x in bpy.data.objects if x.type == 'MESH'][0]
bpy.context.view_layer.objects.active = o
o.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')
parts = {p.name: p for p in bpy.data.objects if p.type == 'MESH'}
ROLE = {'mp5.014': 'Magazine', 'mp5.022': 'Trigger', 'mp5.010': 'ForeGrip', 'mp5.023': 'Suppressor', 'mp5.013': 'Suppressor', 'mp5.017': 'Grip',
        'mp5.015': 'Grip'}
groups = {}
for n, p in parts.items():
    groups.setdefault(ROLE.get(n, 'Body'), []).append(p)
final = {}
for role, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for p in objs:
        p.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = role
    final[role] = j
# o modelo tem a boca em -X: gira 180 graus em Z; escala de centímetros para ~0,85 m; origem no gatilho
rig = bpy.data.objects.new('Smg', None)
bpy.context.collection.objects.link(rig)
for j in final.values():
    j.parent = rig
rig.rotation_euler = (0, 0, math.pi)
rig.scale = (0.0077, 0.0077, 0.0077)
bpy.context.view_layer.update()
c = sum((final['Trigger'].matrix_world @ Vector(b) for b in final['Trigger'].bound_box), Vector()) / 8
rig.location = -c
bpy.context.view_layer.update()

dark = material('darksteel', (0.035, 0.037, 0.042), metal=0.7, rough=0.45, wear=0.7, bump=0.08, scale=80)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.33, wear=0.8, bump=0.1, scale=60)
poly = material('polymer', (0.02, 0.022, 0.025), metal=0.0, rough=0.7, wear=0.3, scale=30)
fox = material('foxaccent', (1.0, 0.36, 0.06), metal=0.0, rough=0.45, wear=0.4, scale=30)
PICK = {'Body': dark, 'Magazine': poly, 'Trigger': steel, 'ForeGrip': fox, 'Suppressor': steel, 'Grip': poly}
for role, j in final.items():
    j.data.materials.clear()
    j.data.materials.append(PICK[role])
    for p in j.data.polygons:
        p.use_smooth = False
sc = bpy.context.scene
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'smg-lado.png'), (0.0, -1.9, 0.0), (0.0, 0, -0.05), lens=50)
photo(os.path.join(OUT, 'smg-34.png'), (0.85, -1.45, 0.45), (0.0, 0, -0.05), lens=50)
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'smg.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO smg', {k: len(v.data.polygons) for k, v in final.items()})
