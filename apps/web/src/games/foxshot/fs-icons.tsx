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
