import { formatNumber, type AchievementGroup, type SaveState } from '@nocap/games';
import { useMemo, useState } from 'react';
import { AstroMedal } from './AstroMedal';
import {
  NO_FILTER,
  achievementChips,
  achievementCounts,
  achievementGroups,
  achievementSparkTotals,
  type AchievementFilter,
  type AchievementRow,
  type AchievementStatus,
} from './achievements-logic';
import './achievements.css';

const sparks = (n: number) => `${formatNumber(n)} ${n === 1 ? 'Cintila' : 'Cintilas'}`;

function Card({ row }: { row: AchievementRow }) {
  const label = row.secret
    ? 'Conquista escondida'
    : `${row.name}: ${row.earned ? 'ganha' : row.soon ? 'em breve' : `${formatNumber(row.value)} de ${formatNumber(row.goal)}`}. Recompensa: ${sparks(row.reward)}`;
  return (
    <li
      className={`ap-ach${row.earned ? ' is-earned' : ''}${row.secret ? ' is-secret' : ''}${row.soon ? ' is-soon' : ''}`}
      aria-label={label}
      data-ach={row.id}
    >
      <span className="ap-ach-medal">
        <AstroMedal astro={row.astro} />
      </span>
      <div className="ap-ach-body">
        <h4>{row.name}</h4>
        <p className="ap-ach-text">{row.text}</p>
        {!row.secret && !row.soon && (
          <>
            <span className="ap-ach-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${row.fraction})` }} />
            </span>
            <p className="ap-ach-count">{row.earned ? 'Ganha' : `${formatNumber(row.value)}/${formatNumber(row.goal)}`}</p>
          </>
        )}
        {row.soon && <p className="ap-ach-count">{row.soonText}</p>}
      </div>
      <span className="ap-ach-reward" aria-hidden="true">
        +{row.reward}
      </span>
    </li>
  );
}

const STATUS: { id: AchievementStatus; name: string }[] = [
  { id: 'all', name: 'Todas' },
  { id: 'todo', name: 'Faltam' },
  { id: 'earned', name: 'Ganhas' },
];

/**
 * Página de Conquistas (spec 038, 5.3; ampliada pela spec 040, seção 4): filtro por família, busca, estado, N/M por
 * família, Cintilas ganhas e a ganhar, e a recompensa de cada uma.
 */
export function AchievementsPage({ state }: { state: SaveState }) {
  const [filter, setFilter] = useState<AchievementFilter>(NO_FILTER);
  const counts = achievementCounts(state);
  const totals = achievementSparkTotals(state);
  const chips = useMemo(() => achievementChips(state), [state]);
  const groups = achievementGroups(state, filter);
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);
  const set = (patch: Partial<AchievementFilter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <div className="ap-achpage">
      <div className="ap-ach-head">
        <p className="ap-ach-total">
          <b>{counts.earned}</b> de {counts.total} conquistas
        </p>
        <p className="ap-ach-sparks" aria-label="Cintilas das conquistas">
          <span>
            <b>{formatNumber(totals.earned)}</b> ganhas
          </span>
          <span>
            <b>{formatNumber(totals.toEarn)}</b> a ganhar
          </span>
          {totals.soon > 0 && (
            <span>
              <b>{formatNumber(totals.soon)}</b> em breve
            </span>
          )}
        </p>
      </div>

      <div className="ap-ach-tools">
        <label className="ap-ach-search">
          <span>Buscar conquista</span>
          <input
            type="search"
            value={filter.query}
            placeholder="Nome ou descrição"
            onChange={(e) => set({ query: e.target.value })}
            autoComplete="off"
          />
        </label>
        <div className="ap-ach-status" role="group" aria-label="Mostrar">
          {STATUS.map((s) => (
            <button key={s.id} type="button" className="ap-fchip" aria-pressed={filter.status === s.id} onClick={() => set({ status: s.id })}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="ap-ach-chips" role="group" aria-label="Família">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ap-fchip"
              aria-pressed={filter.group === c.id}
              onClick={() => set({ group: c.id as AchievementGroup | 'all' })}
            >
              {c.name}
              <small>
                {c.earned}/{c.total}
              </small>
            </button>
          ))}
        </div>
      </div>

      <p className="ap-sub" role="status" aria-live="polite">
        {shown === 0 ? 'Nenhuma conquista com esse filtro.' : `${shown} ${shown === 1 ? 'conquista' : 'conquistas'} na lista.`}
      </p>

      {groups.map((g) => (
        <section key={g.id} aria-label={g.name}>
          <h3 className="ap-ach-group">
            {g.name}
            <small>
              {g.rows.filter((r) => r.earned).length}/{g.rows.length}
            </small>
          </h3>
          <ul className="ap-ach-list">
            {g.rows.map((r) => (
              <Card key={r.id} row={r} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
