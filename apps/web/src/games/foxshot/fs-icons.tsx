import type { FsWeaponId } from '@nocap/games';

/** Silhuetas das armas para o HUD, o placar e o kill feed (desenhadas à mão, sem emoji). */
const PATHS: Record<FsWeaponId, string> = {
  ak: 'M2 19 L20 14 L50 14 L54 12 L92 12 L92 15 L56 16 L50 17 L40 17 L36 31 L30 31 L32 17 L22 18 L15 31 L9 31 L12 21 Z',
  pistol: 'M24 10 H74 V18 H48 L42 32 H30 L34 18 H24 Z',
  knife: 'M6 26 L10 20 L58 12 L84 15 L60 24 L36 27 L14 32 Z',
  sniper: 'M2 21 H28 L32 17 H46 V12 H58 V17 H98 V19 H58 V21 H46 L40 30 H34 L36 24 H2 Z',
};

export function WeaponIcon({ id, className }: { id: FsWeaponId; className?: string }) {
  return (
    <svg viewBox="0 0 100 40" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[id]} fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 21 3.5 12.6A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 8.5 6.4Z" fill="currentColor" />
    </svg>
  );
}

export function VestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M5 3h4l3 2.5L15 3h4l1 5-2 1v11H6V9L4 8Z" fill="currentColor" />
    </svg>
  );
}

export function SkullIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5 3.5 6V20h2v-2h1v2h3v-2h1v2h2v-4c1.9-1 3.5-3 3.5-6a8 8 0 0 0-8-8Zm-3 9a2 2 0 1 1 0 .01Zm6 0a2 2 0 1 1 0 .01Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
