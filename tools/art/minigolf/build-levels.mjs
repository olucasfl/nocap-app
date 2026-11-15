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
  wall(x0, z0, x1, z1, yTop, t = 0.25, yBot = yTop - 2) {
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
  /**
   * O loop da fase 9 do Open Golf (MIT), copiado para `loop-piece.json`: a bola entra por um lado, sobe em espiral, passa por cima
   * e sai 3,9 m ao lado. `k` gira em quartos de volta (0 = entra indo ao norte), `flip` espelha (sai para a esquerda).
   */
  loop(ox, oy, oz, k = 0, flip = false) {
    for (const piece of LOOP_PIECE) {
      const pts = [];
      for (let i = 0; i < 3; i++) {
        let x = piece.t[i * 3], z = piece.t[i * 3 + 2];
        if (flip) x = -x;
        for (let q = 0; q < k; q++) [x, z] = [-z, x];
        pts.push([ox + x, oy + piece.t[i * 3 + 1] + 0.5, oz + z]);
      }
      if (flip) pts.reverse();
      this.tri(pts[0], pts[1], pts[2], piece.m);
    }
    // pistas de entrada e de saída até a borda do bloco (3 m do centro), com mureta dos dois lados
    const T = (lx, lz) => {
      let x = flip ? -lx : lx, z = lz;
      for (let q = 0; q < k; q++) [x, z] = [-z, x];
      return [ox + x, oz + z];
    };
    for (const [cx, sgn] of [[LOOP_SHIFT, -1]]) {
      const [ax, az] = T(cx - LOOP_LANE, 0), [bx, bz] = T(cx + LOOP_LANE, 3 * sgn);
      this.floor(ax, az, bx, bz, oy);
      for (const sx of [-LOOP_LANE, LOOP_LANE]) {
        const [px, pz] = T(cx + sx, 2.3 * sgn), [qx, qz] = T(cx + sx, 3 * sgn);
        this.wall(px, pz, qx, qz, oy + 1, 0.25, oy - 0.3);
      }
    }
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
const LOOP_PIECE = JSON.parse(fs.readFileSync(new URL('./loop-piece.json', import.meta.url), 'utf8'));
// letras do loop: giro (quartos de volta) e espelho. L/M entram indo ao norte, N/O ao leste, P/Q ao sul, R/S ao oeste
const LOOP_SHIFT = 3.86, LOOP_LANE = 1.1; // deslocamento da saída e meia largura da pista
const LOOP_CH = { L: [0, 0], M: [0, 1], N: [1, 0], O: [1, 1], P: [2, 0], Q: [2, 1], R: [3, 0], S: [3, 1] };


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
  {
    // toda fase precisa ter caminho do início ao buraco por células de chão (os blocos de loop não entram na conta)
    let hole = null;
    for (let r = 0; r < R; r++) for (let c = 0; c < Wd; c++) if (ch(c, r) === 'H') hole = [c, r];
    if (!hole) throw new Error(`fase ${id}: sem buraco`);
    const hasLoop = rows.some((row) => [...row].some((k) => LOOP_CH[k] || k === '_')); // loops e vãos de salto são checados pelo robô
    if (!hasLoop) {
      const seen = new Set([start.join()]);
      const qq = [start];
      while (qq.length) {
        const [c, r] = qq.shift();
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = [c + dc, r + dr].join();
          if (seen.has(k) || !solid(c + dc, r + dr)) continue;
          seen.add(k);
          qq.push([c + dc, r + dr]);
        }
      }
      if (!seen.has(hole.join())) throw new Error(`fase ${id}: o buraco não é alcançável pelo chão`);
    }
  }
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
  // loops: cada letra marca um bloco (3x2 ou 2x3 células) sem chão; a peça traz as pistas de entrada e de saída
  const loops = [], openings = [];
  for (const k of Object.keys(LOOP_CH)) {
    const cells = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < Wd; c++) if (ch(c, r) === k) cells.push([c, r]);
    if (!cells.length) continue;
    const [rot, flip] = LOOP_CH[k];
    const c0 = Math.min(...cells.map((a) => a[0])), r0 = Math.min(...cells.map((a) => a[1]));
    const w = rot % 2 === 0 ? 3 : 2, h = rot % 2 === 0 ? 2 : 3;
    if (cells.length !== w * h - 1) throw new Error(`loop ${k} da fase ${id}: o bloco tem ${w}x${h} células menos a de entrada (${w * h - 1})`);
    let ox, oz;
    if (rot === 0) [ox, oz] = [(flip ? c0 + 2 : c0) * C, r0 * C + C / 2];
    else if (rot === 1) [ox, oz] = [c0 * C + C / 2, (flip ? r0 + 2 : r0) * C];
    else if (rot === 2) [ox, oz] = [(flip ? c0 : c0 + 2) * C, r0 * C + C / 2];
    else [ox, oz] = [c0 * C + C / 2, (flip ? r0 : r0 + 2) * C];
    const y = low.get(cells[0].join()) ?? 0;
    const lp = { rot, flip: !!flip, ox, oz, y };
    loops.push(lp);
    const T = (lx, lz) => {
      let x = lp.flip ? -lx : lx, z = lz;
      for (let q = 0; q < rot; q++) [x, z] = [-z, x];
      return [ox + x, oz + z];
    };
    openings.push([T(-1.6, 0), T(1.6, 0)], [T(LOOP_SHIFT - LOOP_LANE - 0.15, -3), T(LOOP_SHIFT + LOOP_LANE + 0.15, -3)]);
  }
  const isLoop = (c, r) => !!LOOP_CH[ch(c, r)];
  // muro que deixa livres as bocas das pistas do loop
  const wallSeg = (x0, z0, x1, z1, top) => {
    let segs = [[x0, z0, x1, z1]];
    for (const [a, b] of openings) {
      const horiz = z0 === z1;
      if (horiz ? Math.abs(a[1] - z0) > 0.01 || Math.abs(b[1] - z0) > 0.01 : Math.abs(a[0] - x0) > 0.01 || Math.abs(b[0] - x0) > 0.01) continue;
      const lo = Math.min(horiz ? a[0] : a[1], horiz ? b[0] : b[1]), hi = Math.max(horiz ? a[0] : a[1], horiz ? b[0] : b[1]);
      const out = [];
      for (const [sx0, sz0, sx1, sz1] of segs) {
        const s0 = horiz ? sx0 : sz0, s1 = horiz ? sx1 : sz1;
        if (hi <= s0 || lo >= s1) { out.push([sx0, sz0, sx1, sz1]); continue; }
        if (lo > s0) out.push(horiz ? [sx0, sz0, lo, sz1] : [sx0, sz0, sx1, lo]);
        if (hi < s1) out.push(horiz ? [hi, sz0, sx1, sz1] : [sx0, hi, sx1, sz1]);
      }
      segs = out;
    }
    for (const [a, b, c2, d] of segs) L.wall(a, b, c2, d, top);
  };
  const yTop = (c, r) => {
    const l = low.get([c, r].join()) ?? 0;
    return ramp(c, r) ? l + RISE : l;
  };
  let minY = 0;
  low.forEach((v) => (minY = Math.min(minY, v)));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < Wd; c++) {
      const k = ch(c, r);
      if (!solid(c, r) || isLoop(c, r)) continue;
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
      const edge = (cc, rr) => (!solid(cc, rr) || isLoop(cc, rr)) && ch(cc, rr) !== '_';
      if (edge(c, r - 1)) wallSeg(x0, z0, x1, z0, top);
      if (edge(c, r + 1)) wallSeg(x0, z1, x1, z1, top);
      if (edge(c - 1, r)) wallSeg(x0, z0, x0, z1, top);
      if (edge(c + 1, r)) wallSeg(x1, z0, x1, z1, top);
    }
  }
  for (const lp of loops) L.loop(lp.ox, lp.y, lp.oz, lp.rot, lp.flip);
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


// ===== Circuitos em serpentina (ids 130 em diante) =====
// Cada faixa é escrita na ordem em que se anda: U sobe a rampa, D desce, i gelo, s areia, o pino, b ponte, _ vão, A a E patamar.
// Faixas pares vão da esquerda para a direita, ímpares da direita para a esquerda; a ligação entre faixas fica na ponta.
function serp(id, W, lanes, movers = []) {
  const rows = [];
  const flip = (c, west) => (west ? ({ U: '<', D: '>' }[c] ?? c) : ({ U: '>', D: '<' }[c] ?? c));
  lanes.forEach((ln, i) => {
    const west = i % 2 === 1;
    let cells = [...ln].map((c) => flip(c, west));
    if (west) cells = cells.reverse();
    rows.push(cells.join(''));
    if (i < lanes.length - 1) {
      const at = west ? 0 : W - 1;
      rows.push([...'#'.repeat(W)].map((c, k) => (k === at ? '.' : c)).join(''));
    }
  });
  const ms = movers.map((m) => {
    const west = m.lane % 2 === 1;
    return { ...m, col: west ? W - 1 - m.col : m.col, row: m.lane * 2 };
  });
  LEVELS.push(gridLevel(id, rows, ms));
}
const GATE = { kind: 'gate', span: [0, 2.2], half: [0.2, 0.7] };
// 130 Primeiro circuito: pêndulo, rampa para subir e rampa para descer
serp(130, 9, ['@...U....', '....D....', '....o...H'], [{ kind: 'pendulum', lane: 0, col: 2, along: 'x', t0: 0.3 }, { ...GATE, lane: 2, col: 2, t0: 0.5 }]);
// 131 Dois moinhos: um giratório em cada faixa e uma subida no meio
serp(131, 9, ['@....U...', '...D.....', '........H'], [{ kind: 'spinner', lane: 0, col: 2, length: 4 }, { kind: 'spinner', lane: 1, col: 6, length: 4, t0: 0.6 }, { kind: 'spinner', lane: 2, col: 4, length: 4, t0: 1.1 }]);
// 132 Gelo de verdade: a faixa do meio é toda de gelo, com portões antes e depois
serp(132, 9, ['@..U.....', 'iiiiiiiii', '...D....H'], [{ ...GATE, lane: 0, col: 6, t0: 0.2 }, { ...GATE, lane: 2, col: 5, t0: 1.4 }]);
// 133 Pinball: pinos nas três faixas e uma rampa que lança para baixo
serp(133, 9, ['@.o.o.U..', '..o.D.o..', '..o.o...H'], [{ ...GATE, lane: 1, col: 7, t0: 0.9 }]);
// 134 Circuito das pontes: duas pontes, gelo no fim e pêndulos
serp(134, 10, ['@..U......', '....bb..D.', '..i.ii.U..', '..o...D..H'], [{ kind: 'pendulum', lane: 0, col: 6, along: 'x', t0: 0.2 }, { kind: 'pendulum', lane: 3, col: 4, along: 'x', t0: 1.0 }]);
// 135 Gelo e rampas: gelo em duas faixas, subida e descida entre elas
serp(135, 11, ['@..Uiiii...', '...iiiiD...', '.D.iiii...H'], [{ ...GATE, lane: 0, col: 9, t0: 0.4 }, { kind: 'spinner', lane: 2, col: 8, length: 3.4 }]);
// 136 Salto no meio: uma faixa lança a bola por cima de um vão para o patamar
serp(136, 10, ['@.o...o...', '.....U_A..', '..D......H'], [{ ...GATE, lane: 0, col: 5, t0: 0.7 }, { kind: 'pendulum', lane: 2, col: 5, along: 'x', t0: 0.4 }]);
// 137 Quatro faixas: giratório, portão, ponte e um salto final
serp(137, 9, ['@..U.....', '...bb.D..', '.s...U_A.', '..D.....H'], [{ kind: 'spinner', lane: 0, col: 6, length: 4 }, { ...GATE, lane: 1, col: 6, t0: 0.5 }]);
// 138 Grande circuito: cinco faixas com tudo: rampas, gelo, ponte, portões e giratórios
serp(138, 12, ['@...U.......', '.....i.iiD..', '....s..bb..U', '...D.o..iiii', '..U........H'], [{ kind: 'spinner', lane: 0, col: 8, length: 4 }, { ...GATE, lane: 1, col: 3, t0: 0.4 }, { kind: 'pendulum', lane: 2, col: 4, along: 'x', t0: 0.9 }, { ...GATE, lane: 3, col: 8, t0: 1.7 }]);
// 139 Ida e volta: portão, ponte curta, giratório e uma descida longa até o copo
serp(139, 10, ['@..U......', '..D...bb..', '....U..o..', '..D......H'], [{ ...GATE, lane: 0, col: 6, t0: 0.3 }, { kind: 'spinner', lane: 1, col: 3, length: 4, t0: 0.8 }, { kind: 'pendulum', lane: 3, col: 5, along: 'x', t0: 1.2 }]);
// 140 O loop: entra na diagonal, sobe a espiral e sai ao lado (peça do Open Golf)
G(140, ['#.H..#', '#LLL##', '..LL##', '@...##']);
// 141 Loop com giratório: corrida até a rampa em espiral e, depois dela, um pino antes do buraco
G(141, ['#######H#', '####..o..', '###LLL###', '....LL###', '.o.....##', '@........'], [{ kind: 'spinner', col: 5, row: 5, length: 4 }]);
// 142 Loop espelhado: sai pela esquerda; o caminho de volta tem pino e giratório
G(142, ['##H######', '.o....###', '###MMM###', '###MM....', '#........', '#.o.....@'], [{ kind: 'spinner', col: 4, row: 4, length: 4, t0: 0.7 }]);
// 143 Loop para o leste: o corredor começa no alto, passa pelo loop e desce até o buraco
G(143, ['@..o.####', '....N####', '###NN.o..', '###NN....', '########H'], [{ kind: 'pendulum', col: 7, row: 3, along: 'x', t0: 0.3 }]);
// 144 Dois loops: o primeiro sobe para o norte, o corredor com giratório leva ao segundo, que vira para o leste e termina no buraco
G(144, ['#########', '#########', '####..###', '####..N##', '##...NN..', '#LLL#NN.H', '..LL#####', '@.#######'], [{ kind: 'spinner', col: 3, row: 4, length: 3.4 }]);

// ===== Reformulação (ids 201 a 224): requisitos mínimos, formatos próprios e tamanho que cresce com a dificuldade =====
// Requisitos de toda fase nova (conferidos aqui, sem robô; a fase que falhar derruba a construção):
//  1 há caminho de chão do início ao buraco (loops conferidos à parte)
//  2 caminho mínimo: fácil 10 células, médio 14, difícil 22 (3 m cada)
//  3 o caminho faz pelo menos uma curva (nada de reta)
//  4 a bola não chega ao buraco em linha reta livre: tem de haver parede, pino, peça móvel, água ou desnível na linha
//  5 gelo e areia só ficam no caminho (nunca num canto vazio): precisam estar em algum trajeto mais curto
//  6 obstáculos de tipos diferentes: fácil 1, médio 2, difícil 3 (giratório, pêndulo, portão, pino, água, rampa, gelo, areia, loop)
const TIER = { easy: [10, 1], medium: [14, 2], hard: [22, 3] };
function validate(id, tier, rows, movers) {
  const R = rows.length, W = Math.max(...rows.map((r) => r.length));
  const ch = (c, r) => rows[r]?.[c] ?? '#';
  const solid = (c, r) => !['#', ' ', '_'].includes(ch(c, r));
  const find = (k) => { for (let r = 0; r < R; r++) for (let c = 0; c < W; c++) if (ch(c, r) === k) return [c, r]; return null; };
  const st = find('@'), hl = find('H');
  const kinds = new Set(movers.map((m) => m.kind));
  const all = rows.join('');
  if (/[LMNOPQRS]/.test(all)) kinds.add('loop');
  if (all.includes('o')) kinds.add('pino');
  if (/[~b]/.test(all)) kinds.add('agua');
  if (/[\^v<>]/.test(all)) kinds.add('rampa');
  if (all.includes('i')) kinds.add('gelo');
  if (all.includes('s')) kinds.add('areia');
  const [minPath, minKinds] = TIER[tier];
  const fail = (m) => { throw new Error(`fase ${id} (${tier}): ${m}`); };
  if (kinds.size < minKinds) fail(`só ${kinds.size} tipo(s) de obstáculo (${[...kinds]}), precisa de ${minKinds}`);
  if (kinds.has('loop')) return { path: 0, kinds: [...kinds] };
  const bfs = (from) => {
    const d = new Map([[from.join(), 0]]);
    const q = [from];
    while (q.length) {
      const [c, r] = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = [c + dc, r + dr].join();
        if (d.has(k) || !solid(c + dc, r + dr)) continue;
        d.set(k, d.get([c, r].join()) + 1);
        q.push([c + dc, r + dr]);
      }
    }
    return d;
  };
  const ds = bfs(st), dh = bfs(hl);
  const D = ds.get(hl.join());
  if (D === undefined) fail('o buraco não é alcançável pelo chão');
  const cells = D + 1;
  if (cells < minPath) fail(`caminho de ${cells} células, precisa de ${minPath}`);
  // uma trilha mais curta, para contar as curvas
  let cur = st, dir = null, turns = 0;
  while (cur.join() !== hl.join()) {
    const here = ds.get(cur.join());
    const nxt = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [cur[0] + dc, cur[1] + dr, dc, dr]).find(([c, r]) => dh.get([c, r].join()) === dh.get(cur.join()) - 1 && ds.get([c, r].join()) === here + 1);
    if (dir && (dir[0] !== nxt[2] || dir[1] !== nxt[3])) turns++;
    dir = [nxt[2], nxt[3]];
    cur = [nxt[0], nxt[1]];
  }
  if (turns < 1) fail('o caminho é uma reta');
  // linha reta livre do início ao buraco
  const blocker = (c, r) => !solid(c, r) || 'o~b^v<>ABCDExyz'.includes(ch(c, r)) || movers.some((m) => m.col === c && m.row === r);
  let free = true;
  for (let t = 0; t <= 1 && free; t += 0.01) {
    const c = Math.round(st[0] + (hl[0] - st[0]) * t), r = Math.round(st[1] + (hl[1] - st[1]) * t);
    if (blocker(c, r)) free = false;
  }
  if (free) fail('dá para acertar o buraco em linha reta');
  // gelo e areia só no caminho
  for (let r = 0; r < R; r++) for (let c = 0; c < W; c++) {
    if (!'is'.includes(ch(c, r))) continue;
    const a = ds.get([c, r].join()), b = dh.get([c, r].join());
    if (a === undefined || b === undefined || a + b !== D) fail(`${ch(c, r) === 'i' ? 'gelo' : 'areia'} fora do caminho em (${c},${r})`);
  }
  return { path: cells, turns, kinds: [...kinds] };
}
const STATS = {};
const T = (id, tier, rows, movers = []) => {
  STATS[id] = validate(id, tier, rows, movers);
  LEVELS.push(gridLevel(id, rows, movers));
};
const GX = (col, row, span, half, t0 = 0) => ({ kind: 'gate', col, row, span, half, t0 });
const HG = (col, row, t0 = 0) => GX(col, row, [0, 2.2], [0.2, 0.7], t0); // portão num corredor leste-oeste
const VG = (col, row, t0 = 0) => GX(col, row, [2.2, 0], [0.7, 0.2], t0); // portão num corredor norte-sul
const SP = (col, row, t0 = 0) => ({ kind: 'spinner', col, row, length: 3.4, t0 });

// Labirinto por semente: caminho do início ao ponto mais longe, com obstáculos espaçados ao longo da solução
function maze(id, tier, mw, mh, seed, hazards) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const W = 2 * mw + 1, H = 2 * mh + 1;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const seen = new Set(['0,0']);
  const stack = [[0, 0]];
  g[1][1] = '.';
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => cx + dx >= 0 && cy + dy >= 0 && cx + dx < mw && cy + dy < mh && !seen.has(`${cx + dx},${cy + dy}`));
    if (!nb.length) { stack.pop(); continue; }
    const [dx, dy] = nb[Math.floor(rnd() * nb.length)];
    seen.add(`${cx + dx},${cy + dy}`);
    g[2 * cy + 1 + dy][2 * cx + 1 + dx] = '.';
    g[2 * (cy + dy) + 1][2 * (cx + dx) + 1] = '.';
    stack.push([cx + dx, cy + dy]);
  }
  // o buraco: a célula do labirinto mais distante do início
  const dist = new Map([['1,1', 0]]), par = new Map();
  const q = [[1, 1]];
  let far = [1, 1];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (g[y + dy]?.[x + dx] !== '.' || dist.has(k)) continue;
      dist.set(k, dist.get(`${x},${y}`) + 1);
      par.set(k, [x, y]);
      q.push([x + dx, y + dy]);
      if (dist.get(k) > dist.get(far.join())) far = [x + dx, y + dy];
    }
  }
  const path = [far];
  while (par.has(path[0].join())) path.unshift(par.get(path[0].join()));
  g[1][1] = '@';
  g[far[1]][far[0]] = 'H';
  const movers = [];
  const L = path.length;
  hazards.forEach((hz, k) => {
    let i = Math.floor(((k + 1) * L) / (hazards.length + 1));
    for (; i < L - 2; i++) {
      const [x, y] = path[i], [px, py] = path[i - 1], [nx, ny] = path[i + 1];
      const horiz = py === y && ny === y, vert = px === x && nx === x;
      if (!(horiz || vert) || g[y][x] !== '.') continue;
      if (hz === 'spinner') movers.push(SP(x, y, 0.4 * k));
      else if (hz === 'gate') movers.push(horiz ? HG(x, y, 0.3 * k) : VG(x, y, 0.3 * k));
      else if (hz === 'pendulum') movers.push(horiz ? { kind: 'pendulum', col: x, row: y, along: 'x', t0: 0.3 * k } : { kind: 'pendulum', col: x, row: y, t0: 0.3 * k });
      else if (hz === 'o') g[y][x] = 'o';
      else if (hz === 'i' || hz === 's') {
        // trecho de duas células seguidas na mesma direção
        const [qx, qy] = path[i + 1];
        if (g[qy][qx] === '.' && i + 1 < L - 1) { g[y][x] = hz; g[qy][qx] = hz; } else continue;
      }
      break;
    }
  });
  T(id, tier, g.map((r) => r.join('')), movers);
}

// Escada gerada: degraus de `flat` células, uma rampa entre eles, e um obstáculo diferente em cada degrau
function stairs(id, tier, steps, flat, hazards) {
  const Wd = (flat - 1) * steps + 1, Ht = 2 * steps - 1;
  const g = Array.from({ length: Ht }, () => Array(Wd).fill('#'));
  const movers = [];
  for (let k = 0; k < steps; k++) {
    const x0 = (flat - 1) * k, y = 2 * k;
    for (let x = x0; x < x0 + flat; x++) g[y][x] = '.';
    if (k < steps - 1) g[y + 1][x0 + flat - 1] = 'v';
    const mid = x0 + 1, hz = hazards[k % hazards.length];
    if (hz === 'o') g[y][mid] = 'o';
    else if (hz === 'i') { g[y][mid] = 'i'; g[y][mid + 1] = 'i'; }
    else if (hz === 's') { g[y][mid] = 's'; g[y][mid + 1] = 's'; }
    else if (hz === 'b') g[y][mid] = 'b';
    else if (hz === 'gate') movers.push(HG(mid, y, 0.3 * k));
    else if (hz === 'spinner') movers.push(SP(mid, y, 0.4 * k));
    else if (hz === 'pendulum') movers.push({ kind: 'pendulum', col: mid, row: y, along: 'x', t0: 0.3 * k });
  }
  g[0][0] = '@';
  g[Ht - 1][Wd - 1] = 'H';
  T(id, tier, g.map((r) => r.join('')), movers);
}

// ---- fáceis ----
// 201 Moinho: o giratório faz de pás de moinho no meio do caminho
T(201, 'easy', ['@..#####', '##.#####', '##...o..', '#####.##', '#####..H'], [SP(3, 2)]);
// 202 Ponte do moinho: duas tábuas sobre a água
T(202, 'easy', ['@..bbb...', '########.', '#H..bbb..'], [{ kind: 'pendulum', col: 7, row: 0, along: 'x', t0: 0.3 }, HG(2, 2, 0.4)]);
// 203 Trincheira: a areia fica na reta final, perto do buraco
T(203, 'easy', ['@...o..', '######.', 'Hsss...'], [SP(2, 0)]);
// 204 Descida: ladeira, curva e outra ladeira até o buraco
T(204, 'easy', ['@..<<<...', '########.', '#H..>>>o.'], [SP(7, 0)]);
// 205 Anel do pomar: duas voltas em torno de um bloco, com pinos de um lado e giratório do outro
T(205, 'easy', ['@......', '.#####.', '.#####o', '.#####.', '.....sH'], [SP(0, 2)]);
// ---- médias ----
// 206 Colina: o topo tem subida e descida; a volta pela esquerda é de gelo, com giratório
T(206, 'medium', ['@.>>......', 'i########^', 'i########^', 'i########.', 'i########.', '........H.'], [SP(0, 2), HG(6, 0, 0.5)]);
// 207 Lago: a tábua longa é o atalho; a volta por fora é segura
T(207, 'medium', ['@............', '.~~~~~~~~~~~.', '.bbbbbbbbbbbH', '.~~~~~~~~~~~.', '......o......'], [{ kind: 'pendulum', col: 4, row: 2, along: 'x', t0: 0.3 }, { kind: 'pendulum', col: 8, row: 2, along: 'x', t0: 1.1 }]);
// 208 Salas: quatro salas ligadas por portas, subindo na diagonal
T(208, 'medium', ['####.......', '####...#.o.', '#####.##..H', '####...####', '...#...####', '.@.....####', '...########'], [HG(3, 4, 0.3), SP(5, 4)]);
// 209 Escada: sobe em degraus na diagonal
T(209, 'medium', ['@..######', '##v######', '##.o.####', '####v####', '####...##', '######v##', '######..H'], [HG(5, 4, 0.4), SP(5, 4)]);
maze(210, 'medium', 4, 3, 7, ['o', 'spinner', 'gate']);
// 211 Torre: o caminho sobe em volta de uma torre até o buraco no topo
T(211, 'medium', ['@.>>...', '######v', 'H#####v', '.#####.', '^#####.', '^#####.', '....<<.'], [SP(4, 0), { kind: 'pendulum', col: 6, row: 4, t0: 0.5 }]);
// 212 Caracol: espiral para dentro, com o buraco no centro
T(212, 'medium', ['@......', '######.', '.....#.', '.###.#s', '.#H..#.', '.#####.', '.......'], [SP(3, 0), { kind: 'pendulum', col: 3, row: 6, along: 'x', t0: 0.6 }]);
// 213 Descida em S: duas ladeiras e o final em gelo
T(213, 'medium', ['@..<<<.....', '##########.', '......>>>..', '.##########', '.iiiiiiiH..'], [HG(9, 2, 0.2), SP(2, 0)]);
// 214 Escada que desce, com ponte e gelo nos degraus
T(214, 'medium', ['######..@', '######^##', '####i.i##', '####^####', '##.b.####', '##^######', 'H..######'], [SP(5, 2)]);
maze(215, 'medium', 4, 4, 21, ['spinner', 'i', 'o', 'gate']);
// 216 Loop e gelo: sobe a espiral e sai deslizando no gelo até o buraco
T(216, 'medium', ['#..iiiiiH#', '#LLL######', '..LL######', '@...######'], [SP(5, 0)]);
// 217 Ilha no lago: duas tábuas e uma ilha com giratório no meio
T(217, 'medium', ['@............', '.~~~~~~~~~~~.', '.bbbb...bbbbH', '.~~~~~~~~~~~.', '......o......'], [{ kind: 'pendulum', col: 2, row: 2, along: 'x', t0: 0.2 }, SP(6, 2), { kind: 'pendulum', col: 10, row: 2, along: 'x', t0: 1.1 }]);
// 218 Caracol grande: espiral que desce, com areia e giratórios
T(218, 'medium', ['@........', '########.', '.<.....#.', '.#####.#.', '.#H.>..#.', '.#######.', '.........'], [SP(4, 0), { kind: 'pendulum', col: 4, row: 6, along: 'x', t0: 0.8 }]);
// ---- difíceis ----
// 219 Colina dupla: uma colina em cima, outra embaixo
T(219, 'hard', ['@.>>o<<...', '#########.', 'H########.', '.########.', '.>>...<<..'], [SP(0, 3), VG(9, 2, 0.5), { kind: 'pendulum', col: 4, row: 4, along: 'x', t0: 0.2 }]);
maze(220, 'hard', 5, 4, 5, ['spinner', 's', 'gate', 'o', 'spinner']);
// 221 Terraços: cinco degraus, cada um com um obstáculo diferente
stairs(221, 'hard', 5, 4, ['o', 'i', 'b', 'gate', 'spinner']);
maze(222, 'hard', 5, 5, 11, ['spinner', 'i', 'o', 'gate', 's', 'spinner']);
// 223 Quatro salas: quatro salas na diagonal, cada uma com seu moinho
T(223, 'hard', ['###############.H.', '###############..o', '##########........', '##########...#####', '#####........#####', '#####...##########', '........##########', '.@.###############', '...###############'], [HG(3, 6, 0.3), SP(6, 5), { kind: 'pendulum', col: 8, row: 4, along: 'x', t0: 0.5 }, SP(11, 3, 0.9), { kind: 'pendulum', col: 13, row: 2, along: 'x', t0: 0.2 }]);
maze(224, 'hard', 6, 5, 3, ['i', 'spinner', 's', 'gate', 'spinner', 'o', 'i', 'pendulum']);

// ===== Fase 21: Grande Circuito (spec 082) =====
// Junta peças do Open Golf numa fase só e desce em andares: pêndulos da 6, loop da 9, lombadas da 4, giratórios da 1, o rio da 7,
// paredes deslizantes da 18, curvas arredondadas, uma colina e, no fim, a fase 5 inteira (rampa suave, espiral que desce 6 m e
// câmara redonda do buraco). Muros do tamanho do original (0,5 m de espessura, 0,375 m de altura) e corredores de 5 m.
// Nada pode ser contornado: os obstáculos fecham a passagem dos lados.
function grandCircuit() {
  const dir = new URL('../../../packages/games/src/minigolf/levels/', import.meta.url);
  const rd = (n) => JSON.parse(fs.readFileSync(new URL(`level-${n}.json`, dir), 'utf8'));
  const og5 = rd(5), og6 = rd(6), og1 = rd(1), og18 = rd(18), og4 = rd(4), og7 = rd(7);
  const FY = 8.625, OGF = -0.375;
  const TOP = FY + 3; // o circuito começa 3 m acima do deque da fase 5 e desce
  const L = new Level(250);
  const mats = og5.materials.map((m) => ({ ...m }));
  const mid = (name, src) => {
    let i = mats.findIndex((m) => m.name === name);
    if (i < 0) {
      const sm = src.materials.find((m) => m.name === name);
      mats.push({ name, f: sm?.f ?? 0, r: sm?.r ?? 0, v: sm?.v ?? 0 });
      i = mats.length - 1;
    }
    return i;
  };
  L.mi = (name) => mid(name, og5);
  // o final da fase 5 vem inteiro; só sai a tampa leste do deque (é por onde o circuito novo chega)
  const base = JSON.parse(JSON.stringify(og5));
  {
    const keep = { t: [], m: [], f: [] };
    for (let i = 0; i < base.solid.m.length; i++) {
      const v = base.solid.t.slice(i * 9, i * 9 + 9);
      const nm = base.materials[base.solid.m[i]].name;
      if ((nm === 'wall-top' || nm === 'wall-side') && Math.min(v[0], v[3], v[6]) >= 22.9 && Math.max(v[1], v[4], v[7]) > 8) continue;
      keep.t.push(...v); keep.m.push(base.solid.m[i]); keep.f.push(base.solid.f[i]);
    }
    base.solid = keep;
  }
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const qo = (a, b, c, d, want, mat) => {
    const n = cross3(sub3(b, a), sub3(c, a));
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) L.quad(a, d, c, b, mat);
    else L.quad(a, b, c, d, mat);
  };
  const WALL_H = 0.375, WALL_T = 0.5;
  const V = (p, y) => [p[0], y, p[1]];
  const wallSeg = (a0, b0, a1, b1, h0, h1) => {
    const yb0 = h0 - 0.125, yt0 = h0 + WALL_H, yb1 = h1 - 0.125, yt1 = h1 + WALL_H;
    const cx = (a0[0] + b0[0] + a1[0] + b1[0]) / 4, cz = (a0[1] + b0[1] + a1[1] + b1[1]) / 4;
    qo(V(a0, yt0), V(b0, yt0), V(b1, yt1), V(a1, yt1), [0, 1, 0], 'wall-top');
    const sa = [(a0[0] + a1[0]) / 2 - cx, 0, (a0[1] + a1[1]) / 2 - cz], sb = [(b0[0] + b1[0]) / 2 - cx, 0, (b0[1] + b1[1]) / 2 - cz];
    qo(V(a0, yb0), V(a1, yb1), V(a1, yt1), V(a0, yt0), sa, 'wall-side');
    qo(V(b0, yb0), V(b1, yb1), V(b1, yt1), V(b0, yt0), sb, 'wall-side');
  };
  const floorSeg = (l0, r0, l1, r1, h0, h1) => qo(V(l0, h0), V(r0, h0), V(r1, h1), V(l1, h1), [0, 1, 0], 'ground');
  const hv = (phi) => ({ d: [-Math.sin(phi), -Math.cos(phi)], r: [Math.cos(phi), -Math.sin(phi)] });
  const W = 5;
  let P = [0, 0], PHI = 0, CH = TOP; // posição, rumo e altura do piso no começo do trecho
  // trecho reto. `gaps` = intervalos sem piso (onde entram as plataformas copiadas); `ramps` = mudanças de altura suaves
  // ({ s0, len, dh }: dh > 0 sobe, dh < 0 desce); `fill` = blocos que fecham os lados (s0, s1, folga de cada lado)
  const straight = (len, o = {}) => {
    const w = o.W ?? W, gaps = o.gaps ?? [], ramps = o.ramps ?? [];
    const { d, r } = hv(PHI);
    const hAt = (s) => ramps.reduce((h, k) => h + (s <= k.s0 ? 0 : s >= k.s0 + k.len ? k.dh : (k.dh * (1 - Math.cos(Math.PI * ((s - k.s0) / k.len)))) / 2), 0);
    const step = ramps.length ? 0.25 : 1;
    const at = (s, off) => [P[0] + d[0] * s + r[0] * off, P[1] + d[1] * s + r[1] * off];
    for (let s = 0; s < len - 1e-6; s += step) {
      const e = Math.min(len, s + step);
      const h0 = CH + hAt(s), h1 = CH + hAt(e);
      if (!gaps.some(([g0, g1]) => s >= g0 - 1e-6 && e <= g1 + 1e-6)) floorSeg(at(s, -w / 2), at(s, w / 2), at(e, -w / 2), at(e, w / 2), h0, h1);
      wallSeg(at(s, -w / 2 - WALL_T), at(s, -w / 2), at(e, -w / 2 - WALL_T), at(e, -w / 2), h0, h1);
      wallSeg(at(s, w / 2), at(s, w / 2 + WALL_T), at(e, w / 2), at(e, w / 2 + WALL_T), h0, h1);
    }
    const start = { P: [...P], d, r, CH };
    P = at(len, 0);
    CH += hAt(len);
    return { s: (sv, off = 0) => [start.P[0] + start.d[0] * sv + start.r[0] * off, start.P[1] + start.d[1] * sv + start.r[1] * off], h: (sv) => start.CH + hAt(sv) };
  };
  const arc = (turn, R, w = W) => {
    const { r } = hv(PHI);
    const C = [P[0] - r[0] * R * turn, P[1] - r[1] * R * turn];
    const N = 24;
    const pt = (a, off) => {
      const rr = hv(PHI + turn * a).r;
      return [C[0] + turn * (R + off) * rr[0], C[1] + turn * (R + off) * rr[1]];
    };
    for (let k = 0; k < N; k++) {
      const a0 = ((k / N) * Math.PI) / 2, a1 = (((k + 1) / N) * Math.PI) / 2;
      floorSeg(pt(a0, -w / 2), pt(a0, w / 2), pt(a1, -w / 2), pt(a1, w / 2), CH, CH);
      wallSeg(pt(a0, -w / 2 - WALL_T), pt(a0, -w / 2), pt(a1, -w / 2 - WALL_T), pt(a1, -w / 2), CH, CH);
      wallSeg(pt(a0, w / 2), pt(a0, w / 2 + WALL_T), pt(a1, w / 2), pt(a1, w / 2 + WALL_T), CH, CH);
    }
    P = pt(Math.PI / 2, 0);
    PHI += turn * (Math.PI / 2);
  };
  // peças copiadas do Open Golf (já convertidas em levels/level-N.json)
  const copySolid = (src, pick, dx, dy, dz) => {
    const t = src.solid.t, m = src.solid.m, f = src.solid.f;
    const box = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
    for (let i = 0; i < m.length; i++) {
      if (f[i] & 1) continue;
      const v = t.slice(i * 9, i * 9 + 9), nm = src.materials[m[i]].name;
      if (!pick(v, nm)) continue;
      for (let k = 0; k < 9; k += 3) {
        L.solid.t.push(r4(v[k] + dx), r4(v[k + 1] + dy), r4(v[k + 2] + dz));
        box.x0 = Math.min(box.x0, v[k] + dx); box.x1 = Math.max(box.x1, v[k] + dx);
        box.z0 = Math.min(box.z0, v[k + 2] + dz); box.z1 = Math.max(box.z1, v[k + 2] + dz);
      }
      L.solid.m.push(mid(nm, src));
      L.solid.f.push(0);
    }
    return box;
  };
  const copyMover = (mv, src, dx, dy, dz) =>
    L.moving.push({ name: mv.name, movement: mv.movement, base: { p: [mv.base.p[0] + dx, mv.base.p[1] + dy, mv.base.p[2] + dz], s: mv.base.s, r: mv.base.r }, t: mv.t, m: mv.m.map((i) => mid(src.materials[i].name, src)), f: mv.f });
  // bloco que fecha um vão: de x0 a x1, de z0 a z1, na altura h (topo 0,6 m acima do piso: mais alto que a bola)
  const block = (x0, x1, z0, z1, h) => L.box(Math.min(x0, x1), h - 0.125, Math.min(z0, z1), Math.max(x0, x1), h + 0.6, Math.max(z0, z1), 'wall-top', 'wall-side');

  // ---- medidas do percurso (calculadas do final fixo para trás: o deque da fase 5 fica em x = 23,25, z = -13,75, virado para o oeste) ----
  const R = 7.5;
  const LF = 22; // reta final (colina com giratório)
  const XF = 23.25 + LF; // onde a reta final começa
  const XT = XF + 2 * R; // fim da reta oeste de cima
  const L3 = 24; // reta oeste de cima (rio, descida, paredes deslizantes)
  const XA = XT + L3; // começo dela (logo depois da curva de cima)
  const Z3 = -13.75 - 2 * R; // linha da reta oeste de cima
  const ZN = Z3 + R; // onde a curva de cima começa (rumo norte)
  const XN = XA + R; // x da reta norte depois do loop
  const OX = XN - 3.86, OZ = -3.25; // entrada do loop
  const CX1 = OX - 1.5, W1 = 6; // corredor de subida: 6 m, com a área de manobra da tacada em diagonal do loop
  const L2 = 15; // reta norte depois do loop
  const Z0 = OZ + 15; // largada

  // 1) reta norte com dois pêndulos da fase 6 (os vãos dos lados são fechados com blocos)
  P = [CX1, Z0]; PHI = 0; CH = TOP;
  straight(Z0 - OZ, { W: W1 });
  {
    const cap = (z, x0, x1) => L.box(x0, TOP - 0.125, z, x1, TOP + WALL_H, z + WALL_T, 'wall-top', 'wall-side');
    cap(Z0, CX1 - W1 / 2 - WALL_T, CX1 + W1 / 2 + WALL_T); // muro atrás da largada
    cap(OZ - WALL_T, CX1 - W1 / 2 - WALL_T, OX - 1.6); // muro ao norte, com a boca da pista do loop aberta
    for (const [tz, src] of [[9, -12.675], [5, -6.675]]) {
      const dx = CX1 - 7.75, dz = tz - src, dy = TOP - OGF;
      const bb = copySolid(og6, (v, nm) => v[0] > 5 && v[0] < 10.6 && Math.min(v[2], v[5], v[8]) >= src - 0.15 && Math.max(v[2], v[5], v[8]) <= src + 0.75 && (nm === 'default' || Math.max(v[1], v[4], v[7]) > 0.1), dx, dy, dz);
      copyMover(og6.moving.find((m) => Math.abs(m.base.p[2] - src) < 0.05), og6, dx, dy, dz);
      block(CX1 - W1 / 2, bb.x0 + 0.02, bb.z0, bb.z1, TOP); // fecha o vão da esquerda
      block(bb.x1 - 0.02, CX1 + W1 / 2, bb.z0, bb.z1, TOP); // e o da direita
    }
  }
  // 2) o loop da fase 9 (a bola entra na diagonal, sobe a espiral e sai 3,9 m ao lado)
  L.loop(OX, TOP, OZ, 0, false);
  // 3) reta norte depois do loop: lombadas da fase 4 e um giratório da fase 1 (com os lados fechados)
  P = [XN, OZ - 3]; PHI = 0;
  {
    const st = straight(L2, { gaps: [[8.5, 13.5]] });
    const cap = (x0, x1) => L.box(x0, TOP - 0.125, OZ - 3, x1, TOP + WALL_H, OZ - 3 + WALL_T, 'wall-top', 'wall-side');
    cap(XN - W / 2 - WALL_T, XN - 1.15);
    cap(XN + 1.15, XN + W / 2 + WALL_T);
    // lombadas: seis cristas seguidas, de lado a lado
    const dz0 = (OZ - 3 - 1.2) - -9.0; // a primeira crista (z = -9) cai 1,2 m depois do começo
    copySolid(og4, (v, nm) => nm === 'bump_face', XN + 0.5, TOP - OGF, dz0);
    // giratório (plataforma de 5x5 e as pás); blocos finos nas laterais para as pás não deixarem ninguém passar rente ao muro
    const zc = OZ - 3 - 11; // centro da plataforma
    copySolid(og1, (v, nm) => nm === 'ground_spinner_platform' && v[0] > 11 && v[0] < 17.5 && v[2] > -23.5 && v[2] < -18, XN - 14.5, TOP - OGF, zc + 20.7);
    copyMover(og1.moving[0], og1, XN - 14.5, TOP - OGF, zc + 20.7);
    block(XN - W / 2, XN - W / 2 + 0.35, zc - 2.5, zc + 2.5, TOP);
    block(XN + W / 2 - 0.35, XN + W / 2, zc - 2.5, zc + 2.5, TOP);
    void st;
  }
  // 4) curva à esquerda (norte -> oeste)
  arc(1, R);
  // 5) reta oeste: rio da fase 7, descida de 3 m e as quatro paredes deslizantes da fase 18
  {
    const x0 = P[0], z0 = P[1], hTop = CH;
    const st = straight(L3, { gaps: [[14, 22]], ramps: [{ s0: 6.5, len: 7, dh: -3 }] });
    // rio: a água da fase 7 girada para atravessar o corredor; a corrente (5x) empurra a bola para o muro do norte
    {
      const xr = x0 - 3.5, zr = z0; // centro do rio
      const t = og7.solid.t, f = og7.solid.f;
      for (let i = 0; i < f.length; i++) {
        if (!(f[i] & 2)) continue;
        const v = t.slice(i * 9, i * 9 + 9);
        for (let k = 0; k < 9; k += 3) {
          const u = v[k + 2] + 9.25, w = v[k] + 0.5; // u: ao longo do corredor (2 m), w: de lado a lado (5 m)
          L.solid.t.push(r4(xr + u), r4(hTop + 0.001), r4(zr - w));
        }
        L.solid.m.push(mid('default', og7));
        L.solid.f.push(2);
        const dd = og7.waterDirs[0];
        (L.waterDirs ??= []).push([dd[2], 0, -dd[0]]);
      }
    }
    const hSl = hTop - 3;
    const xc = x0 - 18; // meio do bloco de plataformas deslizantes (s = 14 a 22)
    for (const mv of og18.moving) copyMover(mv, og18, xc - 4.5, hSl - OGF, z0);
    copySolid(og18, (v, nm) => nm === 'ground_mover_platform', xc - 4.5, hSl - OGF, z0);
    void st;
  }
  // 6) duas curvas seguidas (oeste -> sul -> oeste)
  arc(1, R);
  arc(-1, R);
  // 7) reta final até o deque da fase 5: colina de 1,5 m com um giratório no alto
  {
    const x0 = P[0], z0 = P[1], h0 = CH;
    straight(LF, { gaps: [[7.5, 12.5]], ramps: [{ s0: 1.5, len: 5, dh: 1.5 }, { s0: 13, len: 5, dh: -1.5 }] });
    const xc = x0 - 10;
    copySolid(og1, (v, nm) => nm === 'ground_spinner_platform' && v[0] > 11 && v[0] < 17.5 && v[2] > -23.5 && v[2] < -18, xc - 14.5, h0 + 1.5 - OGF, z0 + 20.7);
    copyMover(og1.moving[0], og1, xc - 14.5, h0 + 1.5 - OGF, z0 + 20.7);
    block(xc - 2.5, xc + 2.5, z0 - W / 2, z0 - W / 2 + 0.35, h0 + 1.5);
    block(xc - 2.5, xc + 2.5, z0 + W / 2 - 0.35, z0 + W / 2, h0 + 1.5);
  }

  // a fase pronta = fase 5 (sem a tampa) + o circuito novo
  const out = base;
  for (let i = 0; i < L.solid.m.length; i++) {
    out.solid.t.push(...L.solid.t.slice(i * 9, i * 9 + 9));
    out.solid.m.push(L.solid.m[i]);
    out.solid.f.push(L.solid.f[i]);
  }
  out.materials = mats;
  out.moving = [...(out.moving ?? []), ...L.moving];
  if (L.waterDirs) out.waterDirs = [...(out.waterDirs ?? []), ...L.waterDirs];
  out.ballStart = [CX1, TOP, Z0 - 1.2];
  out.cameraZones = [];
  out.begin = null;
  out.id = 250;
  return out;
}

fs.writeFileSync(new URL('./level-stats.json', import.meta.url), JSON.stringify(STATS, null, 1));
const grand = grandCircuit();
const holeModel = loadHole();
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'level-250.json'), JSON.stringify(grand));
console.log(`level-250: ${grand.solid.m.length} tris, ${grand.moving.length} móveis`);
for (const L of LEVELS) {
  fs.writeFileSync(path.join(out, `level-${L.id}.json`), JSON.stringify(L.json(holeModel)));
  console.log(`level-${L.id}: ${L.solid.m.length} tris, ${L.moving.length} móveis`);
}
