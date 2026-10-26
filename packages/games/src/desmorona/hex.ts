import { DSM_HEX_SIZE, DSM_LAYER_GAP } from './constants';

/** Coordenada axial de um hexágono ("pointy-top"). */
export interface Hex {
  q: number;
  r: number;
}

const SQRT3 = Math.sqrt(3);

export function hexToWorld(q: number, r: number, size = DSM_HEX_SIZE): { x: number; z: number } {
  return { x: size * SQRT3 * (q + r / 2), z: size * 1.5 * r };
}

/** O hexágono que contém o ponto (x, z) (arredondamento cúbico). */
export function worldToHex(x: number, z: number, size = DSM_HEX_SIZE): Hex {
  const q = ((SQRT3 / 3) * x - (1 / 3) * z) / size;
  const r = ((2 / 3) * z) / size;
  let rx = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rx - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - (-q - r));
  if (dq > dr && dq > ds) rx = -rr - rs;
  else if (dr > ds) rr = -rx - rs;
  return { q: rx, r: rr };
}

export const hexKey = (layer: number, q: number, r: number): string => `${layer}:${q},${r}`;

/** Distância (em ladrilhos) de um hexágono ao centro da arena. */
export const hexRing = (q: number, r: number): number =>
  Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));

/** Todos os hexágonos de um raio, do centro para fora. */
export function hexesOfRadius(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++)
      out.push({ q, r });
  }
  return out;
}

export const DSM_HEX_NEIGHBORS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** A altura da superfície de uma camada (a de cima fica em 0). */
export const layerY = (layer: number): number => -layer * DSM_LAYER_GAP;

/** Quantos ladrilhos tem uma camada de raio `n`. */
export const hexCount = (n: number): number => 3 * n * (n + 1) + 1;
