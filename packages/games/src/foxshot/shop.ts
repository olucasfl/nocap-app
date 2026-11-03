import type { FsLoadout } from './gun';
import type { FsWeaponId } from './weapons';

/** Item da loja (tecla B). `weapon` entra no espaço da arma; os outros viram equipamento. `soon` = ainda não existe. */
export interface FsShopItem {
  id: string;
  name: string;
  price: number;
  kind: 'weapon' | 'armor' | 'grenade';
  weapon?: FsWeaponId;
  /** Colete (e capacete, se `helmet`). */
  armor?: { points: number; helmet: boolean };
  soon?: boolean;
  /** Frase curta para a dica do item. */
  note?: string;
}

export interface FsShopCategory {
  id: 'equipment' | 'pistols' | 'mid' | 'rifles' | 'grenades';
  label: string;
  items: FsShopItem[];
}

/**
 * O catálogo da loja, no desenho do CS: cinco colunas. Hoje só existem a pistola, o fuzil, a sniper (AWP), a faca e o
 * colete; o resto aparece apagado ("em breve") para a loja já nascer com o lugar das próximas armas e granadas. Para
 * acrescentar um item basta uma linha aqui (e o modelo da arma).
 */
export const FS_SHOP: FsShopCategory[] = [
  {
    id: 'equipment',
    label: 'Equipamento',
    items: [
      { id: 'vest', name: 'Colete', price: 650, kind: 'armor', armor: { points: 100, helmet: false } },
      { id: 'vesthelm', name: 'Colete e capacete', price: 1000, kind: 'armor', armor: { points: 100, helmet: true } },
      { id: 'kit', name: 'Kit de desarme', price: 400, kind: 'armor', soon: true },
    ],
  },
  {
    id: 'pistols',
    label: 'Pistolas',
    items: [
      { id: 'pistol', name: 'Pistola silenciada', price: 200, kind: 'weapon', weapon: 'pistol' },
      { id: 'deagle', name: 'Calibre pesado', price: 700, kind: 'weapon', soon: true },
      { id: 'auto', name: 'Pistola automática', price: 500, kind: 'weapon', soon: true },
      { id: 'dual', name: 'Pistolas duplas', price: 400, kind: 'weapon', soon: true },
    ],
  },
  {
    id: 'mid',
    label: 'Intermediárias',
    items: [
      { id: 'smg1', name: 'Submetralhadora', price: 1250, kind: 'weapon', soon: true },
      { id: 'smg2', name: 'Submetralhadora leve', price: 1050, kind: 'weapon', soon: true },
      { id: 'shotgun', name: 'Escopeta', price: 1100, kind: 'weapon', soon: true },
      { id: 'lmg', name: 'Metralhadora', price: 2000, kind: 'weapon', soon: true },
    ],
  },
  {
    id: 'rifles',
    label: 'Fuzis',
    items: [
      { id: 'ak', name: 'Fuzil', price: 2700, kind: 'weapon', weapon: 'ak' },
      { id: 'sniper', name: 'Sniper (AWP)', price: 4750, kind: 'weapon', weapon: 'sniper' },
      { id: 'carbine', name: 'Carabina', price: 3100, kind: 'weapon', soon: true },
      { id: 'dmr', name: 'Fuzil automático de precisão', price: 5000, kind: 'weapon', soon: true },
    ],
  },
  {
    id: 'grenades',
    label: 'Granadas',
    items: [
      { id: 'flash', name: 'Granada de luz', price: 200, kind: 'grenade', soon: true },
      { id: 'smoke', name: 'Granada de fumaça', price: 300, kind: 'grenade', soon: true },
      { id: 'frag', name: 'Granada explosiva', price: 300, kind: 'grenade', soon: true },
      { id: 'fire', name: 'Granada incendiária', price: 600, kind: 'grenade', soon: true },
    ],
  },
];

export const fsShopItem = (id: string): FsShopItem | undefined => FS_SHOP.flatMap((c) => c.items).find((i) => i.id === id);

export interface FsBuyResult {
  ok: boolean;
  reason?: 'unknown' | 'soon' | 'owned';
  /** A arma que estava no espaço e cai no chão. */
  dropped?: { id: FsWeaponId; ammo: number };
  armor?: { points: number; helmet: boolean };
}

/** Compra um item. Neste modo o dinheiro é infinito: nada é cobrado. Armas novas vão para a mão e a antiga cai. */
export function fsBuy(loadout: FsLoadout, itemId: string): FsBuyResult {
  const item = fsShopItem(itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.soon) return { ok: false, reason: 'soon' };
  if (item.armor) return { ok: true, armor: item.armor };
  // a faca já vem de série e não se compra, vende nem larga
  if (item.weapon === 'knife') return { ok: false, reason: 'unknown' };
  if (item.weapon) {
    const w = FS_WEAPONS[item.weapon];
    const i = FsLoadoutIndex[w.slot];
    // quem já tem essa arma não compra de novo (nada cai no chão nem enche o carregador)
    if (loadout.slots[i]?.id === item.weapon) return { ok: false, reason: 'owned' };
    const old = loadout.slots[i];
    const prev = loadout.equip(item.weapon);
    return { ok: true, dropped: prev && old ? { id: prev, ammo: old.ammo } : undefined };
  }
  return { ok: false, reason: 'unknown' };
}

import { FS_WEAPONS } from './weapons';
const FsLoadoutIndex = { primary: 0, secondary: 1, knife: 2 } as const;
