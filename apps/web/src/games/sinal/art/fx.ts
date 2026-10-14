import type { SinalEnd, SinalMapId, SinalView } from '@nocap/games';
import { V } from '../camera';
import { INK, YEL, alpha, clamp, disp, glow, hash, paint, rect, star, wrapY, type Ctx } from './gfx';
import { sy, type WorldCtx } from './world';

/**
 * Efeitos do Sinal Vermelho 2: partículas no mundo (poeira dos passos, folhas, faíscas, o que flutua
 * no ar de cada mapa), a escuridão que engole o mapa e as animações de perder e de empurrar.
 */

interface Part {
  /** Posição no mundo (m) e velocidade (m/s). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'dust' | 'leaf' | 'spark' | 'mote' | 'star';
  spin: number;
}

export interface FxState {
  parts: Part[];
  lastT: number;
  stepAcc: number;
  prevKnock: number;
  prevHidden: boolean;
  seed: number;
}

const states = new WeakMap<Ctx, FxState>();

export function fxFor(c: Ctx): FxState {
  let s = states.get(c);
  if (!s) {
    s = { parts: [], lastT: 0, stepAcc: 0, prevKnock: 0, prevHidden: false, seed: 1 };
    states.set(c, s);
  }
  return s;
}

const DUST: Record<SinalMapId, string> = { horta: '#d9bf8f', neon: '#8f98c8', deserto: '#f2d9a8' };
const LEAF: Record<SinalMapId, string> = { horta: '#4fa546', neon: '#25c7e8', deserto: '#ff9ecf' };

const rnd = (s: FxState) => {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
};

function emit(s: FxState, p: Omit<Part, 'life'> & { life?: number }) {
  if (s.parts.length > 220) s.parts.shift();
  s.parts.push({ ...p, life: p.life ?? p.max });
}

/** Cria as partículas que o que aconteceu no quadro pede e anda com as que já existem. */
export function stepFx(s: FxState, t: number, view: SinalView, map: SinalMapId, walking: boolean) {
  const dt = s.lastT === 0 ? 0.016 : clamp(t - s.lastT, 0, 0.1);
  s.lastT = t;

  // passos: um sopro de poeira a cada tantos instantes
  if (walking && !view.hidden) {
    s.stepAcc += dt;
    if (s.stepAcc > 0.13) {
      s.stepAcc = 0;
      for (let i = 0; i < 2; i++) {
        emit(s, {
          x: view.x + (rnd(s) - 0.5) * 0.5,
          y: view.y - 0.1,
          vx: (rnd(s) - 0.5) * 0.9,
          vy: -0.3 - rnd(s) * 0.5,
          max: 0.5 + rnd(s) * 0.3,
          size: 3 + rnd(s) * 3,
          color: DUST[map],
          kind: 'dust',
          spin: 0,
        });
      }
    }
  }
  // a batida: faíscas e estrelas
  if (view.knock > 0.9 && s.prevKnock <= 0.9) {
    for (let i = 0; i < 12; i++) {
      const a = rnd(s) * Math.PI * 2;
      emit(s, {
        x: view.x,
        y: view.y + 0.3,
        vx: Math.cos(a) * (2 + rnd(s) * 3),
        vy: Math.sin(a) * (2 + rnd(s) * 3),
        max: 0.5 + rnd(s) * 0.3,
        size: 3 + rnd(s) * 3,
        color: i % 2 ? YEL : '#ffffff',
        kind: i % 3 === 0 ? 'star' : 'spark',
        spin: rnd(s) * 6,
      });
    }
  }
  s.prevKnock = view.knock;
  // entrou no esconderijo: folhas, faíscas ou areia
  if (view.hidden && !s.prevHidden) {
    for (let i = 0; i < 10; i++) {
      emit(s, {
        x: view.x + (rnd(s) - 0.5) * 1.6,
        y: view.y + rnd(s) * 0.8,
        vx: (rnd(s) - 0.5) * 1.4,
        vy: 0.6 + rnd(s) * 0.9,
        max: 0.9 + rnd(s) * 0.5,
        size: 4 + rnd(s) * 3,
        color: LEAF[map],
        kind: 'leaf',
        spin: rnd(s) * 6,
      });
    }
  }
  s.prevHidden = view.hidden;
  // o que flutua no ar: pólen, fagulhas de néon, areia soprada
  if (s.parts.length < 90 && rnd(s) < 0.5) {
    const bx = view.x + (rnd(s) - 0.5) * 18;
    const by = view.y + (rnd(s) - 0.3) * 30;
    emit(s, {
      x: bx,
      y: by,
      vx: map === 'deserto' ? 1.6 + rnd(s) : (rnd(s) - 0.5) * 0.4,
      vy: map === 'neon' ? 0.6 + rnd(s) * 0.5 : -0.1 + (rnd(s) - 0.5) * 0.3,
      max: 2.2 + rnd(s) * 1.8,
      size: 1.6 + rnd(s) * 1.8,
      color: map === 'horta' ? '#fff6a8' : map === 'neon' ? (rnd(s) > 0.5 ? '#ff3d9a' : '#25c7e8') : '#fff0cf',
      kind: 'mote',
      spin: 0,
    });
  }
  // anda e envelhece
  for (let i = s.parts.length - 1; i >= 0; i--) {
    const p = s.parts[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      s.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'dust') {
      p.vx *= 0.94;
      p.vy *= 0.94;
    } else if (p.kind === 'leaf') {
      p.vy -= 1.8 * dt;
      p.vx += Math.sin(t * 5 + p.spin) * 0.8 * dt;
    }
  }
}

export function drawParticles(w: WorldCtx, s: FxState) {
  const { c, vcx } = w;
  for (const p of s.parts) {
    const k = p.life / p.max;
    const x = vcx + p.x * V;
    const y = sy(w, p.y);
    if (y < -20 || y > w.vh + 20 || x < -20 || x > w.vw + 20) continue;
    c.save();
    if (p.kind === 'dust') {
      c.globalAlpha = k * 0.55;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(x, y, p.size * (1.6 - k * 0.8), 0, 7);
      c.fill();
    } else if (p.kind === 'leaf') {
      c.globalAlpha = Math.min(1, k * 1.6);
      c.translate(x, y);
      c.rotate(p.spin + (1 - k) * 5);
      c.fillStyle = p.color;
      c.beginPath();
      c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, 7);
      c.fill();
    } else if (p.kind === 'star') {
      c.globalAlpha = k;
      c.fillStyle = p.color;
      star(x, y, p.size * 1.6, p.size * 0.7, 4, p.spin + (1 - k) * 6)(c);
      c.fill();
    } else if (p.kind === 'spark') {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = k;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(x, y, p.size * k, 0, 7);
      c.fill();
    } else {
      const tw = 0.5 + 0.5 * Math.sin(p.life * 6 + p.size * 9);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(1, k * 3, (1 - k) * 4) * (0.35 + 0.45 * tw);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(x, y, p.size, 0, 7);
      c.fill();
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- a escuridão
/**
 * A escuridão que engole o mapa: uma massa preta com a borda ondulando, braços que sobem, olhos que
 * piscam lá dentro e brasas subindo, na cor do mapa. `topY` é onde a borda dela está na tela;
 * `closeness` (0 a 1) é o quanto ela já está perto: perto, ela pulsa e escurece as bordas da tela.
 */
export function darkness(
  c: Ctx,
  w: number,
  h: number,
  topY: number,
  t: number,
  style: { dark: string; ember: string; rim: string },
  unit: number,
  closeness: number,
) {
  if (topY > h + 30) return;
  const amp = clamp(unit * 0.5, 5, 13);
  const edge = (x: number) =>
    topY +
    Math.sin(x * 0.018 + t * 1.3) * amp +
    Math.sin(x * 0.043 - t * 2.1) * amp * 0.55 +
    Math.sin(x * 0.009 + t * 0.7) * amp * 1.3;
  c.save();
  // a massa
  c.beginPath();
  c.moveTo(0, h + 4);
  for (let x = 0; x <= w + 8; x += 8) c.lineTo(x, edge(x));
  c.lineTo(w + 8, h + 4);
  c.closePath();
  const g = c.createLinearGradient(0, topY - amp * 2, 0, topY + amp * 14);
  g.addColorStop(0, alpha(style.dark, 0));
  g.addColorStop(0.14, alpha(style.dark, 0.8));
  g.addColorStop(1, alpha(style.dark, 1));
  c.fillStyle = g;
  c.fill();
  // braços que sobem da borda
  for (let i = 0; i < 9; i++) {
    const bx = ((i + 0.5) / 9) * w + Math.sin(t * 0.8 + i * 2) * 14;
    const rise = amp * (0.9 + 1.2 * hash(i, 900)) * (0.6 + 0.4 * Math.sin(t * 1.8 + i * 1.7));
    const base = edge(bx);
    c.beginPath();
    c.moveTo(bx - amp * 2.4, base + 6);
    c.bezierCurveTo(bx - amp * 1.2, base - rise * 0.2, bx - amp * 0.6 + Math.sin(t * 2 + i) * 4, base - rise * 0.8, bx + Math.sin(t * 2.4 + i) * 6, base - rise);
    c.bezierCurveTo(bx + amp * 0.6, base - rise * 0.8, bx + amp * 1.2, base - rise * 0.2, bx + amp * 2.4, base + 6);
    c.closePath();
    c.fillStyle = alpha(style.dark, 0.92);
    c.fill();
  }
  // fio de luz da borda
  c.beginPath();
  for (let x = 0; x <= w + 8; x += 8) {
    if (x) c.lineTo(x, edge(x));
    else c.moveTo(x, edge(x));
  }
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = 2.5;
  c.strokeStyle = alpha(style.rim, 0.28 + 0.2 * Math.sin(t * 4));
  c.stroke();
  c.globalCompositeOperation = 'source-over';
  // olhos lá dentro
  for (let i = 0; i < 4; i++) {
    const ex = (0.12 + 0.76 * hash(i, 910)) * w;
    const ey = edge(ex) + amp * (4 + 5 * hash(i, 911));
    const blink = Math.sin(t * 0.9 + i * 2.3) > 0.82 ? 0.15 : 1;
    if (ey > h + 10) continue;
    for (const dx of [-9, 9]) {
      c.fillStyle = alpha(style.rim, 0.9);
      c.beginPath();
      c.ellipse(ex + dx, ey, 4.6, 6.5 * blink, 0, 0, 7);
      c.fill();
    }
    glow(c, ex, ey, 40, style.rim, 0.35 * blink);
  }
  // brasas que sobem
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 34; i++) {
    const ph = wrapY(t * (0.28 + hash(i, 920) * 0.3) + hash(i, 921), 1);
    const ex = hash(i, 922) * w + Math.sin(t + i) * 16;
    const ey = edge(ex) + 14 - ph * (amp * 10 + 90);
    c.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
    c.fillStyle = style.ember;
    c.beginPath();
    c.arc(ex, ey, 1.6 + hash(i, 923) * 2.4 * (1 - ph), 0, 7);
    c.fill();
  }
  c.restore();

  // perto, as bordas da tela escurecem junto com um batimento
  if (closeness > 0.02) {
    const beat = 0.5 + 0.5 * Math.sin(t * (4 + 6 * closeness));
    const gg = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    gg.addColorStop(0, alpha(style.dark, 0));
    gg.addColorStop(1, alpha(style.dark, clamp(closeness * (0.55 + 0.35 * beat), 0, 0.9)));
    c.fillStyle = gg;
    c.fillRect(0, 0, w, h);
  }
}

/** Névoa que sobe do pé da tela: fraca no começo, grossa quando a escuridão chega perto. */
export function fogHaze(c: Ctx, w: number, h: number, intensity: number, t: number, style: { dark: string; ember: string; rim: string }) {
  if (intensity <= 0.02) return;
  c.save();
  const g = c.createLinearGradient(0, h, 0, h * (1 - 0.5 * intensity - 0.1));
  g.addColorStop(0, alpha(style.dark, 0.55 * intensity));
  g.addColorStop(1, alpha(style.dark, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.14 * intensity;
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const x = wrapY(i * 190 + t * (14 + i * 4), w + 240) - 120;
    c.beginPath();
    c.ellipse(x, h - 20 - i * 18 + Math.sin(t * 0.7 + i) * 6, 130, 28, 0, 0, 7);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- alerta e vinheta
/**
 * O alerta de quem joga sem som e a atmosfera do olhar: no aviso uma vinheta vermelha cresce e pulsa;
 * quando ele olha, a tela esfria, fica avermelhada e a borda pulsa. Sem moldura dura.
 */
export function lookAlert(c: Ctx, w: number, h: number, t: number, state: 'warn' | 'look' | null, warn: number) {
  if (!state) return;
  c.save();
  if (state === 'look') {
    c.fillStyle = 'rgba(180,20,35,0.22)';
    c.fillRect(0, 0, w, h);
    const pulse = 0.75 + 0.25 * Math.sin(t * 12);
    const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(229,48,58,0)');
    g.addColorStop(1, `rgba(229,30,50,${0.8 * pulse})`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else {
    const pulse = 0.5 + 0.5 * Math.sin(t * (10 + 12 * warn));
    const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.22, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(229,48,58,0)');
    g.addColorStop(1, `rgba(255,45,58,${(0.25 + 0.55 * warn) * (0.6 + 0.4 * pulse)})`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  c.restore();
}

// ---------------------------------------------------------------- perder e empurrar
/** Estrelinhas girando em volta da cabeça: o boneco está atordoado. */
export function stunStars(c: Ctx, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const an = t * 7 + (i * Math.PI * 2) / 3;
    const sx = x + Math.cos(an) * 20;
    const sy2 = y + Math.sin(an) * 6;
    paint(c, star(sx, sy2, 8.5, 3.6, 5, t * 5 + i), YEL, sy2 - 8, sy2 + 8, 1.4, 0.3, 0.2);
  }
}

/**
 * A animação de perder, por causa: o Vigia viu (tela vermelha, holofote que fecha no boneco, susto e
 * "!") ou a escuridão engoliu (um buraco preto que fecha em volta, com borda rasgada, e o boneco some).
 */
export function deathFx(c: Ctx, w: number, h: number, hx: number, hy: number, d: { reason: SinalEnd; age: number }, t: number) {
  const a = clamp(d.age, 0, 1);
  const e = a * a * (3 - 2 * a);
  const big = Math.max(w, h) * 0.8;
  c.save();
  if (d.reason === 'vigia') {
    c.fillStyle = `rgba(229,48,58,${0.5 * (1 - a)})`;
    c.fillRect(0, 0, w, h);
    const R = big + (70 - big) * e;
    const g = c.createRadialGradient(hx, hy, R * 0.5, hx, hy, R);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.85 * Math.min(1, a * 3)})`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1 - a;
    c.lineWidth = 5;
    c.strokeStyle = YEL;
    c.beginPath();
    c.arc(hx, hy, 30 + a * 90, 0, 7);
    c.stroke();
    c.globalAlpha = 1;
    const pop = Math.min(1, a * 4);
    const by = hy - 52 - 8 * Math.sin(t * 20);
    disp(c, '!', hx + 2, by + 2, 60 * pop, INK, 'center');
    disp(c, '!', hx, by, 60 * pop, YEL, 'center');
  } else {
    const R = Math.max(1, big * (1 - e));
    c.fillStyle = '#000000';
    c.beginPath();
    c.rect(0, 0, w, h);
    c.arc(hx, hy, R, 0, Math.PI * 2, true);
    c.fill('evenodd');
    c.setLineDash([26, 16]);
    c.lineDashOffset = -t * 60;
    c.lineWidth = 28;
    c.strokeStyle = '#000000';
    c.beginPath();
    c.arc(hx, hy, R + 6, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 0.7 * (1 - a);
    c.lineWidth = 4;
    c.strokeStyle = '#ff9ecf';
    c.beginPath();
    c.arc(hx, hy, R + 22, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

/** O empurrão que você deu: ondas de choque e a palma da mão na direção do outro, com um "PÁ!". */
export function pushBurst(c: Ctx, hx: number, hy: number, fx: { age: number; dx: number; dy: number }) {
  const a = fx.age;
  if (a >= 1) return;
  const ang = Math.atan2(fx.dy, fx.dx);
  c.save();
  c.translate(hx, hy);
  for (let k = 0; k < 3; k++) {
    c.globalAlpha = (1 - a) * (1 - k * 0.25);
    c.lineWidth = 8 - k * 2;
    c.strokeStyle = k % 2 ? '#ffffff' : YEL;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, 28 + a * 76 + k * 17, ang - 0.8, ang + 0.8);
    c.stroke();
  }
  c.globalAlpha = 1 - a * 0.6;
  c.rotate(ang);
  const px = 38 + a * 24;
  paint(c, (cc) => {
    cc.beginPath();
    cc.arc(px, 0, 14, 0, Math.PI * 2);
  }, YEL, -14, 14, 2.4, 0.3, 0.2);
  for (let i = -1; i <= 1; i++) paint(c, rect(px + 8, i * 7 - 3, 12, 6, 3), YEL, i * 7 - 3, i * 7 + 3, 1.8, 0.3, 0.2);
  c.restore();
  const tx = hx + fx.dx * (86 + a * 40);
  const ty = hy + fx.dy * (86 + a * 40);
  c.save();
  c.globalAlpha = 1 - a * 0.7;
  disp(c, 'PÁ!', tx + 2, ty + 2, 26 + 12 * (1 - a), INK, 'center');
  disp(c, 'PÁ!', tx, ty, 26 + 12 * (1 - a), YEL, 'center');
  c.restore();
}
