#!/usr/bin/env python3
"""
Granada de fumaça (modelo `sci-fi-smoke-grenade` enviado pelo Lucas, FBX + texturas PBR): converte para apps/web/public/models/foxshot/ref/smoke.glb,
em pé (o comprimento do FBX está no eixo X), com 15 cm de altura como as outras granadas, a cor base reduzida a 512 px e normais suaves.

Uso (o OBJ sai de `tools/art/fbx2obj.mjs`, rodado de apps/web com o script copiado para lá):
    python3 tools/art/smoke_grenade_build.py <smoke.obj> <DefaultMaterial_Base_Color.png> [saida.glb]
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

obj, tex = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'apps/web/public/models/foxshot/ref/smoke.glb')
HEIGHT = 0.15
V, VT, F = [], [], []
for l in open(obj):
    if l.startswith('v '): V.append(list(map(float, l.split()[1:4])))
    elif l.startswith('vt '): VT.append(list(map(float, l.split()[1:3])))
    elif l.startswith('f '):
        t = [p.split('/') for p in l.split()[1:]]
        vi = [int(p[0]) - 1 for p in t]; ti = [int(p[1]) - 1 if len(p) > 1 and p[1] else 0 for p in t]
        for k in range(1, len(vi) - 1): F.append((vi[0], vi[k], vi[k + 1], ti[0], ti[k], ti[k + 1]))
V = np.array(V); VT = np.array(VT)
# o comprimento (X) vira a altura (Y): (x, y, z) -> (y, x, -z), uma rotação; centrado e na escala de 15 cm
V = np.stack([V[:, 1], V[:, 0], -V[:, 2]], 1)
mn, mx = V.min(0), V.max(0)
V = (V - (mn + mx) / 2) * (HEIGHT / (mx[1] - mn[1]))
F = np.array(F)
pos = V[F[:, 0:3].reshape(-1)].astype(np.float32)
uv = VT[F[:, 3:6].reshape(-1)].astype(np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
# normais suaves por posição (peso pela área)
fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
nv = np.zeros_like(V)
for k in range(3): np.add.at(nv, F[:, k], fn)
nv /= np.maximum(np.linalg.norm(nv, axis=1, keepdims=True), 1e-9)
nrm = nv[F[:, 0:3].reshape(-1)].astype(np.float32)
im = Image.open(tex).convert('RGB'); im.thumbnail((512, 512), Image.LANCZOS)
bio = io.BytesIO(); im.save(bio, 'JPEG', quality=88)
parts = []; views = []; acc = []
def push(data, target=None):
    off = sum(len(b) for b in parts); pad = (-off) % 4
    if pad: parts.append(b'\0' * pad); off += pad
    parts.append(data); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), **({'target': target} if target else {})}); return len(views) - 1
def accessor(arr, ctype, atype, minmax=False):
    a = {'bufferView': push(arr.tobytes(), 34962), 'componentType': ctype, 'count': len(arr), 'type': atype}
    if minmax: a['min'] = arr.min(axis=0).tolist(); a['max'] = arr.max(axis=0).tolist()
    acc.append(a); return len(acc) - 1
prim = {'attributes': {'POSITION': accessor(pos, 5126, 'VEC3', True), 'NORMAL': accessor(nrm, 5126, 'VEC3'), 'TEXCOORD_0': accessor(uv, 5126, 'VEC2')}, 'material': 0}
img = push(bio.getvalue())
gltf = {
    'asset': {'version': '2.0', 'generator': 'smoke_grenade_build.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'smoke'}],
    'meshes': [{'primitives': [prim]}], 'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.35, 'roughnessFactor': 0.6}}],
    'textures': [{'source': 0, 'sampler': 0}], 'images': [{'bufferView': img, 'mimeType': 'image/jpeg'}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'accessors': acc, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(b) for b in parts)}],
}
js = json.dumps(gltf).encode(); js += b' ' * ((-len(js)) % 4)
b = b''.join(parts); b += b'\0' * ((-len(b)) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(b)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(b), 0x004E4942) + b
open(out, 'wb').write(glb)
print('smoke.glb', len(glb) // 1024, 'KB', len(F), 'triângulos; tamanho', (V.max(0) - V.min(0)).round(3))
