import type { FsWeapon } from './weapons';

export type FsZone = 'head' | 'chest' | 'belly' | 'legs';

export const FS_HP = 100;
export const FS_ZONE_MULT: Record<FsZone, number> = { head: 4, chest: 1, belly: 1.25, legs: 0.75 };

export interface FsHitInfo {
  zone: FsZone;
  /** Distância até o alvo (m). */
  dist: number;
  /** Pontos de colete (0 = sem colete). */
  armor: number;
  helmet: boolean;
  /** Fração do dano que sobrou depois de atravessar paredes (1 = tiro direto). */
  wall: number;
}

export interface FsDamage {
  /** Dano na vida (inteiro). */
  hp: number;
  /** Pontos de colete perdidos. */
  armorLoss: number;
  /** Dano bruto antes da armadura. */
  raw: number;
  /** A armadura protegeu a região? */
  protectedByArmor: boolean;
}

/**
 * Dano de um tiro, igual ao desenho do CS: dano base × região × queda por distância × parede. Com colete (corpo) ou capacete
 * (cabeça) só passa `armorRatio` × 0,5 do dano e o colete gasta o resto pela metade. Pernas nunca têm proteção.
 */
export function fsDamage(w: FsWeapon, h: FsHitInfo): FsDamage {
  const zoneMult = h.zone === 'legs' ? w.legMult : FS_ZONE_MULT[h.zone];
  const raw = w.damage * Math.pow(w.rangeMod, h.dist / 50) * zoneMult * h.wall;
  const protectedByArmor = h.zone === 'head' ? h.helmet : h.zone === 'legs' ? false : h.armor > 0;
  if (!protectedByArmor) return { hp: Math.round(raw), armorLoss: 0, raw, protectedByArmor };
  const hp = raw * w.armorRatio * 0.5;
  return { hp: Math.round(hp), armorLoss: Math.min(h.armor, Math.round((raw - hp) / 2)), raw, protectedByArmor };
}

/** Esse tiro mata alguém com `hp` de vida? */
export const fsKills = (d: FsDamage, hp = FS_HP) => d.hp >= hp;
