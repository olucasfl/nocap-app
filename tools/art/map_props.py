"""Converte pacotes de modelos de terceiros (USDZ/FBX) em GLBs pequenos para o mapa Duna do Counter Fox (spec 057).

Só ferramenta de trabalho (fora do package.json). Como rodar:
    python3 -m venv ~/bpyenv && ~/bpyenv/bin/pip install bpy
    ~/bpyenv/bin/python tools/art/map_props.py -- <pasta com os pacotes baixados> <pasta de saída>
Cada peça sai com a origem no centro da base, escala em metros, só a textura de cor (<= 512 px) e sem normal/metal, para ficar leve.
Licenças: ver docs/CREDITS-3D.md.
"""
import json
import os
import sys

import bpy
from mathutils import Vector

src_dir, out_dir = sys.argv[sys.argv.index('--') + 1:][:2]
os.makedirs(out_dir, exist_ok=True)

# (arquivo do pacote, trechos do nome do objeto (qualquer um), arquivo de saída, eixo e tamanho alvo em metros)
SPECS = json.load(open(os.path.join(os.path.dirname(__file__), 'map_props.json')))


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    if path.endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        bpy.ops.wm.usd_import(filepath=path)


def keep_only(names, exclude):
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH' and any(n in o.name for n in names) and not any(x in o.name for x in exclude):
            continue
        if o.type != 'MESH':
            continue
        bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.context.scene.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o, do_unlink=True)


def flatten_hierarchy():
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bbox(meshes):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], w[i])
                mx[i] = max(mx[i], w[i])
    return mn, mx


def slim_materials(max_px):
    """Só a cor (baseColor), textura pequena; o resto vira valor fixo."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        for inp in list(bsdf.inputs):
            if inp.name == 'Base Color':
                continue
            for l in list(inp.links):
                nt.links.remove(l)
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.9
    for img in bpy.data.images:
        if img.size[0] > max_px or img.size[1] > max_px:
            k = max_px / max(img.size)
            img.scale(max(8, int(img.size[0] * k)), max(8, int(img.size[1] * k)))


for spec in SPECS:
    clean_scene()
    load(os.path.join(src_dir, spec['src']))
    keep_only(spec['names'], spec.get('exclude', []))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        print('SEM PEÇAS', spec['out'])
        continue
    flatten_hierarchy()
    mn, mx = bbox(meshes)
    size = mx - mn
    axis = {'x': 0, 'y': 1, 'z': 2, 'w': None}[spec['axis']]
    cur = max(size.x, size.y) if axis is None else size[axis]
    k = spec['size'] / cur if cur > 1e-9 else 1
    ctr = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for o in meshes:
        o.location = (o.location - ctr) * k
        o.scale = (o.scale.x * k, o.scale.y * k, o.scale.z * k)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    slim_materials(spec.get('px', 512))
    out = os.path.join(out_dir, spec['out'])
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=78, export_yup=True, export_apply=True, use_selection=False)
    tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    print('OK', spec['out'], 'tris', tris, 'KB', os.path.getsize(out) // 1024)
