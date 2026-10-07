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

export const ArrowLeft = (p: IconProps) => (
  <Svg {...p} stroke={p.stroke ?? 2.8}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const Refresh = (p: IconProps) => (
  <Svg {...p} stroke={p.stroke ?? 2.6}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v5h-5" />
  </Svg>
);

export const WifiOff = (p: IconProps) => (
  <Svg {...p} stroke={p.stroke ?? 2.4}>
    <path d="M3 3l18 18" />
    <path d="M8.5 16.4a5 5 0 0 1 7 0" />
    <path d="M5 12.9a10 10 0 0 1 3.4-2.1M10.7 8.1A10 10 0 0 1 19 12.9" />
    <path d="M2 8.8a15 15 0 0 1 4-2.6M9.6 5.1A15 15 0 0 1 22 8.8" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
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

/** Sol (claro) e lua (escuro). */
export const ThemeIcon = ({
  mode,
  size = 18,
  stroke = 2.4,
}: IconProps & { mode: 'light' | 'dark' }) => (
  <Svg size={size} stroke={stroke}>
    {mode === 'light' && (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    )}
    {mode === 'dark' && <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />}
  </Svg>
);

/** Coroa: quem é o líder da sala. */
export const Crown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
    <path d="M5 21h14" />
  </Svg>
);

/** Cadeado: só o líder pode mexer. */
export const Lock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p} stroke={p.stroke ?? 3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
