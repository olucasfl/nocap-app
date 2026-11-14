// Constrói fases novas do Mini Golf (spec 082) no mesmo formato do conversor (physics.ts lê os dois).
// Uso: node tools/art/minigolf/build-levels.mjs <pasta-do-open-golf> <pasta-de-saida>
// O modelo do copo (hole.obj, MIT) vem do Open Golf; o resto é geometria feita aqui (caixas, rampas, anéis).
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('uso: build-levels.mjs <open-golf> <saida>');

// ---------- materiais (nome, atrito, restituição, escala de velocidade) ----------
const MATS = {
  'wall-top': [0.3, 0.4, 1],
  'wall-side': [0, 1, 0.8],
  ground: [0.3, 0.4, 1],
  sand: [0.9, 0.1, 0.96],
  ice: [0.02, 0.4, 1],
  bumper: [0.3, 1.15, 1.04],
  metal: [0.3, 0.4, 1],
  grass: [0.3, 0.4, 1],
  woodInner: [0.3, 0.4, 1],
  border: [0.3, 0.4, 1],
};

const r4 = (n) => Math.round(n * 1e4) / 1e4;

class Level {
  constructor(id) {
    this.id = id;
    this.mats = [];
    this.solid = { t: [], m: [], f: [] };
    this.moving = [];
    this.water = [];
    this.ballStart = [0, 0, 0];
    this.hole = null;
  }
  mi(name) {
    let i = this.mats.findIndex((m) => m.name === name);
    if (i < 0) {
      const [f, r, v] = MATS[name];
      this.mats.push({ name, f, r, v });
      i = this.mats.length - 1;
    }
    return i;
  }
  tri(a, b, c, mat, flags = 0, dir = null) {
    this.solid.t.push(...a, ...b, ...c);
    this.solid.m.push(this.mi(mat));
    this.solid.f.push(flags);
    if (flags & 2) this.water.push(dir ?? [0, 0, 0]);
  }
  quad(a, b, c, d, mat, flags = 0, dir = null) {
    this.tri(a, b, c, mat, flags, dir);
    this.tri(a, c, d, mat, flags, dir);
  }
  /** Chão plano (normal para cima). */
  floor(x0, z0, x1, z1, y, mat = 'ground') {
    [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)];
    [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)];
    this.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], mat);
  }
  /** Chão inclinado ao longo de z (yA em z0, yB em z1) ou de x (alongX). */
  slope(x0, z0, x1, z1, yA, yB, alongX = false, mat = 'ground') {
    // ordena os cantos mantendo cada altura com o seu lado
    if (!alongX && z0 > z1) [z0, z1, yA, yB] = [z1, z0, yB, yA];
    if (alongX && x0 > x1) [x0, x1, yA, yB] = [x1, x0, yB, yA];
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    if (!alongX) this.quad([x0, yA, z0], [x0, yB, z1], [x1, yB, z1], [x1, yA, z0], mat);
    else this.quad([x0, yA, z0], [x0, yA, z1], [x1, yB, z1], [x1, yB, z0], mat);
  }
  /** Caixa (paredes, blocos): topo em `mt`, lados em `ms`. */
  box(x0, y0, z0, x1, y1, z1, mt = 'wall-top', ms = 'wall-side') {
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], mt);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], ms);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], ms);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], ms);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], ms);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], ms);
  }
  /** Parede entre dois pontos alinhados aos eixos, com espessura `t`. */
  wall(x0, z0, x1, z1, yTop, t = 0.25, yBot = -0.3) {
    const hx = x0 === x1 ? t / 2 : 0, hz = z0 === z1 ? t / 2 : 0;
    this.box(Math.min(x0, x1) - hx, yBot, Math.min(z0, z1) - hz, Math.max(x0, x1) + hx, yTop, Math.max(z0, z1) + hz);
  }
  /** Prisma de 8 lados (pino/bumper) com topo e lados `bumper`. */
  bumper(cx, cz, r, y0, y1) {
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      // lado (normal para fora)
      this.quad([p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [p1[0], y0, p1[1]], 'bumper');
      this.tri([cx, y1, cz], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], 'bumper');
    }
  }
  /** Água (fundo `y`) em retângulo, com a corrente `dir`. */
  waterRect(x0, z0, x1, z1, y, dir = [0, 0, 0]) {
    this.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], 'ground', 2, dir);
  }
  /** Chão de um retângulo com a abertura redonda do copo (anel entre o círculo e o quadrado). */
  floorWithHole(x0, z0, x1, z1, y, hx, hz, mat = 'ground') {
    [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)];
    [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)];
    const R = 0.4, S = 0.8;
    const sx0 = hx - S, sx1 = hx + S, sz0 = hz - S, sz1 = hz + S;
    if (sx0 > x0) this.floor(x0, z0, sx0, z1, y, mat);
    if (sx1 < x1) this.floor(sx1, z0, x1, z1, y, mat);
    if (sz0 > z0) this.floor(sx0, z0, sx1, sz0, y, mat);
    if (sz1 < z1) this.floor(sx0, sz1, sx1, z1, y, mat);
    const N = 32;
    const inner = [], outer = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      inner.push([hx + c * R, y, hz + s * R]);
      const k = S / Math.max(Math.abs(c), Math.abs(s));
      outer.push([hx + c * k, y, hz + s * k]);
    }
    for (let i = 0; i < N; i++) this.quad(inner[i], outer[i], outer[i + 1], inner[i + 1], mat);
  }
  /** Peça móvel: geometria local (caixas) em torno da origem; base no mundo; movimento do Open Golf. */
  mover(name, base, movement, builder) {
    const sub = new Level(0);
    builder(sub);
    // converte os materiais da peça para o índice da fase
    const m = sub.solid.m.map((i) => this.mi(sub.mats[i].name));
    this.moving.push({ name, movement, base: { p: base.p, s: [1, 1, 1], r: base.r ?? [0, 0, 0, 1] }, t: sub.solid.t.map(r4), m, f: sub.solid.f.map(() => 0) });
  }
  /** Chão externo (fora dos limites): quem cai nele volta ao ponto da tacada. */
  outside(cx, cz, y) {
    const H = 80;
    this.quad([cx - H, y, cz - H], [cx - H, y, cz + H], [cx + H, y, cz + H], [cx + H, y, cz - H], 'grass', 1);
  }
  json(holeModel) {
    const [hx, hy, hz] = this.hole;
    const tris = holeModel.map((t) => t.map(([x, y, z]) => [hx + x * 0.4, hy + y * 0.4, hz + z * 0.4]).flat()).flat();
    return {
      id: this.id,
      ballStart: this.ballStart,
      holes: [{ p: [hx, hy, hz], r: 0.4 }],
      holeTris: [tris.map(r4)],
      cameraZones: [],
      begin: null,
      materials: this.mats.map((m) => ({ name: m.name, f: m.f, r: m.r, v: m.v })),
      solid: { t: this.solid.t.map(r4), m: this.solid.m, f: this.solid.f },
      moving: this.moving,
      ...(this.water.length ? { waterDirs: this.water } : {}),
    };
  }
}

// ---------- modelo do copo ----------
function loadHole() {
  const pos = [], tris = [];
  for (const l of fs.readFileSync(path.join(src, 'data/models/hole.obj'), 'utf8').split('\n')) {
    if (l.startsWith('v ')) pos.push(l.trim().split(/\s+/).slice(1, 4).map(Number));
    else if (l.startsWith('f ')) {
      const idx = l.trim().split(/\s+/).slice(1).map((s) => parseInt(s.split('/')[0], 10) - 1);
      for (let k = 0; k < idx.length - 2; k++) tris.push([pos[idx[0]], pos[idx[k + 1]], pos[idx[k + 2]]]);
    }
  }
  return tris;
}

const LEVELS = [];
const W = 0.25;

// 21 Rampa suave (fácil): corredor com subida para um patamar onde fica o buraco.
LEVELS.push((() => {
  const L = new Level(21);
  L.ballStart = [0, 0, 0];
  L.hole = [0, 1.0, -14];
  L.floor(-1.5, 2, 1.5, -6, 0);
  L.slope(-1.5, -6, 1.5, -10, 0, 1.0);
  L.floorWithHole(-1.5, -10, 1.5, -16, 1.0, 0, -14);
  L.wall(-1.5, 2, -1.5, -6, 0.5); L.wall(1.5, 2, 1.5, -6, 0.5);
  L.wall(-1.5, -6, -1.5, -10, 1.5); L.wall(1.5, -6, 1.5, -10, 1.5);
  L.wall(-1.5, -10, -1.5, -16, 1.5); L.wall(1.5, -10, 1.5, -16, 1.5);
  L.wall(-1.5, 2, 1.5, 2, 0.5); L.wall(-1.5, -16, 1.5, -16, 1.5);
  L.outside(0, -7, -0.9);
  return L;
})());

// 22 Cotovelo (fácil): corredor em L; dá para usar a parede.
LEVELS.push((() => {
  const L = new Level(22);
  L.ballStart = [0, 0, 2];
  L.hole = [9, 0, -8];
  L.floor(-1.5, 4, 1.5, -9.5, 0);
  L.floorWithHole(1.5, -9.5, 10.5, -6.5, 0, 9, -8);
  L.floor(-1.5, -9.5, 1.5, -6.5, 0);
  L.wall(-1.5, 4, -1.5, -9.5, 0.5); L.wall(1.5, 4, 1.5, -6.5, 0.5);
  L.wall(-1.5, -9.5, 10.5, -9.5, 0.5); L.wall(1.5, -6.5, 10.5, -6.5, 0.5);
  L.wall(10.5, -9.5, 10.5, -6.5, 0.5); L.wall(-1.5, 4, 1.5, 4, 0.5);
  L.outside(4, -3, -0.9);
  return L;
})());

// 23 Gelo (fácil): trecho de gelo no meio do corredor e um pino para desviar.
LEVELS.push((() => {
  const L = new Level(23);
  L.ballStart = [0, 0, 0];
  L.hole = [0, 0, -17];
  L.floor(-2, 2, 2, -5, 0);
  L.floor(-2, -5, 2, -11, 0, 'ice');
  L.floorWithHole(-2, -11, 2, -19, 0, 0, -17);
  L.bumper(-0.6, -8, 0.45, -0.3, 0.5);
  L.wall(-2, 2, -2, -19, 0.5); L.wall(2, 2, 2, -19, 0.5);
  L.wall(-2, 2, 2, 2, 0.5); L.wall(-2, -19, 2, -19, 0.5);
  L.outside(0, -8, -0.9);
  return L;
})());

// 24 Dois moinhos (média): dois giratórios em série.
LEVELS.push((() => {
  const L = new Level(24);
  L.ballStart = [0, 0, 0];
  L.hole = [0, 0, -20];
  L.floor(-2.5, 2, 2.5, -17, 0);
  L.floorWithHole(-2.5, -17, 2.5, -22, 0, 0, -20);
  L.wall(-2.5, 2, -2.5, -22, 0.5); L.wall(2.5, 2, 2.5, -22, 0.5);
  L.wall(-2.5, 2, 2.5, 2, 0.5); L.wall(-2.5, -22, 2.5, -22, 0.5);
  const arm = (s) => (m) => m.box(-1.9, 0.0, -0.1, 1.9, 0.5, 0.1, 'metal', 'metal');
  L.mover('moinho-1', { p: [0, 0, -6] }, { type: 'spinner', t0: 0, length: 4 }, arm());
  L.mover('moinho-2', { p: [0, 0, -12] }, { type: 'spinner', t0: 1, length: 3 }, arm());
  L.outside(0, -10, -0.9);
  return L;
})());

// 25 Pêndulos (média): três portões balançando.
LEVELS.push((() => {
  const L = new Level(25);
  L.ballStart = [0, 0, 0];
  L.hole = [0, 0, -20];
  L.floor(-1.8, 2, 1.8, -17, 0);
  L.floorWithHole(-1.8, -17, 1.8, -22, 0, 0, -20);
  L.wall(-1.8, 2, -1.8, -22, 0.5); L.wall(1.8, 2, 1.8, -22, 0.5);
  L.wall(-1.8, 2, 1.8, 2, 0.5); L.wall(-1.8, -22, 1.8, -22, 0.5);
  const gate = (m) => m.box(-0.12, -2.1, -0.15, 0.12, 0.0, 0.15, 'metal', 'metal');
  [[-6, 0], [-10.5, 1.2], [-15, 0.6]].forEach(([z, t0], i) =>
    L.mover(`pendulo-${i + 1}`, { p: [0, 2.2, z] }, { type: 'pendulum', t0, length: 3, theta0: 1.0, axis: [0, 0, -1] }, gate));
  L.outside(0, -10, -0.9);
  return L;
})());

// 26 Pinball (média): sala aberta cheia de pinos que rebatem forte.
LEVELS.push((() => {
  const L = new Level(26);
  L.ballStart = [0, 0, 2];
  L.hole = [0, 0, -15];
  L.floor(-4.5, 4, 4.5, -13, 0);
  L.floorWithHole(-4.5, -13, 4.5, -17.5, 0, 0, -15);
  L.wall(-4.5, 4, -4.5, -17.5, 0.5); L.wall(4.5, 4, 4.5, -17.5, 0.5);
  L.wall(-4.5, 4, 4.5, 4, 0.5); L.wall(-4.5, -17.5, 4.5, -17.5, 0.5);
  [[-2.5, -2], [2.5, -2], [0, -4.5], [-3, -7], [3, -7], [-1, -9.5], [1.6, -11.2]].forEach(([x, z]) => L.bumper(x, z, 0.55, -0.3, 0.5));
  L.outside(0, -7, -0.9);
  return L;
})());


// ---------- fases por mapa de texto (células de 3 m) ----------
// Letras: # ou espaço = vazio · . chão · @ saída · H buraco · i gelo · s areia · o pino · ~ água · b ponte sobre água
// Rampas (sobem 1 m na direção da seta): ^ norte, v sul, < oeste, > leste.
const C = 3;
const RISE = 0.6; // altura de cada rampa
function gridLevel(id, rows, movers = []) {
  const L = new Level(id);
  const R = rows.length, Wd = Math.max(...rows.map((r) => r.length));
  const ch = (c, r) => (rows[r]?.[c] ?? '#');
  const solid = (c, r) => !['#', ' '].includes(ch(c, r));
  const ramp = (c, r) => '^v<>'.includes(ch(c, r));
  const dirOf = { '^': [0, -1], v: [0, 1], '<': [-1, 0], '>': [1, 0] };
  // elevação de cada célula por busca a partir da saída
  const low = new Map();
  let start = null;
  for (let r = 0; r < R; r++) for (let c = 0; c < Wd; c++) if (ch(c, r) === '@') start = [c, r];
  low.set(start.join(), 0);
  const exitY = (c, r, mv) => {
    const l = low.get([c, r].join());
    if (!ramp(c, r)) return l;
    const d = dirOf[ch(c, r)];
    return mv[0] === d[0] && mv[1] === d[1] ? l + RISE : l;
  };
  const q = [start];
  while (q.length) {
    const [c, r] = q.shift();
    for (const mv of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + mv[0], nr = r + mv[1];
      if (!solid(nc, nr) || low.has([nc, nr].join())) continue;
      const y = exitY(c, r, mv);
      if (ramp(nc, nr)) {
        const d = dirOf[ch(nc, nr)];
        low.set([nc, nr].join(), mv[0] === d[0] && mv[1] === d[1] ? y : y - RISE);
      } else {
        // saindo de rampa pelo lado alto: o chão seguinte fica em cima
        low.set([nc, nr].join(), y);
      }
      q.push([nc, nr]);
    }
  }
  const yTop = (c, r) => {
    const l = low.get([c, r].join()) ?? 0;
    return ramp(c, r) ? l + RISE : l;
  };
  let minY = 0;
  low.forEach((v) => (minY = Math.min(minY, v)));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < Wd; c++) {
      const k = ch(c, r);
      if (!solid(c, r)) continue;
      const cx = c * C, cz = r * C, x0 = cx - C / 2, x1 = cx + C / 2, z0 = cz - C / 2, z1 = cz + C / 2;
      const y = low.get([c, r].join()) ?? 0;
      if (k === 'H') { L.hole = [cx, y, cz]; L.floorWithHole(x0, z0, x1, z1, y, cx, cz); }
      else if (ramp(c, r)) {
        const d = dirOf[k];
        if (d[0] === 0) L.slope(x0, z0, x1, z1, d[1] < 0 ? y + RISE : y, d[1] < 0 ? y : y + RISE);
        else L.slope(x0, z0, x1, z1, d[0] < 0 ? y + RISE : y, d[0] < 0 ? y : y + RISE, true);
      } else if (k === '~') L.waterRect(x0, z0, x1, z1, y - 0.45, [0.6, 0, 0]);
      else if (k === 'b') {
        L.waterRect(x0, z0, x1, z1, y - 0.45, [0.6, 0, 0]);
        L.floor(x0, cz - 0.6, x1, cz + 0.6, y);
      } else L.floor(x0, z0, x1, z1, y, k === 'i' ? 'ice' : k === 's' ? 'sand' : 'ground');
      if (k === '@') L.ballStart = [cx, y, cz];
      if (k === 'o') L.bumper(cx, cz, 0.55, y - 0.3, y + 0.5);
      // paredes nas bordas com o vazio
      const top = yTop(c, r) + 0.5;
      if (!solid(c, r - 1)) L.wall(x0, z0, x1, z0, top);
      if (!solid(c, r + 1)) L.wall(x0, z1, x1, z1, top);
      if (!solid(c - 1, r)) L.wall(x0, z0, x0, z1, top);
      if (!solid(c + 1, r)) L.wall(x1, z0, x1, z1, top);
    }
  }
  for (const m of movers) {
    const y = low.get([m.col, m.row].join()) ?? 0;
    const p = [m.col * C, y, m.row * C];
    if (m.kind === 'spinner')
      L.mover(`giratorio-${m.col}-${m.row}`, { p }, { type: 'spinner', t0: m.t0 ?? 0, length: m.length ?? 4 }, (s) => s.box(-1.35, 0, -0.1, 1.35, 0.5, 0.1, 'metal', 'metal'));
    else if (m.kind === 'pendulum') {
      const alongX = m.along === 'x'; // o corredor corre em x: o braço balança em z
      L.mover(`pendulo-${m.col}-${m.row}`, { p: [p[0], y + 2.2, p[2]] }, { type: 'pendulum', t0: m.t0 ?? 0, length: m.length ?? 3, theta0: 1.0, axis: alongX ? [1, 0, 0] : [0, 0, -1] }, (s) =>
        s.box(-0.15, -2.1, -0.15, 0.15, 0, 0.15, 'metal', 'metal'));
    } else if (m.kind === 'slider') {
      const [dx, dz] = m.span; // desloca o bloco de -d/2 a +d/2
      L.mover(`esteira-${m.col}-${m.row}`, { p: [p[0] + dx / 2, y, p[2] + dz / 2] }, { type: 'linear', t0: m.t0 ?? 0, length: m.length ?? 4, p0: [0, 0, 0], p1: [-dx, 0, -dz] }, (s) =>
        s.box(-0.15, 0, -0.15, 0.15, 0.5, 0.15, 'metal', 'metal') && void 0);
    }
  }
  L.outside((Wd * C) / 2 - C / 2, (R * C) / 2 - C / 2, minY - 0.9);
  return L;
}

// 27 Zigue-zague (difícil): três faixas curtas em serpentina, com giratório e pêndulo.
LEVELS.push(gridLevel(27, [
  '@.....#',
  '#####.#',
  '#.....#',
  '#.#####',
  '#.....H',
], [
  { kind: 'spinner', col: 3, row: 0, length: 4 },
  { kind: 'pendulum', col: 3, row: 2, along: 'x', t0: 0.5 },
]));

// 28 Montanha (difícil): sobe duas rampas até o patamar do buraco, com um pêndulo no alto.
LEVELS.push(gridLevel(28, [
  '#########',
  '#H....###',
  '#####^###',
  '@..>..###',
], [
  { kind: 'spinner', col: 1, row: 3, length: 4 },
  { kind: 'pendulum', col: 3, row: 1, along: 'x', t0: 0 },
]));

// 29 Ponte (média): uma tábua estreita sobre a água.
LEVELS.push(gridLevel(29, [
  '@..bbb..H',
]));

// 30 Gelo (difícil): corredor de gelo com pino, volta num segundo corredor.
LEVELS.push(gridLevel(30, [
  '@..ii..#',
  '######.#',
  '#H.ii..#',
]));

const holeModel = loadHole();
fs.mkdirSync(out, { recursive: true });
for (const L of LEVELS) {
  fs.writeFileSync(path.join(out, `level-${L.id}.json`), JSON.stringify(L.json(holeModel)));
  console.log(`level-${L.id}: ${L.solid.m.length} tris, ${L.moving.length} móveis`);
}
