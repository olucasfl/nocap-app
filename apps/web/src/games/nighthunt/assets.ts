/** Carrega o atlas de sprites, as animações de quadros e as fontes bitmap do Night Hunt (extraídos do Slash por tools/art/nighthunt). */
const BASE = '/nighthunt';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface AnimDef {
  duration: number;
  loop: boolean;
  frames: { t: number; f: string | null }[];
}
interface BgItem {
  f: string;
  x: number;
  y: number;
  s: number;
}
interface Glyph {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  adv: number;
}
export interface BitmapFont {
  img: HTMLImageElement;
  glyphs: Map<number, Glyph>;
  line: number;
  tints: Map<string, HTMLCanvasElement>;
}

export interface Atlas {
  img: HTMLImageElement;
  white: HTMLCanvasElement;
  tints: Map<string, HTMLCanvasElement>;
  frames: Record<string, Rect>;
  anims: Record<string, AnimDef>;
  bgs: BgItem[][];
  fonts: { square: BitmapFont; bonk: BitmapFont };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('imagem: ' + src));
    im.src = src;
  });
}

function silhouette(
  img: CanvasImageSource,
  w: number,
  h: number,
  color: string,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const q = c.getContext('2d')!;
  q.drawImage(img, 0, 0);
  q.globalCompositeOperation = 'source-in';
  q.fillStyle = color;
  q.fillRect(0, 0, w, h);
  return c;
}

async function loadFont(name: string): Promise<BitmapFont> {
  const [txt, img] = await Promise.all([
    fetch(`${BASE}/fonts/${name}.fnt`).then((r) => r.text()),
    loadImage(`${BASE}/fonts/${name}.png`),
  ]);
  const glyphs = new Map<number, Glyph>();
  let line = 0;
  for (const l of txt.split('\n')) {
    const kv: Record<string, number> = {};
    for (const m of l.matchAll(/(\w+)=(-?\d+)/g)) kv[m[1]!] = Number(m[2]);
    if (l.startsWith('common ')) line = kv.lineHeight ?? 0;
    if (l.startsWith('char '))
      glyphs.set(kv.id!, {
        x: kv.x!,
        y: kv.y!,
        w: kv.width!,
        h: kv.height!,
        ox: kv.xoffset!,
        oy: kv.yoffset!,
        adv: kv.xadvance!,
      });
  }
  return { img, glyphs, line, tints: new Map() };
}

export async function loadAtlas(): Promise<Atlas> {
  const [meta, img, square, bonk] = await Promise.all([
    fetch(`${BASE}/atlas.json`).then(
      (r) =>
        r.json() as Promise<{
          size: [number, number];
          frames: Record<string, Rect>;
          anims: Record<string, AnimDef>;
          bgs: BgItem[][];
        }>,
    ),
    loadImage(`${BASE}/atlas.png`),
    loadFont('square'),
    loadFont('bonk'),
  ]);
  return {
    img,
    white: silhouette(img, img.width, img.height, '#ffffff'),
    tints: new Map(),
    frames: meta.frames,
    anims: meta.anims,
    bgs: meta.bgs,
    fonts: { square, bonk },
  };
}

export interface DrawOpts {
  /** Escala (padrão 2: o Slash desenha tudo em dobro). */
  s?: number;
  sx?: number;
  sy?: number;
  flip?: boolean;
  alpha?: number;
  rot?: number;
  /** Âncora (0..1); padrão centro. */
  ax?: number;
  ay?: number;
  white?: boolean;
  tint?: string;
  tintAlpha?: number;
  /** Recorte horizontal da fonte: usa só os primeiros `cropW` pixels (como o sprite repetido da espada). */
  cropW?: number;
}

export function frameSize(a: Atlas, name: string): { w: number; h: number } {
  const f = a.frames[name];
  return f ? { w: f.w, h: f.h } : { w: 0, h: 0 };
}

function tinted(a: Atlas, color: string): HTMLCanvasElement {
  let c = a.tints.get(color);
  if (!c) {
    c = silhouette(a.img, a.img.width, a.img.height, color);
    a.tints.set(color, c);
  }
  return c;
}

/** Desenha um quadro do atlas com a âncora em (x, y). Sem suavização, para a pixel art ficar nítida. */
export function drawFrame(
  g: CanvasRenderingContext2D,
  a: Atlas,
  name: string | null,
  x: number,
  y: number,
  o: DrawOpts = {},
): void {
  if (!name) return;
  const f = a.frames[name];
  if (!f) return;
  const s = o.s ?? 2;
  const sx = (o.sx ?? 1) * s;
  const sy = (o.sy ?? 1) * s;
  const ax = o.ax ?? 0.5;
  const ay = o.ay ?? 0.5;
  const sw = o.cropW ? Math.min(o.cropW, f.w) : f.w;
  const srcX = f.x;
  g.save();
  g.imageSmoothingEnabled = false;
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  g.scale(o.flip ? -sx : sx, sy);
  const draw = (src: CanvasImageSource, alpha: number) => {
    g.globalAlpha = alpha;
    g.drawImage(src, srcX, f.y, sw, f.h, -sw * ax, -f.h * ay, sw, f.h);
  };
  draw(o.white ? a.white : a.img, o.alpha ?? 1);
  if (o.tint) draw(tinted(a, o.tint), (o.tintAlpha ?? 0.5) * (o.alpha ?? 1));
  g.restore();
}

/** Quadro de uma animação no tempo t (em segundos), com laço quando a animação pede. */
export function animFrame(a: Atlas, key: string, t: number): string | null {
  const an = a.anims[key];
  if (!an) return null;
  const tt = an.loop ? t % an.duration : Math.min(t, an.duration);
  let cur: string | null = an.frames[0]?.f ?? null;
  for (const fr of an.frames) {
    if (fr.t <= tt) cur = fr.f;
    else break;
  }
  return cur;
}
export function animDuration(a: Atlas, key: string): number {
  return a.anims[key]?.duration ?? 0;
}

// ---------- texto com a fonte bitmap do Slash ----------
export interface TextOpts {
  /** Altura de linha desejada em pixels da tela lógica. */
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  font?: 'square' | 'bonk';
  /** Sombra/contorno escuros. */
  shadow?: boolean;
  alpha?: number;
  maxWidth?: number;
}

function fontTint(a: Atlas, f: BitmapFont, color: string): CanvasImageSource {
  if (color === '#ffffff') return f.img;
  let c = f.tints.get(color);
  if (!c) {
    c = silhouette(f.img, f.img.width, f.img.height, color);
    f.tints.set(color, c);
  }
  return c;
}

export function measureText(a: Atlas, text: string, o: TextOpts = {}): number {
  const f = a.fonts[o.font ?? 'square'];
  const k = (o.size ?? 20) / f.line;
  let w = 0;
  for (const ch of text) w += (f.glyphs.get(ch.codePointAt(0)!) ?? f.glyphs.get(63)!)?.adv ?? 0;
  return w * k;
}

export function drawText(
  g: CanvasRenderingContext2D,
  a: Atlas,
  text: string,
  x: number,
  y: number,
  o: TextOpts = {},
): void {
  const f = a.fonts[o.font ?? 'square'];
  let size = o.size ?? 20;
  if (o.maxWidth) {
    const w = measureText(a, text, { ...o, size });
    if (w > o.maxWidth) size *= o.maxWidth / w;
  }
  const k = size / f.line;
  const total = measureText(a, text, { ...o, size });
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const color = o.color ?? '#ffffff';
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = o.alpha ?? 1;
  const pass = (src: CanvasImageSource, dx: number, dy: number) => {
    let px = cx;
    for (const ch of text) {
      const gl = f.glyphs.get(ch.codePointAt(0)!) ?? f.glyphs.get(63);
      if (!gl) continue;
      if (gl.w > 0 && gl.h > 0)
        g.drawImage(
          src,
          gl.x,
          gl.y,
          gl.w,
          gl.h,
          px + gl.ox * k + dx,
          y + gl.oy * k + dy,
          gl.w * k,
          gl.h * k,
        );
      px += gl.adv * k;
    }
  };
  if (o.shadow !== false) {
    const dark = fontTint(a, f, '#10131c');
    const d = Math.max(1, size / 14);
    pass(dark, d, d);
    pass(dark, -d * 0.6, 0);
    pass(dark, d * 0.6, 0);
    pass(dark, 0, -d * 0.6);
  }
  pass(fontTint(a, f, color), 0, 0);
  g.restore();
  cx += 0;
}

/** Quebra o texto em linhas que cabem em maxWidth. */
export function wrapText(a: Atlas, text: string, maxWidth: number, o: TextOpts = {}): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (measureText(a, t, o) > maxWidth && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Janela de 9 fatias com um quadro do atlas. l/t/r/b são as bordas em pixels da imagem. */
export function nineSlice(
  g: CanvasRenderingContext2D,
  a: Atlas,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  edge: number,
  s = 2,
  alpha = 1,
): void {
  const f = a.frames[name];
  if (!f) return;
  const e = edge;
  const E = e * s;
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  const sw = f.w - 2 * e;
  const sh = f.h - 2 * e;
  const cols = [
    [f.x, e, x, E],
    [f.x + e, sw, x + E, w - 2 * E],
    [f.x + f.w - e, e, x + w - E, E],
  ] as const;
  const rows = [
    [f.y, e, y, E],
    [f.y + e, sh, y + E, h - 2 * E],
    [f.y + f.h - e, e, y + h - E, E],
  ] as const;
  for (const r of rows)
    for (const c of cols) g.drawImage(a.img, c[0], r[0], c[1], r[1], c[2], r[2], c[3], r[3]);
  g.restore();
}
