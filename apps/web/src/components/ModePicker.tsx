import type { ReactNode } from 'react';
import type { GameId } from '@/lib/stats';
import './mode-picker.css';

export interface ModeOption {
  id: string;
  label: string;
  desc: string;
}

/** Arte de cada modo (só formas, sem emoji). O Daily tem a sua: um calendário com estrela. */
function art(id: string): ReactNode {
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

/** Modos do jogo como cartões, o Daily junto dos outros (com arte e cor próprias). */
export function ModePicker({
  game,
  modes,
  value,
  onChange,
}: {
  game: GameId;
  modes: ModeOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={`mp ${game}`} role="radiogroup" aria-label="Modo de jogo">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          className={`mp-card${m.id === 'daily' ? ' daily' : ''}`}
          onClick={() => onChange(m.id)}
        >
          <span className="mp-art">{art(m.id)}</span>
          <span className="mp-name">{m.label}</span>
          <span className="mono mp-desc">{m.desc}</span>
        </button>
      ))}
    </div>
  );
}
