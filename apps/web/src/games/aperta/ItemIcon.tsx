import { UPGRADES, type ItemEra } from '@nocap/games';
import type { ReactNode } from 'react';

/**
 * Ícone dos itens (spec 043): um selo em SVG por tipo de efeito, com a moldura da era do preço.
 * Toque x = lente, toque + = mão com sinal de mais, energia = raio, geradores = engrenagem, geradores de energia = antena.
 * Os pontinhos de baixo contam a posição do item entre os do mesmo tipo, para dois itens parecidos não ficarem iguais.
 */
const INK = 'var(--space-ink)';
const LIGHT = '#e8ecff';
const GOLD = 'var(--space-gold)';
const CYAN = 'var(--space-cyan)';

/** Cores da moldura de cada era: bronze, prata, ouro, plasma e cósmico. */
const FRAME: Record<ItemEra, { a: string; b: string }> = {
  poeira: { a: '#d89a5b', b: '#8a5a2b' },
  mil: { a: '#e3e8f3', b: '#8f9bb5' },
  milhoes: { a: '#ffe27a', b: '#c8941a' },
  bilhoes: { a: '#7ff0ff', b: '#2a7bd6' },
  trilhoes: { a: '#d9a6ff', b: '#6b3ad6' },
};

const stroke = { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Itens de "mãos" (luvas, aço, titânio...) usam a mão com o sinal de mais; o resto do toque usa a lente. */
const HAND_ITEMS = new Set(['gloves', 'steel', 'titan', 'diamond', 'starhand', 'solarhand', 'nebhand', 'cosmoshand']);

const GLYPH: Record<string, ReactNode> = {
  touchMult: (
    <>
      <circle cx="22" cy="21" r="10" fill={CYAN} fillOpacity="0.4" stroke={INK} strokeWidth="3" />
      <path d="M15 17a8 8 0 0 1 6-4" {...stroke} stroke={LIGHT} />
      <path d="M30 29l8 8" {...stroke} strokeWidth="5" />
      <path d="M19 19l6 6M25 19l-6 6" {...stroke} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  touchAdd: (
    <>
      <path d="M14 36V24l-2-6a2 2 0 0 1 4-1l2 4V10a2 2 0 0 1 4 0v10V9a2 2 0 0 1 4 0v11V11a2 2 0 0 1 4 0v14l2-3a2 2 0 0 1 3 2l-5 9v6z" fill={LIGHT} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M36 6v10M31 11h10" {...stroke} stroke={GOLD} strokeWidth="3.5" />
    </>
  ),
  energyMult: <path d="M27 6L12 26h9l-3 16 18-23h-10z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />,
  genMult: (
    <>
      <circle cx="24" cy="24" r="11" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="21.5" y="4" width="5" height="8" rx="1.5" fill={LIGHT} stroke={INK} strokeWidth="2" transform={`rotate(${i * 45} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="4.5" fill={CYAN} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  energyGenMult: (
    <>
      <path d="M24 42V20" {...stroke} strokeWidth="3.5" />
      <path d="M12 20a12 12 0 0 1 24 0" {...stroke} stroke={CYAN} strokeWidth="3.5" />
      <path d="M17 20a7 7 0 0 1 14 0" {...stroke} stroke={LIGHT} strokeWidth="3" />
      <path d="M26 6l-5 8h5l-2 7 7-10h-5z" fill={GOLD} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
};

/** Posição (1 a 5) do item entre os do mesmo tipo de efeito, para os pontinhos. */
function rankOf(id: string): number {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def?.item) return 1;
  const same = UPGRADES.filter((u) => u.item?.type === def.item?.type);
  return 1 + (same.indexOf(def) % 5);
}

export function ItemIcon({ id, size = 52 }: { id: string; size?: number }) {
  const def = UPGRADES.find((u) => u.id === id);
  const type = def?.item?.type ?? 'touchMult';
  const frame = FRAME[def?.era ?? 'poeira'];
  const rank = rankOf(id);
  const grad = `ap-item-grad-${def?.era ?? 'poeira'}`;
  return (
    <svg className="ap-itemicon" viewBox="0 0 48 48" width={size} height={size} role="img" aria-hidden="true" focusable="false" data-era={def?.era ?? 'poeira'} data-type={type}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={frame.a} />
          <stop offset="1" stopColor={frame.b} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${grad})`} stroke={INK} strokeWidth="2.5" />
      <rect x="6" y="6" width="36" height="36" rx="9" fill="#101936" fillOpacity="0.88" />
      <g transform="translate(6 4) scale(0.75)">{GLYPH[HAND_ITEMS.has(id) ? 'touchAdd' : type]}</g>
      {Array.from({ length: rank }, (_, i) => (
        <circle key={i} cx={24 + (i - (rank - 1) / 2) * 5} cy="40" r="1.7" fill={frame.a} />
      ))}
    </svg>
  );
}
