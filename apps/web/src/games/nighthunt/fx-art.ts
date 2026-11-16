/**
 * Efeitos do Night Hunt desenhados por código no estilo pixel art (paleta curta, bordas duras, pontilhado nas transições):
 * a explosão da Bomba de Cereja e o projétil da Varinha Arcana. Cada efeito é desenhado numa grade pequena e depois
 * ampliado sem suavização, para combinar com os sprites do jogo.
 */

type Rgb = [number, number, number];

const hex = (c: string): Rgb => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

/** Aleatório determinístico (a mesma explosão sempre sai igual): 0 a 1. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** Matriz de pontilhado 4x4 (Bayer): decide qual pixel acende numa transição suave sem usar transparência. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const dither = (x: number, y: number, v: number) => v > (BAYER[y & 3]![x & 3]! + 0.5) / 16;

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
