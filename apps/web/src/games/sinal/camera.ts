import { PLAYER_R } from '@nocap/games';

/**
 * A câmera do Sinal Vermelho (spec 020). Segue o boneco para a frente e mostra bastante chão:
 * cerca de 18 m de largura e 32 m de altura. O boneco fica um pouco acima do meio da tela e **nunca**
 * dentro da zona do analógico (embaixo, no centro), para o dedo não tapar o personagem.
 */

/** Pixels do desenho por metro, na escala em que a arte foi feita (o resto é só zoom). */
export const V = 30;
export const VISIBLE_WIDTH_M = 17.6;
export const VISIBLE_HEIGHT_M = 32;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  w: number;
  h: number;
  /** Pixels da tela por metro. */
  ppm: number;
  /** Altura (px) onde fica o boneco. */
  heroY: number;
  /** Zona do analógico (só quando há analógico na tela). */
  zone: Rect | null;
  /** Tamanho do Vigia no topo, relativo ao desenho de 360 x 640. */
  vigiaScale: number;
}

const ZONE_W = 200;
const ZONE_H = 200;

export function makeLayout(w: number, h: number, touch: boolean): Layout {
  const ppm = Math.min(w / VISIBLE_WIDTH_M, h / VISIBLE_HEIGHT_M);
  const zone: Rect | null = touch
    ? { x: Math.max(0, w / 2 - ZONE_W / 2), y: Math.max(0, h - ZONE_H), w: Math.min(w, ZONE_W), h: Math.min(h, ZONE_H) }
    : null;
  // O boneco fica mais para baixo: longe do Vigia, com bastante chão à frente para ler o que vem.
  let heroY = h * 0.52;
  if (zone) heroY = Math.min(heroY, zone.y - 40 - PLAYER_R * ppm * 1.4);
  return {
    w,
    h,
    ppm,
    heroY: Math.max(heroY, h * 0.22),
    zone,
    vigiaScale: Math.max(0.42, Math.min(1.1, (h / 640) * 0.82)),
  };
}

export const screenX = (l: Layout, wx: number) => l.w / 2 + wx * l.ppm;
export const screenY = (l: Layout, wy: number, camY: number) => l.heroY - (wy - camY) * l.ppm;

/** O círculo do boneco (com folga) cruza o retângulo? */
export function circleHitsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/** O analógico fixo no centro, embaixo (serve para canhoto e destro): centro e raio, em pixels da tela. */
export function joyCenter(l: Layout): { x: number; y: number; r: number } {
  return { x: l.w / 2, y: l.h - 96, r: 54 };
}
