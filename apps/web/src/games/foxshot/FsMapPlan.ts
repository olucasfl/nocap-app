import type { FsMapApi } from '@nocap/games';

/** A planta do mapa vista de cima, desenhada uma vez a partir da grade (altura do chão, paredes, degraus) e reaproveitada pelo radar e pelo mapa grande. */
export interface FsPlan {
  canvas: HTMLCanvasElement;
  x0: number;
  z0: number;
  /** Largura e altura da planta em metros. */
  w: number;
  h: number;
}

const PPM = 7; // pixels por metro
const cache = new Map<string, FsPlan>();

export function fsMapPlan(map: FsMapApi): FsPlan {
  const hit = cache.get(map.id);
  if (hit) return hit;
  const gr = map.grid;
  const w = gr.cols * gr.cell;
  const h = gr.rows * gr.cell;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * PPM);
  cv.height = Math.ceil(h * PPM);
  const g = cv.getContext('2d')!;
  // fundo: o que não é chão (paredes e prédios) fica azul-noite
  g.fillStyle = '#0e1530';
  g.fillRect(0, 0, cv.width, cv.height);
  const s = gr.cell * PPM;
  const lo = [122, 108, 82];
  const hi = [226, 206, 160];
  const walk = (c: number, r: number) => c >= 0 && r >= 0 && c < gr.cols && r < gr.rows && !gr.wall(c, r);
  // chão: a cor sobe com a altura, com um ruído fixo que dá aspecto de piso
  for (let r = 0; r < gr.rows; r++) {
    for (let c = 0; c < gr.cols; c++) {
      if (!walk(c, r)) continue;
      const t = Math.max(0, Math.min(1, gr.height(c, r) / 6));
      const n = ((c * 7919 + r * 104729) % 13) - 6;
      const col = [0, 1, 2].map((i) => Math.round(lo[i]! + (hi[i]! - lo[i]!) * t + n)).join(',');
      g.fillStyle = `rgb(${col})`;
      g.fillRect(Math.floor(c * s), Math.floor(r * s), Math.ceil(s) + 0.5, Math.ceil(s) + 0.5);
    }
  }
  // contornos: parede ao lado do chão (borda clara) e degraus ou beiradas (linha escura)
  g.lineWidth = 1;
  for (let r = 0; r < gr.rows; r++) {
    for (let c = 0; c < gr.cols; c++) {
      if (!walk(c, r)) continue;
      const x = c * s;
      const y = r * s;
      const hh = gr.height(c, r);
      const edge = (nc: number, nr: number, ex: number, ey: number, ew: number, eh: number) => {
        if (!walk(nc, nr)) {
          g.fillStyle = 'rgba(190,205,240,.85)';
          g.fillRect(ex, ey, ew, eh);
        } else if (Math.abs(gr.height(nc, nr) - hh) > 0.45) {
          g.fillStyle = 'rgba(30,26,20,.75)';
          g.fillRect(ex, ey, ew, eh);
        }
      };
      edge(c + 1, r, x + s - 0.8, y, 1.4, s);
      edge(c, r + 1, x, y + s - 0.8, s, 1.4);
      if (!walk(c - 1, r)) edge(c - 1, r, x - 0.4, y, 1.4, s);
      if (!walk(c, r - 1)) edge(c, r - 1, x, y - 0.4, s, 1.4);
    }
  }
  const plan: FsPlan = { canvas: cv, x0: gr.x0, z0: gr.z0, w, h };
  cache.set(map.id, plan);
  return plan;
}
