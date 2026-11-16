import type { ReactElement } from 'react';

/** Símbolos dos poderes do Arcade (spec 085): um SVG por tipo, com a cor do próprio poder. */
export type GpIconKind =
  | 'peel'
  | 'ball'
  | 'seeker'
  | 'bomb'
  | 'nitro'
  | 'star'
  | 'bolt'
  | 'shield'
  | 'ice'
  | 'shock'
  | 'mud'
  | 'swap';

const ART: Record<GpIconKind, ReactElement> = {
  peel: (
    <>
      <defs>
        <linearGradient id="gi-peel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#f08a12" />
        </linearGradient>
      </defs>
      <path
        d="M10 44c4-2 10 2 16-2 6-4 4-12 10-18 4-4 10-6 18-4-2 8-8 22-22 28-8 3-16 2-22-4z"
        fill="url(#gi-peel)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M22 40c8-4 14-10 20-20"
        stroke="#fff1c4"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="52" cy="14" r="4" fill="#3f9a45" stroke="#141a2b" strokeWidth="2.5" />
    </>
  ),
  ball: (
    <>
      <defs>
        <radialGradient id="gi-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#8affb0" />
          <stop offset="0.6" stopColor="#1fbf63" />
          <stop offset="1" stopColor="#0a7a3a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="url(#gi-ball)" stroke="#141a2b" strokeWidth="3" />
      <path
        d="M12 26c14 6 26 6 40 0M12 40c14-6 26-6 40 0"
        stroke="#eaffef"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse
        cx="24"
        cy="20"
        rx="5"
        ry="3"
        fill="#fff"
        opacity=".7"
        transform="rotate(-30 24 20)"
      />
    </>
  ),
  seeker: (
    <>
      <defs>
        <linearGradient id="gi-seek" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff9a2a" />
          <stop offset="1" stopColor="#e8343c" />
        </linearGradient>
      </defs>
      <path d="M4 32c8-6 14-6 20 0-6 6-12 6-20 0z" fill="#ffb02e" opacity=".9" />
      <path d="M6 32c6-3 10-3 14 0-4 3-8 3-14 0z" fill="#fff3a8" />
      <path
        d="M22 20h18c8 0 16 6 20 12-4 6-12 12-20 12H22c-4-4-4-20 0-24z"
        fill="url(#gi-seek)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M44 22c6 2 10 6 12 10-2 4-6 8-12 10z"
        fill="#fff"
        stroke="#141a2b"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M22 20l-6-8h8l4 8M22 44l-6 8h8l4-8" fill="#141a2b" />
    </>
  ),
  bomb: (
    <>
      <defs>
        <radialGradient id="gi-bomb" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#6a5aa8" />
          <stop offset="0.5" stopColor="#2a2150" />
          <stop offset="1" stopColor="#120c28" />
        </radialGradient>
      </defs>
      <circle cx="30" cy="38" r="20" fill="url(#gi-bomb)" stroke="#141a2b" strokeWidth="3" />
      <rect
        x="25"
        y="12"
        width="12"
        height="9"
        rx="2"
        fill="#8a5cff"
        stroke="#141a2b"
        strokeWidth="2.5"
      />
      <path
        d="M31 12c2-6 8-8 14-4"
        stroke="#d9c7a1"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M46 8l4-5m0 5l-6-3m6 3l-2 5"
        stroke="#ffd23a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22" cy="32" r="4" fill="#fff" opacity=".35" />
      <circle cx="26" cy="42" r="3" fill="#e8343c" />
      <circle cx="36" cy="42" r="3" fill="#e8343c" />
    </>
  ),
  nitro: (
    <>
      <defs>
        <linearGradient id="gi-nit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6f9bff" />
          <stop offset="1" stopColor="#2f5bff" />
        </linearGradient>
      </defs>
      <path
        d="M32 6c4 4 10 8 10 14v28c0 4-4 8-10 8s-10-4-10-8V20c0-6 6-10 10-14z"
        fill="url(#gi-nit)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="22" y="28" width="20" height="8" fill="#ffd23a" stroke="#141a2b" strokeWidth="2.5" />
      <circle cx="32" cy="20" r="4" fill="#dfe8ff" stroke="#141a2b" strokeWidth="2" />
      <path
        d="M26 58l-4 6M32 60v6M38 58l4 6"
        stroke="#ff7d26"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </>
  ),
  star: (
    <>
      <defs>
        <linearGradient id="gi-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset="1" stopColor="#ffa800" />
        </linearGradient>
      </defs>
      <path
        d="M32 5l8.5 17.5L60 25l-14 13.6L49.5 58 32 48.8 14.5 58 18 38.6 4 25l19.5-2.5z"
        fill="url(#gi-star)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="32" r="2.6" fill="#141a2b" />
      <circle cx="38" cy="32" r="2.6" fill="#141a2b" />
      <path
        d="M27 40c3 3 7 3 10 0"
        stroke="#141a2b"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  bolt: (
    <>
      <defs>
        <radialGradient id="gi-bolt" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#dff4ff" />
          <stop offset="0.5" stopColor="#4fb3ff" />
          <stop offset="1" stopColor="#1a4bd0" />
        </radialGradient>
      </defs>
      <path
        d="M32 3l5 14 14-5-6 13 14 6-14 6 6 13-14-5-5 14-5-14-14 5 6-13-14-6 14-6-6-13 14 5z"
        fill="url(#gi-bolt)"
        stroke="#141a2b"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="8" fill="#fff" opacity=".85" />
    </>
  ),
  shield: (
    <>
      <defs>
        <radialGradient id="gi-shield" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#e8ffff" />
          <stop offset="0.55" stopColor="#5fe3ff" />
          <stop offset="1" stopColor="#1a8ab8" />
        </radialGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="23"
        fill="url(#gi-shield)"
        fillOpacity=".55"
        stroke="#141a2b"
        strokeWidth="3"
      />
      <circle cx="32" cy="32" r="23" fill="none" stroke="#e8ffff" strokeWidth="2" opacity=".8" />
      <path
        d="M32 14l11 4v10c0 8-5 14-11 17-6-3-11-9-11-17V18z"
        fill="#fff"
        stroke="#141a2b"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M32 20v20M25 27h14" stroke="#1a8ab8" strokeWidth="3" strokeLinecap="round" />
      <ellipse
        cx="22"
        cy="20"
        rx="5"
        ry="3"
        fill="#fff"
        opacity=".7"
        transform="rotate(-35 22 20)"
      />
    </>
  ),
  ice: (
    <>
      <defs>
        <linearGradient id="gi-ice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8ffff" />
          <stop offset="1" stopColor="#3aa8e0" />
        </linearGradient>
      </defs>
      <path
        d="M32 4l9 16 15 4-11 11 3 17-16-9-16 9 3-17L8 24l15-4z"
        fill="url(#gi-ice)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M32 14v36M16 24l32 16M48 24L16 40"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity=".85"
      />
      <path
        d="M6 54l8-4M58 54l-8-4M32 62v-6"
        stroke="#9fe8ff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
  shock: (
    <>
      <defs>
        <radialGradient id="gi-shock" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fffbd0" />
          <stop offset="1" stopColor="#ffa800" />
        </radialGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="#ffe14a"
        strokeWidth="3"
        strokeDasharray="6 5"
      />
      <circle cx="32" cy="32" r="18" fill="url(#gi-shock)" stroke="#141a2b" strokeWidth="3" />
      <path
        d="M36 14L24 34h8l-4 16 14-22h-9z"
        fill="#141a2b"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </>
  ),
  mud: (
    <>
      <defs>
        <radialGradient id="gi-mud" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#c98a50" />
          <stop offset="0.6" stopColor="#6b3e1c" />
          <stop offset="1" stopColor="#3a200c" />
        </radialGradient>
      </defs>
      <path
        d="M32 8c6 8 18 12 20 26 2 12-8 22-20 22S10 46 12 34C14 20 26 16 32 8z"
        fill="url(#gi-mud)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="14" r="5" fill="#6b3e1c" stroke="#141a2b" strokeWidth="2.5" />
      <circle cx="12" cy="18" r="4" fill="#6b3e1c" stroke="#141a2b" strokeWidth="2.5" />
      <ellipse
        cx="24"
        cy="30"
        rx="6"
        ry="3.5"
        fill="#fff"
        opacity=".35"
        transform="rotate(-30 24 30)"
      />
    </>
  ),
  swap: (
    <>
      <defs>
        <linearGradient id="gi-swap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0b0ff" />
          <stop offset="1" stopColor="#9a2ad0" />
        </linearGradient>
      </defs>
      <path
        d="M8 22h34V12l16 14-16 14V30H8z"
        fill="url(#gi-swap)"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M56 42H22V32L6 46l16 14V50h34z"
        fill="#fff"
        stroke="#141a2b"
        strokeWidth="3"
        strokeLinejoin="round"
        opacity=".92"
      />
    </>
  ),
};

export function GpItemIcon({ kind, size = 48 }: { kind: GpIconKind; size?: number }) {
  return (
    <svg
      className="gpx-icon"
      data-kind={kind}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {ART[kind]}
    </svg>
  );
}
