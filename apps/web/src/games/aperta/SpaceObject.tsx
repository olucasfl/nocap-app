import { LOW_END } from './perf';

export const SPACE_OBJECTS = [
  'comet',
  'meteor',
  'satellite',
  'asteroid',
  'probe',
  'golden',
  'legend-comet',
  'legend-pulsar',
  'legend-nebula',
  'legend-wormhole',
] as const;
export type SpaceObjectKind = (typeof SPACE_OBJECTS)[number];

export const SPACE_OBJECT_LABEL: Record<SpaceObjectKind, string> = {
  comet: 'Cometa',
  meteor: 'Estrela cadente',
  satellite: 'Satélite',
  asteroid: 'Asteroide',
  probe: 'Sonda',
  golden: 'Estrela Dourada',
  'legend-comet': 'Grande Cometa',
  'legend-pulsar': 'Pulsar',
  'legend-nebula': 'Nebulosa errante',
  'legend-wormhole': 'Buraco de minhoca',
};

/** Cor de destaque de cada objeto (halo, etiqueta). Os valores vêm dos tokens --space-obj-*. */
export const SPACE_OBJECT_COLOR: Record<SpaceObjectKind, string> = {
  comet: 'var(--space-obj-comet)',
  meteor: 'var(--space-obj-meteor)',
  satellite: 'var(--space-obj-satellite)',
  asteroid: 'var(--space-obj-asteroid)',
  probe: 'var(--space-obj-probe)',
  golden: 'var(--space-obj-golden)',
  'legend-comet': 'var(--space-obj-legend-comet)',
  'legend-pulsar': 'var(--space-obj-legend-pulsar)',
  'legend-nebula': 'var(--space-obj-legend-nebula)',
  'legend-wormhole': 'var(--space-obj-legend-wormhole)',
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
          <path
            d="M4 60C18 48 30 36 44 22"
            stroke="#7fe3ff"
            strokeWidth="8"
            strokeLinecap="round"
            opacity=".45"
          />
          <path
            d="M10 56C24 46 34 34 46 24"
            stroke="#d7f6ff"
            strokeWidth="4"
            strokeLinecap="round"
          />
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
          <rect
            x="24"
            y="22"
            width="16"
            height="20"
            rx="3"
            fill="#cfd5e3"
            stroke="#2b3566"
            strokeWidth="3"
          />
          <rect
            x="2"
            y="26"
            width="18"
            height="12"
            fill="#6b8cff"
            stroke="#2b3566"
            strokeWidth="3"
          />
          <rect
            x="44"
            y="26"
            width="18"
            height="12"
            fill="#6b8cff"
            stroke="#2b3566"
            strokeWidth="3"
          />
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
          <path
            d="M16 20l10-6"
            stroke="#d8c4a8"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".7"
          />
        </>
      );
    case 'golden':
      // Estrela Dourada premium (spec 041, A8): raios em leque, estrela facetada com degradê, halo duplo e brilhos que piscam.
      return (
        <>
          <defs>
            <radialGradient id="apg-gold-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#fff3a8" stopOpacity=".85" />
              <stop offset="0.55" stopColor="#ffc933" stopOpacity=".35" />
              <stop offset="1" stopColor="#ffc933" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="apg-gold-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff6c2" />
              <stop offset="0.45" stopColor="#ffd447" />
              <stop offset="1" stopColor="#c27a00" />
            </linearGradient>
            <linearGradient id="apg-gold-dark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f2a900" />
              <stop offset="1" stopColor="#8a4f00" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="31" fill="url(#apg-gold-halo)" />
          <g
            className="apg-gold-rays"
            stroke="#ffe27a"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity=".85"
          >
            <path d="M32 0v7M32 57v7M0 32h7M57 32h7M9 9l5 5M50 50l5 5M55 9l-5 5M14 50l-5 5" />
          </g>
          <circle
            cx="32"
            cy="32"
            r="22"
            fill="none"
            stroke="#fff3a8"
            strokeWidth="1.6"
            strokeDasharray="2 4"
            opacity=".8"
          />
          <path
            d="M32 6l7.5 17.5 19 1.8-14.4 12.6 4.4 18.6L32 46.6 15.5 56.5l4.4-18.6L5.5 25.3l19-1.8z"
            fill="url(#apg-gold-dark)"
            stroke="#6b3d00"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d="M32 6l7.5 17.5L32 32l-7.5-8.5z" fill="url(#apg-gold-body)" />
          <path d="M5.5 25.3l19-1.8L32 32 15.5 37.9z" fill="#ffe27a" opacity=".9" />
          <path d="M58.5 25.3l-19-1.8L32 32l16.5 5.9z" fill="#ffb81f" />
          <path d="M32 46.6L19.9 37.9 32 32l12.1 5.9z" fill="#ffcf40" />
          <path d="M32 11l3.6 8.8" stroke="#fffbe0" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="32" r="5" fill="#fffbe0" stroke="#d99200" strokeWidth="1.6" />
          <g className="apg-gold-spark" fill="#fff">
            <path d="M54 8l1.6 3.4L59 13l-3.4 1.6L54 18l-1.6-3.4L49 13l3.4-1.6z" />
            <path d="M9 44l1.2 2.6L13 48l-2.8 1.2L9 52l-1.2-2.8L5 48l2.8-1.4z" />
          </g>
        </>
      );
    case 'legend-comet':
      return (
        <>
          <path
            d="M2 62C16 52 28 40 42 24"
            stroke="#ff9f5c"
            strokeWidth="11"
            strokeLinecap="round"
            opacity=".35"
          />
          <path
            d="M8 60C22 50 34 38 46 26"
            stroke="#ffd1a3"
            strokeWidth="6"
            strokeLinecap="round"
            opacity=".7"
          />
          <path
            d="M14 58C26 50 36 40 46 28"
            stroke="#fff4e6"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="46" cy="22" r="14" fill="#fff0d6" stroke="#b25a12" strokeWidth="3" />
          <circle cx="42" cy="18" r="5.5" fill="#fff" />
          <path
            d="M46 2v6M60 22h-6M56 8l-4 4"
            stroke="#ffd1a3"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case 'legend-pulsar':
      return (
        <>
          <ellipse
            cx="32"
            cy="32"
            rx="29"
            ry="7"
            fill="none"
            stroke="#9ef0ff"
            strokeWidth="3"
            opacity=".55"
          />
          <ellipse
            cx="32"
            cy="32"
            rx="7"
            ry="29"
            fill="none"
            stroke="#9ef0ff"
            strokeWidth="3"
            opacity=".55"
          />
          <path
            d="M32 3L36 28 61 32 36 36 32 61 28 36 3 32 28 28z"
            fill="#d8fbff"
            stroke="#1c5f73"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="6" fill="#fff" />
        </>
      );
    case 'legend-nebula':
      return (
        <>
          <circle cx="24" cy="30" r="18" fill="#a77bff" opacity=".55" />
          <circle cx="40" cy="26" r="16" fill="#ff7bd0" opacity=".5" />
          <circle cx="34" cy="42" r="15" fill="#6fd3ff" opacity=".55" />
          <circle cx="30" cy="32" r="9" fill="#f3eaff" stroke="#4a2c8c" strokeWidth="3" />
          <circle cx="12" cy="12" r="2" fill="#fff" />
          <circle cx="54" cy="50" r="2.5" fill="#fff" />
          <circle cx="52" cy="10" r="1.5" fill="#fff" />
        </>
      );
    case 'legend-wormhole':
      return (
        <>
          <circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke="#7fb4ff"
            strokeWidth="3"
            opacity=".5"
          />
          <circle
            cx="32"
            cy="32"
            r="22"
            fill="none"
            stroke="#b79bff"
            strokeWidth="4"
            opacity=".75"
          />
          <circle cx="32" cy="32" r="14" fill="none" stroke="#e1d3ff" strokeWidth="4" />
          <circle cx="32" cy="32" r="7" fill="#0a0d24" stroke="#fff" strokeWidth="3" />
          <path
            d="M32 3a29 29 0 0 1 20 8M61 32a29 29 0 0 1-8 20"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".7"
          />
        </>
      );
    case 'probe':
      return (
        <>
          <path d="M32 6v10" stroke="#cfd5e3" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="6" r="3" fill="#ff5a4d" />
          <path
            d="M14 22c6-8 30-8 36 0z"
            fill="#e8ecf6"
            stroke="#2b3566"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect
            x="24"
            y="24"
            width="16"
            height="16"
            rx="3"
            fill="#cfd5e3"
            stroke="#2b3566"
            strokeWidth="3"
          />
          <path
            d="M28 40l-8 16M36 40l8 16M22 56h8M34 56h8"
            stroke="#9fe8c0"
            strokeWidth="3"
            strokeLinecap="round"
          />
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
      style={
        glow && !LOW_END
          ? { filter: `drop-shadow(0 0 12px ${SPACE_OBJECT_COLOR[kind]})` }
          : undefined
      }
    >
      <Shape kind={kind} />
    </svg>
  );
}
