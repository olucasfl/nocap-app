import { LOW_END } from './perf';

export const SPACE_OBJECTS = ['comet', 'meteor', 'satellite', 'asteroid', 'probe', 'golden'] as const;
export type SpaceObjectKind = (typeof SPACE_OBJECTS)[number];

export const SPACE_OBJECT_LABEL: Record<SpaceObjectKind, string> = {
  comet: 'Cometa',
  meteor: 'Estrela cadente',
  satellite: 'Satélite',
  asteroid: 'Asteroide',
  probe: 'Sonda',
  golden: 'Estrela Dourada',
};

/** Cor de destaque de cada objeto (halo, etiqueta). Os valores vêm dos tokens --space-obj-*. */
export const SPACE_OBJECT_COLOR: Record<SpaceObjectKind, string> = {
  comet: 'var(--space-obj-comet)',
  meteor: 'var(--space-obj-meteor)',
  satellite: 'var(--space-obj-satellite)',
  asteroid: 'var(--space-obj-asteroid)',
  probe: 'var(--space-obj-probe)',
  golden: 'var(--space-obj-golden)',
};

type Props = {
  kind: SpaceObjectKind;
  size?: number | string;
  /** Brilho em volta, na cor do objeto. */
  glow?: boolean;
  /** Sem rótulo, o SVG é decorativo (quem o envolve é o botão com aria-label). */
  label?: string;
  className?: string;
};

function Shape({ kind }: { kind: SpaceObjectKind }) {
  switch (kind) {
    case 'comet':
      return (
        <>
          <path d="M4 60C18 48 30 36 44 22" stroke="#7fe3ff" strokeWidth="8" strokeLinecap="round" opacity=".45" />
          <path d="M10 56C24 46 34 34 46 24" stroke="#d7f6ff" strokeWidth="4" strokeLinecap="round" />
          <circle cx="46" cy="22" r="11" fill="#e9fbff" />
          <circle cx="43" cy="19" r="4.5" fill="#fff" />
        </>
      );
    case 'meteor':
      return (
        <>
          <path
            d="M32 4l7 18 19 2-14 13 5 19-17-10-17 10 5-19L6 24l19-2z"
            fill="#ffd166"
            stroke="#7a5200"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M32 15l4 11 12 1-9 8 3 12-10-6-10 6 3-12-9-8 12-1z" fill="#fff3c2" />
        </>
      );
    case 'satellite':
      return (
        <>
          <rect x="24" y="22" width="16" height="20" rx="3" fill="#cfd5e3" stroke="#2b3566" strokeWidth="3" />
          <rect x="2" y="26" width="18" height="12" fill="#6b8cff" stroke="#2b3566" strokeWidth="3" />
          <rect x="44" y="26" width="18" height="12" fill="#6b8cff" stroke="#2b3566" strokeWidth="3" />
          <path d="M32 22v-8M28 14h8" stroke="#cfd5e3" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="32" r="4" fill="#ff5a4d" />
        </>
      );
    case 'asteroid':
      return (
        <>
          <path
            d="M10 30l6-14 14-6 14 4 10 12-2 14-12 12-16 2-12-10z"
            fill="#9a8570"
            stroke="#3a2e22"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="28" r="5" fill="#6f5d4a" />
          <circle cx="40" cy="38" r="6" fill="#6f5d4a" />
          <circle cx="38" cy="22" r="2.5" fill="#6f5d4a" />
          <path d="M16 20l10-6" stroke="#d8c4a8" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
        </>
      );
    case 'golden':
      return (
        <>
          <circle cx="32" cy="32" r="27" fill="#ffd447" opacity=".22" />
          <path
            d="M32 2l8 19 21 2-16 14 5 20-18-11-18 11 5-20L3 23l21-2z"
            fill="#ffd447"
            stroke="#8a5a00"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M32 14l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" fill="#fff6c9" />
        </>
      );
    case 'probe':
      return (
        <>
          <path d="M32 6v10" stroke="#cfd5e3" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="6" r="3" fill="#ff5a4d" />
          <path d="M14 22c6-8 30-8 36 0z" fill="#e8ecf6" stroke="#2b3566" strokeWidth="3" strokeLinejoin="round" />
          <rect x="24" y="24" width="16" height="16" rx="3" fill="#cfd5e3" stroke="#2b3566" strokeWidth="3" />
          <path d="M28 40l-8 16M36 40l8 16M22 56h8M34 56h8" stroke="#9fe8c0" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="32" r="3" fill="#9fe8c0" />
        </>
      );
  }
}

/** Objeto que cruza o espaço e pode ser capturado com um toque. Puramente visual. */
export function SpaceObject({ kind, size = 62, glow = false, label, className }: Props) {
  const accessible = label !== undefined;
  return (
    <svg
      className={`ap-object${className ? ` ${className}` : ''}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={accessible ? 'img' : undefined}
      aria-label={accessible ? label || SPACE_OBJECT_LABEL[kind] : undefined}
      aria-hidden={accessible ? undefined : true}
      focusable="false"
      data-kind={kind}
      style={glow && !LOW_END ? { filter: `drop-shadow(0 0 12px ${SPACE_OBJECT_COLOR[kind]})` } : undefined}
    >
      <Shape kind={kind} />
    </svg>
  );
}
