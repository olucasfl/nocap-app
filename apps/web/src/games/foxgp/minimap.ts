import type { GpWorld } from '@nocap/games';
import { GP_THEME } from './theme';
import { css } from './format';

/**
 * O minimapa do Fox GP (spec 079): o traçado da pista com a faixa do box, a linha de chegada quadriculada, as marcas dos
 * três setores, as zonas de DRS (verde), a entrada do box e um ponto por carro na cor da carroceria (o seu maior e com
 * anel branco).
 */
export function drawMinimap(cv: HTMLCanvasElement, world: GpWorld, meId: string, focus: string) {
  const g = cv.getContext('2d');
  if (!g) return;
  const tr = world.track;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < tr.n; i += 4) {
    minX = Math.min(minX, tr.x[i]!);
    maxX = Math.max(maxX, tr.x[i]!);
    minZ = Math.min(minZ, tr.z[i]!);
    maxZ = Math.max(maxZ, tr.z[i]!);
  }
  const pad = 16;
  const k = Math.min((cv.width - pad * 2) / (maxX - minX), (cv.height - pad * 2) / (maxZ - minZ));
  const ox = (cv.width - (maxX - minX) * k) / 2;
  const oz = (cv.height - (maxZ - minZ) * k) / 2;
  const X = (x: number) => ox + (x - minX) * k;
  const Z = (z: number) => oz + (z - minZ) * k;
  g.clearRect(0, 0, cv.width, cv.height);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const path = (from: number, to: number) => {
    g.beginPath();
    for (let i = from; i <= to; i += 2) {
      const j = ((i % tr.n) + tr.n) % tr.n;
      if (i === from) g.moveTo(X(tr.x[j]!), Z(tr.z[j]!));
      else g.lineTo(X(tr.x[j]!), Z(tr.z[j]!));
    }
  };
  // faixa do box
  const pit = tr.pit;
  g.beginPath();
  for (let s = pit?.inStart ?? 0; pit && s <= pit.outEnd; s += 2) {
    const p = tr.pointAt(s, tr.pitCenter(s) ?? 0);
    if (s === pit.inStart) g.moveTo(X(p.x), Z(p.z));
    else g.lineTo(X(p.x), Z(p.z));
  }
  g.strokeStyle = GP_THEME.line2;
  g.lineWidth = 3;
  g.stroke();
  // o traçado: contorno escuro e linha clara
  path(0, tr.n);
  g.closePath();
  g.strokeStyle = GP_THEME.line2;
  g.lineWidth = 11;
  g.stroke();
  g.strokeStyle = GP_THEME.text2;
  g.lineWidth = 3.5;
  g.stroke();
  // zonas de DRS (verde, por cima do traçado)
  for (const zn of world.mode === 'real' ? tr.drsZones : []) {
    g.beginPath();
    for (let q = zn.from; q <= zn.to; q += 2) {
      const i = tr.index(q);
      if (q === zn.from) g.moveTo(X(tr.x[i]!), Z(tr.z[i]!));
      else g.lineTo(X(tr.x[i]!), Z(tr.z[i]!));
    }
    g.strokeStyle = '#1fd05a';
    g.lineWidth = 5;
    g.stroke();
  }
  // limites dos setores: só um ponto pequeno no traçado (spec 081, 12.1: nada de traço cruzando a pista)
  for (const s of tr.sectorS) {
    const i = tr.index(s);
    g.beginPath();
    g.arc(X(tr.x[i]!), Z(tr.z[i]!), 3, 0, Math.PI * 2);
    g.fillStyle = GP_THEME.text;
    g.fill();
  }
  // placas de turbo (Bala Track): seta dupla azul
  for (const pd of tr.pads) {
    const a = tr.pointAt(pd.s, 0);
    const fx = Math.sin(a.h);
    const fz = -Math.cos(a.h);
    g.strokeStyle = '#3aa0ff';
    g.lineWidth = 2.5;
    for (const o of [0, 5]) {
      const cx = X(a.x) + fx * o;
      const cz = Z(a.z) + fz * o;
      g.beginPath();
      g.moveTo(cx - fz * 4 - fx * 3, cz + fx * 4 - fz * 3);
      g.lineTo(cx, cz);
      g.lineTo(cx + fz * 4 - fx * 3, cz - fx * 4 - fz * 3);
      g.stroke();
    }
  }
  // linha de chegada quadriculada
  {
    const nx = -tr.tz[0]!;
    const nz = tr.tx[0]!;
    for (let q = -2; q < 2; q++) {
      g.fillStyle = q % 2 === 0 ? GP_THEME.text : GP_THEME.bg;
      g.fillRect(X(tr.x[0]! + nx * q * 6) - 2.5, Z(tr.z[0]! + nz * q * 6) - 2.5, 5, 5);
    }
  }
  if (pit) {
    const entry = tr.pointAt(pit.inStart, 0);
    // pneu gasto no Realista: a entrada do box pisca
    const mine = world.car(meId);
    if (world.mode === 'real' && mine && mine.wear >= 0.55 && Math.floor(performance.now() / 400) % 2 === 0) {
      g.beginPath();
      g.arc(X(entry.x), Z(entry.z), 9, 0, Math.PI * 2);
      g.fillStyle = GP_THEME.yellow;
      g.fill();
    }
    g.fillStyle = GP_THEME.yellow;
    g.font = `italic 800 13px ${GP_THEME.display}`;
    g.fillText('BOX', X(entry.x) + 8, Z(entry.z) + 4);
  }
  // carros (o seu por último, por cima)
  const order = [...world.cars].sort((a, b) => (a.id === meId ? 1 : 0) - (b.id === meId ? 1 : 0));
  for (const c of order) {
    if (c.gone) continue;
    const mine = c.id === meId;
    const big = mine || c.id === focus;
    g.beginPath();
    g.arc(X(c.x), Z(c.z), big ? 7 : 5.5, 0, Math.PI * 2);
    g.fillStyle = css(c.paint?.body ?? c.color);
    g.fill();
    g.lineWidth = mine ? 3 : 2;
    g.strokeStyle = mine ? '#ffffff' : GP_THEME.bg;
    g.stroke();
  }
}
