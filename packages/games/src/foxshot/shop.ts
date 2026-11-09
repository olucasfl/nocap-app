import type { FsLoadout } from './gun';
import type { FsGrenadeId } from './grenades';
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
  /** Alicate de desarme (modo Bomba): só contra-terrorista; desarma em 5 s em vez de 10. */
  kit?: boolean;
  /** Granada que o item dá. */
  grenade?: FsGrenadeId;
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
      { id: 'kit', name: 'Alicate de desarme', price: 400, kind: 'armor', kit: true, soon: true, note: 'Só no modo Bomba, para contra-terrorista: desarma a bomba em 5 s em vez de 10.' },
    ],
  },
  {
    id: 'pistols',
    label: 'Pistolas',
    items: [
      { id: 'pistol', name: 'Glock (pistola)', price: 200, kind: 'weapon', weapon: 'pistol' },
      { id: 'deagle', name: 'Calibre pesado', price: 700, kind: 'weapon', soon: true },
      { id: 'usp', name: 'USP-S (pistola silenciada)', price: 500, kind: 'weapon', weapon: 'usp' },
      { id: 'dual', name: 'Pistolas duplas', price: 400, kind: 'weapon', soon: true },
    ],
  },
  {
    id: 'mid',
    label: 'Intermediárias',
    items: [
      { id: 'smg', name: 'MP9 (submetralhadora)', price: 1250, kind: 'weapon', weapon: 'smg' },
      { id: 'smg2', name: 'Submetralhadora leve', price: 1050, kind: 'weapon', soon: true },
      { id: 'shotgun', name: 'SPAS-12 (escopeta)', price: 1100, kind: 'weapon', weapon: 'shotgun' },
      { id: 'lmg', name: 'Metralhadora', price: 2000, kind: 'weapon', soon: true },
    ],
  },
  {
    id: 'rifles',
    label: 'Fuzis',
    items: [
      { id: 'ak', name: 'AK-47 (fuzil)', price: 2700, kind: 'weapon', weapon: 'ak' },
      { id: 'sniper', name: 'L96A1 (sniper)', price: 4750, kind: 'weapon', weapon: 'sniper' },
      { id: 'm4', name: 'M4A1 (fuzil)', price: 3100, kind: 'weapon', weapon: 'm4' },
      { id: 'dmr', name: 'Fuzil automático de precisão', price: 5000, kind: 'weapon', soon: true },
    ],
  },
  {
    id: 'grenades',
    label: 'Granadas',
    items: [
      { id: 'flash', name: 'Granada de luz', price: 200, kind: 'grenade', grenade: 'flash' },
      { id: 'smoke', name: 'Granada de fumaça', price: 300, kind: 'grenade', grenade: 'smoke' },
      { id: 'frag', name: 'Granada explosiva', price: 300, kind: 'grenade', grenade: 'frag' },
      { id: 'fire', name: 'Granada incendiária', price: 600, kind: 'grenade', soon: true },
    ],
  },
];

export const fsShopItem = (id: string): FsShopItem | undefined => FS_SHOP.flatMap((c) => c.items).find((i) => i.id === id);

export const FS_VEST_PRICE = 650;
export const FS_HELMET_PRICE = 350;
/**
 * Preço de verdade de um item para quem já tem parte do equipamento: no "colete e capacete" só se paga o que falta
 * (quem tem o colete paga a diferença; quem tem o capacete paga só o colete).
 */
export function fsShopPrice(item: { id: string; price: number }, armor: number, helmet: boolean): number {
  if (item.id !== 'vesthelm') return item.price;
  return (armor > 0 ? 0 : FS_VEST_PRICE) + (helmet ? 0 : FS_HELMET_PRICE);
}

export interface FsBuyResult {
  ok: boolean;
  reason?: 'unknown' | 'soon' | 'owned';
  /** A arma que estava no espaço e cai no chão. */
  dropped?: { id: FsWeaponId; ammo: number };
  armor?: { points: number; helmet: boolean };
  kit?: boolean;
}

/** Compra um item. Neste modo o dinheiro é infinito: nada é cobrado. Armas novas vão para a mão e a antiga cai. */
export function fsBuy(loadout: FsLoadout, itemId: string): FsBuyResult {
  const item = fsShopItem(itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.kit) return { ok: true, kit: true };
  if (item.soon) return { ok: false, reason: 'soon' };
  if (item.armor) return { ok: true, armor: item.armor };
  if (item.grenade) return loadout.addGrenade(item.grenade) ? { ok: true } : { ok: false, reason: 'owned' };
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
