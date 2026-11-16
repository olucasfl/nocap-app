/**
 * Efeitos do Night Hunt desenhados por código no estilo pixel art (paleta curta, bordas duras, pontilhado nas transições):
 * a explosão da Bomba de Cereja e o projétil da Varinha Arcana. Cada efeito é desenhado numa grade pequena e depois
 * ampliado sem suavização, para combinar com os sprites do jogo.
 */

export type Rgb = [number, number, number];

export const hex = (c: string): Rgb => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

/** Aleatório determinístico (a mesma explosão sempre sai igual): 0 a 1. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** Matriz de pontilhado 4x4 (Bayer): decide qual pixel acende numa transição suave sem usar transparência. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const dither = (x: number, y: number, v: number) => v > (BAYER[y & 3]![x & 3]! + 0.5) / 16;

const FIRE: Rgb[] = ['#fffbe0', '#ffe27a', '#ffb02e', '#ff7a1a', '#d9461a', '#8a2a1a'].map(hex);
const SMOKE: Rgb[] = ['#6a6270', '#4a4252', '#2f2a38'].map(hex);

const cache = new Map<string, HTMLCanvasElement>();
function canvas(key: string, w: number, h: number): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c || c.width !== w || c.height !== h) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    cache.set(key, c);
  }
  return c;
}

/**
 * Explosão da Bomba de Cereja. `k` vai de 0 (estouro) a 1 (fim). Camadas: clarão branco, bola de fogo que vai esfriando
 * (branco, amarelo, laranja, vermelho), onda de choque em anel, fagulhas que voam com gravidade e fumaça escura que sobe.
 * `r` é o raio de dano em pixels da tela; `seed` deixa cada explosão com o seu formato.
 */
export function drawBlast(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  k: number,
  seed = 1,
): void {
  if (k < 0 || k >= 1) return;
  const N = 56; // grade de 56x56 células
  const cell = (r * 2.5) / N;
  const c = canvas('blast', N, N);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, N);
  const img = q.createImageData(N, N);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb, a = 255) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const o = (j * N + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = a;
  };
  const cx = N / 2;
  const cy = N / 2 + 2;
  const R = N * 0.4; // raio máximo do fogo, em células
  // contorno irregular da bola de fogo: soma de ondas com fases sorteadas pela semente
  const ph = [hash(seed) * 6.28, hash(seed + 1) * 6.28, hash(seed + 2) * 6.28];
  const wob = (a: number) =>
    1 +
    0.13 * Math.sin(a * 3 + ph[0]!) +
    0.09 * Math.sin(a * 5 + ph[1]!) +
    0.06 * Math.sin(a * 8 + ph[2]!);

  const grow = easeOut(k / 0.38); // a bola cresce rápido e depois segura
  const fade = smooth(0.55, 1, k); // e some no fim
  const fireR = R * (0.25 + 0.75 * grow) * (1 - 0.35 * fade);
  const cool = smooth(0.1, 0.85, k); // quanto já esfriou (0 = branco quente, 1 = brasa vermelha)

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const dx = i - cx;
      const dy = (j - cy) * 1.12; // um pouco achatado, visto de cima em perspectiva
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const edge = fireR * wob(ang);
      // fumaça: borda externa escura que sobe com o tempo
      const smokeEdge = R * (0.55 + 0.6 * easeOut(k / 0.9)) * wob(ang + 1.3);
      const smokeUp = (j - cy + k * 7) * 1.0;
      const sd = Math.hypot(dx, smokeUp * 1.1);
      if (k > 0.22 && sd < smokeEdge && sd > edge * 0.7) {
        const dens =
          (1 - smooth(smokeEdge * 0.55, smokeEdge, sd)) *
          smooth(0.22, 0.45, k) *
          (1 - smooth(0.78, 1, k));
        if (dither(i, j, dens * 1.35)) {
          const idx = sd > smokeEdge * 0.8 ? 2 : sd > smokeEdge * 0.55 ? 1 : 0;
          put(i, j, SMOKE[idx]!);
        }
      }
      if (dist < edge) {
        const rho = dist / edge; // 0 centro, 1 borda
        // o núcleo quente encolhe com o tempo; o tom é o raio relativo mais o quanto esfriou
        const heat = 1 - rho * 1.05 - cool * 0.7 + 0.3;
        let idx =
          heat > 0.85 ? 0 : heat > 0.6 ? 1 : heat > 0.38 ? 2 : heat > 0.18 ? 3 : heat > 0 ? 4 : 5;
        // pontilhado entre faixas vizinhas, para a transição não ficar em degraus chapados
        const frac = (heat * 4) % 1;
        if (idx < 5 && dither(i, j, frac) && idx > 0) idx -= 1;
        // borda esfarelando no fim
        if (k > 0.55 && rho > 0.7 && !dither(i, j, 1 - fade * 1.1)) continue;
        put(i, j, FIRE[idx]!);
      }
    }
  }

  // clarão branco no estouro (primeiros ~12% do tempo): disco branco que some
  const flash = 1 - smooth(0, 0.14, k);
  if (flash > 0) {
    const fr = R * 0.9 * (0.4 + 0.6 * easeOut(k / 0.1));
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const dist = Math.hypot(i - cx, (j - cy) * 1.1);
        if (dist < fr && dither(i, j, flash * 1.3 - (dist / fr) * 0.4)) put(i, j, FIRE[0]!);
      }
  }

  // onda de choque: anel de 1 célula que se abre além do fogo
  const ring = easeOut(k / 0.45);
  if (k < 0.5) {
    const rr = R * (0.3 + 1.0 * ring);
    const a = 1 - smooth(0.2, 0.5, k);
    for (let s = 0; s < 220; s++) {
      const th = (s / 220) * Math.PI * 2;
      if (!dither(s, s >> 2, a)) continue;
      put(
        Math.round(cx + Math.cos(th) * rr),
        Math.round(cy + Math.sin(th) * rr * 0.89),
        k < 0.2 ? FIRE[0]! : FIRE[1]!,
      );
    }
  }

  // fagulhas: pontos brilhantes lançados para fora, caem e apagam
  const sparks = 18;
  for (let s = 0; s < sparks; s++) {
    const th = hash(seed * 7 + s) * Math.PI * 2;
    const sp = 14 + hash(seed * 13 + s) * 20;
    const life = 0.55 + hash(seed * 17 + s) * 0.4;
    if (k > life) continue;
    const t = k * 1.0;
    const px = cx + Math.cos(th) * sp * easeOut(t / life) * 1.05;
    const py = cy + Math.sin(th) * sp * easeOut(t / life) * 0.9 + 26 * t * t;
    const col = k > life * 0.65 ? FIRE[3]! : FIRE[1]!;
    put(Math.round(px), Math.round(py), col);
    if (k < life * 0.5)
      put(Math.round(px - Math.cos(th)), Math.round(py - Math.sin(th) * 0.9), FIRE[2]!);
  }
  q.putImageData(img, 0, 0);

  g.save();
  g.imageSmoothingEnabled = false;
  // marca de queimado no chão (elipse escura que some devagar)
  const scorch = 0.32 * smooth(0.05, 0.2, k) * (1 - smooth(0.5, 1, k));
  if (scorch > 0) {
    g.globalAlpha = scorch;
    g.fillStyle = '#1b1218';
    g.beginPath();
    g.ellipse(x, y + 4, r * 0.62, r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.drawImage(c, 0, 0, N, N, x - (N * cell) / 2, y - (N * cell) / 2 - cell * 2, N * cell, N * cell);
  g.restore();
}

// ------------------------------------------------------------------ projétil da Varinha Arcana
const ARCANE: Rgb[] = ['#ffffff', '#c8fbff', '#6fe6ff', '#3a9bff', '#5a4de0', '#2a1f8a'].map(hex);
const HOLY: Rgb[] = ['#ffffff', '#fff6c0', '#ffe27a', '#ffb02e', '#e07a1a', '#8a3a1a'].map(hex);

/**
 * Projétil mágico da Varinha: núcleo branco com estrela de quatro pontas piscando, halo em camadas (ciano, azul, roxo),
 * cauda de cometa que afina e faíscas que cintilam em volta. `angle` é a direção em que ele voa (radianos) e `t` o
 * tempo (s), para a animação. `big` troca a paleta para a dourada da Santa Varinha.
 */
export function drawMagicBolt(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  t: number,
  big = false,
  scale = 1,
): void {
  const pal = big ? HOLY : ARCANE;
  const N = 48;
  const c = canvas('bolt', N, N);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, N);
  const img = q.createImageData(N, N);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb, a = 255) => {
    i = Math.round(i);
    j = Math.round(j);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const o = (j * N + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = a;
  };
  const cx = N / 2;
  const cy = N / 2;
  const dirx = Math.cos(angle);
  const diry = Math.sin(angle);
  const pulse = 0.5 + 0.5 * Math.sin(t * 22);
  const tw = Math.floor(t * 14);

  // cauda de cometa: faixa larga que afina para trás, ondulando de leve, com faixa interna clara e brasas soltas
  for (let sIdx = 3; sIdx < 23; sIdx++) {
    const wob = Math.sin(t * 16 - sIdx * 0.8) * (0.4 + sIdx * 0.07);
    const px = cx - dirx * sIdx - diry * wob;
    const py = cy - diry * sIdx + dirx * wob;
    const w = Math.max(0.5, 5.4 - sIdx * 0.2);
    const col =
      sIdx < 6
        ? pal[1]!
        : sIdx < 10
          ? pal[2]!
          : sIdx < 15
            ? pal[3]!
            : sIdx < 19
              ? pal[4]!
              : pal[5]!;
    for (let j = -5; j <= 5; j++)
      for (let i = -5; i <= 5; i++) {
        const dd = Math.hypot(i, j);
        if (dd > w) continue;
        // as bordas da cauda são pontilhadas e ela vai se desfazendo para trás
        if (dd > w * 0.6 && !dither(i + sIdx, j + sIdx * 3, 1 - sIdx / 24)) continue;
        put(px + i, py + j, dd < w * 0.35 && sIdx < 14 ? pal[0]! : col);
      }
  }
  for (let e = 0; e < 6; e++) {
    const life = (t * 3 + hash(e * 5) * 4) % 1;
    const back = 6 + life * 16;
    const side = (hash(e * 9) - 0.5) * 8 * (0.3 + life);
    put(
      cx - dirx * back - diry * side,
      cy - diry * back + dirx * side,
      life < 0.5 ? pal[1]! : pal[3]!,
    );
  }
  // halo em camadas, pontilhado nas bordas
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(i - cx, j - cy);
      const R1 = 3.0 + pulse * 0.6;
      if (dd < R1) put(i, j, dd < 2.1 ? pal[0]! : pal[1]!);
      else if (dd < R1 + 1.8) put(i, j, pal[2]!);
      else if (dd < R1 + 3.4 && dither(i, j, 0.7)) put(i, j, pal[3]!);
      else if (dd < R1 + 5 && dither(i, j, 0.25)) put(i, j, pal[4]!);
    }
  // estrela de quatro pontas no núcleo
  const len = 5 + pulse * 2;
  for (let s = -len; s <= len; s++) {
    const k = 1 - Math.abs(s) / len;
    if (k > 0.15) {
      put(cx + s, cy, k > 0.5 ? pal[0]! : pal[1]!);
      put(cx, cy + s, k > 0.5 ? pal[0]! : pal[1]!);
    }
  }
  // faíscas em volta, cada uma acende numa fase diferente
  for (let s = 0; s < 7; s++) {
    const ph = hash(s * 31) * 6.28;
    const orbit = 7 + hash(s * 11) * 6;
    const a = ph + t * (1.4 + hash(s) * 1.6);
    const on = (tw + s * 3) % 5 < 2;
    if (!on) continue;
    const sx = cx + Math.cos(a) * orbit - dirx * (hash(s * 5) * 4);
    const sy = cy + Math.sin(a) * orbit - diry * (hash(s * 5) * 4);
    put(sx, sy, pal[0]!);
    if ((tw + s) % 4 === 0) {
      put(sx + 1, sy, pal[2]!);
      put(sx - 1, sy, pal[2]!);
      put(sx, sy + 1, pal[2]!);
      put(sx, sy - 1, pal[2]!);
    }
  }
  q.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = false;
  const sc = 2 * scale;
  g.drawImage(c, 0, 0, N, N, x - (N * sc) / 2, y - (N * sc) / 2, N * sc, N * sc);
  g.restore();
}

// ------------------------------------------------------------------ Raio Lunar
const BOLT_LUN: Rgb[] = ['#ffffff', '#dff4ff', '#9fd8ff', '#5fa8ff', '#4a5de0', '#2a2a8a'].map(hex);

/**
 * Raio Lunar caindo do céu. `k` de 0 a 1: (0 a 0,22) a lua marca o chão com um círculo que se fecha e faíscas sobem;
 * (0,22 a 0,4) o raio cai em zigue-zague com ramificações e o clarão toma a tela do ponto; (0,4 a 1) estouro no chão com
 * anel de choque, rachaduras, arcos elétricos e brasas azuis que apagam.
 */
export function drawLunarStrike(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  seed = 1,
): void {
  if (k < 0 || k >= 1) return;
  const W = 64;
  const H = 80;
  const cell = 3;
  const c = canvas('lunar', W, H);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, W, H);
  const img = q.createImageData(W, H);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb, a = 255) => {
    i = Math.round(i);
    j = Math.round(j);
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    const o = (j * W + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = a;
  };
  const cx = W / 2;
  const gy = H - 14; // linha do chão
  const line = (x0: number, y0: number, x1: number, y1: number, col: Rgb, th = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s++) {
      const px = x0 + ((x1 - x0) * s) / n;
      const py = y0 + ((y1 - y0) * s) / n;
      for (let a = 0; a < th; a++)
        for (let b = 0; b < th; b++) put(px + a - (th >> 1), py + b - (th >> 1), col);
    }
  };

  // 1) marca da lua no chão: elipse tracejada que fecha, com cruz de luz
  if (k < 0.45) {
    const closing = k < 0.22 ? 1 - easeOut(k / 0.22) * 0.55 : 0.45;
    const rr = 15 * (0.7 + closing * 0.5);
    const a = k < 0.22 ? 1 : 1 - smooth(0.22, 0.45, k);
    for (let s = 0; s < 96; s++) {
      const th = (s / 96) * Math.PI * 2 + k * 6;
      if (s % 3 === 2 || !dither(s, s >> 1, a)) continue;
      put(
        cx + Math.cos(th) * rr,
        gy + Math.sin(th) * rr * 0.42,
        k < 0.22 ? BOLT_LUN[2]! : BOLT_LUN[1]!,
      );
    }
    // faíscas subindo da marca
    for (let s = 0; s < 8; s++) {
      const life = (k * 4 + hash(seed * 3 + s) * 3) % 1;
      const th = hash(seed * 5 + s) * Math.PI * 2;
      if (k > 0.3) continue;
      put(
        cx + Math.cos(th) * rr * 0.8,
        gy - life * 14 + Math.sin(th) * 2,
        life < 0.5 ? BOLT_LUN[1]! : BOLT_LUN[3]!,
      );
    }
  }

  // 2) o raio: zigue-zague do alto até o chão, com núcleo branco, brilho azul e galhos
  if (k > 0.2 && k < 0.62) {
    const kk = (k - 0.2) / 0.42;
    const grow = Math.min(1, kk * 5); // desce quase instantaneamente
    const fade = 1 - smooth(0.15, 1, kk);
    const pts: Array<[number, number]> = [];
    const segs = 9;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const jx =
        s === 0 || s === segs
          ? 0
          : (hash(seed * 11 + s + Math.floor(k * 14)) - 0.5) * 11 * (1 - t * 0.35);
      pts.push([cx + jx, 0 + (gy - 0) * t]);
    }
    const last = Math.max(1, Math.floor(grow * segs));
    for (let s = 0; s < last; s++) {
      const [x0, y0] = pts[s]!;
      const [x1, y1] = pts[s + 1]!;
      const wide = fade > 0.5 ? 6 : 4;
      line(x0, y0, x1, y1, BOLT_LUN[4]!, wide);
      line(x0, y0, x1, y1, BOLT_LUN[2]!, wide - 2);
      line(x0, y0, x1, y1, BOLT_LUN[0]!, 1);
      // galho curto saindo de alguns nós
      if (s % 3 === 1) {
        const dir = hash(seed + s) > 0.5 ? 1 : -1;
        line(x1, y1, x1 + dir * 7, y1 + 6, BOLT_LUN[3]!, 1);
        put(x1 + dir * 7, y1 + 6, BOLT_LUN[0]!);
      }
    }
  }

  // 3) impacto: clarão, anel, rachaduras, arcos e brasas
  if (k >= 0.38) {
    const ik = (k - 0.38) / 0.62;
    const flash = 1 - smooth(0, 0.22, ik);
    if (flash > 0) {
      const fr = 11 * (0.5 + easeOut(ik / 0.2) * 0.9);
      for (let j = -14; j <= 14; j++)
        for (let i = -16; i <= 16; i++) {
          const dd = Math.hypot(i, j * 2.2);
          if (dd < fr && dither(i, j, flash * 1.3 - (dd / fr) * 0.5))
            put(cx + i, gy + j, BOLT_LUN[0]!);
        }
    }
    // anel de choque achatado
    const rr = 4 + easeOut(ik / 0.7) * 22;
    const ra = 1 - smooth(0.25, 0.85, ik);
    for (let s = 0; s < 160; s++) {
      if (!dither(s, s >> 2, ra)) continue;
      const th = (s / 160) * Math.PI * 2;
      put(
        cx + Math.cos(th) * rr,
        gy + Math.sin(th) * rr * 0.42,
        ik < 0.3 ? BOLT_LUN[0]! : BOLT_LUN[2]!,
      );
    }
    // rachaduras e arcos elétricos no chão, irradiando
    for (let s = 0; s < 7; s++) {
      const th = (s / 7) * Math.PI * 2 + hash(seed + s) * 0.6;
      const len = (6 + hash(seed * 2 + s) * 10) * easeOut(ik / 0.35);
      let px = cx;
      let py = gy;
      for (let st = 0; st < len; st++) {
        px += Math.cos(th) + (hash(seed * 9 + s * 13 + st + Math.floor(k * 16)) - 0.5) * 1.4;
        py += (Math.sin(th) + (hash(seed * 7 + s * 5 + st) - 0.5) * 0.9) * 0.45;
        put(px, py, ik < 0.55 ? BOLT_LUN[1]! : BOLT_LUN[4]!);
      }
    }
    // brasas azuis para cima, com gravidade
    for (let s = 0; s < 16; s++) {
      const th = -Math.PI / 2 + (hash(seed * 4 + s) - 0.5) * 2.4;
      const sp = 10 + hash(seed * 6 + s) * 16;
      const life = 0.5 + hash(seed * 8 + s) * 0.5;
      if (ik > life) continue;
      const t = ik / life;
      put(
        cx + Math.cos(th) * sp * t,
        gy + Math.sin(th) * sp * t + 20 * t * t,
        t < 0.5 ? BOLT_LUN[0]! : BOLT_LUN[3]!,
      );
    }
  }
  q.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = false;
  // sombra azulada no chão durante o clarão
  if (k > 0.38 && k < 0.8) {
    g.globalAlpha = 0.28 * (1 - smooth(0.38, 0.8, k));
    g.fillStyle = '#8fb4ff';
    g.beginPath();
    g.ellipse(x, y, 40, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.drawImage(c, 0, 0, W, H, x - (W * cell) / 2, y - gy * cell, W * cell, H * cell);
  g.restore();
}

// ------------------------------------------------------------------ Aura de Alho
const GARLIC_PAL: Rgb[] = ['#f2ffe8', '#c9f5b4', '#8fdc78', '#4fb85a', '#2f7d3f', '#1c4a2a'].map(
  hex,
);
const GARLIC_EVO: Rgb[] = ['#fbeeff', '#e6c4ff', '#c58cf0', '#9a56d6', '#6a2fa0', '#3f1a66'].map(
  hex,
);

const BULB = [
  '..g.g..',
  '...g...',
  '..ccc..',
  '.cwcccs',
  'ccwccss',
  'cccccss',
  '.cccss.',
  '..sss..',
];

/**
 * Aura de Alho no chão: leque pontilhado que fica mais denso na borda, ondas que se expandem do jogador, anel de runas
 * tracejado girando, dentes de alho orbitando e esporos que sobem. `r` é o raio (px da tela), `t` o tempo (s) e `evo`
 * a versão roxa (Devorador de Almas), que ganha lamentos fantasmas em vez de esporos.
 */
export function drawGarlicAura(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
  evo = false,
): void {
  const pal = evo ? GARLIC_EVO : GARLIC_PAL;
  const cell = 3;
  const N = Math.ceil((r * 2.3) / cell) | 1;
  const c = canvas('garlic', N, N);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, N);
  const img = q.createImageData(N, N);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb, a = 255) => {
    i = Math.round(i);
    j = Math.round(j);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const o = (j * N + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = a;
  };
  const cx = (N - 1) / 2;
  const cy = (N - 1) / 2;
  const R = (r / cell) * 0.98;
  const squash = 0.8;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);

  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = i - cx;
      const dy = (j - cy) / squash;
      const dd = Math.hypot(dx, dy) / R;
      if (dd > 1.0) continue;
      // enchimento pontilhado: bem fraco no centro, mais denso perto da borda
      const dens = 0.06 + 0.3 * smooth(0.45, 1, dd) + 0.05 * pulse;
      if (dither(i, j, dens)) put(i, j, dd > 0.85 ? pal[2]! : pal[3]!, 215);
    }
  // ondas que saem do jogador e somem na borda
  for (let w = 0; w < 2; w++) {
    const ph = (t * 0.55 + w * 0.5) % 1;
    const rr = R * (0.15 + ph * 0.85);
    const a = 1 - smooth(0.5, 1, ph);
    for (let s = 0; s < 360; s++) {
      if (!dither(s, s >> 2, a)) continue;
      const th = (s / 360) * Math.PI * 2;
      put(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * squash, pal[1]!);
    }
  }
  // anel externo: faixa de 2 células com borda recortada e brilho girando
  for (let s = 0; s < 720; s++) {
    const th = (s / 720) * Math.PI * 2;
    const scal = 1 + 0.018 * Math.sin(th * 12 + t * 2);
    const bright = 0.5 + 0.5 * Math.sin(th * 2 - t * 2.4);
    const col = bright > 0.8 ? pal[0]! : bright > 0.4 ? pal[1]! : pal[2]!;
    put(cx + Math.cos(th) * R * scal, cy + Math.sin(th) * R * scal * squash, col);
    put(cx + Math.cos(th) * (R * scal - 1), cy + Math.sin(th) * (R * scal - 1) * squash, pal[3]!);
  }
  // runas: traços tracejados girando num anel interno
  for (let s = 0; s < 24; s++) {
    const th = (s / 24) * Math.PI * 2 + t * 0.5;
    const rr = R * 0.9;
    if (s % 2) continue;
    for (let m = 0; m < 3; m++) {
      const a2 = th + m * 0.045;
      put(cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr * squash, pal[1]!);
    }
  }
  // dentes de alho orbitando
  const bulbs = 6;
  const sprites: Array<[number, number]> = [];
  for (let b = 0; b < bulbs; b++) {
    const th = (b / bulbs) * Math.PI * 2 + t * 0.7;
    const bob = Math.sin(t * 4 + b) * 0.8;
    sprites.push([cx + Math.cos(th) * R * 0.99, cy + Math.sin(th) * R * 0.99 * squash + bob]);
  }
  // esporos subindo (ou lamentos, na versão roxa)
  for (let s = 0; s < 22; s++) {
    const life = (t * 0.45 + hash(s * 7) * 3) % 1;
    const th = hash(s * 3) * Math.PI * 2;
    const rad = Math.sqrt(hash(s * 11)) * R * 0.88;
    const px = cx + Math.cos(th) * rad + Math.sin(t * 2 + s) * 1.2;
    const py = cy + Math.sin(th) * rad * squash - life * 10;
    const col = life < 0.3 ? pal[1]! : life < 0.7 ? pal[2]! : pal[3]!;
    if (!dither(s, s >> 1, 1 - life * 0.6)) continue;
    put(px, py, col);
    if (s % 5 === 0 && life < 0.6) {
      put(px + 1, py, pal[1]!);
      put(px - 1, py, pal[1]!);
      put(px, py - 1, pal[0]!);
    }
  }
  q.putImageData(img, 0, 0);
  // os dentes de alho entram por cima (sprite por mapa de pixels, com contorno escuro)
  const q2 = c.getContext('2d')!;
  for (const [bx, by] of sprites) {
    const ox = Math.round(bx) - 4;
    const oy = Math.round(by) - 5;
    // primeiro o contorno escuro (um pixel em volta de cada pixel do dente), depois as cores por cima
    q2.fillStyle = '#12182b';
    BULB.forEach((row, jj) =>
      [...row].forEach((ch, ii) => {
        if (ch === '.') return;
        q2.fillRect(ox + ii - 1, oy + jj, 3, 1);
        q2.fillRect(ox + ii, oy + jj - 1, 1, 3);
      }),
    );
    BULB.forEach((row, jj) =>
      [...row].forEach((ch, ii) => {
        if (ch === '.') return;
        q2.fillStyle =
          ch === 'g'
            ? evo
              ? '#d49cff'
              : '#6fd86a'
            : ch === 'w'
              ? '#ffffff'
              : ch === 's'
                ? evo
                  ? '#a97bd0'
                  : '#c8bfa0'
                : evo
                  ? '#f0dcff'
                  : '#f4f0dc';
        q2.fillRect(ox + ii, oy + jj, 1, 1);
      }),
    );
  }
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, N, N, x - (N * cell) / 2, y - (N * cell) / 2, N * cell, N * cell);
  g.restore();
}

// ------------------------------------------------------------------ Cruz
const CROSS_SILVER: Rgb[] = ['#ffffff', '#e4eefc', '#b8cbe6', '#8aa0c4', '#5f759e'].map(hex);
const CROSS_GOLD: Rgb[] = ['#fffbd0', '#ffe27a', '#ffc23a', '#e8962a', '#a8661a'].map(hex);

/**
 * Cruz sagrada em voo: gira (`spin`, radianos), com bisel de metal, pontas douradas, gema azul no centro, halo pontilhado,
 * imagens-fantasma atrás (rastro do giro) e brilhos que piscam. `big` é a versão evoluída (dourada, maior, com raios).
 */
export function drawCrossProj(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  spin: number,
  t: number,
  big = false,
  scale = 1,
  vx = 0,
  vy = 0,
): void {
  const N = 48;
  const c = canvas('cross', N, N);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, N);
  const img = q.createImageData(N, N);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb) => {
    i = Math.round(i);
    j = Math.round(j);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const o = (j * N + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = 255;
  };
  const pal = big ? CROSS_GOLD : CROSS_SILVER;
  const trim = big ? CROSS_SILVER : CROSS_GOLD;
  const cx = N / 2;
  const cy = N / 2;
  const S = big ? 1.25 : 1;
  const glow: Rgb[] = (big ? ['#ffe27a', '#ffc23a'] : ['#7fe0ff', '#3a9bff', '#5a4de0']).map(hex);

  // halo pontilhado, pulsando
  const pulse = 0.5 + 0.5 * Math.sin(t * 8);
  const hr = (11 + pulse * 1.5) * S;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(i - cx, j - cy);
      if (dd < hr + 2 && dd > hr - 5 && dither(i, j, 0.5 * (1 - (dd - (hr - 5)) / 7)))
        put(i, j, glow[dd > hr ? 1 : 0]!);
    }

  // a cruz desenhada célula a célula, rotacionada: dentro/fora, bisel e cor pela posição local
  const drawCross = (rot: number, dens: number, ghost: boolean) => {
    const cs = Math.cos(-rot);
    const sn = Math.sin(-rot);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const dx = i + 0.5 - cx;
        const dy = j + 0.5 - cy;
        const lx = (dx * cs - dy * sn) / S;
        const ly = (dx * sn + dy * cs) / S;
        const inV = Math.abs(lx) <= 2.6 && ly >= -10.5 && ly <= 10.5;
        const inH = Math.abs(ly + 3) <= 2.6 && Math.abs(lx) <= 7.5;
        if (!inV && !inH) continue;
        if (ghost && !dither(i, j, dens)) continue;
        // bisel: borda "de cima/esquerda" em coordenadas locais clara, "baixo/direita" escura
        const edgeX = inV ? (lx + 2.6) / 5.2 : 0.5;
        const edgeY = inH ? (ly + 3 + 2.6) / 5.2 : 0.5;
        const l =
          inV && inH
            ? 0.3 + edgeX * 0.3 + edgeY * 0.2
            : inV
              ? 0.1 + edgeX * 0.7
              : 0.1 + edgeY * 0.7;
        const tip = (inV && Math.abs(ly) > 8.6) || (inH && !inV && Math.abs(lx) > 5.6);
        const col = tip
          ? trim[Math.min(trim.length - 1, Math.floor((0.1 + l * 0.8) * trim.length))]!
          : pal[Math.min(pal.length - 1, Math.floor(l * pal.length))]!;
        put(i, j, ghost ? glow[1]! : col);
      }
  };
  // rastro do giro: duas imagens-fantasma em ângulos anteriores, bem pontilhadas
  drawCross(spin - 0.9, 0.22, true);
  drawCross(spin - 0.45, 0.4, true);
  drawCross(spin, 1, false);
  // gema azul no centro
  const gem = (big ? ['#fff6c0', '#ffd23a', '#e07a1a'] : ['#e8fbff', '#7fe0ff', '#3a9bff']).map(
    hex,
  );
  put(cx - 1, cy - 4, gem[0]!);
  put(cx, cy - 4, gem[1]!);
  put(cx - 1, cy - 3, gem[1]!);
  put(cx, cy - 3, gem[2]!);
  // brilhos que piscam nas pontas
  const ph = Math.floor(t * 12) % 4;
  const a = spin + (ph * Math.PI) / 2;
  const sp: Rgb = hex('#ffffff');
  put(cx + Math.cos(a) * 11 * S, cy + Math.sin(a) * 11 * S, sp);
  put(cx + Math.cos(a) * 11 * S + 1, cy + Math.sin(a) * 11 * S, glow[0]!);
  put(cx + Math.cos(a) * 11 * S - 1, cy + Math.sin(a) * 11 * S, glow[0]!);
  put(cx + Math.cos(a) * 11 * S, cy + Math.sin(a) * 11 * S + 1, glow[0]!);
  put(cx + Math.cos(a) * 11 * S, cy + Math.sin(a) * 11 * S - 1, glow[0]!);
  // faíscas soltas atrás da direção do voo
  for (let s = 0; s < 6; s++) {
    const life = (t * 3 + hash(s * 7) * 4) % 1;
    const sx = cx - vx * life * 14 + (hash(s * 3) - 0.5) * 10;
    const sy = cy - vy * life * 14 + (hash(s * 5) - 0.5) * 10;
    if (life < 0.8) put(sx, sy, life < 0.4 ? glow[0]! : glow[1]!);
  }
  q.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = false;
  const sc = 2 * scale;
  g.drawImage(c, 0, 0, N, N, x - (N * sc) / 2, y - (N * sc) / 2, N * sc, N * sc);
  g.restore();
}

// ------------------------------------------------------------------ Círculo de Brasas
/**
 * Bola de fogo do Círculo de Brasas: núcleo branco-amarelo, corpo laranja, borda vermelha e cauda de chama que fica para
 * trás da direção em que ela gira (`heading`), tremulando; faíscas e fumaça fina saem da cauda. `evo` = Anel Infernal (azul).
 */
export function drawEmberBall(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  t: number,
  r = 12,
  evo = false,
  seed = 0,
): void {
  const N = 40;
  const c = canvas('ember', N, N);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, N);
  const img = q.createImageData(N, N);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb) => {
    i = Math.round(i);
    j = Math.round(j);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const o = (j * N + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = 255;
  };
  const ramp: Rgb[] = (
    evo
      ? ['#ffffff', '#c8f0ff', '#6fc8ff', '#2f7fe0', '#1a3fa0', '#102a70']
      : ['#fffbe0', '#ffe27a', '#ffb02e', '#ff7a1a', '#d9461a', '#8a2a1a']
  ).map(hex);
  const cx = N / 2;
  const cy = N / 2;
  const dirx = Math.cos(heading);
  const diry = Math.sin(heading);
  const k = r / 12; // 12 = tamanho de referência
  const flick = Math.sin(t * 18 + seed) * 0.5 + 0.5;
  const body = 5.2 * k + flick * 0.5;

  // cauda de chama: segmentos para trás, afinando, com ondulação e cores esfriando
  for (let s = 1; s <= 15; s++) {
    const w = Math.max(0.4, body * (1 - s / 17));
    const wob = Math.sin(t * 15 - s * 0.7 + seed) * (0.4 + s * 0.09);
    const px = cx - dirx * s * 0.95 * k - diry * wob;
    const py = cy - diry * s * 0.95 * k + dirx * wob;
    const col = s < 4 ? ramp[2]! : s < 8 ? ramp[3]! : s < 12 ? ramp[4]! : ramp[5]!;
    for (let j = -6; j <= 6; j++)
      for (let i = -6; i <= 6; i++) {
        const dd = Math.hypot(i, j);
        if (dd > w) continue;
        if (dd > w * 0.55 && !dither(i + s, j + s * 2, 1 - s / 18)) continue;
        put(px + i, py + j, col);
      }
  }
  // corpo da bola: tons pela distância do centro deslocado para a luz
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
      if (dd > body) continue;
      const l = Math.hypot(i + 0.5 - cx + dirx * 0.9, j + 0.5 - cy + diry * 0.9) / (body * 0.95);
      put(i, j, ramp[Math.min(3, Math.floor(l * 4))]!);
    }
  // língua de fogo no alto, tremulando
  for (let s = 0; s < 3; s++) {
    const ux = cx + (s - 1) * 2 * k + Math.sin(t * 20 + s + seed) * 0.8;
    const uy = cy - body - s * 1.2 * k - flick * 1.4;
    put(ux, uy, ramp[s === 1 ? 1 : 2]!);
    put(ux, uy + 1, ramp[2]!);
  }
  // brilho de reflexo e faíscas
  put(cx - 1, cy - 2, ramp[0]!);
  put(cx, cy - 2, ramp[0]!);
  for (let s = 0; s < 7; s++) {
    const life = (t * 2.4 + hash(s * 9 + seed) * 5) % 1;
    const back = 4 + life * 13 * k;
    const side = (hash(s * 4 + seed) - 0.5) * 9 * (0.2 + life);
    const sx = cx - dirx * back - diry * side;
    const sy = cy - diry * back + dirx * side - life * 4;
    if (life < 0.85) put(sx, sy, life < 0.4 ? ramp[1]! : life < 0.7 ? ramp[3]! : ramp[4]!);
  }
  q.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = false;
  // brilho no chão embaixo da bola
  g.globalAlpha = 0.25;
  g.fillStyle = evo ? '#5ab4ff' : '#ff9a30';
  g.beginPath();
  g.ellipse(x, y + 10 * k, 15 * k, 6 * k, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  const sc = 2;
  g.drawImage(c, 0, 0, N, N, x - (N * sc) / 2, y - (N * sc) / 2, N * sc, N * sc);
  g.restore();
}

// ------------------------------------------------------------------ Osso
const BONE_PAL: Rgb[] = ['#ffffff', '#fffbe8', '#f0e6c4', '#d4c59a', '#a89868'].map(hex);
const BONE_EVO: Rgb[] = ['#ffffff', '#f2dcff', '#d9aaf5', '#a974d8', '#6a3fa0'].map(hex);

/**
 * Osso em voo: gira girando de ponta a ponta, com marfim sombreado, nós nas pontas, imagens-fantasma do giro, poeira de osso
 * caindo e faíscas. `hop` (0 a 1) acende o clarão de quando ele bate e quica; `evo` troca para a versão espectral roxa.
 */
export function drawBoneProj(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  spin: number,
  t: number,
  evo = false,
  hop = 0,
  scale = 1,
): void {
  const N = 40;
  const c = canvas('bone', N, N);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, N);
  const img = q.createImageData(N, N);
  const d = img.data;
  const put = (i: number, j: number, col: Rgb) => {
    i = Math.round(i);
    j = Math.round(j);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const o = (j * N + i) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = 255;
  };
  const pal = evo ? BONE_EVO : BONE_PAL;
  const cx = N / 2;
  const cy = N / 2;
  const glow = hex(evo ? '#c58cf0' : '#cfe8ff');
  const bone = (rot: number, ghost: boolean, dens: number) => {
    const cs = Math.cos(-rot);
    const sn = Math.sin(-rot);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const dx = i + 0.5 - cx;
        const dy = j + 0.5 - cy;
        const lx = dx * cs - dy * sn;
        const ly = dx * sn + dy * cs;
        // osso: haste horizontal e dois nós em cada ponta
        const shaft = Math.abs(lx) <= 7 && Math.abs(ly) <= 2.1;
        const kn = [-1, 1].some((sx) =>
          [-1, 1].some((sy) => Math.hypot(lx - sx * 8, ly - sy * 2.6) < 3.2),
        );
        if (!shaft && !kn) continue;
        if (ghost && !dither(i, j, dens)) continue;
        const l = Math.max(0, Math.min(0.99, 0.5 + (ly * 0.75 + lx * 0.25) / 8));
        put(i, j, ghost ? glow : pal[Math.floor(l * pal.length)]!);
      }
  };
  bone(spin - 1.0, true, 0.18);
  bone(spin - 0.5, true, 0.35);
  bone(spin, false, 1);
  // reflexo branco num nó
  put(cx + Math.cos(spin) * -8 - 1, cy + Math.sin(spin) * -8 - 1, pal[0]!);
  // poeira de osso caindo atrás
  for (let s = 0; s < 8; s++) {
    const life = (t * 2.6 + hash(s * 5) * 3) % 1;
    const px = cx + (hash(s * 3) - 0.5) * 14;
    const py = cy + (hash(s * 7) - 0.5) * 8 + life * 12;
    if (life < 0.8) put(px, py, life < 0.4 ? pal[1]! : pal[3]!);
  }
  // clarão da quicada: anel curto de fagulhas
  if (hop > 0) {
    const rr = 6 + hop * 10;
    for (let s = 0; s < 16; s++) {
      const th = (s / 16) * Math.PI * 2;
      if (s % 2) continue;
      put(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * 0.6, hop < 0.5 ? pal[0]! : glow);
    }
  }
  q.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = false;
  const sc = 2 * scale;
  g.drawImage(c, 0, 0, N, N, x - (N * sc) / 2, y - (N * sc) / 2, N * sc, N * sc);
  g.restore();
}

// ------------------------------------------------------------------ ferramenta comum aos efeitos novos
export interface Low {
  N: number;
  c: HTMLCanvasElement;
  put(i: number, j: number, col: Rgb): void;
  flush(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    ox?: number,
    oy?: number,
  ): void;
}
export function lowres(key: string, N: number, M = N): Low {
  const c = canvas(key, N, M);
  const q = c.getContext('2d')!;
  q.clearRect(0, 0, N, M);
  const img = q.createImageData(N, M);
  return {
    N,
    c,
    put(i, j, col) {
      i = Math.round(i);
      j = Math.round(j);
      if (i < 0 || j < 0 || i >= N || j >= M) return;
      const o = (j * N + i) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    },
    flush(g, x, y, scale, ox = 0, oy = 0) {
      q.putImageData(img, 0, 0);
      g.save();
      g.imageSmoothingEnabled = false;
      g.drawImage(
        c,
        0,
        0,
        N,
        M,
        x - (N * scale) / 2 + ox,
        y - (M * scale) / 2 + oy,
        N * scale,
        M * scale,
      );
      g.restore();
    },
  };
}

// ------------------------------------------------------------------ Poças de Magma
const LAVA: Rgb[] = ['#fff3a8', '#ffd23f', '#ff9a1a', '#e8561a', '#a8301a', '#4a1a14'].map(hex);
const LAVA_EVO: Rgb[] = ['#ffffff', '#ffe9a8', '#ffc23a', '#ff8a1a', '#d9461a', '#5a1a14'].map(hex);

/**
 * Poça de magma: abre como uma mancha de lava com a borda esfriando em crosta escura, bolhas que sobem e estouram com
 * fagulhas, rachaduras brilhantes e calor tremendo em volta. `age` (s) desde que abriu, `dur` a duração, `evo` = Lava Viva.
 */
export function drawMagmaPool(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  age: number,
  dur: number,
  evo = false,
  seed = 1,
): void {
  const cell = 3;
  const N = Math.ceil((r * 2.4) / cell) | 1;
  const L = lowres('magma', N);
  const pal = evo ? LAVA_EVO : LAVA;
  const open = easeOut(age / 0.35);
  const fade = 1 - smooth(dur - 0.8, dur, age);
  const R = (r / cell) * open * (0.96 + 0.04 * Math.sin(age * 5));
  const cx = (N - 1) / 2;
  const cy = (N - 1) / 2;
  const sq = 0.78;
  const ph = [hash(seed) * 6.28, hash(seed + 3) * 6.28];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = i - cx;
      const dy = (j - cy) / sq;
      const a = Math.atan2(dy, dx);
      const edge = R * (1 + 0.1 * Math.sin(a * 4 + ph[0]!) + 0.06 * Math.sin(a * 7 + ph[1]!));
      const dd = Math.hypot(dx, dy);
      if (dd > edge) continue;
      const rho = dd / edge;
      // desvanecer no fim: a borda some primeiro, pontilhada
      if (fade < 1 && rho > fade && !dither(i, j, 1 - (rho - fade) * 3)) continue;
      // tons: centro quente, borda esfriando em crosta
      let idx = rho < 0.28 ? 1 : rho < 0.5 ? 2 : rho < 0.72 ? 3 : rho < 0.86 ? 4 : 5;
      const wave = 0.5 + 0.5 * Math.sin(dd * 1.3 - age * 4 + a * 2);
      if (idx < 4 && dither(i, j, wave * 0.3)) idx -= 1;
      // placas de crosta escura que andam devagar sobre a lava, com frestas brilhantes entre elas
      const sx = i + age * 2.2;
      const sy = j - age * 1.4;
      // placas redondas de crosta nos pontos de uma grade de 7 células; entre elas fica a lava viva
      const gx = Math.round(sx / 7);
      const gy = Math.round(sy / 7);
      const pr = 1.4 + hash(gx * 31 + gy * 17 + seed) * 2.1;
      const pd = Math.hypot(
        sx - gx * 7 + (hash(gx + gy * 7) - 0.5) * 3,
        sy - gy * 7 + (hash(gy + gx * 5) - 0.5) * 3,
      );
      if (rho > 0.25 && pd < pr && hash(gx * 13 + gy * 29 + seed) > 0.35)
        idx = pd > pr - 0.9 ? 4 : 5;
      L.put(i, j, pal[Math.max(0, Math.min(5, idx))]!);
    }
  // rachaduras brilhantes irradiando
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * Math.PI * 2 + hash(seed + s) * 0.5;
    for (let st = 4; st < R * 0.8; st += 1) {
      const px = cx + Math.cos(a + Math.sin(st * 0.4 + s) * 0.12) * st;
      const py = cy + Math.sin(a + Math.sin(st * 0.4 + s) * 0.12) * st * sq;
      if ((st + s) % 3) L.put(px, py, pal[0]!);
    }
  }
  // bolhas: sobem do fundo, ficam maiores e estouram
  for (let b = 0; b < 8; b++) {
    const life = (age * 0.9 + hash(b * 7 + seed) * 3) % 1;
    const a = hash(b * 3 + seed) * Math.PI * 2;
    const rad = Math.sqrt(hash(b * 11 + seed)) * R * 0.75;
    const bx = cx + Math.cos(a) * rad;
    const by = cy + Math.sin(a) * rad * sq;
    if (life < 0.7) {
      const br = 1 + life * 2.4;
      for (let jj = -3; jj <= 3; jj++)
        for (let ii = -3; ii <= 3; ii++) {
          const d2 = Math.hypot(ii, jj);
          if (d2 < br && d2 > br - 1.2) L.put(bx + ii, by + jj, pal[1]!);
        }
      L.put(bx - 1, by - 1, pal[0]!);
    } else {
      // estouro: fagulhas para cima
      const t2 = (life - 0.7) / 0.3;
      for (let k = 0; k < 4; k++)
        L.put(bx + (k - 1.5) * 2 * t2, by - t2 * 6 + (k % 2), pal[t2 < 0.5 ? 0 : 2]!);
    }
  }
  // calor subindo na borda (tremor): pontinhos claros que sobem
  for (let s = 0; s < 10; s++) {
    const life = (age * 0.7 + hash(s * 13 + seed) * 4) % 1;
    const a = hash(s * 5 + seed) * Math.PI * 2;
    const px = cx + Math.cos(a) * R * 0.95;
    const py = cy + Math.sin(a) * R * 0.95 * sq - life * 9;
    if (life < 0.7 && fade > 0.3) L.put(px, py, pal[life < 0.4 ? 1 : 3]!);
  }
  L.flush(g, x, y, cell);
}

// ------------------------------------------------------------------ Rastreador de Runas
const RUNE_PAL: Rgb[] = ['#ffffff', '#c8f6ff', '#7fe0ff', '#3a9bff', '#4a5de0', '#2a2a8a'].map(hex);
const RUNE_EVO: Rgb[] = ['#ffffff', '#fff3b0', '#ffd23f', '#ff9a1a', '#d9461a', '#8a2a1a'].map(hex);
const GLYPHS = [
  ['.#.', '###', '.#.'],
  ['#.#', '.#.', '#.#'],
  ['##.', '.##', '#..'],
  ['#..', '###', '..#'],
];

/**
 * Esfera de runa: orbe luminoso com um anel de glifos girando em volta, pulso de luz e rastro de partículas; ao quicar na
 * borda ela solta um anel. `bounce` (0 a 1) é o clarão da quicada.
 */
export function drawRuneOrb(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  t: number,
  evo = false,
  bounce = 0,
  scale = 1,
): void {
  const N = 48;
  const L = lowres('rune', N);
  const pal = evo ? RUNE_EVO : RUNE_PAL;
  const cx = N / 2;
  const cy = N / 2;
  const len = Math.hypot(vx, vy) || 1;
  const dx = vx / len;
  const dy = vy / len;
  // rastro de luz: faixa que afina para trás, cintilando
  for (let s = 3; s < 20; s++) {
    const w = Math.max(0.5, 4.2 - s * 0.22);
    const px = cx - dx * s;
    const py = cy - dy * s;
    const col = s < 7 ? pal[2]! : s < 12 ? pal[3]! : pal[4]!;
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++)
        if (Math.hypot(i, j) <= w && (s < 8 || dither(i + s, j, 1 - s / 22)))
          L.put(px + i, py + j, col);
  }
  // orbe
  const pulse = 0.5 + 0.5 * Math.sin(t * 10);
  const R = 4.6 + pulse * 0.7;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
      if (dd < R) L.put(i, j, pal[Math.min(3, Math.floor((dd / R) * 3.2))]!);
      else if (dd < R + 1.6) L.put(i, j, pal[3]!);
      else if (dd < R + 3.4 && dither(i, j, 0.45)) L.put(i, j, pal[4]!);
    }
  L.put(cx - 1, cy - 2, pal[0]!);
  // glifos girando em órbita
  for (let k = 0; k < 4; k++) {
    const a = t * 2.2 + (k / 4) * Math.PI * 2;
    const gx = Math.round(cx + Math.cos(a) * 10) - 1;
    const gy = Math.round(cy + Math.sin(a) * 10) - 1;
    GLYPHS[k]!.forEach((row, jj) =>
      [...row].forEach((ch, ii) => {
        if (ch === '#') L.put(gx + ii, gy + jj, k % 2 ? pal[1]! : pal[0]!);
      }),
    );
  }
  // anel da quicada
  if (bounce > 0) {
    const rr = 6 + (1 - bounce) * 12;
    for (let s = 0; s < 40; s++)
      if (s % 2 === 0)
        L.put(
          cx + Math.cos((s / 40) * Math.PI * 2) * rr,
          cy + Math.sin((s / 40) * Math.PI * 2) * rr,
          bounce > 0.5 ? pal[0]! : pal[2]!,
        );
  }
  L.flush(g, x, y, 2 * scale);
}

// ------------------------------------------------------------------ Pentagrama
const PENT: Rgb[] = ['#ffffff', '#f2d8ff', '#c58cf0', '#9a56d6', '#6a2fa0', '#3f1a66'].map(hex);
const PENT_EVO: Rgb[] = ['#ffffff', '#fff3b0', '#ffd23f', '#ff9a1a', '#d9461a', '#8a2a1a'].map(hex);

/**
 * Pentagrama: o selo se desenha sob o jogador (círculos e estrela traçados aos poucos, com runas), brilha e solta uma onda
 * de luz que cruza a tela. `k` de 0 a 1 (1,2 s). Desenha direto na tela (traços de pixel de 3 px).
 */
export function drawPentagramBurst(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  R = 110,
  evo = false,
): void {
  if (k < 0 || k >= 1) return;
  const pal = evo ? PENT_EVO : PENT;
  const cell = 3;
  const N = Math.ceil((R * 2.6) / cell) | 1;
  const L = lowres('pent', N);
  const cx = (N - 1) / 2;
  const cy = (N - 1) / 2;
  const sq = 0.86;
  const r = R / cell;
  const draw = smooth(0, 0.35, k); // traçado do selo
  const fade = 1 - smooth(0.55, 1, k);
  const pulse = 0.5 + 0.5 * Math.sin(k * 30);
  const col = (i: number) => pal[Math.min(5, i)]!;
  // preenchimento escuro e pontilhado sob o selo
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(i - cx, (j - cy) / sq) / r;
      if (dd < 1 && dither(i, j, (0.25 + 0.1 * pulse) * fade * draw)) L.put(i, j, col(4));
    }
  // círculos
  const circle = (rr: number, c: Rgb, upTo: number) => {
    const n = 360;
    for (let s = 0; s < n * upTo; s++) {
      const a = -Math.PI / 2 + (s / n) * Math.PI * 2;
      L.put(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq, c);
    }
  };
  circle(r, col(2), draw);
  circle(r * 0.93, col(3), draw);
  // estrela de cinco pontas, traço a traço
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq]);
  }
  for (let e = 0; e < 5; e++) {
    const part = Math.max(0, Math.min(1, draw * 5 - e));
    const [x0, y0] = pts[e]!;
    const [x1, y1] = pts[(e + 2) % 5]!;
    const n = 80;
    for (let s = 0; s < n * part; s++) {
      const px = x0 + ((x1 - x0) * s) / n;
      const py = y0 + ((y1 - y0) * s) / n;
      L.put(px, py, col(2));
      L.put(px, py - 1, col(1));
    }
  }
  // runas girando entre o círculo e a ponta, brilho nas pontas
  if (draw > 0.9) {
    for (let s = 0; s < 10; s++) {
      const a = (s / 10) * Math.PI * 2 + k * 3;
      L.put(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97 * sq, col(s % 2 ? 0 : 1));
    }
    for (const [px, py] of pts) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        L.put(px + dx, py + dy, col(pulse > 0.5 ? 0 : 1));
    }
  }
  L.flush(g, x, y, cell);
  // onda de luz que cruza a tela
  if (k > 0.3) {
    const wk = (k - 0.3) / 0.7;
    const rr = wk * Math.max(g.canvas.width, g.canvas.height) * 0.9;
    g.save();
    g.globalAlpha = 0.65 * (1 - wk);
    g.lineWidth = 8 * (1 - wk) + 2;
    g.strokeStyle = evo ? '#fff0b8' : '#f2d8ff';
    g.beginPath();
    g.ellipse(x, y, rr, rr * sq, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
}

// ------------------------------------------------------------------ Chicote
/**
 * Corte do Chicote: arco largo de couro com a ponta estalando (clarão branco e faíscas) e o rastro de ar se desfazendo.
 * `side` (-1 esquerda, 1 direita), `age` de 0 a 1, `len` o comprimento do golpe em px.
 */
export function drawWhipCut(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  age: number,
  len = 120,
  evo = false,
): void {
  if (age < 0 || age >= 1) return;
  const cell = 3;
  const N = Math.ceil((len * 1.2) / cell) | 1;
  const M = 40;
  const L = lowres('whip', N, M);
  const pal = (
    evo
      ? ['#ffffff', '#ffd0d8', '#ff5a7a', '#c4143a', '#7a0a24']
      : ['#ffffff', '#fff0d0', '#e0b878', '#a8683a', '#5a3a1a']
  ).map(hex);
  const grow = easeOut(age / 0.35);
  const fade = 1 - smooth(0.5, 1, age);
  const L2 = (len / cell) * grow;
  const sx = side > 0 ? 2 : N - 3;
  const dirx = side > 0 ? 1 : -1;
  // arco: cresce da mão até a ponta, curvando para baixo no fim
  const pts: Array<[number, number]> = [];
  for (let s = 0; s <= 80; s++) {
    const t = s / 80;
    pts.push([sx + dirx * t * L2, M / 2 + Math.sin(t * Math.PI) * -7 + t * t * 5]);
  }
  pts.forEach(([px, py], i) => {
    const t = i / 80;
    const w = Math.max(1, Math.round(4 * (1 - t) + 1));
    // faixa grossa que afina, pontilhada na borda conforme desfaz
    for (let j = -w; j <= w; j++) {
      const c = Math.abs(j) < w * 0.35 ? pal[1]! : Math.abs(j) < w * 0.7 ? pal[2]! : pal[3]!;
      if (Math.abs(j) > w * 0.6 && !dither(i, j + 9, fade * 1.1 - t * 0.2)) continue;
      L.put(px, py + j, c);
    }
  });
  // trançado de couro: riscos curtos cruzados
  for (let i = 4; i < 76; i += 5) {
    const [px, py] = pts[Math.min(80, i)]!;
    if (dither(i, 1, fade)) L.put(px, py - 1, pal[4]!);
  }
  // estalo na ponta
  const [tx, ty] = pts[Math.min(80, Math.floor(grow * 80))]!;
  const snap = 1 - smooth(0.25, 0.6, age);
  if (snap > 0) {
    const rr = 2 + snap * 2;
    // estrela de quatro pontas no estalo (em vez de um disco)
    for (let q = -Math.round(rr * 2); q <= Math.round(rr * 2); q++) {
      const w = 1 - Math.abs(q) / (rr * 2 + 1);
      if (w > 0.2) {
        L.put(tx + q, ty, pal[w > 0.5 ? 0 : 1]!);
        L.put(tx, ty + q, pal[w > 0.5 ? 0 : 1]!);
      }
    }
    L.put(tx, ty, pal[0]!);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      L.put(
        tx + Math.cos(a) * (rr + 3 + age * 5),
        ty + Math.sin(a) * (rr + 3 + age * 5),
        pal[s % 2 ? 1 : 2]!,
      );
    }
  }
  L.flush(g, x + (side > 0 ? 1 : -1) * ((N * cell) / 2 - 6), y - 6, cell);
}

// ------------------------------------------------------------------ Bomba de Cereja (a bomba no ar e no chão)
/** A bomba de cereja: duas cerejas brilhantes presas pelo cabo, com folha e pavio aceso faiscando mais forte perto de estourar. */
export function drawCherryBomb(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  fuse = 0,
  scale = 1,
): void {
  const N = 32;
  const L = lowres('cherry', N);
  const red = ['#ffd0d8', '#ff7a8a', '#e8344a', '#b01a34', '#6a1024'].map(hex);
  const ball = (cx: number, cy: number, r: number) => {
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const dd = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
        if (dd >= r) continue;
        const l = Math.hypot(i + 0.5 - cx + r * 0.35, j + 0.5 - cy + r * 0.35) / (r * 1.5);
        L.put(i, j, red[Math.min(4, Math.floor(l * 5))]!);
      }
    L.put(cx - r * 0.45, cy - r * 0.45, red[0]!);
    L.put(cx - r * 0.45 + 1, cy - r * 0.45, red[0]!);
  };
  ball(10, 21, 6.4);
  ball(21, 22, 5.8);
  const line = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
    const k = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= k; s++) L.put(x0 + ((x1 - x0) * s) / k, y0 + ((y1 - y0) * s) / k, c);
  };
  line(10, 15, 15, 8, hex('#4fb85a'));
  line(21, 17, 16, 8, hex('#2f7d3f'));
  line(15, 8, 17, 4, hex('#d9c79a'));
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, 1],
  ] as const)
    L.put(17 + dx, 4 + dy, hex('#7a5a2a'));
  // pavio aceso: faísca que pisca, mais forte e vermelha perto de estourar
  const fl = Math.floor(t * 20) % 2;
  const hot = fuse > 0.5;
  L.put(17, 3, hex('#ffffff'));
  L.put(16, 3, hex(hot ? '#ff3a1a' : '#ffd23f'));
  L.put(18, 3, hex(hot ? '#ff3a1a' : '#ffd23f'));
  L.put(17, 2, hex('#ff9a1a'));
  if (fl) {
    L.put(15, 2, hex('#ffd23f'));
    L.put(19, 2, hex('#ffd23f'));
    L.put(17, 1, hex('#ffffff'));
  }
  if (hot) {
    L.put(14, 3, hex('#ff9a1a'));
    L.put(20, 3, hex('#ff9a1a'));
  }
  L.flush(g, x, y, 2 * scale);
}
