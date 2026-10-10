import { useMemo } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { GAME_LABEL, GameArt } from '@/components/GameArt';
import { Crown } from '@/components/icons';
import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { Score } from '@/components/RankingPanel';
import { useAuth } from '@/lib/auth';
import {
  GAMES,
  PERIODS,
  boardChoices,
  boardMax,
  defaultPeriod,
  fetchRanking,
  neighborsOf,
  type Board,
  type Game,
  type Period,
  type RankingEntry,
  type RankingsSearch,
  type Scope,
} from '@/lib/ranking';
import { countUnit, dailyMax, streakLabel } from '@/lib/stats';
import './rankings.css';

const route = getRouteApi('/tabs/ranking');

/** Para onde levar quem ainda não jogou o modo. */
const GAME_PATH = { color: '/cor', time: '/tempo', eco: '/eco' } as const;

/** Diferença de nota para mostrar: pontos com uma casa, ou número inteiro nos jogos de contagem. */
const gapText = (tenths: number, counts: boolean) =>
  counts ? String(Math.max(1, Math.round(tenths / 10))) : (tenths / 10).toFixed(1);

type ScoreProps = { max: number; showDays: boolean; unit: 'rodadas' | 'passos' | null };

/** Pódio colorido com a cor do jogo: o campeão no meio, mais alto e com coroa. */
function Podium({ top, ...score }: { top: RankingEntry[] } & ScoreProps) {
  const order = [top[1], top[0], top[2]];
  return (
    <ol className="rks-podium" aria-label="Pódio">
      {order.map((e, i) =>
        e ? (
          <li key={e.username} className={`rks-pod p${e.rank}${e.isMe ? ' me' : ''}`}>
            {e.rank === 1 && <Crown size={26} aria-hidden="true" />}
            <span className="rks-pod-avatar" aria-hidden="true">
              {e.username.charAt(0).toUpperCase()}
            </span>
            <span className="rks-pod-name">@{e.username}</span>
            {e.isMe && <span className="mono rks-you">VOCÊ</span>}
            <span className="rks-pod-score">
              <Score entry={e} {...score} />
            </span>
            <span className="rks-pod-step">
              <b>{e.rank}º</b>
            </span>
          </li>
        ) : (
          <li key={`empty-${i}`} className="rks-pod empty" aria-hidden="true" />
        ),
      )}
    </ol>
  );
}

/** Do 4º em diante: posição, nome, nota e uma barra que mostra o quanto da nota máxima. */
function Rows({ rows, max, ...score }: { rows: RankingEntry[] } & ScoreProps) {
  return (
    <ol className="rks-list" start={4}>
      {rows.map((e) => {
        const pct = max > 0 ? Math.min(100, Math.round((e.score / 10 / max) * 100)) : 0;
        return (
          <li key={e.username} className={`rks-item${e.isMe ? ' me' : ''}`}>
            <span className="rks-pos">{e.rank}</span>
            <span className="rks-avatar" aria-hidden="true">
              {e.username.charAt(0).toUpperCase()}
            </span>
            <span className="rks-who">
              <span className="rks-name">
                @{e.username}
                {e.isMe && <span className="mono rks-you">VOCÊ</span>}
              </span>
              {pct > 0 && (
                <span className="rks-bar" aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </span>
              )}
            </span>
            <span className="rks-score">
              <Score entry={e} max={max} {...score} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A página de Rankings: todos os jogos num lugar só. A cor da página é a do jogo escolhido; o
 * modo, o período e "só amigos" são controles de formatos diferentes (chips, faixa e chave) para
 * não se confundirem entre si nem com o Daily. Sua posição fica logo acima do pódio. Os filtros
 * ficam na URL, então "Ver ranking" no fim da partida abre aqui já no jogo e modo certos.
 */
export function Rankings() {
  const search = route.useSearch();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const game: Game = search.jogo ?? 'color';
  const board: Board = search.modo ?? 'classic';
  const period: Period = search.periodo ?? defaultPeriod(board);
  const scope: Scope = user && search.quem === 'friends' ? 'friends' : 'all';
  const isDaily = board === 'daily';
  const counts = !!countUnit(game, board);

  const go = (patch: Partial<RankingsSearch>) =>
    void navigate({ to: '/ranking', search: { ...search, ...patch }, replace: true });

  const pickGame = (g: Game) => go({ jogo: g, modo: undefined, periodo: undefined });
  const pickBoard = (b: Board) =>
    go({ modo: b, periodo: period === defaultPeriod(board) ? undefined : period });

  const query = useQuery({
    queryKey: ['ranking', game, board, period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, board, period, scope),
  });

  const entries = query.data?.entries ?? [];
  const rest = entries.slice(3);
  const dailySum = isDaily && period !== 'day';
  const max = isDaily ? (period === 'day' ? dailyMax(game) : 0) : boardMax(game, board);
  const unit = countUnit(game, board);
  const me = query.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const meInList = entries.some((e) => e.isMe);
  const near = useMemo(() => neighborsOf(entries), [entries]);
  const score: ScoreProps = { max, showDays: dailySum, unit };

  const note = isDaily
    ? dailySum
      ? 'Soma dos Dailys do período (um por dia)'
      : 'Nota do Daily de hoje'
    : period === 'day'
      ? 'Melhor partida de hoje'
      : period === 'week'
        ? 'Melhor partida da semana'
        : 'Melhor partida de todas';

  const meLine =
    me?.rank === 1
      ? 'Você está em primeiro. Segure a coroa!'
      : meInList && near.above
        ? `Faltam ${gapText(near.above.gap, counts)} para passar @${near.above.username}`
        : `${query.data?.total ?? 0} ${query.data?.total === 1 ? 'pessoa' : 'pessoas'} no ranking`;

  return (
    <main className={`rks ${game}`}>
      <div className="rks-head">
        <h1>Ranking</h1>
        <p className="mono rks-lead">Compare suas notas com todo mundo ou só com os amigos.</p>
      </div>

      <div className="rks-games" role="tablist" aria-label="Jogo">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            data-sfx="select"
            className={`rks-game ${g.id}`}
            aria-selected={game === g.id}
            onClick={() => pickGame(g.id)}
          >
            <GameArt game={g.id} size="sm" />
            <span>{GAME_LABEL[g.id]}</span>
          </button>
        ))}
      </div>

      <section className="rks-panel" aria-label="Filtros do ranking">
        <div className="rks-field">
          <span className="mono rks-label">MODO</span>
          <div className="rks-modes" role="tablist" aria-label="Modo">
            {boardChoices(game).map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                data-sfx="select"
                className={b.id === 'daily' ? 'daily' : ''}
                aria-selected={board === b.id}
                onClick={() => pickBoard(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rks-filters">
          <div className="rks-field">
            <span className="mono rks-label">PERÍODO</span>
            <div className="rks-seg" role="radiogroup" aria-label="Período">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  data-sfx="select"
                  aria-checked={period === p.id}
                  onClick={() => go({ periodo: p.id === defaultPeriod(board) ? undefined : p.id })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {user && (
            <div className="rks-field rks-friends">
              <span className="mono rks-label">SÓ AMIGOS</span>
              <button
                type="button"
                role="switch"
                data-sfx="toggle"
                className="rks-switch"
                aria-checked={scope === 'friends'}
                aria-label="Mostrar só os meus amigos"
                onClick={() => go({ quem: scope === 'friends' ? undefined : 'friends' })}
              >
                <i />
              </button>
            </div>
          )}
        </div>
        <p className="mono rks-note">{note}</p>
      </section>

      {query.isPending && query.fetchStatus !== 'paused' && <Loader inline />}
      {(query.isError || (query.isPending && query.fetchStatus === 'paused')) && (
        <LoadFailed
          what="o ranking"
          onRetry={() => void query.refetch()}
          offlineText="O ranking só carrega online. Você ainda pode jogar nos Modos de partida."
        />
      )}

      {user && query.isSuccess && me && (
        <section className={`rks-me${me.rank === 1 ? ' first' : ''}`} aria-label="Sua posição">
          <span className="rks-me-pos">{me.rank}º</span>
          <span className="rks-me-body">
            <b>
              Você · <Score entry={me} {...score} />
            </b>
            <span className="mono">
              {dailySum && me.days !== undefined && `${streakLabel(me.days).toUpperCase()} · `}
              {meLine}
            </span>
          </span>
        </section>
      )}
      {user && query.isSuccess && !me && entries.length > 0 && (
        <section className="rks-me out" aria-label="Sua posição">
          <span className="rks-me-body">
            <b>Você ainda não está aqui</b>
            <span className="mono">Jogue este modo neste período para entrar no ranking.</span>
          </span>
          <Link to={GAME_PATH[game]} className="rks-play" data-sfx="start">
            Jogar
          </Link>
        </section>
      )}

      {query.isSuccess && entries.length === 0 && (
        <p className="lead rks-empty">
          {scope === 'friends'
            ? 'Nem você nem seus amigos jogaram esse modo neste período.'
            : 'Ninguém jogou esse modo neste período. Seja a primeira pessoa.'}
        </p>
      )}
      {entries.length > 0 && <Podium top={entries.slice(0, 3)} {...score} />}
      {rest.length > 0 && <Rows rows={rest} {...score} />}

      {query.isSuccess && !user && (
        <p className="lead">
          O ranking é só de quem tem conta.{' '}
          <Link to="/criar-conta" className="rp-link">
            Crie a sua
          </Link>{' '}
          para aparecer aqui.
        </p>
      )}
    </main>
  );
}
