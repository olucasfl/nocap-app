import { LoadFailed } from './LoadFailed';
import { Loader } from './Loader';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  PERIODS,
  boardMax,
  boardsOf,
  fetchRanking,
  type Board,
  type Game,
  type Period,
  type RankingEntry,
} from '@/lib/ranking';
import { dailyMax, streakLabel } from '@/lib/stats';
import './ranking-panel.css';

function Score({
  entry,
  max,
  showDays,
  rounds = false,
}: {
  entry: RankingEntry;
  max: number;
  showDays: boolean;
  /** Sobrevivência: a nota é o número de rodadas jogadas. */
  rounds?: boolean;
}) {
  return (
    <>
      {rounds ? Math.round(entry.score / 10) : (entry.score / 10).toFixed(1)}
      {rounds && <small className="mono">rodadas</small>}
      {max > 0 && <small className="mono">/{max}</small>}
      {showDays && entry.days !== undefined && (
        <small className="mono rp-days">{streakLabel(entry.days).toUpperCase()}</small>
      )}
    </>
  );
}

function Podium({
  top,
  max,
  showDays,
  rounds,
}: {
  top: RankingEntry[];
  max: number;
  showDays: boolean;
  rounds: boolean;
}) {
  // Ordem visual: 2º, 1º, 3º (o campeão no meio e mais alto).
  const order = [top[1], top[0], top[2]];
  return (
    <ol className="rp-podium" aria-label="Pódio">
      {order.map((e, i) =>
        e ? (
          <li key={e.username} className={`rp-pod p${e.rank}${e.isMe ? ' me' : ''}`}>
            <span className="rp-pod-name">@{e.username}</span>
            <span className="rp-pod-score">
              <Score entry={e} max={max} showDays={showDays} rounds={rounds} />
            </span>
            <span className="rp-pod-step">
              <b>{e.rank}</b>
            </span>
          </li>
        ) : (
          <li key={`empty-${i}`} className="rp-pod empty" aria-hidden="true" />
        ),
      )}
    </ol>
  );
}

/**
 * Ranking de UM jogo, com três filtros de aparência diferente: modo (abas, com o Daily à
 * parte), período (controle emendado) e quem aparece (chave liga/desliga). Pódio + lista.
 */
export function RankingPanel({
  game,
  initialBoard = 'classic',
}: {
  game: Game;
  initialBoard?: Board;
}) {
  const user = useAuth((s) => s.user);
  const [board, setBoard] = useState<Board>(initialBoard);
  const [period, setPeriod] = useState<Period>(initialBoard === 'daily' ? 'day' : 'week');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const scope = friendsOnly ? 'friends' : 'all';
  const isDaily = board === 'daily';

  const query = useQuery({
    queryKey: ['ranking', game, board, period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, board, period, scope),
  });

  const entries = query.data?.entries ?? [];
  const rest = entries.slice(3);
  // Daily de hoje: uma nota só. Somado (semana/sempre): depende dos dias, sem máximo.
  const dailySum = isDaily && period !== 'day';
  const max = isDaily ? (period === 'day' ? dailyMax(game) : 0) : boardMax(game, board);
  const meOutside = query.data?.me && !entries.some((e) => e.isMe) ? query.data.me : null;

  const switchBoard = (b: Board) => {
    setBoard(b);
    // O Daily abre no dia de hoje; ao sair dele, volta para a semana.
    if (b === 'daily') setPeriod('day');
    else if (isDaily) setPeriod('week');
  };

  return (
    <div className={`rp ${game}`}>
      <div className="rp-filter">
        <div className="mono rp-label">MODO</div>
        <div className="rp-modes" role="tablist" aria-label="Modo do ranking">
          {boardsOf(game).map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={board === b.id}
              onClick={() => switchBoard(b.id)}
            >
              {b.label}
            </button>
          ))}
          <span className="rp-divider" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            className="rp-daily-tab"
            aria-selected={isDaily}
            onClick={() => switchBoard('daily')}
          >
            Daily
          </button>
        </div>
      </div>

      <div className="rp-row2">
        <div className="rp-filter rp-period">
          <div className="mono rp-label">PERÍODO</div>
          <div className="rp-seg" role="radiogroup" aria-label="Período">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={period === p.id}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {user && (
          <div className="rp-filter">
            <div className="mono rp-label">SÓ AMIGOS</div>
            <button
              type="button"
              role="switch"
              aria-checked={friendsOnly}
              aria-label="Mostrar só amigos"
              className="rp-switch"
              onClick={() => setFriendsOnly((v) => !v)}
            >
              <i />
            </button>
          </div>
        )}
      </div>

      <p className="mono rp-note">
        {isDaily
          ? dailySum
            ? 'SOMA DOS DAILYS DO PERÍODO (UM POR DIA)'
            : 'NOTA DO DAILY DE HOJE'
          : period === 'day'
            ? 'MELHOR PARTIDA DE HOJE'
            : period === 'week'
              ? 'MELHOR PARTIDA DA SEMANA'
              : 'MELHOR PARTIDA DE TODAS'}
      </p>

      {query.isPending && query.fetchStatus !== 'paused' && <Loader inline />}
      {(query.isError || (query.isPending && query.fetchStatus === 'paused')) && (
        <LoadFailed
          what="o ranking"
          onRetry={() => void query.refetch()}
          offlineText="O ranking só carrega online. Você ainda pode jogar nos Modos de partida."
        />
      )}
      {query.isSuccess && entries.length === 0 && (
        <p className="lead">
          {friendsOnly
            ? 'Nem você nem seus amigos jogaram esse modo neste período.'
            : 'Ninguém jogou esse modo neste período. Seja a primeira pessoa.'}
        </p>
      )}
      {entries.length > 0 && (
        <Podium
          top={entries.slice(0, 3)}
          max={max}
          showDays={dailySum}
          rounds={board === 'survival'}
        />
      )}
      {rest.length > 0 && (
        <ol className="rp-list" start={4}>
          {rest.map((e) => (
            <li key={e.username} className={`rp-item${e.isMe ? ' me' : ''}`}>
              <span className="mono rp-pos">{e.rank}</span>
              <span className="rp-name">@{e.username}</span>
              <span className="rp-score">
                <Score entry={e} max={max} showDays={dailySum} rounds={board === 'survival'} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {meOutside && (
        <section aria-label="Sua posição">
          <p className="mono rp-note">SUA POSIÇÃO</p>
          <ol className="rp-list">
            <li className="rp-item me">
              <span className="mono rp-pos">{meOutside.rank}</span>
              <span className="rp-name">@{meOutside.username}</span>
              <span className="rp-score">
                <Score
                  entry={meOutside}
                  max={max}
                  showDays={dailySum}
                  rounds={board === 'survival'}
                />
              </span>
            </li>
          </ol>
        </section>
      )}
      {query.isSuccess && !user && (
        <p className="lead">
          O ranking é só de quem tem conta.{' '}
          <Link to="/criar-conta" className="rp-link">
            Crie a sua
          </Link>{' '}
          para aparecer aqui.
        </p>
      )}
    </div>
  );
}
