/**
 * Utilitários de desenho do Sinal Vermelho 2 (spec 026). Tudo em Canvas 2D e em "pixels de arte"
 * (30 por metro); a câmera só dá o zoom. As formas levam gradiente, contorno em tom escuro da própria
 * cor, brilho e sombra no chão, em vez da cor chapada com sombra dura da primeira versão.
 */

export type Ctx = CanvasRenderingContext2D;
export const INK = '#111111';
export const PAPER = '#f4f4ef';
export const YEL = '#ffd23f';
export const ORG = '#ff6a2b';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const wrapY = (v: number, p: number) => ((v % p) + p) % p;
/** Entra e sai suave (0 a 1 a 0). */
export const ease = (t: number) => t * t * (3 - 2 * t);

/** Um número entre 0 e 1 que sempre sai igual para a mesma dupla (o mundo não muda ao rolar). */
export function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- cores
const cache = new Map<string, [number, number, number]>();

export function rgb(hex: string): [number, number, number] {
  const hit = cache.get(hex);
  if (hit) return hit;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(full, 16);
  const out: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, out);
  return out;
}

const to2 = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
export const toHex = (r: number, g: number, b: number) => `#${to2(r)}${to2(g)}${to2(b)}`;

/** Mistura duas cores (t = 0 devolve `a`, t = 1 devolve `b`). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return toHex(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t));
}

/** Clareia (amt > 0) ou escurece (amt < 0) uma cor. */
export const shade = (hex: string, amt: number) => (amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#05050a', -amt));

/** A cor com transparência. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  // sem notação científica (valores minúsculos viram 1e-7) e sempre entre 0 e 1
  return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`;
}

/** O contorno de uma cor: o mesmo tom, bem escuro (nunca o preto puro). */
export const edgeOf = (hex: string) => mix(hex, '#07070d', 0.78);

// ---------------------------------------------------------------- formas
export type PathFn = (c: Ctx) => void;

export const circle =
  (x: number, y: number, r: number): PathFn =>
  (c) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
  };
export const ell =
  (x: number, y: number, rx: number, ry: number, rot = 0): PathFn =>
  (c) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
export const rect =
  (x: number, y: number, w: number, h: number, r = 6): PathFn =>
  (c) => {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
  };
export const poly =
  (pts: [number, number][]): PathFn =>
  (c) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  };
export const star =
  (x: number, y: number, r1: number, r2: number, n = 5, rot = -Math.PI / 2): PathFn =>
  (c) => {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = rot + (i * Math.PI) / n;
      if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  };

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, lw = 3, col = INK) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.lineWidth = lw;
  c.strokeStyle = col;
  c.lineCap = 'round';
  c.stroke();
}

/** Forma da interface (Pop Brutal): contorno de tinta e sombra dura, sem gradiente. */
export function blob(c: Ctx, path: PathFn, fill: string, lw = 3, sh = 3, shadeCol = INK) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (sh) {
    c.save();
    c.translate(sh, sh);
    path(c);
    c.fillStyle = shadeCol;
    c.fill();
    c.restore();
  }
  path(c);
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = INK;
  c.stroke();
}

/**
 * Forma do mundo, com volume: gradiente vertical (luz de cima), contorno escuro do mesmo tom e um
 * fio de luz no alto. `y0` e `y1` são o topo e a base da forma, para o gradiente.
 */
export function paint(c: Ctx, path: PathFn, base: string, y0: number, y1: number, lw = 2.2, light = 0.22, dark = 0.2) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  path(c);
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(base, light));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -dark));
  c.fillStyle = g;
  c.fill();
  if (lw > 0) {
    c.lineWidth = lw;
    c.strokeStyle = edgeOf(base);
    c.stroke();
  }
}

/** Brilho (um risco claro) em cima de uma forma. */
export function gloss(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.35, rot = -0.4) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Sombra suave no chão (elipse com borda esfumada). */
export function soft(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.3, col = '0,0,0') {
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(0.6, `rgba(${col},${a * 0.55})`);
  g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Luz que se soma ao que já está desenhado (lâmpadas, brasas, olhos brilhando). */
export function glow(c: Ctx, x: number, y: number, r: number, color: string, a = 1) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.85 * a));
  g.addColorStop(0.4, alpha(color, 0.28 * a));
  g.addColorStop(1, alpha(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ---------------------------------------------------------------- texto
export function mono(c: Ctx, text: string, x: number, y: number, size = 11, col = INK, align: CanvasTextAlign = 'left') {
  c.font = `700 ${size}px 'Space Mono', ui-monospace, monospace`;
  c.fillStyle = col;
  c.textAlign = align;
  c.fillText(text, x, y);
}
export function disp(c: Ctx, text: string, x: number, y: number, size = 34, col = INK, align: CanvasTextAlign = 'left') {
  c.font = `900 ${size}px Archivo, 'Arial Black', system-ui, sans-serif`;
  c.fillStyle = col;
  c.textAlign = align;
  c.fillText(text, x, y);
}

// ---------------------------------------------------------------- texturas em cache
const tiles = new Map<string, HTMLCanvasElement>();

/** Um ladrilho sem emenda, desenhado uma vez e reaproveitado como padrão de chão. */
export function tile(key: string, size: number, draw: (c: Ctx, size: number) => void): HTMLCanvasElement {
  const hit = tiles.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d');
  if (c) draw(c, size);
  tiles.set(key, cv);
  return cv;
}

/** Desenha `fn` também deslocado em cada lado, para o ladrilho emendar sem costura. */
export function wrapDraw(c: Ctx, size: number, fn: (dx: number, dy: number) => void) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy);
  void c;
}
