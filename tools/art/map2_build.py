#!/usr/bin/env python3
"""
Converte o mapa novo (OBJ + texturas + BSP do Counter-Strike) para o jogo, sem Blender:
  1. apps/web/public/models/foxshot/map2/map2.glb  -> o desenho (todos os materiais, texturas embutidas)
  2. packages/games/src/foxshot/map2.data.ts       -> grade de colisão/navegação (0,5 m), spawns e bombas lidos do BSP

Uso: python3 tools/art/map2_build.py <pasta com o OBJ, o MTL e o map.bsp> <pasta das texturas>
O OBJ vem com o eixo vertical em X (para baixo = +X). Aqui: x_jogo = Y, y_jogo = -X, z_jogo = Z, escala K metros por unidade.
"""
import json, math, os, re, struct, sys
import numpy as np
from PIL import Image

K = 40.0                  # metros por unidade do OBJ (o mapa fica com uns 100 m de lado)
S_BSP = 1 / 2419.2        # unidade do BSP -> unidade do OBJ
BSP_CY, BSP_CX = -704.0, 876.0
CELL = 0.5
STEP = 0.15               # altura de cada degrau de chão (m)
HEAD = 1.45               # folga mínima de teto para andar
MAXSLOPE = 0.34           # desnível máximo entre células vizinhas (m): cabe no stepUp do movimento

src, tex_dir = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
obj_path = [f for f in os.listdir(src) if f.endswith('.obj')][0]
mtl_path = [f for f in os.listdir(src) if f.endswith('.mtl')][0]

# ------------------------------------------------------------------ OBJ
V = []; VT = []; faces = {}  # material -> lista de (i,j,k, ti,tj,tk)
cur = 'default'
for line in open(os.path.join(src, obj_path)):
    if line.startswith('v '): V.append(list(map(float, line.split()[1:4])))
    elif line.startswith('vt '): VT.append(list(map(float, line.split()[1:3])))
    elif line.startswith('usemtl'): cur = line.split()[1]
    elif line.startswith('f '):
        t = [p.split('/') for p in line.split()[1:]]
        vi = [int(p[0]) - 1 for p in t]; ti = [int(p[1]) - 1 if len(p) > 1 and p[1] else 0 for p in t]
        for k in range(1, len(vi) - 1):
            faces.setdefault(cur, []).append((vi[0], vi[k], vi[k + 1], ti[0], ti[k], ti[k + 1]))
V = np.array(V); VT = np.array(VT) if VT else np.zeros((1, 2))

def to_game(p):
    p = np.asarray(p)
    return np.stack([p[..., 1] * K, -p[..., 0] * K, p[..., 2] * K], axis=-1)

G = to_game(V)  # x, y(up), z em metros
print('mapa em metros:', G.min(axis=0).round(1), G.max(axis=0).round(1))

# ------------------------------------------------------------------ amostras por célula
x0, z0 = -50.0, -46.9
cols, rows = int(math.ceil(100.0 / CELL)), int(math.ceil(93.8 / CELL))
floors = [[[] for _ in range(cols)] for _ in range(rows)]
walls = [[[] for _ in range(cols)] for _ in range(rows)]
ceils = [[[] for _ in range(cols)] for _ in range(rows)]

def add(lst, x, y, z):
    c = int((x - x0) / CELL); r = int((z - z0) / CELL)
    if 0 <= c < cols and 0 <= r < rows: lst[r][c].append(y)

for mat, fl in faces.items():
    for (a, b, c, *_t) in fl:
        A, B, C = G[a], G[b], G[c]
        n = np.cross(B - A, C - A); ln = np.linalg.norm(n)
        if ln < 1e-9: continue
        n /= ln
        edge = max(np.linalg.norm(B - A), np.linalg.norm(C - B), np.linalg.norm(A - C))
        m = max(1, int(math.ceil(edge / 0.2)))
        lst = floors if n[1] > 0.6 else ceils if n[1] < -0.6 else walls
        for i in range(m + 1):
            for j in range(m + 1 - i):
                u = i / m; v = j / m; w = 1 - u - v
                p = A * w + B * u + C * v
                add(lst, p[0], p[1], p[2])
print('amostras prontas', cols, rows)

# camadas de chão por célula: alturas agrupadas a cada 0,12 m, com folga de cabeça e sem parede no corpo
def clusters(vals):
    vals = sorted(vals); out = []
    for v in vals:
        if out and v - out[-1][-1] < 0.12: out[-1].append(v)
        else: out.append([v])
    return [(float(np.median(c)), len(c)) for c in out if len(c) >= 2]

layers = {}  # (c,r) -> lista de alturas válidas
blockedwall = {}  # (c,r,i) camadas com parede
for r in range(rows):
    for c in range(cols):
        fl = clusters(floors[r][c])
        if not fl: continue
        good = []
        for (h, _n) in fl:
            # teto, outro chão ou parede baixa dentro da altura do corpo?
            low_ceiling = any(h + 0.45 < y < h + HEAD for y in ceils[r][c]) or any(h + 0.45 < hh < h + HEAD for (hh, _m) in fl if hh > h)
            if low_ceiling: continue
            wall_hits = sum(1 for y in walls[r][c] if h + 0.35 < y < h + 1.3)
            good.append((h, wall_hits >= 2))
        if good: layers[(c, r)] = good

# componente conexa a partir dos nascimentos do BSP
d = open(os.path.join(src, 'map.bsp'), 'rb').read()
lumps = [struct.unpack('<ii', d[4 + 8 * i:12 + 8 * i]) for i in range(15)]
ent = d[lumps[0][0]:lumps[0][0] + lumps[0][1]].decode('latin1').rstrip('\0')
ents = []
for m in re.finditer(r'\{([^}]*)\}', ent):
    ents.append(dict(re.findall(r'"([^"]+)"\s+"([^"]*)"', m.group(1))))
models = [struct.unpack('<9f4i3i', d[lumps[14][0] + 64 * i:lumps[14][0] + 64 * i + 64]) for i in range(lumps[14][1] // 64)]

def bsp_to_game(bx, by):
    return ((by - BSP_CY) * S_BSP * K, (bx - BSP_CX) * S_BSP * K)

def spawns(cls):
    out = []
    for e in ents:
        if e.get('classname') == cls:
            o = list(map(float, e['origin'].split())); gx, gz = bsp_to_game(o[0], o[1]); out.append((gx, gz, int(e.get('angles', '0 0 0').split()[1]) if e.get('angles') else 0))
    return out
T = spawns('info_player_deathmatch'); CT = spawns('info_player_start')
print('spawns T', len(T), 'CT', len(CT))

def cell_of(x, z): return int((x - x0) / CELL), int((z - z0) / CELL)

# grafo (célula, camada)
nodes = {}
for (c, r), ls in layers.items():
    for i, (h, w) in enumerate(ls):
        if not w: nodes[(c, r, i)] = h
def neighbors(c, r, i):
    h = nodes[(c, r, i)]
    for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        nc, nr = c + dc, r + dr
        if (nc, nr) not in layers: continue
        if dc and dr and not (((c + dc, r) in layers) and ((c, r + dr) in layers)): continue
        for j, (hh, w) in enumerate(layers[(nc, nr)]):
            if not w and abs(hh - h) <= MAXSLOPE and (nc, nr, j) in nodes: yield (nc, nr, j)

def nearest_node(x, z, rad=3):
    c0, r0 = cell_of(x, z); best = None; bd = 1e9
    for r in range(r0 - rad, r0 + rad + 1):
        for c in range(c0 - rad, c0 + rad + 1):
            for i in range(len(layers.get((c, r), []))):
                if (c, r, i) in nodes:
                    dd = (c - c0) ** 2 + (r - r0) ** 2
                    if dd < bd: bd = dd; best = (c, r, i)
    return best

seeds = [nearest_node(x, z) for (x, z, _a) in T + CT]
seeds = [s for s in seeds if s]
comp = {}; cid = 0
for s in seeds:
    if s in comp: continue
    cid += 1; stack = [s]; comp[s] = cid
    while stack:
        n = stack.pop()
        for m in neighbors(*n):
            if m not in comp: comp[m] = cid; stack.append(m)
sizes = {}
for v in comp.values(): sizes[v] = sizes.get(v, 0) + 1
print('componentes a partir dos spawns', sizes, 'T e CT na mesma?', len({comp.get(s) for s in seeds}) == 1)
main = max(sizes, key=sizes.get)
keep = {n for n, v in comp.items() if v == main}
# se T e CT ficaram em componentes diferentes, junta todas as que têm spawn
keep = {n for n, v in comp.items()}

# nível por célula: a camada mais baixa dentro da componente
hmin = min(nodes[n] for n in keep)
cellh = {}
for (c, r, i) in keep:
    h = nodes[(c, r, i)] - hmin
    if (c, r) not in cellh or h < cellh[(c, r)]: cellh[(c, r)] = h
LV = {k: int(round(v / STEP)) for k, v in cellh.items()}
# garante degraus vizinhos de no máximo 2 níveis (andável): relaxa para baixo
changed = True; it = 0
while changed and it < 40:
    changed = False; it += 1
    for (c, r), lv in list(LV.items()):
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            o = LV.get((c + dc, r + dr))
            if o is not None and lv - o > 2:
                LV[(c, r)] = o + 2; lv = o + 2; changed = True
print('células andáveis', len(LV), 'níveis máx', max(LV.values()), 'iterações', it)

# ------------------------------------------------------------------ saída: grade
grid = np.full((rows, cols), 255, np.uint8)  # 255 = parede
for (c, r), lv in LV.items(): grid[r, c] = min(254, lv)
flat = grid.reshape(-1).tolist()
rle = []
i = 0
while i < len(flat):
    j = i
    while j < len(flat) and flat[j] == flat[i]: j += 1
    rle += [flat[i], j - i]
    i = j

def zone_rect(model, pad=0.0):
    m = models[model]; a = bsp_to_game(m[0], m[1]); b = bsp_to_game(m[3], m[4])
    return [round(min(a[0], b[0]) - pad, 2), round(min(a[1], b[1]) - pad, 2), round(max(a[0], b[0]) + pad, 2), round(max(a[1], b[1]) + pad, 2)]
sites = [(i, zone_rect(int(e['model'][1:]))) for i, e in enumerate([e for e in ents if e.get('classname') == 'func_bomb_target'])]
buys = [zone_rect(int(e['model'][1:])) for e in ents if e.get('classname') == 'func_buyzone']
print('bombas', sites, 'compra', buys)
data = {
    'cols': cols, 'rows': rows, 'x0': x0, 'z0': z0, 'cell': CELL, 'step': STEP,
    'rle': rle,
    'tspawns': [[round(x, 2), round(z, 2), a] for (x, z, a) in T],
    'ctspawns': [[round(x, 2), round(z, 2), a] for (x, z, a) in CT],
    'sites': [s for _i, s in sites], 'buys': buys, 'hmin': round(hmin, 3),
}
out_ts = os.path.join(root, 'packages/games/src/foxshot/map2.data.ts')
open(out_ts, 'w').write('/* Gerado por tools/art/map2_build.py: grade do mapa novo (não editar à mão). */\nexport const FS_MAP2_DATA = ' + json.dumps(data) + ' as const;\n')
print('grade escrita', out_ts, len(rle) // 2, 'trechos')

# imagem de conferência
img = np.zeros((rows, cols, 3), np.uint8) + 25
for r in range(rows):
    for c in range(cols):
        v = grid[r, c]
        if v != 255: img[r, c] = (40 + min(200, v * 3), 90 + min(150, v * 2), 120)
for (x, z, _a) in T:
    c, r = cell_of(x, z)
    if 0 <= c < cols and 0 <= r < rows: img[r, c] = (255, 140, 40)
for (x, z, _a) in CT:
    c, r = cell_of(x, z)
    if 0 <= c < cols and 0 <= r < rows: img[r, c] = (60, 140, 255)
for k, rect in enumerate([s for _i, s in sites]):
    for z in np.arange(rect[1], rect[3], CELL):
        for x in np.arange(rect[0], rect[2], CELL):
            c, r = cell_of(x, z)
            if 0 <= c < cols and 0 <= r < rows: img[r, c] = (255, 60, 60)
Image.fromarray(img).resize((cols * 4, rows * 4), Image.NEAREST).save('/tmp/newmap/grid.png')

# ------------------------------------------------------------------ saída: GLB
mats = {}
for line in open(os.path.join(src, mtl_path)):
    if line.startswith('newmtl'): cm = line.split()[1]; mats[cm] = {}
    elif line.startswith('map_Kd'): mats[cm]['tex'] = line.split()[1]
    elif line.startswith('Kd'): mats[cm]['kd'] = list(map(float, line.split()[1:4]))

bin_parts = []; bufviews = []; accessors = []; images = []; textures = []; materials = []; prims = []; img_idx = {}
def push(data, target=None):
    pad = (-sum(len(p) for p in bin_parts)) % 4
    if pad: bin_parts.append(b'\0' * pad)
    off = sum(len(p) for p in bin_parts)
    bin_parts.append(data)
    bufviews.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), **({'target': target} if target else {})})
    return len(bufviews) - 1
def accessor(arr, ctype, atype, target=None, minmax=False):
    bv = push(arr.tobytes(), target)
    a = {'bufferView': bv, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': atype}
    if minmax: a['min'] = arr.min(axis=0).tolist(); a['max'] = arr.max(axis=0).tolist()
    accessors.append(a); return len(accessors) - 1

off_y = hmin
for name, fl in faces.items():
    f = np.array(fl)
    tri_v = f[:, 0:3]; tri_t = f[:, 3:6]
    pos = G[tri_v.reshape(-1)].astype(np.float32).copy(); pos[:, 1] -= off_y
    P = pos.reshape(-1, 3, 3)
    uv = VT[tri_t.reshape(-1)].astype(np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
    mat = mats.get(name, {})
    if 'tex' in mat:
        tp = os.path.join(tex_dir, mat['tex'])
        if tp not in img_idx and os.path.exists(tp):
            im = Image.open(tp)
            has_alpha = im.mode in ('RGBA', 'LA') and np.array(im.convert('RGBA'))[..., 3].min() < 250
            bv = push(open(tp, 'rb').read())
            images.append({'bufferView': bv, 'mimeType': 'image/png'}); textures.append({'source': len(images) - 1, 'sampler': 0})
            img_idx[tp] = (len(textures) - 1, has_alpha)
    m = {'name': name, 'doubleSided': True, 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.9}}
    tp = os.path.join(tex_dir, mat.get('tex', ''))
    if tp in img_idx:
        ti, ha = img_idx[tp]
        m['pbrMetallicRoughness']['baseColorTexture'] = {'index': ti}
        if ha: m['alphaMode'] = 'MASK'; m['alphaCutoff'] = 0.5
    materials.append(m)
    prims.append({'attributes': {'POSITION': accessor(pos, 5126, 'VEC3', 34962, True), 'TEXCOORD_0': accessor(uv, 5126, 'VEC2', 34962)}, 'material': len(materials) - 1})

gltf = {
    'asset': {'version': '2.0', 'generator': 'map2_build.py'},
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'map2'}],
    'meshes': [{'primitives': prims}], 'materials': materials, 'textures': textures, 'images': images,
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'accessors': accessors, 'bufferViews': bufviews, 'buffers': [{'byteLength': sum(len(p) for p in bin_parts)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * ((-len(js)) % 4)
binb = b''.join(bin_parts); binb += b'\0' * ((-len(binb)) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + binb
out_dir = os.path.join(root, 'apps/web/public/models/foxshot/map2'); os.makedirs(out_dir, exist_ok=True)
open(os.path.join(out_dir, 'map2.glb'), 'wb').write(glb)
print('glb', len(glb) // 1024, 'KB', len(prims), 'primitivas')
