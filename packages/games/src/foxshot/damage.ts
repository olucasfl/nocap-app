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
  // faca: dano fixo (35 no corte, 70 na estocada), igual no corpo todo, sem colete, distância ou parede
  if (w.melee) return { hp: Math.round(w.damage), armorLoss: 0, raw: w.damage, protectedByArmor: false };
  const zoneMult = h.zone === 'legs' ? w.legMult : FS_ZONE_MULT[h.zone];
  const raw = w.damage * Math.pow(w.rangeMod, h.dist / 50) * zoneMult * h.wall;
  const protectedByArmor = h.zone === 'head' ? h.helmet : h.zone === 'legs' ? false : h.armor > 0;
  if (!protectedByArmor) return { hp: Math.round(raw), armorLoss: 0, raw, protectedByArmor };
  const hp = raw * w.armorRatio * 0.5;
  return { hp: Math.round(hp), armorLoss: Math.min(h.armor, Math.round((raw - hp) / 2)), raw, protectedByArmor };
}

/**
 * Facada nas costas: quem ataca está dentro de um cone estreito atrás do alvo (`coneDeg` para cada lado, 35 por padrão). Na
 * diagonal das costas (fora do cone) vale a facada comum. `facing` é para onde o alvo olha no plano (x, z).
 */
export function fsIsBackstab(facing: [number, number], target: [number, number], attacker: [number, number], coneDeg = 35): boolean {
  const fl = Math.hypot(facing[0], facing[1]);
  const ax = attacker[0] - target[0];
  const az = attacker[1] - target[1];
  const al = Math.hypot(ax, az);
  if (fl < 1e-6 || al < 1e-6) return false;
  const cos = (facing[0] * ax + facing[1] * az) / (fl * al);
  return cos <= -Math.cos((coneDeg * Math.PI) / 180);
}

/** Esse tiro mata alguém com `hp` de vida? */
export const fsKills = (d: FsDamage, hp = FS_HP) => d.hp >= hp;

/**
 * Levar um tiro desacelera por um instante (como no CS): quanto mais dano, mais devagar e mais tempo, mas sem travar.
 * `mul` é o multiplicador de velocidade no momento do tiro; ele volta a 1 em `dur` segundos, em linha reta.
 */
export function fsFlinch(hp: number): { mul: number; dur: number } {
  const d = Math.max(0, hp);
  return { mul: Math.max(0.62, 0.86 - d / 160), dur: Math.min(0.7, 0.3 + d / 150) };
}

/** Multiplicador de velocidade `elapsed` segundos depois do tiro. */
export const fsFlinchAt = (f: { mul: number; dur: number }, elapsed: number) => (elapsed >= f.dur ? 1 : f.mul + (1 - f.mul) * Math.max(0, elapsed / f.dur));
