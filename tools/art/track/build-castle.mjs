/**
 * Castle Circuit (spec 086, F1): lê o `.fbx` e gera
 *  - `packages/games/src/foxgp/track-castle.ts` (linha central em metros, alturas e placas de turbo);
 *  - `apps/web/public/foxgp/castle/` (cenário compacto em dois pacotes: `core` para todos e `detail` só no computador).
 * Uso: cd apps/web && node ../../tools/art/track/build-castle.mjs <castlecircuit.fbx> <pasta-das-texturas>
 * A estrada vira duas bordas (arestas de bordo da malha, que nunca se cruzam, nem na ponte), pareadas vértice a vértice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {}, style: {} }) };
globalThis.window = { URL: { createObjectURL: () => 'blob:x' } };
const [fbxPath, texDir] = process.argv.slice(2);
const OUT_TS = path.resolve('../../packages/games/src/foxgp/track-castle.ts');
const OUT_DIR = path.resolve('public/foxgp/castle');
const HALF = 7; // GP_HALF_WIDTH

const buf = fs.readFileSync(fbxPath);
const root = new FBXLoader(new THREE.LoadingManager()).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
const byName = (n) => { let r; root.traverse((o) => { if (o.isMesh && o.name === n) r = o; }); return r; };

// ---------- 1. linha central ----------
const road = byName('CastleRoad');
const g0 = road.geometry.clone(); g0.applyMatrix4(road.matrixWorld);
const P = g0.attributes.position.array;
const IDX = g0.index ? Array.from(g0.index.array) : Array.from({ length: P.length / 3 }, (_, i) => i);
const vid = new Map(); const pos = [];
const id = (i) => { const k = `${Math.round(P[i * 3] * 100)},${Math.round(P[i * 3 + 1] * 100)},${Math.round(P[i * 3 + 2] * 100)}`; let v = vid.get(k); if (v === undefined) { v = pos.length; vid.set(k, v); pos.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); } return v; };
const edges = new Map();
const addE = (a, b) => { const k = a < b ? `${a}_${b}` : `${b}_${a}`; edges.set(k, (edges.get(k) || 0) + 1); };
for (let t = 0; t < IDX.length; t += 3) { const a = id(IDX[t]), b = id(IDX[t + 1]), c = id(IDX[t + 2]); addE(a, b); addE(b, c); addE(c, a); }
const adj = new Map();
for (const [k, n] of edges) if (n === 1) { const [a, b] = k.split('_').map(Number); (adj.get(a) ?? adj.set(a, []).get(a)).push(b); (adj.get(b) ?? adj.set(b, []).get(b)).push(a); }
const loops = []; const used = new Set();
for (const s of adj.keys()) {
  if (used.has(s)) continue;
  const loop = [s]; used.add(s); let prev = -1; let cur = s;
  for (;;) { const nx = adj.get(cur).find((w) => w !== prev && !used.has(w)); if (nx === undefined) break; loop.push(nx); used.add(nx); prev = cur; cur = nx; }
  loops.push(loop);
}
if (loops.length !== 2) throw new Error(`esperava 2 bordas, achei ${loops.length}`);
const A = loops[0].map((v) => pos[v]);
const B = loops[1].map((v) => pos[v]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pairs = A.map((a) => { let bi = 0, bd = Infinity; B.forEach((b, i) => { const d = d3(a, b); if (d < bd) { bd = d; bi = i; } }); return { a, b: B[bi], w: bd }; });
const widths = pairs.map((p) => p.w).sort((x, y) => x - y);
const W = widths[Math.floor(widths.length / 2)];
let center = pairs.map((p) => [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2]);
const K = (2 * HALF) / W; // metros por unidade
// linha de largada: o ponto da linha central mais perto de StartLine
const sb = new THREE.Box3().setFromObject(byName('StartLine')); const sc = sb.getCenter(new THREE.Vector3());
let s0 = 0, sd = Infinity; center.forEach((c, i) => { const d = Math.hypot(c[0] - sc.x, c[2] - sc.z); if (d < sd) { sd = d; s0 = i; } });
center = center.slice(s0).concat(center.slice(0, s0));
// sentido da corrida: o da malha (a tela mostra a volta); anti-horário visto de cima fica como está
const O = center[0];
const toM = (x, z) => [(x - O[0]) * K, (z - O[2]) * K];
let cum = 0; const pts = center.map((c, i) => { if (i) cum += Math.hypot(c[0] - center[i - 1][0], c[2] - center[i - 1][2]) * K; return toM(c[0], c[2]); });
const heights = center.map((c) => (c[1] - O[1]) * K);
console.log(`largura ${W.toFixed(2)} un, ${K.toFixed(4)} m/un, ${center.length} pontos, volta ~${Math.round(cum)} m, altura ${Math.min(...heights).toFixed(1)}..${Math.max(...heights).toFixed(1)} m`);

// placas de turbo: projeta cada BoostPad na linha central
const padList = [];
root.traverse((o) => {
  if (!o.isMesh || !o.name.startsWith('BoostPad')) return;
  const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  let bi = 0, bd = Infinity; center.forEach((q, i) => { const d = Math.hypot(q[0] - c.x, q[2] - c.z, (q[1] - c.y) * 2); if (d < bd) { bd = d; bi = i; } });
  const [px, pz] = toM(c.x, c.z); const [qx, qz] = pts[bi]; const [nx, nz] = pts[(bi + 1) % pts.length];
  const tx = nx - qx, tz = nz - qz, tl = Math.hypot(tx, tz) || 1;
  const d = ((px - qx) * -tz + (pz - qz) * tx) / tl; // + à direita de quem corre
  let s = 0; for (let i = 1; i <= bi; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  padList.push({ s: Math.max(0, s - 4), d: Math.round(d * 10) / 10, name: o.name });
});
padList.sort((a, b) => a.s - b.s);
console.log('placas', JSON.stringify(padList));

const r2 = (v) => Math.round(v * 100) / 100;
fs.writeFileSync(OUT_TS, `import type { GpTrackDef } from './track';

/**
 * Castle Circuit (spec 086, F1), a primeira pista do Arcade com poderes: o circuito do modelo \`castlecircuit.fbx\`, extraído
 * por \`tools/art/track/build-castle.mjs\` (as duas bordas da estrada pareadas, linha central em metros a partir da largada,
 * ${K.toFixed(4)} m por unidade do modelo, ${Math.round(cum)} m de linha central). \`heights\` é a altura da estrada em cada ponto (m,
 * só desenho: a física é plana). Arquivo gerado: não edite à mão.
 */
export const GP_TRACK_CASTLE: GpTrackDef = {
  id: 'castle',
  name: 'Castle Circuit',
  points: [
${pts.map(([x, z]) => `    [${r2(x)}, ${r2(z)}],`).join('\n')}
  ],
  noCut: [],
  pit: null,
  smooth: 2,
  limit: 18,
  pads: [
${padList.map((p) => `    { s: ${r2(p.s)}, d: ${p.d} },`).join('\n')}
  ],
  heights: [${heights.map(r2).join(', ')}],
};
`);
fs.writeFileSync('/tmp/fbxwork/castle-model.json', JSON.stringify({ K, ox: O[0], oy: O[1], oz: O[2] }));

// ---------- 2. cenário compacto ----------
const MAT_TEX = {
  'BrokenCastleBrick1': 'BrokenCastleBrickWall_decal1', 'BrokenCastleBrick2': 'BrokenCastleBrickWall_decal2', Blimp: 'Blimp_tex', Gallery: 'Gallery_tex',
  ArcheryTarget: 'ArcheryTarget', FestivalFlagpole: 'FestivalFlagpole_tex', Fountain: 'Fountain_tex', MedievalTent: 'tent', PracticeTarget: 'MeleePracticeTarget_tex',
  SiegeTower: 'Tower', Pike: 'pike', Rock_brown2: 'rock_1', OldDoubleDoor: 'OldDoubleDoor', windmill: 'windmill', FestiveBanners: 'festivebanners',
  'MarketTent 1': 'markettent', MarketStall: 'MarketStall', CastlePainting1: 'CastlePaintings_Flowers', CastlePainting2: 'CastlePaintings_Lake',
  CastlePainting3: 'CastlePaintings_Portrait', CastlePainting4: 'CastlePaintings_Sunset', CastleBrick: 'CastleBrickWall', BushMaterial: 'bush',
  Portcullis: 'portcullis', Banner: 'Banner_tex', Rock_brown1: 'rock_3', CastleRoof: 'rooftile', CastleUndersideTrim: 'TowerExtrusionTrim',
  'Planking underside': 'woodenplanks', CastleBrickTrim: 'BrickTrim', tirewall_mat: 'tirewall_tex', wood_bench: 'woodenbench', 'MarketTent 2': 'tent2',
  Rock_gray: 'rock_4', WoodenShack: 'woodenshack', TallLeafTree: 'TallLeafTree_tex', WallTorch: 'walltorch', startFrameMaterial: 'Start_Gantry',
  startFrameLightBoardMaterial: 'Start_Lights', M_wooden_support: 'M_wooden_support', TreeMaterial: 'tree', fern_mat: 'Fern', grass: 'tc_grass_city',
  PlantMaterial: 'shrub_leaf7', Cobblestone: 'Cobblestone', GravelRoad_Medieval: 'gravelroad_medieval2', cliff: 'cliff_texture', grass_medieval: 'tc_grass_medieval',
  Whitegravel: 'whitegravel', curb_stone: 'curbstone', sand: 'tc_sand', sand_edge: 'sand_edge', FinishLine: 'finishLineMarkingsDecal', Planking: 'woodenplanks',
  MetalChain: 'drawbridgechain', Ads: 'Ads', BoostPadMaterial: 'boostPadBase',
};
const ALPHA = new Set(['bush', 'Fern', 'shrub_leaf7', 'TallLeafTree_tex', 'tree', 'festivebanners', 'Banner_tex', 'pike', 'portcullis', 'Blimp_tex', 'finishLineMarkingsDecal', 'BrokenCastleBrickWall_decal1', 'BrokenCastleBrickWall_decal2', 'boostPadBase', 'Gallery_tex']);
const DETAIL = /^(bush|Bush|Shrub|Fern|tree|TallLeafTree|flowerbed|vine|pike|Market|Medieval|Melee|Archery|Walltorch|CastleWindow|CastlePainting|Festival|CastleBanner|Woodpillar|M_wooden|WallDamage|wood_bench|rock|Audience|Blimp|castle_ads|woodenshack|SiegeTower|windmill)/;
const baseMat = (n) => n.replace(/\.\d+$/, '');
const groups = new Map(); // `${tier}|${mat}` -> { pos:[], uv:[], nor:[] }
let kept = 0;
root.traverse((o) => {
  if (!o.isMesh) return;
  const tier = DETAIL.test(o.name) ? 1 : 0;
  const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const P2 = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv ? geo.attributes.uv.array : null;
  const ix = geo.index ? geo.index.array : null;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const groupsDef = geo.groups.length ? geo.groups : [{ start: 0, count: ix ? ix.length : P2.length / 3, materialIndex: 0 }];
  for (const gr of groupsDef) {
    const mat = baseMat(mats[gr.materialIndex ?? 0].name);
    const key = `${tier}|${mat}`;
    const G = groups.get(key) ?? groups.set(key, { tier, mat, pos: [], nor: [], uv: [] }).get(key);
    for (let t = 0; t < gr.count; t++) {
      const v = ix ? ix[gr.start + t] : gr.start + t;
      G.pos.push((P2[v * 3] - O[0]) * K, (P2[v * 3 + 1] - O[1]) * K, (P2[v * 3 + 2] - O[2]) * K);
      G.nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
      G.uv.push(U ? U[v * 2] : 0, U ? U[v * 2 + 1] : 0);
    }
    kept += gr.count / 3;
  }
});
console.log('triângulos no pacote', kept, 'grupos', groups.size);
fs.mkdirSync(path.join(OUT_DIR, 'tex'), { recursive: true });
const texFiles = new Map();
const needTex = (name, size) => {
  if (!name) return null;
  const src = path.join(texDir, `${name}.png`);
  if (!fs.existsSync(src)) { console.warn('sem textura', name); return null; }
  const out = path.join(OUT_DIR, 'tex', `${name}.webp`);
  texFiles.set(name, [src, out, size]);
  return `tex/${name}.webp`;
};
for (const pack of [0, 1]) {
  const meta = { groups: [] }; const chunks = []; let off = 0;
  for (const G of groups.values()) {
    if (G.tier !== pack) continue;
    const n = G.pos.length / 3; if (!n) continue;
    const texName = MAT_TEX[G.mat];
    const tex = needTex(texName, pack === 0 ? 512 : 256);
    const pb = Buffer.from(new Float32Array(G.pos).buffer);
    const nb = Buffer.from(new Int8Array(G.nor.map((v) => Math.max(-127, Math.min(127, Math.round(v * 127))))).buffer);
    const nbPad = nb.length % 4 ? Buffer.concat([nb, Buffer.alloc(4 - (nb.length % 4))]) : nb;
    const ub = Buffer.from(new Float32Array(G.uv).buffer);
    meta.groups.push({ mat: G.mat, tex, alpha: ALPHA.has(texName) || undefined, n, pos: off, nor: off + pb.length, uv: off + pb.length + nbPad.length });
    chunks.push(pb, nbPad, ub); off += pb.length + nbPad.length + ub.length;
  }
  fs.writeFileSync(path.join(OUT_DIR, pack === 0 ? 'core.bin' : 'detail.bin'), Buffer.concat(chunks));
  fs.writeFileSync(path.join(OUT_DIR, pack === 0 ? 'core.json' : 'detail.json'), JSON.stringify(meta));
  console.log(pack === 0 ? 'core' : 'detail', (off / 1e6).toFixed(2), 'MB,', meta.groups.length, 'grupos');
}
// texturas -> webp (PIL)
const jobs = [...texFiles.values()];
fs.writeFileSync('/tmp/fbxwork/tex-jobs.json', JSON.stringify(jobs));
execFileSync('python3', ['-c', `
import json
from PIL import Image
for src,out,size in json.load(open('/tmp/fbxwork/tex-jobs.json')):
    im=Image.open(src).convert('RGBA')
    im.thumbnail((size,size))
    im.save(out,'WEBP',quality=78,method=6)
`]);
console.log('texturas', jobs.length);
