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

// ------------------------------------------------------------------ armas
/** Frasco de magma: vidro azulado com lava borbulhando, rolha e brilho; gotas escorrendo. */
export function iconMagma(evo = false): HTMLCanvasElement {
  const p = new Pix();
  const glass = ['#e8fbff', '#b8e4f4', '#7fb8d8', '#4a7fa8'].map(hex);
  const lava = (
    evo
      ? ['#fffbe0', '#ffe27a', '#ffc23a', '#ff8a1a', '#d9461a']
      : ['#fff3a8', '#ffd23f', '#ff9a1a', '#e8561a', '#a8301a']
  ).map(hex);
  // vidro: bojo redondo + gargalo
  p.shape(
    (x, y) => Math.hypot(x - 16, y - 20) < 10.5 || (x > 13 && x < 19 && y > 6 && y < 14),
    glass,
    lightTL(14, 17, 11),
  );
  // lava dentro (metade de baixo do bojo, com superfície ondulada)
  p.shape(
    (x, y) => Math.hypot(x - 16, y - 20) < 8.6 && y > 18 + Math.sin(x * 0.9) * 1.2,
    lava,
    (x, y) => (y - 17) / 11 + (x - 12) * 0.01,
  );
  // bolhas
  for (const [x, y, c] of [
    [13, 22, 0],
    [18, 24, 1],
    [16, 20, 0],
  ] as const) {
    p.put(x, y, lava[c]!);
    p.put(x + 1, y, lava[0]!);
  }
  // rolha e brilhos do vidro
  p.rect(13, 4, 6, 3, hex('#8a5a2a'));
  p.rect(13, 4, 6, 1, hex('#c99a5a'));
  p.put(11, 16, hex('#ffffff'));
  p.put(10, 17, hex('#ffffff'));
  p.put(14, 9, hex('#ffffff'));
  // gotas de lava pingando pelo lado de fora
  p.rect(26, 22, 2, 3, lava[3]!);
  p.put(26, 22, lava[1]!);
  p.rect(5, 27, 2, 2, lava[2]!);
  return p.done();
}

/** Runa: pedra azul lapidada com um sinal brilhante gravado e luz saindo. */
export function iconRunes(): HTMLCanvasElement {
  const p = new Pix();
  const stone = ['#9fd8ff', '#5aa8f0', '#3a6fd0', '#2a3f9a', '#1c2a6a'].map(hex);
  // pedra: losango alongado
  p.shape((x, y) => Math.abs(x - 16) / 10 + Math.abs(y - 16) / 13 < 1, stone, lightTL(13, 12, 14));
  // gravura da runa (um raio + traço), brilhando
  const glow = hex('#e8ffff');
  const mid = hex('#7fe0ff');
  for (const [x, y] of [
    [17, 8],
    [16, 10],
    [15, 12],
    [16, 14],
    [17, 16],
    [16, 18],
    [15, 20],
    [14, 22],
  ] as const) {
    p.put(x, y, glow);
    p.put(x + 1, y, mid);
  }
  p.line(12, 14, 20, 12, glow);
  p.line(12, 17, 19, 19, mid);
  // raios de luz pelo contorno
  for (const [x, y] of [
    [3, 6],
    [28, 8],
    [4, 26],
    [27, 25],
  ] as const) {
    p.put(x, y, glow);
    p.put(x - 1, y, mid);
    p.put(x + 1, y, mid);
    p.put(x, y - 1, mid);
    p.put(x, y + 1, mid);
  }
  return p.done();
}

/** Pentagrama: círculo e estrela de cinco pontas em roxo brilhante sobre um selo escuro, com gemas nas pontas. */
export function iconPentagram(): HTMLCanvasElement {
  const p = new Pix();
  const cx = 16;
  const cy = 16.5;
  const R = 12.5;
  p.shape(
    (x, y) => Math.hypot(x - cx, y - cy) < R + 1.5,
    ['#3a1a66', '#2a124d', '#1a0a33'].map(hex),
    (x, y) => (y - 3) / 28,
  );
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  // círculo
  for (let s = 0; s < 220; s++) {
    const a = (s / 220) * Math.PI * 2;
    p.put(cx + Math.cos(a) * R, cy + Math.sin(a) * R, hex('#c58cf0'));
  }
  // estrela (cada ponta liga à segunda seguinte)
  for (let i = 0; i < 5; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 2) % 5]!;
    p.line(x0, y0, x1, y1, hex('#9a56d6'), 2);
    p.line(x0, y0, x1, y1, hex('#f2d8ff'), 1);
  }
  // gemas nas pontas
  for (const [x, y] of pts) {
    p.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, hex('#ff5a8a'));
    p.put(Math.round(x) - 1, Math.round(y) - 1, hex('#ffd0e0'));
  }
  p.put(16, 16, hex('#ffffff'));
  return p.done();
}

/** Chicote: couro trançado em curva com cabo de ouro e ponta vermelha estalando, com faíscas. */
export function iconWhip(): HTMLCanvasElement {
  const p = new Pix();
  const leather = ['#e0b878', '#b8864a', '#8a5a2a', '#5a3a1a'].map(hex);
  // cabo
  p.rect(22, 22, 7, 7, hex('#3a2616'));
  p.shape(
    (x, y) => x >= 22 && x < 29 && y >= 22 && y < 29,
    ['#d9a85a', '#a67c3c', '#6a4a22'].map(hex),
    (x, y) => (x - 22 + (y - 22)) / 14,
  );
  p.rect(22, 21, 7, 2, hex('#ffd94a'));
  // corpo do chicote: curva em S saindo do cabo
  const curve: Array<[number, number]> = [];
  for (let s = 0; s <= 60; s++) {
    const t = s / 60;
    curve.push([23 - t * 19, 22 - Math.sin(t * Math.PI * 1.4) * 15 - t * 5]);
  }
  curve.forEach(([x, y], i) => {
    const w = i < 8 ? 3 : i < 36 ? 2 : 1;
    p.rect(Math.round(x), Math.round(y), w, w, leather[i % 6 < 3 ? 1 : 2]!);
    p.put(Math.round(x), Math.round(y) - 1, leather[0]!);
  });
  // ponta estalando: faísca vermelha e amarela
  const [tx, ty] = curve[curve.length - 1]!;
  p.rect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3, hex('#ff3a4a'));
  p.put(Math.round(tx), Math.round(ty), hex('#ffe27a'));
  for (const [dx, dy] of [
    [-3, -2],
    [3, -2],
    [-2, 3],
    [0, -4],
  ] as const)
    p.put(tx + dx, ty + dy, hex('#ffd23f'));
  return p.done();
}

/** Bomba de cereja: bola vermelha lustrosa com cabo verde curvo e pavio aceso. */
export function iconBomb(): HTMLCanvasElement {
  const p = new Pix();
  const red = ['#ffd0d8', '#ff7a8a', '#e8344a', '#b01a34', '#6a1024'].map(hex);
  // duas cerejas penduradas pelo mesmo cabo
  p.shape((x, y) => Math.hypot(x - 11, y - 21) < 7, red, lightTL(9, 19, 7.5));
  p.shape((x, y) => Math.hypot(x - 22, y - 22) < 6.5, red, lightTL(20, 20, 7));
  p.put(8, 18, hex('#ffffff'));
  p.put(9, 18, hex('#ffffff'));
  p.put(20, 19, hex('#ffffff'));
  // cabos verdes saindo das duas cerejas e se juntando no alto
  p.line(11, 14, 15, 7, hex('#4fb85a'));
  p.line(22, 15, 17, 7, hex('#2f7d3f'));
  p.line(11, 15, 15, 8, hex('#8fdc78'));
  // folha
  p.shape(
    (x, y) => Math.hypot((x - 20) / 4, (y - 5) / 2) < 1,
    ['#8fdc78', '#4fb85a'].map(hex),
    (x) => (x - 16) / 8,
  );
  // pavio aceso no alto
  p.line(16, 7, 17, 3, hex('#d9c79a'));
  for (const [x, y, c] of [
    [17, 1, '#ffffff'],
    [16, 1, '#ffd23f'],
    [18, 1, '#ffd23f'],
    [17, 0, '#ff9a1a'],
    [17, 2, '#ff9a1a'],
  ] as const)
    p.put(x, y, hex(c));
  return p.done();
}

// ------------------------------------------------------------------ itens passivos
const GOLD = ['#fff6c0', '#ffd94a', '#e8a22a', '#a8661a'].map(hex);

/** Duração: ampulheta de vidro com areia dourada, base e tampa de madeira. */
export function iconDuration(): HTMLCanvasElement {
  const p = new Pix();
  // vidro em dois triângulos
  p.shape(
    (x, y) =>
      y >= 6 &&
      y < 26 &&
      Math.abs(x - 16) < (y < 16 ? 9 - (y - 6) * 0.85 : 0.5 + (y - 16) * 0.85) + 0.5,
    ['#e8fbff', '#b8e4f4', '#7fb8d8'].map(hex),
    lightTL(12, 8, 14),
  );
  // areia embaixo (monte) e um fio caindo
  p.shape(
    (x, y) => y > 20 && y < 26 && Math.abs(x - 16) < (y - 20) * 1.4 + 1,
    GOLD,
    (x, y) => (y - 19) / 8,
  );
  p.shape(
    (x, y) => y > 8 && y < 11 && Math.abs(x - 16) < 6 - (y - 8) * 1.2,
    GOLD,
    (x, y) => (y - 8) / 5,
  );
  p.line(16, 14, 16, 21, GOLD[1]!);
  // tampa e base
  for (const y of [3, 26]) {
    p.rect(6, y, 20, 3, hex('#8a5a2a'));
    p.rect(6, y, 20, 1, hex('#c99a5a'));
    p.rect(6, y + 2, 20, 1, hex('#5a3a1a'));
  }
  p.put(11, 9, hex('#ffffff'));
  return p.done();
}

/** Quantidade: três orbes empilhados em triângulo, o de cima maior, e um "+" dourado. */
export function iconAmount(): HTMLCanvasElement {
  const p = new Pix();
  const orb = ['#e8fbff', '#7fe0ff', '#3a9bff', '#2a4fd0', '#1c2f90'].map(hex);
  for (const [x, y, r] of [
    [16, 11, 6],
    [9, 22, 5],
    [23, 22, 5],
  ] as const) {
    p.shape((px, py) => Math.hypot(px - x, py - y) < r, orb, lightTL(x - 1.5, y - 1.5, r));
    p.put(x - 2, y - 2, hex('#ffffff'));
  }
  // + dourado
  p.rect(25, 3, 2, 7, GOLD[1]!);
  p.rect(22, 6, 8, 2, GOLD[1]!);
  p.rect(25, 3, 1, 7, GOLD[0]!);
  return p.done();
}

/** Maldição: caveira roxa com olhos brilhantes e fumaça arroxeada. */
export function iconCurse(): HTMLCanvasElement {
  const p = new Pix();
  const bone = ['#f4ecff', '#d9c8f0', '#b09ad0', '#7a62a0'].map(hex);
  // fumaça roxa
  for (const [x, y] of [
    [6, 8],
    [26, 6],
    [4, 20],
    [28, 22],
    [9, 28],
    [24, 29],
  ] as const) {
    p.rect(x, y, 2, 2, hex('#8a4fc8'));
    p.put(x + 1, y - 1, hex('#c58cf0'));
  }
  // crânio + mandíbula
  p.shape(
    (x, y) => Math.hypot(x - 16, y - 14) < 10 || (x > 10 && x < 22 && y > 18 && y < 27),
    bone,
    lightTL(13, 10, 12),
  );
  // olhos e nariz
  for (const ex of [12, 20]) {
    p.shape(
      (x, y) => Math.hypot(x - ex, y - 15) < 3.2,
      ['#ff6aff', '#a02ad0', '#4a1070'].map(hex),
      (x, y) => (y - 12) / 7,
    );
    p.put(ex - 1, 14, hex('#ffffff'));
  }
  p.rect(15, 20, 2, 3, hex('#4a3a6a'));
  // dentes
  for (let x = 12; x <= 19; x += 2) p.rect(x, 24, 1, 3, hex('#4a3a6a'));
  return p.done();
}

/** Ganância: pilha de moedas de ouro com brilho e uma moeda de lado. */
export function iconGreed(): HTMLCanvasElement {
  const p = new Pix();
  const coin = (cx: number, cy: number, r = 7) => {
    p.shape(
      (x, y) => Math.hypot((x - cx) / 1, (y - cy) / 0.55) < r,
      GOLD,
      (x, y) => (y - (cy - 4)) / 8 + (x - (cx - r)) * 0.01,
    );
    p.shape(
      (x, y) =>
        Math.abs(x - cx) < r &&
        y >= cy &&
        y < cy + 3 &&
        Math.hypot((x - cx) / 1, (y - cy - 1.5) / 0.55) < r + 0.5,
      [GOLD[2]!, GOLD[3]!],
      (x, y) => (y - cy) / 3,
    );
    p.rect(cx - 1, cy - 2, 2, 1, GOLD[0]!);
  };
  coin(16, 24);
  coin(16, 20);
  coin(16, 16);
  coin(16, 12);
  // moeda grande de frente, na lateral
  p.shape((x, y) => Math.hypot(x - 8, y - 22) < 5.5, GOLD, lightTL(6, 20, 6));
  p.rect(7, 19, 2, 6, GOLD[3]!);
  // brilhos
  for (const [x, y] of [
    [26, 6],
    [4, 10],
  ] as const) {
    p.put(x, y, hex('#ffffff'));
    p.put(x - 1, y, GOLD[0]!);
    p.put(x + 1, y, GOLD[0]!);
    p.put(x, y - 1, GOLD[0]!);
    p.put(x, y + 1, GOLD[0]!);
  }
  return p.done();
}

/** Ligeireza: bota alada com três faixas de velocidade. */
export function iconSwift(): HTMLCanvasElement {
  const p = new Pix();
  const leather = ['#e0b878', '#b8864a', '#8a5a2a', '#5a3a1a'].map(hex);
  // bota
  p.shape(
    (x, y) => (x >= 12 && x < 21 && y >= 8 && y < 22) || (x >= 12 && x < 28 && y >= 19 && y < 27),
    leather,
    lightTL(14, 10, 16),
  );
  p.rect(12, 8, 9, 2, hex('#ffd94a'));
  p.rect(12, 26, 16, 2, hex('#3a2616'));
  // asa
  for (let i = 0; i < 4; i++)
    p.line(12, 12 + i * 2, 4 - i * 0.5, 7 + i * 3, hex(i < 2 ? '#ffffff' : '#cfe8ff'), 2);
  // faixas de velocidade
  for (const [y, w] of [
    [14, 8],
    [18, 11],
    [23, 7],
  ] as const)
    p.rect(2, y, w, 1, hex('#7fe0ff'));
  return p.done();
}

/** Alcance: alvo com três círculos e setas para fora. */
export function iconArea(): HTMLCanvasElement {
  const p = new Pix();
  for (const [r, col] of [
    [12, '#3a9bff'],
    [8, '#7fe0ff'],
    [4, '#e8fbff'],
  ] as const)
    for (let s = 0; s < 160; s++) {
      const a = (s / 160) * Math.PI * 2;
      p.rect(16 + Math.cos(a) * r - 0.5, 16 + Math.sin(a) * r - 0.5, 2, 2, hex(col));
    }
  p.rect(15, 15, 2, 2, hex('#ffffff'));
  // setas nas diagonais
  for (const [dx, dy] of [
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    p.line(16 + dx * 5, 16 + dy * 5, 16 + dx * 14, 16 + dy * 14, hex('#ffd94a'));
    p.rect(16 + dx * 14 - (dx > 0 ? 3 : 0), 16 + dy * 14 - (dy > 0 ? 3 : 0), 3, 3, hex('#ffd94a'));
  }
  return p.done();
}

/** Sabedoria: livro aberto com uma estrela de luz saindo das páginas. */
export function iconGrowth(): HTMLCanvasElement {
  const p = new Pix();
  // páginas
  p.shape(
    (x, y) =>
      y > 14 &&
      y < 27 &&
      ((x > 3 && x < 16 && y < 27 - (16 - x) * 0.2) ||
        (x >= 16 && x < 29 && y < 27 - (x - 16) * 0.2)),
    ['#ffffff', '#f4ecd0', '#d9cc9a'].map(hex),
    (x, y) => Math.abs(x - 16) / 14,
  );
  p.rect(15, 14, 2, 14, hex('#8a5a2a'));
  for (let i = 0; i < 4; i++) {
    p.rect(6, 17 + i * 2, 8, 1, hex('#a89868'));
    p.rect(18, 17 + i * 2, 8, 1, hex('#a89868'));
  }
  p.rect(3, 27, 26, 2, hex('#6a3fa0'));
  // estrela de luz
  p.shape(
    (x, y) =>
      Math.abs(x - 16) / 9 + Math.abs(y - 8) / 9 < 1 &&
      (Math.abs(x - 16) < 2 || Math.abs(y - 8) < 2 || Math.hypot(x - 16, y - 8) < 4),
    GOLD,
    lightTL(14, 6, 10),
  );
  p.put(16, 8, hex('#ffffff'));
  p.put(3, 8, GOLD[1]!);
  p.put(29, 6, GOLD[1]!);
  return p.done();
}

/** Trevo: trevo de quatro folhas verde com veios e caule curvo. */
export function iconClover(): HTMLCanvasElement {
  const p = new Pix();
  const leaf = ['#d6ffc0', '#8fdc78', '#4fb85a', '#2f7d3f', '#1c4a2a'].map(hex);
  p.line(16, 20, 13, 29, hex('#2f7d3f'), 2);
  for (const [cx, cy] of [
    [11, 11],
    [21, 11],
    [11, 21],
    [21, 21],
  ] as const) {
    p.shape(
      (x, y) =>
        Math.hypot(x - cx, y - cy) < 6.2 ||
        Math.hypot(x - (cx + (cx < 16 ? 2 : -2)), y - (cy + (cy < 16 ? 2 : -2))) < 5,
      leaf,
      lightTL(cx - 2, cy - 2, 7),
    );
    p.line(cx, cy, cx + (cx < 16 ? 3 : -3), cy + (cy < 16 ? 3 : -3), leaf[3]!);
    p.put(cx - 2, cy - 2, hex('#ffffff'));
  }
  p.rect(15, 15, 2, 2, leaf[4]!);
  return p.done();
}

/** Diário de Caça: livro marrom com fecho dourado, marcador vermelho e uma pegada na capa. */
export function iconTome(): HTMLCanvasElement {
  const p = new Pix();
  const cover = ['#c98a5a', '#a8683a', '#7a4524', '#4a2a14'].map(hex);
  p.shape((x, y) => x >= 6 && x < 26 && y >= 4 && y < 28, cover, lightTL(9, 7, 22));
  p.rect(6, 4, 3, 24, hex('#4a2a14'));
  p.rect(6, 4, 1, 24, hex('#6a3a1a'));
  // páginas na lateral direita
  p.rect(25, 6, 2, 20, hex('#f4ecd0'));
  p.rect(25, 6, 1, 20, hex('#ffffff'));
  // fecho dourado
  p.rect(22, 14, 6, 5, GOLD[1]!);
  p.rect(22, 14, 6, 1, GOLD[0]!);
  p.rect(24, 16, 2, 2, GOLD[3]!);
  // pegada de patas na capa
  for (const [x, y] of [
    [13, 20],
    [16, 18],
    [19, 20],
    [16, 23],
  ] as const)
    p.rect(x, y, 2, 2, hex('#4a2a14'));
  // marcador vermelho
  p.rect(12, 28, 3, 3, hex('#d84a4a'));
  return p.done();
}
