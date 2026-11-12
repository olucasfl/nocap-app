"""Escreve `packages/games/src/foxgp/track-bala.ts` a partir do `kart-track.json` (spec 081, Fase 6B.2)."""
import json, sys

d = json.load(open(sys.argv[1], encoding='utf-8'))
pts = d['points']
n = len(pts)


def runs(idx, side):
    s = sorted(set(idx))
    out = []
    i = 0
    while i < len(s):
        j = i
        while j + 1 < len(s) and s[j + 1] == s[j] + 1:
            j += 1
        a, b = s[i], s[j]
        # um pouco antes e depois (a pilha cobre o trecho)
        out.append((max(0, a - 1), min(n - 1, b + 1), side))
        i = j + 1
    return out


walls = runs(d['tyreRight'], 1) + runs(d['tyreLeft'], -1)
lines = [
    "import type { GpTrackDef } from './track';",
    '',
    '/**',
    ' * Bala Track (spec 081, Fase 6B), a pista do Arcade: o circuito do `.usdz` (Karting Club Lider), extraído por',
    ' * `tools/art/track/extract_track.py` (linha central pelas marcas de borracha do circuito, recentrada no asfalto, escala',
    f" * pela largura: {d['scale']:.4f} m por unidade, {d['lengthM']:.0f} m de linha central). Pontos em metros a partir da",
    ' * linha de largada, no sentido da corrida. Sem box. As barreiras de pilha de pneus vêm das pilhas do arquivo.',
    ' * Arquivo gerado: não edite à mão (rode o script de novo).',
    ' */',
    'export const GP_TRACK_BALA: GpTrackDef = {',
    "  id: 'bala',",
    "  name: 'Bala Track',",
    '  points: [',
]
for x, z in pts:
    lines.append(f'    [{x}, {z}],')
lines += [
    '  ],',
    '  smooth: 3,',
    '  noCut: [],',
    '  limit: 11,',
    '  pit: null,',
    '  // placas de turbo no começo das quatro retas sem zebra (escolhidas pela curvatura da linha central)',
    '  pads: [',
    '    { s: 335, d: 0 },',
    '    { s: 638, d: 0 },',
    '    { s: 796, d: 0 },',
    '    { s: 1232, d: 0 },',
    '  ],',
    f'  sectors: [{n // 3}, {2 * n // 3}],',
    '  tyreWalls: [',
]
for a, b, sd in walls:
    lines.append(f'    {{ from: {a}, to: {b}, side: {sd} }},')
lines += ['  ],', '};', '']
open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('pontos', n, 'trechos de pneus', len(walls))
