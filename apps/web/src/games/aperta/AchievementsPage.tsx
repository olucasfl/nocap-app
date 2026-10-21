import { formatNumber, type SaveState } from '@nocap/games';
import { AstroMedal } from './AstroMedal';
import { achievementGroups, achievementCounts, type AchievementRow } from './achievements-logic';
import './achievements.css';

function Card({ row }: { row: AchievementRow }) {
  const label = row.secret
    ? 'Conquista escondida'
    : `${row.name}: ${row.earned ? 'ganha' : `${formatNumber(row.value)} de ${formatNumber(row.goal)}`}`;
  return (
    <li className={`ap-ach${row.earned ? ' is-earned' : ''}${row.secret ? ' is-secret' : ''}`} aria-label={label}>
      <span className="ap-ach-medal">
        <AstroMedal astro={row.astro} />
      </span>
      <div className="ap-ach-body">
        <h4>{row.name}</h4>
        <p className="ap-ach-text">{row.text}</p>
        {!row.secret && (
          <>
            <span className="ap-ach-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${row.fraction})` }} />
            </span>
            <p className="ap-ach-count">
              {row.earned ? 'Ganha' : `${formatNumber(row.value)}/${formatNumber(row.goal)}`}
            </p>
          </>
        )}
      </div>
    </li>
  );
}

/** Corpo da página de Conquistas (spec 038, 3.5 e 5.3): ícone, nome, descrição, barra e "N/M", por grupo. */
export function AchievementsPage({ state }: { state: SaveState }) {
  const counts = achievementCounts(state);
  return (
    <div className="ap-achpage">
      <p className="ap-ach-total">
        <b>{counts.earned}</b> de {counts.total} conquistas
      </p>
      {achievementGroups(state).map((g) => (
        <section key={g.id} aria-label={g.name}>
          <h3 className="ap-ach-group">{g.name}</h3>
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
