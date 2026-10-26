import type { ReactNode } from 'react';

/** Ícones do Fut Fox: traço grosso, cantos redondos e `currentColor`, no mesmo peso dos botões Pop Brutal. */
function Ico({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
type P = { size?: number };

/** Engrenagem de verdade (dentes e furo no meio): o ícone das configurações. */
export const IcGear = ({ size = 20 }: P) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
    fill="currentColor"
    fillRule="evenodd"
  >
    <path d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6c-.6.3-1.2.6-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.6L4.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.4c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
  </svg>
);
export const IcTable = (p: P) => (
  <Ico {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M9.5 10v9.5" />
  </Ico>
);
export const IcEye = (p: P) => (
  <Ico {...p}>
    <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Ico>
);
export const IcCamera = (p: P) => (
  <Ico {...p}>
    <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.4" r="3.2" />
  </Ico>
);
export const IcTeams = (p: P) => (
  <Ico {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
    <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.4c1.8.5 3 2 3.4 4.6" />
  </Ico>
);
export const IcFlag = (p: P) => (
  <Ico {...p}>
    <path d="M5.5 21V4M5.5 5h11l-2.2 3.6 2.2 3.6h-11" />
  </Ico>
);
export const IcExit = (p: P) => (
  <Ico {...p}>
    <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M14.5 8l4 4-4 4M18.5 12H9.5" />
  </Ico>
);
export const IcNet = (p: P) => (
  <Ico {...p}>
    <path d="M3 9.5a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.2 16.4a4.4 4.4 0 0 1 5.6 0" />
    <circle cx="12" cy="19.6" r="1" fill="currentColor" />
  </Ico>
);
export const IcPlay = (p: P) => (
  <Ico {...p}>
    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
  </Ico>
);
export const IcBall = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4L12 8.2ZM12 3.5v4.7M15.4 10.7l4.3-1.4M14.1 14.7l2.6 3.6M9.9 14.7l-2.6 3.6M8.6 10.7L4.3 9.3" />
  </Ico>
);
export const IcJump = (p: P) => (
  <Ico {...p}>
    <path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" />
  </Ico>
);

/** Tecla de teclado: no desktop mostra qual tecla faz a ação; no celular some (onde não há teclado). */
export function Key({
  k,
  wide = false,
  className = '',
}: {
  k: string;
  wide?: boolean;
  className?: string;
}) {
  return (
    <kbd className={`bola-keycap${wide ? ' is-wide' : ''}${className ? ` ${className}` : ''}`}>
      {k}
    </kbd>
  );
}
