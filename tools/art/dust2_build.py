#!/usr/bin/env python3
"""
Mapa Dust 2 (modelo USDZ de terceiros, ver docs/CREDITS-3D.md): colisão, navegação, pontos de jogo e modelo 3D.

Entrada: pasta com scene.usdc e a subpasta 0/ das texturas (o .usdz descompactado). Precisa de `pip install usd-core numpy pillow` (só ferramenta).
Saída: packages/games/src/foxshot/dust2.data.ts e apps/web/public/models/foxshot/dust2/dust2.glb (+ imagem da planta feita por render_plan.mjs).

O modelo é feito de superfícies soltas (não de blocos fechados), então a colisão é a "pele": cada triângulo vira voxels (0,152 m na horizontal,
0,05 m na vertical, para o chão não flutuar), juntados em caixas. A escala e o encaixe foram achados casando a área andável com a da Duna
(0,072 m por unidade, giro de 270 graus); por isso o mapa usa as mesmas coordenadas da Duna e herda dela as bombas, as bases e os nascimentos.

Uso: python3 tools/art/dust2_build.py <pasta do usdz> <pasta de cache> [duna.json]
"""
import base64, io, json, math, os, pickle, struct, sys
import numpy as np
from PIL import Image

src, cache = sys.argv[1], sys.argv[2]
duna_json = sys.argv[3] if len(sys.argv) > 3 else os.path.join(cache, 'duna.json')
os.makedirs(cache, exist_ok=True)
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SC = 0.072                         # metros por unidade do modelo
R = 0.30423                        # célula de navegação (igual à da Duna)
BH = R / 2                         # voxel horizontal da colisão
BV = 0.05                          # voxel vertical
REG = {'zext': 99.75, 'dx': 5, 'dy': 23}   # encaixe sobre a grade da Duna
DUNA = json.load(open(duna_json))  # x0, z0, cols, rows, level (grade), tspawns, ctspawns, sites, buys
HEAD = 5                           # células livres para o corpo (1,5 m)
JUMP = 3                           # degrau máximo na navegação, em andares de 0,3 m (o pulo sobe ~0,95 m)

# ------------------------------------------------------------------ malhas (pxr) ou cache
mp = os.path.join(cache, 'meshes.pkl')
if not os.path.exists(mp):
    from pxr import Usd, UsdGeom, UsdShade
    st = Usd.Stage.Open(os.path.join(src, 'scene.usdc')); M = []
    for p in st.Traverse():
        if p.GetTypeName() != 'Mesh': continue
        m = UsdGeom.Mesh(p); xf = UsdGeom.Xformable(p).ComputeLocalToWorldTransform(0)
        pts = np.array([[*xf.Transform(q)] for q in m.GetPointsAttr().Get()], float)
        fvi = np.array(m.GetFaceVertexIndicesAttr().Get(), int).reshape(-1, 3)
        ua = p.GetAttribute('primvars:st0'); uv = np.array(ua.Get(), float); ia = p.GetAttribute('primvars:st0:indices')
        uvi = np.array(ia.Get(), int) if ia and ia.HasValue() else None
        if ua.GetMetadata('interpolation') == 'faceVarying': uvf = uv[uvi] if uvi is not None else uv
        else: uvf = (uv if uvi is None else uv[uvi])[fvi.reshape(-1)]
        mat = UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0]; tex = None
        if mat:
            for s in mat.GetPrim().GetChildren():
                a = s.GetAttribute('inputs:file')
                if a and a.Get(): tex = str(a.Get().path)
        M.append(dict(pts=pts, fvi=fvi, uv=uvf.reshape(-1, 3, 2), tex=tex))
    pickle.dump(M, open(mp, 'wb'))
M = pickle.load(open(mp, 'rb'))
mn = np.concatenate([m['pts'] for m in M]).min(0)
X0D, Z0D = DUNA['x0'], DUNA['z0']
def to_map(p):
    """unidades do modelo -> metros no referencial da Duna (x = x0 + dx*R + zext - z, z = z0 + dy*R + x); y a partir do menor ponto do modelo"""
    q = (p - mn) * SC
    return np.stack([X0D + REG['dx'] * R + REG['zext'] - q[..., 2], q[..., 1], Z0D + REG['dy'] * R + q[..., 0]], axis=-1)
T = [to_map(m['pts']) for m in M]
allp = np.concatenate(T)
print('modelo no referencial da Duna: x', allp[:, 0].min().round(1), allp[:, 0].max().round(1), 'y', allp[:, 1].min().round(1), allp[:, 1].max().round(1), 'z', allp[:, 2].min().round(1), allp[:, 2].max().round(1))

# grade da Duna (mesma origem e célula), ampliada se o modelo passar das bordas
gx0, gz0 = X0D, Z0D
need_x = int(math.ceil((allp[:, 0].max() - gx0) / R)) + 1; need_z = int(math.ceil((allp[:, 2].max() - gz0) / R)) + 1
cols, rows = max(DUNA['cols'], need_x), max(DUNA['rows'], need_z)
print('grade', cols, rows)

# ------------------------------------------------------------------ voxels da pele
vp = os.path.join(cache, 'skin.npy')
NJ, NI = int(math.ceil((allp[:, 0].max() - gx0) / BH)) + 2, int(math.ceil((allp[:, 2].max() - gz0) / BH)) + 2
NK = int(math.ceil(allp[:, 1].max() / BV)) + 2
if not os.path.exists(vp):
    STEP = 0.05; chunks = []
    for mi, (m, P) in enumerate(zip(M, T)):
        tri = P[m['fvi']]  # (n,3,3)
        a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
        ed = np.maximum(np.maximum(np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1)), np.linalg.norm(a - c, axis=1))
        n = np.maximum(1, np.ceil(ed / STEP).astype(int))
        for nn in np.unique(np.minimum(n, 400)):
            sel = (np.minimum(n, 400) == nn)
            A, B, C = a[sel], b[sel], c[sel]
            for ii in range(nn + 1):
                jj = np.arange(0, nn + 1 - ii)
                u = ii / nn; v = jj / nn
                pts = A[:, None, :] * (1 - u - v)[None, :, None] + B[:, None, :] * u + C[:, None, :] * v[None, :, None]
                pts = pts.reshape(-1, 3)
                j = np.floor((pts[:, 0] - gx0) / BH).astype(np.int64); i = np.floor((pts[:, 2] - gz0) / BH).astype(np.int64); k = np.floor(pts[:, 1] / BV).astype(np.int64)
                ok = (i >= 0) & (i < NI) & (j >= 0) & (j < NJ) & (k >= 0) & (k < NK)
                chunks.append(np.unique((i[ok] * NJ + j[ok]) * NK + k[ok]))
        if mi % 20 == 0:
            chunks = [np.unique(np.concatenate(chunks))]; print('malha', mi, len(chunks[0]), flush=True)
    sk = np.unique(np.concatenate(chunks)); np.save(vp, sk)
sk = np.load(vp)
print('voxels de pele', len(sk))
vk = sk % NK; vj = (sk // NK) % NJ; vi = sk // (NK * NJ)

# ------------------------------------------------------------------ navegação (grade de 0,304 m, andares de 0,304 m)
CH = R
cz, cx = rows, cols
cy = int(math.ceil(NK * BV / CH)) + 2
dense = np.zeros((cz, cx, cy), bool)
ci = vi // 2; cj = vj // 2; ck = np.floor((vk + 0.5) * BV / CH).astype(np.int64)
ok = (ci < cz) & (cj < cx)
dense[ci[ok], cj[ok], ck[ok]] = True
free = ~dense
def shift_and(a, axis, lo, hi):
    out = np.ones_like(a)
    for s in range(lo, hi + 1):
        sh = np.zeros_like(a); s_ = [slice(None)] * 3; d_ = [slice(None)] * 3
        if s >= 0: s_[axis] = slice(s, None); d_[axis] = slice(0, a.shape[axis] - s)
        else: s_[axis] = slice(0, a.shape[axis] + s); d_[axis] = slice(-s, None)
        sh[tuple(d_)] = a[tuple(s_)]; out &= sh
    return out
body = shift_and(free, 2, 0, HEAD - 1)
upper = shift_and(free, 2, 2, HEAD - 1)   # a partir de 0,6 m: o degrau/rampa do vizinho (1 andar) não conta como parede
# folga dos lados medida nas colunas finas (0,152 m): um quadrado de 0,6 m centrado na célula, livre a partir de 0,6 m de altura; assim o
# caminho dos bots não raspa em quina (o corpo tem 0,29 m de raio) e corredores de 1 m ainda passam
fine = np.zeros((cz * 2, cx * 2, cy), bool)
fi = vi; fj = vj; fok = (fi < cz * 2) & (fj < cx * 2)
fine[fi[fok], fj[fok], ck[fok]] = True
upf = shift_and(~fine, 2, 2, HEAD - 1)
blk = shift_and(shift_and(upf, 0, -1, 2), 1, -1, 2)
side = blk[0::2, 0::2][:cz, :cx]
below = np.zeros_like(dense); below[:, :, 1:] = dense[:, :, :-1]
stand = body & side & below
print('pontos de ficar em pé', int(stand.sum()))
np.save(os.path.join(cache, 'dense.npy'), dense); np.save(os.path.join(cache, 'stand.npy'), stand)

# ------------------------------------------------------------------ componente do jogo (a que tem as bombas e os nascimentos da Duna)
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
                if not (0 <= na < cz and 0 <= nb < cx): continue
                for dc in (-1, 0, 1):
                    nc = c + dc
                    if 0 <= nc < cy and stand[na, nb, nc] and not lab[na, nb, nc]:
                        if da and db:  # diagonal só passa se os dois lados também são chão (o A* dos bots não corta quina)
                            o1 = any(0 <= c + e < cy and stand[na, b, c + e] for e in (-1, 0, 1)); o2 = any(0 <= c + e < cy and stand[a, nb, c + e] for e in (-1, 0, 1))
                            if not (o1 and o2): continue
                        lab[na, nb, nc] = idn; q.append((na, nb, nc)); n += 1
    return n
sizes = {}
for t in np.argwhere(stand):
    t = tuple(t)
    if not lab[t]: sizes[len(sizes) + 1] = comp(t, len(sizes) + 1)
def lab_at(x, z):
    c = int((x - gx0) / R); r = int((z - gz0) / R)
    return [(int(lab[r, c, k]), k) for k in range(cy) if 0 <= r < cz and 0 <= c < cx and lab[r, c, k]]
votes = {}
for b in DUNA['sites'] + DUNA['buys']:
    for l, _ in lab_at((b[0] + b[2]) / 2, (b[1] + b[3]) / 2): votes[l] = votes.get(l, 0) + 1
main_id = max(votes, key=votes.get)
print('componentes', len(sizes), 'do jogo', main_id, sizes[main_id])
main = lab == main_id

# altura: Duna e esta grade medem o andar da mesma forma; a diferença típica (em andares) é o deslocamento vertical
dl = []; dlv = np.array([a for a, b in zip(DUNA['rle'][::2], DUNA['rle'][1::2]) for _ in range(b)]).reshape(DUNA['rows'], DUNA['cols'])
cnt = main.sum(2); kfirst = np.where(main, np.arange(cy)[None, None, :], 10 ** 6).min(axis=2)
DR, DC = DUNA['rows'], DUNA['cols']
single = (cnt[:DR, :DC] == 1) & (dlv != 255)
dif = dlv[single].astype(int) - kfirst[:DR, :DC][single]
vals, cn = np.unique(dif, return_counts=True); KOFF = int(vals[cn.argmax()])
print('deslocamento vertical (andares)', KOFF, 'confiança', round(cn.max() / cn.sum(), 3))
YOFF_K = int(round(KOFF * R / BV))      # em voxels finos (negativo: o chão do modelo fica acima do da Duna)
main = stand; cnt = main.sum(2)   # daqui em diante vale todo chão (caixas e muretos pulados ligam pedaços que a análise sem pulo separava)
# andares permitidos: onde a Duna tem chão, só o andar parecido com o dela (até 3 degraus de diferença); passarelas e telhados sobrepostos ficam de fora
duw = np.zeros((cz, cx), bool); duw[:DR, :DC] = dlv != 255
duw_near = duw.copy()
for _ in range(2):
    nn = duw_near.copy()
    for ax in range(2):
        for sg in (-1, 1): nn |= np.roll(duw_near, sg, axis=ax)
    duw_near = nn
dfull = np.full((cz, cx), 255, np.int32); dfull[:DR, :DC] = dlv
allowed = np.zeros(main.shape, bool)
WIN = 3   # os dois modelos diferem uns 0,5 m nas paredes: vale o andar da Duna num raio de ~0,9 m
for (r, c) in np.argwhere(cnt > 0):
    ks = np.flatnonzero(main[r, c])
    win = dfull[max(0, r - WIN):r + WIN + 1, max(0, c - WIN):c + WIN + 1]
    win = win[win != 255]
    if len(win) == 0: continue
    for k in ks:
        if np.abs(win - (k + KOFF)).min() <= 3: allowed[r, c, k] = True
# ligação no espaço 3D (degrau de 1 andar, diagonal só com os dois lados livres), a partir do nascimento TR
t0 = DUNA['tspawns'][0]; seed = None
for rr in range(int((t0[1] - gz0) / R) - 4, int((t0[1] - gz0) / R) + 5):
    for cc in range(int((t0[0] - gx0) / R) - 4, int((t0[0] - gx0) / R) + 5):
        if seed is None and 0 <= rr < cz and 0 <= cc < cx:
            for kk_ in np.flatnonzero(allowed[rr, cc]): seed = (rr, cc, int(kk_)); break
seen = {seed}; q = deque([seed])
while q:
    r, c, k = q.popleft()
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            for dk in range(-JUMP, JUMP + 1):   # caixas e muretos de até ~0,9 m se vence pulando
                m = (r + dr, c + dc, k + dk)
                if m in seen or not (0 <= m[0] < cz and 0 <= m[1] < cx and 0 <= m[2] < cy) or not allowed[m]: continue
                if dr and dc and not (any(0 <= k + e < cy and allowed[r + dr, c, k + e] for e in (-1, 0, 1)) and any(0 <= k + e < cy and allowed[r, c + dc, k + e] for e in (-1, 0, 1))): continue
                seen.add(m); q.append(m)
reached = np.zeros(main.shape, bool)
for m in seen: reached[m] = True
level = np.full((cz, cx), 255, np.int32)
for (r, c) in np.argwhere(reached.any(axis=2)):
    ks = np.flatnonzero(reached[r, c])
    k = ks[np.abs(ks + KOFF - dfull[r, c]).argmin()] if duw[r, c] else ks[0]  # sem chão na Duna: o mais baixo alcançado
    level[r, c] = int(min(254, max(0, k + KOFF)))
print('colunas ligadas ao nascimento TR', int((level != 255).sum()))
np.save(os.path.join(cache, 'main.npy'), main); np.save(os.path.join(cache, 'level_pre.npy'), level)
for nm, bs in (('bomba', DUNA['sites']), ('base', DUNA['buys'])):
    for b_ in bs:
        r_, c_ = int(((b_[1] + b_[3]) / 2 - gz0) / R), int(((b_[0] + b_[2]) / 2 - gx0) / R)
        print(nm, b_, 'ligada' if any(level[r_ + i, c_ + j] != 255 for i in range(-3, 4) for j in range(-3, 4)) else 'SEM CHÃO')
print('colunas andáveis', int((level != 255).sum()), 'altura máxima', round(float(level[level != 255].max()) * R, 2), 'm')

# ------------------------------------------------------------------ colisão: voxels da pele perto de onde se anda, juntados em caixas
walk2d = level != 255
near = walk2d.copy()
for _ in range(10):   # ~3 m em volta da área andável: paredes, tetos e beirais; o cenário distante fica só no desenho
    nn = near.copy()
    for ax in range(2):
        for sg in (-1, 1): nn |= np.roll(near, sg, axis=ax)
    near = nn
kk = vk + YOFF_K
sel = (kk >= 0) & (vi < cz * 2) & (vj < cx * 2) & near[np.minimum(vi // 2, cz - 1), np.minimum(vj // 2, cx - 1)]
bi, bj, bk = vi[sel], vj[sel], kk[sel]
print('voxels de colisão', len(bi), 'de', len(vi))
def merge(a, keys, run):
    """junta linhas vizinhas: a[:, run] consecutivo com as colunas `keys` iguais; devolve a primeira linha do grupo com a coluna `run` e `last`"""
    o = np.lexsort(tuple(a[:, c] for c in [run] + keys[::-1])); a = a[o]
    brk = np.ones(len(a), bool)
    if len(a) > 1:
        same = np.all(a[1:, keys] == a[:-1, keys], axis=1) & (a[1:, run] == a[:-1, run] + 1)
        brk[1:] = ~same
    start = np.flatnonzero(brk); end = np.r_[start[1:], len(a)] - 1
    return a[start], a[end, run]
# voxels já vêm em ordem (i, j, k): corridas em k
key = (bi * NJ + bj) * NK + bk; o = np.argsort(key); bi, bj, bk = bi[o], bj[o], bk[o]; key = key[o]
brk = np.r_[True, key[1:] != key[:-1] + 1]
st_ = np.flatnonzero(brk); en_ = np.r_[st_[1:], len(key)] - 1
runs = np.stack([bi[st_], bj[st_], bk[st_], bk[en_]], 1)            # i, j, k0, k1
# junta em j (mesmo i, k0, k1)
g, last = merge(runs, [0, 2, 3], 1); rects = np.stack([g[:, 0], g[:, 1], last, g[:, 2], g[:, 3]], 1)   # i, j0, j1, k0, k1
# junta em i (mesmos j0, j1, k0, k1)
g, last = merge(rects, [1, 2, 3, 4], 0); boxes = np.stack([g[:, 0], g[:, 1], g[:, 3], last, g[:, 2], g[:, 4]], 1)   # i0, j0, k0, i1, j1, k1
print('caixas', len(boxes))
boxes = boxes.astype(np.uint16)
boxes_b64 = base64.b64encode(boxes.tobytes()).decode()

# ------------------------------------------------------------------ nascimentos, bombas, bases (da Duna: o desenho é o mesmo)
def snap(x, z, taken):
    best = None
    for r in range(max(0, int((z - gz0) / R) - 6), min(cz, int((z - gz0) / R) + 7)):
        for c in range(max(0, int((x - gx0) / R) - 6), min(cx, int((x - gx0) / R) + 7)):
            if level[r, c] == 255: continue
            px, pz = gx0 + (c + 0.5) * R, gz0 + (r + 0.5) * R
            d = math.hypot(px - x, pz - z)
            if all(math.hypot(px - a, pz - b) > 1.0 for a, b in taken) and (best is None or d < best[0]): best = (d, px, pz)
    return best
def spawns_of(lst):
    out = []
    for x, z, yaw in lst:
        b = snap(x, z, [(a, c) for a, c, _ in out])
        if b: out.append((round(b[1], 2), round(b[2], 2), yaw))
    return out
tsp = spawns_of(DUNA['tspawns']); ctsp = spawns_of(DUNA['ctspawns'])
print('nascimentos TR', len(tsp), 'de', len(DUNA['tspawns']), 'CT', len(ctsp), 'de', len(DUNA['ctspawns']))
def rl(flat):
    out = []; i = 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        out += [int(flat[i]), j - i]; i = j
    return out
data = {
    'cols': cols, 'rows': rows, 'x0': round(gx0, 5), 'z0': round(gz0, 5), 'cell': R, 'step': R, 'bcell': round(BH, 5), 'bcellY': BV,
    'rle': rl(level.reshape(-1)), 'boxes': boxes_b64, 'tspawns': [list(p) for p in tsp], 'ctspawns': [list(p) for p in ctsp],
    'sites': DUNA['sites'], 'buys': DUNA['buys'], 'hmin': 0, 'maxStep': JUMP,
}
out_ts = os.path.join(root, 'packages/games/src/foxshot/dust2.data.ts')
open(out_ts, 'w').write('/* Gerado por tools/art/dust2_build.py: colisão e grade do mapa Dust 2 (não editar à mão). */\nexport const FS_DUST2_DATA: Record<string, unknown> = ' + json.dumps(data) + ';\n')
print('escrito', out_ts, os.path.getsize(out_ts) // 1024, 'KB')
np.save(os.path.join(cache, 'level.npy'), level)

# ------------------------------------------------------------------ GLB: todas as malhas, no referencial do mapa, texturas JPEG reduzidas e embutidas
TEX = int(os.environ.get('DUST2_TEX', '384'))
bin_parts = []; bv = []; accessors = []
def push(data, target=None):
    off = sum(len(b) for b in bin_parts); pad = (-off) % 4
    if pad: bin_parts.append(b'\0' * pad); off += pad
    bin_parts.append(data); bv.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), **({'target': target} if target else {})})
    return len(bv) - 1
def accessor(arr, ctype, atype, target=None, minmax=False):
    a = {'bufferView': push(arr.tobytes(), target), 'componentType': ctype, 'count': len(arr), 'type': atype}
    if minmax: a['min'] = arr.min(axis=0).tolist(); a['max'] = arr.max(axis=0).tolist()
    accessors.append(a); return len(accessors) - 1
images = []; textures = []; materials = []; prims = []; img_of = {}; mat_of = {}
for m, P in zip(M, T):
    tri = (P[m['fvi']] + np.array([0.0, YOFF_K * BV, 0.0])).astype(np.float32).reshape(-1, 3); uv = m['uv'].reshape(-1, 2).astype(np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
    # vértices repetidos viram um só (menos bytes)
    both = np.concatenate([np.round(tri, 3), uv], 1); uq, inv = np.unique(both, axis=0, return_inverse=True)
    pos = uq[:, :3].astype(np.float32); uvq = uq[:, 3:].astype(np.float32); idx = inv.reshape(-1)
    tex = m['tex']
    if tex not in mat_of:
        im = Image.open(os.path.join(src, tex)).convert('RGB')
        if max(im.size) > TEX: im.thumbnail((TEX, TEX), Image.LANCZOS)
        bio = io.BytesIO(); im.save(bio, 'JPEG', quality=78, optimize=True)
        images.append({'bufferView': push(bio.getvalue()), 'mimeType': 'image/jpeg'}); textures.append({'source': len(images) - 1, 'sampler': 0})
        materials.append({'pbrMetallicRoughness': {'baseColorTexture': {'index': len(textures) - 1}, 'metallicFactor': 0, 'roughnessFactor': 1}, 'doubleSided': True})
        mat_of[tex] = len(materials) - 1
    it = np.uint16 if len(pos) < 65535 else np.uint32
    prims.append({'attributes': {'POSITION': accessor(pos, 5126, 'VEC3', 34962, True), 'TEXCOORD_0': accessor(uvq, 5126, 'VEC2', 34962)},
                  'indices': accessor(idx.astype(it), 5123 if it is np.uint16 else 5125, 'SCALAR', 34963), 'material': mat_of[tex]})
gltf = {
    'asset': {'version': '2.0', 'generator': 'dust2_build.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'dust2'}],
    'meshes': [{'primitives': prims}], 'materials': materials, 'textures': textures, 'images': images,
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'accessors': accessors, 'bufferViews': bv, 'buffers': [{'byteLength': sum(len(b) for b in bin_parts)}],
}
js = json.dumps(gltf).encode(); js += b' ' * ((-len(js)) % 4)
binb = b''.join(bin_parts); binb += b'\0' * ((-len(binb)) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + binb
out_dir = os.path.join(root, 'apps/web/public/models/foxshot/dust2'); os.makedirs(out_dir, exist_ok=True)
open(os.path.join(out_dir, 'dust2.glb'), 'wb').write(glb)
print('glb', len(glb) // 1024, 'KB', len(prims), 'primitivas', len(images), 'texturas')
