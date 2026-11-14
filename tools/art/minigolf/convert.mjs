// Converte as 20 fases do Open Golf (MIT, github.com/mgerdes/Open-Golf) para o JSON de física do Mini Golf.
// Uso: node tools/art/minigolf/convert.mjs <pasta-do-open-golf> <pasta-de-saida>
// Só ferramenta de trabalho (spec 082): fora do package.json, sem dependências.
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('uso: convert.mjs <open-golf> <saida>');
fs.mkdirSync(out, { recursive: true });

// ---- matemática mínima (matrizes 4x4 em coluna, como o C) ----
const quatMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const quatAxis = (axis, ang) => {
  const l = Math.hypot(...axis) || 1;
  const s = Math.sin(ang / 2) / l;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(ang / 2)];
};
function rotate(q, v) {
  const [x, y, z, w] = q;
  const n = Math.hypot(x, y, z, w) || 1;
  const qx = x / n, qy = y / n, qz = z / n, qw = w / n;
  const ix = qw * v[0] + qy * v[2] - qz * v[1];
  const iy = qw * v[1] + qz * v[0] - qx * v[2];
  const iz = qw * v[2] + qx * v[1] - qy * v[0];
  const iw = -qx * v[0] - qy * v[1] - qz * v[2];
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}
const apply = (t, p) => {
  const r = rotate(t.rotation, [p[0] * t.scale[0], p[1] * t.scale[1], p[2] * t.scale[2]]);
  return [r[0] + t.position[0], r[1] + t.position[1], r[2] + t.position[2]];
};
function worldTransform(entities, e) {
  let parent = { position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0, 1] };
  if (e.parent_idx >= 0) parent = entities[e.parent_idx].transform ?? parent;
  const t = e.transform;
  const rotation = quatMul(parent.rotation, t.rotation);
  const scale = [parent.scale[0] * t.scale[0], parent.scale[1] * t.scale[1], parent.scale[2] * t.scale[2]];
  const pr = rotate(parent.rotation, t.position);
  return {
    position: [pr[0] * parent.scale[0] + parent.position[0], pr[1] * parent.scale[1] + parent.position[1], pr[2] * parent.scale[2] + parent.position[2]],
    scale,
    rotation,
  };
}

// ---- modelos OBJ (fan triangulation, grupos por usemtl, como o loader do C) ----
const objCache = new Map();
function loadObj(rel) {
  if (objCache.has(rel)) return objCache.get(rel);
  const lines = fs.readFileSync(path.join(src, rel), 'utf8').split('\n');
  const pos = [];
  const groups = new Map(); // material -> [tris]
  let mat = 'default';
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('v ')) pos.push(l.split(/\s+/).slice(1, 4).map(Number));
    else if (l.startsWith('usemtl')) mat = l.split(/\s+/)[1] ?? 'default';
    else if (l.startsWith('f ')) {
      const idx = l.split(/\s+/).slice(1).map((s) => {
        const v = parseInt(s.split('/')[0], 10);
        return v < 0 ? pos.length + v : v - 1;
      });
      if (!groups.has(mat)) groups.set(mat, []);
      for (let k = 0; k < idx.length - 2; k++) groups.get(mat).push([pos[idx[0]], pos[idx[k + 1]], pos[idx[k + 2]]]);
    }
  }
  const res = [...groups].map(([material, tris]) => ({ material, tris }));
  objCache.set(rel, res);
  return res;
}

function geoGroups(geo, isWater) {
  const byMat = new Map();
  for (const f of geo.faces) {
    if (!byMat.has(f.material_name)) byMat.set(f.material_name, []);
    const p = (i) => [geo.p[3 * i], geo.p[3 * i + 1], geo.p[3 * i + 2]];
    for (let i = 1; i < f.idxs.length - 1; i++)
      byMat.get(f.material_name).push({ tri: [p(f.idxs[0]), p(f.idxs[i]), p(f.idxs[i + 1])], water: isWater ? f.water_dir ?? [0, 0, 0] : null });
  }
  return [...byMat].map(([material, items]) => ({ material, items }));
}

const r4 = (n) => Math.round(n * 1e4) / 1e4;
const flat = (tris) => tris.flatMap((t) => t.flat()).map(r4);

for (let n = 1; n <= 20; n++) {
  const level = JSON.parse(fs.readFileSync(path.join(src, `data/levels/level-${n}.level`), 'utf8'));
  const mats = [];
  const matIdx = (name) => {
    let i = mats.findIndex((m) => m.name === name);
    if (i < 0) {
      const m = level.materials.find((x) => x.name === name);
      // sem material na fase, o C usa tudo zero
      mats.push({ name, f: m?.friction ?? 0, r: m?.restitution ?? 0, v: m?.vel_scale ?? 0 });
      i = mats.length - 1;
    }
    return i;
  };
  const E = level.entities;
  const result = { id: n, ballStart: null, holes: [], holeTris: [], cameraZones: [], begin: null, materials: null, solid: { t: [], m: [], f: [] }, moving: [] };
  const holeModel = loadObj('data/models/hole.obj');

  E.forEach((e) => {
    if (e.type === 'ball-start') result.ballStart = e.transform.position.map(r4);
    else if (e.type === 'begin_animation') result.begin = e.transform.position.map(r4);
    else if (e.type === 'camera_zone')
      result.cameraZones.push({ p: e.transform.position.map(r4), s: e.transform.scale.map(r4), r: e.transform.rotation.map((v) => r4(v)), toHole: !!e.towards_hole });
    else if (e.type === 'hole') {
      const w = worldTransform(E, e);
      result.holes.push({ p: e.transform.position.map(r4), r: r4(e.transform.scale[0]) });
      const tris = holeModel.flatMap((g) => g.tris).map((t) => t.map((v) => apply(w, v)));
      result.holeTris.push(flat(tris));
    }
  });

  E.forEach((e, idx) => {
    if (e.type !== 'model' && e.type !== 'geo' && e.type !== 'water') return;
    if (e.type === 'model' && e.ignore_physics) return;
    const isWater = e.type === 'water';
    const w = worldTransform(E, e);
    const groups = e.type === 'model'
      ? loadObj(e.model).map((g) => ({ material: g.material, items: g.tris.map((tri) => ({ tri, water: null })) }))
      : geoGroups(e.geo, isWater);
    const oob = e.parent_idx >= 0 ? 1 : 0;
    const mv = e.movement && e.movement.type !== 'none' ? e.movement : null;
    const tris = [], ms = [], fl = [];
    for (const g of groups) {
      const mi = matIdx(g.material);
      for (const it of g.items) {
        tris.push(mv ? it.tri : it.tri.map((v) => apply(w, v)));
        ms.push(mi);
        // bit0 = fora dos limites, bit1 = água; a direção da água vai à parte
        let f = oob | (isWater ? 2 : 0);
        fl.push(f);
        if (isWater) {
          const d = rotate(w.rotation, it.water ?? [0, 0, 0]);
          (result.waterDirs ??= []).push(d.map(r4));
        }
      }
    }
    if (!mv) {
      result.solid.t.push(...flat(tris));
      result.solid.m.push(...ms);
      result.solid.f.push(...fl);
    } else {
      result.moving.push({ name: e.name, movement: mv, base: { p: w.position.map(r4), s: w.scale.map(r4), r: w.rotation.map((v) => r4(v)) }, t: flat(tris), m: ms, f: fl });
    }
  });
  result.materials = mats;
  fs.writeFileSync(path.join(out, `level-${n}.json`), JSON.stringify(result));
  console.log(`level-${n}: ${result.solid.m.length} tris fixos, ${result.moving.length} moveis, ${result.holes.length} buraco(s)`);
}
