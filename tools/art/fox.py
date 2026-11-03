"""Raposa em pé do Fox Shot! (3ª pessoa): corpo estilizado, equipamento tático, esqueleto e animações simples.

Malha única com pesos rígidos por osso (cada peça pertence a um osso; as articulações são esferas que se sobrepõem), ~4 mil
triângulos. Animações (30 fps, em NLA para sair como clipes no glTF): idle, run, shoot, reload, hit, death.
Convenção: de frente para +X, Z para cima, Y para a esquerda; origem nos pés.

    python tools/art/fox.py tools/art/out
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import material, photo, reset, studio  # noqa: E402

OUT = sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
reset()

orange = material('fur', (0.9, 0.28, 0.04), metal=0.0, rough=0.85, bump=0.35, scale=140)
white = material('furwhite', (0.85, 0.78, 0.68), metal=0.0, rough=0.85, bump=0.3, scale=140)
sock = material('sock', (0.07, 0.04, 0.03), metal=0.0, rough=0.8, bump=0.3, scale=120)
vest = material('vest', (0.045, 0.06, 0.035), metal=0.0, rough=0.7, bump=0.25, scale=100, wear=0.15)
cap = material('cap', (0.04, 0.09, 0.4), metal=0.0, rough=0.6, bump=0.2, scale=90)
eye = material('eye', (0.01, 0.01, 0.012), metal=0.0, rough=0.1)
strap = material('strap', (0.02, 0.02, 0.022), metal=0.0, rough=0.7)

parts = []


def _obj(o, name, mat, bone):
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    vg = o.vertex_groups.new(name=bone)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    parts.append(o)
    return o


def ell(name, c, r, mat, bone, rot=(0, 0, 0), segs=(14, 8)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs[0], ring_count=segs[1], location=c, rotation=rot)
    o = bpy.context.object
    o.scale = r
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return _obj(o, name, mat, bone)


def limb(name, p0, p1, r0, r1, mat, bone, segs=(12, 8)):
    a, b = Vector(p0), Vector(p1)
    v = b - a
    mid = (a + b) / 2
    q = Vector((0, 0, 1)).rotation_difference(v.normalized())
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs[0], ring_count=segs[1], location=mid)
    o = bpy.context.object
    rr = (r0 + r1) / 2
    o.scale = (rr, rr, v.length / 2 + rr * 0.7)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = q
    bpy.ops.object.transform_apply(rotation=True)
    return _obj(o, name, mat, bone)


def cone(name, c, r, h, mat, bone, rot):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r, radius2=0.004, depth=h, location=c, rotation=rot)
    o = bpy.context.object
    bpy.ops.object.transform_apply(rotation=True)
    return _obj(o, name, mat, bone)


def box(name, c, size, mat, bone, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('b', 'BEVEL')
    m.width = bevel
    m.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='b')
    return _obj(o, name, mat, bone)


S = (1, -1)  # lados: esquerda (+Y) e direita (-Y)
side = {1: 'L', -1: 'R'}

# ---- tronco e quadril
ell('Pelvis', (0, 0, 0.58), (0.13, 0.17, 0.12), orange, 'hips')
ell('Belly', (0.02, 0, 0.74), (0.14, 0.18, 0.15), orange, 'spine')
ell('Chest', (0.02, 0, 0.90), (0.15, 0.20, 0.17), orange, 'chest')
ell('ChestFur', (0.12, 0, 0.88), (0.06, 0.12, 0.14), white, 'chest')
box('Vest', (0.03, 0, 0.88), (0.22, 0.37, 0.30), vest, 'chest', 0.02)
box('VestBelly', (0.03, 0, 0.72), (0.20, 0.34, 0.14), vest, 'spine', 0.02)
box('Belt', (0.03, 0, 0.64), (0.22, 0.36, 0.05), strap, 'hips', 0.01)
for s in S:
    box(f'Pouch{side[s]}', (0.14, s * 0.09, 0.70), (0.05, 0.07, 0.07), strap, 'spine', 0.01)
# ---- pescoço e cabeça
ell('Neck', (0.0, 0, 1.03), (0.07, 0.07, 0.08), orange, 'neck')
ell('Head', (0.03, 0, 1.17), (0.15, 0.14, 0.13), orange, 'head')
ell('Snout', (0.19, 0, 1.13), (0.12, 0.06, 0.055), white, 'head')
ell('Nose', (0.30, 0, 1.14), (0.022, 0.02, 0.018), eye, 'head', segs=(8, 6))
for s in S:
    ell(f'Eye{side[s]}', (0.14, s * 0.065, 1.20), (0.022, 0.018, 0.026), eye, 'head', segs=(8, 6))
    ell(f'Cheek{side[s]}', (0.10, s * 0.10, 1.12), (0.07, 0.04, 0.05), white, 'head', segs=(8, 6))
    cone(f'Ear{side[s]}', (-0.02, s * 0.09, 1.34), 0.055, 0.17, orange, 'head', (s * math.radians(-12), math.radians(-8), 0))
    cone(f'EarTip{side[s]}', (-0.02, s * 0.098, 1.40), 0.032, 0.09, sock, 'head', (s * math.radians(-12), math.radians(-8), 0))
# boné com aba
ell('CapTop', (0.02, 0, 1.26), (0.155, 0.145, 0.075), cap, 'head')
box('CapBrim', (0.18, 0, 1.235), (0.12, 0.2, 0.012), cap, 'head', 0.005)
# ---- cauda (3 segmentos, ponta branca)
ell('Tail1', (-0.18, 0, 0.58), (0.10, 0.07, 0.07), orange, 'tail1', rot=(0, math.radians(-20), 0))
ell('Tail2', (-0.34, 0, 0.66), (0.12, 0.09, 0.09), orange, 'tail2', rot=(0, math.radians(-30), 0))
ell('Tail3', (-0.52, 0, 0.78), (0.13, 0.10, 0.10), white, 'tail3', rot=(0, math.radians(-40), 0))
# ---- braços (na pose de segurar a arma o jogo dobra os ossos)
for s in S:
    n = side[s]
    sh, el, wr = (0.0, s * 0.22, 0.95), (0.03, s * 0.25, 0.76), (0.05, s * 0.26, 0.58)
    ell(f'Shoulder{n}', sh, (0.075, 0.075, 0.075), orange, f'upperarm.{n}')
    limb(f'UpperArm{n}', sh, el, 0.06, 0.055, orange, f'upperarm.{n}')
    ell(f'Elbow{n}', el, (0.058, 0.058, 0.058), orange, f'forearm.{n}')
    limb(f'Forearm{n}', el, wr, 0.052, 0.045, sock, f'forearm.{n}')
    ell(f'Hand{n}', (0.05, s * 0.26, 0.52), (0.055, 0.045, 0.06), sock, f'hand.{n}')
# ---- pernas
for s in S:
    n = side[s]
    hp, kn, an = (0.0, s * 0.10, 0.56), (0.03, s * 0.11, 0.31), (0.0, s * 0.11, 0.08)
    limb(f'Thigh{n}', hp, kn, 0.085, 0.07, orange, f'thigh.{n}')
    ell(f'Knee{n}', kn, (0.07, 0.07, 0.07), orange, f'shin.{n}')
    limb(f'Shin{n}', kn, an, 0.065, 0.05, sock, f'shin.{n}')
    ell(f'Foot{n}', (0.07, s * 0.11, 0.045), (0.13, 0.06, 0.05), sock, f'foot.{n}')
    ell(f'Boot{n}', (0.07, s * 0.11, 0.05), (0.14, 0.065, 0.055), strap, f'foot.{n}')

# ---- malha única
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'FoxBody'

# ---- esqueleto
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object
arm.name = 'FoxRig'
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
for b in list(eb):
    eb.remove(b)


def bone(name, head, tail, parent=None, roll=0.0):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.roll = roll
    if parent:
        b.parent = eb[parent]
    return b


bone('root', (0, 0, 0), (0, 0, 0.12))
bone('hips', (0, 0, 0.58), (0, 0, 0.70), 'root')
bone('spine', (0, 0, 0.70), (0, 0, 0.88), 'hips')
bone('chest', (0, 0, 0.88), (0, 0, 1.02), 'spine')
bone('neck', (0, 0, 1.02), (0, 0, 1.08), 'chest')
bone('head', (0, 0, 1.08), (0, 0, 1.36), 'neck')
bone('tail1', (-0.08, 0, 0.58), (-0.26, 0, 0.62), 'hips')
bone('tail2', (-0.26, 0, 0.62), (-0.42, 0, 0.72), 'tail1')
bone('tail3', (-0.42, 0, 0.72), (-0.62, 0, 0.86), 'tail2')
for s in S:
    n = side[s]
    bone(f'upperarm.{n}', (0.0, s * 0.22, 0.95), (0.03, s * 0.25, 0.76), 'chest')
    bone(f'forearm.{n}', (0.03, s * 0.25, 0.76), (0.05, s * 0.26, 0.58), f'upperarm.{n}')
    bone(f'hand.{n}', (0.05, s * 0.26, 0.58), (0.05, s * 0.26, 0.47), f'forearm.{n}')
    bone(f'thigh.{n}', (0.0, s * 0.10, 0.56), (0.03, s * 0.11, 0.31), 'hips')
    bone(f'shin.{n}', (0.03, s * 0.11, 0.31), (0.0, s * 0.11, 0.08), f'thigh.{n}')
    bone(f'foot.{n}', (0.0, s * 0.11, 0.08), (0.14, s * 0.11, 0.04), f'shin.{n}')
bone('weapon', (0.05, -0.26, 0.54), (0.20, -0.26, 0.54), 'hand.R')
bpy.ops.object.mode_set(mode='OBJECT')
body.parent = arm
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm

# ---- animações (eixos: Z da articulação = giro para frente/trás; X = inclinação para o lado)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for b in pb:
    b.rotation_mode = 'XYZ'


def reset_pose():
    for b in pb:
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)


def key(frame, bones):
    """bones: {nome: (rx, ry, rz) em graus, ou (loc)}; grava um quadro."""
    reset_pose()
    for n, v in bones.items():
        if n.endswith('.loc'):
            pb[n[:-4]].location = v
        else:
            pb[n].rotation_euler = Euler(tuple(math.radians(a) for a in v), 'XYZ')
    for b in pb:
        b.keyframe_insert('rotation_euler', frame=frame)
        b.keyframe_insert('location', frame=frame)


def action(name):
    a = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = a
    return a


FPS = 30
bpy.context.scene.render.fps = FPS
acts = {}
# idle: respira, a cauda balança (60 quadros, volta ao começo)
acts['idle'] = action('idle')
for f in (0, 30, 60):
    k = math.sin(f / 60 * 2 * math.pi)
    key(f, {'chest': (0, 0, 1.2 * math.sin(f / 30 * math.pi)), 'head': (0, 0, -0.8 * math.sin(f / 30 * math.pi)),
            'tail1': (0, 0, 6 * k), 'tail2': (0, 0, 10 * k), 'tail3': (0, 0, 14 * k),
            'upperarm.L': (0, 0, 4), 'upperarm.R': (0, 0, 4)})
# run: passada de 24 quadros (2 passos), braços dobrados segurando a arma
acts['run'] = action('run')
for i, f in enumerate((0, 6, 12, 18, 24)):
    ph = i / 4 * 2 * math.pi
    sw = math.sin(ph)
    key(f, {
        'hips.loc': (0, 0, 0.02 * abs(math.cos(ph))), 'spine': (0, 0, -6 + 3 * math.cos(ph * 2)),
        'thigh.L': (0, 0, -38 * sw), 'shin.L': (0, 0, max(0, 55 * math.sin(ph + 1.2))), 'foot.L': (0, 0, 10 * sw),
        'thigh.R': (0, 0, 38 * sw), 'shin.R': (0, 0, max(0, -55 * math.sin(ph + 1.2))), 'foot.R': (0, 0, -10 * sw),
        'upperarm.L': (0, 0, -50), 'forearm.L': (0, 0, -70), 'upperarm.R': (0, 0, -55), 'forearm.R': (0, 0, -65),
        'tail1': (0, 0, 8 * sw), 'tail2': (0, 0, 12 * sw), 'tail3': (0, 0, 16 * sw), 'head': (0, 0, 4)})
# shoot: coice (10 quadros)
acts['shoot'] = action('shoot')
for f, a in ((0, 0), (2, 1), (10, 0)):
    key(f, {'spine': (0, 0, -8 * a), 'chest': (0, 0, -6 * a), 'upperarm.R': (0, 0, -60 - 8 * a), 'forearm.R': (0, 0, -60),
            'upperarm.L': (0, 0, -55), 'forearm.L': (0, 0, -60), 'head': (0, 0, 4 * a), 'tail1': (0, 0, 10 * a)})
# reload: a mão da frente desce até a arma e volta (45 quadros)
acts['reload'] = action('reload')
for f, a in ((0, 0), (10, 1), (22, 1), (34, 0.4), (45, 0)):
    key(f, {'upperarm.L': (0, 0, -55 + 25 * a), 'forearm.L': (0, 0, -60 - 25 * a), 'hand.L': (0, 0, 25 * a),
            'upperarm.R': (0, 0, -60), 'forearm.R': (0, 0, -60), 'spine': (0, 0, 8 * a), 'head': (0, 0, 12 * a)})
# hit: sacode para trás (12 quadros)
acts['hit'] = action('hit')
for f, a in ((0, 0), (3, 1), (12, 0)):
    key(f, {'spine': (0, 0, -14 * a), 'chest': (0, 0, -10 * a), 'head': (0, 0, -16 * a), 'tail1': (0, 0, -20 * a),
            'upperarm.L': (0, 0, 30 * a), 'upperarm.R': (0, 0, 30 * a)})
# death: cai de costas e fica no chão (30 quadros, não repete)
acts['death'] = action('death')
for f, a in ((0, 0), (10, 0.5), (30, 1)):
    key(f, {'root': (0, -80 * a, 0), 'root.loc': (-0.25 * a, 0, -0.06 * a), 'head': (0, 0, -12 * a),
            'upperarm.L': (0, 0, 60 * a), 'upperarm.R': (0, 0, 70 * a), 'thigh.L': (0, 0, 20 * a), 'thigh.R': (0, 0, 10 * a)})
bpy.ops.object.mode_set(mode='OBJECT')
# cada ação vira um clipe (faixa NLA)
arm.animation_data.action = None
for name, a in acts.items():
    t = arm.animation_data.nla_tracks.new()
    t.name = name
    s = t.strips.new(name, int(a.frame_range[0]), a)
    s.name = name

# ---- fotos: parado, correndo e atirando (poses amostradas)
studio(res=(640, 640), samples=40)
bpy.context.scene.render.resolution_percentage = 100


def pose_frame(clip, f):
    arm.animation_data.action = acts[clip]
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    bpy.context.scene.frame_set(f)
    bpy.context.view_layer.update()


photo(os.path.join(OUT, 'raposa-parada.png'), (0.0, -3.0, 0.65), (0.0, 0, 0.62), lens=60) if False else None
for clip, f, tag in (('idle', 0, 'parada'), ('run', 3, 'correndo'), ('shoot', 2, 'atirando')):
    pose_frame(clip, f)
    photo(os.path.join(OUT, f'raposa-{tag}-lado.png'), (0.0, -3.2, 0.65), (0.0, 0, 0.62), lens=60)
pose_frame('idle', 0)
photo(os.path.join(OUT, 'raposa-34.png'), (2.0, -2.4, 1.1), (0.0, 0, 0.62), lens=60)
for t in arm.animation_data.nla_tracks:
    t.mute = False
arm.animation_data.action = None
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'fox.glb'), export_format='GLB', export_apply=True,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print('FEITO tris', tris, 'ossos', len(arm.data.bones), 'clipes', list(acts))
