import { LoadFailed } from './LoadFailed';
import { Loader } from './Loader';
import { useQuery } from '@tanstack/react-query';
import { modeLabel } from '@/lib/history';
import { fetchStats, gameModes, modeMax, streakLabel, type GameId, type Stats } from '@/lib/stats';
import { GAME_LABEL, GameArt } from './GameArt';
import './records.css';

const GAMES: GameId[] = ['color', 'time'];

function GameRecords({ stats, game }: { stats: Stats; game: GameId }) {
  const modes = gameModes(stats, game);
  const matches = modes.reduce((n, m) => n + m.matches, 0);
  const daily = stats.daily[game];
  return (
    <section className={`rc-card ${game}`} aria-label={`Recordes de ${GAME_LABEL[game]}`}>
      <header className="rc-head">
        <GameArt game={game} />
        <div>
          <h3 className="rc-name">{GAME_LABEL[game]}</h3>
          <div className="mono rc-sub">
            {matches} {matches === 1 ? 'PARTIDA' : 'PARTIDAS'}
          </div>
        </div>
      </header>
      {modes.length === 0 ? (
        <p className="rc-empty">Jogue uma partida de {GAME_LABEL[game]} para ver seus recordes.</p>
      ) : (
        <ul className="rc-modes">
          {modes.map((m) => (
            <li key={m.mode} className="rc-mode">
              <span className="rc-mode-name">{modeLabel(m.mode)}</span>
              <span className="mono rc-mode-sub">
                {m.matches} {m.matches === 1 ? 'PARTIDA' : 'PARTIDAS'} · MÉDIA{' '}
                {(m.average / 10).toFixed(1)}
              </span>
              <span className="rc-best">
                {(m.best / 10).toFixed(1)}
                <small className="mono">/{modeMax(game, m.mode)}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="rc-daily">
        <span className="mono">DAILY</span>
        <span className="mono">
          SEQUÊNCIA {streakLabel(daily.current).toUpperCase()} · MELHOR{' '}
          {streakLabel(daily.best).toUpperCase()}
        </span>
      </div>
    </section>
  );
}

/** Aba de recordes: um cartão por jogo, com a arte do jogo, os modos e o Daily dele. */
export function Records({ stats }: { stats?: Stats }) {
  if (stats) return <RecordsView stats={stats} />;
  return <MyRecords />;
}

function RecordsView({ stats }: { stats: Stats }) {
  return (
    <div className="rc">
      {GAMES.map((g) => (
        <GameRecords key={g} stats={stats} game={g} />
      ))}
    </div>
  );
}

function MyRecords() {
  const q = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  if (q.isPending && q.fetchStatus !== 'paused')
    return <Loader inline label="Carregando recordes" />;
  if (!q.data) return <LoadFailed what="seus recordes" onRetry={() => void q.refetch()} />;
  return (
    <div className="rc">
      {GAMES.map((g) => (
        <GameRecords key={g} stats={q.data} game={g} />
      ))}
    </div>
  );
}
