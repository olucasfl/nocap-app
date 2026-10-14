import { ROLL_R, THROW_FLIGHT_TICKS, THROW_RADIUS, THROW_WIND_TICKS, type ItemKind, type SinalMapId, type ShotView } from '@nocap/games';
import { V } from '../camera';
import { INK, PAPER, YEL, alpha, circle, clamp, ell, glow, gloss, hash, mono, paint, poly, rect, shade, soft, star, type Ctx } from './gfx';

/**
 * Os perigos novos do Sinal Vermelho (spec 027): quem joga coisas em você (com a marca no chão que
 * avisa onde cai), quem corre atrás de você e os itens do caminho. Tudo na escala de 30 px por metro.
 */

const WIND = THROW_WIND_TICKS;
const FLIGHT = THROW_FLIGHT_TICKS;

/** O quanto do caminho até o impacto já passou (0 a 1), contando o aviso e o voo. */
export const lobProgress = (sh: ShotView) =>
  clamp(sh.phase === 'wind' ? (sh.p * WIND) / (WIND + FLIGHT) : (WIND + sh.p * FLIGHT) / (WIND + FLIGHT), 0, 1);

// ---------------------------------------------------------------- as marcas no chão
/** A marca onde o arremesso vai cair, ou a faixa por onde a bola vai rolar. `dud` = não faz mal agora. */
export function shotMarker(c: Ctx, sh: ShotView, vcx: number, sy: (wy: number) => number, halfPx: number, t: number) {
  const dud = sh.dud;
  const col = dud ? '#b8b8c0' : '#ff2d3a';
  if (sh.kind === 'lob') {
    const x = vcx + sh.tx * V;
    const y = sy(sh.ty);
    const R = THROW_RADIUS * V;
    const prog = lobProgress(sh);
    const pulse = 0.5 + 0.5 * Math.sin(t * (10 + 12 * prog));
    c.save();
    c.translate(x, y);
    c.fillStyle = alpha(col, dud ? 0.1 : 0.16 + 0.18 * prog);
    c.beginPath();
    c.arc(0, 0, R, 0, 7);
    c.fill();
    // o anel que encolhe: quando chega no círculo, cai
    c.lineWidth = 3.2;
    c.strokeStyle = alpha(col, dud ? 0.5 : 0.95);
    c.beginPath();
    c.arc(0, 0, R * (1 + 1.4 * (1 - prog)), 0, 7);
    c.stroke();
    c.setLineDash([8, 6]);
    c.lineDashOffset = -t * 30;
    c.lineWidth = 3;
    c.strokeStyle = alpha(col, 0.55 + 0.4 * pulse);
    c.beginPath();
    c.arc(0, 0, R, 0, 7);
    c.stroke();
    c.setLineDash([]);
    c.lineWidth = 2.6;
    c.strokeStyle = alpha(col, 0.8);
    c.beginPath();
    c.moveTo(-R * 0.55, 0);
    c.lineTo(R * 0.55, 0);
    c.moveTo(0, -R * 0.55);
    c.lineTo(0, R * 0.55);
    c.stroke();
    if (dud) mono(c, 'FESTIM', 0, R + 14, 9, '#d8d8de', 'center');
    c.restore();
  } else if (sh.phase === 'wind') {
    // a faixa por onde a bola vai rolar: acende e pisca, com setas na direção
    const y = sy(sh.sy);
    const dir = sh.tx > sh.sx ? 1 : -1;
    const h = ROLL_R * V * 2.1;
    c.save();
    c.beginPath();
    c.rect(vcx - halfPx, y - h / 2, halfPx * 2, h);
    c.clip();
    c.fillStyle = alpha(col, (dud ? 0.1 : 0.14) + 0.16 * Math.abs(Math.sin(t * (6 + 10 * sh.p))));
    c.fillRect(vcx - halfPx, y - h / 2, halfPx * 2, h);
    c.strokeStyle = alpha(col, dud ? 0.5 : 0.9);
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const off = ((t * 90 * dir) % 42 + 42) % 42;
    for (let x = vcx - halfPx - 42; x < vcx + halfPx + 42; x += 42) {
      const cx = x + off;
      c.beginPath();
      c.moveTo(cx - dir * 7, y - 8);
      c.lineTo(cx + dir * 5, y);
      c.lineTo(cx - dir * 7, y + 8);
      c.stroke();
    }
    c.restore();
    if (dud) mono(c, 'FESTIM', vcx, y - h / 2 - 5, 9, '#d8d8de', 'center');
  }
}

// ---------------------------------------------------------------- o que voa e rola
function fruit(c: Ctx, map: SinalMapId, r: number, spin: number) {
  if (map === 'horta') {
    paint(c, ell(0, 0, r, r * 0.88), '#f08a1f', -r, r, 2, 0.3, 0.25);
    c.strokeStyle = 'rgba(110,50,0,0.5)';
    c.lineWidth = 1.4;
    for (const dx of [-0.35, 0.35]) {
      c.beginPath();
      c.ellipse(r * dx, 0, r * 0.3, r * 0.86, 0, -1.2, 1.2);
      c.stroke();
    }
    paint(c, rect(-r * 0.12, -r * 1.05, r * 0.24, r * 0.3, 2), '#4a7a2a', -r * 1.05, -r * 0.75, 1.2);
  } else if (map === 'neon') {
    c.save();
    c.rotate(spin);
    glow(c, 0, 0, r * 2.2, '#ff3d9a', 0.7);
    paint(c, rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 4), '#3b4468', -r, r, 2, 0.3, 0.25);
    c.fillStyle = '#ff3d9a';
    c.fillRect(-r * 0.5, -r * 0.18, r, r * 0.36);
    c.restore();
  } else {
    c.save();
    c.rotate(spin);
    paint(c, poly([[-r, r * 0.3], [-r * 0.6, -r * 0.8], [r * 0.2, -r], [r, -r * 0.2], [r * 0.7, r * 0.8]]), '#a08560', -r, r, 2, 0.28, 0.28);
    c.strokeStyle = 'rgba(60,40,24,0.5)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-r * 0.2, -r * 0.8);
    c.lineTo(0, r * 0.1);
    c.stroke();
    c.restore();
  }
  gloss(c, -r * 0.35, -r * 0.4, r * 0.22, r * 0.1, 0.4);
}

/** O arremesso no ar (lob) ou a bola rolando (roll), com a sombra no chão. */
export function shotBody(c: Ctx, map: SinalMapId, sh: ShotView, vcx: number, sy: (wy: number) => number, t: number) {
  if (sh.kind === 'lob') {
    if (sh.phase !== 'fly') return;
    const gx = vcx + sh.x * V;
    const gy = sy(sh.y);
    const arc = Math.sin(Math.PI * sh.p);
    const lift = arc * 86;
    soft(c, gx, gy, 14 + 6 * arc, 6, 0.3 + 0.1 * (1 - arc));
    c.save();
    c.translate(gx, gy - lift - 10);
    fruit(c, map, 11 + 4 * arc, t * 9);
    c.restore();
    if (sh.p > 0.93) {
      // o impacto: poeira em estrela
      const k = (sh.p - 0.93) / 0.07;
      c.save();
      c.translate(vcx + sh.tx * V, sy(sh.ty));
      c.globalAlpha = k;
      c.fillStyle = map === 'neon' ? '#ff3d9a' : '#e8d4a8';
      c.beginPath();
      star(0, 0, 26 * k, 10 * k, 10, t * 3)(c);
      c.fill();
      c.restore();
    }
  } else if (sh.phase === 'roll') {
    const gx = vcx + sh.x * V;
    const gy = sy(sh.y);
    const r = ROLL_R * V;
    soft(c, gx + 4, gy + r * 0.7, r * 1.2, r * 0.4, 0.38);
    c.save();
    c.translate(gx, gy - r * 0.55);
    c.rotate(sh.x * 0.9);
    if (map === 'horta') {
      paint(c, circle(0, 0, r), '#3e9a4a', -r, r, 2.2, 0.3, 0.3);
      c.strokeStyle = '#1f6a2e';
      c.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.ellipse(0, 0, r * 0.28 * Math.abs(i), r, 0, 0, 7);
        c.stroke();
      }
    } else if (map === 'neon') {
      glow(c, 0, 0, r * 2.2, '#25c7e8', 0.6);
      paint(c, circle(0, 0, r), '#2f3b66', -r, r, 2.2, 0.3, 0.3);
      c.strokeStyle = '#25c7e8';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, r * 0.62, 0, 7);
      c.moveTo(-r, 0);
      c.lineTo(r, 0);
      c.stroke();
    } else {
      paint(c, circle(0, 0, r), '#b59a70', -r, r, 2.2, 0.28, 0.3);
      c.strokeStyle = '#7a3cff';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-r * 0.4, -r * 0.4);
      c.lineTo(0, r * 0.4);
      c.lineTo(r * 0.4, -r * 0.4);
      c.stroke();
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- o arremessador
/** O arremessador na borda do corredor, virado para dentro: levanta o braço e acende enquanto mira. */
export function thrower(
  c: Ctx,
  map: SinalMapId,
  x: number,
  y: number,
  side: -1 | 1,
  kind: 'lob' | 'roll',
  phase: 'idle' | 'wind' | 'fly',
  p: number,
  t: number,
) {
  c.save();
  c.translate(x, y);
  c.scale(-side, 1);
  soft(c, 8, 3, 30, 8, 0.38);
  const charge = phase === 'wind' ? p : phase === 'fly' ? 1 : 0;
  const snap = phase === 'fly' ? 1 : 0;
  if (map === 'horta') {
    // catapulta de madeira: o braço dobra para trás enquanto mira e dispara
    paint(c, rect(-22, -12, 44, 12, 3), '#8a5a2e', -12, 0, 2, 0.28, 0.3);
    for (const dx of [-14, 14]) paint(c, circle(dx, 2, 7), '#4a3a2a', -5, 9, 1.6);
    paint(c, rect(-5, -34, 10, 24, 2), '#6b4a2b', -34, -10, 1.8, 0.28, 0.3);
    c.save();
    c.translate(0, -30);
    const ang = -0.2 - (1 - charge) * 0.3 + (charge * 0.9 - snap * 1.9);
    c.rotate(-ang);
    paint(c, rect(-4, -34, 8, 40, 2), '#9a6a3a', -34, 6, 1.6, 0.3, 0.25);
    if (!snap) paint(c, ell(0, -38, 9, 7), '#f08a1f', -45, -31, 1.6, 0.3, 0.2);
    paint(c, rect(-8, -36, 16, 7, 3), '#6b4a2b', -36, -29, 1.4);
    c.restore();
  } else if (map === 'neon') {
    // canhão-robô: o cano mira para dentro e o anel de luz carrega
    paint(c, rect(-18, -26, 36, 26, 5), '#3b4468', -26, 0, 2, 0.3, 0.3);
    paint(c, rect(-14, -42, 28, 18, 6), '#4a5580', -42, -24, 2, 0.3, 0.25);
    paint(c, rect(8, -36, 24, 10, 4), '#2a3150', -36, -26, 1.8);
    const lit = 0.25 + 0.75 * charge;
    glow(c, 28, -31, 28 + 20 * charge, '#ff3d9a', lit);
    c.fillStyle = alpha('#ff3d9a', lit);
    c.beginPath();
    c.arc(30, -31, 5 + 3 * charge, 0, 7);
    c.fill();
    c.fillStyle = alpha('#25c7e8', 0.5 + 0.5 * Math.sin(t * 8));
    c.fillRect(-10, -20, 20, 3);
    for (const dx of [-12, 12]) paint(c, circle(dx, 1, 5), '#15161f', -4, 6, 1.2);
  } else {
    // estátua de pedra com a boca aberta: os olhos e a boca acendem
    paint(c, rect(-18, -10, 36, 10, 3), '#9a7a58', -10, 0, 2, 0.24, 0.3);
    paint(c, rect(-14, -46, 28, 38, 6), '#c09c70', -46, -8, 2, 0.26, 0.28);
    paint(c, poly([[-14, -46], [-9, -56], [-2, -46]]), '#b39573', -56, -46, 1.6);
    paint(c, poly([[14, -46], [9, -56], [2, -46]]), '#b39573', -56, -46, 1.6);
    const lit = 0.25 + 0.75 * charge;
    for (const dx of [-6, 6]) {
      c.fillStyle = alpha('#ff6ab0', lit);
      c.beginPath();
      c.arc(dx, -34, 3.4, 0, 7);
      c.fill();
    }
    paint(c, ell(8, -20, 8, 6), '#2a1a24', -26, -14, 1.6);
    glow(c, 12, -20, 24 + 16 * charge, '#ff6ab0', lit);
  }
  if (kind === 'roll') {
    // o aparelho de rolar tem uma rampa luminosa na frente
    c.fillStyle = alpha('#ff2d3a', 0.35 + 0.4 * charge);
    c.beginPath();
    c.moveTo(20, -4);
    c.lineTo(50, 2);
    c.lineTo(20, 8);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- o perseguidor
const CHASER_SKIN: Record<SinalMapId, { body: string; belly: string; accent: string; eye: string }> = {
  horta: { body: '#9a6a3a', belly: '#e8c38a', accent: '#e5303a', eye: '#ffd23f' },
  neon: { body: '#5a6690', belly: '#8a96c0', accent: '#25c7e8', eye: '#ff2d3a' },
  deserto: { body: '#c8923f', belly: '#f0d49a', accent: '#ff9ecf', eye: '#ff6ab0' },
};

/** O bicho que corre atrás de você: cachorro bravo, cão-robô ou chacal. Parado, fica espreitando. */
export function chaser(c: Ctx, map: SinalMapId, x: number, y: number, frozen: boolean, dizzy: boolean, faceX: number, t: number) {
  const k = CHASER_SKIN[map];
  c.save();
  c.translate(x, y);
  const dir = faceX >= 0 ? 1 : -1;
  c.scale(dir, 1);
  soft(c, 4, 2, 24, 7, 0.4);
  const run = frozen || dizzy ? 0 : Math.sin(t * 18);
  const bob = frozen ? Math.sin(t * 3) * 0.8 : Math.abs(run) * -2.5;
  if (dizzy) c.rotate(0.12 * Math.sin(t * 6));
  c.translate(0, bob);
  // pernas
  for (const [lx, ph] of [[-14, 0], [-6, Math.PI], [8, Math.PI], [16, 0]] as const) {
    const lift = frozen || dizzy ? 0 : Math.max(0, Math.sin(t * 18 + ph)) * 5;
    paint(c, rect(lx - 3, -10 - lift, 6, 11, 2), shade(k.body, -0.12), -10, 1, 1.4, 0.2, 0.2);
  }
  // rabo
  c.save();
  c.translate(-22, -18);
  c.rotate(-0.8 + Math.sin(t * (frozen ? 2 : 14)) * 0.35);
  paint(c, ell(-6, 0, 10, 4), k.body, -4, 4, 1.6, 0.25, 0.2);
  c.restore();
  // corpo
  paint(c, ell(-2, -18, 24, 13), k.body, -31, -5, 2.2, 0.28, 0.28);
  paint(c, ell(0, -12, 17, 7), k.belly, -19, -5, 0, 0.15, 0.1);
  // cabeça
  paint(c, ell(20, -23, 12, 11), k.body, -34, -12, 2.2, 0.28, 0.28);
  paint(c, ell(29, -19, 7, 5.5), k.belly, -25, -13, 1.6, 0.15, 0.1);
  c.fillStyle = INK;
  c.beginPath();
  c.arc(34, -21, 2.2, 0, 7);
  c.fill();
  for (const [ex, ey] of [[14, -34], [24, -35]] as const) {
    paint(c, poly([[ex - 4, ey + 7], [ex, ey - 7], [ex + 5, ey + 7]]), shade(k.body, -0.1), ey - 7, ey + 7, 1.6, 0.2, 0.2);
  }
  // olhos bravos (vermelhos quando corre) ou desconfiados (parado)
  const angry = !frozen && !dizzy;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(22, -26, 3.6, 0, 7);
  c.fill();
  c.fillStyle = angry ? '#e5303a' : INK;
  c.beginPath();
  c.arc(23, -26, 2, 0, 7);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(18, angry ? -31 : -30);
  c.lineTo(26, angry ? -28 : -30);
  c.stroke();
  if (map === 'neon') glow(c, 23, -26, 14, k.eye, angry ? 0.6 : 0.2);
  // coleira ou marca
  c.strokeStyle = k.accent;
  c.lineWidth = 3.4;
  c.beginPath();
  c.arc(11, -20, 9, -1.2, 1.2);
  c.stroke();
  if (angry) {
    // poeirinha da corrida
    c.fillStyle = 'rgba(220,200,160,0.5)';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(-26 - i * 7, -3 + Math.sin(t * 20 + i) * 2, 3 - i * 0.7, 0, 7);
      c.fill();
    }
  }
  c.restore();
  // o balão de cima
  c.save();
  c.translate(x, y - 50);
  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const an = t * 7 + (i * Math.PI * 2) / 3;
      paint(c, star(Math.cos(an) * 14, Math.sin(an) * 4, 6, 2.6, 5, t * 5 + i), YEL, -6, 6, 1.2, 0.3, 0.2);
    }
  } else if (frozen) {
    mono(c, '?', 0, 4, 18, PAPER, 'center');
    c.globalAlpha = 0.5;
    mono(c, '?', 1.5, 5.5, 18, INK, 'center');
  }
  c.restore();
}

// ---------------------------------------------------------------- itens do caminho
export const ITEM_COLOR: Record<ItemKind, string> = {
  sombra: '#7a3cff',
  impulso: '#ffb020',
  escorregao: '#25c7e8',
  peso: '#9a9aa6',
  atordoar: '#ff3d9a',
};
export const ITEM_NAME: Record<ItemKind, string> = {
  sombra: 'SOMBRA',
  impulso: 'IMPULSO',
  escorregao: 'ESCORREGÃO',
  peso: 'PESO',
  atordoar: 'ATORDOAR',
};

/** O ícone de um item (para o chão e para o botão da tela), centrado em (0, 0). */
export function itemIcon(c: Ctx, kind: ItemKind, r: number) {
  if (kind === 'sombra') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, 0, r * 0.7, r * 0.46, 0, 0, 7);
    c.fill();
    c.fillStyle = '#2a1a50';
    c.beginPath();
    c.arc(0, 0, r * 0.26, 0, 7);
    c.fill();
    c.strokeStyle = '#2a1a50';
    c.lineWidth = Math.max(1.5, r * 0.1);
    c.beginPath();
    c.moveTo(-r * 0.8, r * 0.6);
    c.lineTo(r * 0.8, -r * 0.6);
    c.stroke();
  } else if (kind === 'escorregao') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -r * 0.85);
    c.bezierCurveTo(r * 0.5, -r * 0.2, r * 0.75, r * 0.1, r * 0.75, r * 0.38);
    c.arc(0, r * 0.38, r * 0.75, 0, Math.PI);
    c.bezierCurveTo(-r * 0.75, r * 0.1, -r * 0.5, -r * 0.2, 0, -r * 0.85);
    c.fill();
  } else if (kind === 'peso') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.roundRect(-r * 0.75, -r * 0.3, r * 1.5, r * 1.05, r * 0.25);
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = Math.max(1.5, r * 0.2);
    c.beginPath();
    c.arc(0, -r * 0.3, r * 0.34, Math.PI, 0);
    c.stroke();
  } else if (kind === 'atordoar') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.38 : r * 0.9;
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  } else {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(r * 0.18, -r * 0.8);
    c.lineTo(-r * 0.5, r * 0.1);
    c.lineTo(-r * 0.04, r * 0.1);
    c.lineTo(-r * 0.2, r * 0.8);
    c.lineTo(r * 0.5, -r * 0.14);
    c.lineTo(r * 0.04, -r * 0.14);
    c.closePath();
    c.fill();
  }
}

/** O item boiando no chão: orbe que sobe e desce, com brilho e uma sombra. */
export function itemPickup(c: Ctx, kind: ItemKind, x: number, y: number, t: number, id: number) {
  const col = ITEM_COLOR[kind];
  const bob = Math.sin(t * 3 + id) * 4;
  c.save();
  c.translate(x, y);
  soft(c, 3, 2, 13 - bob * 0.3, 5, 0.35);
  glow(c, 0, -22 + bob, 44, col, 0.7);
  c.translate(0, -22 + bob);
  paint(c, circle(0, 0, 13), col, -13, 13, 2.2, 0.35, 0.3);
  gloss(c, -4.5, -5, 4.5, 2.4, 0.55);
  itemIcon(c, kind, 9);
  // faíscas girando em volta
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const an = t * 2.4 + (i * Math.PI * 2) / 3 + id;
    c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6 + i);
    c.beginPath();
    c.arc(Math.cos(an) * 19, Math.sin(an) * 7, 1.8, 0, 7);
    c.fill();
  }
  c.restore();
  void hash;
  void clamp;
}
