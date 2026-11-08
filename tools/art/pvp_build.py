#!/usr/bin/env python3
"""
Mapa do modo PvP (mapa de mata-mata em blocos, feito por terceiros; ver docs/CREDITS-3D.md): colisão, navegação e modelo 3D.

Entrada: o OBJ gerado do FBX por `tools/art/fbx2obj.mjs` (posições em centímetros de bloco, 1 bloco = 100 unidades) e a pasta das texturas.
Saída:
  - packages/games/src/foxshot/pvp.data.ts  (grade de navegação, caixas de colisão, nascimentos de cada lado)
  - apps/web/public/models/foxshot/pvp/pvp.glb  (o desenho, com texturas embutidas)

Passos: (1) a superfície de cada triângulo vira voxels de 25 cm (com uma casca para dentro, para chão e parede não ficarem finos);
(2) acha onde se pode ficar em pé (grade de 25 cm, corpo de 1,5 m, folga dos lados) e fica só com o maior pedaço ligado;
(3) junta os voxels perto do espaço livre em caixas de colisão (mesma forma dos dados da Duna).

Uso: python3 tools/art/pvp_build.py <map.obj> <pasta das texturas>
"""
import base64, json, math, os, struct, sys
import numpy as np
from PIL import Image

S = 0.01          # unidade do OBJ -> metros (1 bloco = 1 m)
BC = 0.25         # voxel de colisão (m)
CELL = 0.25       # célula da grade de navegação (m)
YMAX = 6.0        # altura máxima simulada (m); acima disso ninguém chega
HEAD = 6          # células livres para o corpo na grade de navegação (1,5 m)

obj_path, tex_dir = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ------------------------------------------------------------------ OBJ
V = []; VT = []; faces = {}
cur = 'default'
for line in open(obj_path):
    if line.startswith('v '): V.append(list(map(float, line.split()[1:4])))
    elif line.startswith('vt '): VT.append(list(map(float, line.split()[1:3])))
    elif line.startswith('usemtl'): cur = line.split()[1]
    elif line.startswith('f '):
        t = [p.split('/') for p in line.split()[1:]]
        vi = [int(p[0]) - 1 for p in t]; ti = [int(p[1]) - 1 if len(p) > 1 and p[1] else 0 for p in t]
        for k in range(1, len(vi) - 1): faces.setdefault(cur, []).append((vi[0], vi[k], vi[k + 1], ti[0], ti[k], ti[k + 1]))
V = np.array(V) * S
VT = np.array(VT) if VT else np.zeros((1, 2))
print('modelo (m):', V.min(axis=0).round(2), V.max(axis=0).round(2))
X0, Z0 = math.floor(V[:, 0].min()), math.floor(V[:, 2].min())
X1, Z1 = math.ceil(V[:, 0].max()), math.ceil(V[:, 2].max())
Y0 = 0.0
nx = int(round((X1 - X0) / BC)); nz = int(round((Z1 - Z0) / BC)); ny = int(round(YMAX / BC))
print('voxels finos (z, x, y):', nz, nx, ny)

# ------------------------------------------------------------------ superfície -> voxels
solid = np.zeros((nz, nx, ny), bool)
allf = np.array([f[:3] for fl in faces.values() for f in fl])
A = V[allf[:, 0]]; B = V[allf[:, 1]]; C = V[allf[:, 2]]
N = np.cross(B - A, C - A); ln = np.linalg.norm(N, axis=1); ok = ln > 1e-9
A, B, C, N, ln = A[ok], B[ok], C[ok], N[ok], ln[ok]
N = N / ln[:, None]
edge = np.maximum(np.maximum(np.linalg.norm(B - A, axis=1), np.linalg.norm(C - B, axis=1)), np.linalg.norm(A - C, axis=1))
step = BC * 0.4

def mark(P):
    j = np.floor((P[:, 0] - X0) / BC).astype(np.int32); i = np.floor((P[:, 2] - Z0) / BC).astype(np.int32); k = np.floor((P[:, 1] - Y0) / BC).astype(np.int32)
    m = (i >= 0) & (i < nz) & (j >= 0) & (j < nx) & (k >= 0) & (k < ny)
    solid[i[m], j[m], k[m]] = True

m_max = int(math.ceil(edge.max() / step))
print('triângulos', len(A), 'maior aresta (m)', round(float(edge.max()), 1), 'passos', m_max)
for m in range(1, m_max + 1):
    sel = (np.ceil(edge / step) == m) if m < m_max else (np.ceil(edge / step) >= m)
    if not sel.any(): continue
    a, b, c, n = A[sel], B[sel], C[sel], N[sel]
    for ii in range(m + 1):
        for jj in range(m + 1 - ii):
            u = ii / m; v = jj / m
            p = a * (1 - u - v) + b * u + c * v
            mark(p)
            mark(p - n * BC)          # casca para dentro
print('voxels sólidos', int(solid.sum()))

# ------------------------------------------------------------------ onde se fica em pé (grade de 25 cm)
F = int(round(CELL / BC))
cz, cx, cy = nz // F, nx // F, ny // F
sc = solid[:cz * F, :cx * F, :cy * F].reshape(cz, F, cx, F, cy, F).any(axis=(1, 3, 5))
free = ~sc
def shift_and(a, axis, lo, hi):
    out = np.ones_like(a)
    for s in range(lo, hi + 1):
        sh = np.zeros_like(a)
        src = [slice(None)] * 3; dst = [slice(None)] * 3
        if s >= 0: src[axis] = slice(s, None); dst[axis] = slice(0, a.shape[axis] - s)
        else: src[axis] = slice(0, a.shape[axis] + s); dst[axis] = slice(-s, None)
        sh[tuple(dst)] = a[tuple(src)]
        out &= sh
    return out
body = shift_and(free, 2, 0, HEAD - 1)
upper = shift_and(free, 2, 1, HEAD - 1)
side = shift_and(shift_and(upper, 0, -1, 1), 1, -1, 1)
below = np.zeros_like(sc); below[:, :, 1:] = sc[:, :, :-1]
stand = body & side & below
print('pontos de ficar em pé', int(stand.sum()))

# maior componente conexa (passos de até 1 célula na altura)
from collections import deque
lab = np.zeros(stand.shape, np.int32)
def comp(seed, idn):
    q = deque([seed]); lab[seed] = idn; n = 1
    while q:
        a, b, c = q.popleft()
        for da in (-1, 0, 1):
            for db in (-1, 0, 1):
                if not da and not db: continue
                na, nb = a + da, b + db
                if not (0 <= na < stand.shape[0] and 0 <= nb < stand.shape[1]): continue
                for dc in (-1, 0, 1):
                    nc = c + dc
                    if 0 <= nc < stand.shape[2] and stand[na, nb, nc] and not lab[na, nb, nc]:
                        # diagonal só passa se os dois lados também são chão (o A* dos bots não corta quina)
                        if da and db:
                            ok1 = any(0 <= c + e < stand.shape[2] and stand[na, b, c + e] for e in (-1, 0, 1))
                            ok2 = any(0 <= c + e < stand.shape[2] and stand[a, nb, c + e] for e in (-1, 0, 1))
                            if not (ok1 and ok2): continue
                        lab[na, nb, nc] = idn; q.append((na, nb, nc)); n += 1
    return n
sizes = {}
idn = 0
for idx in np.argwhere(stand & (lab == 0))[::1]:
    t = tuple(idx)
    if lab[t]: continue
    idn += 1
    sizes[idn] = comp(t, idn)
    if idn > 400: break
main_id = max(sizes, key=sizes.get)
print('componentes', len(sizes), 'maior', sizes[main_id], 'segundo', sorted(sizes.values())[-2] if len(sizes) > 1 else 0)
visited = lab == main_id

ks = np.where(visited, np.arange(visited.shape[2])[None, None, :], 10 ** 6).min(axis=2)
has = ks < 10 ** 6
level = np.where(has, np.minimum(ks, 254), 255).astype(np.int32)
print('altura máxima do chão andável (m)', round(float(ks[has].max()) * CELL, 2))

# ------------------------------------------------------------------ caixas de colisão (casca de 2 voxels, voxels finos)
ffree = ~solid
fr = ffree.copy()
for _ in range(2):
    nxt = fr.copy()
    for ax in range(3):
        for sg in (-1, 1): nxt |= np.roll(fr, sg, axis=ax)
    fr = nxt
shell = solid & fr
# só onde alguém chega (a área andável ampliada) e abaixo de 12 m
near = has.copy()
for _ in range(6):
    nn = near.copy()
    for ax in range(2):
        for sg in (-1, 1): nn |= np.roll(near, sg, axis=ax)
    near = nn
nearf = np.repeat(np.repeat(near, F, axis=0), F, axis=1)
shell[:nearf.shape[0], :nearf.shape[1]] &= nearf[:, :, None]
print('voxels de casca', int(shell.sum()))

idx = np.argwhere(shell)
order = np.lexsort((idx[:, 2], idx[:, 1], idx[:, 0]))
idx = idx[order]
col_runs = {}
for a, b, c in idx:
    key = (int(a), int(b))
    lst = col_runs.setdefault(key, [])
    if lst and lst[-1][1] == c - 1: lst[-1][1] = int(c)
    else: lst.append([int(c), int(c)])
by_i = {}
for (a, b), lst in col_runs.items():
    for (k0, k1) in lst: by_i.setdefault(a, {}).setdefault((k0, k1), []).append(b)
row_rects = {}
for a, dd in by_i.items():
    for (k0, k1), bs in dd.items():
        bs.sort(); s = bs[0]; p = bs[0]
        for b in bs[1:] + [None]:
            if b is not None and b == p + 1: p = b; continue
            row_rects.setdefault((k0, k1, s, p), []).append(a)
            if b is not None: s = p = b
boxes = []
for (k0, k1, j0, j1), ais in row_rects.items():
    ais.sort(); s = ais[0]; p = ais[0]
    for a in ais[1:] + [None]:
        if a is not None and a == p + 1: p = a; continue
        boxes.append((s, j0, k0, p, j1, k1))
        if a is not None: s = p = a
print('caixas', len(boxes))
arr = np.array([[b[0], b[1], b[2], b[3], b[4], b[5]] for b in boxes], dtype=np.uint16)
boxes_b64 = base64.b64encode(arr.tobytes()).decode()

# ------------------------------------------------------------------ nascimentos: dois lados nas pontas do eixo comprido (z)
cols, rows = cx, cz
zs = Z0 + (np.arange(rows) + 0.5) * CELL
xs = X0 + (np.arange(cols) + 0.5) * CELL
walk_cols = np.argwhere(has)   # (i = linha z, j = coluna x)
def pick(side, n=12):
    zlim = (Z1 - Z0) * 0.18
    cand = [(i, j) for i, j in walk_cols if (zs[i] < Z0 + zlim if side == 0 else zs[i] > Z1 - zlim)]
    # os mais próximos da ponta, espalhados (mínimo 2,5 m entre eles)
    cand.sort(key=lambda t: (zs[t[0]] - Z0) if side == 0 else (Z1 - zs[t[0]]))
    out = []
    for (i, j) in cand[:20000]:
        x, z = xs[j], zs[i]
        if all(math.hypot(x - a, z - b) > 2.5 for a, b, _ in out):
            out.append((x, z, 0 if side == 0 else 180))
        if len(out) >= n: break
    return out
sideA = pick(0); sideB = pick(1)
print('nascimentos A', len(sideA), 'B', len(sideB))

def rect(pts, m=3.0):
    xs_ = [p[0] for p in pts]; zs_ = [p[1] for p in pts]
    return [round(min(xs_) - m, 2), round(min(zs_) - m, 2), round(max(xs_) + m, 2), round(max(zs_) + m, 2)]
def rl(flat):
    out = []; i = 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        out += [flat[i], j - i]; i = j
    return out
data = {
    'cols': cols, 'rows': rows, 'x0': X0, 'z0': Z0, 'cell': CELL, 'step': CELL, 'bcell': BC,
    'rle': rl(level.reshape(-1).tolist()), 'boxes': boxes_b64,
    'tspawns': [[round(x, 2), round(z, 2), a] for x, z, a in sideA], 'ctspawns': [[round(x, 2), round(z, 2), a] for x, z, a in sideB],
    'sites': [], 'buys': [rect(sideA), rect(sideB)], 'hmin': 0,
}
out_ts = os.path.join(root, 'packages/games/src/foxshot/pvp.data.ts')
open(out_ts, 'w').write('/* Gerado por tools/art/pvp_build.py: colisão e grade do mapa do modo PvP (não editar à mão). */\nexport const FS_PVP_DATA = ' + json.dumps(data) + ' as const;\n')
print('escrito', out_ts, os.path.getsize(out_ts) // 1024, 'KB')

# ------------------------------------------------------------------ imagem de conferência
img = np.zeros((rows, cols, 3), np.uint8) + 20
sol2d = sc[:, :, 0:int(3 / CELL)].any(axis=2)
img[sol2d] = (60, 60, 80)
lv = np.where(has, level, 0)
img[has] = np.stack([90 + np.minimum(150, lv[has] * 4), 110 + np.minimum(120, lv[has] * 3), 120 * np.ones(lv[has].shape, int)], axis=1).astype(np.uint8)
for x, z, _ in sideA: img[int((z - Z0) / CELL), int((x - X0) / CELL)] = (255, 80, 40)
for x, z, _ in sideB: img[int((z - Z0) / CELL), int((x - X0) / CELL)] = (60, 140, 255)
Image.fromarray(img).resize((cols * 2, rows * 2), Image.NEAREST).save('/tmp/pvpmap/plan.png')

# ------------------------------------------------------------------ GLB (texturas embutidas)
MAT_TEX = {
    'Green_Terracotta_29_JE1_BE1.webp': 'green_terracotta.png', 'Diorite_29_JE4_BE3.webp': 'DeathMatchMapMinecraft_Diorite_29_JE4_BE3.png',
    'Stone_29_JE5_BE3.webp': 'Stone_29_JE5_BE3.png', 'ladder (1).png': 'ladder_(1).png',
}
mat_file = json.load(open('/tmp/pvpmap/materials.json'))
bin_parts = []; bv = []; accessors = []
def push(data, target=None):
    off = sum(len(b) for b in bin_parts)
    pad = (-off) % 4
    if pad: bin_parts.append(b'\0' * pad); off += pad
    bin_parts.append(data)
    bv.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), **({'target': target} if target else {})})
    return len(bv) - 1
def accessor(arr, ctype, atype, target=None, minmax=False):
    a = {'bufferView': push(arr.tobytes(), target), 'componentType': ctype, 'count': len(arr), 'type': atype}
    if minmax: a['min'] = arr.min(axis=0).tolist(); a['max'] = arr.max(axis=0).tolist()
    accessors.append(a); return len(accessors) - 1
images = []; textures = []; materials = []; prims = []; img_idx = {}
for name, fl in faces.items():
    f = np.array(fl)
    pos = (V[f[:, 0:3].reshape(-1)]).astype(np.float32)
    uv = VT[f[:, 3:6].reshape(-1)].astype(np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
    tex = mat_file.get(name, '')
    tex = MAT_TEX.get(tex, tex)
    path = os.path.join(tex_dir, tex)
    if not os.path.exists(path):
        low = {x.lower(): x for x in os.listdir(tex_dir)}
        path = os.path.join(tex_dir, low.get(tex.lower(), '__x__'))
    mat = {'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}, 'doubleSided': True}
    if os.path.exists(path):
        if path not in img_idx:
            im = Image.open(path).convert('RGBA')
            import io
            bio = io.BytesIO(); im.save(bio, 'PNG')
            has_alpha = np.array(im)[..., 3].min() < 250
            bvi = push(bio.getvalue())
            images.append({'bufferView': bvi, 'mimeType': 'image/png'})
            textures.append({'source': len(images) - 1, 'sampler': 0})
            img_idx[path] = (len(textures) - 1, has_alpha)
        ti, ha = img_idx[path]
        mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': ti}
        if ha: mat['alphaMode'] = 'MASK'; mat['alphaCutoff'] = 0.5
    else:
        mat['pbrMetallicRoughness']['baseColorFactor'] = [0.7, 0.68, 0.62, 1]
    materials.append(mat)
    prims.append({'attributes': {'POSITION': accessor(pos, 5126, 'VEC3', 34962, True), 'TEXCOORD_0': accessor(uv, 5126, 'VEC2', 34962)}, 'material': len(materials) - 1})
gltf = {
    'asset': {'version': '2.0', 'generator': 'pvp_build.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'pvp'}],
    'meshes': [{'primitives': prims}], 'materials': materials, 'textures': textures, 'images': images,
    'samplers': [{'magFilter': 9728, 'minFilter': 9986, 'wrapS': 10497, 'wrapT': 10497}],
    'accessors': accessors, 'bufferViews': bv, 'buffers': [{'byteLength': sum(len(b) for b in bin_parts)}],
}
js = json.dumps(gltf).encode(); js += b' ' * ((-len(js)) % 4)
binb = b''.join(bin_parts); binb += b'\0' * ((-len(binb)) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + binb
out_dir = os.path.join(root, 'apps/web/public/models/foxshot/pvp'); os.makedirs(out_dir, exist_ok=True)
open(os.path.join(out_dir, 'pvp.glb'), 'wb').write(glb)
print('glb', len(glb) // 1024, 'KB', len(prims), 'primitivas')
