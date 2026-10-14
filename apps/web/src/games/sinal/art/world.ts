import type { SinalMapId } from '@nocap/games';
import { V } from '../camera';
import type { Pal } from './palette';
import {
  alpha,
  circle,
  clamp,
  ell,
  glow,
  gloss,
  hash,
  mix,
  paint,
  poly,
  rect,
  shade,
  soft,
  tile,
  type Ctx,
} from './gfx';

/**
 * O cenário do Sinal Vermelho 2: o chão com textura, o corredor que estreita e alarga, as bordas
 * (cerca, meio-fio, muro) e o que fica do lado de fora. Visão de cima levemente inclinada: as
 * coisas altas têm a base no chão e crescem para cima da tela, com sombra para a direita e para baixo.
 */

export interface WorldCtx {
  c: Ctx;
  map: SinalMapId;
  pal: Pal;
  /** Tamanho da tela e centro, em pixels de arte. */
  vw: number;
  vh: number;
  vcx: number;
  /** Onde fica o boneco na tela (pixels de arte). */
  vpy: number;
  /** A altura do mundo (m) onde está a câmera. */
  y: number;
  halfAt: (y: number) => number;
  t: number;
}

/** A altura da tela (pixels de arte) de uma altura do mundo (m). */
export const sy = (w: WorldCtx, wy: number) => w.vpy - (wy - w.y) * V;

/** O que se desenha em ordem de profundidade: quanto maior `y` (mais longe), mais cedo. */
export interface Item {
  y: number;
  draw: () => void;
}

const MAP_INDEX: Record<SinalMapId, number> = { horta: 1, neon: 2, deserto: 3 };

/** A faixa de altura do mundo que aparece na tela, com folga. */
export function visibleRange(w: WorldCtx, margin = 5): { lo: number; hi: number } {
  return { lo: w.y - (w.vh - w.vpy) / V - margin, hi: w.y + w.vpy / V + margin };
}

// ---------------------------------------------------------------- texturas
const patterns = new WeakMap<Ctx, Map<string, CanvasPattern>>();

function patternOf(c: Ctx, key: string, size: number, draw: (c: Ctx, s: number) => void): CanvasPattern | null {
  let m = patterns.get(c);
  if (!m) {
    m = new Map();
    patterns.set(c, m);
  }
  const hit = m.get(key);
  if (hit) return hit;
  const p = c.createPattern(tile(key, size, draw), 'repeat');
  if (p) m.set(key, p);
  return p;
}

const TILE = 256;

/** Pontinhos espalhados de um jeito que emenda nas bordas do ladrilho. */
function speckle(c: Ctx, s: number, n: number, salt: number, fn: (x: number, y: number, r: number, i: number) => void) {
  for (let i = 0; i < n; i++) {
    const x = hash(i, salt) * s;
    const y = hash(i, salt + 99) * s;
    const r = hash(i, salt + 7);
    for (const dx of [-s, 0, s]) {
      for (const dy of [-s, 0, s]) {
        if (x + dx < -12 || x + dx > s + 12 || y + dy < -12 || y + dy > s + 12) continue;
        fn(x + dx, y + dy, r, i);
      }
    }
  }
}

function outerTile(map: SinalMapId, pal: Pal) {
  return (c: Ctx, s: number) => {
    c.fillStyle = pal.outer;
    c.fillRect(0, 0, s, s);
    if (map === 'horta') {
      speckle(c, s, 140, 1, (x, y, r, i) => {
        c.fillStyle = i % 3 === 0 ? shade(pal.outer, 0.12) : pal.outer2;
        c.beginPath();
        c.ellipse(x, y, 5 + r * 9, 3 + r * 5, 0.3, 0, 7);
        c.fill();
      });
      speckle(c, s, 90, 2, (x, y, r) => {
        c.strokeStyle = shade(pal.outer, 0.22);
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (r - 0.5) * 6, y - 7 - r * 4);
        c.stroke();
      });
    } else if (map === 'neon') {
      // calçada: lajes com juntas e manchas
      c.strokeStyle = shade(pal.outer, -0.35);
      c.lineWidth = 2;
      for (let i = 0; i <= s; i += 64) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, s);
        c.moveTo(0, i);
        c.lineTo(s, i);
        c.stroke();
      }
      speckle(c, s, 160, 3, (x, y, r) => {
        c.fillStyle = `rgba(${r > 0.5 ? '90,100,150' : '0,0,10'},0.09)`;
        c.beginPath();
        c.arc(x, y, 2 + r * 8, 0, 7);
        c.fill();
      });
    } else {
      // dunas: ondulações da areia
      speckle(c, s, 70, 4, (x, y, r) => {
        c.strokeStyle = r > 0.5 ? shade(pal.outer, 0.16) : pal.outer2;
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(x, y + 30, 26 + r * 30, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      });
      speckle(c, s, 120, 5, (x, y, r) => {
        c.fillStyle = r > 0.5 ? shade(pal.outer, 0.2) : shade(pal.outer, -0.12);
        c.fillRect(x, y, 2, 2);
      });
    }
  };
}

function pathTile(map: SinalMapId, pal: Pal) {
  return (c: Ctx, s: number) => {
    c.fillStyle = pal.path;
    c.fillRect(0, 0, s, s);
    if (map === 'horta') {
      speckle(c, s, 220, 11, (x, y, r, i) => {
        c.fillStyle = i % 2 ? pal.path2 : shade(pal.path, 0.12);
        c.beginPath();
        c.ellipse(x, y, 2 + r * 6, 1.5 + r * 3.5, r * 3, 0, 7);
        c.fill();
      });
      speckle(c, s, 36, 12, (x, y, r) => {
        c.fillStyle = shade(pal.path2, -0.2);
        c.beginPath();
        c.ellipse(x + 1.5, y + 1.5, 4 + r * 3, 3 + r * 2, 0, 0, 7);
        c.fill();
        c.fillStyle = shade(pal.path, 0.28);
        c.beginPath();
        c.ellipse(x, y, 4 + r * 3, 3 + r * 2, 0, 0, 7);
        c.fill();
      });
    } else if (map === 'neon') {
      // asfalto: granulado fino e remendos
      speckle(c, s, 420, 13, (x, y, r) => {
        c.fillStyle = r > 0.55 ? 'rgba(180,190,255,0.07)' : 'rgba(0,0,8,0.16)';
        c.fillRect(x, y, 1.6 + r * 1.5, 1.6 + r * 1.5);
      });
      speckle(c, s, 6, 14, (x, y, r) => {
        c.fillStyle = 'rgba(0,0,10,0.12)';
        c.beginPath();
        c.ellipse(x, y, 20 + r * 30, 12 + r * 16, r * 3, 0, 7);
        c.fill();
      });
      c.strokeStyle = 'rgba(0,0,8,0.4)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        let x = hash(i, 15) * s;
        let y = hash(i, 16) * s;
        c.beginPath();
        c.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (hash(i * 9 + k, 17) - 0.5) * 30;
          y += 8 + hash(i * 9 + k, 18) * 14;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    } else {
      speckle(c, s, 80, 19, (x, y, r) => {
        c.strokeStyle = r > 0.5 ? shade(pal.path, 0.18) : pal.path2;
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(x, y + 24, 22 + r * 28, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      });
      speckle(c, s, 130, 20, (x, y, r) => {
        c.fillStyle = r > 0.5 ? shade(pal.path, 0.22) : shade(pal.path, -0.14);
        c.fillRect(x, y, 2, 2);
      });
      speckle(c, s, 14, 21, (x, y, r) => {
        c.fillStyle = shade(pal.path2, -0.18);
        c.beginPath();
        c.ellipse(x + 1.5, y + 1.5, 5 + r * 4, 3 + r * 2.5, 0, 0, 7);
        c.fill();
        c.fillStyle = shade(pal.path, 0.1);
        c.beginPath();
        c.ellipse(x, y, 5 + r * 4, 3 + r * 2.5, 0, 0, 7);
        c.fill();
      });
    }
  };
}

// ---------------------------------------------------------------- o chão
/** Os pontos das bordas do corredor, de baixo para cima na tela. */
function edgePoints(w: WorldCtx, step = 0.75): { y: number; sy: number; h: number }[] {
  const { lo, hi } = visibleRange(w, 3);
  const out: { y: number; sy: number; h: number }[] = [];
  const start = Math.floor(lo / step) * step;
  for (let y = start; y <= hi + step; y += step) out.push({ y, sy: sy(w, y), h: w.halfAt(y) });
  return out;
}

export function drawGround(w: WorldCtx) {
  const { c, map, pal, vw, vh, vcx } = w;
  const scroll = (w.y * V) % TILE;

  // fora do corredor
  const outer = patternOf(c, `${map}:outer`, TILE, outerTile(map, pal));
  c.save();
  c.fillStyle = outer ?? pal.outer;
  c.translate(0, scroll);
  c.fillRect(0, -TILE, vw, vh + TILE * 2);
  c.restore();

  const pts = edgePoints(w);
  const left = (h: number) => vcx - h * V;
  const right = (h: number) => vcx + h * V;
  const corridor = () => {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(left(p.h), p.sy) : c.moveTo(left(p.h), p.sy)));
    for (let i = pts.length - 1; i >= 0; i--) c.lineTo(right(pts[i]!.h), pts[i]!.sy);
    c.closePath();
  };

  // o caminho
  c.save();
  corridor();
  c.clip();
  const path = patternOf(c, `${map}:path`, TILE, pathTile(map, pal));
  c.save();
  c.fillStyle = path ?? pal.path;
  c.translate(0, scroll);
  c.fillRect(0, -TILE, vw, vh + TILE * 2);
  c.restore();
  pathMarkings(w, pts);
  // sombra de dentro das bordas: o caminho "afunda" um pouco
  corridor();
  c.lineJoin = 'round';
  for (const [lw, a] of [[44, 0.1], [26, 0.12], [12, 0.14]] as const) {
    c.lineWidth = lw;
    c.strokeStyle = `rgba(0,0,0,${a})`;
    c.stroke();
  }
  c.restore();

  // a borda: uma faixa de cada lado, com o topo mais claro
  for (const side of [-1, 1] as const) {
    const edge = (h: number, extra: number) => vcx + side * (h + extra) * V;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(edge(p.h, 0), p.sy) : c.moveTo(edge(p.h, 0), p.sy)));
    for (let i = pts.length - 1; i >= 0; i--) c.lineTo(edge(pts[i]!.h, 0.8), pts[i]!.sy);
    c.closePath();
    const g = c.createLinearGradient(vcx + side * 7 * V, 0, vcx + side * 9.2 * V, 0);
    g.addColorStop(0, pal.edge2);
    g.addColorStop(0.5, pal.edge);
    g.addColorStop(1, shade(pal.edge, 0.12));
    c.fillStyle = g;
    c.fill();
    // fio de luz no alto da borda
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(edge(p.h, 0.62), p.sy) : c.moveTo(edge(p.h, 0.62), p.sy)));
    c.lineWidth = 3;
    c.strokeStyle = shade(pal.edge, 0.32);
    c.stroke();
    // sombra projetada pela borda
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(edge(p.h, -0.05), p.sy) : c.moveTo(edge(p.h, -0.05), p.sy)));
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.stroke();
    if (map === 'neon') {
      // o friso de néon do meio-fio
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(edge(p.h, 0.12), p.sy) : c.moveTo(edge(p.h, 0.12), p.sy)));
      c.globalCompositeOperation = 'lighter';
      c.lineWidth = 6;
      c.strokeStyle = alpha(pal.accent, 0.16);
      c.stroke();
      c.lineWidth = 2;
      c.strokeStyle = alpha(pal.accent, 0.75);
      c.stroke();
      c.globalCompositeOperation = 'source-over';
    }
  }
}

/** O que se pinta em cima do caminho: marcas, rastros, pedras, listras. */
function pathMarkings(w: WorldCtx, pts: { y: number; sy: number; h: number }[]) {
  const { c, map, pal, vcx } = w;
  const { lo, hi } = visibleRange(w, 4);
  if (map === 'horta') {
    // rastros de roda, serpenteando de leve
    for (const lane of [-1.15, 1.15]) {
      c.beginPath();
      pts.forEach((p, i) => {
        const x = vcx + (lane + Math.sin(p.y * 0.21 + lane * 3) * 0.28) * V;
        if (i) c.lineTo(x, p.sy);
        else c.moveTo(x, p.sy);
      });
      c.lineCap = 'round';
      c.lineWidth = 9;
      c.strokeStyle = alpha(shade(pal.path2, -0.3), 0.28);
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = alpha(shade(pal.path, 0.25), 0.3);
      c.stroke();
    }
    // tufos de grama que invadem o caminho
    for (let k = Math.floor(lo / 2.5); k <= hi / 2.5; k++) {
      for (let j = 0; j < 4; j++) {
        if (hash(k, j + 40) > 0.5) continue;
        const wy = k * 2.5 + hash(k, j + 50) * 2.5;
        const h = w.halfAt(wy);
        const side = j % 2 ? 1 : -1;
        const x = vcx + side * (h - 0.35 - hash(k, j + 60) * 1.2) * V;
        tuft(c, x, sy(w, wy), 0.8 + hash(k, j + 70) * 0.7, pal.outer);
      }
    }
  } else if (map === 'neon') {
    const top = hi;
    // faixa tracejada do meio e linhas de borda
    for (let wy = Math.floor(lo / 3) * 3; wy <= top; wy += 3) {
      const y0 = sy(w, wy + 1.6);
      const y1 = sy(w, wy);
      c.fillStyle = 'rgba(255,214,90,0.85)';
      c.fillRect(vcx - 3, y0, 6, y1 - y0);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(vcx - 1, y0, 2, y1 - y0);
    }
    for (const side of [-1, 1] as const) {
      c.beginPath();
      pts.forEach((p, i) => {
        const x = vcx + side * (p.h - 0.45) * V;
        if (i) c.lineTo(x, p.sy);
        else c.moveTo(x, p.sy);
      });
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(240,240,255,0.5)';
      c.stroke();
    }
    // faixa de pedestres a cada 60 m (e bueiros)
    for (let k = Math.floor(lo / 60); k <= hi / 60; k++) {
      const wy = k * 60 + 18 + hash(k, 80) * 24;
      const h = w.halfAt(wy);
      for (let i = 0; i < 9; i++) {
        const x0 = vcx - h * V + 10 + i * ((h * 2 * V - 20) / 9);
        c.fillStyle = 'rgba(244,244,255,0.78)';
        c.fillRect(x0, sy(w, wy + 2.4), (h * 2 * V - 20) / 9 - 8, 2.4 * V);
      }
    }
    for (let k = Math.floor(lo / 14); k <= hi / 14; k++) {
      if (hash(k, 85) > 0.35) continue;
      const wy = k * 14 + hash(k, 86) * 10;
      const x = vcx + (hash(k, 87) - 0.5) * (w.halfAt(wy) * 1.4) * V;
      const y = sy(w, wy);
      c.fillStyle = 'rgba(8,8,18,0.5)';
      c.beginPath();
      c.ellipse(x, y, 17, 10, 0, 0, 7);
      c.fill();
      c.strokeStyle = 'rgba(120,130,190,0.45)';
      c.lineWidth = 1.6;
      for (let r = -1; r <= 1; r++) {
        c.beginPath();
        c.moveTo(x - 12, y + r * 3.5);
        c.lineTo(x + 12, y + r * 3.5);
        c.stroke();
      }
    }
    // poças que refletem os neons
    for (let k = Math.floor(lo / 19); k <= hi / 19; k++) {
      if (hash(k, 90) > 0.5) continue;
      const wy = k * 19 + hash(k, 91) * 14;
      const x = vcx + (hash(k, 92) - 0.5) * (w.halfAt(wy) * 1.5) * V;
      const y = sy(w, wy);
      const pc = hash(k, 93) > 0.5 ? '#ff3d9a' : '#25c7e8';
      c.save();
      c.translate(x, y);
      c.rotate(hash(k, 94) * 1.2 - 0.6);
      c.fillStyle = 'rgba(14,16,40,0.7)';
      c.beginPath();
      c.ellipse(0, 0, 30, 15, 0, 0, 7);
      c.fill();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = alpha(pc, 0.22);
      c.beginPath();
      c.ellipse(-4, -2, 18, 7, 0, 0, 7);
      c.fill();
      c.restore();
    }
  } else {
    // lajes antigas e rachaduras
    for (let k = Math.floor(lo / 9); k <= hi / 9; k++) {
      if (hash(k, 100) > 0.55) continue;
      const wy = k * 9 + hash(k, 101) * 6;
      const h = w.halfAt(wy);
      const x = vcx + (hash(k, 102) * 2 - 1) * (h - 1.5) * V;
      const y = sy(w, wy);
      const sw = 36 + hash(k, 103) * 34;
      const sh = 26 + hash(k, 104) * 22;
      c.save();
      c.translate(x, y);
      c.rotate((hash(k, 105) - 0.5) * 0.35);
      c.fillStyle = 'rgba(70,40,20,0.2)';
      c.fillRect(-sw / 2 + 4, -sh / 2 + 4, sw, sh);
      paint(c, rect(-sw / 2, -sh / 2, sw, sh, 4), shade(pal.path, -0.05), -sh / 2, sh / 2, 1.4, 0.12, 0.12);
      c.strokeStyle = 'rgba(80,50,30,0.5)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-sw * 0.2, -sh / 2);
      c.lineTo(-sw * 0.05, 0);
      c.lineTo(sw * 0.15, sh / 2);
      c.stroke();
      c.restore();
    }
  }
}

function tuft(c: Ctx, x: number, y: number, s: number, col: string) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    c.strokeStyle = i % 2 ? shade(col, 0.2) : shade(col, -0.1);
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(i * 3, 0);
    c.quadraticCurveTo(i * 4, -8, i * 6, -13 + Math.abs(i) * 2);
    c.stroke();
  }
  c.restore();
}

// ---------------------------------------------------------------- bordas e cenário de fora
/** O que fica em cima do chão e tem altura: postes, pedras, árvores, prédios. */
export function worldItems(w: WorldCtx): Item[] {
  const { map } = w;
  const { lo, hi } = visibleRange(w, 6);
  const items: Item[] = [];
  const idx = MAP_INDEX[map];

  // as bordas
  const step = map === 'horta' ? 2.1 : map === 'neon' ? 10 : 1.5;
  for (let k = Math.floor(lo / step); k <= hi / step; k++) {
    for (const side of [-1, 1] as const) {
      const wy = k * step + (map === 'deserto' ? hash(k, side + 3) * 0.6 : 0);
      const h = w.halfAt(wy);
      const seed = k * 2 + (side > 0 ? 1 : 0);
      items.push({
        y: wy,
        draw: () => {
          const x = w.vcx + side * (h + 0.38) * V;
          const y = sy(w, wy);
          if (map === 'horta') fencePost(w, x, y, side, seed);
          else if (map === 'neon') lampPost(w, x, y, side, seed);
          else wallStone(w, x, y, side, seed);
        },
      });
    }
  }
  // o cenário de fora: o que está além da borda (aparece nos desfiladeiros e nas bordas da tela)
  const cell = 5;
  for (let k = Math.floor(lo / cell); k <= hi / cell; k++) {
    for (const side of [-1, 1] as const) {
      const sd = k * 2 + (side > 0 ? 1 : 0);
      if (hash(sd, 200 + idx) > 0.78) continue;
      const wy = k * cell + hash(sd, 210 + idx) * cell;
      const h = w.halfAt(wy);
      const off = 1.0 + hash(sd, 220 + idx) * 5.5;
      items.push({
        y: wy,
        draw: () => {
          const x = w.vcx + side * (h + off) * V;
          const y = sy(w, wy);
          if (map === 'horta') hortaDecor(w, x, y, sd, side);
          else if (map === 'neon') neonDecor(w, x, y, sd, side);
          else desertDecor(w, x, y, sd, side);
        },
      });
    }
  }
  return items;
}

function fencePost(w: WorldCtx, x: number, y: number, side: number, seed: number) {
  const { c, pal } = w;
  const tall = 26 + hash(seed, 1) * 6;
  soft(c, x + 5, y + 2, 11, 4, 0.3);
  // as duas ripas até o próximo poste (de lado para o corredor)
  c.save();
  c.translate(x, y);
  const lean = (hash(seed, 2) - 0.5) * 0.12;
  c.rotate(lean);
  paint(c, rect(-4, -tall, 8, tall, 2), mix(pal.edge, '#c58a4a', 0.4), -tall, 0, 1.6, 0.25, 0.2);
  paint(c, poly([[-4, -tall], [0, -tall - 5], [4, -tall]]), mix(pal.edge, '#d9a15a', 0.5), -tall - 5, -tall, 1.4, 0.2, 0.1);
  c.restore();
  // ripa
  c.save();
  c.lineCap = 'round';
  for (const hh of [0.45, 0.78]) {
    c.beginPath();
    c.moveTo(x, y - tall * hh);
    c.lineTo(x, y - tall * hh + 1);
    c.lineWidth = 0;
  }
  c.restore();
  if (hash(seed, 3) > 0.7) tuft(c, x + side * -3, y + 1, 0.9, pal.outer);
  if (hash(seed, 4) > 0.82) {
    // uma florzinha na cerca
    c.fillStyle = hash(seed, 5) > 0.5 ? '#ffd23f' : '#ff9ecf';
    c.beginPath();
    c.arc(x + side * 6, y - 3, 3, 0, 7);
    c.fill();
  }
}

function lampPost(w: WorldCtx, x: number, y: number, side: number, seed: number) {
  const { c, pal } = w;
  const warm = hash(seed, 1) > 0.5;
  const col = warm ? '#ffb347' : '#6fe3ff';
  const tall = 78;
  soft(c, x + 6, y + 3, 14, 5, 0.4);
  paint(c, rect(x - 3, y - tall, 6, tall, 2), '#3b4468', y - tall, y, 1.5, 0.3, 0.3);
  paint(c, rect(x - 8, y - 6, 16, 8, 3), '#2a3150', y - 6, y + 2, 1.4);
  // braço e lâmpada
  c.strokeStyle = '#3b4468';
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y - tall + 4);
  c.quadraticCurveTo(x - side * 14, y - tall - 12, x - side * 24, y - tall + 2);
  c.stroke();
  paint(c, rect(x - side * 24 - 8, y - tall, 16, 9, 4), '#2a3150', y - tall, y - tall + 9, 1.4);
  glow(c, x - side * 24, y - tall + 6, 62, col, 0.9);
  // poça de luz no chão, dentro do corredor
  c.save();
  c.globalCompositeOperation = 'lighter';
  const lx = x - side * 46;
  const g = c.createRadialGradient(lx, y + 2, 0, lx, y + 2, 78);
  g.addColorStop(0, alpha(col, 0.32));
  g.addColorStop(1, alpha(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(lx, y + 2, 78, 40, 0, 0, 7);
  c.fill();
  c.restore();
  void pal;
}

function wallStone(w: WorldCtx, x: number, y: number, side: number, seed: number) {
  const { c, pal } = w;
  const sw = 20 + hash(seed, 1) * 12;
  const sh = 14 + hash(seed, 2) * 16;
  soft(c, x + 6, y + 3, sw * 0.7, 5, 0.32);
  const base = mix(pal.edge, '#c9a073', 0.25 + hash(seed, 3) * 0.2);
  c.save();
  c.translate(x, y);
  paint(c, rect(-sw / 2, -sh, sw, sh, 5), base, -sh, 0, 1.8, 0.22, 0.22);
  gloss(c, -sw * 0.18, -sh * 0.7, sw * 0.22, sh * 0.12, 0.25);
  c.strokeStyle = 'rgba(60,35,20,0.4)';
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-sw * 0.1, -sh);
  c.lineTo(sw * 0.05, -sh * 0.5);
  c.lineTo(-sw * 0.05, 0);
  c.stroke();
  c.restore();
  if (hash(seed, 4) > 0.8) {
    // uma planta seca entre as pedras
    c.strokeStyle = '#6a7a3a';
    c.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(x + side * 8 + i * 2, y);
      c.lineTo(x + side * 8 + i * 6, y - 14 - hash(seed, 5 + i) * 6);
      c.stroke();
    }
  }
}

// ---------------------------------------------------------------- decoração de fora
function hortaDecor(w: WorldCtx, x: number, y: number, sd: number, side: number) {
  const { c, pal } = w;
  const kind = Math.floor(hash(sd, 301) * 6);
  const s = 0.8 + hash(sd, 302) * 0.5;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (kind <= 1) {
    // árvore
    soft(c, 14, 4, 36, 10, 0.34);
    paint(c, rect(-6, -44, 12, 46, 4), '#7a4e2a', -44, 2, 1.8, 0.2, 0.3);
    const cols = ['#3f8f3e', '#4fa546', '#2f7a36'];
    const blobs: [number, number, number, string][] = [
      [-18, -58, 26, cols[2]!],
      [16, -62, 28, cols[2]!],
      [0, -82, 32, cols[0]!],
      [-14, -78, 24, cols[1]!],
      [16, -84, 22, cols[1]!],
    ];
    for (const [bx, by, br, col] of blobs) paint(c, circle(bx, by, br), col, by - br, by + br, 2, 0.28, 0.25);
    if (kind === 1) {
      for (const [fx, fy] of [[-10, -70], [14, -90], [4, -62], [-22, -86]] as const) {
        c.fillStyle = '#ff4b4b';
        c.beginPath();
        c.arc(fx, fy, 4.4, 0, 7);
        c.fill();
        gloss(c, fx - 1.4, fy - 1.4, 1.6, 1, 0.7);
      }
    }
    gloss(c, -8, -92, 14, 6, 0.18);
  } else if (kind === 2) {
    // arbusto florido
    soft(c, 8, 3, 28, 7, 0.3);
    for (const [bx, by, br] of [[-14, -12, 15], [12, -13, 16], [0, -22, 17]] as const) {
      paint(c, circle(bx, by, br), '#3f9446', by - br, by + br, 1.8, 0.3, 0.25);
    }
    for (const [fx, fy, fc] of [[-12, -20, '#ffd23f'], [8, -28, '#ff9ecf'], [14, -14, '#ffffff'], [-2, -12, '#ff4b4b']] as const) {
      c.fillStyle = fc;
      c.beginPath();
      c.arc(fx, fy, 3.4, 0, 7);
      c.fill();
    }
  } else if (kind === 3) {
    // fardo de feno redondo
    soft(c, 10, 4, 30, 8, 0.3);
    paint(c, ell(0, -16, 24, 20), '#e8c35c', -36, 4, 2, 0.28, 0.25);
    c.strokeStyle = 'rgba(120,80,20,0.55)';
    c.lineWidth = 1.6;
    for (let i = 1; i <= 3; i++) {
      c.beginPath();
      c.ellipse(0, -16, 24 - i * 6, 20 - i * 5, 0, 0, 7);
      c.stroke();
    }
    gloss(c, -9, -26, 8, 3, 0.35);
  } else if (kind === 4) {
    farmHouse(c, hash(sd, 303));
  } else {
    // espantalho pequeno de enfeite: um poste com girassol
    soft(c, 6, 3, 14, 5, 0.3);
    paint(c, rect(-2.5, -52, 5, 54, 2), '#6b8f3a', -52, 2, 1.4, 0.2, 0.25);
    c.fillStyle = '#ffd23f';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.beginPath();
      c.ellipse(Math.cos(a) * 12, -56 + Math.sin(a) * 12, 7, 3.4, a, 0, 7);
      c.fill();
    }
    paint(c, circle(0, -56, 8), '#6b3f1c', -64, -48, 1.6, 0.3, 0.2);
  }
  c.restore();
  void side;
  void pal;
}

function farmHouse(c: Ctx, r: number) {
  const walls = ['#e5303a', '#f0a23a', '#f4f4ef', '#4f9bd9'];
  const wall = walls[Math.floor(r * walls.length) % walls.length]!;
  soft(c, 14, 6, 52, 12, 0.34);
  paint(c, rect(-38, -34, 76, 40, 4), wall, -34, 6, 2.2, 0.2, 0.28);
  paint(c, poly([[-46, -32], [0, -72], [46, -32]]), '#8c3b2a', -72, -32, 2.2, 0.25, 0.2);
  paint(c, rect(-8, -22, 16, 28, 3), '#5e3b1c', -22, 6, 1.6);
  paint(c, rect(-30, -26, 14, 14, 2), '#cdeaff', -26, -12, 1.5, 0.2, 0.1);
  paint(c, rect(16, -26, 14, 14, 2), '#cdeaff', -26, -12, 1.5, 0.2, 0.1);
  paint(c, rect(20, -86, 10, 22, 2), '#9a9a92', -86, -64, 1.6);
}

function neonDecor(w: WorldCtx, x: number, y: number, sd: number, side: number) {
  const { c } = w;
  const kind = Math.floor(hash(sd, 401) * 5);
  c.save();
  c.translate(x, y);
  if (kind <= 2) {
    // prédio: fachada escura com janelas acesas e um letreiro de néon
    const bw = 70 + hash(sd, 402) * 50;
    const bh = 100 + hash(sd, 403) * 110;
    soft(c, 18, 5, bw * 0.6, 10, 0.4);
    const tone = ['#1f2545', '#26204a', '#1a2f4a'][Math.floor(hash(sd, 404) * 3)]!;
    paint(c, rect(-bw / 2, -bh, bw, bh, 3), tone, -bh, 0, 2, 0.14, 0.4);
    // telhado
    paint(c, rect(-bw / 2 - 3, -bh - 6, bw + 6, 8, 2), shade(tone, 0.12), -bh - 6, -bh + 2, 1.6);
    const cols = Math.max(2, Math.floor(bw / 22));
    const rows = Math.floor((bh - 20) / 24);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = hash(sd * 31 + i * 7 + j, 405) > 0.45;
        const wx = -bw / 2 + 8 + i * ((bw - 16) / cols);
        const wy = -bh + 14 + j * 24;
        const ww = (bw - 16) / cols - 6;
        c.fillStyle = lit ? (hash(sd + i, j + 406) > 0.7 ? '#6fe3ff' : '#ffd98a') : '#0d1022';
        c.fillRect(wx, wy, ww, 13);
        if (lit) glow(c, wx + ww / 2, wy + 6, 20, '#ffd98a', 0.25);
      }
    }
    if (hash(sd, 407) > 0.4) {
      // letreiro
      const col = hash(sd, 408) > 0.5 ? '#ff3d9a' : '#25c7e8';
      const lw = bw * 0.6;
      c.strokeStyle = col;
      c.lineWidth = 3;
      c.strokeRect(-lw / 2, -bh * 0.55, lw, 14);
      glow(c, 0, -bh * 0.55 + 7, lw * 0.9, col, 0.7);
    }
  } else if (kind === 3) {
    // máquina de bebidas brilhando
    soft(c, 8, 4, 22, 6, 0.4);
    paint(c, rect(-14, -48, 28, 48, 3), '#e5303a', -48, 0, 2, 0.2, 0.3);
    c.fillStyle = '#aef3ff';
    c.fillRect(-9, -42, 18, 22);
    glow(c, 0, -30, 40, '#6fe3ff', 0.6);
    paint(c, rect(-9, -14, 18, 8, 2), '#2a2a3a', -14, -6, 1.2);
  } else {
    // caçamba de lixo
    soft(c, 12, 4, 30, 7, 0.4);
    paint(c, rect(-24, -26, 48, 26, 3), '#2f7a56', -26, 0, 2, 0.2, 0.3);
    paint(c, rect(-27, -32, 54, 9, 3), '#245f43', -32, -23, 1.6);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(i * 14, -23);
      c.lineTo(i * 14, -2);
      c.stroke();
    }
  }
  c.restore();
  void side;
}

function desertDecor(w: WorldCtx, x: number, y: number, sd: number, side: number) {
  const { c } = w;
  const kind = Math.floor(hash(sd, 501) * 6);
  const s = 0.85 + hash(sd, 502) * 0.45;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (kind <= 1) {
    // cacto grande
    soft(c, 12, 4, 26, 7, 0.32);
    const g = '#4f9a4a';
    paint(c, rect(-9, -62, 18, 64, 9), g, -62, 2, 2, 0.28, 0.28);
    paint(c, rect(-28, -42, 10, 22, 5), g, -42, -20, 2, 0.28, 0.25);
    paint(c, rect(-28, -30, 22, 9, 4), g, -30, -21, 2, 0.28, 0.25);
    paint(c, rect(18, -52, 10, 26, 5), g, -52, -26, 2, 0.28, 0.25);
    paint(c, rect(8, -36, 20, 9, 4), g, -36, -27, 2, 0.28, 0.25);
    c.strokeStyle = 'rgba(20,60,20,0.4)';
    c.lineWidth = 1.4;
    for (const dx of [-4, 4]) {
      c.beginPath();
      c.moveTo(dx, -58);
      c.lineTo(dx, -2);
      c.stroke();
    }
    if (hash(sd, 503) > 0.5) {
      c.fillStyle = '#ff9ecf';
      c.beginPath();
      c.arc(0, -66, 5, 0, 7);
      c.fill();
    }
  } else if (kind === 2) {
    // conjunto de pedras
    soft(c, 12, 5, 40, 9, 0.34);
    paint(c, poly([[-30, 0], [-22, -26], [-6, -32], [10, -18], [8, 0]]), '#b08558', -32, 0, 2, 0.25, 0.25);
    paint(c, poly([[2, 0], [10, -20], [26, -24], [34, -6], [32, 0]]), '#9a7448', -24, 0, 2, 0.25, 0.25);
    gloss(c, -14, -22, 8, 3, 0.3);
  } else if (kind === 3) {
    // pilar de ruína quebrado
    soft(c, 14, 5, 34, 8, 0.36);
    paint(c, rect(-14, -64, 28, 66, 3), '#c9a36e', -64, 2, 2, 0.22, 0.3);
    paint(c, poly([[-18, -64], [-12, -72], [8, -68], [18, -64]]), '#b78b57', -72, -64, 1.8);
    c.strokeStyle = 'rgba(70,45,25,0.45)';
    c.lineWidth = 1.6;
    for (const yy of [-18, -38]) {
      c.beginPath();
      c.moveTo(-14, yy);
      c.lineTo(14, yy + 3);
      c.stroke();
    }
    paint(c, rect(20, -12, 24, 14, 3), '#b78b57', -12, 2, 1.8);
  } else if (kind === 4) {
    // arco de ruína
    soft(c, 16, 6, 56, 10, 0.36);
    paint(c, rect(-44, -58, 20, 60, 3), '#c9a36e', -58, 2, 2, 0.22, 0.3);
    paint(c, rect(24, -58, 20, 60, 3), '#c9a36e', -58, 2, 2, 0.22, 0.3);
    paint(c, rect(-44, -78, 88, 24, 8), '#b78b57', -78, -54, 2, 0.22, 0.25);
    c.fillStyle = 'rgba(30,20,10,0.5)';
    c.beginPath();
    c.arc(0, -52, 20, Math.PI, 0);
    c.lineTo(20, 0);
    c.lineTo(-20, 0);
    c.fill();
  } else {
    // crânio de boi e galhos secos
    soft(c, 6, 3, 22, 6, 0.3);
    paint(c, ell(0, -10, 14, 11), '#efe6d2', -21, 1, 1.8, 0.2, 0.2);
    c.fillStyle = '#2a1a10';
    c.beginPath();
    c.ellipse(-5, -12, 3.4, 4.2, 0, 0, 7);
    c.ellipse(5, -12, 3.4, 4.2, 0, 0, 7);
    c.fill();
    c.strokeStyle = '#efe6d2';
    c.lineWidth = 3.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-12, -16);
    c.quadraticCurveTo(-26, -22, -24, -32);
    c.moveTo(12, -16);
    c.quadraticCurveTo(26, -22, 24, -32);
    c.stroke();
  }
  c.restore();
  void side;
}

/** O céu e a névoa de longe: o topo da tela some numa bruma da cor do mapa (dá profundidade). */
export function drawHaze(w: WorldCtx) {
  const { c, pal, vw, vh } = w;
  const g = c.createLinearGradient(0, 0, 0, vh * 0.55);
  g.addColorStop(0, alpha(pal.haze, w.map === 'neon' ? 0.55 : 0.5));
  g.addColorStop(0.55, alpha(pal.haze, 0.14));
  g.addColorStop(1, alpha(pal.haze, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, vw, vh);
}

/** A luz de cada mapa: a tinta que cobre o mundo e um foco quente em volta do boneco. */
export function drawLight(w: WorldCtx, heroX: number) {
  const { c, pal, vw, vh, vpy } = w;
  c.save();
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = alpha(pal.tint, clamp(pal.tintAlpha * 3.2, 0, 0.7));
  c.fillRect(0, 0, vw, vh);
  c.restore();
  const warm = w.map === 'neon' ? '#6a7bff' : '#fff1c9';
  glow(c, heroX, vpy, 150, warm, w.map === 'neon' ? 0.16 : 0.2);
}
