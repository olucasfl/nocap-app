"""
Extrai o traçado da Bala Track do `.usdz` (spec 081, Fase 6B.1). Só ferramenta de trabalho:

    python -P -E tools/art/track/extract_track.py <scene.usdc> <saída.json> [imagem.png]

1. Rasteriza o asfalto do circuito visto de cima (as faixas de rodagem; o estacionamento e as pistas de fundo saem).
2. O complexo tem vários traçados ligados; o circuito de corrida é o das marcas de borracha (`rgroove_t1..t11`). Os
   pontos-guia abaixo (em pixels da imagem de conferência) seguem essas marcas na ordem da corrida, a partir da linha de
   largada (`startfinish_lane`), no sentido das marcas de grid (`mark_003..012`).
3. Cada ponto é puxado para o meio do asfalto (corte perpendicular); depois o caminho é adensado e recentrado de novo.
4. Escala: o comprimento da linha central vira ~1,2 km; a largura medida é conferida (alvo 12 a 14 m).
5. Pilhas de pneus (`medium_tyres_rubber`) perto da borda de cada lado viram trechos de barreira de pneus.
"""
import json
import sys
import zlib
import struct

import numpy as np

sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from usd_scene import load_meshes, xform_points  # noqa: E402

LO = np.array([-420.0, -590.0])
HI = np.array([640.0, 640.0])
S = 900
SC = (S - 1) / (HI - LO).max()
TARGET_LEN = 1200.0
WIDTH_TARGET = 12.5

# pontos-guia em pixels da imagem de conferência (x, y), na ordem da corrida
GUIDE = [
    (712, 428), (705, 560), (690, 640), (640, 680), (575, 690), (490, 690), (420, 712), (330, 765), (250, 800),
    (150, 840), (85, 800), (70, 720), (95, 650), (160, 630), (250, 605), (360, 580), (470, 555), (540, 520),
    (590, 460), (612, 400), (620, 320), (610, 250), (560, 190), (490, 160), (420, 190), (380, 240), (350, 300),
    (300, 400), (230, 480), (150, 515), (80, 490), (45, 410), (55, 300), (65, 180), (80, 90), (120, 50), (175, 55),
    (210, 100), (215, 170), (190, 230), (180, 280), (205, 330), (250, 330), (285, 290), (310, 230), (340, 160),
    (380, 100), (450, 65), (560, 65), (630, 90), (690, 170), (720, 260), (715, 350),
]

RES = 0.5  # unidades do arquivo por célula da máscara fina


def raster(mask, lo, res, P, T):
    H, W = mask.shape
    for t in T:
        a, b, c = (P[t] - lo) / res
        mn = np.floor(np.minimum(np.minimum(a, b), c)).astype(int)
        mx = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        mn = np.clip(mn, 0, [W - 1, H - 1])
        mx = np.clip(mx, 0, [W - 1, H - 1])
        if (mx - mn).prod() > 4_000_000:
            continue
        xs, ys = np.meshgrid(np.arange(mn[0], mx[0] + 1), np.arange(mn[1], mx[1] + 1))
        p = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
        v0, v1, v2 = c - a, b - a, p - a
        d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-12:
            continue
        d20, d21 = v2 @ v0, v2 @ v1
        u = (d11 * d20 - d01 * d21) / den
        v = (d00 * d21 - d01 * d20) / den
        ok = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6)
        mask[ys.ravel()[ok], xs.ravel()[ok]] = 1


def main(path, out_json, out_png=None):
    _, ms = load_meshes(path)
    lo = LO.copy()
    W = int((HI[0] - LO[0]) / RES) + 1
    H = int((HI[1] - LO[1]) / RES) + 1
    mask = np.zeros((H, W), np.uint8)
    for m in ms:
        n = m['name']
        if 'surfaces_asphalt' in m['path'] and ('TRKASPH002' in n or 'TRKBASPH' in n or 'asphalt_add' in n):
            raster(mask, lo, RES, m['P'][:, [0, 2]], m['T'])

    def on(pt):
        q = ((pt - lo) / RES).astype(int)
        return 0 <= q[0] < W and 0 <= q[1] < H and mask[q[1], q[0]] == 1

    def section(pt, d):
        """O corte perpendicular ao sentido `d` que passa em `pt`: as duas bordas do asfalto (ou None fora dele)."""
        if not on(pt):
            # procura o asfalto perto
            n = np.array([-d[1], d[0]])
            for r in np.arange(0.5, 40, 0.5):
                for sg in (1, -1):
                    if on(pt + n * r * sg):
                        pt = pt + n * r * sg
                        break
                else:
                    continue
                break
            else:
                return None
        n = np.array([-d[1], d[0]])
        a = 0.0
        while on(pt + n * (a + RES)) and a < 80:
            a += RES
        b = 0.0
        while on(pt - n * (b + RES)) and b < 80:
            b += RES
        return pt + n * (a - b) / 2, a + b

    guide = np.array([(x / SC + LO[0], y / SC + LO[1]) for x, y in GUIDE])
    # a linha de largada é o ponto 0
    sf = xform_points(path, ['startfinish_lane'])['startfinish_lane'][0][1]
    guide[0] = [sf[0], sf[2]]
    # adensa entre os pontos-guia e recentra várias vezes (a curva sai do meio do asfalto)
    pts = []
    n = len(guide)
    for i in range(n):
        a, b = guide[i], guide[(i + 1) % n]
        k = max(2, int(np.linalg.norm(b - a) / 4))
        for t in np.arange(k) / k:
            pts.append(a + (b - a) * t)
    pts = np.array(pts)
    widths = np.zeros(len(pts))
    for _ in range(6):
        new = pts.copy()
        for i in range(len(pts)):
            d = pts[(i + 1) % len(pts)] - pts[i - 1]
            d /= np.linalg.norm(d) + 1e-12
            r = section(pts[i], d)
            if r is not None:
                new[i], widths[i] = r
        # suaviza (média móvel) sem mexer no ponto da largada
        sm = new.copy()
        for i in range(1, len(new)):
            sm[i] = (new[i - 1] + 2 * new[i] + new[(i + 1) % len(new)]) / 4
        pts = sm
    # suavização forte: tira os zigue-zagues que a recentragem deixa perto das bifurcações
    for _ in range(10):
        sm = pts.copy()
        for i in range(1, len(pts)):
            sm[i] = np.mean([pts[(i + k) % len(pts)] for k in range(-3, 4)], axis=0)
        pts = sm
    seg = np.linalg.norm(np.roll(pts, -1, 0) - pts, axis=1)
    L = seg.sum()
    # a escala pela largura (alvo 12,5 m: cabem 3 karts lado a lado); com ela a volta fica ~1,4 a 1,5 km
    scale = WIDTH_TARGET / float(np.median(widths))
    wmed = float(np.median(widths)) * scale
    print(f'comprimento {L:.0f} unidades -> escala {scale:.4f} m/unidade; largura mediana {wmed:.1f} m '
          f'(p10 {np.percentile(widths, 10) * scale:.1f}, p90 {np.percentile(widths, 90) * scale:.1f})')
    # pontos de controle a cada ~12 m, em metros, centrados na largada; o sentido de +z do arquivo vira +z do jogo
    step_units = 12 / scale
    cps = [pts[0]]
    acc = 0.0
    for i in range(1, len(pts)):
        acc += seg[i - 1]
        if acc >= step_units:
            cps.append(pts[i])
            acc = 0.0
    cps = np.array(cps)
    origin = pts[0]
    cpm = (cps - origin) * scale

    # pilhas de pneus: do lado de cada ponto de controle onde há pneus perto da borda
    tyres = []
    for m in ms:
        if 'medium_tyres_rubber' in m['path']:
            c = m['P'][:, [0, 2]].mean(0)
            tyres.append(c)
    tyres = np.array(tyres)
    sides = []
    for i in range(len(cps)):
        d = cps[(i + 1) % len(cps)] - cps[i - 1]
        d /= np.linalg.norm(d) + 1e-12
        nrm = np.array([-d[1], d[0]])
        rel = tyres - cps[i]
        along = rel @ d
        lat = rel @ nrm
        near = (np.abs(along) < 8 / scale) & (np.abs(lat) < 22 / scale)
        sides.append((bool((near & (lat > 0)).any()), bool((near & (lat < 0)).any())))
    out = {
        'scale': scale,
        'origin': origin.round(3).tolist(),
        'lengthM': round(L * scale, 1),
        'widthM': round(wmed, 2),
        'points': cpm.round(2).tolist(),
        'tyreRight': [i for i, s in enumerate(sides) if s[0]],
        'tyreLeft': [i for i, s in enumerate(sides) if s[1]],
        'tyres': ((tyres - origin) * scale).round(2).tolist(),
    }
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(out, f)
    print('pontos de controle', len(cpm), '| pneus à direita', len(out['tyreRight']), 'à esquerda', len(out['tyreLeft']))
    if out_png:
        img = np.zeros((S, S, 3), np.uint8)
        small = mask[:: int(1 / (RES * SC)) or 1, :: int(1 / (RES * SC)) or 1]
        for yy in range(S):
            for xx in range(S):
                q = ((np.array([xx, yy]) / SC + LO - lo) / RES).astype(int)
                if 0 <= q[0] < W and 0 <= q[1] < H and mask[q[1], q[0]]:
                    img[yy, xx] = (90, 90, 100)
        for p in pts:
            q = ((p - LO) * SC).astype(int)
            img[max(0, q[1] - 1):q[1] + 2, max(0, q[0] - 1):q[0] + 2] = (255, 210, 0)
        q = ((pts[0] - LO) * SC).astype(int)
        img[q[1] - 5:q[1] + 6, q[0] - 5:q[0] + 6] = (255, 255, 255)
        q = ((pts[12] - LO) * SC).astype(int)
        img[q[1] - 4:q[1] + 5, q[0] - 4:q[0] + 5] = (0, 255, 0)
        raw = b''.join(b'\x00' + img[y].tobytes() for y in range(S))

        def chunk(t, d):
            return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

        open(out_png, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 2, 0, 0, 0))
                                  + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
        del small


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
