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
from common import material, photo, reset, studio, flatten_for_gltf  # noqa: E402

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


def _from_bm(bm, name, mat, bone, M):
    import bmesh as _bm
    _bm.ops.transform(bm, matrix=M, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return _obj(o, name, mat, bone)


def ell(name, c, r, mat, bone, rot=(0, 0, 0), segs=(14, 8)):
    import bmesh as _bm
    from mathutils import Matrix
    bm = _bm.new()
    _bm.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1.0)
    M = Matrix.Translation(c) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((r[0], r[1], r[2], 1))
    return _from_bm(bm, name, mat, bone, M)


def limb(name, p0, p1, r0, r1, mat, bone, segs=(12, 8)):
    import bmesh as _bm
    from mathutils import Matrix
    a, b = Vector(p0), Vector(p1)
    v = b - a
    mid = (a + b) / 2
    q = Vector((0, 0, 1)).rotation_difference(v.normalized())
    rr = (r0 + r1) / 2
    bm = _bm.new()
    _bm.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1.0)
    M = Matrix.Translation(mid) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((rr, rr, v.length / 2 + rr * 0.7, 1))
    return _from_bm(bm, name, mat, bone, M)


def cone(name, c, r, h, mat, bone, rot):
    import bmesh as _bm
    from mathutils import Matrix
    bm = _bm.new()
    _bm.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=0.004, depth=h)
    M = Matrix.Translation(c) @ Euler(rot, 'XYZ').to_matrix().to_4x4()
    return _from_bm(bm, name, mat, bone, M)


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


def lowest_z():
    dg = bpy.context.evaluated_depsgraph_get()
    zs = []
    for o in bpy.data.objects:
        if o.type == 'MESH':
            ev = o.evaluated_get(dg)
            mw = ev.matrix_world
            zs += [(mw @ v.co).z for v in ev.data.vertices]
    return min(zs)


def wtail(name):
    bpy.context.view_layer.update()
    return arm.matrix_world @ pb[name].tail


def probe_rot(bone_name, axis, deg, point):
    """Quanto o ponto se mexe (mundo) quando a articulação gira `deg` graus no eixo `axis`."""
    reset_pose()
    base = wtail(point).copy()
    e = [0, 0, 0]
    e[axis] = math.radians(deg)
    pb[bone_name].rotation_euler = Euler(tuple(e), 'XYZ')
    d = wtail(point) - base
    reset_pose()
    return d


def probe_loc(bone_name, axis, amount, point):
    reset_pose()
    base = wtail(point).copy()
    v = [0, 0, 0]
    v[axis] = amount
    pb[bone_name].location = tuple(v)
    d = wtail(point) - base
    reset_pose()
    return d


# eixos reais do esqueleto (descobertos por medição, para não depender de convenções)
# queda do quadril: eixo e sinal em que a cabeça desce mais
_best = max(range(3), key=lambda i: abs(probe_loc('hips', i, -0.3, 'head').z))
HI, HS = _best, (1 if probe_loc('hips', _best, 0.3, 'head').z < 0 else -1)


def HLOC(down):
    v = [0.0, 0.0, 0.0]
    v[HI] = HS * down
    return tuple(v)


# subir o corpo inteiro (raiz): eixo e sinal em que a cabeça sobe
_best = max(range(3), key=lambda i: abs(probe_loc('root', i, 0.3, 'head').z))
RI, RS = _best, (1 if probe_loc('root', _best, 0.3, 'head').z > 0 else -1)


def RLOC(up):
    v = [0.0, 0.0, 0.0]
    v[RI] = RS * up
    return tuple(v)


# tombar de costas: eixo da raiz que leva a cabeça para trás (-X) e o sinal
_best = max(range(3), key=lambda i: abs(probe_rot('root', i, 60, 'head').x))
FI = _best
FB = 1 if probe_rot('root', FI, 60, 'head').x < 0 else -1   # sinal para cair de costas


def ROOTROT(deg_back):
    v = [0.0, 0.0, 0.0]
    v[FI] = FB * deg_back
    return tuple(v)


# braço para os lados: eixo X da articulação; descobre o sinal que afasta a mão do corpo
def side_sign(n):
    d = probe_rot(f'upperarm.{n}', 0, 40, f'hand.{n}')
    out = 1 if n == 'L' else -1
    return 1 if d.y * out > 0 else -1


SL, SR = side_sign('L'), side_sign('R')
print('EIXOS', 'quadril', HI, HS, 'raiz-sobe', RI, RS, 'tombo', FI, FB, 'braco', SL, SR)


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
        'hips.loc': HLOC(-0.02 * abs(math.cos(ph))), 'spine': (0, 0, -6 + 3 * math.cos(ph * 2)),
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
CROUCH_POSE = {'thigh.L': (0, 0, -78), 'shin.L': (0, 0, 120), 'foot.L': (0, 0, -42),
               'thigh.R': (0, 0, -78), 'shin.R': (0, 0, 120), 'foot.R': (0, 0, -42)}
# mede o quanto os pés ficam acima do chão com a queda do quadril de 0,31 m e ajusta (senão a raposa agachada flutua)
_t = action('tmp')
key(0, dict(CROUCH_POSE, **{'hips.loc': HLOC(0.31)}))
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
CD = 0.31 + lowest_z()
arm.animation_data.action = None
bpy.data.actions.remove(_t)
print('CROUCH DROP', CD)
# crouch: agachada segurando a arma (corpo desce ~0,35 m, joelhos dobrados; 40 quadros, respira)
acts['crouch'] = action('crouch')
for f, a in ((0, 0), (20, 1), (40, 0)):
    key(f, {'hips.loc': HLOC(CD), 'spine': (0, 0, -8 + 1.5 * a), 'chest': (0, 0, 1 * a),
            'thigh.L': (0, 0, -78), 'shin.L': (0, 0, 120), 'foot.L': (0, 0, -42),
            'thigh.R': (0, 0, -78), 'shin.R': (0, 0, 120), 'foot.R': (0, 0, -42),
            'upperarm.L': (0, 0, -50), 'forearm.L': (0, 0, -65), 'upperarm.R': (0, 0, -58), 'forearm.R': (0, 0, -62),
            'head': (0, 0, 6), 'tail1': (0, 0, 4 * a), 'tail2': (0, 0, 7 * a), 'tail3': (0, 0, 10 * a)})
# crouchwalk: anda agachada (24 quadros, repete): joelhos dobrados e passos curtos
acts['crouchwalk'] = action('crouchwalk')
for i, f in enumerate((0, 6, 12, 18, 24)):
    ph = i / 4 * 2 * math.pi
    sw = math.sin(ph)
    key(f, {'hips.loc': HLOC(CD - 0.015 * abs(math.cos(ph))), 'spine': (0, 0, -8),
            'thigh.L': (0, 0, -78 + 20 * sw), 'shin.L': (0, 0, 120 - 18 * sw), 'foot.L': (0, 0, -42),
            'thigh.R': (0, 0, -78 - 20 * sw), 'shin.R': (0, 0, 120 + 18 * sw), 'foot.R': (0, 0, -42),
            'upperarm.L': (0, 0, -50), 'forearm.L': (0, 0, -65), 'upperarm.R': (0, 0, -58), 'forearm.R': (0, 0, -62),
            'head': (0, 0, 6), 'tail1': (0, 0, 6 * sw), 'tail2': (0, 0, 9 * sw), 'tail3': (0, 0, 12 * sw)})
# jump: agacha, estica no ar, encolhe as pernas e amortece na aterrissagem (40 quadros, não repete)
acts['jump'] = action('jump')
ARMS = {'upperarm.L': (0, 0, -50), 'forearm.L': (0, 0, -65), 'upperarm.R': (0, 0, -58), 'forearm.R': (0, 0, -62)}
for f, hl, th, sh, ft, ar in ((0, 0, 0, 0, 0, 0), (7, -0.17, -50, 85, -32, 0), (13, 0.04, 8, 5, 25, 0), (22, 0.06, -42, 75, -10, 1), (32, 0.0, -10, 15, 5, 0), (37, -0.12, -45, 80, -30, 0), (40, 0, 0, 0, 0, 0)):
    d = dict(ARMS)
    d.update({'hips.loc': HLOC(-hl), 'thigh.L': (0, 0, th), 'shin.L': (0, 0, sh), 'foot.L': (0, 0, ft),
              'thigh.R': (0, 0, th), 'shin.R': (0, 0, sh), 'foot.R': (0, 0, ft),
              'spine': (0, 0, -10 if hl < 0 else -2), 'tail1': (0, 0, -10 * ar + 6), 'tail2': (0, 0, -14 * ar + 8)})
    key(f, d)
# hit: sacode para trás (12 quadros)
acts['hit'] = action('hit')
for f, a in ((0, 0), (3, 1), (12, 0)):
    key(f, {'spine': (0, 0, -14 * a), 'chest': (0, 0, -10 * a), 'head': (0, 0, -16 * a), 'tail1': (0, 0, -20 * a),
            'upperarm.L': (0, 0, 30 * a), 'upperarm.R': (0, 0, 30 * a)})
# death_back / death_front: a raposa fica mole e desaba (45 quadros, não repete). De costas quando o tiro vem de frente; de
# bruços quando vem de trás. O corpo termina deitado no chão, membros soltos.
def death_keys(sign, lift):
    """sign +1 cai de costas, -1 cai de bruços. lift sobe a raiz para o corpo deitado não entrar no chão."""
    arm_f = 1 if sign > 0 else -1
    out = []

    def pose(frame, tomb, spine, head, up_rz, fore, thigh, shin, spread, tail, rl):
        d = {'root': ROOTROT(sign * tomb), 'root.loc': RLOC(rl),
             'spine': (0, 0, 6 * sign * spine), 'chest': (0, 0, 4 * sign * spine), 'head': (0, 0, 10 * sign * head),
             'upperarm.L': (SL * spread, 0, arm_f * up_rz), 'upperarm.R': (SR * spread, 0, arm_f * up_rz),
             'forearm.L': (0, 0, arm_f * fore), 'forearm.R': (0, 0, arm_f * (fore + 8)),
             'thigh.L': (-8 * sign, 0, -thigh), 'thigh.R': (8 * sign, 0, -thigh * 0.5),
             'shin.L': (0, 0, shin), 'shin.R': (0, 0, shin * 1.3),
             'tail1': (0, 0, 14 * tail), 'tail2': (0, 0, 20 * tail), 'tail3': (0, 0, 26 * tail)}
        out.append((frame, d))

    #     frame tomb spine head up  fore thigh shin spread tail lift
    pose(0,   0,   0,    0,   0,   0,   0,    0,   0,     0,  0)
    pose(5,   22,  1.5,  1.5, 38,  28,  10,   14,  12,    1,  0)
    pose(12,  60,  2,    2,   75,  35,  30,   50,  30,    1.5, lift * 0.6)
    pose(19,  97,  1.5,  2.2, 40,  20,  14,   22,  42,    0.6, lift)
    pose(25,  84,  1,    1.5, 25,  30,  8,    12,  38,    -0.5, lift * 0.9)
    pose(32,  90,  0.8,  1.2, 18,  24,  6,    10,  40,    0.2, lift)
    pose(45,  90,  0.8,  1.2, 18,  24,  6,    10,  40,    0.2, lift)
    return out


def lowest_for(sign):
    t = action('tmp2')
    d = dict(death_keys(sign, 0.0))[45]
    key(0, d)
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    z = lowest_z()
    arm.animation_data.action = None
    bpy.data.actions.remove(t)
    return -z


for _name, _sign in (('death_back', 1), ('death_front', -1)):
    _lift = max(0.0, lowest_for(_sign))
    acts[_name] = action(_name)
    for _f, _d in death_keys(_sign, _lift):
        key(_f, _d)
    print('MORTE', _name, 'lift', _lift)
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
for clip, f, tag in (('idle', 0, 'parada'), ('run', 3, 'correndo'), ('shoot', 2, 'atirando'), ('crouch', 10, 'agachada'), ('death_back', 8, 'queda1'), ('death_back', 14, 'queda2'), ('death_back', 45, 'caida-costas'), ('death_front', 45, 'caida-bruços')):
    pose_frame(clip, f)
    photo(os.path.join(OUT, f'raposa-{tag}-lado.png'), (0.0, -3.2, 0.65), (0.0, 0, 0.62), lens=60)
pose_frame('idle', 0)
photo(os.path.join(OUT, 'raposa-34.png'), (2.0, -2.4, 1.1), (0.0, 0, 0.62), lens=60)
for t in arm.animation_data.nla_tracks:
    t.mute = False
arm.animation_data.action = None
flatten_for_gltf()
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'fox.glb'), export_format='GLB', export_apply=True,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print('FEITO tris', tris, 'ossos', len(arm.data.bones), 'clipes', list(acts))
