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


// ---------- fases por mapa de texto (células de 3 m) ----------
// Letras: # ou espaço = vazio · . chão · @ saída · H buraco · i gelo · s areia · o pino · ~ água · b ponte sobre água
// Rampas (sobem 1 m na direção da seta): ^ norte, v sul, < oeste, > leste.
const C = 3;
const RISE = 0.6; // altura de cada rampa
function gridLevel(id, rows, movers = []) {
  const L = new Level(id);
  const R = rows.length, Wd = Math.max(...rows.map((r) => r.length));
  const ch = (c, r) => (rows[r]?.[c] ?? '#');
  const solid = (c, r) => !['#', ' ', '_'].includes(ch(c, r));
  const absY = (k) => ('ABCDE'.includes(k) ? (k.charCodeAt(0) - 64) * RISE : 'xyz'.includes(k) ? -(k.charCodeAt(0) - 119) * RISE : null);
  const ramp = (c, r) => '^v<>'.includes(ch(c, r));
  const dirOf = { '^': [0, -1], v: [0, 1], '<': [-1, 0], '>': [1, 0] };
  // elevação de cada célula por busca a partir da saída
  const low = new Map();
  let start = null;
  for (let r = 0; r < R; r++) for (let c = 0; c < Wd; c++) if (ch(c, r) === '@') start = [c, r];
  low.set(start.join(), 0);
  const seeds = [start];
  for (let r = 0; r < R; r++) for (let c = 0; c < Wd; c++) { const a = absY(ch(c, r)); if (a !== null && ch(c, r) !== ' ') { low.set([c, r].join(), a); seeds.push([c, r]); } }
  const exitY = (c, r, mv) => {
    const l = low.get([c, r].join());
    if (!ramp(c, r)) return l;
    const d = dirOf[ch(c, r)];
    return mv[0] === d[0] && mv[1] === d[1] ? l + RISE : l;
  };
  const q = [...seeds];
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
      const top = yTop(c, r) + 1.0;
      // degrau entre pisos de alturas diferentes (sem rampa): uma mureta no lado mais alto
      if (!ramp(c, r)) {
        for (const [dc, dr, wx0, wz0, wx1, wz1] of [[0, -1, x0, z0, x1, z0], [0, 1, x0, z1, x1, z1], [-1, 0, x0, z0, x0, z1], [1, 0, x1, z0, x1, z1]]) {
          const nc = c + dc, nr = r + dr;
          if (!solid(nc, nr) || ramp(nc, nr)) continue;
          const yn = low.get([nc, nr].join()) ?? 0;
          if (yn < y - 0.05) L.wall(wx0, wz0, wx1, wz1, y + 0.5, 0.25, yn - 0.3);
        }
      }
      const edge = (cc, rr) => !solid(cc, rr) && ch(cc, rr) !== '_';
      if (edge(c, r - 1)) L.wall(x0, z0, x1, z0, top);
      if (edge(c, r + 1)) L.wall(x0, z1, x1, z1, top);
      if (edge(c - 1, r)) L.wall(x0, z0, x0, z1, top);
      if (edge(c + 1, r)) L.wall(x1, z0, x1, z1, top);
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
    } else if (m.kind === 'gate') {
      // portão: uma parede que corre de um lado ao outro do corredor
      const [dx, dz] = m.span;
      const [hx, hz] = m.half ?? [0.15, 1.1];
      L.mover(`portao-${m.col}-${m.row}`, { p: [p[0] + dx / 2, y, p[2] + dz / 2] }, { type: 'linear', t0: m.t0 ?? 0, length: m.length ?? 3, p0: [0, 0, 0], p1: [-dx, 0, -dz] }, (s) => s.box(-hx, 0, -hz, hx, 0.7, hz, 'metal', 'metal'));
    } else if (m.kind === 'slider') {
      const [dx, dz] = m.span; // desloca o bloco de -d/2 a +d/2
      L.mover(`esteira-${m.col}-${m.row}`, { p: [p[0] + dx / 2, y, p[2] + dz / 2] }, { type: 'linear', t0: m.t0 ?? 0, length: m.length ?? 4, p0: [0, 0, 0], p1: [-dx, 0, -dz] }, (s) =>
        s.box(-0.15, 0, -0.15, 0.15, 0.5, 0.15, 'metal', 'metal') && void 0);
    }
  }
  L.outside((Wd * C) / 2 - C / 2, (R * C) / 2 - C / 2, minY - 0.9);
  return L;
}

// ===== Campanha nova (ids 101 a 120; `assemble.mjs` os põe na ordem final de dificuldade) =====
// Letras extras: _ vão aberto (sem mureta: dá para saltar de uma rampa) · A a E patamar fixo (+0,6 m cada) · x y z patamar abaixo (-0,6 m cada)
const G = (id, rows, movers) => LEVELS.push(gridLevel(id, rows, movers));

// 101 Reta com curva (bem simples)
G(101, ['@....#', '####.#', '####H#']);
// 102 Duas rampas: sobe duas vezes e vira
G(102, ['@..>..>..#', '########.#', '#H.......#']);
// 103 Areia e gelo: a areia segura, o gelo solta
G(103, ['@...s....#', '#######.##', '#H..s....#']);
// 104 Pinos: um corredor em S com rebatedores no meio do caminho
G(104, ['@..o..>.#', '#######.#', '#H.o.>..#']);

// 105 Ponte dupla: duas tábuas sobre a água
G(105, ['@..bbb..#', '#######.#', '#H..bb..#']);
// 106 Primeiro salto: rampa, vão aberto e patamar do outro lado
G(106, ['@...>_Ass...#', '###########.#', '#H.........#']);
// 107 Dois moinhos: corredor em S, um giratório em cada faixa
G(107, ['@...>..#', '######.#', '#H.>...#'], [
  { kind: 'spinner', col: 2, row: 0, length: 4 },
  { kind: 'spinner', col: 5, row: 2, length: 4, t0: 0.6 },
]);

// 108 Pista de gelo: duas faixas escorregadias ligadas por uma curva
G(108, ['@ii>iii.#', '#######.#', '#H.iii>.#']);

// 109 Escada de portões: três rampas, pêndulo, giratório e dois portões
G(109, ['@.>..>..>.#', '#########.#', '#H........#'], [
  { kind: 'pendulum', col: 3, row: 0, along: 'x', t0: 0.3 },
  { kind: 'gate', col: 5, row: 2, span: [0, 2.2], half: [0.2, 0.7], t0: 0.2 },
]);
// 110 Salto alto: duas rampas, vão de duas casas e patamar mais alto, com pêndulo
G(110, ['@..>>__B....#', '###########.#', '#H..........#'], [
  { kind: 'pendulum', col: 6, row: 2, along: 'x', t0: 0.4 },
]);
// 111 Labirinto: caminhos que se cruzam, com giratórios nos corredores longos
G(111, [
  '@..#.....',
  '##.#.###.',
  '...#...#.',
  '.#####.#.',
  '........H',
], [
  { kind: 'spinner', col: 3, row: 4, length: 3.4 },
  { kind: 'spinner', col: 6, row: 0, length: 3.4, t0: 1 },
]);
// 112 Corredor de portões: cinco paredes que abrem e fecham
G(112, ['@.........#', '#########.#', '#H........#'].map((r, i) => (i === 0 ? '@..........#' : i === 1 ? '##########.#' : '#H.........#')), [
  { kind: 'gate', col: 3, row: 0, span: [0, 2.4], half: [0.2, 0.8], t0: 0 },
  { kind: 'gate', col: 6, row: 0, span: [0, 2.4], half: [0.2, 0.8], t0: 1 },
  { kind: 'gate', col: 9, row: 0, span: [0, 2.4], half: [0.2, 0.8], t0: 2 },
  { kind: 'gate', col: 4, row: 2, span: [0, 2.4], half: [0.2, 0.8], t0: 0.6 },
  { kind: 'gate', col: 7, row: 2, span: [0, 2.4], half: [0.2, 0.8], t0: 1.6 },
]);
// 113 Ilhas: três ilhas ligadas por tábuas estreitas, com pinos nas bordas
G(113, ['@..~~o.~~..#', '...bb..bb..H', '...~~.o~~..#']);
// 114 Serpentina grande: sete faixas, cada uma com a sua armadilha
G(114, [
  '@..........',
  '##########.',
  '...........',
  '.##########',
  'H..........',
].map((r, i) => (i === 4 ? '...........' : r)).map((r, i) => (i === 4 ? '..........H' : r)), [
  { kind: 'spinner', col: 5, row: 0, length: 4 },
  { kind: 'pendulum', col: 5, row: 2, along: 'x', t0: 0.5 },
  { kind: 'gate', col: 6, row: 4, span: [0, 2.4], half: [0.2, 0.8], t0: 0.8 },
]);
// 115 Dois saltos: a rampa lança até o patamar, e a segunda lança até a ilha final
G(115, ['@..>>__B.#', '########.#', '#H..C_<..#'], [
  { kind: 'spinner', col: 8, row: 0, length: 3.4 },
  { kind: 'pendulum', col: 3, row: 2, along: 'x', t0: 0.2 },
]);

// 116 Fortaleza: sobe pela rampa, vira e sobe de novo até o buraco, com giratório e pêndulo
G(116, ['@..>..#', '#####.#', '#H.<..#'], [
  { kind: 'spinner', col: 4, row: 0, length: 3.4 },
  { kind: 'pendulum', col: 4, row: 2, along: 'x', t0: 0.5 },
]);

// 117 Cascata: o gramado desce em degraus, e cada degrau é um salto para baixo
G(117, ['@...._x...#', '#########.#', '#H...y_...#']);
// 118 Grande final: salto, portões, pista de gelo com pino e travessia por tábuas
G(118, [
  '@..>.>__B...#',
  '###########.#',
  '#...........#',
  '#.###########',
  '#H..bb.bb...#',
], [
  { kind: 'gate', col: 6, row: 2, span: [0, 2.2], half: [0.2, 0.7], t0: 0.3 },
  { kind: 'pendulum', col: 9, row: 4, along: 'x', t0: 0.9 },
]);
// 119 Pinball: dois corredores com rebatedores no caminho
G(119, ['@.o.o.>..#', '########.#', '#H.o.o.>.#']);

// 120 Dois caminhos: o atalho pelo salto ou a volta por gelo, ponte e pino
G(120, [
  '@...>_A...H',
  '.#########^',
  '..i.bb.o...',
]);


// 121 Gelo longo: dois corredores escorregadios ligados por uma curva
G(121, ['@..>iii..#', '########.#', '#H.iii>..#']);

// 122 Salto e curva: rampa, vão aberto e uma volta até o buraco
G(122, ['@...>_A.....#', '###########.#', '#H..........#']);
// 123 Serpentina curta: três faixas, cada uma com a sua armadilha
G(123, ['@..........', '##########.', 'H..........'], [
  { kind: 'spinner', col: 5, row: 0, length: 4 },
  { kind: 'pendulum', col: 5, row: 2, along: 'x', t0: 0.5 },
]);
// 124 Pontes e portão: duas travessias de tábua e uma parede que se mexe
G(124, ['@..bb.....#', '#########.#', '#H..bb....#'], [
  { kind: 'gate', col: 7, row: 2, span: [0, 2.2], half: [0.2, 0.7], t0: 0.6 },
]);

const holeModel = loadHole();
fs.mkdirSync(out, { recursive: true });
for (const L of LEVELS) {
  fs.writeFileSync(path.join(out, `level-${L.id}.json`), JSON.stringify(L.json(holeModel)));
  console.log(`level-${L.id}: ${L.solid.m.length} tris, ${L.moving.length} móveis`);
}
