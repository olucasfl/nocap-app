import { useState } from 'react';
import { LoadFailed } from './LoadFailed';
import { Loader } from './Loader';
import { useQuery } from '@tanstack/react-query';
import { modeLabel } from '@/lib/history';
import {
  fetchStats,
  knownModes,
  countUnit,
  modeMax,
  streakLabel,
  type GameId,
  type ModeStats,
  type Stats,
} from '@/lib/stats';
import { GAME_LABEL, GameArt } from './GameArt';
import './records.css';

const GAMES: GameId[] = ['color', 'time', 'eco'];

const fmt = (game: GameId, mode: string, tenths: number) =>
  countUnit(game, mode) ? String(Math.round(tenths / 10)) : (tenths / 10).toFixed(1);

/** Um modo: só o recorde à vista; tocar abre média e partidas. */
function ModeTile({ game, mode, stat }: { game: GameId; mode: string; stat?: ModeStats }) {
  const [open, setOpen] = useState(false);
  const unit = countUnit(game, mode);
  const played = !!stat && stat.matches > 0;
  return (
    <li className={`rc-tile${played ? '' : ' empty'}${open ? ' open' : ''}`}>
      <button
        type="button"
        className="rc-tile-btn"
        aria-expanded={open}
        disabled={!played}
        data-sfx="select"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="mono rc-tile-name">{modeLabel(mode).toUpperCase()}</span>
        <span className="rc-tile-best">
          {played ? fmt(game, mode, stat!.best) : '-'}
          {played && (
            <small className="mono">{unit ? ` ${unit}` : `/${modeMax(game, mode)}`}</small>
          )}
        </span>
        {!played && <span className="mono rc-tile-hint">SEM PARTIDAS</span>}
      </button>
      {open && played && (
        <dl className="mono rc-tile-more">
          <div>
            <dt>MÉDIA</dt>
            <dd>{fmt(game, mode, stat!.average)}</dd>
          </div>
          <div>
            <dt>PARTIDAS</dt>
            <dd>{stat!.matches}</dd>
          </div>
        </dl>
      )}
    </li>
  );
}

/** Um jogo de cada vez: a pessoa escolhe em cima e vê só os modos dele. */
function RecordsView({ stats }: { stats: Stats }) {
  const matchesOf = (g: GameId) =>
    stats.modes.filter((m) => m.game === g).reduce((n, m) => n + m.matches, 0);
  const [game, setGame] = useState<GameId>(() => GAMES.find((g) => matchesOf(g) > 0) ?? 'color');
  const daily = stats.daily[game];
  const total = matchesOf(game);

  return (
    <div className="rc">
      <div className="rc-games" role="tablist" aria-label="Jogo">
        {GAMES.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            id={`rc-tab-${g}`}
            aria-selected={game === g}
            aria-controls="rc-panel"
            className={`rc-game ${g}${game === g ? ' on' : ''}`}
            data-sfx="select"
            onClick={() => setGame(g)}
          >
            <GameArt game={g} size="sm" />
            <span>{GAME_LABEL[g]}</span>
          </button>
        ))}
      </div>

      <section
        id="rc-panel"
        role="tabpanel"
        aria-labelledby={`rc-tab-${game}`}
        className={`rc-panel ${game}`}
      >
        <div className="mono rc-total">
          {total} {total === 1 ? 'PARTIDA' : 'PARTIDAS'} EM {GAME_LABEL[game].toUpperCase()}
        </div>
        <ul className="rc-grid">
          {knownModes(game).map((mode) => (
            <ModeTile
              key={`${game}-${mode}`}
              game={game}
              mode={mode}
              stat={stats.modes.find((m) => m.game === game && m.mode === mode)}
            />
          ))}
          <li className="rc-tile daily">
            <div className="rc-tile-btn static">
              <span className="mono rc-tile-name">DAILY</span>
              <span className="rc-daily-line">
                <b>{streakLabel(daily.current)}</b> seguidos
              </span>
              <span className="mono rc-tile-hint">
                MELHOR SEQUÊNCIA {streakLabel(daily.best).toUpperCase()}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}

/** Aba de recordes: escolha o jogo e veja o recorde de cada modo; toque num modo para ver os detalhes. */
export function Records({ stats }: { stats?: Stats }) {
  if (stats) return <RecordsView stats={stats} />;
  return <MyRecords />;
}

function MyRecords() {
  const q = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  if (q.isPending && q.fetchStatus !== 'paused')
    return <Loader inline label="Carregando recordes" />;
  if (!q.data) return <LoadFailed what="seus recordes" onRetry={() => void q.refetch()} />;
  return <RecordsView stats={q.data} />;
}
