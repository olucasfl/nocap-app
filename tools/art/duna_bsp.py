#!/usr/bin/env python3
"""
Colisão exata do mapa novo, lida do próprio BSP do Counter-Strike (sem aproximar pelo desenho): a árvore do BSP diz, para qualquer ponto,
se ele está dentro de algo sólido (paredes, chão, caixas `func_wall`; o que é só enfeite, `func_illusionary`, não conta).
Passos: (1) amostra o espaço em voxels de 16 unidades do BSP (0,26 m); (2) acha onde se pode ficar em pé (chão sólido, 5 voxels livres
em cima e folga dos lados) e fica só com o que liga os nascimentos; (3) gera a grade de navegação dos bots; (4) junta os voxels sólidos
perto do espaço livre em caixas de colisão.

Uso: python3 tools/art/duna_bsp.py <pasta com o map.bsp>   (escreve packages/games/src/foxshot/duna.data.ts e /tmp/newmap/hmin.txt)
"""
import base64, json, math, os, re, struct, sys
import numpy as np

S_BSP = 1 / 2419.2     # unidade do BSP -> unidade do OBJ
K = 46.0               # metros por unidade do OBJ (o mapa original é 15% maior no jogo: o corpo do jogo é mais largo que o do CS e as passagens apertadas precisam caber)
M = S_BSP * K          # metros por unidade do BSP (0,01653)
BSP_CY, BSP_CX = -704.0, 876.0
Z_ABS0 = 645.25        # altura (BSP) que corresponde ao zero do modelo do OBJ
VOX = 16               # unidades do BSP por voxel
HEAD = 5               # voxels livres para o corpo (1,3 m)

src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = open(os.path.join(src, 'map.bsp'), 'rb').read()
lumps = [struct.unpack('<ii', d[4 + 8 * i:12 + 8 * i]) for i in range(15)]
def lump(i): return d[lumps[i][0]:lumps[i][0] + lumps[i][1]]

planes = np.frombuffer(lump(1), dtype=np.dtype([('n', '<f4', 3), ('d', '<f4'), ('t', '<i4')]))
nodes = np.frombuffer(lump(5), dtype=np.dtype([('p', '<i4'), ('c', '<i2', 2), ('mn', '<i2', 3), ('mx', '<i2', 3), ('f', '<u2'), ('nf', '<u2')]))
leaves = np.frombuffer(lump(10), dtype=np.dtype([('ct', '<i4'), ('vis', '<i4'), ('mn', '<i2', 3), ('mx', '<i2', 3), ('ms', '<u2'), ('nms', '<u2'), ('amb', 'u1', 4)]))
models = [struct.unpack('<9f4i3i', lump(14)[64 * i:64 * i + 64]) for i in range(lumps[14][1] // 64)]
ent = lump(0).decode('latin1').rstrip('\0')
ents = [dict(re.findall(r'"([^"]+)"\s+"([^"]*)"', m.group(1))) for m in re.finditer(r'\{([^}]*)\}', ent)]
print('nós', len(nodes), 'folhas', len(leaves), 'modelos', len(models))

pn = planes['n'].astype(np.float32); pd = planes['d'].astype(np.float32)
nplane = nodes['p']; nchild = nodes['c'].astype(np.int32)
leaf_solid = np.isin(leaves['ct'], (-2, -6))   # sólido e céu

def classify(P, head):
    """P: (n,3) pontos em unidades do BSP -> True onde está em folha sólida da árvore que começa em `head`."""
    n = len(P); cur = np.full(n, head, np.int32)
    out = np.zeros(n, bool)
    active = np.arange(n)
    while len(active):
        c = cur[active]
        pl = nplane[c]
        dist = (P[active] * pn[pl]).sum(axis=1) - pd[pl]
        ch = nchild[c, (dist < 0).astype(np.int32)]
        leaf = ch < 0
        li = (-1 - ch[leaf])
        out[active[leaf]] = leaf_solid[li]
        cur[active] = np.where(leaf, 0, ch)
        active = active[~leaf]
    return out

wm = models[0]
xmin, ymin, zmin = [int(math.floor(v / VOX) * VOX) for v in wm[0:3]]
xmax, ymax, zmax = [int(math.ceil(v / VOX) * VOX) for v in wm[3:6]]
nx, ny, nz = (xmax - xmin) // VOX, (ymax - ymin) // VOX, (zmax - zmin) // VOX
print('voxels', nx, ny, nz, nx * ny * nz // 1000, 'mil')

# amostra os voxels (centro de cada um) em pedaços
solid = np.zeros((nx, ny, nz), bool)
head0 = int(models[0][9])
xs = xmin + (np.arange(nx) + 0.5) * VOX
ys = ymin + (np.arange(ny) + 0.5) * VOX
zs = zmin + (np.arange(nz) + 0.5) * VOX
for i in range(nx):
    X, Y, Z = np.meshgrid(xs[i:i + 1], ys, zs, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1).astype(np.float32)
    solid[i] = classify(P, head0).reshape(ny, nz)
print('sólidos do mundo', int(solid.sum()))
# caixas e paredes soltas (func_wall): cada uma é um modelo com a própria árvore
fw = 0
for e in ents:
    if e.get('classname') == 'func_wall' and e.get('model', '').startswith('*'):
        mi = int(e['model'][1:]); m = models[mi]
        lo = [int(max(0, math.floor((m[a] - b) / VOX))) for a, b in ((0, xmin), (1, ymin), (2, zmin))]
        hi = [int(min(n, math.ceil((m[3 + a] - b) / VOX))) for a, b, n in ((0, xmin, nx), (1, ymin, ny), (2, zmin, nz))]
        if any(h <= l for l, h in zip(lo, hi)): continue
        X, Y, Z = np.meshgrid(xs[lo[0]:hi[0]], ys[lo[1]:hi[1]], zs[lo[2]:hi[2]], indexing='ij')
        P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1).astype(np.float32)
        hit = classify(P, int(m[9])).reshape(X.shape)
        solid[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]] |= hit
        fw += 1
print('func_wall somados', fw, 'sólidos', int(solid.sum()))

free = ~solid
# ------------------------------------------------------------------ onde se fica em pé
def shift_all(a, axis, lo, hi):
    """AND de a deslocado de lo..hi ao longo do eixo (voxels fora = False)."""
    out = np.ones_like(a)
    for s in range(lo, hi + 1):
        sh = np.zeros_like(a)
        src_sl = [slice(None)] * 3; dst_sl = [slice(None)] * 3
        if s >= 0: src_sl[axis] = slice(s, None); dst_sl[axis] = slice(0, a.shape[axis] - s)
        else: src_sl[axis] = slice(0, a.shape[axis] + s); dst_sl[axis] = slice(-s, None)
        sh[tuple(dst_sl)] = a[tuple(src_sl)]
        out &= sh
    return out
body = shift_all(free, 2, 0, HEAD - 1)                 # corpo cabe em pé: z .. z+4 livres
# folga dos lados (raio de 0,3 m): ao lado o pé pode estar um voxel mais alto (degrau/rampa), então só se exige livre de z+1 em diante
upper = shift_all(free, 2, 1, HEAD - 1)
side = shift_all(upper, 0, -1, 1)
side = shift_all(side, 1, -1, 1)
body = body & side
below = np.zeros_like(solid); below[:, :, 1:] = solid[:, :, :-1]
stand = body & below                                     # voxel k é onde os pés ficam (chão sólido logo abaixo)
print('pontos de ficar em pé', int(stand.sum()))

# nascimentos
def spawns(cls):
    out = []
    for e in ents:
        if e.get('classname') == cls:
            o = list(map(float, e['origin'].split())); ang = float(e.get('angles', '0 0 0').split()[1]) if e.get('angles') else 0.0
            out.append((o[0], o[1], o[2], ang))
    return out
T = spawns('info_player_deathmatch'); CT = spawns('info_player_start')

def vox(x, y, z): return int((x - xmin) // VOX), int((y - ymin) // VOX), int((z - zmin) // VOX)
def nearest_stand(x, y, z):
    i, j, k = vox(x, y, z); best = None; bd = 1e9
    for di in range(-6, 7):
        for dj in range(-6, 7):
            for dk in range(-8, 9):
                a, b, c = i + di, j + dj, k + dk
                if 0 <= a < nx and 0 <= b < ny and 0 <= c < nz and stand[a, b, c]:
                    dd = di * di + dj * dj + dk * dk
                    if dd < bd: bd = dd; best = (a, b, c)
    return best

# componente conexa (passos de até 1 voxel de altura, 8 direções)
seeds = [nearest_stand(*s[:3]) for s in T + CT]
seeds = [s for s in seeds if s]
print('sementes', len(seeds), 'de', len(T) + len(CT))
visited = np.zeros_like(stand)
stack = list(seeds)
for s in seeds: visited[s] = True
while stack:
    a, b, c = stack.pop()
    for da in (-1, 0, 1):
        for db in (-1, 0, 1):
            if not da and not db: continue
            na, nb = a + da, b + db
            if not (0 <= na < nx and 0 <= nb < ny): continue
            if da and db and not (stand[na, b, :].any() and stand[a, nb, :].any()): pass
            for dc in (-1, 0, 1):
                nc = c + dc
                if 0 <= nc < nz and stand[na, nb, nc] and not visited[na, nb, nc]:
                    visited[na, nb, nc] = True; stack.append((na, nb, nc))
print('andável ligado aos nascimentos:', int(visited.sum()))
# camada mais baixa de cada coluna
ks = np.where(visited, np.arange(nz)[None, None, :], 10 ** 6).min(axis=2)  # (nx, ny)
has = ks < 10 ** 6
kmin = int(ks[has].min())
print('k mínimo', kmin, 'k máximo', int(ks[has].max()))
level = np.where(has, ks - kmin, 255).astype(np.int32)
level = np.clip(level, 0, 254) if False else level

# ------------------------------------------------------------------ coordenadas do jogo
def gx(y): return (y - BSP_CY) * M
def gz(x): return (x - BSP_CX) * M
def gy_abs(z): return (z - Z_ABS0) * M
vox_m = VOX * M
# uma célula da grade do jogo: coluna (j do BSP y -> x do jogo, i do BSP x -> z do jogo)
grid = np.full((nx, ny), 255, np.uint8)
grid[has] = np.minimum(254, level[has])
# grade do jogo: linhas = z (BSP x = i), colunas = x (BSP y = j)
grid_game = grid  # grid[i, j]: linha i, coluna j
cols, rows = ny, nx
x0g, z0g = gx(ymin), gz(xmin)
hmin = gy_abs(zmin + kmin * VOX)  # altura absoluta (no mesmo referencial do GLB) do chão mais baixo
print('célula', round(vox_m, 4), 'm; grade', cols, 'x', rows, 'x0', round(x0g, 2), 'z0', round(z0g, 2), 'hmin', round(hmin, 3))

# ------------------------------------------------------------------ caixas: resolução dupla (meia célula) para o tiro e o corpo baterem com o visual
FV = VOX // 2
fnx, fny, fnz = nx * 2, ny * 2, nz * 2
fxs = xmin + (np.arange(fnx) + 0.5) * FV
fys = ymin + (np.arange(fny) + 0.5) * FV
fzs = zmin + (np.arange(fnz) + 0.5) * FV
fsolid = np.zeros((fnx, fny, fnz), bool)
for i in range(fnx):
    X, Y, Z = np.meshgrid(fxs[i:i + 1], fys, fzs, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1).astype(np.float32)
    fsolid[i] = classify(P, head0).reshape(fny, fnz)
for e in ents:
    if e.get('classname') == 'func_wall' and e.get('model', '').startswith('*'):
        mi = int(e['model'][1:]); m = models[mi]
        lo = [int(max(0, math.floor((m[a_] - b_) / FV))) for a_, b_ in ((0, xmin), (1, ymin), (2, zmin))]
        hi = [int(min(n_, math.ceil((m[3 + a_] - b_) / FV))) for a_, b_, n_ in ((0, xmin, fnx), (1, ymin, fny), (2, zmin, fnz))]
        if any(h <= l for l, h in zip(lo, hi)): continue
        X, Y, Z = np.meshgrid(fxs[lo[0]:hi[0]], fys[lo[1]:hi[1]], fzs[lo[2]:hi[2]], indexing='ij')
        P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1).astype(np.float32)
        fsolid[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]] |= classify(P, int(m[9])).reshape(X.shape)
np.save('/tmp/newmap/fsolid.npy', np.packbits(fsolid, axis=2))
json.dump({'x0': x0g, 'z0': z0g, 'bc': vox_m / 2, 'kmin_b': kmin * 2, 'shape': list(fsolid.shape)}, open('/tmp/newmap/fsolid.json', 'w'))
ffree = ~fsolid
fr = ffree.copy()
for _ in range(2):  # 2 voxels finos de casca (26 cm): chão e parede nunca são finos demais para o corpo
    nx_ = fr.copy()
    for ax in range(3):
        for sgn in (-1, 1):
            nx_ |= np.roll(fr, sgn, axis=ax)
    fr = nx_
shell = fsolid & fr
near2d = has.copy()
for _ in range(60):
    nxt = near2d.copy()
    for ax in range(2):
        for sgn in (-1, 1): nxt |= np.roll(near2d, sgn, axis=ax)
    near2d = nxt
near2f = np.repeat(np.repeat(near2d, 2, axis=0), 2, axis=1)
shell &= near2f[:, :, None]
shell[:, :, : max(0, kmin * 2 - 4)] = False
kmin_b = kmin * 2
# colisão fantasma: só fica o sólido que tem superfície VISÍVEL (do OBJ do desenho) a menos de ~30 cm
def visible_mask(dil=2):
    obj = [f for f in os.listdir(sys.argv[1]) if f.endswith('.obj')][0]
    V = []; F = []
    for line in open(os.path.join(sys.argv[1], obj)):
        if line.startswith('v '): V.append(list(map(float, line.split()[1:4])))
        elif line.startswith('f '):
            vi = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
            for k in range(1, len(vi) - 1): F.append((vi[0], vi[k], vi[k + 1]))
    V = np.array(V); F = np.array(F)
    G = np.stack([V[:, 1] * K, -V[:, 0] * K, V[:, 2] * K], axis=-1)
    G[:, 1] -= hmin
    vis = np.zeros(shell.shape, bool)
    bc = vox_m / 2
    def mark(P):
        ii = np.floor((P[:, 2] - z0g) / bc).astype(int); jj = np.floor((P[:, 0] - x0g) / bc).astype(int); kk = np.floor(P[:, 1] / bc).astype(int) + kmin_b
        ok = (ii >= 0) & (ii < vis.shape[0]) & (jj >= 0) & (jj < vis.shape[1]) & (kk >= 0) & (kk < vis.shape[2])
        vis[ii[ok], jj[ok], kk[ok]] = True
    A = G[F[:, 0]]; B = G[F[:, 1]]; C = G[F[:, 2]]
    edge = np.maximum(np.maximum(np.linalg.norm(B - A, axis=1), np.linalg.norm(C - B, axis=1)), np.linalg.norm(A - C, axis=1))
    for m in range(1, 40):
        sel = (np.ceil(edge / 0.08) == m) if m < 39 else (np.ceil(edge / 0.08) >= m)
        if not sel.any(): continue
        mm = min(m, 60)
        for i in range(mm + 1):
            for j in range(mm + 1 - i):
                u = i / mm; v = j / mm
                mark(A[sel] * (1 - u - v) + B[sel] * u + C[sel] * v)
    for _ in range(dil):  # voxels finos de folga
        nx_ = vis.copy()
        for ax in range(3):
            for sgn in (-1, 1): nx_ |= np.roll(vis, sgn, axis=ax)
        vis = nx_
    return vis
if os.environ.get('ALIGN'):
    v0 = visible_mask(0)
    sh1 = fsolid & np.roll(ffree_tmp := ~fsolid, 1, 0) if False else None
    surf = fsolid.copy(); free_ = ~fsolid
    adj = np.zeros_like(fsolid)
    for ax in range(3):
        for sg in (-1, 1): adj |= np.roll(free_, sg, axis=ax)
    surf &= adj
    surf &= near2f[:, :, None]
    best = None
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            for dz in range(-3, 4):
                m_ = np.roll(np.roll(np.roll(v0, dx, 0), dy, 1), dz, 2)
                # vizinhança de 1 voxel
                d_ = m_.copy()
                for ax in range(3):
                    for sg in (-1, 1): d_ |= np.roll(m_, sg, axis=ax)
                sc = int((surf & d_).sum())
                if best is None or sc > best[0]: best = (sc, dx, dy, dz)
                if (dx, dy, dz) == (0, 0, 0): print('sem deslocamento', sc, 'de', int(surf.sum()))
    print('melhor deslocamento (voxels finos i,j,k):', best)
    raise SystemExit
vis = visible_mask()
print('casca antes', int(shell.sum()), 'com superfície visível', int((shell & vis).sum()))
if os.environ.get('VIS'): shell &= vis
print('voxels de casca (finos)', int(shell.sum()))
kmin_b = kmin * 2   # origem vertical das caixas: em voxels finos

# junta em caixas: corridas ao longo de z (altura), depois em j, depois em i
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

# caixas em coordenadas de voxel: [i0, j0, k0-kmin, i1, j1, k1-kmin] (i1,j1,k1 inclusivos) -> Uint16
arr = np.array([[b[0], b[1], max(0, b[2] - kmin_b), b[3], b[4], b[5] - kmin_b] for b in boxes if b[5] - kmin_b >= 0], dtype=np.uint16)
boxes_b64 = base64.b64encode(arr.tobytes()).decode()

# grade em RLE
flat = grid_game.reshape(-1).tolist()
rle = []; i = 0
while i < len(flat):
    j = i
    while j < len(flat) and flat[j] == flat[i]: j += 1
    rle += [flat[i], j - i]; i = j

def bsp_to_game(bx, by): return (gx(by), gz(bx))
def zone_rect(model):
    m = models[model]; a = bsp_to_game(m[0], m[1]); b = bsp_to_game(m[3], m[4])
    return [round(min(a[0], b[0]), 2), round(min(a[1], b[1]), 2), round(max(a[0], b[0]), 2), round(max(a[1], b[1]), 2)]
sites = [zone_rect(int(e['model'][1:])) for e in ents if e.get('classname') == 'func_bomb_target']
buys = [zone_rect(int(e['model'][1:])) for e in ents if e.get('classname') == 'func_buyzone']
def sp(l):
    out = []
    for (bx, by, bz, ang) in l:
        x, z = bsp_to_game(bx, by); out.append([round(x, 2), round(z, 2), int(ang)])
    return out
data = {
    'cols': cols, 'rows': rows, 'x0': round(x0g, 4), 'z0': round(z0g, 4), 'cell': round(vox_m, 5), 'step': round(vox_m, 5),
    'rle': rle, 'boxes': boxes_b64, 'bcell': round(vox_m / 2, 5), 'tspawns': sp(T), 'ctspawns': sp(CT), 'sites': sites, 'buys': buys, 'hmin': round(hmin, 4),
}
out_ts = os.path.join(root, 'packages/games/src/foxshot/duna.data.ts')
open(out_ts, 'w').write('/* Gerado por tools/art/duna_bsp.py: colisão e grade do mapa novo (não editar à mão). */\nexport const FS_DUNA_DATA = ' + json.dumps(data) + ' as const;\n')
open('/tmp/newmap/hmin.txt', 'w').write(str(hmin))
print('escrito', out_ts, os.path.getsize(out_ts) // 1024, 'KB')

# imagem de conferência
from PIL import Image
img = np.zeros((rows, cols, 3), np.uint8) + 25
for r in range(rows):
    for c in range(cols):
        v = grid_game[r, c]
        if v != 255: img[r, c] = (40 + min(200, int(v) * 4), 90 + min(150, int(v) * 3), 120)
Image.fromarray(img).resize((cols * 2, rows * 2), Image.NEAREST).save('/tmp/newmap/grid2.png')
