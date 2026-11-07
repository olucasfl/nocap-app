import type { FsGrenadeId, FsWeaponId } from '@nocap/games';

/**
 * Os ícones das armas, das granadas e da faca são a silhueta lateral dos mesmos modelos 3D do jogo, em branco, com os detalhes
 * (carregador, mira, gatilho) em transparência mais baixa (`tools/art/bake-weapon-icons.mjs` gera os PNG em `public/icons/foxshot`).
 * Entram como máscara: a cor vem do CSS (`color`), como nos ícones de antes.
 */
export function WeaponIcon({ id, className }: { id: FsWeaponId | FsGrenadeId; className?: string }) {
  const url = `url(${import.meta.env.BASE_URL}icons/foxshot/${id}.png)`;
  return <span className={`fs-wi ${className ?? ''}`} style={{ WebkitMaskImage: url, maskImage: url }} aria-hidden="true" data-weapon={id} />;
}

/**
 * Ícones do kill feed, no estilo do CS2: o atirador estava cego, abate sem mirar (sniper sem luneta), o tiro varou uma parede
 * e o tiro foi na cabeça. Traço branco (cor do texto) sobre fundo transparente.
 */
export type KillIconId = 'blind' | 'noscope' | 'wall' | 'head';
const KILL_TITLES: Record<KillIconId, string> = {
  blind: 'Estava cego',
  noscope: 'Sem mirar',
  wall: 'Varou a parede',
  head: 'Cabeça',
};
export function KillIcon({ id, className }: { id: KillIconId; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 28 20" className={className} role="img" aria-label={KILL_TITLES[id]} data-kill-icon={id} focusable="false">
      <title>{KILL_TITLES[id]}</title>
      {id === 'blind' && (
        <>
          <path d="M2 10C6 3.5 20 3.5 26 10C20 16.5 6 16.5 2 10Z" {...common} strokeWidth="2" />
          <circle cx="14" cy="10" r="3.4" fill="currentColor" />
          <path d="M5 18.5L23 1.5" {...common} strokeWidth="2.6" />
        </>
      )}
      {id === 'noscope' && (
        <>
          <circle cx="14" cy="10" r="6.6" {...common} strokeWidth="2" />
          <path d="M14 1.5v4M14 14.5v4M5.5 10h4M18.5 10h4" {...common} strokeWidth="2" />
          <path d="M5 18.5L23 1.5" {...common} strokeWidth="2.6" />
        </>
      )}
      {id === 'wall' && (
        <>
          <rect x="10.5" y="2" width="7" height="16" rx="1" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7h4M12 11.5h4" stroke="currentColor" strokeWidth="1.2" opacity="0.8" />
          <path d="M1.5 10h22" {...common} strokeWidth="2.2" />
          <path d="M19.5 5.5L25 10l-5.5 4.5" {...common} strokeWidth="2.2" />
        </>
      )}
      {id === 'head' && (
        <>
          <path d="M17 2.5c-3.8 0-6.6 2.8-6.6 6.4 0 2 .9 3.6 2.2 4.6V17h5.6v-3.5c1.9-1 3.2-2.9 3.2-5.2 0-3.3-1.8-5.8-4.4-5.8Z" fill="currentColor" />
          <circle cx="19" cy="8.2" r="1.3" fill="#10162a" />
          <path d="M1.5 9.5h9" {...common} strokeWidth="2.2" />
          <path d="M6 5.2l4.6 4.3L6 13.8" {...common} strokeWidth="2.2" />
        </>
      )}
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

/** Alicate de desarme (modo Bomba). */
export function KitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M4 20 11 11 9 6l3-3 3 3-2 3 3 3 5 3-3 3-4-2-3 2-5 2Z" fill="currentColor" />
      <circle cx="17.5" cy="6.5" r="2" fill="currentColor" />
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
