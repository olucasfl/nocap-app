"""Converte um .usdz/.usdc de uma malha com UMA textura PBR em .glb para o three.js (sem Blender): usa pxr (usd-core), numpy e pillow.
Usado para a C4 do modo Bomba do Counter Fox (modelo enviado pelo Lucas, fora do repositório).

    pip install usd-core numpy pillow
    python tools/art/usdz_to_glb.py <pasta com scene.usdc e 0/*.jpg> <saida.glb> [tamanho_em_metros=0.5] [lado_da_textura=512]
"""
import io
import json
import struct
import sys
import os

import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom

src, out = sys.argv[1], sys.argv[2]
target = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
tex = int(sys.argv[4]) if len(sys.argv) > 4 else 512

st = Usd.Stage.Open(os.path.join(src, 'scene.usdc'))
prim = [p for p in st.Traverse() if p.GetTypeName() == 'Mesh'][0]
mesh = UsdGeom.Mesh(prim)
xf = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(0)
mpu = UsdGeom.GetStageMetersPerUnit(st)
pts = np.array([[*xf.Transform(p)] for p in mesh.GetPointsAttr().Get()], dtype=np.float64) * mpu
nrm_local = np.array(mesh.GetNormalsAttr().Get(), dtype=np.float64)
# normais pela parte de rotação da matriz (sem escala)
rot = np.array([[xf[i][j] for j in range(3)] for i in range(3)])
rot = rot / np.linalg.norm(rot, axis=1, keepdims=True)
nrm = nrm_local @ rot
nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
uv_attr = prim.GetAttribute('primvars:st0')
uv = np.array(uv_attr.Get(), dtype=np.float32)
interp = uv_attr.GetMetadata('interpolation')
fvi = np.array(mesh.GetFaceVertexIndicesAttr().Get(), dtype=np.int64)
if interp == 'faceVarying':
    # uma UV por canto de face: separa os vértices
    idx_attr = prim.GetAttribute('primvars:st0:indices')
    uvi = np.array(idx_attr.Get(), dtype=np.int64) if idx_attr and idx_attr.HasValue() else np.arange(len(fvi))
    keys = {}
    P, N, U, I = [], [], [], []
    for k in range(len(fvi)):
        key = (int(fvi[k]), int(uvi[k]))
        if key not in keys:
            keys[key] = len(P)
            P.append(pts[fvi[k]])
            N.append(nrm[fvi[k]])
            U.append(uv[uvi[k]])
        I.append(keys[key])
    pts, nrm, uv, fvi = np.array(P), np.array(N), np.array(U), np.array(I)
# centraliza em x/z, apoia no chão e escala o maior lado horizontal para `target` metros
mn, mx = pts.min(0), pts.max(0)
size = mx - mn
horiz = max(size[0], size[2])
s = target / horiz
pts = (pts - np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])) * s
pts = pts.astype(np.float32)
nrm = nrm.astype(np.float32)
uv = uv.astype(np.float32)
uv[:, 1] = 1 - uv[:, 1]  # USD tem o V para cima; glTF para baixo
idx = fvi.astype(np.uint32)

def jpg(path, size=tex):
    im = Image.open(path).convert('RGB')
    im.thumbnail((size, size))
    b = io.BytesIO()
    im.save(b, 'JPEG', quality=82)
    return b.getvalue(), im.size

d0 = os.path.join(src, '0')
base, _ = jpg(os.path.join(d0, 'None_baseColor.jpg'))
nor, _ = jpg(os.path.join(d0, 'None_normal_scale1_norm.jpg'))
emi, _ = jpg(os.path.join(d0, 'None_emissive.jpg'))
# metal/rugosidade/oclusão separadas viram um mapa só: R oclusão, G rugosidade, B metal
def gray(name):
    im = Image.open(os.path.join(d0, name)).convert('L')
    im.thumbnail((tex, tex))
    return im
rough = gray('None_metallicRoughness_rough.jpg')
metal = gray('None_metallicRoughness_metal_scale0.jpg').resize(rough.size)
occl = gray('None_metallicRoughness_occl.jpg').resize(rough.size)
mr = Image.merge('RGB', (occl, rough, metal))
b = io.BytesIO()
mr.save(b, 'JPEG', quality=82)
mrj = b.getvalue()

chunks = []
views = []
def add(data, target=None):
    while sum(len(c) for c in chunks) % 4:
        chunks.append(b'\x00')
    off = sum(len(c) for c in chunks)
    chunks.append(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target:
        v['target'] = target
    views.append(v)
    return len(views) - 1

vp = add(pts.tobytes(), 34962)
vn = add(nrm.tobytes(), 34962)
vu = add(uv.tobytes(), 34962)
vi = add(idx.tobytes(), 34963)
imgs = [add(base), add(nor), add(emi), add(mrj)]
gltf = {
    'asset': {'version': '2.0', 'generator': 'nocap tools/art/usdz_to_glb.py'},
    'scene': 0,
    'scenes': [{'nodes': [0]}],
    'nodes': [{'mesh': 0, 'name': 'C4'}],
    'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
    'materials': [{
        'name': 'C4',
        'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 3}, 'metallicFactor': 1, 'roughnessFactor': 1},
        'normalTexture': {'index': 1},
        'occlusionTexture': {'index': 3},
        'emissiveTexture': {'index': 2},
        'emissiveFactor': [1, 1, 1],
    }],
    'textures': [{'source': i, 'sampler': 0} for i in range(4)],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'images': [{'bufferView': v, 'mimeType': 'image/jpeg'} for v in imgs],
    'accessors': [
        {'bufferView': vp, 'componentType': 5126, 'count': len(pts), 'type': 'VEC3', 'min': pts.min(0).tolist(), 'max': pts.max(0).tolist()},
        {'bufferView': vn, 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
        {'bufferView': vu, 'componentType': 5126, 'count': len(uv), 'type': 'VEC2'},
        {'bufferView': vi, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'},
    ],
    'bufferViews': views,
}
binary = b''.join(chunks)
binary += b'\x00' * ((4 - len(binary) % 4) % 4)
gltf['buffers'] = [{'byteLength': len(binary)}]
js = json.dumps(gltf).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
open(out, 'wb').write(glb)
print('ok', out, len(glb) // 1024, 'KB', 'tamanho', (mx - mn) * s, 'verts', len(pts), 'tris', len(idx) // 3)
