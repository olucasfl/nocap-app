/** Armas do Fox Shot! (spec 056): números iniciais, no estilo do CS, para ajustar jogando. Distâncias em metros, ângulos em graus. */

export type FsWeaponId = 'ak' | 'pistol' | 'sniper' | 'knife';
export type FsSlot = 'primary' | 'secondary' | 'knife';

export interface FsWeapon {
  id: FsWeaponId;
  name: string;
  slot: FsSlot;
  /** Segurar o gatilho continua atirando. */
  auto: boolean;
  /** Tiros por minuto. */
  rpm: number;
  mag: number;
  /** Segundos para recarregar e para sacar. */
  reload: number;
  draw: number;
  /** Dano base (no corpo, de perto, sem colete). */
  damage: number;
  /** Quanto do dano atravessa o colete (fator de armadura do CS). */
  armorRatio: number;
  /** Multiplicador de dano a cada 50 m. */
  rangeMod: number;
  headMult: number;
  legMult: number;
  /** Poder de penetração: multiplica a fração de dano que passa por uma superfície fina. */
  penPower: number;
  /** Padrão de recuo: deslocamento da mira por tiro (graus; pitch para cima é positivo, yaw para a direita é positivo). */
  recoil: readonly (readonly [number, number])[];
  /** Depois deste tempo sem atirar o padrão volta ao primeiro tiro. */
  recoilResetS: number;
  /** Velocidade com que a mira desce de volta (graus por segundo). */
  recoilRecover: number;
  /** Cone de dispersão (meio-ângulo, graus) por estado. */
  spread: { stand: number; move: number; air: number; ads: number; adsMove: number };
  /** A dispersão cresce a cada tiro seguido até este máximo (graus). */
  bloom: number;
  bloomPerShot: number;
  /** Multiplicador da velocidade de andar. */
  moveMul: number;
  /** FOV ao mirar (0 = sem mira). */
  adsFov: number;
  /** Depois de cada tiro, tempo até poder atirar de novo além do rpm (ferrolho). */
  boltS: number;
  /** Corpo a corpo: alcance (m), dano e espera da estocada (botão de mirar). */
  melee?: { range: number; stab: number; stabCd: number; backstab: number };
  /** Duração da animação de inspecionar (s); 0 = não tem. */
  inspect: number;
}

/** Padrão de rajada do fuzil: sobe forte nos 8 primeiros tiros e depois balança para os lados. */
function akPattern(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const pitch = i < 8 ? 0.95 - i * 0.04 : 0.28;
    const sway = Math.min(1, i / 7);
    const yaw = (i < 12 ? -0.1 - i * 0.045 : 0.16 * Math.sin((i - 12) * 0.9 + 0.4)) * sway * 1.6 + (i > 12 ? (i % 2 ? 0.07 : -0.05) : 0);
    out.push([pitch, yaw]);
  }
  return out;
}

export const FS_WEAPONS: Record<FsWeaponId, FsWeapon> = {
  ak: {
    id: 'ak', name: 'Fuzil', slot: 'primary', auto: true, rpm: 600, mag: 30, reload: 2.4, draw: 0.9,
    damage: 36, armorRatio: 1.55, rangeMod: 0.98, headMult: 4, legMult: 0.75, penPower: 1,
    recoil: akPattern(), recoilResetS: 0.35, recoilRecover: 10,
    spread: { stand: 0.25, move: 3.6, air: 6, ads: 0.2, adsMove: 2.6 }, bloom: 2.2, bloomPerShot: 0.12,
    moveMul: 0.92, adsFov: 0, boltS: 0, inspect: 3.4,
  },
  pistol: {
    id: 'pistol', name: 'Pistola', slot: 'secondary', auto: false, rpm: 400, mag: 18, reload: 1.7, draw: 0.5,
    damage: 34, armorRatio: 0.5, rangeMod: 0.45, headMult: 4, legMult: 0.75, penPower: 0.6,
    recoil: [[1.0, 0.15], [0.95, -0.2], [0.9, 0.2], [0.85, -0.15]], recoilResetS: 0.3, recoilRecover: 16,
    spread: { stand: 0.3, move: 1.5, air: 3.2, ads: 0.25, adsMove: 1.1 }, bloom: 0.9, bloomPerShot: 0.25,
    moveMul: 1, adsFov: 0, boltS: 0, inspect: 3.0,
  },
  sniper: {
    id: 'sniper', name: 'Sniper', slot: 'primary', auto: false, rpm: 40, mag: 5, reload: 3.2, draw: 1.1,
    damage: 115, armorRatio: 1.95, rangeMod: 0.99, headMult: 4, legMult: 1, penPower: 1.6,
    recoil: [[4.2, 0.4]], recoilResetS: 1.2, recoilRecover: 6,
    spread: { stand: 6.5, move: 10, air: 13, ads: 0, adsMove: 5.5 }, bloom: 0, bloomPerShot: 0,
    moveMul: 0.8, adsFov: 28, boltS: 1.3, inspect: 3.8,
  },
  knife: {
    id: 'knife', name: 'Faca', slot: 'knife', auto: false, rpm: 120, mag: 0, reload: 0, draw: 0.6,
    damage: 35, armorRatio: 0.85, rangeMod: 1, headMult: 1, legMult: 1, penPower: 0,
    recoil: [[0, 0]], recoilResetS: 0.2, recoilRecover: 20,
    spread: { stand: 0, move: 0, air: 0, ads: 0, adsMove: 0 }, bloom: 0, bloomPerShot: 0,
    moveMul: 1.1, adsFov: 0, boltS: 0, melee: { range: 1.7, stab: 70, stabCd: 1.0, backstab: 100 }, inspect: 4.8,
  },
};

export const FS_SLOTS: Record<FsSlot, FsWeaponId[]> = { primary: ['ak', 'sniper'], secondary: ['pistol'], knife: ['knife'] };

/** A ordem dos 3 espaços: 1 primária, 2 secundária, 3 faca. */
export const FS_SLOT_ORDER: FsSlot[] = ['primary', 'secondary', 'knife'];
