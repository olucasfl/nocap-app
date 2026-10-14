import type { ObstacleKind, SinalMapId } from '@nocap/games';
import { COVER_ZONE_R } from '@nocap/games';
import { V } from '../camera';
import {
  INK,
  PAPER,
  YEL,
  alpha,
  circle,
  clamp,
  ell,
  glow,
  gloss,
  hash,
  mix,
  mono,
  paint,
  poly,
  rect,
  shade,
  soft,
  star,
  wrapY,
  type Ctx,
} from './gfx';

/**
 * Os objetos do cenário do Sinal Vermelho 2: obstáculos (cada um com desenho próprio em cada mapa),
 * esconderijos e a linha de chegada. Tudo na escala de 30 pixels por metro; a base do objeto fica no
 * ponto (0, 0) e ele cresce para cima da tela.
 */

export const FLOOR_KINDS: readonly ObstacleKind[] = ['lamacal', 'esteira', 'ima', 'gelo'];
export const isFloor = (k: ObstacleKind) => FLOOR_KINDS.includes(k);

// ---------------------------------------------------------------- obstáculos de chão
function mudZone(c: Ctx, map: SinalMapId, r: number, t: number) {
  const base = map === 'horta' ? '#6b4a2b' : map === 'neon' ? '#2a1a4a' : '#8a6a3a';
  const g = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  g.addColorStop(0, shade(base, -0.25));
  g.addColorStop(0.75, base);
  g.addColorStop(1, alpha(base, 0.35));
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rr = r * (0.92 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 5));
    if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = alpha(shade(base, -0.4), 0.7);
  c.lineWidth = 2.4;
  c.stroke();
  if (map === 'deserto') {
    // areia movediça: anéis girando devagar para o centro
    c.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = alpha(shade(base, i % 2 ? 0.25 : -0.3), 0.55);
      c.beginPath();
      c.arc(0, 0, r * (0.28 + 0.2 * i), t * (i % 2 ? 0.6 : -0.6), t * (i % 2 ? 0.6 : -0.6) + 4.6);
      c.stroke();
    }
  } else {
    if (map === 'neon') {
      // mancha de óleo com brilho de arco-íris
      c.globalAlpha = 0.5;
      for (const [col, dx, dy, rx] of [['#ff3d9a', -0.3, -0.2, 0.4], ['#25c7e8', 0.25, 0.1, 0.34], ['#ffd23f', 0, 0.35, 0.22]] as const) {
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(dx * r + Math.sin(t * 1.4 + dx * 6) * 3, dy * r, rx * r, rx * r * 0.55, 0.4, 0, 7);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    // bolhas que estouram
    for (let i = 0; i < 5; i++) {
      const ph = wrapY(t * 0.8 + i * 0.37, 1);
      const bx = (hash(i, 600) - 0.5) * r * 1.2;
      const by = (hash(i, 601) - 0.5) * r * 1.0;
      const br = (2 + hash(i, 602) * 4) * Math.sin(ph * Math.PI);
      if (br <= 0.4) continue;
      c.fillStyle = alpha(shade(base, 0.45), 0.7);
      c.beginPath();
      c.arc(bx, by, br, 0, 7);
      c.fill();
      gloss(c, bx - br * 0.3, by - br * 0.3, br * 0.4, br * 0.25, 0.6);
    }
  }
}

function conveyor(c: Ctx, map: SinalMapId, r: number, t: number, dir: -1 | 1) {
  const accent = map === 'neon' ? '#25c7e8' : map === 'horta' ? '#ffd23f' : '#ff9ecf';
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.clip();
  const g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#34384a');
  g.addColorStop(1, '#1c1e2b');
  c.fillStyle = g;
  c.fillRect(-r, -r, r * 2, r * 2);
  // setas que andam
  const sp = 46;
  const off = wrapY(t * 42 * dir, sp);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let row = -1; row <= 1; row++) {
    for (let x = -r - sp; x <= r + sp; x += sp) {
      const cx = x + off;
      const cy = row * r * 0.5;
      c.strokeStyle = accent;
      c.lineWidth = 4.6;
      c.beginPath();
      c.moveTo(cx - dir * 9, cy - 9);
      c.lineTo(cx + dir * 4, cy);
      c.lineTo(cx - dir * 9, cy + 9);
      c.stroke();
    }
  }
  c.restore();
  c.lineWidth = 5;
  c.strokeStyle = accent;
  c.beginPath();
  c.arc(0, 0, r - 2, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([9, 9]);
  c.lineDashOffset = -t * 22 * dir;
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.beginPath();
  c.arc(0, 0, r - 7, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
}

function magnet(c: Ctx, map: SinalMapId, r: number, t: number) {
  const accent = map === 'neon' ? '#ff3d9a' : map === 'horta' ? '#e5303a' : '#7a3cff';
  const g = c.createRadialGradient(0, 0, 4, 0, 0, r);
  g.addColorStop(0, alpha(accent, 0.5));
  g.addColorStop(0.55, alpha(accent, 0.16));
  g.addColorStop(1, alpha(accent, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, 7);
  c.fill();
  // anéis que encolhem: o ímã puxa
  for (let i = 0; i < 3; i++) {
    const ph = wrapY(t * 0.9 + i / 3, 1);
    c.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
    c.strokeStyle = accent;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(0, 0, r * (1 - ph * 0.8), 0, 7);
    c.stroke();
  }
  c.globalAlpha = 1;
  // o ímã em ferradura: um U grosso, vermelho com pontas prateadas
  c.save();
  c.translate(0, 4);
  c.lineCap = 'butt';
  c.lineWidth = 11;
  c.strokeStyle = '#1a1a22';
  c.beginPath();
  c.arc(0, 0, 11, 0, Math.PI);
  c.moveTo(-11, 0);
  c.lineTo(-11, -14);
  c.moveTo(11, 0);
  c.lineTo(11, -14);
  c.stroke();
  c.lineWidth = 7;
  c.strokeStyle = '#e5303a';
  c.beginPath();
  c.arc(0, 0, 11, 0, Math.PI);
  c.moveTo(-11, 0);
  c.lineTo(-11, -9);
  c.moveTo(11, 0);
  c.lineTo(11, -9);
  c.stroke();
  c.strokeStyle = '#e8ebf2';
  c.beginPath();
  c.moveTo(-11, -9);
  c.lineTo(-11, -14);
  c.moveTo(11, -9);
  c.lineTo(11, -14);
  c.stroke();
  c.restore();
}

function icePatch(c: Ctx, r: number, t: number) {
  const g = c.createRadialGradient(-r * 0.2, -r * 0.2, 2, 0, 0, r);
  g.addColorStop(0, 'rgba(235,252,255,0.95)');
  g.addColorStop(0.7, 'rgba(160,220,245,0.85)');
  g.addColorStop(1, 'rgba(160,220,245,0.3)');
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r * (0.93 + 0.09 * Math.sin(a * 4 + 2));
    if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(90,160,200,0.75)';
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = 1.5;
  for (const [x0, y0, x1, y1] of [[-0.5, -0.1, 0.1, 0.3], [0.0, -0.45, 0.35, -0.05], [-0.2, 0.4, 0.4, 0.5]] as const) {
    c.beginPath();
    c.moveTo(x0 * r, y0 * r);
    c.lineTo(x1 * r, y1 * r);
    c.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    c.save();
    c.translate((hash(i, 610) - 0.5) * r * 1.2, (hash(i, 611) - 0.5) * r * 1.1);
    c.globalAlpha = a;
    c.fillStyle = '#ffffff';
    c.fillRect(-1, -6, 2, 12);
    c.fillRect(-6, -1, 12, 2);
    c.restore();
  }
}

// ---------------------------------------------------------------- obstáculos sólidos
/** Quanto o objeto amassa e treme quando leva uma batida. */
function squash(c: Ctx, bump: number, t: number) {
  if (bump <= 0) return;
  c.rotate(Math.sin(t * 60) * 0.06 * bump);
  c.scale(1 + 0.16 * bump, 1 - 0.2 * bump);
}

function pumpkin(c: Ctx, s: number) {
  const r = Math.max(8, s * 1.15);
  soft(c, r * 0.3, 1, r * 1.1, r * 0.35, 0.34);
  paint(c, ell(0, -r * 0.82, r * 1.0, r * 0.82), '#f08a1f', -r * 1.6, 0, 2, 0.3, 0.25);
  paint(c, ell(-r * 0.5, -r * 0.82, r * 0.5, r * 0.8), '#f5a13a', -r * 1.6, 0, 0, 0.2, 0.15);
  paint(c, ell(r * 0.5, -r * 0.82, r * 0.5, r * 0.8), '#e07814', -r * 1.6, 0, 0, 0.2, 0.15);
  c.strokeStyle = 'rgba(110,50,0,0.5)';
  c.lineWidth = 1.5;
  for (const dx of [-0.38, 0.38]) {
    c.beginPath();
    c.ellipse(r * dx, -r * 0.82, r * 0.34, r * 0.8, 0, -1.2, 1.2);
    c.stroke();
  }
  paint(c, rect(-r * 0.12, -r * 1.85, r * 0.24, r * 0.4, 2), '#4a7a2a', -r * 1.85, -r * 1.45, 1.4);
  gloss(c, -r * 0.4, -r * 1.2, r * 0.22, r * 0.12, 0.45);
}

function cone(c: Ctx, s: number) {
  const r = Math.max(8, s * 1.1);
  soft(c, r * 0.3, 1, r * 1.1, r * 0.35, 0.4);
  paint(c, rect(-r, -r * 0.3, r * 2, r * 0.3, 2), '#252a3c', -r * 0.3, 0, 1.6);
  paint(c, poly([[-r * 0.7, -r * 0.25], [-r * 0.2, -r * 2.1], [r * 0.2, -r * 2.1], [r * 0.7, -r * 0.25]]), '#ff7a1a', -r * 2.1, -r * 0.25, 2, 0.3, 0.2);
  c.save();
  c.beginPath();
  c.moveTo(-r * 0.7, -r * 0.25);
  c.lineTo(-r * 0.2, -r * 2.1);
  c.lineTo(r * 0.2, -r * 2.1);
  c.lineTo(r * 0.7, -r * 0.25);
  c.clip();
  c.fillStyle = '#f4f4ef';
  c.fillRect(-r, -r * 1.35, r * 2, r * 0.32);
  c.fillRect(-r, -r * 0.75, r * 2, r * 0.26);
  c.restore();
  glow(c, 0, -r * 2, r * 1.2, '#ffa040', 0.35);
}

function cactusSmall(c: Ctx, s: number) {
  const r = Math.max(8, s * 1.1);
  soft(c, r * 0.3, 1, r * 1.1, r * 0.35, 0.34);
  paint(c, ell(0, -r * 0.8, r * 0.95, r * 0.85), '#58a64e', -r * 1.65, 0, 2, 0.3, 0.25);
  c.strokeStyle = 'rgba(20,70,25,0.5)';
  c.lineWidth = 1.4;
  for (const dx of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.ellipse(r * dx, -r * 0.8, r * 0.3, r * 0.8, 0, -1.3, 1.3);
    c.stroke();
  }
  c.fillStyle = '#ff9ecf';
  c.beginPath();
  c.arc(0, -r * 1.72, r * 0.3, 0, 7);
  c.fill();
  gloss(c, -r * 0.4, -r * 1.2, r * 0.2, r * 0.1, 0.4);
}

function hayBale(c: Ctx, s: number) {
  const w = s * 1.9;
  const h = s * 1.5;
  soft(c, w * 0.15, 1, w * 0.62, h * 0.3, 0.34);
  paint(c, rect(-w / 2, -h, w, h, 5), '#e8c35c', -h, 0, 2, 0.28, 0.25);
  c.strokeStyle = 'rgba(130,90,20,0.5)';
  c.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + (i + 0.5) * (w / 7);
    c.beginPath();
    c.moveTo(x, -h + 3);
    c.lineTo(x + (hash(i, 620) - 0.5) * 4, -3);
    c.stroke();
  }
  c.fillStyle = '#9a4a2a';
  c.fillRect(-w / 2, -h * 0.6, w, 3);
  c.fillRect(-w / 2, -h * 0.25, w, 3);
  gloss(c, -w * 0.2, -h * 0.85, w * 0.2, 2.5, 0.3);
}

function trashBin(c: Ctx, s: number) {
  const w = s * 1.5;
  const h = s * 1.9;
  soft(c, w * 0.2, 1, w * 0.75, h * 0.2, 0.4);
  paint(c, poly([[-w / 2, -h * 0.85], [w / 2, -h * 0.85], [w * 0.42, 0], [-w * 0.42, 0]]), '#4b5b78', -h * 0.85, 0, 2, 0.3, 0.3);
  paint(c, rect(-w * 0.6, -h, w * 1.2, h * 0.2, 4), '#2b3550', -h, -h * 0.8, 1.8, 0.3, 0.2);
  c.strokeStyle = 'rgba(0,0,0,0.3)';
  c.lineWidth = 1.5;
  for (const dx of [-0.2, 0.05, 0.3]) {
    c.beginPath();
    c.moveTo(w * dx, -h * 0.75);
    c.lineTo(w * dx * 0.9, -4);
    c.stroke();
  }
  glow(c, 0, -h * 0.6, w * 0.9, '#25c7e8', 0.22);
  c.strokeStyle = alpha('#25c7e8', 0.8);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-w * 0.6, -h * 0.8);
  c.lineTo(w * 0.6, -h * 0.8);
  c.stroke();
}

function clayPot(c: Ctx, s: number) {
  const w = s * 1.5;
  const h = s * 1.9;
  soft(c, w * 0.2, 1, w * 0.7, h * 0.2, 0.34);
  paint(c, ell(0, -h * 0.45, w * 0.55, h * 0.48), '#c8683a', -h * 0.95, 0, 2, 0.3, 0.3);
  paint(c, rect(-w * 0.28, -h * 1.05, w * 0.56, h * 0.2, 4), '#b5562c', -h * 1.05, -h * 0.85, 1.8);
  c.strokeStyle = '#ffe3a0';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(-w * 0.45, -h * 0.5);
  for (let i = 0; i <= 8; i++) c.lineTo(-w * 0.45 + (w * 0.9 * i) / 8, -h * 0.5 + (i % 2 ? 5 : -5));
  c.stroke();
  gloss(c, -w * 0.25, -h * 0.7, w * 0.1, h * 0.14, 0.4, -0.2);
}

function boulder(c: Ctx, s: number) {
  const r = s * 1.2;
  soft(c, r * 0.3, 2, r * 1.15, r * 0.35, 0.38);
  paint(c, poly([[-r, 0], [-r * 0.85, -r * 1.0], [-r * 0.2, -r * 1.55], [r * 0.6, -r * 1.35], [r * 1.0, -r * 0.5], [r * 0.9, 0]]), '#8a8f94', -r * 1.55, 0, 2.2, 0.28, 0.3);
  paint(c, poly([[-r * 0.2, -r * 1.55], [r * 0.6, -r * 1.35], [r * 0.2, -r * 0.8], [-r * 0.5, -r * 0.9]]), '#a7adb2', -r * 1.55, -r * 0.8, 0, 0.2, 0.1);
  c.fillStyle = '#4f9a4a';
  for (const [dx, dy] of [[-0.55, -0.9], [-0.3, -0.7], [0.3, -0.4]] as const) {
    c.beginPath();
    c.ellipse(r * dx, r * dy, r * 0.28, r * 0.12, 0.2, 0, 7);
    c.fill();
  }
  c.fillStyle = '#ffd23f';
  c.beginPath();
  c.arc(-r * 0.5, -r * 1.0, 3, 0, 7);
  c.fill();
}

function parkedCar(c: Ctx, s: number, t: number) {
  const w = s * 2.0;
  const h = s * 2.3;
  soft(c, w * 0.18, 2, w * 0.62, h * 0.18, 0.45);
  // rodas
  for (const dx of [-1, 1]) {
    paint(c, rect(dx * w * 0.5 - 6, -h * 0.32, 12, h * 0.3, 3), '#14151f', -h * 0.32, -h * 0.02, 1.2);
  }
  paint(c, rect(-w * 0.52, -h * 0.72, w * 1.04, h * 0.66, 10), '#d8315b', -h * 0.72, -h * 0.06, 2.2, 0.28, 0.3);
  paint(c, rect(-w * 0.4, -h * 1.0, w * 0.8, h * 0.46, 9), '#bd2650', -h * 1.0, -h * 0.54, 2, 0.25, 0.25);
  paint(c, rect(-w * 0.32, -h * 0.94, w * 0.64, h * 0.28, 6), '#9fe6ff', -h * 0.94, -h * 0.66, 1.6, 0.3, 0.2);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.moveTo(-w * 0.28, -h * 0.9);
  c.lineTo(-w * 0.05, -h * 0.9);
  c.lineTo(-w * 0.18, -h * 0.7);
  c.lineTo(-w * 0.3, -h * 0.7);
  c.fill();
  for (const dx of [-1, 1]) {
    paint(c, ell(dx * w * 0.34, -h * 0.18, w * 0.1, h * 0.05), '#fff6c9', -h * 0.23, -h * 0.13, 1.2, 0.1, 0.1);
    glow(c, dx * w * 0.34, -h * 0.16, w * 0.5, '#ffe9a0', 0.4 + 0.05 * Math.sin(t * 2));
  }
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.fillRect(-w * 0.5, -h * 0.64, w, 3);
}

function statue(c: Ctx, s: number) {
  const w = s * 1.6;
  const h = s * 2.7;
  soft(c, w * 0.25, 2, w * 0.8, h * 0.1, 0.38);
  paint(c, rect(-w * 0.55, -h * 0.28, w * 1.1, h * 0.28, 4), '#c9a36e', -h * 0.28, 0, 2, 0.22, 0.3);
  paint(c, rect(-w * 0.34, -h * 0.9, w * 0.68, h * 0.64, 4), '#d7b682', -h * 0.9, -h * 0.26, 2, 0.22, 0.28);
  paint(c, poly([[-w * 0.44, -h * 0.9], [-w * 0.3, -h * 1.0], [w * 0.1, -h * 0.97], [w * 0.44, -h * 0.9]]), '#e0c291', -h * 1.0, -h * 0.9, 1.8, 0.2, 0.1);
  c.strokeStyle = 'rgba(80,50,30,0.5)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-w * 0.1, -h * 0.9);
  c.lineTo(w * 0.05, -h * 0.6);
  c.lineTo(-w * 0.12, -h * 0.4);
  c.stroke();
  c.fillStyle = '#7a3cff';
  c.beginPath();
  c.arc(0, -h * 0.65, 4, 0, 7);
  c.fill();
  glow(c, 0, -h * 0.65, 22, '#a98bff', 0.5);
}

/** O carrinho que desliza de um lado a outro: carrinho de mão, carrinho flutuante e trenó de pedra. */
function cart(c: Ctx, map: SinalMapId, s: number, t: number, dir: number) {
  const w = s * 2.2;
  const h = s * 1.5;
  soft(c, w * 0.15, 1, w * 0.7, h * 0.2, 0.36);
  c.save();
  c.scale(dir, 1);
  if (map === 'neon') {
    // flutua: brilho por baixo
    c.translate(0, -5 + Math.sin(t * 5) * 2);
    glow(c, 0, 4, w * 0.8, '#25c7e8', 0.55);
  }
  const body = map === 'horta' ? '#5a7a3a' : map === 'neon' ? '#3b4468' : '#b88a5a';
  paint(c, poly([[-w * 0.5, -h * 0.9], [w * 0.5, -h * 0.9], [w * 0.38, -h * 0.2], [-w * 0.38, -h * 0.2]]), body, -h * 0.9, -h * 0.2, 2, 0.28, 0.3);
  if (map === 'horta') {
    for (const [px, col] of [[-0.25, '#f08a1f'], [0.1, '#e07814'], [0.35, '#f5a13a']] as const) {
      paint(c, ell(w * px, -h * 1.0, w * 0.15, h * 0.28), col, -h * 1.28, -h * 0.74, 1.6, 0.3, 0.2);
    }
    c.strokeStyle = edgeDark(body);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w * 0.45, -h * 0.7);
    c.lineTo(w * 0.85, -h * 0.95);
    c.stroke();
  } else if (map === 'neon') {
    paint(c, rect(-w * 0.3, -h * 1.25, w * 0.34, h * 0.36, 3), '#e5303a', -h * 1.25, -h * 0.9, 1.6);
    paint(c, rect(w * 0.06, -h * 1.1, w * 0.3, h * 0.22, 3), '#ffd23f', -h * 1.1, -h * 0.88, 1.6);
  } else {
    paint(c, ell(-w * 0.15, -h * 1.0, w * 0.17, h * 0.3), '#c8683a', -h * 1.3, -h * 0.7, 1.6, 0.3, 0.2);
    paint(c, ell(w * 0.2, -h * 1.0, w * 0.15, h * 0.26), '#b5562c', -h * 1.26, -h * 0.74, 1.6, 0.3, 0.2);
  }
  if (map !== 'neon') {
    for (const dx of [-0.28, 0.3]) {
      const rot = t * 5 * dir;
      c.save();
      c.translate(w * dx, -h * 0.12);
      c.rotate(rot);
      paint(c, circle(0, 0, h * 0.2), '#2a2a30', -h * 0.2, h * 0.2, 1.6);
      c.strokeStyle = '#8a8a92';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-h * 0.14, 0);
      c.lineTo(h * 0.14, 0);
      c.moveTo(0, -h * 0.14);
      c.lineTo(0, h * 0.14);
      c.stroke();
      c.restore();
    }
  }
  c.restore();
}
const edgeDark = (hex: string) => mix(hex, '#07070d', 0.7);

/** O que rola para a frente e para trás: barril de madeira, tambor perigoso ou bola de espinhos seca. */
function barrel(c: Ctx, map: SinalMapId, s: number, t: number) {
  const r = s * 1.1;
  soft(c, r * 0.3, 1, r * 1.1, r * 0.3, 0.36);
  if (map === 'deserto') {
    // bola de mato seco, girando
    c.save();
    c.translate(0, -r);
    c.rotate(t * 3.2);
    c.strokeStyle = '#8a6a30';
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + hash(i, 630);
      const l = r * (0.7 + 0.4 * hash(i, 631));
      c.beginPath();
      c.moveTo(Math.cos(a) * l * 0.2, Math.sin(a) * l * 0.2);
      c.quadraticCurveTo(Math.cos(a + 0.5) * l * 0.8, Math.sin(a + 0.5) * l * 0.8, Math.cos(a) * l, Math.sin(a) * l);
      c.stroke();
    }
    c.fillStyle = 'rgba(160,120,50,0.5)';
    c.beginPath();
    c.arc(0, 0, r * 0.5, 0, 7);
    c.fill();
    c.restore();
    return;
  }
  const base = map === 'horta' ? '#8a5a2e' : '#2c2f40';
  paint(c, rect(-r * 0.85, -r * 2.0, r * 1.7, r * 2.0, r * 0.4), base, -r * 2.0, 0, 2.2, 0.3, 0.3);
  const bands = map === 'horta' ? '#4a4a52' : '#ffd23f';
  for (const yy of [0.35, 1.0, 1.65]) {
    paint(c, rect(-r * 0.87, -r * yy - 3, r * 1.74, 6, 2), bands, -r * yy - 3, -r * yy + 3, 1.2, 0.2, 0.2);
  }
  if (map === 'neon') {
    c.fillStyle = '#25c7e8';
    c.beginPath();
    c.arc(0, -r * 1.0, r * 0.25, 0, 7);
    c.fill();
    glow(c, 0, -r * 1.0, r * 1.2, '#25c7e8', 0.4);
  } else {
    c.strokeStyle = 'rgba(60,30,10,0.5)';
    c.lineWidth = 1.4;
    for (const dx of [-0.4, 0, 0.4]) {
      c.beginPath();
      c.moveTo(r * dx, -r * 1.9);
      c.lineTo(r * dx, -2);
      c.stroke();
    }
  }
  gloss(c, -r * 0.4, -r * 1.6, r * 0.14, r * 0.5, 0.25, 0);
}

/** O bicho que anda em volta: joaninha, drone ou escorpião. */
function critter(c: Ctx, map: SinalMapId, s: number, t: number) {
  const r = s * 1.0;
  soft(c, r * 0.2, 2, r * 1.1, r * 0.3, 0.34);
  if (map === 'horta') {
    // joaninha
    paint(c, ell(0, -r * 0.7, r * 1.05, r * 0.9), '#e5303a', -r * 1.6, 0, 2, 0.3, 0.3);
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -r * 1.55);
    c.lineTo(0, -r * 0.1);
    c.stroke();
    c.fillStyle = INK;
    for (const [dx, dy] of [[-0.45, -0.9], [0.45, -0.9], [-0.55, -0.35], [0.55, -0.35]] as const) {
      c.beginPath();
      c.arc(r * dx, r * dy, r * 0.17, 0, 7);
      c.fill();
    }
    paint(c, circle(0, -r * 1.55, r * 0.4), '#1b1b22', -r * 1.95, -r * 1.15, 1.4);
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    for (const dx of [-1, 1]) {
      c.beginPath();
      c.moveTo(dx * r * 0.2, -r * 1.85);
      c.quadraticCurveTo(dx * r * 0.5, -r * 2.3, dx * r * 0.7, -r * 2.1);
      c.stroke();
    }
    gloss(c, -r * 0.4, -r * 1.2, r * 0.2, r * 0.1, 0.5);
  } else if (map === 'neon') {
    // drone com hélices e uma luz
    c.save();
    c.translate(0, -r * 1.1 + Math.sin(t * 6) * 2);
    glow(c, 0, r * 0.9, r * 1.4, '#25c7e8', 0.5);
    paint(c, ell(0, 0, r * 0.7, r * 0.45), '#3b4468', -r * 0.5, r * 0.5, 2, 0.3, 0.3);
    for (const dx of [-1, 1]) {
      c.strokeStyle = '#9aa3c8';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(dx * r * 0.5, 0);
      c.lineTo(dx * r * 1.0, -r * 0.2);
      c.stroke();
      c.save();
      c.translate(dx * r * 1.0, -r * 0.25);
      c.globalAlpha = 0.6;
      c.fillStyle = '#cfe9ff';
      c.beginPath();
      c.ellipse(0, 0, r * 0.45, r * 0.1, Math.sin(t * 30) * 0.2, 0, 7);
      c.fill();
      c.restore();
    }
    c.fillStyle = '#ff3d9a';
    c.beginPath();
    c.arc(0, 0, r * 0.18, 0, 7);
    c.fill();
    glow(c, 0, 0, r * 0.9, '#ff3d9a', 0.8);
    c.restore();
  } else {
    // escorpião
    const sway = Math.sin(t * 7) * 0.12;
    paint(c, ell(0, -r * 0.6, r * 0.85, r * 0.6), '#b5562c', -r * 1.2, 0, 2, 0.3, 0.3);
    c.save();
    c.rotate(sway);
    c.strokeStyle = '#8a3f1e';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, -r * 0.2);
    c.quadraticCurveTo(r * 1.0, -r * 0.4, r * 0.7, -r * 1.5);
    c.quadraticCurveTo(r * 0.5, -r * 1.9, r * 0.1, -r * 1.7);
    c.stroke();
    paint(c, poly([[r * 0.1, -r * 1.7], [r * 0.3, -r * 1.95], [0, -r * 2.0]]), '#ff9ecf', -r * 2.0, -r * 1.7, 1.2);
    c.restore();
    for (const dx of [-1, 1]) {
      paint(c, ell(dx * r * 0.9, -r * 0.9, r * 0.4, r * 0.26, dx * 0.5), '#c8683a', -r * 1.2, -r * 0.6, 1.6);
    }
    c.fillStyle = INK;
    for (const dx of [-0.25, 0.25]) {
      c.beginPath();
      c.arc(r * dx, -r * 0.9, 2.2, 0, 7);
      c.fill();
    }
  }
}

function sawBlade(c: Ctx, map: SinalMapId, s: number, t: number) {
  const r = s * 1.3;
  const col = map === 'horta' ? '#a9afb8' : map === 'neon' ? '#8fa0c8' : '#b8a888';
  soft(c, r * 0.2, 2, r * 1.1, r * 0.3, 0.4);
  c.save();
  c.translate(0, -r * 0.8);
  c.rotate(t * 11);
  const teeth = 14;
  c.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.82 : r * 1.12;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  const g = c.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 1.1);
  g.addColorStop(0, shade(col, 0.4));
  g.addColorStop(1, shade(col, -0.25));
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 2.2;
  c.strokeStyle = '#2a2d36';
  c.stroke();
  c.fillStyle = '#e5303a';
  c.beginPath();
  c.arc(0, 0, r * 0.28, 0, 7);
  c.fill();
  c.strokeStyle = '#2a2d36';
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r * 0.6, 0.3, 2.6);
  c.strokeStyle = 'rgba(40,45,54,0.5)';
  c.stroke();
  c.restore();
  // fagulhas
  c.fillStyle = '#ffd23f';
  for (let i = 0; i < 4; i++) {
    const ph = wrapY(t * 2 + i * 0.25, 1);
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.arc(Math.cos(i * 2.4 + t) * r * (0.5 + ph), -r * 0.8 + Math.sin(i * 2.4 + t) * r * (0.5 + ph), 2.2 * (1 - ph) + 0.4, 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
}

function springPad(c: Ctx, map: SinalMapId, s: number, bump: number, t: number) {
  const r = Math.max(10, s * 1.3);
  soft(c, r * 0.2, 1, r * 1.1, r * 0.3, 0.36);
  const squashK = 1 - 0.55 * bump;
  const top = map === 'horta' ? '#e5303a' : map === 'neon' ? '#ff3d9a' : '#ff9ecf';
  // a mola
  c.save();
  c.translate(0, 0);
  c.strokeStyle = '#b8bcc8';
  c.lineWidth = 3.4;
  c.lineCap = 'round';
  c.beginPath();
  const turns = 5;
  const hh = r * 1.2 * squashK;
  for (let i = 0; i <= turns * 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * r * 0.5;
    const y = -(i / (turns * 8)) * hh + Math.sin(a) * 2;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.stroke();
  c.restore();
  const topY = -r * 1.2 * squashK;
  if (map === 'horta') {
    // cogumelo
    paint(c, ell(0, topY - r * 0.1, r * 1.1, r * 0.6), top, topY - r * 0.7, topY + r * 0.5, 2, 0.3, 0.25);
    c.fillStyle = '#ffffff';
    for (const [dx, dy, dr] of [[-0.5, -0.1, 0.17], [0.1, -0.3, 0.2], [0.55, 0.0, 0.14]] as const) {
      c.beginPath();
      c.arc(r * dx, topY + r * dy, r * dr, 0, 7);
      c.fill();
    }
  } else {
    paint(c, rect(-r * 1.0, topY - r * 0.3, r * 2.0, r * 0.5, r * 0.25), top, topY - r * 0.3, topY + r * 0.2, 2, 0.3, 0.25);
    if (map === 'neon') glow(c, 0, topY, r * 1.4, '#ff3d9a', 0.5 + 0.2 * Math.sin(t * 6));
    else {
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(0, topY - r * 0.05, r * 0.2, 0, 7);
      c.fill();
    }
  }
  gloss(c, -r * 0.4, topY - r * 0.2, r * 0.25, r * 0.08, 0.5);
}

/** Desenha um obstáculo com a base em (x, y); `r` é o raio do corpo (ou da zona) em pixels de arte. */
export function obstacle(
  c: Ctx,
  map: SinalMapId,
  kind: ObstacleKind,
  x: number,
  y: number,
  r: number,
  t: number,
  dir: -1 | 1,
  bump: number,
) {
  c.save();
  c.translate(x, y);
  if (isFloor(kind)) {
    if (kind === 'lamacal') mudZone(c, map, r, t);
    else if (kind === 'esteira') conveyor(c, map, r, t, dir);
    else if (kind === 'ima') magnet(c, map, r, t);
    else icePatch(c, r, t);
    c.restore();
    return;
  }
  squash(c, bump, t);
  if (kind === 'pequeno') (map === 'horta' ? pumpkin : map === 'neon' ? cone : cactusSmall)(c, r);
  else if (kind === 'medio') (map === 'horta' ? hayBale : map === 'neon' ? trashBin : clayPot)(c, r);
  else if (kind === 'grande') {
    if (map === 'horta') boulder(c, r);
    else if (map === 'neon') parkedCar(c, r, t);
    else statue(c, r);
  } else if (kind === 'deslizante') cart(c, map, r, t, dir);
  else if (kind === 'vaivem') barrel(c, map, r, t);
  else if (kind === 'orbita') critter(c, map, r, t);
  else if (kind === 'serra') sawBlade(c, map, r, t);
  else if (kind === 'mola') springPad(c, map, r, bump, t);
  if (bump > 0.6) {
    // estrelinha da batida
    const k = (bump - 0.6) / 0.4;
    c.fillStyle = YEL;
    c.beginPath();
    star(r * 0.6, -r * 1.4, 14 * k, 6 * k, 8, t * 4)(c);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- esconderijos
/** O anel tracejado da zona de proteção e o quanto ela ainda aguenta. */
export function zoneRing(c: Ctx, x: number, y: number, active: boolean, t: number, frac: number, len = 0) {
  const r = COVER_ZONE_R * V;
  c.save();
  c.translate(x, y);
  const low = frac < 0.4;
  const col = active ? (low ? '#ff6a2b' : '#33c27f') : 'rgba(255,255,255,0.7)';
  c.setLineDash([9, 7]);
  c.lineDashOffset = -t * (active ? 24 : 8);
  c.lineWidth = active ? 3.4 : 2.2;
  c.globalAlpha = active ? 0.95 : 0.5;
  c.strokeStyle = col;
  c.beginPath();
  if (len > 0) {
    c.roundRect(-r, -len - r, r * 2, len + r * 2, r);
  } else {
    c.arc(0, 0, r, 0, Math.PI * 2);
  }
  c.stroke();
  c.setLineDash([]);
  if (active) {
    c.fillStyle = alpha(low ? '#ff6a2b' : '#33c27f', 0.12);
    c.fill();
    // a barra do que ainda aguenta, em arco
    c.lineWidth = 4;
    c.globalAlpha = 0.9;
    c.strokeStyle = low ? '#ff6a2b' : '#33c27f';
    c.beginPath();
    c.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac, 0, 1));
    if (len === 0) c.stroke();
  }
  c.restore();
}

/** Um esconderijo pequeno: arbusto na horta, caçamba na rua, cacto no deserto. Centro da zona em (x, y). */
export function cover(c: Ctx, map: SinalMapId, x: number, y: number, occupied: boolean, t: number, frac: number, fragile: boolean) {
  zoneRing(c, x, y, occupied, t, frac);
  c.save();
  c.translate(x, y + 14);
  const shake = fragile && frac < 0.5 ? Math.sin(t * 40) * 1.4 : 0;
  c.translate(shake, 0);
  if (map === 'horta') bush(c, fragile, t);
  else if (map === 'neon') dumpster(c, fragile);
  else barrelCacti(c, fragile);
  c.restore();
}

function bush(c: Ctx, fragile: boolean, t: number) {
  const g = fragile ? ['#9a9a3a', '#7a7a2c', '#b0a040'] : ['#3f9446', '#2f7a36', '#58b050'];
  soft(c, 10, 4, 52, 12, 0.36);
  const blobs: [number, number, number, string][] = [
    [-26, -16, 22, g[1]!],
    [26, -16, 22, g[1]!],
    [-8, -28, 26, g[0]!],
    [14, -30, 22, g[2]!],
    [0, -14, 26, g[0]!],
  ];
  for (const [bx, by, br, col] of blobs) paint(c, circle(bx, by + Math.sin(t * 1.4 + bx) * 0.6, br), col, by - br, by + br, 2, 0.3, 0.28);
  c.strokeStyle = 'rgba(20,60,25,0.35)';
  c.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    const lx = -32 + hash(i, 700) * 64;
    const ly = -44 + hash(i, 701) * 36;
    c.beginPath();
    c.moveTo(lx, ly);
    c.quadraticCurveTo(lx + 5, ly - 4, lx + 8, ly + 1);
    c.stroke();
  }
  if (!fragile) {
    for (const [bx, by] of [[-18, -30], [8, -40], [22, -22], [-4, -18]] as const) {
      c.fillStyle = '#e5303a';
      c.beginPath();
      c.arc(bx, by, 4, 0, 7);
      c.fill();
      gloss(c, bx - 1.3, by - 1.3, 1.5, 1, 0.8);
    }
  } else {
    c.strokeStyle = '#6a5a20';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-14, -20);
    c.lineTo(-6, -34);
    c.moveTo(10, -26);
    c.lineTo(18, -14);
    c.stroke();
  }
}

function dumpster(c: Ctx, fragile: boolean) {
  const body = fragile ? '#8a6a3a' : '#2f7a56';
  soft(c, 10, 4, 54, 11, 0.42);
  paint(c, rect(-40, -38, 80, 40, 5), body, -38, 2, 2.2, 0.26, 0.32);
  paint(c, rect(-44, -48, 88, 14, 5), shade(body, -0.22), -48, -34, 2, 0.2, 0.2);
  c.strokeStyle = 'rgba(0,0,0,0.3)';
  c.lineWidth = 2;
  for (const dx of [-24, 0, 24]) {
    c.beginPath();
    c.moveTo(dx, -32);
    c.lineTo(dx, -4);
    c.stroke();
  }
  paint(c, rect(-34, -22, 28, 10, 3), '#ff3d9a', -22, -12, 1.4, 0.2, 0.1);
  glow(c, -20, -17, 30, '#ff3d9a', 0.35);
  paint(c, rect(8, -24, 24, 8, 3), '#25c7e8', -24, -16, 1.4, 0.2, 0.1);
  for (const dx of [-30, 30]) paint(c, circle(dx, 5, 5), '#15161f', 0, 10, 1.4);
  if (fragile) {
    c.strokeStyle = '#4a2a10';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, -38);
    c.lineTo(0, -24);
    c.lineTo(-6, -12);
    c.stroke();
  }
}

function barrelCacti(c: Ctx, fragile: boolean) {
  soft(c, 10, 4, 50, 11, 0.34);
  const g = fragile ? '#8a9a4a' : '#58a64e';
  for (const [dx, dy, r] of [[-24, -14, 20], [22, -16, 22], [0, -24, 26]] as const) {
    paint(c, ell(dx, dy, r * 0.9, r), g, dy - r, dy + r, 2, 0.3, 0.28);
    c.strokeStyle = 'rgba(20,70,25,0.5)';
    c.lineWidth = 1.5;
    for (const k of [-0.5, 0, 0.5]) {
      c.beginPath();
      c.ellipse(dx + r * k * 0.8, dy, r * 0.3, r * 0.95, 0, -1.4, 1.4);
      c.stroke();
    }
    c.fillStyle = fragile ? '#c8a06a' : '#ff9ecf';
    c.beginPath();
    c.arc(dx, dy - r - 2, 4.6, 0, 7);
    c.fill();
    c.strokeStyle = 'rgba(255,255,230,0.8)';
    c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = hash(i, dx + 710) * 6.28;
      c.beginPath();
      c.moveTo(dx + Math.cos(a) * r * 0.6, dy + Math.sin(a) * r * 0.6);
      c.lineTo(dx + Math.cos(a) * r * 0.8, dy + Math.sin(a) * r * 0.8);
      c.stroke();
    }
  }
}

/**
 * Moita comprida (5 a 14 m, para a frente): três desenhos por mapa, escolhidos pelo número dela.
 * `y0` é a base (perto da pessoa) e `yTop` o fim (longe), na tela.
 */
export function longCover(
  c: Ctx,
  map: SinalMapId,
  x: number,
  y0: number,
  yTop: number,
  occupied: boolean,
  t: number,
  frac: number,
  id: number,
) {
  const len = y0 - yTop;
  zoneRing(c, x, y0, occupied, t, frac, len);
  const variant = id % 3;
  const step = 30;
  const n = Math.max(2, Math.round(len / step));
  const seg = len / n;
  c.save();
  c.translate(x, 0);
  // do fundo para a frente
  for (let i = n - 1; i >= 0; i--) {
    const yy = yTop + (i + 1) * seg;
    c.save();
    c.translate(0, yy);
    longSegment(c, map, variant, i, n, seg, t);
    c.restore();
  }
  c.restore();
}

function longSegment(c: Ctx, map: SinalMapId, variant: number, i: number, n: number, seg: number, t: number) {
  const first = i === 0;
  const last = i === n - 1;
  const sd = i * 7 + variant;
  if (map === 'horta') {
    if (variant === 0) {
      // sebe de bagas
      soft(c, 8, 2, 46, 9, 0.34);
      for (const [bx, by, br, col] of [[-16, -12, 22, '#2f7a36'], [16, -12, 22, '#2f7a36'], [0, -22, 24, '#3f9446']] as const) {
        paint(c, circle(bx, by, br), col, by - br, by + br, 2, 0.3, 0.28);
      }
      for (let k = 0; k < 3; k++) {
        c.fillStyle = k % 2 ? '#7a3cff' : '#e5303a';
        c.beginPath();
        c.arc(-16 + hash(sd, k) * 32, -30 + hash(sd, k + 3) * 18, 3.6, 0, 7);
        c.fill();
      }
    } else if (variant === 1) {
      // túnel de arbusto: arco escuro por onde dá para correr
      soft(c, 8, 2, 48, 9, 0.34);
      paint(c, rect(-34, -34, 68, 34, 16), '#2f7a36', -34, 0, 2, 0.3, 0.3);
      c.fillStyle = 'rgba(8,24,12,0.55)';
      c.beginPath();
      c.roundRect(-18, -22, 36, 22, 12);
      c.fill();
      for (const dx of [-24, 24]) paint(c, circle(dx, -20, 14), '#3f9446', -34, -6, 1.8, 0.3, 0.25);
    } else {
      // milharal: hastes altas com espigas
      soft(c, 8, 2, 46, 9, 0.3);
      for (let k = 0; k < 6; k++) {
        const bx = -30 + k * 12 + hash(sd, k) * 4;
        const sway = Math.sin(t * 1.6 + k + i) * 2;
        c.strokeStyle = '#5a8a2a';
        c.lineWidth = 3.4;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(bx, 0);
        c.quadraticCurveTo(bx + sway, -24, bx + sway * 1.5, -46 - hash(sd, k + 9) * 8);
        c.stroke();
        paint(c, ell(bx + sway * 1.5 + 4, -34, 4, 9, 0.3), '#f2cc4a', -43, -25, 1.2);
        c.strokeStyle = '#3f7a24';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(bx, -18);
        c.lineTo(bx - 12, -28);
        c.moveTo(bx, -12);
        c.lineTo(bx + 12, -22);
        c.stroke();
      }
    }
  } else if (map === 'neon') {
    if (variant === 0) {
      // túnel de cano
      soft(c, 8, 2, 46, 9, 0.4);
      paint(c, rect(-32, -38, 64, 38 + (last ? 0 : 2), 17), '#5a6a8a', -38, 0, 2.2, 0.34, 0.3);
      c.fillStyle = 'rgba(8,10,24,0.7)';
      c.beginPath();
      c.roundRect(-18, -26, 36, 26, 13);
      c.fill();
      c.fillStyle = '#25c7e8';
      c.fillRect(-32, -22, 64, 3);
      glow(c, 0, -20, 40, '#25c7e8', 0.28);
      if (first || last) {
        for (const dx of [-26, 26]) paint(c, circle(dx, -30, 3), '#9aa3c8', -33, -27, 1);
      }
    } else if (variant === 1) {
      // contêineres lado a lado
      soft(c, 8, 2, 50, 9, 0.4);
      const col = ['#e5303a', '#2f5bff', '#ffa31a', '#2f9a6a'][(i + id0(sd)) % 4]!;
      paint(c, rect(-36, -40, 72, 40, 3), col, -40, 0, 2.2, 0.26, 0.3);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 2;
      for (let k = -3; k <= 3; k++) {
        c.beginPath();
        c.moveTo(k * 10, -38);
        c.lineTo(k * 10, -2);
        c.stroke();
      }
      paint(c, rect(-36, -44, 72, 7, 2), shade(col, -0.25), -44, -37, 1.6, 0.2, 0.2);
    } else {
      // toldo listrado
      soft(c, 8, 2, 48, 9, 0.34);
      for (const dx of [-30, 30]) paint(c, rect(dx - 2.5, -44, 5, 44, 2), '#9aa3c8', -44, 0, 1.4, 0.3, 0.3);
      const stripe = i % 2 ? '#f4f4ef' : '#ff3d9a';
      paint(c, poly([[-38, -44], [38, -44], [44, -28], [-44, -28]]), stripe, -44, -28, 2, 0.2, 0.2);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(-44, -28, 88, 6);
      glow(c, 0, -26, 50, '#ff3d9a', 0.18);
    }
  } else {
    if (variant === 0) {
      // túnel de pedras
      soft(c, 8, 2, 46, 9, 0.36);
      paint(c, rect(-34, -38, 68, 38, 16), '#b0865a', -38, 0, 2.2, 0.26, 0.3);
      c.fillStyle = 'rgba(30,16,8,0.6)';
      c.beginPath();
      c.roundRect(-17, -26, 34, 26, 12);
      c.fill();
      c.strokeStyle = 'rgba(70,40,20,0.5)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-26, -34);
      c.lineTo(-22, -20);
      c.moveTo(24, -36);
      c.lineTo(28, -22);
      c.stroke();
    } else if (variant === 1) {
      // cactos floridos
      soft(c, 8, 2, 40, 9, 0.32);
      const bx = -14 + hash(sd, 1) * 28;
      paint(c, rect(bx - 8, -50, 16, 50, 8), '#4f9a4a', -50, 0, 2, 0.3, 0.28);
      paint(c, rect(bx - 24, -34, 9, 18, 4), '#4f9a4a', -34, -16, 1.8, 0.3, 0.25);
      paint(c, rect(bx - 24, -24, 18, 8, 4), '#4f9a4a', -24, -16, 1.8, 0.3, 0.25);
      c.fillStyle = '#ff9ecf';
      c.beginPath();
      c.arc(bx, -54, 5, 0, 7);
      c.fill();
      for (const [dx, dy] of [[-26, -14], [22, -6]] as const) {
        paint(c, ell(dx, dy, 9, 11), '#58a64e', dy - 11, dy + 11, 1.6, 0.3, 0.25);
      }
    } else {
      // muro de ruína
      soft(c, 8, 2, 48, 9, 0.36);
      paint(c, rect(-36, -34, 72, 34, 3), '#c9a36e', -34, 0, 2.2, 0.22, 0.3);
      c.strokeStyle = 'rgba(80,50,30,0.5)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-36, -17);
      c.lineTo(36, -17);
      c.moveTo(-12, -34);
      c.lineTo(-12, -17);
      c.moveTo(14, -17);
      c.lineTo(14, 0);
      c.stroke();
      if (i % 2) paint(c, poly([[-36, -34], [-20, -44], [-4, -34]]), '#b78b57', -44, -34, 1.6);
      c.fillStyle = '#7a3cff';
      c.beginPath();
      c.arc(0, -26, 3, 0, 7);
      c.fill();
      glow(c, 0, -26, 18, '#a98bff', 0.4);
    }
  }
  void seg;
}
const id0 = (n: number) => n % 4;

// ---------------------------------------------------------------- chegada
export function finishLine(c: Ctx, cx: number, y: number, halfPx: number, t: number) {
  const w = halfPx * 2;
  const x0 = cx - halfPx;
  const sq = 18;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(x0 + 4, y - sq + 5, w, sq * 2);
  for (let i = 0; i < Math.ceil(w / sq); i++) {
    for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? '#15151a' : PAPER;
      c.fillRect(x0 + i * sq, y - sq + j * sq, sq, sq);
    }
  }
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.strokeRect(x0, y - sq, w, sq * 2);
  for (const sx of [x0 - 8, x0 + w + 8]) {
    paint(c, rect(sx - 5, -70 + y, 10, 82, 3), YEL, y - 70, y + 12, 2, 0.3, 0.25);
  }
  // faixa no alto
  const wave = Math.sin(t * 3) * 2;
  c.beginPath();
  c.moveTo(x0 - 8, y - 66);
  c.quadraticCurveTo(cx, y - 50 + wave, x0 + w + 8, y - 66);
  c.lineTo(x0 + w + 8, y - 36);
  c.quadraticCurveTo(cx, y - 20 + wave, x0 - 8, y - 36);
  c.closePath();
  c.fillStyle = '#e5303a';
  c.fill();
  c.lineWidth = 2.4;
  c.strokeStyle = INK;
  c.stroke();
  mono(c, 'CHEGADA', cx, y - 40 + wave * 0.6, 14, PAPER, 'center');
  c.restore();
}
