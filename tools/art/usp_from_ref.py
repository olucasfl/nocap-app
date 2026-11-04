"""Pistola USP-S silenciada do Counter Fox a partir do modelo (estilo PS1) enviado pelo Lucas em .fbx (fora do repositório).

Peça única dividida em partes soltas: Slide (anima ao atirar), Suppressor (silenciador), Trigger e Body (resto). Boca para +X, ~0,45 m
com o silenciador, origem no gatilho, materiais do Counter Fox (as texturas do arquivo não são usadas).

    python tools/art/usp_from_ref.py "<USP-S1.fbx>" tools/art/out
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
bpy.ops.wm.fbx_import(filepath=SRC)
o = [x for x in bpy.data.objects if x.type == 'MESH'][0]
bpy.context.view_layer.objects.active = o
o.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')
ROLE = {'Cube.009': 'Slide', 'Cube.004': 'Suppressor', 'Cube.015': 'Trigger'}
groups = {}
for p in [x for x in bpy.data.objects if x.type == 'MESH']:
    groups.setdefault(ROLE.get(p.name, 'Body'), []).append(p)
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
rig = bpy.data.objects.new('Usp', None)
bpy.context.collection.objects.link(rig)
for j in final.values():
    j.parent = rig
rig.rotation_euler = (0, 0, math.pi / 2)
rig.scale = (0.105, 0.105, 0.105)
bpy.context.view_layer.update()
c = sum((final['Trigger'].matrix_world @ Vector(b) for b in final['Trigger'].bound_box), Vector()) / 8
rig.location = -c
bpy.context.view_layer.update()
dark = material('darksteel', (0.035, 0.037, 0.042), metal=0.7, rough=0.45, wear=0.7, bump=0.08, scale=80)
steel = material('steel', (0.12, 0.125, 0.135), metal=0.95, rough=0.33, wear=0.8, bump=0.1, scale=60)
poly = material('polymer', (0.02, 0.022, 0.025), metal=0.0, rough=0.7, wear=0.3, scale=30)
PICK = {'Body': poly, 'Slide': steel, 'Suppressor': dark, 'Trigger': steel}
for role, j in final.items():
    j.data.materials.clear()
    j.data.materials.append(PICK[role])
    for p in j.data.polygons:
        p.use_smooth = False
studio(res=(1024, 576), samples=48)
photo(os.path.join(OUT, 'usp-lado.png'), (0.0, -1.2, 0.0), (0.0, 0, 0.0), lens=50)
photo(os.path.join(OUT, 'usp-34.png'), (0.55, -0.95, 0.3), (0.0, 0, 0.0), lens=50)
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'usp.glb'), export_format='GLB', export_apply=True, export_animations=False)
print('FEITO usp', {k: len(v.data.polygons) for k, v in final.items()})
