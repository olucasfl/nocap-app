import { MAX_LIVES, PLATFORM_H, PLATFORM_W, SPAWN_GAP, TOWER_KINDS, type TowersGame } from '@nocap/games';
import { BLOCK_HEX, INK, shade } from '../art';

/**
 * O desenho do Block Towers (Canvas 2D): céu em faixas que vai do entardecer à noite conforme a
 * torre cresce, sol e lua de contorno, nuvens, montanhas e rochas flutuantes em formas chapadas,
 * a ilha da plataforma, os blocos biselados do Block's, o guia da próxima queda, o mago do NoCap
 * com os corações de vida e as partículas de cada acontecimento. Só desenha: nada aqui muda o jogo.
 */

export type Space = 'world' | 'screen';
export interface Particle {
  space: Space;
  kind: 'dust' | 'spark' | 'shard' | 'leaf' | 'star' | 'ring' | 'heart' | 'halfheart' | 'x' | 'swirl';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  gravity: number;
}
export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
  space: Space;
}
export type WizardMood = 'idle' | 'cheer' | 'scared' | 'faint';

export interface Fx {
  particles: Particle[];
  popups: Popup[];
  shake: number;
  camY: number;
  time: number;
  mood: WizardMood;
  moodT: number;
  /** Instantes (em `time`) em que cada coração se quebrou, para a animação de cair. */
  heartBroke: number[];
  heartGain: number[];
  prevLives: number;
  /** O quanto a peça que desce ainda está "deslizando" até a casa nova (em casas, decai rápido). */
  slide: number;
  /** Flash de dano nas bordas (0 a 1). */
  hurt: number;
  /** Clarão de cor (magia), 0 a 1. */
  glow: number;
  glowColor: string;
  /** Escurece o fim de jogo (0 a 1). */
  dark: number;
}

export function createFx(): Fx {
  return {
    particles: [],
    popups: [],
    shake: 0,
    camY: 0,
    time: 0,
    mood: 'idle',
    moodT: 0,
    heartBroke: [],
    heartGain: [],
    prevLives: MAX_LIVES,
    slide: 0,
    hurt: 0,
    glow: 0,
    glowColor: '#ffffff',
    dark: 0,
  };
}

// --- Utilidades ---------------------------------------------------------------------------------
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const f = clamp01(t);
  return `rgb(${Math.round(lerp(r1, r2, f))},${Math.round(lerp(g1, g2, f))},${Math.round(lerp(b1, b2, f))})`;
}

/** Retângulo arredondado, com saída para navegadores sem `roundRect`. */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Número pseudoaleatório estável a partir de um índice (para estrelas, nuvens e rochas). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// --- Paleta do céu --------------------------------------------------------------------------
const DAY = ['#ffd27a', '#ffbd62', '#ffa65a', '#ff9a5e', '#ffb09a', '#ffd4b0', '#ffe8c8'];
const DUSK = ['#ff9a6b', '#ff7f7f', '#ec6a9c', '#c25db0', '#8456b8', '#5f4cab', '#4a3d99'];
const NIGHT = ['#1b1740', '#241a58', '#2f2174', '#3d2a8a', '#4f379f', '#6446b3', '#7a58c4'];

function skyColors(p: number): string[] {
  return DAY.map((_, i) => (p < 0.5 ? mix(DAY[i]!, DUSK[i]!, p * 2) : mix(DUSK[i]!, NIGHT[i]!, (p - 0.5) * 2)));
}

// --- Cenário --------------------------------------------------------------------------------
function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, fx: Fx) {
  const cols = skyColors(p);
  const bandH = H / cols.length;
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * bandH - 1, W, bandH + 2);
  });

  // estrelas
  if (p > 0.4) {
    const a = clamp01((p - 0.4) * 2);
    for (let i = 0; i < 46; i++) {
      const x = hash(i) * W;
      const y = hash(i + 99) * H * 0.7;
      const tw = 0.5 + 0.5 * Math.sin(fx.time * (1.2 + hash(i + 7) * 2) + i);
      const s = 1.5 + hash(i + 33) * 2.6;
      ctx.globalAlpha = a * (0.45 + 0.55 * tw);
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.6);
      ctx.lineTo(x + s * 0.5, y);
      ctx.lineTo(x, y + s * 1.6);
      ctx.lineTo(x - s * 0.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 1.6, y);
      ctx.lineTo(x, y + s * 0.5);
      ctx.lineTo(x + s * 1.6, y);
      ctx.lineTo(x, y - s * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // sol (some quando a noite chega) e lua (sobe)
  const R = Math.min(W, H) * 0.1;
  const sunA = clamp01(1 - p * 1.7);
  if (sunA > 0.02) {
    const sx = W * 0.7;
    const sy = H * 0.2 + p * H * 0.28;
    ctx.globalAlpha = sunA;
    for (const [k, al] of [[2.1, 0.12], [1.6, 0.2], [1.25, 0.3]] as const) {
      ctx.fillStyle = `rgba(255,244,190,${al})`;
      ctx.beginPath();
      ctx.arc(sx, sy, R * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(sx + 5, sy + 5, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const moonA = clamp01((p - 0.35) * 2);
  if (moonA > 0.02) {
    const mx = W * 0.3;
    const my = H * 0.45 - moonA * H * 0.27;
    ctx.globalAlpha = moonA;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(mx + 5, my + 5, R * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(mx, my, R * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(180,160,120,.45)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.1, 0.35, 0.12]] as const) {
      ctx.beginPath();
      ctx.arc(mx + dx * R, my + dy * R, r * R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 1.6 * s, y);
  ctx.arc(x - 1.0 * s, y - 0.2 * s, 0.7 * s, Math.PI, Math.PI * 1.55);
  ctx.arc(x, y - 0.65 * s, 0.9 * s, Math.PI * 1.2, Math.PI * 1.95);
  ctx.arc(x + 1.0 * s, y - 0.2 * s, 0.75 * s, Math.PI * 1.45, Math.PI * 2.1);
  ctx.lineTo(x + 1.75 * s, y + 0.1 * s);
  ctx.quadraticCurveTo(x + 1.75 * s, y + 0.5 * s, x + 1.25 * s, y + 0.5 * s);
  ctx.lineTo(x - 1.25 * s, y + 0.5 * s);
  ctx.quadraticCurveTo(x - 1.75 * s, y + 0.5 * s, x - 1.6 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, camY: number, ppu: number, fx: Fx) {
  const cols = skyColors(p);
  const horizon = H * 0.68;
  const cloudFill = mix('#fff4e0', '#8a78cf', p);
  const farFill = mix('#e98a5a', '#43347f', p);
  const midFill = mix('#d4684a', '#2f2468', p);
  const rockFill = mix('#f0a070', '#5c4aa8', p);

  // rochas flutuantes ao longe
  for (let i = 0; i < 6; i++) {
    const par = 0.18 + hash(i + 5) * 0.12;
    const x = ((hash(i) * 1.4 - 0.2) * W + Math.sin(fx.time * 0.3 + i) * 6 + W * 2) % (W * 1.3) - W * 0.15;
    const y = horizon - (1.5 + hash(i + 40) * 9) * ppu - camY * ppu * par + Math.sin(fx.time * 0.6 + i * 2) * 4;
    const s = (0.8 + hash(i + 12) * 1.3) * ppu * 0.7;
    ctx.fillStyle = rockFill;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s * 0.6, y - s * 0.55);
    ctx.lineTo(x + s * 0.7, y - s * 0.5);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.35, y + s * 1.05);
    ctx.lineTo(x - s * 0.2, y + s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // nuvens
  for (let i = 0; i < 7; i++) {
    const par = 0.35 + hash(i + 70) * 0.35;
    const speed = 5 + hash(i + 3) * 9;
    const span = W + 8 * ppu;
    const x = ((hash(i + 20) * span + fx.time * speed) % span) - 4 * ppu;
    const y = horizon - (2 + hash(i + 60) * 14) * ppu - camY * ppu * par;
    cloud(ctx, x, y, ppu * (0.8 + hash(i + 8) * 0.7), cloudFill);
  }

  // montanhas (duas camadas) com parallax vertical suave
  const layer = (yBase: number, amp: number, step: number, seed: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    ctx.lineTo(-10, yBase);
    for (let x = -10, i = 0; x <= W + step; x += step, i++) {
      const peak = hash(i + seed) > 0.45;
      ctx.lineTo(x + step * 0.5, yBase - amp * (peak ? 0.55 + hash(i * 3 + seed) * 0.45 : 0.15));
      ctx.lineTo(x + step, yBase - amp * 0.08);
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  layer(horizon + 1.5 * ppu - camY * ppu * 0.5, 7.5 * ppu, 4.2 * ppu, 11, farFill);
  layer(horizon + 3.1 * ppu - camY * ppu * 0.75, 5 * ppu, 3.1 * ppu, 29, midFill);

  // névoa do fundo, que sobe do chão
  ctx.fillStyle = mix('#fff2dc', cols[cols.length - 1]!, 0.5 + p * 0.3);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, H * 0.9, W, H * 0.1 + 2);
  ctx.globalAlpha = 1;
}

// --- Ilha da plataforma ---------------------------------------------------------------------
function drawIsland(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, ppu: number, p: number) {
  const left = X(-PLATFORM_W / 2);
  const right = X(PLATFORM_W / 2);
  const top = Y(0);
  const w = right - left;
  const soil = mix('#8a5a34', '#4c3a66', p * 0.8);
  const rock = mix('#a8745a', '#5a4a80', p * 0.8);
  const rockDark = mix('#7c523c', '#3c3060', p * 0.8);
  const bodyH = PLATFORM_H * ppu;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;

  // sombra dura
  ctx.fillStyle = 'rgba(17,17,17,.9)';
  ctx.beginPath();
  ctx.moveTo(left + 7, top + bodyH + 7);
  ctx.lineTo(right + 7, top + bodyH + 7);
  ctx.lineTo(X(0.2) + 7, Y(PLATFORM_H + 4.2) + 7);
  ctx.closePath();
  ctx.fill();

  // pedra que afina para baixo
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.04, top + bodyH * 0.9);
  ctx.lineTo(right - w * 0.04, top + bodyH * 0.9);
  ctx.lineTo(X(1.6), Y(PLATFORM_H + 1.6));
  ctx.lineTo(X(0.6), Y(PLATFORM_H + 4.4));
  ctx.lineTo(X(-0.4), Y(PLATFORM_H + 2.4));
  ctx.lineTo(X(-1.9), Y(PLATFORM_H + 1.5));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rockDark;
  ctx.beginPath();
  ctx.moveTo(X(0.9), top + bodyH * 0.9);
  ctx.lineTo(right - w * 0.04, top + bodyH * 0.9);
  ctx.lineTo(X(1.6), Y(PLATFORM_H + 1.6));
  ctx.lineTo(X(0.6), Y(PLATFORM_H + 4.4));
  ctx.lineTo(X(0.5), Y(PLATFORM_H + 2.6));
  ctx.closePath();
  ctx.fill();

  // cristais (laranja e azul) pendurados
  const crystal = (cx: number, cy: number, s: number, c: string) => {
    ctx.fillStyle = c;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.9);
    ctx.lineTo(cx, cy + s * 2.1);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.1, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.18, cy + s * 0.9);
    ctx.lineTo(cx - s * 0.1, cy + s * 1.4);
    ctx.closePath();
    ctx.fill();
  };
  crystal(X(-2.3), Y(PLATFORM_H + 0.6), ppu * 0.5, '#ff6a2b');
  crystal(X(2.5), Y(PLATFORM_H + 0.7), ppu * 0.42, '#2f5bff');
  ctx.lineWidth = 3.5;

  // terra e grama
  ctx.fillStyle = soil;
  rr(ctx, left, top, w, bodyH, ppu * 0.25);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = mix('#33c27f', '#2a7a6a', p * 0.6);
  rr(ctx, left - ppu * 0.08, top - ppu * 0.12, w + ppu * 0.16, ppu * 0.62, ppu * 0.22);
  ctx.fill();
  ctx.stroke();
  // tufos
  ctx.fillStyle = mix('#5be0a0', '#3a9a86', p * 0.6);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    const x = left + ppu * 0.4 + (i / 8) * (w - ppu * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - ppu * 0.14, top - ppu * 0.1);
    ctx.lineTo(x, top - ppu * (0.34 + hash(i + 3) * 0.18));
    ctx.lineTo(x + ppu * 0.14, top - ppu * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// --- Blocos -----------------------------------------------------------------------------------
function drawBlock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  opts: { ice?: boolean; stone?: boolean; glow?: string | null; time: number },
) {
  const face = opts.stone ? '#9a9aa4' : color;
  const dark = shade(face, -0.35);
  const lw = Math.max(2, Math.min(w, h) * 0.075);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.fillStyle = dark;
  rr(ctx, -w / 2 + lw / 2, -h / 2 + lw / 2, w - lw, h - lw, w * 0.17);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = face;
  rr(ctx, -w / 2 + w * 0.14, -h / 2 + h * 0.12, w * 0.72, h * 0.66, w * 0.11);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.38)';
  rr(ctx, -w / 2 + w * 0.14, -h / 2 + h * 0.12, w * 0.72, h * 0.2, w * 0.1);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  rr(ctx, -w / 2 + w * 0.14, -h / 2 + h * 0.58, w * 0.72, h * 0.2, w * 0.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = Math.max(1.5, w * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + w * 0.22, -h / 2 + h * 0.27);
  ctx.quadraticCurveTo(-w / 2 + w * 0.22, -h / 2 + h * 0.2, -w / 2 + w * 0.3, -h / 2 + h * 0.2);
  ctx.lineTo(-w / 2 + w * 0.52, -h / 2 + h * 0.2);
  ctx.stroke();
  if (opts.stone) {
    ctx.strokeStyle = 'rgba(40,40,50,.55)';
    ctx.lineWidth = Math.max(1.2, w * 0.045);
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.3);
    ctx.lineTo(w * 0.05, -h * 0.05);
    ctx.lineTo(-w * 0.08, h * 0.12);
    ctx.lineTo(w * 0.12, h * 0.3);
    ctx.stroke();
  }
  if (opts.ice) {
    ctx.fillStyle = 'rgba(150,232,255,.42)';
    rr(ctx, -w / 2 + lw / 2, -h / 2 + lw / 2, w - lw, h - lw, w * 0.17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(1.5, w * 0.06);
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, h * 0.1);
    ctx.lineTo(-w * 0.05, -h * 0.2);
    ctx.moveTo(-w * 0.12, h * 0.28);
    ctx.lineTo(w * 0.16, -h * 0.08);
    ctx.stroke();
  }
  if (opts.glow) {
    const a = 0.55 + 0.45 * Math.sin(opts.time * 8);
    ctx.globalAlpha = a;
    ctx.strokeStyle = opts.glow;
    ctx.lineWidth = Math.max(3, w * 0.12);
    rr(ctx, -w / 2, -h / 2, w, h, w * 0.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#33c27f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.2, s, -s * 0.9);
  ctx.quadraticCurveTo(s * 0.1, -s * 0.9, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBodies(
  ctx: CanvasRenderingContext2D,
  game: TowersGame,
  X: (x: number) => number,
  Y: (y: number) => number,
  ppu: number,
  time: number,
  slide: number,
) {
  for (const b of game.world.bodies) {
    if (b === game.platform) continue;
    const ice = b.friction < 0.1;
    const stone = b.isStatic;
    const isActive = game.active?.body === b;
    const glow = isActive ? (game.active!.ivy ? '#33c27f' : game.active!.stone ? '#d0d0dc' : null) : null;
    // A peça que a pessoa segura anda de casa em casa na hora; aqui ela só desliza até lá no desenho.
    const off = isActive ? slide : 0;
    for (const box of b.boxes) {
      const wx = b.x + off + b.c * box.cx - b.s * box.cy;
      const wy = b.y + b.s * box.cx + b.c * box.cy;
      const rc = b.c * box.rc - b.s * box.rs;
      const rs = b.s * box.rc + b.c * box.rs;
      const kind = TOWER_KINDS[box.tag ?? 0] ?? TOWER_KINDS[0]!;
      ctx.save();
      ctx.translate(X(wx), Y(wy));
      ctx.rotate(Math.atan2(rs, rc));
      drawBlock(ctx, box.hw * 2 * ppu, box.hh * 2 * ppu, BLOCK_HEX[kind.color], { ice, stone, glow, time });
      ctx.restore();
    }
    if (b.data.ivy) {
      // as folhas da vinha: nascem das quinas das caixas
      let i = 0;
      for (const box of b.boxes) {
        const wx = b.x + b.c * box.cx - b.s * box.cy;
        const wy = b.y + b.s * box.cx + b.c * box.cy;
        const s = ppu * 0.42;
        leaf(ctx, X(wx - box.hw), Y(wy - box.hh), s, -2.4 + (i % 3) * 0.3);
        leaf(ctx, X(wx + box.hw), Y(wy - box.hh), s * 0.9, -0.7 - (i % 2) * 0.3);
        i++;
      }
    }
  }
}

// --- Guia de queda ---------------------------------------------------------------------------
function drawGuide(
  ctx: CanvasRenderingContext2D,
  game: TowersGame,
  X: (x: number) => number,
  Y: (y: number) => number,
  ppu: number,
  time: number,
) {
  const a = game.active;
  if (!a) return;
  const body = a.body;
  const dy = game.dropDistance();
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of body.boxes) {
    const wx = body.x + box.cx;
    const wy = body.y + box.cy;
    minX = Math.min(minX, wx - box.hw);
    maxX = Math.max(maxX, wx + box.hw);
    maxY = Math.max(maxY, wy + box.hh);
  }
  const kind = TOWER_KINDS[a.kind]!;
  const color = BLOCK_HEX[kind.color];
  // feixe vertical sob a peça
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.globalAlpha = 0.1 + pulse * 0.05;
  ctx.fillStyle = color;
  ctx.fillRect(X(minX), Y(maxY), (maxX - minX) * ppu, dy * ppu);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.setLineDash([ppu * 0.3, ppu * 0.26]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  ctx.moveTo(X(minX), Y(maxY));
  ctx.lineTo(X(minX), Y(maxY) + dy * ppu);
  ctx.moveTo(X(maxX), Y(maxY));
  ctx.lineTo(X(maxX), Y(maxY) + dy * ppu);
  ctx.stroke();
  ctx.setLineDash([]);
  // sombra de onde ela pousaria
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  for (const box of body.boxes) {
    const x = X(body.x + box.cx - box.hw);
    const y = Y(body.y + box.cy - box.hh + dy);
    rr(ctx, x + 2, y + 2, box.hw * 2 * ppu - 4, box.hh * 2 * ppu - 4, ppu * 0.14);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- Mago e corações --------------------------------------------------------------------------
function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean, alpha = 1) {
  ctx.globalAlpha = alpha;
  heartPath(ctx, x, y, s);
  ctx.fillStyle = full ? '#e5303a' : 'rgba(17,17,17,.18)';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, s * 0.22);
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (full) {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.5, y - s * 0.3, s * 0.18, s * 0.3, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawWizard(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, fx: Fx, lives: number) {
  const t = fx.time;
  const mood = fx.mood;
  const fainted = mood === 'faint';
  const bob = fainted ? 0 : Math.sin(t * 2.2) * u * 0.1;
  const hop = mood === 'cheer' ? -Math.abs(Math.sin(fx.moodT * 14)) * u * 0.5 : 0;
  const shiver = mood === 'scared' ? Math.sin(t * 60) * u * 0.05 : 0;
  ctx.save();
  ctx.translate(x + shiver, y + bob + hop);
  if (fainted) ctx.rotate(Math.min(1, fx.moodT * 2) * 0.55);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // nuvem
  ctx.save();
  ctx.translate(0, u * 1.55);
  cloud(ctx, 0, 0, u * 0.62, '#ffffff');
  ctx.restore();

  // corpo (túnica azul)
  ctx.fillStyle = '#2f5bff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2.5, u * 0.09);
  ctx.beginPath();
  ctx.moveTo(-u * 0.55, u * 1.5);
  ctx.quadraticCurveTo(-u * 0.5, u * 0.55, -u * 0.22, u * 0.4);
  ctx.lineTo(u * 0.22, u * 0.4);
  ctx.quadraticCurveTo(u * 0.5, u * 0.55, u * 0.55, u * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(0, u * 0.95, u * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // braços (e varinha)
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#ffd9b0';
  const armUp = mood === 'cheer' || mood === 'scared';
  const armY = armUp ? u * 0.15 : u * 0.9;
  for (const side of [-1, 1]) {
    ctx.lineWidth = Math.max(3, u * 0.12);
    ctx.beginPath();
    ctx.moveTo(side * u * 0.3, u * 0.7);
    ctx.lineTo(side * u * 0.62, armY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(side * u * 0.62, armY, u * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(2, u * 0.07);
    ctx.stroke();
  }
  if (!armUp) {
    ctx.lineWidth = Math.max(2.5, u * 0.08);
    ctx.beginPath();
    ctx.moveTo(u * 0.62, u * 0.9);
    ctx.lineTo(u * 0.95, u * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(u * 0.95, u * 0.45, u * 0.09 + Math.sin(t * 6) * u * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  // cabeça
  ctx.fillStyle = '#ffd9b0';
  ctx.lineWidth = Math.max(2.5, u * 0.09);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, u * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // barba
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-u * 0.44, u * 0.1);
  ctx.quadraticCurveTo(0, u * 0.95, u * 0.44, u * 0.1);
  ctx.quadraticCurveTo(0, u * 0.32, -u * 0.44, u * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // olhos
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, u * 0.07);
  const blink = Math.sin(t * 0.9) > 0.97;
  if (fainted) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * u * 0.2 - u * 0.09, -u * 0.12);
      ctx.lineTo(s * u * 0.2 + u * 0.09, u * 0.06);
      ctx.moveTo(s * u * 0.2 + u * 0.09, -u * 0.12);
      ctx.lineTo(s * u * 0.2 - u * 0.09, u * 0.06);
      ctx.stroke();
    }
  } else if (mood === 'cheer') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * u * 0.2, -u * 0.02, u * 0.1, Math.PI, 0);
      ctx.stroke();
    }
  } else if (mood === 'scared') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s * u * 0.2, -u * 0.05, u * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(s * u * 0.2, -u * 0.05, u * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (blink) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * u * 0.2 - u * 0.08, -u * 0.03);
      ctx.lineTo(s * u * 0.2 + u * 0.08, -u * 0.03);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * u * 0.2, -u * 0.03, u * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // boca
  ctx.lineWidth = Math.max(2, u * 0.07);
  ctx.beginPath();
  if (mood === 'scared') {
    ctx.fillStyle = '#7a1f2a';
    ctx.ellipse(0, u * 0.22, u * 0.09, u * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (mood === 'cheer') {
    ctx.arc(0, u * 0.14, u * 0.14, 0, Math.PI);
    ctx.stroke();
  } else if (fainted) {
    ctx.moveTo(-u * 0.1, u * 0.24);
    ctx.lineTo(u * 0.1, u * 0.24);
    ctx.stroke();
  } else {
    ctx.arc(0, u * 0.12, u * 0.09, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  // chapéu
  ctx.fillStyle = '#ff6a2b';
  ctx.lineWidth = Math.max(2.5, u * 0.09);
  ctx.beginPath();
  ctx.moveTo(-u * 0.68, -u * 0.34);
  ctx.quadraticCurveTo(0, -u * 0.5, u * 0.68, -u * 0.34);
  ctx.quadraticCurveTo(u * 0.3, -u * 0.5, u * 0.18, -u * 1.55 + (fainted ? u * 0.2 : 0));
  ctx.quadraticCurveTo(-u * 0.25, -u * 0.8, -u * 0.68, -u * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(-u * 0.02, -u * 0.62, u * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // corações de vida (ao lado direito do mago)
  const hs = u * 0.3;
  for (let i = 0; i < MAX_LIVES; i++) {
    const hx = x + u * 1.15 + i * hs * 2.6;
    const hy = y + u * 0.2;
    const broke = fx.heartBroke[i];
    const gain = fx.heartGain[i];
    const full = i < lives;
    let bump = 0;
    if (gain !== undefined) bump = Math.max(0, 1 - (fx.time - gain) * 2.2);
    if (full) {
      const pulse = 1 + Math.sin(t * 5 + i) * 0.04 + bump * 0.35;
      drawHeart(ctx, hx, hy, hs * pulse, true);
    } else {
      drawHeart(ctx, hx, hy, hs, false, broke !== undefined && fx.time - broke < 0.35 ? 0.4 : 1);
    }
  }
}

// --- Partículas e textos ---------------------------------------------------------------------
export function stepFx(fx: Fx, dt: number) {
  fx.time += dt;
  fx.moodT += dt;
  fx.shake *= Math.pow(0.001, dt);
  fx.slide *= Math.pow(0.0001, dt);
  if (Math.abs(fx.slide) < 0.01) fx.slide = 0;
  if (fx.shake < 0.05) fx.shake = 0;
  fx.hurt = Math.max(0, fx.hurt - dt * 1.8);
  fx.glow = Math.max(0, fx.glow - dt * 2.2);
  if (fx.mood !== 'idle' && fx.mood !== 'faint' && fx.moodT > 1.4) fx.mood = 'idle';
  for (const p of fx.particles) {
    p.life -= dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const p of fx.popups) p.life -= dt;
  fx.popups = fx.popups.filter((p) => p.life > 0);
}

export function burst(
  fx: Fx,
  n: number,
  at: { x: number; y: number },
  base: Partial<Particle> & Pick<Particle, 'kind' | 'color'>,
  spread = 3,
  rnd: () => number = Math.random,
) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const sp = (0.3 + rnd() * 0.7) * spread;
    fx.particles.push({
      space: 'world',
      x: at.x,
      y: at.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - spread * 0.3,
      life: 0.6 + rnd() * 0.5,
      max: 1,
      size: 0.25,
      rot: rnd() * 6,
      vr: (rnd() - 0.5) * 8,
      gravity: 6,
      ...base,
    });
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx, X: (x: number) => number, Y: (y: number) => number, ppu: number) {
  for (const p of fx.particles) {
    const a = clamp01(p.life / (p.max > 1 ? p.max : 0.5));
    const px = p.space === 'world' ? X(p.x) : p.x;
    const py = p.space === 'world' ? Y(p.y) : p.y;
    const s = p.size * (p.space === 'world' ? ppu : 1);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.rot);
    ctx.globalAlpha = a;
    switch (p.kind) {
      case 'dust':
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, s * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spark':
      case 'star': {
        ctx.fillStyle = p.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? s * 1.2 : s * 0.45;
          const ang = (i / 8) * Math.PI * 2;
          ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();
        if (p.kind === 'star') ctx.stroke();
        break;
      }
      case 'shard':
        ctx.fillStyle = p.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.6);
        ctx.lineTo(s, -s * 0.2);
        ctx.lineTo(s * 0.2, s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'leaf':
        leaf(ctx, 0, 0, s * 2.2, 0);
        break;
      case 'ring':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(2, s * 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, s * (1 + (1 - a) * 4), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'swirl':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(2, s * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, s * 2, 0, Math.PI * 1.4);
        ctx.stroke();
        break;
      case 'heart':
        ctx.rotate(-p.rot);
        drawHeart(ctx, 0, 0, s, true);
        break;
      case 'halfheart': {
        // Um pedaço de coração partido (metade esquerda ou direita, conforme a cor guardada em rot)
        ctx.rotate(-p.rot + p.rot * 0.4);
        ctx.beginPath();
        ctx.rect(p.color === 'L' ? -s * 2 : 0, -s * 2, s * 2, s * 4);
        ctx.clip();
        drawHeart(ctx, 0, 0, s, true);
        break;
      }
      case 'x':
        ctx.strokeStyle = '#e5303a';
        ctx.lineWidth = Math.max(4, s * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s, -s);
        ctx.lineTo(s, s);
        ctx.moveTo(s, -s);
        ctx.lineTo(-s, s);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const pop of fx.popups) {
    const k = 1 - pop.life / pop.max;
    const px = pop.space === 'world' ? X(pop.x) : pop.x;
    const py = (pop.space === 'world' ? Y(pop.y) : pop.y) - k * ppu * 2;
    ctx.save();
    ctx.globalAlpha = clamp01(pop.life / (pop.max * 0.5));
    ctx.translate(px, py);
    const scale = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4);
    ctx.scale(scale, scale);
    ctx.font = `900 ${Math.round(pop.size * ppu)}px Archivo, Arial Black, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, pop.size * ppu * 0.2);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.strokeText(pop.text, 0, 0);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  }
}

function drawFog(ctx: CanvasRenderingContext2D, W: number, H: number, fx: Fx, amount: number) {
  ctx.save();
  ctx.globalAlpha = 0.9 * amount;
  for (let i = 0; i < 9; i++) {
    const x = (hash(i + 200) * W * 1.3 + Math.sin(fx.time * 0.4 + i) * 26 + W) % (W * 1.3) - W * 0.15;
    const y = H * (0.04 + hash(i + 220) * 0.46);
    cloud(ctx, x, y, Math.min(W, H) * (0.15 + hash(i + 240) * 0.1), '#e8e8f0');
  }
  ctx.restore();
}

export interface View {
  ppu: number;
  X: (x: number) => number;
  Y: (y: number) => number;
  /** Onde, na tela, ficam o mago e os corações. */
  wizard: { x: number; y: number; u: number };
  /** Posição, em unidades do mundo, da borda de baixo da tela. */
  bottomY: number;
}

/** Desenha um quadro inteiro. `dt` anima a câmera. */
export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, game: TowersGame, fx: Fx, dt: number): View {
  // O topo da torre fica a 64% da altura: assim o ponto onde as peças pousam fica bem acima dos
  // botões. O tamanho da casa é o maior que cabe na largura e no caminho todo da peça (do ponto em
  // que ela nasce, logo abaixo dos avisos, até a torre).
  const baseY = H * 0.64;
  const reserve = Math.min(176, H * 0.28);
  const ppu = Math.max(12, Math.min(W / 17.5, (baseY - reserve) / (SPAWN_GAP + 4.5)));
  // A câmera acompanha o topo da torre devagar e com teto de velocidade (subir não pode dar tontura).
  const top = Math.min(0, game.towerTop());
  const diff = top - fx.camY;
  const speed = Math.max(-6, Math.min(2.2, diff * 1.3));
  fx.camY += speed * dt;
  if ((diff > 0 && fx.camY > top) || (diff < 0 && fx.camY < top)) fx.camY = top;
  const camY = fx.camY;
  const X = (x: number) => W / 2 + x * ppu;
  const Y = (y: number) => baseY + (y - camY) * ppu;
  const p = clamp01(-camY / 48);

  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 2, (Math.random() - 0.5) * fx.shake * 2);
  drawSky(ctx, W, H, p, fx);
  drawBackdrop(ctx, W, H, p, camY, ppu, fx);
  drawIsland(ctx, X, Y, ppu, p);
  drawGuide(ctx, game, X, Y, ppu, fx.time);
  drawBodies(ctx, game, X, Y, ppu, fx.time, fx.slide);
  drawParticles(ctx, fx, X, Y, ppu);
  ctx.restore();

  const wiz = { x: W * 0.15, y: H * 0.31, u: Math.max(22, ppu * 1.0) };
  drawWizard(ctx, wiz.x, wiz.y, wiz.u, fx, game.lives);

  if (game.fx.nevoa > 0) drawFog(ctx, W, H, fx, 1);
  if (fx.glow > 0) {
    ctx.globalAlpha = fx.glow * 0.35;
    ctx.fillStyle = fx.glowColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (fx.hurt > 0) {
    ctx.globalAlpha = fx.hurt * 0.35;
    ctx.fillStyle = '#e5303a';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (fx.dark > 0) {
    ctx.globalAlpha = fx.dark * 0.55;
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  return { ppu, X, Y, wizard: wiz, bottomY: camY + (H - baseY) / ppu };
}

