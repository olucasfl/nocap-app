import { createRng, type Hsb } from '@nocap/games';
import type { PaletteColor } from './palette-types';
import { PALETTE_1 } from './palette-1';
import { PALETTE_2 } from './palette-2';
import { PALETTE_3 } from './palette-3';
import { PALETTE_4 } from './palette-4';

export { color, type PaletteColor } from './palette-types';

/**
 * A paleta inteira do Intruso (mais de 1000 dicas, spec 011): quentes, frios, roxos e rosas,
 * neutros e pastéis. Cada arquivo novo entra aqui.
 */
export const PALETTE: readonly PaletteColor[] = [
  ...PALETTE_1,
  ...PALETTE_2,
  ...PALETTE_3,
  ...PALETTE_4,
];

export const HINT_COUNT = PALETTE.reduce((sum, c) => sum + c.hints.length, 0);

export interface PaletteRound {
  name: string;
  color: Hsb;
  hint: string;
}

/**
 * A cor e a dica da rodada. Cores diferentes em cada rodada da mesma partida (sorteio sem
 * reposição pela seed) e dica sorteada entre as da cor. Determinístico: mesma seed, mesma rodada.
 */
export function paletteRound(seed: string, roundIndex: number): PaletteRound {
  const rng = createRng(`${seed}:palette`);
  const order = PALETTE.map((_, i) => i);
  // Fisher-Yates só até a rodada pedida: as anteriores nunca se repetem.
  for (let i = 0; i <= roundIndex && i < order.length; i++) {
    const j = i + Math.floor(rng() * (order.length - i));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const entry = PALETTE[order[roundIndex % order.length]!]!;
  const hintRng = createRng(`${seed}:hint:${roundIndex}`);
  const hint = entry.hints[Math.floor(hintRng() * entry.hints.length)]!;
  return { name: entry.name, color: entry.hsb, hint };
}
