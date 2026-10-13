import { TOWER_KINDS, type BadSpell, type GoodSpell } from '@nocap/games';
import { INK } from '../art';

/** Os desenhos de interface do Block Towers: a peça pequena do guia, os ícones das magias e os botões. */

/** A peça do guia "próxima", feita com os mesmos blocos do Block's (`BlockDefs` precisa estar na tela). */
export function TinyPiece({ kind, unit = 14 }: { kind: number; unit?: number }) {
  const def = TOWER_KINDS[kind];
  if (!def) return null;
  let w = 0;
  let h = 0;
  for (const [x, y] of def.cells) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w * unit} height={h * unit} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {def.cells.map(([x, y]) => (
        <use key={`${x}-${y}`} href={`#bk-${def.color}`} x={x} y={y} width="1" height="1" />
      ))}
    </svg>
  );
}

export const SPELL_LABEL: Record<GoodSpell | BadSpell, { name: string; text: string }> = {
  vinha: { name: 'VINHA', text: 'A peça gruda no que encostar' },
  cimento: { name: 'CIMENTO', text: 'A peça vira pedra' },
  desfazer: { name: 'DESFAZER', text: 'Tira a última peça, sem perder vida' },
  vida: { name: 'VIDA EXTRA', text: 'Devolve uma vida' },
  gelo: { name: 'GELO', text: 'As próximas peças escorregam' },
  grande: { name: 'PEÇA GRANDE', text: 'A próxima peça vem enorme' },
  rapida: { name: 'RÁPIDA', text: 'As próximas peças caem rápido' },
  nevoa: { name: 'NÉVOA', text: 'Você não vê o que vem' },
  gira: { name: 'GIRA SOZINHA', text: 'As próximas peças giram sozinhas' },
  semgiro: { name: 'SEM GIRO', text: 'As próximas peças não giram' },
};

/** O ícone de cada magia (traço grosso, cores do Pop Brutal). */
export function SpellIcon({ name, size = 28 }: { name: GoodSpell | BadSpell; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (name) {
    case 'vinha':
      return (
        <svg {...common}>
          <path d="M6 27C6 15 12 8 26 6c0 12-6 19-20 21z" {...line} fill="#33c27f" />
          <path d="M6 27C12 19 17 14 23 9" {...line} />
        </svg>
      );
    case 'cimento':
      return (
        <svg {...common}>
          <rect x="5" y="9" width="22" height="18" rx="4" {...line} fill="#9a9aa4" />
          <path d="M15 11l3 5-3 4 3 5" {...line} strokeWidth={2.2} />
        </svg>
      );
    case 'desfazer':
      return (
        <svg {...common}>
          <path d="M11 8L5 14l6 6" {...line} />
          <path d="M5 14h14a7 7 0 0 1 0 14h-5" {...line} />
        </svg>
      );
    case 'vida':
      return (
        <svg {...common}>
          <path d="M16 27C4 18 5 8 11 7c3-.5 4.5 1.8 5 3 .5-1.2 2-3.5 5-3 6 1 7 11-5 20z" {...line} fill="#e5303a" />
        </svg>
      );
    case 'gelo':
      return (
        <svg {...common}>
          <path d="M16 4v24M5 10l22 12M27 10L5 22" {...line} stroke="#2f5bff" />
          <circle cx="16" cy="16" r="3" {...line} fill="#9fe8ff" strokeWidth={2} />
        </svg>
      );
    case 'grande':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="24" height="24" rx="5" {...line} fill="#ffd23f" />
          <path d="M11 21l10-10M15 11h6v6" {...line} />
        </svg>
      );
    case 'rapida':
      return (
        <svg {...common}>
          <path d="M18 3L7 18h8l-2 11 12-16h-8z" {...line} fill="#ffd23f" />
        </svg>
      );
    case 'nevoa':
      return (
        <svg {...common}>
          <path d="M7 22a5 5 0 0 1 1-9.8A7 7 0 0 1 21 11a5 5 0 0 1 3 11z" {...line} fill="#ffffff" />
          <path d="M8 27h16" {...line} />
        </svg>
      );
    case 'gira':
      return (
        <svg {...common}>
          <path d="M25 13a9 9 0 1 0 1 6" {...line} />
          <path d="M26 6v7h-7" {...line} />
        </svg>
      );
    case 'semgiro':
      return (
        <svg {...common}>
          <path d="M25 13a9 9 0 1 0 1 6" {...line} />
          <path d="M5 27L27 5" {...line} stroke="#e5303a" />
        </svg>
      );
  }
}

export function ArrowIcon({ dir, size = 26 }: { dir: 'left' | 'right' | 'down' | 'rotate'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
  if (dir === 'left') return <svg {...common}><path d="M15 5l-7 7 7 7" /></svg>;
  if (dir === 'right') return <svg {...common}><path d="M9 5l7 7-7 7" /></svg>;
  if (dir === 'down') return <svg {...common}><path d="M5 9l7 7 7-7M12 3v12" /></svg>;
  return (
    <svg {...common}>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}
