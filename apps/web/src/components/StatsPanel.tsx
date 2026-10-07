import { useQuery } from '@tanstack/react-query';
import { modeLabel } from '@/lib/history';
import { fetchStats, gameModes, MODE_MAX, streakLabel, type Stats } from '@/lib/stats';
import './stats-panel.css';

const GAMES = [
  { id: 'color', label: 'COR' },
  { id: 'time', label: 'TEMPO' },
] as const;

function Records({ stats, game, label }: { stats: Stats; game: string; label: string }) {
  const modes = gameModes(stats, game);
  return (
    <>
      <h2 className="mono stats-label">RECORDES · {label}</h2>
      {modes.length === 0 ? (
        <p className="lead">Jogue uma partida para ver seus recordes.</p>
      ) : (
        <ul className="stats-list">
          {modes.map((m) => (
            <li key={m.mode} className="stats-row">
              <span className="stats-mode">{modeLabel(m.mode)}</span>
              <span className="mono stats-sub">
                {m.matches} {m.matches === 1 ? 'PARTIDA' : 'PARTIDAS'} · MÉDIA{' '}
                {(m.average / 10).toFixed(1)}
              </span>
              <span className="stats-best">
                {(m.best / 10).toFixed(1)}
                <small className="mono">/{MODE_MAX[m.mode]}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Recordes por jogo e modo e sequência do Daily (conta: todos os aparelhos; convidado: este). */
export function StatsPanel() {
  const q = useQuery({ queryKey: ['stats'], queryFn: fetchStats });

  if (q.isPending) return <p className="lead">Carregando recordes...</p>;
  if (q.isError) return <p className="lead">Não deu para carregar os recordes agora.</p>;

  const { daily } = q.data;

  return (
    <section className="stats" aria-label="Recordes">
      <div className="stats-streak">
        <div className="mono stats-label">SEQUÊNCIA DO DAILY</div>
        <div className="stats-streak-row">
          <b>{streakLabel(daily.current)}</b>
          <span className="mono">MELHOR {streakLabel(daily.best)}</span>
        </div>
      </div>
      {GAMES.map((g) => (
        <Records key={g.id} stats={q.data} game={g.id} label={g.label} />
      ))}
    </section>
  );
}
