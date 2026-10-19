import type { GameId } from '@/lib/stats';
import './game-ui.css';

/** Cores do jogo da Cor: amostras variadas (as cores dos jogos nunca mudam com o tema). */
const SWATCHES = [
  'var(--yellow)',
  'var(--blue)',
  'var(--paper)',
  'var(--ink)',
  'var(--pink)',
  'var(--green)',
];

/** Os quatro botões do Eco. */
const ECO_PADS = ['var(--orange)', 'var(--blue)', 'var(--yellow)', 'var(--green)'];

/**
 * Arte própria de cada jogo, usada no Hub, no Daily e no Perfil: a Cor é uma grade de amostras
 * sobre laranja; o Tempo é um relógio parado sobre azul. Só formas e tokens, sem emoji.
 */
export function GameArt({ game, size = 'md' }: { game: GameId; size?: 'sm' | 'md' }) {
  if (game === 'color') {
    return (
      <div className={`ga ga-color ${size}`} aria-hidden="true">
        {SWATCHES.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
    );
  }
  if (game === 'eco') {
    return (
      <div className={`ga ga-eco ${size}`} aria-hidden="true">
        {ECO_PADS.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
    );
  }
  if (game === 'blocks') {
    return (
      <div className={`ga ga-blocks ${size}`} aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round">
          <rect x="8" y="8" width="20" height="20" rx="4" />
          <rect x="36" y="8" width="20" height="20" rx="4" fill="currentColor" />
          <rect x="8" y="36" width="20" height="20" rx="4" fill="currentColor" />
          <rect x="36" y="36" width="20" height="20" rx="4" />
        </svg>
      </div>
    );
  }
  if (game === 'atravessa') {
    return (
      <div className={`ga ga-atravessa ${size}`} aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
          <path d="M8 44l24-14 24 14-24 14z" />
          <path d="M20 30V16l12-7 12 7v14" />
          <path d="M32 30v14" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`ga ga-time ${size}`} aria-hidden="true">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <circle cx="32" cy="32" r="24" />
        <path d="M32 18v15l10 6" />
        <path d="M26 4h12" />
      </svg>
    </div>
  );
}

export const GAME_LABEL: Record<GameId, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  eco: 'Ecooo',
  blocks: "Block's",
  atravessa: 'Atravessa!',
  wclassic: "Classic Word's",
  wbee: "Bee Word's",
  wconnect: "Connect Word's",
};
