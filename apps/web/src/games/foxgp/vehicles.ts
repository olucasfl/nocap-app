import type { GpPhysicsMode } from '@nocap/games';

/**
 * Registro dos veículos e pistas de cada modo (spec 081, Fases 1.3, 13.2 e 13.5). O kart e a Bala Track só aparecem na
 * tela quando existirem de verdade (`GP_KART_READY`): até lá o Arcade é a física antiga, com o F1 na Marina, e a tela diz
 * isso, sem prometer o que ainda não há.
 */
export const GP_KART_READY = true;
/** A pista do kart (Fase 6B): até existir, o kart corre na Marina. */
export const GP_BALA_READY = true;

export interface GpVehicleInfo {
  mode: GpPhysicsMode;
  vehicle: 'kart' | 'f1';
  /** "Arcade" ou "Realista". */
  modeName: string;
  /** "Kart" ou "F1". */
  vehicleName: string;
  /** Nome da pista desse modo. */
  track: string;
  /** Frase curta do cartão em "Antes de correr". */
  desc: string;
}

const KART: GpVehicleInfo = {
  mode: 'arcade',
  vehicle: 'kart',
  modeName: 'Arcade',
  vehicleName: 'Kart',
  track: GP_BALA_READY ? 'Bala Track' : 'Circuito da Marina',
  desc: 'Drift e turbo, estilo kart.',
};
const ARCADE_F1: GpVehicleInfo = {
  mode: 'arcade',
  vehicle: 'f1',
  modeName: 'Arcade',
  vehicleName: 'F1',
  track: 'Circuito da Marina',
  desc: 'Drift e turbo, estilo kart.',
};
const REAL_F1: GpVehicleInfo = {
  mode: 'real',
  vehicle: 'f1',
  modeName: 'Realista',
  vehicleName: 'F1',
  track: 'Circuito da Marina',
  desc: 'Freada, marcha e curva de F1.',
};

/** O veículo e a pista de cada modo. */
export function gpVehicleFor(mode: GpPhysicsMode): GpVehicleInfo {
  if (mode === 'real') return REAL_F1;
  return GP_KART_READY ? KART : ARCADE_F1;
}

/**
 * Os carros do carrossel da tela inicial: só veículos diferentes (enquanto o kart não existe, só o F1, e as setas somem).
 */
export const GP_HOME_VEHICLES: readonly GpVehicleInfo[] = GP_KART_READY
  ? [REAL_F1, KART]
  : [REAL_F1];

/** As pistas de cada modo (a primeira do Realista é a padrão). */
export const GP_TRACK_CHOICES: Record<GpPhysicsMode, readonly { id: string; name: string }[]> = {
  real: [
    { id: 'marina', name: 'Circuito da Marina' },
    { id: 'interlagos', name: 'Interlagos' },
  ],
  arcade: [
    { id: 'bala', name: 'Bala Track' },
    { id: 'castle', name: 'Castle Circuit' },
  ],
};

export const gpTrackName = (mode: GpPhysicsMode, id: string | null | undefined) =>
  (GP_TRACK_CHOICES[mode].find((t) => t.id === id) ?? GP_TRACK_CHOICES[mode][0]!).name;
