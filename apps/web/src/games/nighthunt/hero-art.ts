/**
 * Sprites dos heróis do Night Hunt (pedido do Lucas, 16/11/2026): cada herói tem visual próprio e segura a SUA arma, em vez
 * de todos carregarem a espada do guerreiro. Desenhados por código, em pixels (32x32, contorno escuro), sem arquivo de
 * terceiros. O Kael continua com o guerreiro original (ele é o único que usa a espada).
 *
 * Os quadros têm os mesmos nomes do guerreiro (`PlWarriorIdle00`...), então a animação e o `heroFrame` não mudam.
 * Todos olham para a esquerda (o jogo espelha quando o herói anda para a direita), com a arma na mão da frente (esquerda).
 */

type Ctx = CanvasRenderingContext2D;

export type HeroPose = { kind: 'idle' | 'move' | 'die'; frame: number };

interface Look {
  skin: string;
  skinShade: string;
  /** Roupa: principal, sombra, detalhe. */
  cloth: string;
  clothShade: string;
  trim: string;
  boots: string;
  /** Largura extra do tronco (guardião largo, magos finos). */
  wide?: number;
  robe?: boolean;
}

const LOOKS: Record<string, Look> = {
  vesper: {
    skin: '#f2b27a',
    skinShade: '#d38a58',
    cloth: '#8e1f3f',
    clothShade: '#5c1228',
    trim: '#ffd23f',
    boots: '#2a1520',
  },
  mara: {
    skin: '#e8a874',
    skinShade: '#c98558',
    cloth: '#3f8f4a',
    clothShade: '#2a6234',
    trim: '#d9b36a',
    boots: '#5a3a1e',
  },
  brann: {
    skin: '#d79866',
    skinShade: '#b27647',
    cloth: '#7d8ea0',
    clothShade: '#55657a',
    trim: '#f0c24a',
    boots: '#3a4352',
    wide: 2,
  },
  dorian: {
    skin: '#e0a070',
    skinShade: '#bd7e50',
    cloth: '#6a3fa0',
    clothShade: '#46276f',
    trim: '#e8b84a',
    boots: '#3a2a1e',
  },
  selene: {
    skin: '#f0b890',
    skinShade: '#d09068',
    cloth: '#9a1f2a',
    clothShade: '#661219',
    trim: '#ffb02e',
    boots: '#3a1418',
    robe: true,
  },
  ysolde: {
    skin: '#f4d6c4',
    skinShade: '#d4aa96',
    cloth: '#3a4aa0',
    clothShade: '#242f72',
    trim: '#7fe0ff',
    boots: '#222a55',
    robe: true,
  },
  rurik: {
    skin: '#d89060',
    skinShade: '#b46c40',
    cloth: '#b02a2a',
    clothShade: '#7a1a1a',
    trim: '#e8c070',
    boots: '#3a2616',
    wide: 1,
  },
};

const INK = '#12182b';

function rect(g: Ctx, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}
const px = (g: Ctx, x: number, y: number, c: string) => rect(g, x, y, 1, 1, c);

/** Linha de pixels (Bresenham) para hastes diagonais. */
function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, c: string, t = 1) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    rect(g, x, y, t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/** O corpo-base: pernas, tronco, braços e cabeça, nas cores do herói. `bob` sobe o corpo 1 px, `step` mexe as pernas. */
function body(g: Ctx, L: Look, bob: number, step: number) {
  const w = L.wide ?? 0;
  const tx = 10 - w; // esquerda do tronco
  const tw = 12 + w * 2;
  const top = 13 + bob;
  // pernas
  const lh = L.robe ? 3 : 6;
  if (L.robe) {
    // vestido: sino até quase o chão, com os pés aparecendo
    rect(g, tx - 1, 20 + bob, tw + 2, 8 - bob, L.cloth);
    rect(g, tx - 1, 26, tw + 2, 2, L.clothShade);
    rect(g, 12 - (step === 1 ? 1 : 0), 28, 3, 2, L.boots);
    rect(g, 17 + (step === 3 ? 1 : 0), 28, 3, 2, L.boots);
  } else {
    const lOff = step === 1 ? -1 : step === 3 ? 1 : 0;
    const rOff = -lOff;
    rect(g, 11 + lOff, 23 + bob, 4, lh, L.clothShade);
    rect(g, 17 + rOff, 23 + bob, 4, lh, L.clothShade);
    rect(g, 10 + lOff, 27, 5, 3, L.boots);
    rect(g, 17 + rOff, 27, 5, 3, L.boots);
  }
  // tronco
  rect(g, tx, top, tw, 10, L.cloth);
  rect(g, tx, top + 7, tw, 3, L.clothShade);
  rect(g, tx, top + 5, tw, 1, L.trim); // cinto
  // braço de trás (direita da arte) e braço da frente (esquerda, segura a arma)
  rect(g, tx + tw, top + 1, 3, 7, L.clothShade);
  px(g, tx + tw + 1, top + 8, L.skin);
  px(g, tx + tw + 2, top + 8, L.skin);
  rect(g, tx - 3, top + 1, 3, 6, L.cloth);
  rect(g, tx - 3, top + 7, 3, 2, L.skin); // mão da frente
  // cabeça
  rect(g, 12, 5 + bob, 8, 8, L.skin);
  rect(g, 12, 11 + bob, 8, 2, L.skinShade);
  // olhos (olhando para a esquerda)
  px(g, 13, 8 + bob, INK);
  px(g, 13, 9 + bob, INK);
  px(g, 17, 8 + bob, INK);
  px(g, 17, 9 + bob, INK);
}

/** Bola de luz com brilho (pontas das varinhas, brasas). */
function orb(g: Ctx, cx: number, cy: number, c: string, hi: string) {
  rect(g, cx - 1, cy - 2, 3, 5, c);
  rect(g, cx - 2, cy - 1, 5, 3, c);
  px(g, cx - 1, cy - 1, hi);
  px(g, cx, cy - 1, hi);
}

const DRAW: Record<string, (g: Ctx, L: Look, bob: number, t: number, step: number) => void> = {
  // Vesper, a Açoitadora: cabelo comprido carmim, corselete de couro e um chicote enrolado na mão
  vesper(g, L, bob, t, step) {
    body(g, L, bob, step);
    // cabelo longo
    rect(g, 11, 3 + bob, 10, 4, '#c02a5a');
    rect(g, 10, 5 + bob, 3, 11, '#c02a5a');
    rect(g, 20, 5 + bob, 2, 8, '#c02a5a');
    px(g, 12, 7 + bob, '#c02a5a');
    // faixa dourada no pescoço
    rect(g, 12, 13 + bob, 8, 1, '#ffd23f');
    // chicote: cabo marrom, espiral de couro bem visível e a ponta solta balançando
    const sw = Math.round(Math.sin(t * 1.6)) | 0;
    rect(g, 5, 17 + bob, 2, 6, '#6a3a1a');
    rect(g, 4, 17 + bob, 4, 1, '#ffd23f');
    const ring: Array<[number, number]> = [];
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      ring.push([Math.round(4 + Math.cos(ang) * 3), Math.round(25 + Math.sin(ang) * 3)]);
    }
    for (const [x, y] of ring) rect(g, x, y + bob, 1, 1, '#e0b878');
    for (const [x, y] of ring.slice(2, 9)) px(g, x + 1, y + bob, '#8a5a2a');
    line(g, 6, 27 + bob, 8 + sw, 30, '#e0b878');
    px(g, 8 + sw, 30, '#ff3a4a');
    px(g, 9 + sw, 30, '#ff3a4a');
  },
  // Mara, a Caçadora: capuz verde, aljava nas costas e uma varinha com a ponta brilhando
  mara(g, L, bob, t, step) {
    body(g, L, bob, step);
    // capuz
    rect(g, 11, 3 + bob, 10, 4, '#2a6234');
    rect(g, 10, 5 + bob, 3, 8, '#2a6234');
    rect(g, 19, 5 + bob, 3, 8, '#2a6234');
    rect(g, 12, 3 + bob, 8, 1, '#3f8f4a');
    px(g, 15, 2 + bob, '#d9b36a');
    // aljava com flechas
    rect(g, 22, 10 + bob, 3, 9, '#6a4524');
    for (let i = 0; i < 3; i++) {
      px(g, 22 + i, 8 + bob, '#e8e0c0');
      px(g, 22 + i, 9 + bob, '#d94a4a');
    }
    // varinha: haste de madeira e estrela brilhante
    line(g, 4, 23 + bob, 8, 14 + bob, '#8a5a2a');
    line(g, 5, 23 + bob, 9, 14 + bob, '#6a4020');
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    orb(g, 8, 11 + bob, pulse > 0.8 ? '#7ffff0' : '#3fd8c8', '#ffffff');
    px(g, 8, 8 + bob, '#bffff8');
    px(g, 5, 11 + bob, '#bffff8');
    px(g, 11, 11 + bob, '#bffff8');
  },
  // Brann, o Guardião: elmo com pluma verde, armadura larga e um escudo redondo com um alho
  brann(g, L, bob, t, step) {
    body(g, L, bob, step);
    // elmo e pluma
    rect(g, 11, 3 + bob, 10, 5, '#aebccc');
    rect(g, 11, 7 + bob, 10, 1, '#55657a');
    rect(g, 12, 4 + bob, 8, 1, '#d8e4f0');
    for (let i = 0; i < 4; i++) rect(g, 14 + i, 0 + bob + (i % 2), 1, 4, '#4fbf5a');
    // ombreiras
    rect(g, 7, 12 + bob, 4, 3, '#aebccc');
    rect(g, 21, 12 + bob, 4, 3, '#aebccc');
    // escudo redondo na frente
    rect(g, 1, 14 + bob, 9, 11, '#3b5f84');
    rect(g, 0, 16 + bob, 11, 7, '#3b5f84');
    rect(g, 2, 15 + bob, 7, 9, '#4f7fb0');
    rect(g, 1, 14 + bob, 9, 1, '#f0c24a');
    rect(g, 1, 24 + bob, 9, 1, '#f0c24a');
    // alho no escudo
    rect(g, 4, 17 + bob, 3, 4, '#f4f0dc');
    px(g, 5, 16 + bob, '#f4f0dc');
    px(g, 5, 15 + bob, '#7fdc8a');
    px(g, 4, 21 + bob, '#cfc8a8');
    px(g, 6, 21 + bob, '#cfc8a8');
    // brilho verde de proteção
    const a = 0.5 + 0.5 * Math.sin(t * 2);
    if (a > 0.6) {
      px(g, 0, 13 + bob, '#7fdc8a');
      px(g, 10, 25 + bob, '#7fdc8a');
    }
  },
  // Dorian, o Alquimista: óculos de proteção, casaco roxo, avental e um frasco de lava borbulhando
  dorian(g, L, bob, t, step) {
    body(g, L, bob, step);
    // cabelo desgrenhado claro
    rect(g, 11, 3 + bob, 10, 3, '#efe6ff');
    px(g, 10, 5 + bob, '#efe6ff');
    px(g, 21, 5 + bob, '#efe6ff');
    px(g, 13, 2 + bob, '#efe6ff');
    px(g, 17, 2 + bob, '#efe6ff');
    // óculos na testa
    rect(g, 12, 5 + bob, 8, 2, '#3a2a1e');
    rect(g, 13, 5 + bob, 2, 2, '#7fe0ff');
    rect(g, 17, 5 + bob, 2, 2, '#7fe0ff');
    // avental
    rect(g, 12, 15 + bob, 8, 9, '#cdbb8e');
    rect(g, 12, 15 + bob, 8, 1, '#a89868');
    px(g, 14, 18 + bob, '#a89868');
    px(g, 18, 20 + bob, '#7a6a48');
    // frasco: bojo redondo, gargalo, rolha e lava com bolhas
    rect(g, 2, 17 + bob, 7, 7, '#9fd8f0');
    rect(g, 1, 19 + bob, 9, 3, '#9fd8f0');
    rect(g, 3, 19 + bob, 5, 4, '#ff6a1a');
    rect(g, 2, 21 + bob, 7, 2, '#ffb02e');
    rect(g, 4, 14 + bob, 3, 4, '#9fd8f0');
    rect(g, 4, 13 + bob, 3, 1, '#8a5a2a');
    const b = Math.round(t * 3) % 3;
    px(g, 3 + b, 19 + bob, '#ffe08a');
    px(g, 5, 16 + bob - (b % 2), '#ff6a1a');
  },
  // Selene, a Piromante: cabelo em chamas, túnica rubra e uma bola de fogo na mão
  selene(g, L, bob, t, step) {
    body(g, L, bob, step);
    const f = Math.round(Math.sin(t * 5)) | 0;
    // cabelo-chama
    rect(g, 11, 3 + bob, 10, 4, '#ff7a1a');
    rect(g, 10, 5 + bob, 3, 8, '#ff7a1a');
    rect(g, 20, 5 + bob, 2, 7, '#ff7a1a');
    px(g, 12, 2 + bob, '#ffd23f');
    px(g, 15, 1 + bob - f, '#ffd23f');
    px(g, 18, 2 + bob, '#ffd23f');
    px(g, 15, 2 + bob, '#ff7a1a');
    px(g, 10, 13 + bob, '#ffd23f');
    px(g, 11, 14 + bob, '#ffb02e');
    // gola dourada
    rect(g, 12, 13 + bob, 8, 1, '#ffb02e');
    // bola de fogo na mão da frente
    orb(g, 4, 16 + bob, '#ff7a1a', '#ffe08a');
    px(g, 4, 12 + bob - f, '#ffb02e');
    px(g, 3, 13 + bob, '#ffd23f');
    px(g, 5, 13 + bob, '#ff3a1a');
    px(g, 6, 14 + bob, '#ffd23f');
    rect(g, 3, 19 + bob, 3, 1, '#ffd23f');
  },
  // Ysolde, a Tempestade: cabelo prateado, capa índigo e um cajado com a lua crescente
  ysolde(g, L, bob, t, step) {
    body(g, L, bob, step);
    // cabelo prateado longo
    rect(g, 11, 3 + bob, 10, 4, '#e8f0ff');
    rect(g, 10, 5 + bob, 3, 12, '#e8f0ff');
    rect(g, 20, 5 + bob, 2, 10, '#e8f0ff');
    // capa com gola azul-clara
    rect(g, 9, 13 + bob, 14, 2, '#7fe0ff');
    rect(g, 22, 14 + bob, 3, 12, '#242f72');
    // cajado com lua crescente
    rect(g, 5, 11 + bob, 1, 18, '#8a6a3a');
    rect(g, 6, 11 + bob, 1, 18, '#6a4a22');
    const glow = Math.round(t * 2) % 2 === 0 ? '#fff6b8' : '#f4e9a0';
    rect(g, 3, 4 + bob, 5, 1, glow);
    rect(g, 2, 5 + bob, 2, 5, glow);
    rect(g, 3, 10 + bob, 5, 1, glow);
    rect(g, 4, 6 + bob, 1, 3, '#12182b');
    px(g, 7, 6 + bob, '#7fe0ff');
    px(g, 8, 8 + bob, '#7fe0ff');
    px(g, 1, 4 + bob, '#7fe0ff');
    // faíscas de raio
    if (Math.round(t * 4) % 2 === 0) {
      px(g, 9, 3 + bob, '#ffffff');
      px(g, 10, 4 + bob, '#7fe0ff');
    }
  },
  // Rurik, o Lenhador: barba cheia, gorro, camisa xadrez e um machado enorme no ombro
  rurik(g, L, bob, t, step) {
    body(g, L, bob, step);
    // camisa xadrez
    for (let x = 9; x < 23; x += 3) rect(g, x, 13 + bob, 1, 7, '#e8c070');
    rect(g, 9, 17 + bob, 14, 1, '#7a1a1a');
    // barba
    rect(g, 12, 10 + bob, 8, 5, '#7a4a22');
    rect(g, 13, 14 + bob, 6, 2, '#7a4a22');
    px(g, 15, 11 + bob, '#5a3416');
    // gorro marrom com pompom
    rect(g, 11, 3 + bob, 10, 3, '#5a3a1a');
    rect(g, 10, 5 + bob, 12, 1, '#3a2410');
    px(g, 15, 2 + bob, '#d94a4a');
    // machado: cabo grosso e lâmina larga em meia-lua
    line(g, 6, 28, 8, 8 + bob, '#8a5a2a', 2);
    rect(g, 1, 6 + bob, 7, 10, '#aebccc');
    rect(g, 0, 8 + bob, 2, 6, '#aebccc');
    rect(g, 2, 7 + bob, 5, 8, '#d8e4f0');
    rect(g, 7, 9 + bob, 3, 4, '#55657a');
    px(g, 3, 8 + bob, '#ffffff');
  },
};

function silhouetteOutline(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const q = c.getContext('2d')!;
  const s = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
  const out = q.createImageData(src.width, src.height);
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= src.width || y >= src.height ? 0 : s.data[(y * src.width + x) * 4 + 3]!;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (at(x, y) > 0) {
        out.data[i] = s.data[i]!;
        out.data[i + 1] = s.data[i + 1]!;
        out.data[i + 2] = s.data[i + 2]!;
        out.data[i + 3] = 255;
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        out.data[i] = 0x12;
        out.data[i + 1] = 0x18;
        out.data[i + 2] = 0x2b;
        out.data[i + 3] = 255;
      }
    }
  q.putImageData(out, 0, 0);
  return c;
}

/** Heróis que têm sprite próprio (o Kael usa o guerreiro original). */
export const CUSTOM_HEROES = Object.keys(DRAW);

/** Um quadro de 32x32 do herói. `die` deita o herói e escurece aos poucos. */
export function drawHeroFrame(id: string, pose: HeroPose): HTMLCanvasElement | null {
  const draw = DRAW[id];
  const L = LOOKS[id];
  if (!draw || !L) return null;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const { kind, frame } = pose;
  const bob = kind === 'idle' ? (frame % 2 === 0 ? 0 : -1) : kind === 'move' ? (frame % 2 === 0 ? 0 : -1) : 0;
  const step = kind === 'move' ? frame % 4 : 0;
  draw(g, L, bob, kind === 'idle' ? frame * 0.9 : frame * 0.5 + 1, step);
  const done = silhouetteOutline(c);
  if (kind !== 'die') return done;
  // morte: gira e deita no chão, escurecendo
  const d = document.createElement('canvas');
  d.width = 32;
  d.height = 32;
  const q = d.getContext('2d')!;
  q.imageSmoothingEnabled = false;
  q.translate(16, 28);
  q.rotate(-Math.PI / 2 + frame * 0.05);
  q.drawImage(done, -16, -28 + 4);
  q.globalCompositeOperation = 'source-atop';
  q.fillStyle = `rgba(20,10,20,${0.18 * frame})`;
  q.fillRect(0, 0, 32, 32);
  return d;
}
