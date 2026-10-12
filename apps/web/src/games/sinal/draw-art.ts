import type { ObstacleKind, SinalMapId } from '@nocap/games';

/**
 * A arte do Sinal Vermelho em Canvas 2D (protótipo aprovado em docs/reference/design-sinal-vermelho.html):
 * Pop Brutal, contorno de tinta, sombra dura, cores chapadas. Tudo é desenhado em "pixels de arte"
 * (30 por metro); a câmera só dá o zoom.
 */

export type Ctx = CanvasRenderingContext2D;
export const INK = '#111111';
export const PAPER = '#f4f4ef';
export const YEL = '#ffd23f';
export const ORG = '#ff6a2b';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const wrapY = (v: number, p: number) => ((v % p) + p) % p;

type PathFn = (c: Ctx) => void;

/** Forma com contorno de tinta e sombra dura, sem gradiente. */
export function blob(c: Ctx, path: PathFn, fill: string, lw = 3, sh = 3, shade = INK) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (sh) {
    c.save();
    c.translate(sh, sh);
    path(c);
    c.fillStyle = shade;
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
export function mono(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  size = 11,
  col = INK,
  align: CanvasTextAlign = 'left',
) {
  c.font = `700 ${size}px 'Space Mono', ui-monospace, monospace`;
  c.fillStyle = col;
  c.textAlign = align;
  c.fillText(text, x, y);
}
export function disp(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  size = 34,
  col = INK,
  align: CanvasTextAlign = 'left',
) {
  c.font = `900 ${size}px Archivo, 'Arial Black', system-ui, sans-serif`;
  c.fillStyle = col;
  c.textAlign = align;
  c.fillText(text, x, y);
}

/** O boneco padrão de cada mapa (a cor própria só existe no online). */
export const HERO_COLOR: Record<SinalMapId, string> = {
  horta: '#e5303a',
  neon: '#2f5bff',
  deserto: '#ff9d4d',
};

/** Nome, cores e identidade de cada mapa. */
export const MAP_STYLE: Record<
  SinalMapId,
  { name: string; vigia: string; hero: string; ember: string; dark: string; rim: string }
> = {
  horta: {
    name: 'Horta Maluca',
    vigia: 'Espantalho',
    hero: 'Tomate',
    ember: '#ffd23f',
    dark: '#0d1a12',
    rim: '#ffd23f',
  },
  neon: {
    name: 'Rua Neon',
    vigia: 'Semáforo',
    hero: 'Entregador',
    ember: '#25c7e8',
    dark: '#07071a',
    rim: '#25c7e8',
  },
  deserto: {
    name: 'Ruínas do Deserto',
    vigia: 'Totem Coruja',
    hero: 'Raposa',
    ember: '#ff9ecf',
    dark: '#1a0f24',
    rim: '#ff9ecf',
  },
};

// ---------------------------------------------------------------- construções da horta
/** Um número entre 0 e 1 que sempre sai igual para a mesma dupla (o mundo não muda ao rolar). */
export function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Percorre as "células" do mundo que aparecem na tela; a altura da célula `k` na tela é `y`. */
function scatter(scroll: number, vh: number, cell: number, margin: number, fn: (k: number, y: number) => void) {
  const k0 = Math.floor((-margin - scroll) / cell);
  const k1 = Math.ceil((vh + margin - scroll) / cell);
  for (let k = k0; k <= k1; k++) fn(k, k * cell + scroll);
}

const WALLS = ['#e5303a', '#f0a23a', '#f4f4ef', '#4f9bd9', '#e87fa6', '#b98a4a'];
const ROOFS = ['#8c3b2a', '#ffd23f', '#3a4a8c', '#2f6e57'];

/** Casinha, celeiro, silo, estufa e galpão: cinco jeitos, com cor e tamanho sorteados. */
function farmBuilding(c: Ctx, x: number, y: number, kind: number, size: number, pick: number, side: number) {
  const wall = WALLS[pick % WALLS.length]!;
  const roof = ROOFS[(pick + kind) % ROOFS.length]!;
  c.save();
  c.translate(x, y);
  c.scale(size * side, size);
  // sombra no chão
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath();
  c.ellipse(4, 26, 34, 8, 0, 0, 7);
  c.fill();
  if (kind === 0) {
    // casinha com chaminé, porta e janela
    blob(c, rect(14, -42, 9, 18, 2), '#9a9a92', 2.5, 0);
    blob(c, rect(-26, -14, 52, 38, 5), wall);
    blob(c, poly([[-32, -12], [0, -42], [32, -12]]), roof, 3, 0);
    blob(c, rect(-6, 6, 12, 18, 3), '#6b4a2b', 2.5, 0);
    blob(c, rect(-21, -4, 11, 11, 2), '#bfe6ff', 2.2, 0);
    blob(c, rect(10, -4, 11, 11, 2), '#bfe6ff', 2.2, 0);
  } else if (kind === 1) {
    // celeiro grande, de telhado quebrado e porta em X
    blob(c, rect(-34, -16, 68, 40, 4), '#c9302c');
    blob(c, poly([[-38, -14], [-24, -38], [24, -38], [38, -14]]), roof, 3, 0);
    blob(c, rect(-12, 0, 24, 24, 2), '#f4f4ef', 2.5, 0);
    line(c, -12, 0, 12, 24, 2.2);
    line(c, 12, 0, -12, 24, 2.2);
    blob(c, circle(0, -26, 4.5), '#f4f4ef', 2, 0);
  } else if (kind === 2) {
    // silo alto com cúpula e faixas
    blob(c, rect(-14, -40, 28, 64, 4), '#b9c2c8');
    blob(c, ell(0, -40, 14, 9), '#8f9aa1', 3, 0);
    line(c, -14, -22, 14, -22, 2.2);
    line(c, -14, -2, 14, -2, 2.2);
    blob(c, rect(-5, 10, 10, 14, 2), '#555', 2, 0);
    blob(c, rect(18, -2, 24, 26, 3), wall, 3, 0);
  } else if (kind === 3) {
    // estufa: vidro azulado com as nervuras
    blob(c, rect(-32, -10, 64, 34, 4), '#cdeffa');
    blob(c, poly([[-32, -10], [-20, -30], [20, -30], [32, -10]]), '#e6f8ff', 3, 0);
    for (const gx of [-16, 0, 16]) line(c, gx, -28, gx, 24, 1.8);
    line(c, -32, 4, 32, 4, 1.8);
    for (const [px, py] of [[-22, 14], [-6, 14], [10, 14], [24, 14]] as const) blob(c, circle(px, py, 4), '#49c26b', 1.8, 0);
  } else {
    // galpão baixo com feno empilhado
    blob(c, rect(-28, -6, 44, 30, 4), wall);
    blob(c, poly([[-32, -4], [-28, -22], [20, -16], [20, -4]]), roof, 3, 0);
    blob(c, rect(-18, 6, 20, 18, 2), '#6b4a2b', 2.2, 0);
    blob(c, ell(26, 16, 11, 9), '#e8c35c', 2.5, 0);
    blob(c, ell(26, 6, 9, 7), '#f0cf6a', 2.5, 0);
  }
  c.restore();
}

// ---------------------------------------------------------------- chão
/**
 * O chão rolando. Tudo é em coordenadas "virtuais" (vw x vh); `scroll` é quanto a câmera já andou
 * para a frente, em pixels de arte: o que está no chão desce quando o boneco avança.
 */
export function ground(
  c: Ctx,
  key: SinalMapId,
  scroll: number,
  vw: number,
  vh: number,
  half: number,
) {
  const cx = vw / 2;
  const L = cx - half;
  const R = cx + half;
  const rows = (period: number) => Math.ceil(vh / period) + 3;
  if (key === 'horta') {
    c.fillStyle = '#7ddc7a';
    c.fillRect(0, 0, vw, vh);
    for (let i = -1; i < rows(44); i++) {
      const y = -40 + wrapY(scroll, 44) + i * 44;
      const k = i - Math.floor(scroll / 44);
      const odd = ((k % 2) + 2) % 2 ? 15 : 0;
      for (let x = L - 30 - odd; x > -20; x -= 30) plant(c, x, y);
      for (let x = R + 30 + odd; x < vw + 20; x += 30) plant(c, x, y);
    }
    // As construções ao redor da horta: cada lado sorteia sozinho se tem uma, qual é, o tamanho,
    // a cor e a distância da pista (nada de par igual dos dois lados nem de fila certinha).
    scatter(scroll, vh, 230, 120, (k, y0) => {
      for (const side of [-1, 1] as const) {
        const r = (n: number) => hash(k * 2 + (side > 0 ? 1 : 0), n);
        if (r(1) > 0.62) continue;
        const reach = 45 + r(2) * Math.max(60, Math.min(cx - half - 90, 420));
        const x = cx + side * (half + reach);
        const y = y0 + (r(3) - 0.5) * 150;
        farmBuilding(c, x, y, Math.min(4, Math.floor(r(4) * 5)), 0.85 + r(5) * 0.5, Math.floor(r(6) * 4), side);
      }
    });
    c.fillStyle = '#f0cf94';
    c.fillRect(L, 0, R - L, vh);
    line(c, L, 0, L, vh, 3);
    line(c, R, 0, R, vh, 3);
    for (let i = 0; i < 26; i++) {
      const y = wrapY(i * 97 + scroll, vh + 30) - 15;
      const x = L + 18 + ((i * 53) % (R - L - 36));
      blob(c, ell(x, y, 5, 3.5), '#d4a867', 2, 2);
    }
    for (let i = -1; i < rows(120); i++) {
      const y = -20 + wrapY(scroll, 120) + i * 120;
      blob(c, ell(cx - 40, y, 5, 8), '#e3b878', 0.01, 0);
      blob(c, ell(cx - 20, y + 28, 5, 8), '#e3b878', 0.01, 0);
    }
  } else if (key === 'neon') {
    c.fillStyle = '#12153a';
    c.fillRect(0, 0, vw, vh);
    for (const side of [-1, 1]) {
      const edge = side < 0 ? L - 56 : R + 56;
      for (let k = -1; k < 8; k++) {
        const y = wrapY(k * 190 + scroll, 1520) - 190;
        const bw = 70 + ((k * 37 + 80) % 5) * 20;
        const bx = side < 0 ? edge - bw : edge;
        const col = ['#3a3f86', '#2c3170', '#4a3a86', '#2f4a86'][(((k + 4) % 4) + 4) % 4]!;
        blob(c, rect(bx, y, bw, 150, 6), col);
        for (let j = 0; j < 2; j++) blob(c, rect(bx + 10 + j * 28, y + 14, 18, 18), '#262b5e', 2.2, 0);
        if (((k % 2) + 2) % 2) blob(c, circle(bx + bw / 2, y + 100, 12), '#ff6a2b', 2.5, 0);
      }
    }
    c.fillStyle = '#2c3170';
    c.fillRect(L - 56, 0, 56, vh);
    c.fillRect(R, 0, 56, vh);
    c.fillStyle = '#262b5e';
    c.fillRect(L, 0, R - L, vh);
    line(c, L, 0, L, vh, 3);
    line(c, R, 0, R, vh, 3);
    for (let i = -1; i < rows(56); i++) {
      const y = -60 + wrapY(scroll, 56) + i * 56;
      c.fillStyle = '#ffd23f';
      c.fillRect(cx - 3, y, 6, 28);
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.strokeRect(cx - 3, y, 6, 28);
    }
    for (let k = 0; k < 3; k++) {
      const y = 140 + wrapY(scroll, 1100) - 1100 * k;
      if (y < -60 || y > vh + 20) continue;
      for (let x = L + 12; x < R - 14; x += 30) {
        c.fillStyle = PAPER;
        c.fillRect(x, y, 18, 46);
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.strokeRect(x, y, 18, 46);
      }
    }
    for (let k = -1; k < 5; k++) {
      const y = wrapY(k * 230 + scroll, 1150) - 120;
      for (const x of [L - 28, R + 28]) {
        c.save();
        c.globalAlpha = 0.3;
        c.fillStyle = '#ff6a2b';
        c.beginPath();
        c.arc(x, y, 44, 0, 7);
        c.fill();
        c.restore();
        blob(c, circle(x, y, 7), '#ffd23f', 2.5, 2);
      }
    }
    for (let i = 0; i < 9; i++) {
      const y = wrapY(i * 211 + scroll, vh + 60) - 30;
      const x = L + 30 + ((i * 83) % (R - L - 60));
      c.save();
      c.globalAlpha = 0.55;
      blob(c, ell(x, y, 22, 8), '#25c7e8', 2, 0);
      c.restore();
    }
  } else {
    c.fillStyle = '#f4c46c';
    c.fillRect(0, 0, vw, vh);
    for (let i = -1; i < rows(78); i++) {
      const y = -30 + wrapY(scroll * 0.6, 78) + i * 78;
      for (let x0 = 0; x0 < vw; x0 += 108) {
        if (x0 > L - 30 && x0 < R - 80) continue;
        c.beginPath();
        c.arc(x0 + 30, y + (x0 % 3) * 9, 34, Math.PI * 1.1, Math.PI * 1.9);
        c.lineWidth = 3;
        c.strokeStyle = '#d99b3f';
        c.stroke();
      }
    }
    for (let k = 0; k < 6; k++) {
      const y = wrapY(k * 360 + scroll * 0.9, 2160) - 200;
      for (const [x, w] of [[L - 54, 36], [R + 54, 30]] as const) {
        blob(c, rect(x - w / 2, y, w, w + 14, 8), '#8b79b8');
        blob(c, rect(x - w / 2 + 6, y + 6, w - 12, 8, 3), '#a595cf', 0.01, 0);
      }
    }
    c.fillStyle = '#f9deaa';
    c.fillRect(L, 0, R - L, vh);
    line(c, L, 0, L, vh, 3);
    line(c, R, 0, R, vh, 3);
    for (let i = -1; i < rows(64); i++) {
      const y = -64 + wrapY(scroll, 64) + i * 64;
      const row = i - Math.floor(scroll / 64);
      c.strokeStyle = '#c99a52';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(L, y);
      c.lineTo(R, y);
      c.stroke();
      const off = ((row % 2) + 2) % 2 ? 0 : 36;
      for (let x = L + off; x < R; x += 72) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 64);
        c.stroke();
      }
    }
    for (let i = 0; i < 10; i++) {
      const y = wrapY(i * 131 + scroll * 0.9, vh + 80) - 40;
      const x = i % 2 ? R + 20 + ((i * 17) % 40) : L - 20 - ((i * 13) % 40);
      blob(c, ell(x, y, 16, 11, 0.3), '#8b79b8', 2.5, 3);
      blob(c, ell(x - 3, y - 3, 7, 4, 0.3), '#a595cf', 0.01, 0);
    }
  }
}

function plant(c: Ctx, x: number, y: number) {
  blob(c, ell(x, y, 12, 7), '#4fb765', 2.5, 2);
  blob(c, star(x, y - 3, 6, 2.6, 5), '#2f9e57', 2, 0);
}

// ---------------------------------------------------------------- esconderijos
/** A zona do esconderijo: o anel mostra exatamente onde dá para se proteger. */
export function zoneRing(c: Ctx, x: number, y: number, active: boolean, t: number, dur: number) {
  const rx = 44;
  const ry = 36;
  c.save();
  c.setLineDash([9, 7]);
  c.lineDashOffset = -t * (active ? 14 : 4);
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 7);
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = active ? '#33c27f' : PAPER;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 7);
  c.stroke();
  c.setLineDash([]);
  if (active) {
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.beginPath();
    c.ellipse(x, y, rx + 8, ry + 8, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dur);
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = dur > 0.35 ? '#33c27f' : '#ff6a2b';
    c.beginPath();
    c.ellipse(x, y, rx + 8, ry + 8, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dur);
    c.stroke();
  }
  c.restore();
}

/**
 * A moita comprida: uma fileira de moitas de `yBot` (começo) até `yTop` (fim), com a zona desenhada
 * como uma cápsula (pontilhada; verde com a pessoa dentro, laranja quando está acabando).
 */
export function longCover(
  c: Ctx,
  key: SinalMapId,
  x: number,
  yBot: number,
  yTop: number,
  active: boolean,
  t: number,
  dur: number,
) {
  const R = 46;
  c.save();
  c.setLineDash([10, 8]);
  c.lineDashOffset = -t * (active ? 14 : 4);
  c.beginPath();
  c.roundRect(x - R, yTop - R, R * 2, yBot - yTop + R * 2, R);
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = active ? (dur > 0.35 ? '#33c27f' : '#ff6a2b') : PAPER;
  c.stroke();
  c.restore();
  const n = Math.max(2, Math.round((yBot - yTop) / 44) + 1);
  for (let i = 0; i < n; i++) {
    const py = yBot - (i * (yBot - yTop)) / (n - 1);
    c.save();
    c.translate(x + ((i % 2) * 2 - 1) * 4, py);
    c.scale(1.1, 1.1);
    cover(c, key, 0, 0, false, t, dur, false, true);
    c.restore();
  }
}

export function cover(
  c: Ctx,
  key: SinalMapId,
  x: number,
  y: number,
  active: boolean,
  t: number,
  dur = 1,
  fragile = false,
  noRing = false,
) {
  if (!noRing) zoneRing(c, x, y, active, t, dur);
  let dx = 0;
  if (dur < 0.4 && dur > 0) dx = Math.sin(t * 50) * 1.6 * (1 - dur / 0.4);
  c.save();
  c.translate(dx, 0);
  if (dur < 0.55) c.globalAlpha = 0.45 + dur * 0.8;
  if (key === 'horta') {
    blob(c, circle(x - 18, y + 6, 17), '#2f9e57');
    blob(c, circle(x + 18, y + 6, 17), '#2f9e57');
    blob(c, circle(x, y - 6, 21), '#49c26b');
    blob(c, circle(x, y + 8, 17), '#3aad60');
    for (const [ax, ay] of [[-8, -10], [10, -2], [-14, 6], [4, 10], [18, 8]] as const)
      blob(c, circle(x + ax, y + ay, 3.2), '#e5303a', 2, 0);
  } else if (key === 'neon') {
    blob(c, rect(x - 32, y - 22, 64, 44, 8), '#2fb8a0');
    blob(c, rect(x - 28, y - 18, 56, 14, 4), '#1f8f7c', 2.5, 0);
    line(c, x - 28, y + 4, x + 28, y + 4, 2.5);
    line(c, x - 28, y + 12, x + 28, y + 12, 2.5);
    blob(c, star(x + 16, y - 11, 5, 2, 5), '#ff9ecf', 1.8, 0);
    blob(c, circle(x - 26, y + 22, 4), '#3a3a36', 2, 0);
    blob(c, circle(x + 26, y + 22, 4), '#3a3a36', 2, 0);
  } else {
    blob(c, circle(x, y, 26), '#3aa96b');
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      line(c, x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a) * 24, y + Math.sin(a) * 24, 2.2, '#1f6e45');
    }
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 + 0.3;
      c.fillStyle = PAPER;
      c.beginPath();
      c.arc(x + Math.cos(a) * 17, y + Math.sin(a) * 17, 1.5, 0, 7);
      c.fill();
    }
    blob(c, star(x, y, 8, 3.6, 6, 0), '#ff9ecf', 2, 0);
  }
  if (fragile) {
    // rachaduras: este esconderijo aguenta pouco
    line(c, x - 10, y - 14, x - 2, y + 2, 2.2);
    line(c, x - 2, y + 2, x - 12, y + 14, 2.2);
  }
  c.restore();
  if (dur < 0.55 && dur > 0) {
    for (let i = 0; i < 4; i++) {
      const ph = (t * 1.3 + i * 0.37) % 1;
      c.fillStyle = key === 'deserto' ? '#c99a52' : '#c9a23a';
      c.beginPath();
      c.arc(x + (i - 1.5) * 12, y - 6 + ph * 30, 3, 0, 7);
      c.fill();
    }
  }
}

// ---------------------------------------------------------------- obstáculos
/**
 * Um obstáculo do caminho. Os sólidos (pequeno, médio, grande, deslizante, vaivém e mola) o boneco
 * contorna; lamaçal, esteira e ímã ficam no chão e agem em quem passa. `r` é o raio em pixels de arte
 * (o corpo, ou a zona nos de chão); `t` anima; `dir` é o lado da esteira.
 */
export function obstacle(
  c: Ctx,
  key: SinalMapId,
  kind: ObstacleKind,
  x: number,
  y: number,
  r: number,
  t = 0,
  dir = 1,
  bump = 0,
) {
  c.save();
  c.translate(x, y);
  if (kind === 'lamacal') zoneMud(c, key, r, t);
  else if (kind === 'esteira') zoneBelt(c, r, t, dir);
  else if (kind === 'ima') zoneMagnet(c, r, t);
  else if (kind === 'gelo') zoneIce(c, r, t);
  else if (kind === 'cola') zoneGlue(c, r, t);
  else if (kind === 'inversor') zoneInverter(c, r, t);
  else if (kind === 'turbina') zoneFan(c, r, t, dir);
  else {
    const s = (r * 1.15) / 15;
    c.scale(s, s);
    if (bump > 0) {
      // a pancada: o obstáculo amassa e treme (quanto maior o choque, mais)
      c.scale(1 + 0.3 * bump, 1 - 0.28 * bump);
      c.translate(Math.sin(t * 90) * 2.5 * bump, 0);
    }
    solid(c, key, kind, t);
  }
  c.restore();
}

/** Sombra no chão de todo sólido (dá peso e mostra onde está). */
function groundShadow(c: Ctx, rx: number, ry: number) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(3, 8, rx, ry, 0, 0, 7);
  c.fill();
  c.restore();
}

function solid(c: Ctx, key: SinalMapId, kind: ObstacleKind, t: number) {
  groundShadow(c, kind === 'grande' ? 24 : 15, kind === 'grande' ? 9 : 6);
  if (kind === 'serra') {
    // serra circular girando: fio de lâmina em volta, na cor do mapa
    const col = key === 'horta' ? '#b8c0c8' : key === 'neon' ? '#25c7e8' : '#d8b88f';
    c.save();
    c.rotate(t * 14);
    const pts: [number, number][] = [];
    for (let i = 0; i < 20; i++) {
      const rr = i % 2 ? 11 : 16;
      const an = (i * Math.PI) / 10;
      pts.push([Math.cos(an) * rr, Math.sin(an) * rr]);
    }
    blob(c, poly(pts), col, 2.6, 0);
    c.restore();
    blob(c, circle(0, 0, 5), '#3a3a36', 2.2, 0);
    blob(c, circle(0, 0, 1.8), '#f4f4ef', 0.01, 0);
    return;
  }
  if (kind === 'orbita') {
    if (key === 'horta') {
      // abelhona
      const flap = Math.sin(t * 40) * 3;
      blob(c, ell(-6, -9 - flap, 7, 4, -0.5), '#e8f6ff', 2, 0);
      blob(c, ell(6, -9 - flap, 7, 4, 0.5), '#e8f6ff', 2, 0);
      blob(c, ell(0, 0, 11, 8), '#ffd23f');
      line(c, -3, -7, -3, 7, 3);
      line(c, 3, -7, 3, 7, 3);
      blob(c, circle(10, 0, 3.5), '#111111', 1, 0);
    } else if (key === 'neon') {
      // mina flutuante
      for (let i = 0; i < 8; i++) {
        const an = (i * Math.PI) / 4 + t;
        line(c, Math.cos(an) * 9, Math.sin(an) * 9, Math.cos(an) * 15, Math.sin(an) * 15, 3.4);
      }
      blob(c, circle(0, 0, 10), '#1d1d2b');
      blob(c, circle(0, 0, 4), Math.sin(t * 8) > 0 ? '#e5303a' : '#7a1d24', 1.6, 0);
    } else {
      // orbe de energia rosa
      blob(c, circle(0, 0, 13), '#ff9ecf');
      blob(c, circle(0, 0, 7), '#ffd23f', 2, 0);
      c.save();
      c.rotate(t * 3);
      c.strokeStyle = INK;
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(0, 0, 17, 6, 0, 0, 7);
      c.stroke();
      c.restore();
    }
    return;
  }
  if (key === 'horta') {
    if (kind === 'pequeno') {
      blob(c, ell(0, 0, 14, 11, 0.3), '#8f9692');
      blob(c, ell(-4, -4, 6, 3.5, 0.3), '#b4bbb7', 0.01, 0);
    } else if (kind === 'medio') {
      blob(c, ell(-8, 0, 10, 13), '#ff8a2b');
      blob(c, ell(8, 0, 10, 13), '#ff8a2b');
      blob(c, ell(0, 0, 11, 14), '#ff6a2b');
      blob(c, rect(-2, -20, 5, 9, 2), '#2f9e57', 2.5, 0);
    } else if (kind === 'grande') {
      // fardo de feno enorme
      blob(c, circle(0, 0, 20), '#e8c35c');
      blob(c, circle(0, 0, 12), '#f0cf6a', 2.2, 0);
      blob(c, circle(0, 0, 5), '#c99a3c', 2, 0);
      line(c, -20, 0, 20, 0, 2.4, '#b5242d');
    } else if (kind === 'deslizante') {
      // carrinho de mão cheio de tomates
      blob(c, poly([[-18, -6], [18, -6], [13, 10], [-13, 10]]), '#7a8794');
      for (const [bx, by] of [[-8, -10], [2, -12], [10, -9]] as const) blob(c, circle(bx, by, 5), '#e5303a', 2, 0);
      blob(c, circle(0, 12, 6), '#3a3a36', 2.5, 0);
      line(c, 15, -4, 26, -12, 3);
    } else if (kind === 'vaivem') {
      // barril rolando: as tábuas giram
      blob(c, rect(-11, -14, 22, 28, 8), '#c9824a');
      const k = Math.sin(t * 6) * 3;
      line(c, -11, -5 + k * 0.2, 11, -5 + k * 0.2, 2.4);
      line(c, -11, 5 - k * 0.2, 11, 5 - k * 0.2, 2.4);
      line(c, 0, -14, 0, 14, 1.8, '#a9672f');
    } else {
      // cogumelo de mola
      blob(c, rect(-5, -2, 10, 14, 3), '#f4f4ef', 2.5, 0);
      const sq = 1 + Math.sin(t * 5) * 0.06;
      c.save();
      c.scale(1 / sq, sq);
      blob(c, ell(0, -6, 17, 12), '#e5303a');
      for (const [bx, by] of [[-8, -8], [3, -12], [9, -5]] as const) blob(c, circle(bx, by, 2.8), '#f4f4ef', 1.6, 0);
      c.restore();
    }
  } else if (key === 'neon') {
    if (kind === 'pequeno') {
      blob(c, poly([[0, -14], [9, 10], [-9, 10]]), '#ff6a2b');
      line(c, -4, -2, 4, -2, 3, PAPER);
      line(c, -6.5, 4, 6.5, 4, 3, PAPER);
      blob(c, rect(-11, 9, 22, 5, 2.5), '#1d1d2b', 2.2, 0);
    } else if (kind === 'medio') {
      blob(c, circle(0, 0, 14), '#e5303a');
      blob(c, circle(0, 0, 8), '#b5242d', 2.5, 0);
      line(c, -10, -3, 10, -3, 2);
      line(c, -10, 3, 10, 3, 2);
    } else if (kind === 'grande') {
      // carro parado
      blob(c, rect(-22, -12, 44, 26, 8), '#2f5bff');
      blob(c, rect(-14, -8, 28, 12, 4), '#bfe6ff', 2.2, 0);
      blob(c, circle(-15, 13, 5), '#1d1d2b', 2.2, 0);
      blob(c, circle(15, 13, 5), '#1d1d2b', 2.2, 0);
      blob(c, circle(-17, -12, 3), '#ffd23f', 1.8, 0);
      blob(c, circle(17, -12, 3), '#ffd23f', 1.8, 0);
    } else if (kind === 'deslizante') {
      // drone com hélices girando
      blob(c, circle(0, 0, 9), '#1d1d2b');
      blob(c, circle(0, 0, 4), '#e5303a', 1.8, 0);
      for (const [dx, dy] of [[-14, -10], [14, -10], [-14, 10], [14, 10]] as const) {
        line(c, 0, 0, dx, dy, 2.4);
        c.save();
        c.translate(dx, dy);
        c.rotate(t * 24);
        line(c, -8, 0, 8, 0, 3, '#25c7e8');
        c.restore();
      }
    } else if (kind === 'vaivem') {
      blob(c, rect(-11, -14, 22, 28, 6), '#3a3f86');
      line(c, -11, -5, 11, -5, 2.4, '#ffd23f');
      line(c, -11, 5, 11, 5, 2.4, '#ffd23f');
      blob(c, star(0, 0, 5, 2.2, 5), '#25c7e8', 1.6, 0);
    } else {
      // trampolim
      blob(c, rect(-16, 2, 32, 8, 3), '#1d1d2b');
      const up = Math.abs(Math.sin(t * 5)) * 4;
      blob(c, rect(-14, -8 - up, 28, 7, 3), '#ffd23f');
      line(c, -9, 2, -9, -1 - up, 2.2);
      line(c, 9, 2, 9, -1 - up, 2.2);
      line(c, 0, 2, 0, -1 - up, 2.2);
    }
  } else if (kind === 'pequeno') {
    blob(c, ell(0, 0, 14, 11, -0.3), '#8b79b8');
    blob(c, ell(-4, -4, 6, 3.5, -0.3), '#a595cf', 0.01, 0);
  } else if (kind === 'medio') {
    blob(c, rect(-5, -16, 10, 32, 5), '#3aa96b');
    blob(c, rect(-16, -6, 9, 5, 2.5), '#3aa96b', 2.5, 0);
    blob(c, rect(7, -11, 9, 5, 2.5), '#3aa96b', 2.5, 0);
    blob(c, star(0, -16, 4, 2, 5), '#ff9ecf', 1.6, 0);
  } else if (kind === 'grande') {
    // pilar de ruína com o topo quebrado
    blob(c, rect(-16, -6, 32, 22, 4), '#c9a37a');
    blob(c, poly([[-12, -6], [-8, -22], [-2, -12], [4, -26], [12, -6]]), '#d8b88f', 3, 0);
    line(c, -16, 5, 16, 5, 2.2);
    blob(c, circle(-6, 10, 2.4), '#a9825a', 1.6, 0);
  } else if (kind === 'deslizante') {
    // escorpião
    blob(c, ell(0, 2, 12, 8), '#6b3fa0');
    blob(c, ell(0, -5, 6, 5), '#8a5ac0', 2.4, 0);
    line(c, -12, 2, -20, -4, 2.6);
    line(c, 12, 2, 20, -4, 2.6);
    c.save();
    c.beginPath();
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.moveTo(0, 8);
    c.quadraticCurveTo(14, 18, 10, 2 + Math.sin(t * 8) * 3);
    c.stroke();
    c.restore();
    blob(c, circle(10, 2 + Math.sin(t * 8) * 3, 3), '#ff9ecf', 1.6, 0);
  } else if (kind === 'vaivem') {
    // bola de feno rolando
    c.save();
    c.rotate(t * 5);
    blob(c, circle(0, 0, 13), '#d9a85a');
    for (let i = 0; i < 5; i++) {
      const an = (i * Math.PI * 2) / 5;
      line(c, 0, 0, Math.cos(an) * 12, Math.sin(an) * 12, 1.8, '#a9782f');
    }
    c.restore();
  } else {
    // flor de mola
    blob(c, rect(-3, -2, 6, 14, 3), '#3aa96b', 2.2, 0);
    const sq = 1 + Math.sin(t * 5) * 0.08;
    c.save();
    c.scale(sq, 1 / sq);
    for (let i = 0; i < 6; i++) {
      const an = (i * Math.PI * 2) / 6;
      blob(c, circle(Math.cos(an) * 9, -8 + Math.sin(an) * 7, 6), '#ff9ecf', 2, 0);
    }
    blob(c, circle(0, -8, 5), '#ffd23f', 2, 0);
    c.restore();
  }
}

/** Gelo: a placa branca-azulada, rachada e cintilando; quem pisa escorrega sem parar. */
function zoneIce(c: Ctx, r: number, t: number) {
  c.save();
  blob(c, ell(0, 0, r, r * 0.84), '#bfeaff', 3, 3);
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.84, 0, 0, 7);
  c.clip();
  c.strokeStyle = 'rgba(255,255,255,.95)';
  c.lineWidth = 2.6;
  for (const [x1, y1, x2, y2] of [[-0.7, -0.2, 0.2, 0.1], [0.2, 0.1, 0.5, 0.6], [-0.2, 0.5, 0.1, 0.1], [0.2, 0.1, 0.7, -0.3]] as const) {
    c.beginPath();
    c.moveTo(x1 * r, y1 * r);
    c.lineTo(x2 * r, y2 * r);
    c.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    c.globalAlpha = tw;
    c.fillStyle = '#ffffff';
    const sx = Math.cos(i * 2.3) * r * 0.55;
    const sy = Math.sin(i * 1.9) * r * 0.45;
    c.fillRect(sx - 1.5, sy - 5, 3, 10);
    c.fillRect(sx - 5, sy - 1.5, 10, 3);
  }
  c.restore();
}

/** Cola: gosma roxa com fios e bolhas: os comandos demoram a responder. */
function zoneGlue(c: Ctx, r: number, t: number) {
  c.save();
  blob(c, ell(0, 0, r, r * 0.84), '#b44fd0', 3, 3);
  c.globalAlpha = 0.7;
  c.fillStyle = '#e29bf0';
  for (let i = 0; i < 5; i++) {
    const bx = Math.cos(i * 1.9 + 0.5) * r * 0.5;
    const by = Math.sin(i * 2.3) * r * 0.35;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.1);
    c.beginPath();
    c.arc(bx, by - pulse * 3, 4 + pulse * 4, 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  c.strokeStyle = '#7a2a90';
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(-r * 0.4, 0);
  c.quadraticCurveTo(0, -r * 0.2 + Math.sin(t * 3) * 4, r * 0.4, 0);
  c.stroke();
  c.restore();
}

/** Inversor: anel azul com duas setas que se cruzam: os controles trocam. */
function zoneInverter(c: Ctx, r: number, t: number) {
  c.save();
  blob(c, ell(0, 0, r, r * 0.84), '#1f9fb8', 3, 3);
  c.strokeStyle = '#f4f4ef';
  c.lineWidth = 4;
  c.setLineDash([10, 8]);
  c.lineDashOffset = -t * 20;
  c.beginPath();
  c.ellipse(0, 0, r * 0.62, r * 0.5, 0, 0, 7);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#f4f4ef';
  c.strokeStyle = INK;
  c.lineWidth = 2.4;
  for (const dir of [-1, 1]) {
    const y = dir * 11;
    c.beginPath();
    c.moveTo(-dir * 22, y - 5);
    c.lineTo(dir * 8, y - 5);
    c.lineTo(dir * 8, y - 12);
    c.lineTo(dir * 24, y);
    c.lineTo(dir * 8, y + 12);
    c.lineTo(dir * 8, y + 5);
    c.lineTo(-dir * 22, y + 5);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();
}

/** Turbina: um ventilador girando, com setas na direção em que ela empurra (para a frente ou para trás). */
function zoneFan(c: Ctx, r: number, t: number, dir: number) {
  c.save();
  blob(c, ell(0, 0, r, r * 0.84), '#5a6470', 3, 3);
  c.save();
  c.rotate(t * 16 * dir);
  for (let i = 0; i < 4; i++) {
    c.rotate(Math.PI / 2);
    blob(c, ell(r * 0.3, 0, r * 0.28, r * 0.1, 0.3), '#d8dde3', 2, 0);
  }
  c.restore();
  blob(c, circle(0, 0, 7), '#3a3a36', 2.2, 0);
  // setas: para cima na tela empurra para a frente (dir 1), para baixo empurra para trás
  c.fillStyle = dir > 0 ? '#33c27f' : '#e5303a';
  c.strokeStyle = INK;
  c.lineWidth = 2;
  const off = ((t * 30) % 24) * -dir;
  for (let k = -1; k <= 1; k++) {
    const yy = k * 24 + off;
    c.beginPath();
    c.moveTo(-8, yy + 5 * -dir * -1);
    c.lineTo(0, yy - 7 * dir);
    c.lineTo(8, yy + 5 * -dir * -1);
    c.lineTo(0, yy + 1 * -dir * -1);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** Lamaçal / piche / areia movediça: a zona escura que deixa o boneco devagar. */
function zoneMud(c: Ctx, key: SinalMapId, r: number, t: number) {
  const col = key === 'horta' ? '#6b4a2b' : key === 'neon' ? '#1a1030' : '#b98a4a';
  const hi = key === 'horta' ? '#8a6238' : key === 'neon' ? '#5a2fb0' : '#d9a85a';
  c.save();
  c.globalAlpha = 0.95;
  blob(c, ell(0, 0, r, r * 0.86), col, 3, 3);
  c.globalAlpha = 0.6;
  c.strokeStyle = hi;
  c.lineWidth = 3;
  for (let i = 1; i <= 3; i++) {
    const k = ((t * 0.35 + i / 3) % 1);
    c.globalAlpha = 0.6 * (1 - k);
    c.beginPath();
    c.ellipse(0, 0, r * (0.25 + 0.7 * k), r * 0.86 * (0.25 + 0.7 * k), 0, 0, 7);
    c.stroke();
  }
  c.globalAlpha = 0.9;
  for (let i = 0; i < 4; i++) {
    const bx = Math.cos(i * 1.7 + 0.4) * r * 0.45;
    const by = Math.sin(i * 2.1) * r * 0.32;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
    c.fillStyle = hi;
    c.beginPath();
    c.arc(bx, by, 3 + pulse * 3, 0, 7);
    c.fill();
  }
  c.restore();
}

/** Esteira: setas que correm para o lado em que ela empurra. */
function zoneBelt(c: Ctx, r: number, t: number, dir: number) {
  c.save();
  blob(c, ell(0, 0, r, r * 0.7), '#3a3f4a', 3, 3);
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.7, 0, 0, 7);
  c.clip();
  c.fillStyle = '#ffd23f';
  const step = 26;
  const off = ((t * 40) % step) * dir;
  for (let x = -r - step; x <= r + step; x += step) {
    const cx = x + off;
    c.beginPath();
    c.moveTo(cx - 8 * dir, -12);
    c.lineTo(cx + 6 * dir, 0);
    c.lineTo(cx - 8 * dir, 12);
    c.lineTo(cx - 3 * dir, 0);
    c.closePath();
    c.fill();
  }
  c.restore();
  c.save();
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.7, 0, 0, 7);
  c.stroke();
  c.restore();
}

/** Ímã: anéis que se fecham para dentro e o ímã em U no meio. */
function zoneMagnet(c: Ctx, r: number, t: number) {
  c.save();
  for (let i = 0; i < 3; i++) {
    const k = 1 - ((t * 0.5 + i / 3) % 1);
    c.globalAlpha = 0.65 * k;
    c.lineWidth = 3;
    c.strokeStyle = '#e5303a';
    c.setLineDash([10, 8]);
    c.beginPath();
    c.arc(0, 0, r * (0.3 + 0.7 * k), 0, 7);
    c.stroke();
  }
  c.setLineDash([]);
  c.globalAlpha = 1;
  // o ímã em U
  c.lineWidth = 9;
  c.lineCap = 'butt';
  c.strokeStyle = INK;
  c.beginPath();
  c.arc(0, 2, 10, 0, Math.PI);
  c.moveTo(-10, 2);
  c.lineTo(-10, -10);
  c.moveTo(10, 2);
  c.lineTo(10, -10);
  c.stroke();
  c.lineWidth = 5;
  c.strokeStyle = '#e5303a';
  c.beginPath();
  c.arc(0, 2, 10, 0, Math.PI);
  c.moveTo(-10, 2);
  c.lineTo(-10, -10);
  c.moveTo(10, 2);
  c.lineTo(10, -10);
  c.stroke();
  c.fillStyle = PAPER;
  c.fillRect(-12.5, -12, 5, 5);
  c.fillRect(7.5, -12, 5, 5);
  c.restore();
}

// ---------------------------------------------------------------- bonecos
export function hero(c: Ctx, key: SinalMapId, x: number, y: number, t: number, walking: boolean, alpha: number, col: string) {
  const s = walking ? Math.sin(t * 11) : 0;
  const bob = walking ? Math.abs(Math.sin(t * 11)) * 1.6 : 0;
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y - bob);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.ellipse(2, 12 + bob, 15, 7, 0, 0, 7);
  c.fill();
  if (key === 'horta') {
    blob(c, ell(-8, -10 - s * 5, 5, 8), '#f4f4ef', 2.2, 0);
    blob(c, ell(8, -10 + s * 5, 5, 8), '#f4f4ef', 2.2, 0);
    blob(c, circle(0, 0, 15), col);
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath();
    c.ellipse(-6, -6, 4, 2.5, -0.6, 0, 7);
    c.fill();
    blob(c, star(0, -1, 9, 3.6, 5), '#1f8f54', 2.4, 0);
  } else if (key === 'neon') {
    blob(c, rect(-12, 4, 24, 20, 5), '#ff6a2b');
    line(c, -12, 14, 12, 14, 2);
    blob(c, ell(0, 0, 16, 10), col);
    blob(c, circle(-14, -3 + s * 4, 4), '#f4f4ef', 2, 0);
    blob(c, circle(14, -3 - s * 4, 4), '#f4f4ef', 2, 0);
    blob(c, circle(0, -3, 10.5), '#ffd23f', 3, 0);
    c.fillStyle = PAPER;
    c.fillRect(-2, -13, 4, 20);
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.strokeRect(-2, -13, 4, 20);
  } else {
    blob(c, ell(0, 16, 6, 10 + Math.abs(s) * 2), col, 2.6, 0);
    blob(c, circle(0, 24 + Math.abs(s) * 2, 4), '#f4f4ef', 2, 0);
    blob(c, circle(-6, 2 + s * 3, 4.5), '#8b5a2b', 2, 0);
    blob(c, circle(6, 2 - s * 3, 4.5), '#8b5a2b', 2, 0);
    blob(c, circle(0, 0, 13), col);
    blob(c, poly([[-12, -4], [-8, -22], [-2, -10]]), col, 2.6, 0);
    blob(c, poly([[12, -4], [8, -22], [2, -10]]), col, 2.6, 0);
    c.fillStyle = '#ff9ecf';
    c.beginPath();
    c.moveTo(-9, -9);
    c.lineTo(-8, -17);
    c.lineTo(-5, -11);
    c.fill();
    c.beginPath();
    c.moveTo(9, -9);
    c.lineTo(8, -17);
    c.lineTo(5, -11);
    c.fill();
  }
  c.restore();
}

/** Silhueta de quem está escondido: só a sombra do boneco, com a cor dele no contorno. */
export function silhouette(c: Ctx, x: number, y: number, col: string) {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(17,17,17,.88)';
  c.beginPath();
  c.ellipse(0, 4, 13, 16, 0, 0, 7);
  c.fill();
  c.beginPath();
  c.arc(0, -8, 8, 0, 7);
  c.fill();
  c.lineWidth = 2.6;
  c.strokeStyle = col;
  c.beginPath();
  c.ellipse(0, 4, 13, 16, 0, 0, 7);
  c.stroke();
  c.beginPath();
  c.arc(0, -8, 8, 0, 7);
  c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- Vigia (vista frontal, preso ao topo)
/**
 * `face` 0 = de costas, 1 = olhando (gira como um cartão); `warn` 0 a 1 é o aviso (com ele ainda de
 * costas); `tx` é o x do boneco (a pupila acompanha).
 */
export function vigia(
  c: Ctx,
  key: SinalMapId,
  face: number,
  warn: number,
  t: number,
  tx: number,
  cx: number,
  top: number,
  sc: number,
) {
  const sx = Math.cos(face * Math.PI);
  const front = sx < 0;
  const w = Math.max(0.04, Math.abs(sx));
  c.save();
  c.translate(cx, top);
  c.scale(sc, sc);
  const shake = warn > 0 && !front ? Math.sin(t * 40) * warn * 1.4 : 0;
  c.translate(shake, 0);
  const look = clamp((tx - cx) / 120, -1, 1);
  if (key === 'neon') {
    blob(c, rect(-7, 70, 14, 60, 3), '#5a5a66', 3, 0);
    c.save();
    c.scale(w, 1);
    blob(c, rect(-44, 6, 88, 112, 16), '#1d1d2b', 4, 4);
    if (front) {
      for (let i = 0; i < 3; i++) {
        const y = 36 + i * 32;
        const on = i === 0;
        blob(c, rect(-30, y - 17, 60, 8, 3), '#3a3a56', 2.5, 0);
        blob(c, circle(0, y + 3, 14), on ? '#e5303a' : '#3a2a2a', 3, 0);
      }
      c.fillStyle = '#ff7b7b';
      c.beginPath();
      c.arc(0, 39, 8, 0, 7);
      c.fill();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(look * 4, 39, 4.2, 0, 7);
      c.fill();
      c.save();
      c.globalAlpha = 0.35;
      c.fillStyle = '#e5303a';
      c.beginPath();
      c.arc(0, 39, 26, 0, 7);
      c.fill();
      c.restore();
    } else {
      blob(c, rect(-34, 18, 68, 86, 10), '#2a2a3d', 2.5, 0);
      for (const [px, py] of [[-26, 26], [26, 26], [-26, 96], [26, 96]] as const) blob(c, circle(px, py, 3), '#5a5a66', 1.8, 0);
      const rate = 2 + warn * 14;
      const on = warn > 0 && Math.sin(t * rate * 2) > -0.2;
      blob(c, circle(0, 60, 11), on ? '#ffb020' : '#5a4420', 3, 0);
      if (on) {
        c.save();
        c.globalAlpha = 0.45 * warn + 0.15;
        c.fillStyle = '#ffb020';
        c.beginPath();
        c.arc(0, 60, 30, 0, 7);
        c.fill();
        c.restore();
      }
      mono(c, 'NÃO ATRAVESSE', 0, 92, 8.5, '#ffd23f', 'center');
    }
    c.restore();
  } else if (key === 'horta') {
    blob(c, rect(-5, 60, 10, 80, 3), '#8a5a2b', 3, 0);
    blob(c, rect(-62, 66, 124, 11, 4), '#a8702f');
    for (const sgn of [-1, 1]) for (let i = 0; i < 4; i++) line(c, sgn * (56 + i * 2), 72, sgn * (66 + i * 3), 88 + i * 3, 2.4, '#e5b94d');
    c.save();
    c.scale(w, 1);
    blob(c, circle(0, 40, 30), '#d7b56d', 3.5, 4);
    if (front) {
      for (const sgn of [-1, 1]) {
        blob(c, circle(sgn * 12, 38, 8), '#f4f4ef', 2.8, 0);
        c.fillStyle = INK;
        c.beginPath();
        c.arc(sgn * 12 + look * 3, 38, 3.6, 0, 7);
        c.fill();
        c.save();
        c.globalAlpha = 0.35;
        c.fillStyle = '#ff6a2b';
        c.beginPath();
        c.arc(sgn * 12, 38, 17, 0, 7);
        c.fill();
        c.restore();
      }
      c.beginPath();
      c.moveTo(-14, 56);
      for (let i = 0; i <= 6; i++) c.lineTo(-14 + i * 4.7, 56 + (i % 2 ? 4 : -2));
      c.lineWidth = 2.8;
      c.strokeStyle = INK;
      c.stroke();
    } else {
      line(c, 0, 12, 0, 68, 3, INK);
      for (let i = 0; i < 6; i++) line(c, -7, 20 + i * 8, 7, 20 + i * 8, 2.2, INK);
      if (warn > 0) {
        c.save();
        c.globalAlpha = 0.25 + 0.6 * warn * (0.6 + 0.4 * Math.sin(t * (4 + warn * 14)));
        c.strokeStyle = '#ff6a2b';
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(0, 12);
        c.lineTo(0, 68);
        c.stroke();
        c.restore();
      }
    }
    const tilt = !front && warn > 0 ? -0.12 * warn : 0;
    c.save();
    c.translate(0, 20);
    c.rotate(tilt);
    blob(c, ell(0, 4, 50, 11), '#c98a3a', 3.5, 3);
    blob(c, rect(-22, -18, 44, 24, 9), '#d89a45', 3.5, 0);
    line(c, -22, -2, 22, -2, 6, '#b5242d');
    c.restore();
    c.restore();
  } else {
    c.save();
    c.scale(w, 1);
    blob(c, rect(-40, 14, 80, 106, 28), '#6b5b95', 4, 4);
    blob(c, poly([[-36, 24], [-30, 0], [-14, 18]]), '#6b5b95', 3.5, 0);
    blob(c, poly([[36, 24], [30, 0], [14, 18]]), '#6b5b95', 3.5, 0);
    if (front) {
      for (const sgn of [-1, 1]) {
        blob(c, circle(sgn * 16, 52, 15), '#f4f4ef', 3, 0);
        blob(c, circle(sgn * 16 + look * 3, 52, 8.5), '#ff9ecf', 2.4, 0);
        c.fillStyle = INK;
        c.beginPath();
        c.arc(sgn * 16 + look * 4, 52, 4, 0, 7);
        c.fill();
        c.save();
        c.globalAlpha = 0.3;
        c.fillStyle = '#ff9ecf';
        c.beginPath();
        c.arc(sgn * 16, 52, 24, 0, 7);
        c.fill();
        c.restore();
      }
      blob(c, poly([[-6, 66], [6, 66], [0, 80]]), '#ffd23f', 2.6, 0);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          c.beginPath();
          c.arc(-14 + j * 14, 92 + i * 8, 6, 0, Math.PI);
          c.lineWidth = 2.2;
          c.strokeStyle = '#4a3d6e';
          c.stroke();
        }
    } else {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          c.beginPath();
          c.arc(-24 + j * 16 + (i % 2) * 8, 36 + i * 17, 8, 0, Math.PI);
          c.lineWidth = 2.4;
          c.strokeStyle = '#4a3d6e';
          c.stroke();
        }
      const g = warn * (0.55 + 0.45 * Math.sin(t * (3 + warn * 16)));
      blob(c, rect(-10, 52, 20, 26, 8), g > 0.05 ? '#2d1d52' : '#4a3d6e', 2.6, 0);
      c.strokeStyle = `rgba(255,158,207,${0.25 + 0.75 * g})`;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 56);
      c.lineTo(0, 74);
      c.moveTo(-5, 62);
      c.lineTo(5, 62);
      c.moveTo(-5, 70);
      c.lineTo(5, 70);
      c.stroke();
      if (g > 0.15) {
        c.save();
        c.globalAlpha = g * 0.5;
        c.fillStyle = '#ff9ecf';
        c.beginPath();
        c.arc(0, 65, 26, 0, 7);
        c.fill();
        c.restore();
      }
    }
    c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------- escuridão
/**
 * Um escurecimento leve no pé da tela quando a escuridão está perto (`intensity` de 0 a 1). Sem
 * nuvens: quem mostra a escuridão é a borda desenhada em `darkness`.
 */
export function fogHaze(c: Ctx, w: number, h: number, intensity: number, _t: number, style: { dark: string; ember: string; rim: string }) {
  if (intensity <= 0.02) return;
  const reach = h * (0.08 + 0.2 * intensity);
  c.save();
  const g = c.createLinearGradient(0, h, 0, h - reach);
  g.addColorStop(0, hexA(style.dark, 0.55 * intensity));
  g.addColorStop(1, hexA(style.dark, 0));
  c.fillStyle = g;
  c.fillRect(0, h - reach, w, reach);
  c.restore();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/**
 * A escuridão sobe de baixo: um monstro de tinta com borda de línguas pontudas que balançam, contorno
 * grosso, brasas e olhos que piscam lá dentro. `top` é a altura (px da tela) da borda; `look` é a
 * distância (px) a partir da qual ela já espia no pé da tela, para dar tempo de ver que vem aí.
 */
export function darkness(
  c: Ctx,
  w: number,
  h: number,
  top: number,
  t: number,
  style: { dark: string; ember: string; rim: string },
  look = 320,
) {
  // Ainda fora da tela: só uma borda que sobe aos poucos (e pulsa) avisando que está chegando.
  const near = top >= h ? clamp(1 - (top - h) / look, 0, 1) : 1;
  if (near <= 0) return;
  const peek = 12 * near;
  const base = Math.min(top, h - peek);
  const tongue = (x: number) => {
    const cell = 58;
    const idx = Math.floor((x + 20) / cell);
    const u = ((x + 20) - idx * cell) / cell;
    const tri = 1 - Math.abs(u * 2 - 1);
    const size = 5 + 8 * ((idx * 0.618 + 0.3) % 1);
    return Math.pow(tri, 1.3) * size * (0.8 + 0.2 * Math.sin(t * 3 + idx * 1.7));
  };
  const edge = (x: number) =>
    base + Math.sin(x * 0.035 + t * 1.6) * 6 + Math.sin(x * 0.09 - t * 2.3) * 3 - tongue(x);
  const path = (dy = 0) => {
    c.beginPath();
    c.moveTo(0, h + 10);
    for (let x = 0; x <= w + 4; x += 4) c.lineTo(x, edge(x) + dy);
    c.lineTo(w, h + 10);
    c.closePath();
  };
  c.save();
  // a sombra que vai na frente da borda (mais clara, dá volume)
  c.globalAlpha = 0.4;
  c.fillStyle = style.dark;
  path(-14);
  c.fill();
  c.globalAlpha = 1;
  // o corpo, mais escuro quanto mais fundo
  const g = c.createLinearGradient(0, base - 30, 0, h);
  g.addColorStop(0, style.dark);
  g.addColorStop(1, '#000000');
  c.fillStyle = g;
  path();
  c.fill();
  // contorno de tinta e a borda brilhante na cor do mapa
  c.lineJoin = 'round';
  c.lineWidth = 9;
  c.strokeStyle = INK;
  c.beginPath();
  for (let x = 0; x <= w + 4; x += 4) {
    if (x) c.lineTo(x, edge(x));
    else c.moveTo(x, edge(x));
  }
  c.stroke();
  c.lineWidth = 3.5;
  c.strokeStyle = style.rim;
  c.globalAlpha = top >= h ? 0.55 + 0.4 * Math.sin(t * 8) ** 2 : 0.95;
  c.stroke();
  c.globalAlpha = 1;
  // setas pulsando quando está para entrar na tela
  if (top >= h - 40) {
    c.fillStyle = style.rim;
    for (let i = -1; i <= 1; i++) {
      c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8 - i);
      const x = w / 2 + i * 34;
      const y = h - 44 - Math.abs(i) * 2;
      c.beginPath();
      c.moveTo(x - 11, y + 8);
      c.lineTo(x, y - 6);
      c.lineTo(x + 11, y + 8);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;
  }
  const depth = h - base;
  // brasas subindo
  for (let i = 0; i < 26; i++) {
    const seed = i * 7.31;
    const px = (seed * 53) % w;
    const rise = wrapY(t * (18 + (i % 5) * 7) + seed * 40, 150);
    const py = base + 20 - rise + 40;
    const a = clamp(1 - rise / 150, 0, 1);
    if (py > h || depth < 20) continue;
    c.globalAlpha = a * 0.9;
    c.fillStyle = style.ember;
    c.beginPath();
    c.arc(px + Math.sin(t * 2 + seed) * 6, py, 1.6 + (i % 3), 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  // olhos que piscam lá dentro
  for (const [fx, fy] of [[0.2, 0.3], [0.45, 0.55], [0.8, 0.38], [0.65, 0.8]] as const) {
    const ex = fx * w;
    const y = base + 44 + fy * 110;
    const open = Math.sin(t * 1.3 + ex) > -0.7;
    if (open && y < h - 14 && depth > 70) {
      for (const dx of [0, 20]) {
        c.fillStyle = style.rim;
        c.beginPath();
        c.ellipse(ex + dx, y, 7, 4.6, 0, 0, 7);
        c.fill();
        c.fillStyle = '#000';
        c.beginPath();
        c.ellipse(ex + dx + Math.sin(t + ex) * 1.5, y, 1.8, 4.2, 0, 0, 7);
        c.fill();
      }
    }
  }
  c.restore();
}
