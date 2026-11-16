/**
 * Ícones de item desenhados por código (32x32, pixel art com luz vinda de cima à esquerda, rampas de cor de 4 a 5 tons e
 * contorno escuro): Cruz, Círculo de Brasas e Aura de Alho. Cada forma é preenchida pixel a pixel com um sombreado simples
 * (a luz bate na borda de cima e esquerda, a sombra cai embaixo e à direita).
 */
type Rgb = [number, number, number];
const hex = (c: string): Rgb => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];
const INK: Rgb = hex('#12182b');

class Pix {
  readonly c: HTMLCanvasElement;
  private img: ImageData;
  constructor(readonly n = 32) {
    this.c = document.createElement('canvas');
    this.c.width = n;
    this.c.height = n;
    this.img = this.c.getContext('2d')!.createImageData(n, n);
  }
  put(x: number, y: number, col: Rgb) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.n || y >= this.n) return;
    const o = (y * this.n + x) * 4;
    this.img.data[o] = col[0];
    this.img.data[o + 1] = col[1];
    this.img.data[o + 2] = col[2];
    this.img.data[o + 3] = 255;
  }
  has(x: number, y: number) {
    return (
      x >= 0 && y >= 0 && x < this.n && y < this.n && this.img.data[(y * this.n + x) * 4 + 3]! > 0
    );
  }
  rect(x: number, y: number, w: number, h: number, col: Rgb) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, col);
  }
  /** Preenche uma região (função de pertinência) escolhendo o tom da rampa pela luz: 0 = mais claro, ramp.length-1 = mais escuro. */
  shape(
    inside: (x: number, y: number) => boolean,
    ramp: Rgb[],
    light: (x: number, y: number) => number,
  ) {
    for (let y = 0; y < this.n; y++)
      for (let x = 0; x < this.n; x++)
        if (inside(x + 0.5, y + 0.5)) {
          const l = Math.max(0, Math.min(0.999, light(x + 0.5, y + 0.5)));
          this.put(x, y, ramp[Math.floor(l * ramp.length)]!);
        }
  }
  line(x0: number, y0: number, x1: number, y1: number, col: Rgb, t = 1) {
    const k = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= k; s++)
      this.rect(
        Math.round(x0 + ((x1 - x0) * s) / k),
        Math.round(y0 + ((y1 - y0) * s) / k),
        t,
        t,
        col,
      );
  }
  done(): HTMLCanvasElement {
    this.c.getContext('2d')!.putImageData(this.img, 0, 0);
    return outline(this.c);
  }
}

/** Contorno escuro de 1 px em volta de tudo (as bordas do ícone ficam bem separadas do fundo azul). */
function outline(src: HTMLCanvasElement): HTMLCanvasElement {
  const n = src.width;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const q = c.getContext('2d')!;
  const s = src.getContext('2d')!.getImageData(0, 0, n, n);
  const out = q.createImageData(n, n);
  const a = (x: number, y: number) =>
    x < 0 || y < 0 || x >= n || y >= n ? 0 : s.data[(y * n + x) * 4 + 3]!;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const o = (y * n + x) * 4;
      if (a(x, y) > 0) {
        out.data[o] = s.data[o]!;
        out.data[o + 1] = s.data[o + 1]!;
        out.data[o + 2] = s.data[o + 2]!;
        out.data[o + 3] = 255;
      } else if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
        out.data[o] = INK[0];
        out.data[o + 1] = INK[1];
        out.data[o + 2] = INK[2];
        out.data[o + 3] = 255;
      }
    }
  q.putImageData(out, 0, 0);
  return c;
}

const lightTL = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  0.5 + ((x - cx) * 0.7 + (y - cy) * 0.7) / (r * 1.6);

/** Cruz sagrada de prata com adornos dourados e uma gema azul no centro, com riscos de movimento (ela é arremessada). */
export function iconCross(): HTMLCanvasElement {
  const p = new Pix();
  const silver = ['#ffffff', '#e4eefc', '#b8cbe6', '#8aa0c4', '#5f759e'].map(hex);
  const gold = ['#fff3a8', '#ffd94a', '#e8a22a', '#a8661a'].map(hex);
  // riscos de movimento atrás (embaixo à esquerda)
  for (const [x0, y0, x1, y1] of [
    [3, 26, 9, 20],
    [2, 22, 6, 18],
    [6, 29, 12, 23],
  ] as const)
    p.line(x0, y0, x1, y1, hex('#9ad0ff'));
  // hastes da cruz (vertical comprida, horizontal curta), com bisel
  const vert = (x: number, y: number) => x >= 12 && x < 20 && y >= 3 && y < 29;
  const horz = (x: number, y: number) => x >= 5 && x < 27 && y >= 10 && y < 18;
  p.shape(
    (x, y) => vert(x, y) || horz(x, y),
    silver,
    (x, y) => {
      // bisel: claro na borda esquerda/superior de cada haste, escuro na direita/inferior
      const inV = vert(x, y);
      const inH = horz(x, y);
      let l = 0.45;
      if (inV) l = 0.15 + ((x - 12) / 8) * 0.75 * 0.9 + ((y - 3) / 26) * 0.15;
      if (inH && !(inV && y > 12 && y < 16))
        l = Math.min(l === 0.45 ? 1 : l, 0.15 + ((y - 10) / 8) * 0.8);
      if (inV && inH) l = 0.1 + ((x - 12) / 8) * 0.5 + ((y - 10) / 8) * 0.3;
      return l;
    },
  );
  // fio de luz branco na borda superior esquerda
  for (let y = 4; y < 28; y++) p.put(12, y, silver[0]!);
  for (let x = 6; x < 26; x++) p.put(x, 10, silver[0]!);
  // pontas douradas
  p.rect(12, 3, 8, 2, gold[1]!);
  p.rect(12, 3, 8, 1, gold[0]!);
  p.rect(12, 27, 8, 2, gold[2]!);
  p.rect(5, 10, 2, 8, gold[1]!);
  p.rect(5, 10, 1, 8, gold[0]!);
  p.rect(25, 10, 2, 8, gold[2]!);
  // gema azul no centro, com brilho
  p.shape(
    (x, y) => Math.hypot(x - 16, y - 14) < 3.6,
    ['#e8fbff', '#7fe0ff', '#3a9bff', '#2a4fd0'].map(hex),
    lightTL(16, 14, 3.6),
  );
  p.put(15, 13, hex('#ffffff'));
  // cintilar nas pontas
  p.put(16, 1, hex('#ffffff'));
  p.put(15, 2, hex('#cfe8ff'));
  p.put(17, 2, hex('#cfe8ff'));
  p.put(29, 14, hex('#ffffff'));
  return p.done();
}

/** Três bolas de fogo girando num anel, cada uma com cauda de chama para trás e núcleo branco. */
export function iconEmbers(evo = false): HTMLCanvasElement {
  const p = new Pix();
  const ramp = (
    evo
      ? ['#ffffff', '#c8f0ff', '#6fc8ff', '#2f7fe0', '#1a3fa0']
      : ['#fffbe0', '#ffe27a', '#ffb02e', '#ff7a1a', '#d9461a']
  ).map(hex);
  const cx = 16;
  const cy = 16;
  const R = 10;
  // anel de órbita tracejado
  for (let s = 0; s < 120; s++) {
    if (s % 4 > 1) continue;
    const th = (s / 120) * Math.PI * 2;
    p.put(cx + Math.cos(th) * R, cy + Math.sin(th) * R, hex(evo ? '#3a64b0' : '#a8502a'));
  }
  // brasa central
  p.shape(
    (x, y) => Math.hypot(x - cx, y - cy) < 2.6,
    [
      hex(evo ? '#9fd8ff' : '#ffb02e'),
      hex(evo ? '#3a8fe0' : '#d9461a'),
      hex(evo ? '#1a3fa0' : '#8a2a1a'),
    ],
    lightTL(cx, cy, 2.6),
  );
  for (let b = 0; b < 3; b++) {
    const th = -Math.PI / 2 + (b / 3) * Math.PI * 2;
    const bx = cx + Math.cos(th) * R;
    const by = cy + Math.sin(th) * R;
    // direção da órbita (horário): a cauda vai para trás dela
    const tx = -Math.sin(th);
    const ty = Math.cos(th);
    // cauda em gota: pontos para trás, cada vez mais finos
    for (let s = 1; s <= 8; s++) {
      const w = Math.max(0.6, 3.3 - s * 0.38);
      const px = bx - tx * s * 1.1;
      const py = by - ty * s * 1.1;
      const col = s < 3 ? ramp[2]! : s < 5 ? ramp[3]! : ramp[4]!;
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) if (Math.hypot(i, j) <= w) p.put(px + i, py + j, col);
    }
    // bola: laranja por fora, amarelo no meio, núcleo branco
    p.shape(
      (x, y) => Math.hypot(x - bx, y - by) < 4.2,
      ramp.slice(0, 4),
      (x, y) => Math.hypot(x - bx + 0.8, y - by + 0.8) / 4.6,
    );
    p.put(bx - 1, by - 1, hex('#ffffff'));
    // pontinha de chama saindo do alto
    p.put(bx + tx * -1 + Math.cos(th) * 4.5, by + ty * -1 + Math.sin(th) * 4.5, ramp[1]!);
  }
  return p.done();
}

/** Bulbo de alho com gomos, folhinha verde no alto, raízes e brilhos verdes em volta. */
export function iconGarlic(): HTMLCanvasElement {
  const p = new Pix();
  const cream = ['#ffffff', '#fbf6e2', '#e8e0c0', '#c9bf98', '#9a9070'].map(hex);
  const green = ['#d6ffc0', '#8fdc78', '#4fb85a', '#2f7d3f'].map(hex);
  const cx = 16;
  const cy = 18;
  // raízes embaixo
  for (const dx of [-4, -2, 0, 2, 4]) p.line(cx + dx * 0.9, 27, cx + dx * 1.3, 30, hex('#c9bf98'));
  // caule e folha
  p.line(cx, 8, cx, 3, green[2]!, 2);
  p.line(cx + 1, 8, cx + 1, 3, green[3]!, 1);
  p.line(cx, 4, cx + 5, 1, green[1]!, 1);
  p.line(cx, 4, cx - 4, 1, green[2]!, 1);
  p.put(cx + 5, 1, green[0]!);
  // bulbo: elipse com a ponta de cima mais fina (formato de gota)
  const inside = (x: number, y: number) => {
    const dy = y - cy;
    const rx =
      dy < 0
        ? 11 * Math.sqrt(Math.max(0, 1 - (dy / 11) ** 2)) * (0.82 + 0.18 * (1 - -dy / 11))
        : 11 * Math.sqrt(Math.max(0, 1 - (dy / 9) ** 2));
    return Math.abs(x - cx) < rx && dy > -10.5 && dy < 9;
  };
  p.shape(inside, cream, lightTL(cx - 2, cy - 3, 11));
  // gomos: arcos curvos do topo até a base
  for (const k of [-1, 0, 1]) {
    for (let y = -8; y <= 8; y++) {
      const t = y / 9;
      const x = cx + k * 4.6 * Math.sqrt(Math.max(0, 1 - t * t * 0.55));
      if (inside(x, cy + y)) p.put(x, cy + y, cream[3]!);
    }
  }
  // brilho e sombra do gomo da frente
  p.put(cx - 5, cy - 5, hex('#ffffff'));
  p.put(cx - 6, cy - 4, hex('#ffffff'));
  p.put(cx - 5, cy - 4, cream[0]!);
  // brilhos verdes em volta
  for (const [x, y] of [
    [4, 8],
    [27, 12],
    [26, 24],
    [5, 22],
  ] as const) {
    p.put(x, y, green[0]!);
    p.put(x - 1, y, green[1]!);
    p.put(x + 1, y, green[1]!);
    p.put(x, y - 1, green[1]!);
    p.put(x, y + 1, green[1]!);
  }
  return p.done();
}

/** Osso: osso grande e brilhante na diagonal, com as duas pontas em dois nós, sombra de marfim e riscos de arremesso. */
export function iconBone(): HTMLCanvasElement {
  const p = new Pix();
  const ivory = ['#ffffff', '#fffbe8', '#f0e6c4', '#d4c59a', '#a89868'].map(hex);
  // riscos de movimento atrás (embaixo à esquerda)
  for (const [x0, y0, x1, y1] of [
    [2, 22, 8, 28],
    [3, 17, 6, 20],
    [8, 30, 13, 31],
  ] as const)
    p.line(x0, y0, x1, y1, hex('#9ad0ff'));
  // eixo do osso: do canto de baixo à esquerda ao de cima à direita
  const ax = 8;
  const ay = 24;
  const bx = 24;
  const by = 8;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const along = (x: number, y: number) => (x - ax) * ux + (y - ay) * uy;
  const across = (x: number, y: number) => -(x - ax) * uy + (y - ay) * ux;
  const knob = (x: number, y: number, kx: number, ky: number) => Math.hypot(x - kx, y - ky) < 4.3;
  const inside = (x: number, y: number) => {
    const a = along(x, y);
    const c = across(x, y);
    const shaft =
      a > 2 &&
      a < len - 2 &&
      Math.abs(c) < 2.4 + 0.5 * Math.pow(Math.abs(a - len / 2) / (len / 2), 2);
    // dois nós em cada ponta, abertos para os lados
    const ends = [
      [ax, ay],
      [bx, by],
    ] as const;
    let kn = false;
    for (const [ex, ey] of ends) {
      const px = -uy;
      const py = ux;
      kn =
        kn || knob(x, y, ex + px * 2.7, ey + py * 2.7) || knob(x, y, ex - px * 2.7, ey - py * 2.7);
    }
    return shaft || kn;
  };
  p.shape(
    inside,
    ivory,
    (x, y) => 0.2 + ((-across(x, y) + 4) / 9) * 0.8 + (along(x, y) / len) * 0.1,
  );
  // reflexos brancos nos nós e rachadura do meio
  for (const [x, y] of [
    [5, 21],
    [10, 27],
    [21, 6],
    [27, 11],
  ] as const)
    p.put(x, y, hex('#ffffff'));
  p.line(15, 18, 17, 16, hex('#a89868'));
  // faísca de impacto
  p.put(28, 4, hex('#ffffff'));
  p.put(27, 4, hex('#cfe8ff'));
  p.put(29, 4, hex('#cfe8ff'));
  p.put(28, 3, hex('#cfe8ff'));
  p.put(28, 5, hex('#cfe8ff'));
  return p.done();
}
