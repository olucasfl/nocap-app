import type { ReactNode } from 'react';

/**
 * Os nove botões do Eco: cada um tem cor, símbolo e tom, para quem não distingue cores (spec 012).
 * O tom de cada botão está em `sfx.ecoPad`. As cores vêm dos tokens e não mudam com o tema.
 */
export interface PadDef {
  name: string;
  color: string;
  /** Cor do símbolo: escura sobre cores claras, branca sobre as escuras. */
  ink: string;
  symbol: ReactNode;
}

const DARK = 'var(--on-accent)';
const LIGHT = 'var(--on-blue)';

export const PADS: PadDef[] = [
  { name: 'laranja', color: 'var(--orange)', ink: DARK, symbol: <circle cx="24" cy="24" r="11" /> },
  {
    name: 'azul',
    color: 'var(--blue)',
    ink: LIGHT,
    symbol: <rect x="13" y="13" width="22" height="22" rx="3" />,
  },
  { name: 'amarelo', color: 'var(--yellow)', ink: DARK, symbol: <path d="M24 11l13 23H11z" /> },
  {
    name: 'verde',
    color: 'var(--green)',
    ink: DARK,
    symbol: <path d="M24 9l14 15-14 15-14-15z" />,
  },
  {
    name: 'rosa',
    color: 'var(--pink)',
    ink: DARK,
    symbol: (
      <path d="M24 9l4.6 9.6 10.4 1.4-7.6 7.3 1.9 10.4L24 32.7l-9.3 5 1.9-10.4L9 20l10.4-1.4z" />
    ),
  },
  {
    name: 'roxo',
    color: 'var(--eco-purple)',
    ink: LIGHT,
    symbol: <path d="M20 11h8v9h9v8h-9v9h-8v-9h-9v-8h9z" />,
  },
  {
    name: 'ciano',
    color: 'var(--eco-cyan)',
    ink: DARK,
    symbol: <path d="M31 12a13 13 0 1 0 5 20 11 11 0 0 1-5-20z" />,
  },
  {
    name: 'vermelho',
    color: 'var(--eco-red)',
    ink: LIGHT,
    symbol: <path d="M24 9l13 7.5v15L24 39l-13-7.5v-15z" />,
  },
  {
    name: 'grafite',
    color: 'var(--eco-graphite)',
    ink: LIGHT,
    symbol: <path d="M27 8L14 27h9l-2 13 13-19h-9z" />,
  },
];

export function PadSymbol({ pad, size = 44 }: { pad: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      {PADS[pad]?.symbol}
    </svg>
  );
}

/** O botão em miniatura (para mostrar "o certo era este"). */
export function PadChip({ pad }: { pad: number }) {
  const def = PADS[pad];
  if (!def) return null;
  return (
    <span className="eco-chip" style={{ background: def.color, color: def.ink }} title={def.name}>
      <PadSymbol pad={pad} size={22} />
    </span>
  );
}
