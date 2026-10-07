import type { ReactNode } from 'react';
import type { GameId } from '@/lib/stats';
import './mode-picker.css';

export interface ModeOption {
  id: string;
  label: string;
  desc: string;
}

/** Arte de cada modo (só formas, sem emoji). O Daily tem a sua: um calendário com estrela. */
export function modeArt(id: string): ReactNode {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  switch (id) {
    case 'daily':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="7" width="24" height="21" rx="4" {...p} />
          <path d="M4 14h24M10 4v6M22 4v6" {...p} />
          <path
            d="M16 17l1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
    case 'impostor':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M6 14c0-6 4-10 10-10s10 4 10 10v11l-4-3-3 3-3-3-3 3-3-3-4 3z" {...p} />
          <circle cx="12" cy="14" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="14" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'blind':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" {...p} />
          <path d="M5 27L27 5" {...p} />
        </svg>
      );
    case 'survival':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="12" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
          <rect x="12.5" y="12" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
          <rect x="21" y="12" width="7" height="7" rx="1.5" {...p} />
          <path d="M4 25h24" {...p} />
        </svg>
      );
    case 'sequence':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M4 9h6M4 16h12M4 23h18" {...p} />
          <path d="M22 6l6 10-6 10" {...p} />
        </svg>
      );
    case 'escalada':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="19" width="7" height="9" rx="1.5" {...p} />
          <rect x="12.5" y="13" width="7" height="15" rx="1.5" {...p} />
          <rect x="21" y="6" width="7" height="22" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'velocidade':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 11h12M3 17h16M7 23h12" {...p} />
          <path d="M19 6l9 10-9 10" {...p} />
        </svg>
      );
    case 'reverso':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M27 16H6M12 9l-7 7 7 7" {...p} />
        </svg>
      );
    case 'flash':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M18 3L7 18h8l-2 11 12-16h-8z" {...p} />
        </svg>
      );
    case 'quick':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="9" {...p} />
          <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'strict':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 26V8M5 16h22" {...p} />
          <path d="M22 11l5 5-5 5" {...p} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="5" y="5" width="9" height="9" rx="2" {...p} />
          <rect x="18" y="5" width="9" height="9" rx="2" {...p} />
          <rect x="5" y="18" width="9" height="9" rx="2" {...p} />
          <rect x="18" y="18" width="9" height="9" rx="2" {...p} />
        </svg>
      );
  }
}

/**
 * Todos os modos do jogo como cartões. O Daily fica em cima, num retângulo de duas colunas, com
 * arte própria; tocar em um modo abre a ficha dele (`ModeSheet`), com o botão de jogar.
 */
export function ModePicker({
  game,
  modes,
  onOpen,
  dailyNote,
}: {
  game: GameId;
  modes: ModeOption[];
  onOpen: (id: string) => void;
  /** Situação do Daily de hoje ("FEITO · 21.4/30" ou "DISPONÍVEL"). */
  dailyNote?: string;
}) {
  const daily = modes.find((m) => m.id === 'daily');
  return (
    <div className={`mp ${game}`}>
      {daily && (
        <button
          type="button"
          className="mp-card daily wide"
          aria-haspopup="dialog"
          data-sfx="select"
          onClick={() => onOpen(daily.id)}
        >
          <span className="mp-art wide">{modeArt('daily')}</span>
          <span className="mp-wide-text">
            <span className="mp-name">{daily.label}</span>
            <span className="mono mp-desc">{daily.desc}</span>
            {dailyNote && <span className="mono mp-note">{dailyNote}</span>}
          </span>
        </button>
      )}
      {modes
        .filter((m) => m.id !== 'daily')
        .map((m) => (
          <button
            key={m.id}
            type="button"
            className="mp-card"
            aria-haspopup="dialog"
            data-sfx="select"
            onClick={() => onOpen(m.id)}
          >
            <span className="mp-art">{modeArt(m.id)}</span>
            <span className="mp-name">{m.label}</span>
            <span className="mono mp-desc">{m.desc}</span>
          </button>
        ))}
    </div>
  );
}
