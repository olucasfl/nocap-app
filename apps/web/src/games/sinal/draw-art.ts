import type { SinalMapId } from '@nocap/games';

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

/** Nome, cores e identidade de cada mapa. */
export const MAP_STYLE: Record<
  SinalMapId,
  { name: string; vigia: string; boss: string; hero: string; ember: string; dark: string; rim: string }
> = {
  horta: {
    name: 'Horta Maluca',
    vigia: 'Espantalho',
    boss: 'Rei Espantalho',
    hero: 'Tomate',
    ember: '#ffd23f',
    dark: '#0d1a12',
    rim: '#ffd23f',
  },
  neon: {
    name: 'Rua Neon',
    vigia: 'Semáforo',
    boss: 'Semáforo Mestre',
    hero: 'Entregador',
    ember: '#25c7e8',
    dark: '#07071a',
    rim: '#25c7e8',
  },
  deserto: {
    name: 'Ruínas do Deserto',
    vigia: 'Totem Coruja',
    boss: 'Totem Ancestral',
    hero: 'Raposa',
    ember: '#ff9ecf',
    dark: '#1a0f24',
    rim: '#ff9ecf',
  },
};

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
    for (let k = 0; k < 4; k++) {
      const y = wrapY(k * 410 + scroll, 1640) - 200;
      for (const x of [L - 74, R + 74]) {
        blob(c, rect(x - 22, y - 16, 44, 32, 6), '#e5303a');
        blob(c, poly([[x - 26, y - 14], [x, y - 36], [x + 26, y - 14]]), '#ffd23f', 3, 0);
      }
    }
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

export function cover(c: Ctx, key: SinalMapId, x: number, y: number, active: boolean, t: number, dur = 1, fragile = false) {
  zoneRing(c, x, y, active, t, dur);
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
 * costas); `tx` é o x do boneco (a pupila acompanha); `boss` engrossa e põe uma coroa.
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
  boss: boolean,
) {
  const sx = Math.cos(face * Math.PI);
  const front = sx < 0;
  const w = Math.max(0.04, Math.abs(sx));
  c.save();
  c.translate(cx, top);
  c.scale(sc * (boss ? 1.25 : 1), sc * (boss ? 1.25 : 1));
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
        const on = i === 0 || (boss && i === 1);
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
  if (boss) {
    // coroa do chefe
    blob(c, poly([[-26, -6], [-18, -26], [-8, -10], [0, -30], [8, -10], [18, -26], [26, -6]]), '#ffd23f', 3.5, 3);
  }
  c.restore();
}

// ---------------------------------------------------------------- escuridão
/** A escuridão sobe de baixo: borda ondulada animada, brasas e olhos. `top` é a altura (px da tela) da borda. */
export function darkness(c: Ctx, w: number, h: number, top: number, t: number, style: { dark: string; ember: string; rim: string }) {
  if (top >= h) return;
  const edge = (x: number) => top + Math.sin(x * 0.035 + t * 1.6) * 7 + Math.sin(x * 0.09 - t * 2.3) * 4;
  c.save();
  c.fillStyle = style.dark;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) c.lineTo(x, edge(x));
  c.lineTo(w, h);
  c.closePath();
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = style.rim;
  c.globalAlpha = 0.85;
  c.beginPath();
  for (let x = 0; x <= w; x += 6) {
    if (x) c.lineTo(x, edge(x));
    else c.moveTo(x, edge(x));
  }
  c.stroke();
  c.globalAlpha = 1;
  const depth = h - top;
  for (let i = 0; i < 26; i++) {
    const seed = i * 7.31;
    const px = (seed * 53) % w;
    const rise = wrapY(t * (18 + (i % 5) * 7) + seed * 40, 150);
    const py = top + 20 - rise + 40;
    const a = clamp(1 - rise / 150, 0, 1);
    if (py > h) continue;
    c.globalAlpha = a * 0.9;
    c.fillStyle = style.ember;
    c.beginPath();
    c.arc(px + Math.sin(t * 2 + seed) * 6, py, 1.6 + (i % 3), 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  for (const [fx, fy] of [[0.2, 0.3], [0.45, 0.5], [0.8, 0.38]] as const) {
    const ex = fx * w;
    const y = top + 36 + fy * 90;
    const open = Math.sin(t * 1.3 + ex) > -0.75;
    if (open && y < h - 10 && depth > 60) {
      c.fillStyle = style.rim;
      c.beginPath();
      c.ellipse(ex, y, 5, 3.2, 0, 0, 7);
      c.ellipse(ex + 14, y, 5, 3.2, 0, 0, 7);
      c.fill();
    }
  }
  c.restore();
}
