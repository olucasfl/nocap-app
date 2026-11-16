/**
 * Efeitos do Night Hunt, segunda leva (pixel art por código, mesma linguagem de fx-art.ts): golpes e projéteis das armas
 * do Slash com brilho e rastro, impacto de acerto e de morte, abertura de baú, evolução e subida de nível.
 */
import { dither, easeOut, hash, hex, lowres, smooth, type Rgb } from './fx-art';

const STEEL: Rgb[] = ['#ffffff', '#e4eefc', '#b8cbe6', '#8aa0c4', '#5f759e'].map(hex);
const ICE: Rgb[] = ['#ffffff', '#c8f6ff', '#7fe0ff', '#3a9bff', '#4a5de0'].map(hex);
const GOLDP: Rgb[] = ['#ffffff', '#fff3a8', '#ffd94a', '#e8a22a', '#a8661a'].map(hex);

/** Golpe de espada: crescente de luz que acompanha o giro, com núcleo branco, borda azul e faíscas no fim do arco. */
export function drawSwordSlash(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  k: number,
  evo = false,
  reach = 64,
): void {
  if (k < 0 || k >= 1) return;
  const cell = 2;
  const N = Math.ceil((reach * 2.4) / cell) | 1;
  const L = lowres('slash', N);
  const pal = evo ? GOLDP : ICE;
  const cx = (N - 1) / 2;
  const cy = (N - 1) / 2;
  const R = reach / cell;
  const sweep = easeOut(k / 0.5);
  const fade = 1 - smooth(0.45, 1, k);
  const a0 = angle - 1.2;
  const a1 = a0 + 2.4 * sweep;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = i - cx;
      const dy = j - cy;
      const dd = Math.hypot(dx, dy);
      if (dd > R || dd < R * 0.55) continue;
      let a = Math.atan2(dy, dx);
      while (a < a0 - 0.01) a += Math.PI * 2;
      if (a > a1) continue;
      const t = (a - a0) / 2.4; // 0 começo do arco, 1 ponta
      const w = (dd - R * 0.55) / (R * 0.45); // 0 interno, 1 externo
      // crescente: mais grosso no meio do arco; a ponta afina
      if (w > 1 - 0.55 * Math.pow(Math.abs(t - 0.45) / 0.55, 1.4) + 0.1) continue;
      if (!dither(i, j, fade * 1.3 - (1 - t) * 0.3)) continue;
      const idx = w > 0.8 ? 3 : w > 0.55 ? 2 : w > 0.3 ? 1 : 0;
      L.put(i, j, pal[Math.min(4, idx + (t < 0.2 ? 1 : 0))]!);
    }
  // faíscas na ponta do arco
  const tx = cx + Math.cos(a1) * R * 0.95;
  const ty = cy + Math.sin(a1) * R * 0.95;
  for (let s = 0; s < 6; s++) {
    const a = a1 + (hash(s * 7) - 0.5) * 1.6;
    const d = 2 + k * 8 * hash(s * 3 + 1);
    if (k < 0.8) L.put(tx + Math.cos(a) * d, ty + Math.sin(a) * d, pal[s % 2 ? 0 : 2]!);
  }
  L.flush(g, x, y, cell);
}

/** Adaga voadora: lâmina de aço com brilho correndo, cabo de couro, rastro de vento e cintilar. `angle` é a direção do voo. */
export function drawDagger(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  t: number,
  evo = false,
  scale = 1,
): void {
  const N = 40;
  const L = lowres('dagger', N);
  const pal = evo ? GOLDP : STEEL;
  const cx = N / 2;
  const cy = N / 2;
  const cs = Math.cos(-angle);
  const sn = Math.sin(-angle);
  // rastro de vento: três riscos paralelos que afinam para trás
  for (const off of [-3, 0, 3]) {
    const len = 14 - Math.abs(off) * 2;
    for (let s = 6; s < 6 + len; s++) {
      const px = cx - Math.cos(angle) * s - Math.sin(angle) * off;
      const py = cy - Math.sin(angle) * s + Math.cos(angle) * off;
      if (dither(s, off + 5, 1 - (s - 6) / len)) L.put(px, py, hex(evo ? '#ffe9a8' : '#cfe8ff'));
    }
  }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = i + 0.5 - cx;
      const dy = j + 0.5 - cy;
      const lx = dx * cs - dy * sn;
      const ly = dx * sn + dy * cs;
      // lâmina: losango alongado de -3 a +8; cabo: de -7 a -3
      const blade = lx > -3 && lx < 9 && Math.abs(ly) < 2.4 * (1 - Math.max(0, lx - 3) / 6.2);
      const guard = lx > -4 && lx < -2.2 && Math.abs(ly) < 3.6;
      const grip = lx > -8 && lx <= -4 && Math.abs(ly) < 1.3;
      if (blade) L.put(i, j, pal[ly < -0.4 ? 0 : ly < 0.6 ? 1 : 3]!);
      else if (guard) L.put(i, j, GOLDP[2]!);
      else if (grip) L.put(i, j, hex('#6a3a1a'));
    }
  // brilho correndo pela lâmina
  const gl = ((t * 5) % 1) * 11 - 2;
  L.put(cx + Math.cos(angle) * gl, cy + Math.sin(angle) * gl, hex('#ffffff'));
  L.flush(g, x, y, 2 * scale);
}

/** Machado em voo: lâmina larga girando com borrão de movimento (imagens-fantasma) e faísca no fio. */
export function drawAxeSpin(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  spin: number,
  t: number,
  evo = false,
  scale = 1,
): void {
  const N = 44;
  const L = lowres('axespin', N);
  const cx = N / 2;
  const cy = N / 2;
  const steel = evo ? GOLDP : STEEL;
  const axe = (rot: number, ghost: boolean, dens: number) => {
    const cs = Math.cos(-rot);
    const sn = Math.sin(-rot);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const dx = i + 0.5 - cx;
        const dy = j + 0.5 - cy;
        const lx = dx * cs - dy * sn;
        const ly = dx * sn + dy * cs;
        const haft = Math.abs(lx) < 1.2 && ly > -9 && ly < 10;
        const head = ly > -9 && ly < -1 && lx > -2 && lx < 3 + (ly + 9) * 0.9 && lx < 8;
        const head2 =
          ly > -9 && ly < 0 && lx >= 0 && lx < 4 + (ly + 9) * 0.7 && Math.hypot(lx - 6, ly + 5) < 7;
        if (!haft && !head && !head2) continue;
        if (ghost && !dither(i, j, dens)) continue;
        if (ghost) L.put(i, j, hex(evo ? '#ffe9a8' : '#cfe8ff'));
        else if (haft && !head && !head2) L.put(i, j, hex(ly < 0 ? '#8a5a2a' : '#6a4222'));
        else L.put(i, j, steel[lx > 5 ? 0 : lx > 3 ? 1 : lx > 1 ? 2 : 3]!);
      }
  };
  axe(spin - 1.2, true, 0.15);
  axe(spin - 0.6, true, 0.3);
  axe(spin, false, 1);
  const a = spin + Math.PI * 0.1;
  if (Math.floor(t * 14) % 3 === 0) {
    L.put(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, hex('#ffffff'));
    L.put(cx + Math.cos(a) * 10 + 1, cy + Math.sin(a) * 10, hex('#cfe8ff'));
  }
  L.flush(g, x, y, 2 * scale);
}

/** Orbe guardião: esfera com núcleo claro, anel de luz girando em volta e rastro em arco atrás da órbita. */
export function drawGuardOrb(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  orbitAngle: number,
  t: number,
  evo = false,
  scale = 1,
): void {
  const N = 48;
  const L = lowres('gorb', N);
  const pal = evo ? GOLDP : ICE;
  const cx = N / 2;
  const cy = N / 2;
  // rastro: arco curto atrás da posição, na direção oposta ao movimento (a órbita gira no sentido horário)
  for (let s = 1; s < 16; s++) {
    const a = orbitAngle - s * 0.075;
    const rr = 11;
    const px = cx + Math.cos(a) * rr - Math.cos(orbitAngle) * rr;
    const py = cy + Math.sin(a) * rr - Math.sin(orbitAngle) * rr;
    const w = Math.max(0.5, 3.8 - s * 0.24);
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++)
        if (Math.hypot(i, j) < w && (s < 6 || dither(i + s, j, 1 - s / 17)))
          L.put(px + i, py + j, pal[s < 4 ? 1 : s < 9 ? 2 : 3]!);
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 7);
  const R = 5.2 + pulse * 0.4;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
      if (dd < R)
        L.put(
          i,
          j,
          pal[
            Math.min(3, Math.floor((Math.hypot(i + 0.5 - cx + 1.2, j + 0.5 - cy + 1.2) / R) * 3))
          ]!,
        );
      else if (dd < R + 1.3) L.put(i, j, pal[3]!);
    }
  L.put(cx - 2, cy - 2, pal[0]!);
  for (let s = 0; s < 8; s++) {
    const a = t * 3 + (s / 8) * Math.PI * 2;
    if (s % 2) continue;
    L.put(cx + Math.cos(a) * (R + 3.4), cy + Math.sin(a) * (R + 3.4), pal[0]!);
  }
  L.flush(g, x, y, 2 * scale);
}

/** Faísca de acerto: clarão curto com raios finos e quatro fagulhas; `crit` deixa maior e amarelo. */
export function drawHitSpark(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  crit = false,
): void {
  if (k < 0 || k >= 1) return;
  const N = 24;
  const L = lowres('hit', N);
  const pal = crit ? GOLDP : STEEL;
  const cx = N / 2;
  const cy = N / 2;
  const grow = easeOut(k / 0.4);
  const fade = 1 - smooth(0.3, 1, k);
  const len = (crit ? 9 : 6) * grow;
  for (let s = 0; s < (crit ? 8 : 6); s++) {
    const a = (s / (crit ? 8 : 6)) * Math.PI * 2 + 0.4;
    for (let d = 1; d < len; d++)
      if (dither(s, d, fade * 1.2))
        L.put(cx + Math.cos(a) * d, cy + Math.sin(a) * d, pal[d < len * 0.5 ? 0 : 2]!);
  }
  if (k < 0.3)
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++)
        if (Math.hypot(i, j) < 2.4 * (1 - k / 0.3)) L.put(cx + i, cy + j, pal[0]!);
  L.flush(g, x, y, 2);
}

/** Morte de inimigo: nuvem de poeira que sobe, cacos que voam e caem, e uma alminha clara que sobe e some. */
export function drawDeathBurst(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  tone = '#8a6a9a',
  seed = 1,
): void {
  if (k < 0 || k >= 1) return;
  const N = 40;
  const L = lowres('death', N);
  const base = hex(tone);
  const dark: Rgb = [
    Math.max(0, base[0] - 60),
    Math.max(0, base[1] - 60),
    Math.max(0, base[2] - 60),
  ];
  const light: Rgb = [
    Math.min(255, base[0] + 70),
    Math.min(255, base[1] + 70),
    Math.min(255, base[2] + 70),
  ];
  const cx = N / 2;
  const cy = N / 2 + 3;
  // nuvem de poeira: discos que crescem e sobem, pontilhando para sumir
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2 + hash(seed + p);
    const px = cx + Math.cos(a) * 7 * easeOut(k / 0.5);
    const py = cy + Math.sin(a) * 4 * easeOut(k / 0.5) - k * 7;
    const r = 3 + k * 3;
    for (let j = -7; j <= 7; j++)
      for (let i = -7; i <= 7; i++) {
        const d = Math.hypot(i, j);
        if (d < r && dither(i + p, j, (1 - smooth(0.2, 1, k)) * 1.2 - (d / r) * 0.4))
          L.put(px + i, py + j, d > r * 0.6 ? dark : base);
      }
  }
  // cacos
  for (let s = 0; s < 8; s++) {
    const th = hash(seed * 3 + s) * Math.PI * 2;
    const sp = 6 + hash(seed * 5 + s) * 10;
    const t = easeOut(k / 0.7);
    const px = cx + Math.cos(th) * sp * t;
    const py = cy + Math.sin(th) * sp * t * 0.8 + 14 * k * k;
    if (k < 0.75) {
      L.put(px, py, s % 2 ? light : base);
      L.put(px + 1, py, dark);
    }
  }
  // alminha
  if (k > 0.2) {
    const t = (k - 0.2) / 0.8;
    const sx = cx + Math.sin(t * 9) * 1.4;
    const sy = cy - 3 - t * 16;
    if (dither(1, 1, 1 - t * 0.8)) {
      L.put(sx, sy, hex('#ffffff'));
      L.put(sx, sy + 1, light);
      L.put(sx - 1, sy + 1, light);
      L.put(sx + 1, sy + 1, light);
    }
  }
  L.flush(g, x, y, 2);
}

/** Baú abrindo: tampa que sobe, feixes de luz dourada para cima, brilhos subindo e um clarão no chão. `k` de 0 a 1. */
export function drawChestOpen(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  evo = false,
): void {
  if (k < 0 || k >= 1) return;
  const N = 64;
  const L = lowres('chest', N, 72);
  const cx = N / 2;
  const base = 52;
  const lidUp = easeOut(k / 0.3);
  const wood = ['#d9a05a', '#b8783a', '#8a5224', '#5a3416'].map(hex);
  const gold = GOLDP;
  const rect = (x0: number, y0: number, w: number, h: number, cols: Rgb[], bevel = true) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        L.put(
          x0 + i,
          y0 + j,
          cols[
            Math.min(
              cols.length - 1,
              bevel ? Math.floor(((j / h) * 0.6 + (i / w) * 0.4) * cols.length) : 0,
            )
          ]!,
        );
  };
  // luz saindo (feixes) antes da tampa abrir de vez
  const beam = smooth(0.1, 0.35, k) * (1 - smooth(0.7, 1, k));
  if (beam > 0) {
    for (let r = 0; r < 7; r++) {
      const a = -Math.PI / 2 + (r - 3) * 0.2 + Math.sin(k * 6 + r) * 0.04;
      const len = 40 * beam;
      for (let s = 4; s < len; s++)
        if (dither(r, s, 1 - s / (len + 4)))
          L.put(cx + Math.cos(a) * s, base - 8 + Math.sin(a) * s, gold[r % 2 ? 1 : 2]!);
    }
  }
  // corpo do baú
  rect(cx - 14, base - 10, 28, 12, wood);
  rect(cx - 14, base - 10, 28, 2, [wood[0]!]);
  rect(cx - 14, base - 4, 28, 2, [gold[3]!], false);
  rect(cx - 2, base - 6, 4, 6, gold);
  // tampa: gira para trás e sobe
  const lh = 8 - lidUp * 6;
  rect(cx - 14, base - 10 - lh - lidUp * 4, 28, Math.max(2, lh), wood);
  rect(cx - 14, base - 10 - lh - lidUp * 4, 28, 2, [gold[1]!], false);
  // interior iluminado
  if (lidUp > 0.3) rect(cx - 12, base - 12, 24, 2, [gold[0]!, gold[1]!], false);
  // brilhos subindo
  for (let s = 0; s < 12; s++) {
    const life = (k * 2.2 + hash(s * 9) * 2) % 1;
    if (k < 0.15) continue;
    const px = cx + (hash(s * 3) - 0.5) * 24;
    const py = base - 12 - life * 38;
    const c = life < 0.5 ? gold[0]! : gold[2]!;
    L.put(px, py, c);
    if (s % 3 === 0 && life < 0.7) {
      L.put(px - 1, py, gold[1]!);
      L.put(px + 1, py, gold[1]!);
      L.put(px, py - 1, gold[1]!);
    }
  }
  L.flush(g, x, y, 3, 0, -12);
  // clarão no chão
  g.save();
  g.globalAlpha = 0.35 * beam;
  g.fillStyle = evo ? '#fff3a8' : '#ffd94a';
  g.beginPath();
  g.ellipse(x, y + 22, 54 * beam, 14 * beam, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Evolução: anéis dourados que sobem, raios girando, centelhas que convergem para o ícone e estouram num clarão. */
export function drawEvolveBurst(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
): void {
  if (k < 0 || k >= 1) return;
  const N = 80;
  const L = lowres('evolve', N);
  const cx = N / 2;
  const cy = N / 2;
  const converge = smooth(0, 0.45, k);
  const burst = smooth(0.45, 0.62, k);
  const fade = 1 - smooth(0.7, 1, k);
  // raios girando
  for (let r = 0; r < 12; r++) {
    const a = (r / 12) * Math.PI * 2 + k * 4;
    const len = (10 + 26 * burst) * (0.6 + 0.4 * Math.sin(k * 10 + r));
    for (let s = 4; s < len; s++)
      if (dither(r, s, fade * (1 - s / (len + 6)) * 1.4))
        L.put(cx + Math.cos(a) * s, cy + Math.sin(a) * s, GOLDP[r % 2 ? 1 : 2]!);
  }
  // anéis
  for (const [ph, col] of [
    [0, 1],
    [0.18, 2],
    [0.36, 3],
  ] as const) {
    const t = Math.max(0, Math.min(1, (k - 0.3 - ph * 0.5) / 0.5));
    if (t <= 0 || t >= 1) continue;
    const rr = 6 + t * 30;
    for (let s = 0; s < 200; s++)
      if (dither(s, s >> 2, (1 - t) * 1.2))
        L.put(
          cx + Math.cos((s / 200) * 6.283) * rr,
          cy + Math.sin((s / 200) * 6.283) * rr,
          GOLDP[col]!,
        );
  }
  // centelhas convergindo
  for (let s = 0; s < 18; s++) {
    const a = hash(s * 7) * Math.PI * 2;
    const d0 = 30 + hash(s * 3) * 8;
    const d = d0 * (1 - converge);
    if (k < 0.5) L.put(cx + Math.cos(a) * d, cy + Math.sin(a) * d, GOLDP[s % 2 ? 0 : 1]!);
  }
  // clarão
  const flash = (1 - smooth(0.45, 0.75, k)) * burst;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(i - cx, j - cy);
      if (d < 16 * burst && dither(i, j, flash * 1.4 - d / 20)) L.put(i, j, GOLDP[0]!);
    }
  L.flush(g, x, y, 3);
}

/** Subir de nível: coluna de luz azul-branca subindo do jogador, anéis no chão e estrelinhas que sobem. */
export function drawLevelUp(g: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  if (k < 0 || k >= 1) return;
  const W = 48;
  const H = 72;
  const L = lowres('lvl', W, H);
  const cx = W / 2;
  const base = H - 10;
  const rise = easeOut(k / 0.35);
  const fade = 1 - smooth(0.55, 1, k);
  // coluna de luz
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const hgt = base - j;
      if (hgt < 0 || hgt > 58 * rise) continue;
      const half = 9 - hgt * 0.06;
      const d = Math.abs(i - cx);
      if (d > half) continue;
      const core = d < half * 0.35;
      if (dither(i, j, fade * (core ? 1.2 : 0.65) - hgt / 90))
        L.put(i, j, ICE[core ? 0 : d < half * 0.7 ? 1 : 2]!);
    }
  // anéis no chão
  for (let r = 0; r < 3; r++) {
    const t = Math.max(0, Math.min(1, (k - r * 0.12) / 0.5));
    if (t <= 0 || t >= 1) continue;
    const rr = 4 + t * 20;
    for (let s = 0; s < 160; s++)
      if (dither(s, r, (1 - t) * 1.3))
        L.put(
          cx + Math.cos((s / 160) * 6.283) * rr,
          base + Math.sin((s / 160) * 6.283) * rr * 0.35,
          ICE[r + 1]!,
        );
  }
  // estrelinhas subindo
  for (let s = 0; s < 14; s++) {
    const life = (k * 1.8 + hash(s * 11) * 2) % 1;
    const px = cx + (hash(s * 5) - 0.5) * 22;
    const py = base - life * 62;
    if (k > 0.1 && k < 0.9) {
      L.put(px, py, ICE[0]!);
      if (s % 3 === 0) {
        L.put(px - 1, py, ICE[2]!);
        L.put(px + 1, py, ICE[2]!);
        L.put(px, py - 1, ICE[2]!);
        L.put(px, py + 1, ICE[2]!);
      }
    }
  }
  L.flush(g, x, y, 3, 0, -3 * 28);
}
