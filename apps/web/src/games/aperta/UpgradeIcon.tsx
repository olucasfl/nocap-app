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

const stroke = {
  fill: 'none',
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ART: Record<string, ReactNode> = {
  // --- geradores de poeira ---
  satellite: (
    <>
      <rect
        x="18"
        y="18"
        width="12"
        height="12"
        rx="2"
        fill={LIGHT}
        stroke={INK}
        strokeWidth="2.5"
      />
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
      <path
        d="M8 28L34 12l5 9L13 37z"
        fill="#58b4ff"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M24 33l-6 11M24 33l6 11" {...stroke} strokeWidth="3" />
    </>
  ),
  observatory: (
    <>
      <path
        d="M8 40V28a16 16 0 0 1 32 0v12z"
        fill={LIGHT}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
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
      <path
        d="M5 40a19 19 0 0 1 38 0z"
        fill={CYAN}
        fillOpacity="0.4"
        stroke={INK}
        strokeWidth="2.5"
      />
      <path
        d="M13 40V30h6v10zM22 40V26h6v14zM31 40V32h6v8z"
        fill={LIGHT}
        stroke={INK}
        strokeWidth="2.5"
      />
    </>
  ),
  fleet: (
    <>
      <path
        d="M24 5l7 20-7 6-7-6z"
        fill={LIGHT}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 18l5 12-5 4zM38 18l-5 12 5 4z"
        fill={GOLD}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
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
      {[
        [14, 14],
        [32, 12],
        [24, 26],
        [11, 34],
        [36, 34],
      ].map(([x, y]) => (
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
      <path
        d="M13 8a15 15 0 0 0 0 16M35 8a15 15 0 0 1 0 16"
        {...stroke}
        stroke={CYAN}
        strokeWidth="3"
      />
    </>
  ),
  receiver: (
    <>
      <path
        d="M6 14c10 0 20 8 20 20L6 34z"
        fill={LIGHT}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M26 34l10 8M30 14l4-4M36 20l6-2" {...stroke} stroke={CYAN} strokeWidth="3" />
    </>
  ),
  matrix: (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={8 + c * 12}
            y={8 + r * 12}
            width="9"
            height="9"
            rx="2"
            fill={(r + c) % 2 ? CYAN : LIGHT}
            stroke={INK}
            strokeWidth="2"
          />
        )),
      )}
    </>
  ),
  deepnet: (
    <>
      <path d="M10 12l14 12 14-12M10 36l14-12 14 12" {...stroke} stroke={VIOLET} strokeWidth="3" />
      {[
        [10, 12],
        [38, 12],
        [24, 24],
        [10, 36],
        [38, 36],
      ].map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="4.5"
          fill={CYAN}
          stroke={INK}
          strokeWidth="2.5"
        />
      ))}
    </>
  ),
  array: (
    <>
      <path
        d="M6 40L20 10l14 30z"
        fill={LIGHT}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M26 40l8-18 8 18z"
        fill={CYAN}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </>
  ),
};

/** Ícone de uma melhoria pelo id do catálogo; sem desenho próprio (id novo), cai numa estrela. */
export function UpgradeIcon({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <svg
      className="ap-upicon"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {ART[id] ?? (
        <path
          d="M24 4l6 14 14 2-10 10 3 14-13-7-13 7 3-14L4 20l14-2z"
          fill={GOLD}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Os ids que têm desenho próprio (o teste confere que toda melhoria do catálogo está aqui). */
export const UPGRADE_ICON_IDS: readonly string[] = Object.keys(ART);
