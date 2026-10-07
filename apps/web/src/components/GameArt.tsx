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
};
