import { HALF, PLAYER_R, type SinalView } from '@nocap/games';
import { joyCenter, type Layout } from '../camera';
import { stripBox } from './chars';
import { HERO_COLOR } from './palette';
import { INK, ORG, PAPER, YEL, blob, circle, clamp, disp, line, mono, poly, rect, type Ctx } from './gfx';

/** A interface em cima do jogo (Pop Brutal): metros, trilha da fase, avisos, analógico e setas. */

export interface Joy {
  /** Mostra o analógico (aparelho de toque). */
  show: boolean;
  dx: number;
  dy: number;
  active: boolean;
}

export interface Notice {
  text: string;
  color: string;
}

export interface HudIn {
  layout: Layout;
  view: SinalView;
  color?: string;
  notices: Notice[];
}

export function hud(c: Ctx, s: HudIn) {
  const { view, layout: l } = s;
  const classic = Number.isFinite(view.course.length);
  const meters = Math.floor(view.meters);
  const narrow = l.w < 640;
  const cw = narrow ? 108 : 124;
  blob(c, rect(14, 12, cw, 56, 14), PAPER, 3, 3);
  mono(c, classic ? 'DISTÂNCIA TOTAL' : 'METROS', 24, 28, 9.5, '#4a4a44');
  disp(c, String(meters), 24, 58, 32, INK);
  const nw = c.measureText(String(meters)).width;
  mono(c, 'm', 24 + nw + 4, 58, 13, INK);

  let y = 76;
  if (classic) {
    // A trilha fica só na faixa de fora da pista, embaixo da distância total.
    const side = l.w / 2 - HALF * l.ppm;
    progressBar(c, s, 14, 76, Math.max(cw, Math.min(side - 28, 240)));
    y = 128;
  }
  const chips: Notice[] = [];
  const gap = Math.max(0, view.y - view.darkY - PLAYER_R);
  chips.push({ text: `ESCURIDÃO ${Math.floor(gap)} m`, color: gap < 15 ? ORG : '#0d0d12' });
  if (view.hidden) chips.push({ text: 'ESCONDIDO', color: '#33c27f' });
  chips.push(...s.notices);
  // A faixa da cantiga fica no meio do topo: os avisos que chegariam nela encolhem.
  const strip = stripBox(l);
  for (const chip of chips) {
    const tight = y + 22 > strip.top && 14 + chip.text.length * 7.2 + 28 > strip.left - 8;
    const text = tight ? chip.text.replace('ESCURIDÃO', 'ESCURO') : chip.text;
    const size = tight ? 9 : 10;
    const w = tight ? Math.min(text.length * 6 + 22, Math.max(70, strip.left - 22)) : Math.max(96, text.length * 7.2 + 28);
    blob(c, rect(14, y, w, 22, 11), chip.color, 2.5, 2);
    const dark = chip.color === '#0d0d12' || chip.color === '#e5303a';
    mono(c, text, 14 + (tight ? 9 : 14), y + 15, size, dark ? PAPER : INK);
    if (chip.text === 'ESCONDIDO') eyeSlash(c, 14 + w - 16, y + 11);
    y += 28;
  }
}

function eyeSlash(c: Ctx, x: number, y: number) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, 0, 7, 4.5, 0, 0, 7);
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(0, 0, 2, 0, 7);
  c.fill();
  c.beginPath();
  c.moveTo(-8, 6);
  c.lineTo(8, -6);
  c.stroke();
  c.restore();
}

/** Trilha de progresso da fase: um cartão pequeno com "FASE n", "faltam X m" e o boneco andando até a bandeira. */
function progressBar(c: Ctx, s: HudIn, x: number, y: number, w: number) {
  const { view } = s;
  const len = view.course.length;
  const p = clamp(view.y / len, 0, 1);
  blob(c, rect(x, y, w, 44, 12), PAPER, 2.5, 2);
  const left = Math.max(0, Math.ceil(len - view.y));
  mono(c, `FASE ${view.course.n}`, x + 10, y + 16, 10, INK);
  mono(c, w < 130 ? `${left} m` : `faltam ${left} m`, x + w - 10, y + 16, 10, '#4a4a44', 'right');
  const tx = x + 12;
  const tw = w - 36;
  const ty = y + 28;
  c.fillStyle = ORG;
  c.beginPath();
  c.roundRect(tx, ty, Math.max(6, tw * p), 6, 3);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.roundRect(tx, ty, tw, 6, 3);
  c.stroke();
  line(c, tx + tw / 2, ty - 3, tx + tw / 2, ty + 9, 2);
  const fx = x + w - 14;
  line(c, fx, ty - 5, fx, ty + 11, 2.4);
  blob(c, poly([[fx, ty - 5], [fx + 9, ty - 1], [fx, ty + 3]]), YEL, 1.6, 0);
  blob(c, circle(tx + tw * p, ty + 3, 6), s.color ?? HERO_COLOR[view.course.map], 2, 0);
}

export function stick(c: Ctx, l: Layout, joy: Joy) {
  const { x: cx, y: cy, r } = joyCenter(l);
  c.save();
  c.globalAlpha = 0.96;
  c.fillStyle = 'rgba(244,244,239,.18)';
  c.beginPath();
  c.arc(cx, cy, r, 0, 7);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = PAPER;
  c.stroke();
  for (const [ax, ay] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    c.beginPath();
    c.moveTo(cx + ax * 40 - ay * 6 - ax * 6, cy + ay * 40 + ax * 6 - ay * 6);
    c.lineTo(cx + ax * 46, cy + ay * 46);
    c.lineTo(cx + ax * 40 + ay * 6 - ax * 6, cy + ay * 40 - ax * 6 - ay * 6);
    c.lineWidth = 2.6;
    c.stroke();
  }
  blob(c, circle(cx + joy.dx * 26, cy + joy.dy * 26, 24), ORG, 3, 3);
  c.restore();
}

export function keyHint(c: Ctx, w: number, h: number) {
  const keys = ['W', 'A', 'S', 'D'];
  const bx = w / 2 - 78;
  const by = h - 74;
  blob(c, rect(bx - 10, by - 14, 176, 58, 14), 'rgba(17,17,17,.7)', 2.5, 0, 'transparent');
  keys.forEach((k, i) => {
    const kx = bx + i * 38;
    blob(c, rect(kx, by, 30, 30, 8), PAPER, 2.5, 2);
    mono(c, k, kx + 15, by + 20, 14, INK, 'center');
  });
  mono(c, 'ou as setas para andar', w / 2, by + 56, 9.5, PAPER, 'center');
}

/** Preto ou claro por cima da cor do jogador (para o texto ficar legível). */
export const inkOn = (hex: string) => (['#3a3a36', '#7a3cff', '#2f5bff', '#8b5a2b', '#e5303a'].includes(hex) ? PAPER : INK);

/**
 * Setas nas bordas da tela apontando para os outros corredores que saíram da visão: a cor e o nome de
 * cada um e quantos metros ele está à frente (+) ou atrás (-) de você.
 */
export function offscreenArrows(
  c: Ctx,
  w: number,
  h: number,
  l: Layout,
  hx: number,
  list: { sx: number; sy: number; color: string; name: string; ahead: number }[],
  t: number,
) {
  if (list.length === 0) return;
  const top = 128;
  const bottom = l.zone ? l.zone.y - 8 : h - 34;
  const left = 30;
  const right = w - 30;
  const cx = hx;
  const cy = l.heroY;
  for (const o of list) {
    let dx = o.sx - cx;
    let dy = o.sy - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const tx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity;
    const ty = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
    const tt = Math.min(tx, ty);
    const px = cx + dx * tt;
    const py = cy + dy * tt;
    const pulse = 1 + 0.12 * Math.sin(t * 8);
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(dy, dx));
    c.scale(pulse, pulse);
    blob(c, poly([[18, 0], [-10, -13], [-3, 0], [-10, 13]]), o.color, 3, 2);
    c.restore();
    const m = Math.round(o.ahead);
    const label = `@${o.name.slice(0, 9)} ${m >= 0 ? '+' : ''}${m} m`;
    c.save();
    c.font = "700 10px 'Space Mono', ui-monospace, monospace";
    const lw = c.measureText(label).width + 14;
    c.restore();
    const lx = clamp(px - dx * 40, lw / 2 + 6, w - lw / 2 - 6);
    const ly = clamp(py - dy * 40, top + 6, bottom - 6);
    blob(c, rect(lx - lw / 2, ly - 10, lw, 20, 10), o.color, 2, 2);
    mono(c, label, lx, ly + 4, 10, inkOn(o.color), 'center');
  }
}
