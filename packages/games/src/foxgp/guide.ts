import {
  GP_HALF_WIDTH,
  GP_REAL_BRAKE0,
  GP_REAL_BRAKE_V2,
  GP_REAL_DOWNFORCE,
  GP_REAL_GRIP0,
  GP_REAL_VMAX,
  GP_SAMPLE,
} from './constants';
import type { GpTrack } from './track';

/**
 * Linha de guia do Realista (pedido do Lucas, 14/11/2026): a rota e a velocidade ideais da pista, como na F1: verde =
 * acelerar, amarelo = segurar (meio pé, ir no limite da curva), vermelho = frear. Calculado uma vez por pista, só da
 * curvatura (função pura); o desenho pinta a faixa à frente do carro.
 */
export interface GpGuide {
  /** Passo entre as amostras (m). */
  step: number;
  /** Afastamento do centro (m) da melhor rota em cada amostra. */
  lat: Float32Array;
  /** Velocidade ideal (m/s) em cada amostra. */
  speed: Float32Array;
  /** 0 = verde (acelerar), 1 = amarelo (segurar), 2 = vermelho (frear). */
  kind: Uint8Array;
}

export const GP_GUIDE_GREEN = 0;
export const GP_GUIDE_YELLOW = 1;
export const GP_GUIDE_RED = 2;

const cache = new WeakMap<GpTrack, GpGuide>();

export function gpGuide(track: GpTrack): GpGuide {
  const hit = cache.get(track);
  if (hit) return hit;
  const n = Math.max(8, Math.round(track.length / 4));
  const step = track.length / n;
  const curv = new Float32Array(n);
  for (let i = 0; i < n; i++) curv[i] = track.curv[track.index(i * step)]!;
  // curvatura suavizada (±36 m): a rota enxerga a curva antes de entrar
  const win = Math.max(1, Math.round(36 / step));
  const smooth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -win; j <= win; j++) sum += curv[(i + j + n) % n]!;
    smooth[i] = sum / (2 * win + 1);
  }
  const edge = GP_HALF_WIDTH - 2;
  const lat = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = smooth[i]!;
    // por dentro da curva: o sinal da curvatura aponta para o lado de dentro
    lat[i] = Math.max(-edge, Math.min(edge, -Math.sign(k) * Math.min(3.8, Math.abs(k) * 170)));
  }
  // velocidade nas curvas: o que o pneu aguenta (aderência + asa), com um pouco de folga
  const vmax = GP_REAL_VMAX;
  const speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.max(Math.abs(curv[i]!), Math.abs(smooth[i]!) * 0.9);
    const df = GP_REAL_DOWNFORCE;
    speed[i] = k <= df ? vmax : Math.min(vmax, Math.sqrt((GP_REAL_GRIP0 * 0.92) / (k - df)));
  }
  // frenagem: de trás para frente, nunca mais rápido do que dá para frear até a curva seguinte (duas voltas para fechar o laço)
  for (let pass = 0; pass < 2 * n; pass++) {
    const i = (n - 1 - (pass % n) + n) % n;
    const nx = speed[(i + 1) % n]!;
    const brake = GP_REAL_BRAKE0 * 0.85 + GP_REAL_BRAKE_V2 * 0.85 * nx * nx;
    const can = Math.sqrt(nx * nx + 2 * brake * step);
    if (speed[i]! > can) speed[i] = can;
  }
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // olha ~25 m à frente: vai perder velocidade = frear; no limite da curva = segurar; senão acelerar
    const a = speed[i]!;
    const b = speed[(i + Math.max(1, Math.round(25 / step))) % n]!;
    if (b < a - 1.2 && a > 6) kind[i] = GP_GUIDE_RED;
    else if (a < vmax * 0.82 && Math.abs(b - a) <= 1.2) kind[i] = GP_GUIDE_YELLOW;
    else kind[i] = GP_GUIDE_GREEN;
  }
  const g: GpGuide = { step, lat, speed, kind };
  cache.set(track, g);
  return g;
}

/** A amostra da guia em um ponto do traçado `s` (m). */
export function gpGuideAt(track: GpTrack, g: GpGuide, s: number): { lat: number; kind: number; speed: number } {
  const n = g.lat.length;
  const i = ((Math.round(s / g.step) % n) + n) % n;
  return { lat: g.lat[i]!, kind: g.kind[i]!, speed: g.speed[i]! };
}

/** Quanto o carro anda por amostra da pista de referência (para quem desenha). */
export const GP_GUIDE_SAMPLE = GP_SAMPLE;
