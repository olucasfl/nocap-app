"""Mãos e faca do Fox Shot! a partir do modelo "arms@knife" enviado pelo Lucas (.fbx de terceiros, fora do repositório).

Braços com 49 ossos (dedos), a faca na mão direita e a animação de inspecionar (146 quadros, 30 fps). Reduz as texturas para 1024
px, monta os materiais (cor + normal) e exporta `arms_knife.glb` com a animação chamada `inspect`.

    python tools/art/arms_knife.py "<arms@knife.fbx>" "<pasta textures>" tools/art/out
"""
import os
import sys

import bpy
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from common import photo, studio  # noqa: E402

SRC, TEX, OUT = sys.argv[-3], sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.fbx_import(filepath=SRC)

# texturas menores (o jogo carrega pela internet): 1024 px, JPEG
small = os.path.join(OUT, 'tex-small')
os.makedirs(small, exist_ok=True)
files = {'armColor': 'armcolor3.png', 'armNormal': 'armNormal3.png', 'knifeColor': 'knifeColor.png', 'knifeNormal': 'knifeNormal.png'}
paths = {}
for k, f in files.items():
    im = Image.open(os.path.join(TEX, f)).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    p = os.path.join(small, k + '.jpg')
    im.save(p, quality=88)
    paths[k] = p


def pbr(name, color, normal, metal, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    ci = nt.nodes.new('ShaderNodeTexImage')
    ci.image = bpy.data.images.load(color)
    nt.links.new(ci.outputs['Color'], b.inputs['Base Color'])
    ni = nt.nodes.new('ShaderNodeTexImage')
    ni.image = bpy.data.images.load(normal)
    ni.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(ni.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    return m


arms_m = pbr('arms', paths['armColor'], paths['armNormal'], 0.0, 0.65)
knife_m = pbr('knife', paths['knifeColor'], paths['knifeNormal'], 0.85, 0.35)
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.materials.clear()
        o.data.materials.append(arms_m if o.name == 'armmesh' else knife_m)
        for p in o.data.polygons:
            p.use_smooth = True
if bpy.data.actions:
    bpy.data.actions[0].name = 'inspect'

arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
from mathutils import Vector  # noqa: E402
rw = arm.matrix_world @ arm.pose.bones['R_wrist'].head
lw = arm.matrix_world @ arm.pose.bones['L_wrist'].head
ra = arm.matrix_world @ arm.pose.bones['R_arm'].head
print('R_arm head', tuple(round(x, 3) for x in ra), 'R_wrist', tuple(round(x, 3) for x in rw), 'L_wrist', tuple(round(x, 3) for x in lw))

studio(res=(640, 480), samples=40)
bpy.context.scene.render.resolution_percentage = 100
c = (rw + lw) / 2
for f in (1, 80):
    bpy.context.scene.frame_set(f)
    bpy.context.view_layer.update()
    photo(os.path.join(OUT, f'arms-f{f}-a.png'), (c.x, c.y - 1.3, c.z + 0.1), tuple(c), lens=45)
    photo(os.path.join(OUT, f'arms-f{f}-b.png'), (c.x + 1.3, c.y, c.z + 0.1), tuple(c), lens=45)
bpy.context.scene.frame_set(1)
for o in list(bpy.data.objects):
    if o.name == 'floor' or o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'arms_knife.glb'), export_format='GLB', export_apply=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True)
print('FEITO')
