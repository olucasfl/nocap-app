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
const pairsRot = pairs.slice(s0).concat(pairs.slice(0, s0));
center = center.slice(s0).concat(center.slice(0, s0));
// sentido da corrida: o da malha (a tela mostra a volta); anti-horário visto de cima fica como está
const O = center[0];
const toM = (x, z) => [(x - O[0]) * K, (z - O[2]) * K];
let cum = 0; const pts = center.map((c, i) => { if (i) cum += Math.hypot(c[0] - center[i - 1][0], c[2] - center[i - 1][2]) * K; return toM(c[0], c[2]); });
const heights = center.map((c) => (c[1] - O[1]) * K);
// inclinação lateral (rad): positiva quando o lado direito de quem corre é mais alto que o esquerdo
const banks = center.map((c, i) => {
  const n = center[(i + 1) % center.length];
  const tx = n[0] - c[0], tz = n[2] - c[2];
  const { a, b } = pairsRot[i];
  const side = (q) => (q[0] - c[0]) * -tz + (q[2] - c[2]) * tx; // + = direita
  const [R, L] = side(a) > side(b) ? [a, b] : [b, a];
  // limitado a 17°: mais que isso é quina da malha, não curva inclinada
  return Math.max(-0.3, Math.min(0.3, Math.atan2(R[1] - L[1], Math.hypot(R[0] - L[0], R[2] - L[2]))));
});
// suaviza (média de 5 pontos, duas vezes): as quinas da malha viram rampa contínua
for (let pass = 0; pass < 2; pass++) {
  const copy = banks.slice();
  for (let i = 0; i < banks.length; i++) {
    let sum = 0;
    for (let o = -2; o <= 2; o++) sum += copy[(i + o + banks.length) % banks.length];
    banks[i] = sum / 5;
  }
}
console.log('banks (graus) min/max', (Math.min(...banks) * 57.3).toFixed(1), (Math.max(...banks) * 57.3).toFixed(1));
console.log(`largura ${W.toFixed(2)} un, ${K.toFixed(4)} m/un, ${center.length} pontos, volta ~${Math.round(cum)} m, altura ${Math.min(...heights).toFixed(1)}..${Math.max(...heights).toFixed(1)} m`);

// paredes reais: de cada ponto da linha central, um raio para cada lado na altura do kart até a primeira peça sólida
const WALL = /wall|castle_base$|castle_base_$|castle_base_0[23]$|tirewall|trackCastle$|trackTunnelCastle$|inner_castle|CastleHedges|CastleTower|rock_/i;
const solids = [];
root.traverse((o) => {
  if (o.isMesh && WALL.test(o.name) && !/driveable|offroad/i.test(o.name)) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => (m.side = THREE.DoubleSide));
    solids.push(o);
  }
});
const ray = new THREE.Raycaster();
const wallsL = [];
const wallsR = [];
center.forEach((c, i) => {
  const n = center[(i + 1) % center.length];
  const p = center[(i - 1 + center.length) % center.length];
  let tx = n[0] - p[0], tz = n[2] - p[2];
  const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const rx = -tz, rz = tx; // direita de quem corre
  for (const [sign, out] of [[1, wallsR], [-1, wallsL]]) {
    ray.set(new THREE.Vector3(c[0], c[1] + 0.8 / K, c[2]), new THREE.Vector3(rx * sign, 0, rz * sign));
    ray.near = 0; ray.far = 40 / K;
    const hit = ray.intersectObjects(solids, false)[0];
    out.push(hit ? Math.round(hit.distance * K * 10) / 10 : 99);
  }
});
const nearWalls = wallsL.concat(wallsR).filter((v) => v < 99);
console.log('paredes achadas', nearWalls.length, 'de', wallsL.length * 2, 'mediana', nearWalls.sort((a, b) => a - b)[Math.floor(nearWalls.length / 2)]);

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
 * ${K.toFixed(4)} m por unidade do modelo, ${Math.round(cum)} m de linha central). \`heights\` é a altura da estrada em cada ponto (m)
 * e \`banks\` a inclinação lateral (rad); a física é plana, mas a altura e a inclinação mexem na velocidade e no desenho. Arquivo gerado: não edite à mão.
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
  vmaxK: 0.8,
  kartK: 0.6,
  limit: 18,
  pads: [
${padList.map((p) => `    { s: ${r2(p.s)}, d: ${p.d} },`).join('\n')}
  ],
  heights: [${heights.map(r2).join(', ')}],
  banks: [${banks.map((b) => Math.round(b * 1e4) / 1e4).join(', ')}],
  wallsL: [${wallsL.join(', ')}],
  wallsR: [${wallsR.join(', ')}],
};
`);
fs.writeFileSync('/tmp/fbxwork/castle-model.json', JSON.stringify({ K, ox: O[0], oy: O[1], oz: O[2] }));

// ---------- 1b. mapa de altura do chão (onde o kart pisa: estrada, ponte, túnel, grama e areia) ----------
const GROUND = /^(CastleRoad|trackTunnelCastle_driveable|castle_base_0\d_driveable|castle_base_offroad|trackSand)$/;
const CELL = 1; // m
const gtris = [];
let gx0 = Infinity, gx1 = -Infinity, gz0 = Infinity, gz1 = -Infinity;
root.traverse((o) => {
  if (!o.isMesh || !GROUND.test(o.name)) return;
  const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
  const pp = g.attributes.position.array;
  const ii = g.index ? g.index.array : Array.from({ length: pp.length / 3 }, (_, i) => i);
  for (let t = 0; t < ii.length; t += 3) {
    const tri = [0, 1, 2].map((j) => [(pp[ii[t + j] * 3] - O[0]) * K, (pp[ii[t + j] * 3 + 1] - O[1]) * K, (pp[ii[t + j] * 3 + 2] - O[2]) * K]);
    gtris.push(tri);
    for (const v of tri) { gx0 = Math.min(gx0, v[0]); gx1 = Math.max(gx1, v[0]); gz0 = Math.min(gz0, v[2]); gz1 = Math.max(gz1, v[2]); }
  }
});
gx0 = Math.floor(gx0) - 1; gz0 = Math.floor(gz0) - 1;
const GW = Math.ceil(gx1 - gx0) + 2, GH = Math.ceil(gz1 - gz0) + 2;
const cells = new Array(GW * GH);
for (const [a, b, c] of gtris) {
  const minx = Math.floor((Math.min(a[0], b[0], c[0]) - gx0) / CELL), maxx = Math.ceil((Math.max(a[0], b[0], c[0]) - gx0) / CELL);
  const minz = Math.floor((Math.min(a[2], b[2], c[2]) - gz0) / CELL), maxz = Math.ceil((Math.max(a[2], b[2], c[2]) - gz0) / CELL);
  const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(den) < 1e-9) continue;
  for (let cz = minz; cz <= maxz; cz++) for (let cx = minx; cx <= maxx; cx++) {
    const px = gx0 + (cx + 0.5) * CELL, pz = gz0 + (cz + 0.5) * CELL;
    const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / den;
    const l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / den;
    const l3 = 1 - l1 - l2;
    if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
    (cells[cz * GW + cx] ??= []).push(l1 * a[1] + l2 * b[1] + l3 * c[1]);
  }
}
const lowA = new Int16Array(GW * GH).fill(-32768), highA = new Int16Array(GW * GH).fill(-32768);
let filled = 0, two = 0;
for (let i = 0; i < cells.length; i++) {
  const h = cells[i]; if (!h) continue;
  h.sort((x, y) => x - y);
  // agrupa alturas a menos de 1,2 m (pistas sobrepostas no mesmo plano) e fica com o topo de cada grupo
  const tops = [];
  for (const y of h) { if (tops.length && y - tops[tops.length - 1] < 1.2) tops[tops.length - 1] = y; else tops.push(y); }
  lowA[i] = Math.round(tops[0] * 100); highA[i] = Math.round(tops[tops.length - 1] * 100);
  filled++; if (tops.length > 1) two++;
}
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'ground.json'), JSON.stringify({ x0: gx0, z0: gz0, w: GW, h: GH, cell: CELL }));
fs.writeFileSync(path.join(OUT_DIR, 'ground.bin'), Buffer.concat([Buffer.from(lowA.buffer), Buffer.from(highA.buffer)]));
console.log('chão', GW, 'x', GH, 'células', filled, 'com dois andares', two);

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
// a placa da largada (e a caixa de luzes embaixo dela) pendia baixo demais e a câmera entrava nela: sobe tudo isso
const LB = new Box3Holder();
function Box3Holder() { const b = new THREE.Box3(); root.traverse((o) => { if (o.isMesh && o.name === 'startFrame_Lightboard') b.expandByObject(o); }); return b; }
const LIFT = 2.2 / K; // 2,2 m: a borda de baixo passa de 1,7 m para 3,9 m da estrada
const lifted = (name, P2, v0, v1, v2) => {
  if (name === 'startFrame_Lightboard') return true;
  if (name !== 'startFrame') return false;
  const ys = [P2[v0 * 3 + 1], P2[v1 * 3 + 1], P2[v2 * 3 + 1]];
  if (Math.max(...ys) > LB.max.y + 0.2 || Math.min(...ys) < LB.min.y - 1.2) return false;
  const cx = (P2[v0 * 3] + P2[v1 * 3] + P2[v2 * 3]) / 3, cz = (P2[v0 * 3 + 2] + P2[v1 * 3 + 2] + P2[v2 * 3 + 2]) / 3;
  return cx > LB.min.x - 1.5 && cx < LB.max.x + 1.5 && cz > LB.min.z - 1.5 && cz < LB.max.z + 1.5;
};
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
    // cada material é cortado em quadrados de 40 m: assim a câmera descarta o que não vê e o raio da câmera só testa o que está no caminho
    for (let t0 = 0; t0 < gr.count; t0 += 3) {
      const vi = (k) => (ix ? ix[gr.start + t0 + k] : gr.start + t0 + k);
      const cx = Math.floor(((P2[vi(0) * 3] + P2[vi(1) * 3] + P2[vi(2) * 3]) / 3 - O[0]) * K / 40);
      const cz = Math.floor(((P2[vi(0) * 3 + 2] + P2[vi(1) * 3 + 2] + P2[vi(2) * 3 + 2]) / 3 - O[2]) * K / 40);
      const key = `${tier}|${mat}|${cx}|${cz}`;
      const G = groups.get(key) ?? groups.set(key, { tier, mat, pos: [], nor: [], uv: [] }).get(key);
      const up = lifted(o.name, P2, vi(0), vi(1), vi(2)) ? LIFT : 0;
      for (let k = 0; k < 3; k++) {
        const v = vi(k);
        G.pos.push((P2[v * 3] - O[0]) * K, (P2[v * 3 + 1] + up - O[1]) * K, (P2[v * 3 + 2] - O[2]) * K);
        G.nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
        G.uv.push(U ? U[v * 2] : 0, U ? U[v * 2 + 1] : 0);
      }
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
