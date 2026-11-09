import { useState, type CSSProperties, type ReactNode } from 'react';
import type { LevelStatus } from '../levels/progress';

export interface BrowserCell {
  n: number;
  status: LevelStatus;
  /** Texto pequeno da casa (acertos, pontos...). */
  sub?: string;
  /** Marca extra da casa (perfeita, desistiu...). */
  tone?: string;
  label: string;
}

type Filter = 'all' | LevelStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'new', label: 'Novas' },
  { id: 'open', label: 'Andamento' },
  { id: 'done', label: 'Completas' },
];

/** O catálogo de fases (filtros e casas por faixa) que ocupa o lado direito da tela do jogo. */
export function LevelBrowser({
  title,
  cells,
  tiers,
  go,
  extra,
}: {
  title: string;
  cells: BrowserCell[];
  tiers: { tier: string; from: number; to: number }[];
  go: (n: number) => void;
  extra?: (c: BrowserCell) => ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const count = (f: Filter) =>
    f === 'all' ? cells.length : cells.filter((c) => c.status === f).length;
  return (
    <section className="wl-levels" data-testid="wl-levels" aria-label={title}>
      <div className="wl-chips" role="group" aria-label="Filtro">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="wl-chip"
            aria-pressed={filter === f.id}
            data-testid={`filter-${f.id}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} <b>{count(f.id)}</b>
          </button>
        ))}
      </div>
      {tiers.map(({ tier, from, to }) => {
        const shown = cells.filter(
          (c) => c.n >= from && c.n <= to && (filter === 'all' || c.status === filter),
        );
        if (shown.length === 0) return null;
        return (
          <div className="wl-tier" key={tier} aria-label={tier}>
            <h3>
              {tier}{' '}
              <span>
                fases {from} a {to}
              </span>
            </h3>
            <div className="wl-grid">
              {shown.map((c, i) => (
                <button
                  key={c.n}
                  type="button"
                  className={`wl-cell ${c.status}${c.tone ? ` ${c.tone}` : ''}`}
                  style={{ '--i': Math.min(i, 24) } as CSSProperties}
                  data-testid={`level-${c.n}`}
                  data-status={c.status}
                  data-sfx="select"
                  aria-label={c.label}
                  onClick={() => go(c.n)}
                >
                  <b>{c.n}</b>
                  {c.sub && <small>{c.sub}</small>}
                  {extra?.(c)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="wl-legend" aria-hidden="true">
        <span className="new">nova</span>
        <span className="open">em andamento</span>
        <span className="done">concluída</span>
      </div>
    </section>
  );
}
