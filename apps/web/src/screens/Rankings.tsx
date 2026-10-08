import { useMemo } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { GAME_LABEL, GameArt } from '@/components/GameArt';
import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { Podium, Score } from '@/components/RankingPanel';
import { useAuth } from '@/lib/auth';
import {
  GAMES,
  PERIODS,
  SCOPES,
  boardChoices,
  boardMax,
  defaultPeriod,
  fetchRanking,
  neighborsOf,
  type Board,
  type Game,
  type Period,
  type RankingsSearch,
  type Scope,
} from '@/lib/ranking';
import { countUnit, dailyMax, streakLabel } from '@/lib/stats';
import './rankings.css';

const route = getRouteApi('/tabs/ranking');

/** Diferença de nota para mostrar: pontos com uma casa, ou número inteiro nos jogos de contagem. */
const gapText = (tenths: number, counts: boolean) =>
  counts ? String(Math.max(1, Math.round(tenths / 10))) : (tenths / 10).toFixed(1);

/**
 * A página de Rankings: todos os jogos num lugar só. Escolhe-se o jogo, o modo (o Daily é um modo
 * como os outros), o período e se só os amigos aparecem. Os filtros ficam na URL, então o botão
 * "Ver ranking" do fim da partida abre aqui já no jogo e no modo certos.
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

  const note = isDaily
    ? dailySum
      ? 'SOMA DOS DAILYS DO PERÍODO (UM POR DIA)'
      : 'NOTA DO DAILY DE HOJE'
    : period === 'day'
      ? 'MELHOR PARTIDA DE HOJE'
      : period === 'week'
        ? 'MELHOR PARTIDA DA SEMANA'
        : 'MELHOR PARTIDA DE TODAS';

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

      <div className="rks-filters">
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
        {user && (
          <div className="rks-seg" role="radiogroup" aria-label="Quem aparece">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                data-sfx="select"
                aria-checked={scope === s.id}
                onClick={() => go({ quem: s.id === 'friends' ? 'friends' : undefined })}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mono rks-note">{note}</p>

      {query.isPending && query.fetchStatus !== 'paused' && <Loader inline />}
      {(query.isError || (query.isPending && query.fetchStatus === 'paused')) && (
        <LoadFailed
          what="o ranking"
          onRetry={() => void query.refetch()}
          offlineText="O ranking só carrega online. Você ainda pode jogar nos Modos de partida."
        />
      )}
      {query.isSuccess && entries.length === 0 && (
        <p className="lead rks-empty">
          {scope === 'friends'
            ? 'Nem você nem seus amigos jogaram esse modo neste período.'
            : 'Ninguém jogou esse modo neste período. Seja a primeira pessoa.'}
        </p>
      )}
      {entries.length > 0 && (
        <Podium top={entries.slice(0, 3)} max={max} showDays={dailySum} unit={unit} />
      )}
      {rest.length > 0 && (
        <ol className="rp-list" start={4}>
          {rest.map((e) => (
            <li key={e.username} className={`rp-item${e.isMe ? ' me' : ''}`}>
              <span className="mono rp-pos">{e.rank}</span>
              <span className="rp-name">@{e.username}</span>
              <span className="rp-score">
                <Score entry={e} max={max} showDays={dailySum} unit={unit} />
              </span>
            </li>
          ))}
        </ol>
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

      {user && query.isSuccess && me && (
        <section className="rks-me" aria-label="Sua posição">
          <span className="rks-me-pos">{me.rank}º</span>
          <span className="rks-me-body">
            <b>
              Você · <Score entry={me} max={max} showDays={dailySum} unit={unit} />
            </b>
            <span className="mono">
              {dailySum && me.days !== undefined && `${streakLabel(me.days).toUpperCase()} · `}
              {me.rank === 1
                ? 'VOCÊ ESTÁ EM PRIMEIRO'
                : meInList && near.above
                  ? `FALTAM ${gapText(near.above.gap, counts)} PARA PASSAR @${near.above.username}`
                  : `${query.data!.total} ${query.data!.total === 1 ? 'PESSOA' : 'PESSOAS'} NO RANKING`}
            </span>
          </span>
        </section>
      )}
      {user && query.isSuccess && !me && entries.length > 0 && (
        <p className="mono rks-note">VOCÊ AINDA NÃO JOGOU ESTE MODO NESTE PERÍODO</p>
      )}
    </main>
  );
}
