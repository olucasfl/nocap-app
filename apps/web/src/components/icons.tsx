import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  stroke?: number;
}

/** Ícones SVG de traço (nunca emoji). */
function Svg({ size = 20, stroke = 2.2, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Svg {...p} stroke={p.stroke ?? 2.8}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const Grid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

export const History = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const Friends = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21a7 7 0 0 1 14 0" />
    <path d="M16 4a4 4 0 0 1 0 8" />
    <path d="M22 21a7 7 0 0 0-4-6.3" />
  </Svg>
);

export const User = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);

export const Speaker = ({
  size = 18,
  stroke = 2.4,
  off = false,
}: IconProps & { off?: boolean }) => (
  <Svg size={size} stroke={stroke}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" style={{ opacity: off ? 0.15 : 1 }} />
  </Svg>
);

/** Sol (claro), lua (escuro) e meio a meio (automático). */
export const ThemeIcon = ({
  mode,
  size = 18,
  stroke = 2.4,
}: IconProps & { mode: 'auto' | 'light' | 'dark' }) => (
  <Svg size={size} stroke={stroke}>
    {mode === 'light' && (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    )}
    {mode === 'dark' && <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />}
    {mode === 'auto' && (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </>
    )}
  </Svg>
);
