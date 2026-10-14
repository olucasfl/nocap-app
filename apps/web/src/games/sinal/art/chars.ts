import type { SinalMapId, SinalView } from '@nocap/games';
import {
  INK,
  PAPER,
  YEL,
  alpha,
  blob,
  circle,
  clamp,
  ease,
  ell,
  glow,
  gloss,
  mix,
  mono,
  paint,
  poly,
  rect,
  shade,
  soft,
  type Ctx,
} from './gfx';

/**
 * Os personagens do Sinal Vermelho 2: o boneco de cada mapa (Tomate, Entregador, Raposa) e o Vigia
 * (Espantalho, Semáforo, Totem Coruja), que canta e vira. Origem nos pés; tudo em pixels de arte.
 */

// ---------------------------------------------------------------- o boneco
/** Os olhos do boneco: brancos grandes, com a pupila olhando para a frente. */
function eyes(c: Ctx, y: number, gap: number, r: number, look = 0) {
  for (const dx of [-gap, gap]) {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(dx, y, r, 0, 7);
    c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(20,20,30,0.7)';
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(dx + look, y - r * 0.15, r * 0.5, 0, 7);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(dx + look - r * 0.18, y - r * 0.4, r * 0.18, 0, 7);
    c.fill();
  }
}

export function hero(c: Ctx, map: SinalMapId, x: number, y: number, t: number, walking: boolean, a: number, col: string) {
  c.save();
  c.globalAlpha = a;
  c.translate(x, y);
  const step = walking ? Math.sin(t * 16) : 0;
  const bob = walking ? Math.abs(Math.sin(t * 16)) * -2.4 : Math.sin(t * 2.4) * 0.8;
  soft(c, 3, 1, 17, 6, 0.4);
  // pés
  for (const s of [-1, 1]) {
    const lift = walking ? Math.max(0, step * s) * 4 : 0;
    paint(c, ell(s * 6, -2 - lift, 5.4, 3.6), '#2a2a34', -6, 2, 1.2, 0.3, 0.1);
  }
  c.translate(0, bob);
  const squash = walking ? 1 + step * 0.03 : 1;
  c.scale(2 - squash, squash);

  if (map === 'horta') {
    // tomate: corpo redondo, folhinhas na cabeça
    paint(c, ell(0, -17, 16, 15), col, -32, -2, 2.2, 0.3, 0.28);
    gloss(c, -6, -26, 5, 2.4, 0.5);
    const leaf = '#3fa04a';
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i - 2) * 0.62;
      c.save();
      c.translate(0, -31);
      c.rotate(an + Math.PI / 2);
      paint(c, ell(0, -5, 3.4, 7), i % 2 ? leaf : shade(leaf, -0.12), -12, 2, 1.2, 0.3, 0.15);
      c.restore();
    }
    eyes(c, -18, 5.4, 3.8);
    c.strokeStyle = edge(col);
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, -11, 4, 0.2, Math.PI - 0.2);
    c.stroke();
  } else if (map === 'neon') {
    // entregador: boné, mochila térmica e a cor no corpo
    paint(c, rect(-12, -20, 24, 18, 8), '#e8b13a', -20, -2, 2, 0.28, 0.3);
    paint(c, rect(-13, -23, 26, 15, 6), '#f0d9b0', -23, -8, 0, 0.2, 0.2);
    paint(c, ell(0, -22, 15, 11), '#f2d2a8', -34, -12, 2, 0.28, 0.2);
    paint(c, ell(0, -26, 16, 9), col, -35, -18, 2, 0.3, 0.25);
    paint(c, rect(-17, -30, 34, 7, 3), shade(col, -0.2), -30, -23, 1.6);
    paint(c, rect(-4, -33, 8, 5, 2), '#ffffff', -33, -28, 1.2);
    paint(c, rect(-9, -2, 18, 8, 3), '#2f3550', -2, 6, 1.2);
    eyes(c, -20, 5, 3.4);
    c.strokeStyle = '#8a5a3a';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, -14, 3.2, 0.2, Math.PI - 0.2);
    c.stroke();
    // caixa de entrega nas costas (aparece de lado quando anda)
    paint(c, rect(-9, -4, 18, 9, 2), '#ff6a2b', -4, 5, 1.4, 0.25, 0.2);
  } else {
    // raposa: orelhas pontudas, rabo balançando e barriga clara
    const tail = Math.sin(t * (walking ? 10 : 3)) * 0.35;
    c.save();
    c.translate(10, -8);
    c.rotate(0.6 + tail);
    paint(c, ell(8, 0, 12, 6), col, -6, 6, 1.8, 0.3, 0.25);
    paint(c, ell(16, 0, 5, 5), '#ffffff', -5, 5, 0, 0.1, 0.1);
    c.restore();
    paint(c, ell(0, -15, 14, 14), col, -29, -1, 2.2, 0.3, 0.28);
    paint(c, ell(0, -9, 8, 8), '#fff2dc', -17, -1, 0, 0.1, 0.1);
    for (const s of [-1, 1]) {
      paint(c, poly([[s * 5, -26], [s * 15, -40], [s * 13, -22]]), col, -40, -22, 1.8, 0.3, 0.25);
      c.fillStyle = '#ffd0d8';
      c.beginPath();
      c.moveTo(s * 8, -27);
      c.lineTo(s * 13, -36);
      c.lineTo(s * 12, -26);
      c.fill();
    }
    paint(c, ell(0, -14, 8, 5.4), '#fff2dc', -20, -8, 0, 0.1, 0.1);
    eyes(c, -20, 5, 3.2);
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, -14.5, 2.4, 1.8, 0, 0, 7);
    c.fill();
  }
  c.restore();
}

const edge = (hex: string) => mix(hex, '#07070d', 0.75);

/** O boneco escondido: só uma silhueta escura com o contorno na cor dele. */
export function silhouette(c: Ctx, x: number, y: number, col: string) {
  c.save();
  c.translate(x, y);
  c.globalAlpha = 0.85;
  c.fillStyle = 'rgba(8,10,14,0.78)';
  c.beginPath();
  c.ellipse(0, -16, 15, 16, 0, 0, 7);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = col;
  c.stroke();
  c.fillStyle = col;
  c.beginPath();
  c.arc(-5, -20, 2, 0, 7);
  c.arc(5, -20, 2, 0, 7);
  c.fill();
  c.restore();
}

// ---------------------------------------------------------------- o Vigia
interface VigiaIn {
  map: SinalMapId;
  /** 0 = de costas, 1 = olhando (suavizado). */
  face: number;
  /** Intensidade do aviso (0 a 1, suavizado). */
  warn: number;
  t: number;
  heroX: number;
  cx: number;
  top: number;
  scale: number;
  view: SinalView;
}

const VH = 166;

/** Desenha o Vigia no topo da tela, com a cantiga embaixo dele. Devolve a altura que ocupou (px). */
export function vigia(c: Ctx, o: VigiaIn): number {
  const { map, face, warn, t, view } = o;
  const sc = o.scale;
  // a virada: o Vigia gira como um cartão (a arte troca de costas para a frente no meio)
  const k = clamp(face, 0, 1);
  const turn = Math.abs(Math.cos(k * Math.PI));
  const front = k >= 0.5;
  const singing = view.vigia === 'costas' && view.syl >= 0;
  const beat = singing ? (1 - clamp(view.sylP, 0, 1)) ** 2 : 0;
  const sway = singing ? (view.syl % 2 ? 1 : -1) * 0.05 * beat : 0;
  const shake = warn > 0.05 ? Math.sin(t * 70) * 2.2 * warn : 0;
  const look = clamp((o.heroX - o.cx) / 220, -1, 1);

  c.save();
  c.translate(o.cx + shake, o.top + VH * sc);
  c.scale(sc, sc);
  // sombra no chão do Vigia
  soft(c, 0, 4, 70 * (0.6 + 0.4 * turn), 12, 0.35);
  c.translate(0, -beat * 8);
  c.rotate(sway);
  c.scale(Math.max(0.06, turn) * (1 + 0.03 * beat), 1 - 0.03 * beat);
  if (map === 'horta') scarecrow(c, front, warn, t, look);
  else if (map === 'neon') trafficLight(c, front, warn, t, look);
  else totem(c, front, warn, t, look);
  c.restore();

  return songStrip(c, o, o.top + VH * sc + 10 * sc);
}

function scarecrow(c: Ctx, front: boolean, warn: number, t: number, look: number) {
  const burlap = '#cfa66a';
  // poste e braços
  paint(c, rect(-5, -118, 10, 118, 2), '#7a4e2a', -118, 0, 1.8, 0.25, 0.3);
  paint(c, rect(-62, -92, 124, 10, 5), '#7a4e2a', -92, -82, 1.8, 0.25, 0.3);
  // mangas xadrez
  for (const s of [-1, 1]) {
    paint(c, rect(s > 0 ? 14 : -56, -98, 42, 22, 8), '#c63a3a', -98, -76, 2, 0.28, 0.28);
    c.save();
    c.beginPath();
    c.roundRect(s > 0 ? 14 : -56, -98, 42, 22, 8);
    c.clip();
    c.strokeStyle = 'rgba(40,10,10,0.35)';
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo((s > 0 ? 14 : -56) + i * 9, -98);
      c.lineTo((s > 0 ? 14 : -56) + i * 9, -76);
      c.stroke();
    }
    c.restore();
    // palha nos punhos
    c.strokeStyle = '#e8c35c';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(s * 56, -87 + (i - 2.5) * 3);
      c.lineTo(s * (66 + (i % 3) * 3 + Math.sin(t * 8 + i) * warn * 3), -87 + (i - 2.5) * 5);
      c.stroke();
    }
  }
  // corpo
  paint(c, rect(-26, -92, 52, 66, 14), front ? '#c63a3a' : '#b53232', -92, -26, 2.2, 0.28, 0.3);
  paint(c, rect(-26, -52, 52, 8, 3), '#7a4e2a', -52, -44, 1.4);
  if (!front) {
    paint(c, rect(-12, -80, 22, 20, 3), '#5a7ac8', -80, -60, 1.6, 0.2, 0.2);
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.setLineDash([3, 3]);
    c.strokeRect(-10, -78, 18, 16);
    c.setLineDash([]);
  } else {
    for (const dy of [-76, -62]) {
      paint(c, circle(0, dy, 3.4), '#f2e3a0', dy - 3, dy + 3, 1.2);
    }
  }
  // cabeça de saco de estopa
  paint(c, ell(0, -112, 28, 30), burlap, -142, -82, 2.4, 0.3, 0.28);
  c.strokeStyle = 'rgba(100,70,30,0.35)';
  c.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(i * 7, -138);
    c.lineTo(i * 7 + (i % 2) * 2, -86);
    c.stroke();
  }
  // palha saindo do pescoço
  c.strokeStyle = '#e8c35c';
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(i * 5, -86);
    c.lineTo(i * 6 + Math.sin(t * 5 + i) * warn * 2, -76 + Math.abs(i));
    c.stroke();
  }
  if (front) {
    // olhos de botão que seguem o jogador
    for (const dx of [-11, 11]) {
      paint(c, circle(dx, -114, 8), '#2a1a10', -122, -106, 1.4, 0.2, 0.1);
      c.fillStyle = warn > 0.1 ? '#ff4b4b' : '#f2e3a0';
      c.beginPath();
      c.arc(dx + look * 3, -114, 3.6, 0, 7);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(dx + look * 3 - 1.4, -116, 1.4, 0, 7);
      c.fill();
      if (warn > 0.1) glow(c, dx, -114, 26, '#ff2d3a', warn);
    }
    paint(c, poly([[-3, -108], [3, -108], [0, -100]]), '#a86a2a', -108, -100, 1.2);
    c.strokeStyle = '#2a1a10';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(-14, -92);
    for (let i = 0; i <= 7; i++) c.lineTo(-14 + i * 4, -92 + (i % 2 ? 4 : -2));
    c.stroke();
  } else {
    c.strokeStyle = 'rgba(40,24,10,0.6)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, -134);
    c.lineTo(-4, -124);
    c.lineTo(-8, -116);
    c.lineTo(-4, -108);
    c.stroke();
  }
  // chapéu
  paint(c, ell(0, -132, 44, 10), '#6b4a2b', -142, -122, 2.2, 0.25, 0.3);
  paint(c, rect(-22, -158, 44, 30, 8), '#7a5530', -158, -128, 2.2, 0.28, 0.3);
  paint(c, rect(-22, -142, 44, 7, 2), '#c63a3a', -142, -135, 1.2);
  paint(c, circle(14, -140, 7), '#ffd23f', -147, -133, 1.4);
  c.fillStyle = '#e5303a';
  c.beginPath();
  c.arc(14, -140, 2.6, 0, 7);
  c.fill();
}

function trafficLight(c: Ctx, front: boolean, warn: number, t: number, look: number) {
  // poste e base
  paint(c, rect(-6, -40, 12, 40, 3), '#3a4260', -40, 0, 1.6, 0.3, 0.3);
  paint(c, rect(-22, -8, 44, 10, 4), '#2a3150', -8, 2, 1.6, 0.25, 0.25);
  // caixa
  paint(c, rect(-32, -146, 64, 112, 12), '#232a42', -146, -34, 2.4, 0.3, 0.3);
  paint(c, rect(-28, -142, 56, 104, 9), '#2d3554', -142, -38, 0, 0.12, 0.15);
  if (front) {
    const lamps: [number, string][] = [
      [-118, '#e5303a'],
      [-90, '#ffc61a'],
      [-62, '#2fc27a'],
    ];
    lamps.forEach(([ly, col], i) => {
      const on = i === 0 ? 0.35 + 0.65 * warn : 0.12;
      // viseira
      paint(c, poly([[-22, ly - 14], [22, ly - 14], [18, ly - 6], [-18, ly - 6]]), '#15192a', ly - 14, ly - 6, 1.4);
      paint(c, circle(0, ly + 2, 15), shade(col, -0.55 + on * 0.7), ly - 13, ly + 17, 2, 0.2, 0.2);
      if (on > 0.2) {
        glow(c, 0, ly + 2, 52 + 30 * warn, col, on);
        c.fillStyle = alpha(shade(col, 0.5), on);
        c.beginPath();
        c.arc(0, ly + 2, 10, 0, 7);
        c.fill();
      }
    });
    // o olho: uma pupila na luz vermelha
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(look * 5, -116, 5.5, 8 + 3 * warn, 0, 0, 7);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(look * 5 - 1.5, -120, 2, 0, 7);
    c.fill();
  } else {
    // as costas: parafusos, uma luz de ré que pisca mais rápido no aviso
    for (const [dx, dy] of [[-22, -132], [22, -132], [-22, -44], [22, -44]] as const) {
      paint(c, circle(dx, dy, 3.4), '#7a85a8', dy - 3, dy + 3, 1);
    }
    paint(c, rect(-18, -110, 36, 8, 3), '#15192a', -110, -102, 1.2);
    paint(c, rect(-18, -78, 36, 8, 3), '#15192a', -78, -70, 1.2);
    const rate = 3 + 18 * warn;
    const on = Math.sin(t * rate) > 0;
    paint(c, circle(0, -90, 9), on ? '#ffb020' : '#5a4620', -99, -81, 1.6, 0.2, 0.2);
    if (on) glow(c, 0, -90, 46 + 30 * warn, '#ffb020', 0.5 + warn * 0.4);
  }
  // braços de aviso (placa de pedestre)
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * 32, -96);
    c.rotate(s * (0.5 + Math.sin(t * 2) * 0.05));
    paint(c, rect(0, -4, s * 26, 8, 4), '#3a4260', -4, 4, 1.4);
    c.restore();
  }
}

function totem(c: Ctx, front: boolean, warn: number, t: number, look: number) {
  const stone = '#b79a78';
  // base de pedra
  paint(c, rect(-40, -36, 80, 36, 6), shade(stone, -0.12), -36, 0, 2.2, 0.22, 0.3);
  c.strokeStyle = 'rgba(60,40,24,0.5)';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-14, -36);
  c.lineTo(-10, 0);
  c.moveTo(18, -36);
  c.lineTo(22, 0);
  c.stroke();
  // corpo
  paint(c, rect(-34, -98, 68, 66, 10), stone, -98, -32, 2.4, 0.26, 0.3);
  // asas esculpidas
  for (const s of [-1, 1]) {
    c.strokeStyle = 'rgba(60,40,24,0.55)';
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(s * 10, -90 + i * 12);
      c.quadraticCurveTo(s * 26, -86 + i * 12, s * 32, -76 + i * 12);
      c.stroke();
    }
  }
  // cabeça
  paint(c, rect(-38, -146, 76, 54, 16), '#c4a784', -146, -92, 2.4, 0.26, 0.3);
  for (const s of [-1, 1]) {
    paint(c, poly([[s * 16, -140], [s * 34, -164], [s * 36, -136]]), '#b39573', -164, -136, 2, 0.26, 0.25);
  }
  if (front) {
    const eye = warn > 0.1 ? '#ff6ab0' : '#ffbf3a';
    for (const dx of [-17, 17]) {
      paint(c, circle(dx, -122, 15), '#2a1a24', -137, -107, 2, 0.15, 0.1);
      c.fillStyle = eye;
      c.beginPath();
      c.arc(dx, -122, 11, 0, 7);
      c.fill();
      glow(c, dx, -122, 38 + 20 * warn, eye, 0.55 + 0.3 * warn);
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(dx + look * 4, -122, 4, 8 + 3 * warn, 0, 0, 7);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(dx + look * 4 - 1.4, -126, 1.8, 0, 7);
      c.fill();
    }
    paint(c, poly([[-7, -110], [7, -110], [0, -97]]), '#d98a2a', -110, -97, 1.6, 0.3, 0.2);
    c.strokeStyle = 'rgba(60,40,24,0.55)';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-26, -148);
    c.lineTo(-20, -139);
    c.moveTo(26, -148);
    c.lineTo(20, -139);
    c.stroke();
  } else {
    // as costas: padrão esculpido e uma runa que acende no aviso
    c.strokeStyle = 'rgba(60,40,24,0.55)';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(-26, -136 + i * 12);
      c.lineTo(0, -128 + i * 12);
      c.lineTo(26, -136 + i * 12);
      c.stroke();
    }
    const glowK = 0.25 + 0.75 * warn * (0.6 + 0.4 * Math.sin(t * 18));
    c.save();
    c.translate(0, -66);
    c.strokeStyle = alpha('#ff6ab0', glowK);
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-10, -12);
    c.lineTo(0, 12);
    c.lineTo(10, -12);
    c.moveTo(-10, 0);
    c.lineTo(10, 0);
    c.stroke();
    c.restore();
    glow(c, 0, -66, 36 + 24 * warn, '#ff6ab0', glowK);
  }
}

/** Onde fica a faixa da cantiga na tela (para a interface se desviar dela): borda esquerda e topo, em px. */
export function stripBox(l: { w: number; vigiaScale: number }, top = 6): { left: number; top: number } {
  const sc = clamp(l.vigiaScale * 1.15, 0.55, 1.05);
  return { left: l.w / 2 - (220 * sc) / 2, top: top + VH * l.vigiaScale + 10 * l.vigiaScale };
}

/** A cantiga na tela: cinco pílulas "SI NAL VER ME LHO"; a que está cantando acende. */
function songStrip(c: Ctx, o: VigiaIn, y: number): number {
  const { view, t } = o;
  const words = ['SI', 'NAL', 'VER', 'ME', 'LHO'];
  const sc = clamp(o.scale * 1.15, 0.55, 1.05);
  const h = 22 * sc;
  const holdNow =
    view.vigia === 'aviso' || (view.syl === 4 && view.cycle.notes.some((n) => n.hold && view.t >= n.t0 && view.t < n.t1));
  const widths = words.map((w, i) => (14 + w.length * 8.5) * sc * (i === 4 && holdNow ? 1.5 : 1));
  const gap = 5 * sc;
  const total = widths.reduce((a, b) => a + b, 0) + gap * 4;
  let x = o.cx - total / 2;
  const state = view.vigia;
  c.save();
  if (state === 'olhando') {
    const w = total + 20 * sc;
    c.translate(0, Math.sin(t * 30) * 0.8);
    blob(c, rect(o.cx - w / 2, y, w, h, h / 2), '#e5303a', 2.6 * sc, 2.5 * sc);
    mono(c, 'NÃO SE MEXA', o.cx, y + h * 0.7, 11.5 * sc, PAPER, 'center');
  } else {
    words.forEach((word, i) => {
      const active = view.syl === i && state !== 'voltando';
      const hold = i === 4 && holdNow;
      const pw = widths[i]!;
      const lift = active ? -3 * sc : 0;
      const fill = hold ? '#e5303a' : active ? YEL : state === 'voltando' ? '#bdbdb2' : PAPER;
      const s2 = active ? 1.12 : 1;
      c.save();
      c.translate(x + pw / 2, y + h / 2 + lift);
      c.scale(s2, s2);
      blob(c, rect(-pw / 2, -h / 2, pw, h, h / 2), fill, 2.4 * sc, active ? 3 * sc : 1.8 * sc);
      if (hold) {
        // o aviso enche como uma barra: quando acaba, ele vira
        const cy = view.cycle;
        const p = clamp((view.t - cy.avisoStart) / Math.max(0.01, cy.lookStart - cy.avisoStart), 0, 1);
        c.save();
        c.beginPath();
        c.roundRect(-pw / 2, -h / 2, pw, h, h / 2);
        c.clip();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(-pw / 2, -h / 2, pw * p, h);
        c.restore();
      }
      mono(c, word, 0, h * 0.18, 10.5 * sc, hold ? PAPER : INK, 'center');
      c.restore();
      x += pw + gap;
    });
  }
  c.restore();
  void ease;
  void ell;
  return y + h + 4 - o.top;
}
