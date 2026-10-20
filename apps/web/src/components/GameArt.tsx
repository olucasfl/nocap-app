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
    // Pista com um carro passando e a seta de quem atravessa para cima.
    return (
      <div className={`ga ga-atravessa ${size}`} aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 14h52M6 50h52" />
          <path d="M6 32h6M20 32h6M34 32h6M48 32h6" strokeWidth="2.5" />
          <rect x="8" y="35" width="24" height="10" rx="3" fill="currentColor" />
          <rect x="12" y="20" width="22" height="10" rx="3" />
          <path d="M50 58V26M42 34l8-8 8 8" />
        </svg>
      </div>
    );
  }
  if (game === 'wclassic') {
    // Palavra no tabuleiro: letras certas (verde), no lugar errado (amarelo) e as casas ainda vazias.
    const tiles: [number, number, string, string | null][] = [
      [6, 8, 'P', 'var(--green)'],
      [24, 8, 'A', 'var(--yellow)'],
      [42, 8, 'T', 'var(--paper)'],
      [6, 28, 'O', 'var(--green)'],
      [24, 28, '', null],
      [42, 28, '', null],
    ];
    return (
      <div className={`ga ga-blocks ${size}`} aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
          {tiles.map(([x, y, l, fill]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="16" height="16" rx="3" fill={fill ?? 'none'} />
              {l && (
                <text x={x + 8} y={y + 12.5} textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--party-bg)" stroke="none" style={{ fontFamily: 'var(--font-display)' }}>
                  {l}
                </text>
              )}
            </g>
          ))}
          <path d="M6 50h52" strokeWidth="3.5" strokeLinecap="round" />
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
};
