/** Armas do Fox Shot! (spec 056): números iniciais, no estilo do CS, para ajustar jogando. Distâncias em metros, ângulos em graus. */

export type FsWeaponId = 'ak' | 'pistol' | 'sniper' | 'knife' | 'smg' | 'shotgun' | 'm4' | 'usp';
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
  /** Escopeta: quantos projéteis saem por tiro (cada um com o dano de `damage`) e o cone em que se espalham (meio-ângulo, graus). */
  pellets?: number;
  pelletSpread?: number;
}

/** Padrão de rajada do fuzil: sobe forte nos 8 primeiros tiros e depois balança para os lados. */
function akPattern(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const pitch = i < 8 ? 0.95 - i * 0.04 : 0.28;
    const sway = Math.min(1, i / 7);
    const yaw = (i < 12 ? -0.1 - i * 0.045 : 0.16 * Math.sin((i - 12) * 0.9 + 0.4)) * sway * 1.6 + (i > 12 ? (i % 2 ? 0.07 : -0.05) : 0);
    // mais recuo (pedido do Lucas): o fuzil sobe e balança 1,6x mais
    out.push([pitch * 1.6, yaw * 1.6]);
  }
  return out;
}

/** Submetralhadora: recuo curto e apertado, quase só para cima. */
function smgPattern(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 30; i++) out.push([Math.max(0.2, 0.5 - i * 0.012), Math.sin(i * 1.3) * 0.07]);
  return out;
}

/** Fuzil leve: sobe de forma regular e puxa um pouco para a direita (diferente do padrão do outro fuzil). */
function m4Pattern(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 25; i++) out.push([(i < 10 ? 0.62 - i * 0.025 : 0.34) * 1.7, (i < 6 ? 0.03 * i : 0.12 + Math.sin(i * 0.7) * 0.05) * 1.7]);
  return out;
}

export const FS_WEAPONS: Record<FsWeaponId, FsWeapon> = {
  ak: {
    id: 'ak', name: 'AK-47', slot: 'primary', auto: true, rpm: 600, mag: 30, reload: 2.4, draw: 0.02,
    damage: 36, armorRatio: 1.55, rangeMod: 0.98, headMult: 4, legMult: 0.75, penPower: 1,
    recoil: akPattern(), recoilResetS: 0.35, recoilRecover: 10,
    spread: { stand: 0.25, move: 3.6, air: 6, ads: 0.2, adsMove: 2.6 }, bloom: 3.4, bloomPerShot: 0.2,
    moveMul: 0.92, adsFov: 0, boltS: 0, inspect: 3.4,
  },
  pistol: {
    id: 'pistol', name: 'Glock', slot: 'secondary', auto: false, rpm: 400, mag: 18, reload: 1.7, draw: 0.02,
    damage: 34, armorRatio: 0.5, rangeMod: 0.45, headMult: 4, legMult: 0.75, penPower: 0.6,
    recoil: [[1.0, 0.15], [0.95, -0.2], [0.9, 0.2], [0.85, -0.15]], recoilResetS: 0.3, recoilRecover: 16,
    spread: { stand: 0.3, move: 1.5, air: 3.2, ads: 0.25, adsMove: 1.1 }, bloom: 0.9, bloomPerShot: 0.25,
    moveMul: 1, adsFov: 0, boltS: 0, inspect: 3.0,
  },
  sniper: {
    id: 'sniper', name: 'L96A1', slot: 'primary', auto: false, rpm: 40, mag: 5, reload: 3.2, draw: 0.02,
    damage: 115, armorRatio: 1.95, rangeMod: 0.99, headMult: 4, legMult: 1, penPower: 1.6,
    recoil: [[4.2, 0.4]], recoilResetS: 1.2, recoilRecover: 6,
    spread: { stand: 6.5, move: 10, air: 13, ads: 0, adsMove: 5.5 }, bloom: 0, bloomPerShot: 0,
    moveMul: 0.8, adsFov: 28, boltS: 1.3, inspect: 3.8,
  },
  knife: {
    id: 'knife', name: 'Faca', slot: 'knife', auto: false, rpm: 120, mag: 0, reload: 0, draw: 0.02,
    damage: 35, armorRatio: 0.85, rangeMod: 1, headMult: 1, legMult: 1, penPower: 0,
    recoil: [[0, 0]], recoilResetS: 0.2, recoilRecover: 20,
    spread: { stand: 0, move: 0, air: 0, ads: 0, adsMove: 0 }, bloom: 0, bloomPerShot: 0,
    moveMul: 1.1, adsFov: 0, boltS: 0, melee: { range: 1.7, stab: 70, stabCd: 1.0, backstab: 100 }, inspect: 4.0,
  },
  smg: {
    // submetralhadora: dano menor que o do fuzil, mas atira bem mais rápido, com recuo curto
    id: 'smg', name: 'MP9', slot: 'primary', auto: true, rpm: 850, mag: 30, reload: 2.1, draw: 0.02,
    damage: 24, armorRatio: 0.6, rangeMod: 0.72, headMult: 4, legMult: 0.75, penPower: 0.45,
    recoil: smgPattern(), recoilResetS: 0.3, recoilRecover: 14,
    spread: { stand: 0.35, move: 2.8, air: 5, ads: 0.3, adsMove: 1.8 }, bloom: 1.6, bloomPerShot: 0.09,
    moveMul: 1.0, adsFov: 0, boltS: 0, inspect: 3.0,
  },
  shotgun: {
    // escopeta: um tiro por vez (bombeia entre eles), 9 projéteis espalhados; de perto mata, de longe quase nada acerta
    id: 'shotgun', name: 'SPAS-12', slot: 'primary', auto: false, rpm: 70, mag: 8, reload: 3.8, draw: 0.02,
    damage: 13.5, armorRatio: 1.9, rangeMod: 0.5, headMult: 2, legMult: 0.8, penPower: 0.3,
    pellets: 9, pelletSpread: 3.2,
    recoil: [[5.5, 0.6]], recoilResetS: 0.6, recoilRecover: 9,
    spread: { stand: 0.4, move: 3, air: 5, ads: 0.3, adsMove: 2 }, bloom: 0, bloomPerShot: 0,
    moveMul: 0.88, adsFov: 0, boltS: 0.85, inspect: 3.2,
  },
  m4: {
    // fuzil leve: dano e carregador menores que os do outro fuzil, atira um pouco mais rápido e sobe mais regular
    id: 'm4', name: 'M4A1', slot: 'primary', auto: true, rpm: 700, mag: 25, reload: 2.3, draw: 0.02,
    damage: 31, armorRatio: 1.4, rangeMod: 0.985, headMult: 4, legMult: 0.75, penPower: 0.85,
    recoil: m4Pattern(), recoilResetS: 0.32, recoilRecover: 12,
    spread: { stand: 0.2, move: 3.2, air: 5.5, ads: 0.15, adsMove: 2.2 }, bloom: 3.0, bloomPerShot: 0.18,
    moveMul: 0.95, adsFov: 0, boltS: 0, inspect: 3.4,
  },
  usp: {
    // pistola silenciada de precisão: menos balas e menos dano que a outra, mas muito mais precisa
    id: 'usp', name: 'USP-S', slot: 'secondary', auto: false, rpm: 330, mag: 12, reload: 1.9, draw: 0.02,
    damage: 28, armorRatio: 0.55, rangeMod: 0.55, headMult: 4, legMult: 0.75, penPower: 0.6,
    recoil: [[0.45, 0.05], [0.4, -0.05], [0.4, 0.06]], recoilResetS: 0.3, recoilRecover: 20,
    spread: { stand: 0.06, move: 0.7, air: 2.2, ads: 0.04, adsMove: 0.5 }, bloom: 0.25, bloomPerShot: 0.08,
    moveMul: 1, adsFov: 0, boltS: 0, inspect: 3.0,
  },
};

/** Até onde o tiro de cada arma se escuta (m): a pistola silenciada é a mais discreta, o fuzil vai mais longe e a sniper cobre a arena toda. */
export const FS_HEAR_RANGE: Record<FsWeaponId, number> = { pistol: 22, ak: 40, sniper: 80, knife: 6, smg: 26, shotgun: 48, m4: 42, usp: 12 };

export const FS_SLOTS: Record<FsSlot, FsWeaponId[]> = { primary: ['ak', 'sniper', 'smg', 'shotgun', 'm4'], secondary: ['pistol', 'usp'], knife: ['knife'] };

/** A ordem dos 3 espaços: 1 primária, 2 secundária, 3 faca. */
export const FS_SLOT_ORDER: FsSlot[] = ['primary', 'secondary', 'knife'];
