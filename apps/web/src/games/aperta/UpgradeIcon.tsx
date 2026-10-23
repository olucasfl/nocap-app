import type { ReactNode } from 'react';

/**
 * Um desenho próprio para cada melhoria (spec 041, A9): luvas para as Luvas de Astronauta, antena para a Antena, e assim por diante.
 * Tudo em SVG de 48 x 48 com as cores do tema espaço (`--space-*`), sem emoji e sem imagem externa.
 */
const GOLD = 'var(--space-gold)';
const CYAN = 'var(--space-cyan)';
const VIOLET = 'var(--space-violet)';
const INK = 'var(--space-ink)';
const LIGHT = '#e8ecff';

const stroke = { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ART: Record<string, ReactNode> = {
  // --- toque ---
  lens: (
    <>
      <circle cx="22" cy="22" r="13" fill={CYAN} fillOpacity="0.35" stroke={INK} strokeWidth="3" />
      <path d="M14 18a9 9 0 0 1 8-5" {...stroke} stroke={LIGHT} />
      <path d="M32 32l9 9" {...stroke} strokeWidth="5" />
    </>
  ),
  gloves: (
    <>
      <path d="M13 40V26l-3-9a2.5 2.5 0 0 1 5-1l2 5V11a2.5 2.5 0 0 1 5 0v10V9a2.5 2.5 0 0 1 5 0v12V12a2.5 2.5 0 0 1 5 0v14l3-4a2.5 2.5 0 0 1 4 3l-6 12v6z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M13 36h22" {...stroke} stroke={GOLD} strokeWidth="4" />
    </>
  ),
  trained: (
    <>
      <path d="M20 40V20a3 3 0 0 1 6 0v20z" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      <path d="M12 14l3 3M36 14l-3 3M24 6v5" {...stroke} stroke={GOLD} strokeWidth="3.5" />
      <text x="24" y="35" textAnchor="middle" fontSize="11" fontWeight="800" fill={INK}>
        x5
      </text>
    </>
  ),
  rhythm: (
    <>
      <path d="M16 42l5-32h6l5 32z" fill={VIOLET} fillOpacity="0.5" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 38L33 14" {...stroke} stroke={GOLD} strokeWidth="3" />
      <circle cx="33" cy="14" r="3" fill={GOLD} stroke={INK} strokeWidth="2" />
    </>
  ),
  magnet: (
    <>
      <path d="M10 8h9v18a5 5 0 0 0 10 0V8h9v18a14 14 0 0 1-28 0z" fill="#ff6b6b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 8h9v7h-9zM29 8h9v7h-9z" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  hands: (
    <>
      <path d="M8 30c0-8 6-10 10-10h8c3 0 4 3 2 4l-5 2h6c4 0 8 2 8 6v4H18c-5 0-10-2-10-6z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 12v8M26 16h8" {...stroke} stroke={GOLD} strokeWidth="3.5" />
    </>
  ),
  charged: (
    <>
      <path d="M27 5L11 27h10l-3 16 19-24H26z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  luck: (
    <>
      <circle cx="17" cy="17" r="7" fill="#6fe39a" stroke={INK} strokeWidth="2.5" />
      <circle cx="31" cy="17" r="7" fill="#6fe39a" stroke={INK} strokeWidth="2.5" />
      <circle cx="17" cy="31" r="7" fill="#6fe39a" stroke={INK} strokeWidth="2.5" />
      <circle cx="31" cy="31" r="7" fill="#6fe39a" stroke={INK} strokeWidth="2.5" />
      <path d="M24 26l4 16" {...stroke} strokeWidth="3" />
    </>
  ),
  cadence: (
    <>
      <path d="M8 40V30h7v10zM18 40V22h7v18zM28 40V14h7v26z" fill={CYAN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M38 8v10M33 13h10" {...stroke} stroke={GOLD} strokeWidth="3" />
    </>
  ),
  kepler: (
    <>
      <circle cx="24" cy="24" r="9" fill="#58b4ff" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="24" cy="24" rx="19" ry="7" transform="rotate(-20 24 24)" {...stroke} stroke={GOLD} />
      <circle cx="40" cy="18" r="3" fill={LIGHT} stroke={INK} strokeWidth="2" />
    </>
  ),
  voyager: (
    <>
      <path d="M8 40l12-12" {...stroke} strokeWidth="3" />
      <circle cx="26" cy="22" r="9" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      <path d="M33 15l8-8M36 8l4 4" {...stroke} stroke={GOLD} strokeWidth="3.5" />
    </>
  ),
  echo: (
    <>
      <circle cx="24" cy="24" r="5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="12" {...stroke} stroke={CYAN} />
      <circle cx="24" cy="24" r="19" {...stroke} stroke={VIOLET} />
    </>
  ),
  lens2: (
    <>
      <circle cx="17" cy="20" r="10" fill={CYAN} fillOpacity="0.35" stroke={INK} strokeWidth="3" />
      <circle cx="30" cy="26" r="10" fill={VIOLET} fillOpacity="0.35" stroke={INK} strokeWidth="3" />
    </>
  ),
  webb: (
    <>
      <path d="M24 5l8 5v9l-8 5-8-5v-9z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 24l-8 5v9l8 5 8-5v-9zM32 24l-8 5v9l8 5 8-5v-9z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  cabin: (
    <>
      <path d="M8 38V22c0-9 7-15 16-15s16 6 16 15v16z" fill="#58b4ff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 26c0-5 4-9 10-9s10 4 10 9z" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      <path d="M8 38h32" {...stroke} strokeWidth="4" />
    </>
  ),
  chandra: (
    <>
      <circle cx="24" cy="24" r="6" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      <path d="M24 4v10M24 34v10M4 24h10M34 24h10M10 10l7 7M31 31l7 7M38 10l-7 7M17 31l-7 7" {...stroke} stroke={CYAN} strokeWidth="3" />
    </>
  ),
  gaia: (
    <>
      <path d="M3 24s8-13 21-13 21 13 21 13-8 13-21 13S3 24 3 24z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="8" fill={VIOLET} stroke={INK} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="3" fill={INK} />
    </>
  ),
  warmup: (
    <>
      <path d="M24 5c2 8 11 11 11 22a11 11 0 0 1-22 0c0-6 4-8 5-14 3 2 4 4 4 7 3-4 4-9 2-15z" fill="#ff8a3d" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 42a6 6 0 0 1-6-6c0-4 4-5 6-9 2 4 6 5 6 9a6 6 0 0 1-6 6z" fill={GOLD} stroke={INK} strokeWidth="2" />
    </>
  ),
  // --- geradores de poeira ---
  satellite: (
    <>
      <rect x="18" y="18" width="12" height="12" rx="2" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      <path d="M4 20h12v8H4zM32 20h12v8H32z" fill={CYAN} stroke={INK} strokeWidth="2.5" />
      <path d="M24 18v-6" {...stroke} />
    </>
  ),
  probe: (
    <>
      <circle cx="24" cy="26" r="8" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      <path d="M24 18V8M18 8h12M31 31l9 8" {...stroke} stroke={GOLD} strokeWidth="3" />
    </>
  ),
  telescope: (
    <>
      <path d="M8 28L34 12l5 9L13 37z" fill="#58b4ff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 33l-6 11M24 33l6 11" {...stroke} strokeWidth="3" />
    </>
  ),
  observatory: (
    <>
      <path d="M8 40V28a16 16 0 0 1 32 0v12z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 12v16" {...stroke} stroke={CYAN} strokeWidth="5" />
      <path d="M8 40h32" {...stroke} strokeWidth="4" />
    </>
  ),
  station: (
    <>
      <circle cx="24" cy="24" r="14" fill="none" stroke={INK} strokeWidth="4" />
      <circle cx="24" cy="24" r="14" fill="none" stroke={LIGHT} strokeWidth="2" />
      <path d="M24 10v28M10 24h28" {...stroke} strokeWidth="3" />
      <circle cx="24" cy="24" r="5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  colony: (
    <>
      <path d="M5 40a19 19 0 0 1 38 0z" fill={CYAN} fillOpacity="0.4" stroke={INK} strokeWidth="2.5" />
      <path d="M13 40V30h6v10zM22 40V26h6v14zM31 40V32h6v8z" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  fleet: (
    <>
      <path d="M24 5l7 20-7 6-7-6z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 18l5 12-5 4zM38 18l-5 12 5 4z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 34v8" {...stroke} stroke="#ff8a3d" strokeWidth="4" />
    </>
  ),
  portal: (
    <>
      <ellipse cx="24" cy="24" rx="13" ry="19" fill="none" stroke={INK} strokeWidth="5" />
      <ellipse cx="24" cy="24" rx="13" ry="19" fill="none" stroke={VIOLET} strokeWidth="2.5" />
      <ellipse cx="24" cy="24" rx="6" ry="11" fill={CYAN} fillOpacity="0.6" />
    </>
  ),
  cluster: (
    <>
      {[[14, 14], [32, 12], [24, 26], [11, 34], [36, 34]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      ))}
    </>
  ),
  quasar: (
    <>
      <circle cx="24" cy="24" r="7" fill={LIGHT} stroke={INK} strokeWidth="2.5" />
      <path d="M24 17V3M24 31v14" {...stroke} stroke={CYAN} strokeWidth="5" />
      <ellipse cx="24" cy="24" rx="16" ry="5" fill="none" stroke={GOLD} strokeWidth="3" />
    </>
  ),
  web: (
    <>
      <path d="M24 5v38M6 14l36 20M42 14L6 34" {...stroke} stroke={VIOLET} strokeWidth="2.5" />
      <circle cx="24" cy="24" r="12" {...stroke} stroke={CYAN} />
      <circle cx="24" cy="24" r="4" fill={GOLD} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  // --- geradores de energia ---
  antenna: (
    <>
      <path d="M24 12v30M14 42h20" {...stroke} strokeWidth="3.5" />
      <circle cx="24" cy="10" r="4" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      <path d="M13 8a15 15 0 0 0 0 16M35 8a15 15 0 0 1 0 16" {...stroke} stroke={CYAN} strokeWidth="3" />
    </>
  ),
  receiver: (
    <>
      <path d="M6 14c10 0 20 8 20 20L6 34z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 34l10 8M30 14l4-4M36 20l6-2" {...stroke} stroke={CYAN} strokeWidth="3" />
    </>
  ),
  matrix: (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={8 + c * 12} y={8 + r * 12} width="9" height="9" rx="2" fill={(r + c) % 2 ? CYAN : LIGHT} stroke={INK} strokeWidth="2" />),
      )}
    </>
  ),
  deepnet: (
    <>
      <path d="M10 12l14 12 14-12M10 36l14-12 14 12" {...stroke} stroke={VIOLET} strokeWidth="3" />
      {[[10, 12], [38, 12], [24, 24], [10, 36], [38, 36]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill={CYAN} stroke={INK} strokeWidth="2.5" />
      ))}
    </>
  ),
  array: (
    <>
      <path d="M6 40L20 10l14 30z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 40l8-18 8 18z" fill={CYAN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  // --- melhorias de gerador ---
  network: (
    <>
      <path d="M12 14l12 10 12-10M12 34l12-10 12 10" {...stroke} stroke={CYAN} strokeWidth="3" />
      {[[12, 14], [36, 14], [24, 24], [12, 34], [36, 34]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      ))}
    </>
  ),
  lure: (
    <>
      <path d="M24 6v22a8 8 0 1 1-16 0" {...stroke} strokeWidth="3.5" />
      <circle cx="34" cy="34" r="6" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      <path d="M30 28l8 12" {...stroke} stroke={VIOLET} strokeWidth="3" />
    </>
  ),
  burst: (
    <>
      <path d="M24 3l5 13 14-4-8 12 10 10-14-1-2 14-5-12-12 8 3-14L3 22l14-2z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  scale: (
    <>
      <path d="M6 42h10V32h10V22h10V12h8" {...stroke} strokeWidth="4" />
      <path d="M36 12v10M31 17h10" {...stroke} stroke={GOLD} strokeWidth="3" />
    </>
  ),
  peak: (
    <>
      <path d="M4 40L18 14l8 12 6-8 12 22z" fill={LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="37" cy="10" r="5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  queue: (
    <>
      <rect x="6" y="28" width="12" height="14" rx="2" fill={CYAN} stroke={INK} strokeWidth="2.5" />
      <rect x="20" y="20" width="12" height="22" rx="2" fill={CYAN} stroke={INK} strokeWidth="2.5" />
      <rect x="34" y="10" width="8" height="32" rx="2" fill={GOLD} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  convert: (
    <>
      <path d="M8 18h28l-7-7M40 30H12l7 7" {...stroke} stroke={CYAN} strokeWidth="4" />
      <circle cx="24" cy="24" r="4" fill={GOLD} stroke={INK} strokeWidth="2.5" />
    </>
  ),
  rotation: (
    <>
      <path d="M38 24a14 14 0 1 1-5-10.7" {...stroke} stroke={VIOLET} strokeWidth="4" />
      <path d="M36 4v12H24" {...stroke} stroke={GOLD} strokeWidth="4" />
    </>
  ),
};

/** Ícone de uma melhoria pelo id do catálogo; sem desenho próprio (id novo), cai numa estrela. */
export function UpgradeIcon({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <svg className="ap-upicon" viewBox="0 0 48 48" width={size} height={size} role="img" aria-hidden="true" focusable="false">
      {ART[id] ?? <path d="M24 4l6 14 14 2-10 10 3 14-13-7-13 7 3-14L4 20l14-2z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}
    </svg>
  );
}

/** Os ids que têm desenho próprio (o teste confere que toda melhoria do catálogo está aqui). */
export const UPGRADE_ICON_IDS: readonly string[] = Object.keys(ART);
