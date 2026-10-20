import { useState } from 'react';
import { LoadFailed } from './LoadFailed';
import { Loader } from './Loader';
import { useQuery } from '@tanstack/react-query';
import { modeLabel } from '@/lib/labels';
import {
  fetchStats,
  formatAttempts,
  gameModes,
  knownModes,
  countUnit,
  modeMax,
  streakLabel,
  type GameId,
  type ModeStats,
  type Stats,
} from '@/lib/stats';
import { GAME_LABEL, GameArt } from './GameArt';
import { WordsRows, type WordsSummary } from './WordsProgress';
import './records.css';

const GAMES: GameId[] = ['color', 'time', 'eco', 'blocks', 'atravessa'];

/** O Word's não tem recordes por modo: o bloco mostra a fase de cada jogo. */
type Tab = GameId | 'words';
const TABS: Tab[] = ['words', ...GAMES];

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
function RecordsView({ stats, words }: { stats: Stats; words?: WordsSummary | null }) {
  const matchesOf = (g: GameId) => gameModes(stats, g).reduce((n, m) => n + m.matches, 0);
  const [tab, setTab] = useState<Tab>(() => GAMES.find((g) => matchesOf(g) > 0) ?? 'color');
  const game: GameId = tab === 'words' ? 'wclassic' : tab;
  const daily = stats.daily[game];
  const total = matchesOf(game);

  return (
    <div className="rc">
      <div className="rc-games six" role="tablist" aria-label="Jogo">
        {TABS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            id={`rc-tab-${g}`}
            aria-selected={tab === g}
            aria-controls="rc-panel"
            className={`rc-game ${g}${tab === g ? ' on' : ''}`}
            data-sfx="select"
            onClick={() => setTab(g)}
          >
            <GameArt game={g === 'words' ? 'wclassic' : g} size="sm" />
            <span>{g === 'words' ? "Word's" : GAME_LABEL[g]}</span>
          </button>
        ))}
      </div>

      <section
        id="rc-panel"
        role="tabpanel"
        aria-labelledby={`rc-tab-${tab}`}
        className={`rc-panel ${tab}`}
      >
        <header className="rc-head">
          <span className="rc-head-ico" aria-hidden="true">
            <GameArt game={game} size="sm" />
          </span>
          <div>
            <b>{tab === 'words' ? "Word's" : GAME_LABEL[game]}</b>
            <span className="mono">
              {tab === 'words' ? 'Em que fase você está em cada jogo' : total > 0 ? `${total} ${total === 1 ? 'partida jogada' : 'partidas jogadas'}` : 'Nenhuma partida ainda'}
            </span>
          </div>
        </header>
        {tab === 'words' ? (
          <WordsRows summary={words} />
        ) : (
          <>
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
              {game === 'wclassic' && daily.playedToday && (
                <span className="mono rc-tile-hint">HOJE: {formatAttempts(daily.totalScore ?? 0).toUpperCase()}</span>
              )}
            </div>
          </li>
        </ul>
        {total === 0 && <p className="mono rc-empty">Jogue uma partida para criar o seu primeiro recorde.</p>}
          </>
        )}
      </section>
    </div>
  );
}

/** Aba de recordes: escolha o jogo e veja o recorde de cada modo; toque num modo para ver os detalhes. */
export function Records({ stats, words }: { stats?: Stats; words?: WordsSummary | null }) {
  if (stats) return <RecordsView stats={stats} words={words} />;
  return <MyRecords words={words} />;
}

function MyRecords({ words }: { words?: WordsSummary | null }) {
  const q = useQuery({ queryKey: ['stats'], queryFn: fetchStats });
  if (q.isPending && q.fetchStatus !== 'paused')
    return <Loader inline label="Carregando recordes" />;
  if (!q.data) return <LoadFailed what="seus recordes" onRetry={() => void q.refetch()} />;
  return <RecordsView stats={q.data} words={words} />;
}
