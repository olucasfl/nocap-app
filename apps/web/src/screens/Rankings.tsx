import { useMemo } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { GAME_LABEL, GameArt } from '@/components/GameArt';
import { Crown, Trophy } from '@/components/icons';
import { LoadFailed } from '@/components/LoadFailed';
import { Score } from '@/components/RankingPanel';
import { useAuth } from '@/lib/auth';
import {
  GAMES,
  PERIODS,
  boardChoices,
  boardMax,
  defaultPeriod,
  fetchRanking,
  fewerIsBetter,
  neighborsOf,
  type Board,
  type Game,
  type Period,
  type RankingEntry,
  type RankingsSearch,
  type Scope,
} from '@/lib/ranking';
import { countUnit, dailyMax, streakLabel, type CountUnit } from '@/lib/stats';
import './rankings.css';

const route = getRouteApi('/tabs/ranking');

/** Para onde levar quem ainda não jogou o modo. */
const GAME_PATH = {
  color: '/cor',
  time: '/tempo',
  eco: '/eco',
  blocks: '/blocks',
  atravessa: '/atravessa',
  wclassic: '/words/classic',
} as const;

/** Diferença de nota para mostrar: pontos com uma casa, ou número inteiro nos jogos de contagem. */
const gapText = (tenths: number, counts: boolean) =>
  counts ? String(Math.max(1, Math.round(tenths / 10))) : (tenths / 10).toFixed(1);

/** Quanto falta para passar quem está acima (no Classic Word's é "menos tentativas"). */
const passText = (game: Game, gap: number, counts: boolean, username: string) =>
  fewerIsBetter(game)
    ? `Acerte com ${gap >= 10 ? Math.round(gap / 10) : '1'} ${gap > 10 ? 'tentativas' : 'tentativa'} a menos para passar @${username}`
    : `Faltam ${gapText(gap, counts)} para passar @${username}`;

type ScoreProps = { max: number; showDays: boolean; unit: CountUnit | null };

/** Pódio: o campeão no meio, mais alto e com coroa; cada degrau mostra a posição. */
function Podium({ top, ...score }: { top: RankingEntry[] } & ScoreProps) {
  const order = [top[1], top[0], top[2]];
  return (
    <ol className="rkp-podium" aria-label="Pódio">
      {order.map((e, i) =>
        e ? (
          <li key={e.username} className={`rkp-pod p${e.rank}${e.isMe ? ' me' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            {e.rank === 1 && <Crown size={28} aria-hidden="true" />}
            <span className="rkp-avatar" aria-hidden="true">
              {e.username.charAt(0).toUpperCase()}
            </span>
            <span className="rkp-pod-name">@{e.username}</span>
            {e.isMe && <span className="rkp-you mono">VOCÊ</span>}
            <span className="rkp-pod-score">
              <Score entry={e} {...score} />
            </span>
            <span className="rkp-step">
              <b>{e.rank}º</b>
            </span>
          </li>
        ) : (
          <li key={`empty-${i}`} className="rkp-pod empty" aria-hidden="true" />
        ),
      )}
    </ol>
  );
}

/** Do 4º em diante: posição, nome e valor. */
function Rows({ rows, ...score }: { rows: RankingEntry[] } & ScoreProps) {
  return (
    <ol className="rkp-list" start={4}>
      {rows.map((e, i) => (
        <li key={e.username} className={`rkp-row${e.isMe ? ' me' : ''}`} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
          <span className="rkp-pos">{e.rank}</span>
          <span className="rkp-avatar sm" aria-hidden="true">
            {e.username.charAt(0).toUpperCase()}
          </span>
          <span className="rkp-who">
            @{e.username}
            {e.isMe && <span className="rkp-you mono">VOCÊ</span>}
          </span>
          <span className="rkp-score">
            <Score entry={e} {...score} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Quatro linhas apagadas enquanto o ranking chega (em vez de um carregando solto). */
function Skeleton() {
  return (
    <div className="rkp-skel" aria-hidden="true" data-testid="ranking-loading">
      <div className="rkp-skel-pod" />
      {Array.from({ length: 4 }, (_, i) => (
        <i key={i} style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** A primeira tela: escolher de qual jogo é o ranking. */
function GamePicker({ onPick }: { onPick: (g: Game) => void }) {
  return (
    <main className="rkp picker">
      <header className="rkp-head">
        <h1>Ranking</h1>
        <p className="mono">Escolha um jogo para ver quem manda nele</p>
      </header>
      <div className="rkp-picks">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            data-sfx="select"
            data-testid={`pick-${g.id}`}
            className={`rkp-pick ${g.id}`}
            onClick={() => onPick(g.id)}
          >
            <span className="rkp-pick-art">
              <GameArt game={g.id} size="md" />
            </span>
            <span className="rkp-pick-name">{GAME_LABEL[g.id]}</span>
            <span className="rkp-pick-go mono">VER RANKING</span>
          </button>
        ))}
      </div>
    </main>
  );
}

/**
 * A página de Rankings. Três blocos, de cima para baixo: o jogo escolhido (um cabeçalho colorido com o botão de
 * trocar), os filtros (categoria, período e só amigos) e a classificação (pódio, lista e a sua posição fixa
 * embaixo). O padrão é sempre o período "Sempre". Os filtros ficam na URL, então "Ver ranking" no fim de uma
 * partida abre aqui já no jogo e na categoria certos.
 */
export function Rankings() {
  const search = route.useSearch();
  const navigate = useNavigate();
  if (!search.jogo) {
    return <GamePicker onPick={(g) => void navigate({ to: '/ranking', search: { ...search, jogo: g, modo: undefined, periodo: undefined } })} />;
  }
  return <RankingView game={search.jogo} />;
}

function RankingView({ game }: { game: Game }) {
  const search = route.useSearch();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const board: Board = search.modo ?? boardChoices(game)[0]!.id;
  const period: Period = search.periodo ?? defaultPeriod(board);
  const scope: Scope = user && search.quem === 'friends' ? 'friends' : 'all';
  const isDaily = board === 'daily';
  const choices = boardChoices(game);

  const go = (patch: Partial<RankingsSearch>) =>
    void navigate({ to: '/ranking', search: { ...search, ...patch }, replace: true });

  const changeGame = () =>
    void navigate({ to: '/ranking', search: { ...search, jogo: undefined, modo: undefined, periodo: undefined, quem: undefined } });

  const query = useQuery({
    queryKey: ['ranking', game, board, period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, board, period, scope),
  });

  const entries = query.data?.entries ?? [];
  const rest = entries.slice(3);
  const dailySum = isDaily && period !== 'day';
  const max = isDaily ? (period === 'day' ? dailyMax(game) : 0) : boardMax(game, board);
  const unit = countUnit(game, board);
  const counts = !!unit;
  const me = query.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const meInList = entries.some((e) => e.isMe);
  const near = useMemo(() => neighborsOf(entries, fewerIsBetter(game)), [entries, game]);
  const score: ScoreProps = { max, showDays: dailySum, unit };
  const boardLabel = choices.find((b) => b.id === board)?.label ?? 'Daily';

  const note = isDaily
    ? dailySum
      ? game === 'wclassic'
        ? 'Média de tentativas nos Dailys do período (menos é melhor)'
        : 'Soma dos Dailys do período (um por dia)'
      : game === 'wclassic'
        ? 'Tentativas no Daily de hoje (menos é melhor)'
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
        ? passText(game, near.above.gap, counts, near.above.username)
        : `${query.data?.total ?? 0} ${query.data?.total === 1 ? 'pessoa' : 'pessoas'} no ranking`;

  return (
    <main className={`rkp ${game}`}>
      <header className="rkp-head">
        <h1>Ranking</h1>
        <p className="mono">Quem joga melhor no NoCap</p>
      </header>

      {/* 1. O jogo */}
      <section className="rkp-hero" aria-label="Jogo do ranking">
        <div className="rkp-hero-art" aria-hidden="true">
          <GameArt game={game} size="md" />
        </div>
        <div className="rkp-hero-text">
          <span className="mono">RANKING DE</span>
          <b>{GAME_LABEL[game]}</b>
          <span className="rkp-chip mono">{boardLabel}</span>
        </div>
        <button type="button" className="rkp-switch" data-sfx="select" data-testid="change-game" onClick={changeGame}>
          <span aria-hidden="true">‹</span> Trocar de jogo
        </button>
      </section>

      {/* 2. Os filtros */}
      <section className="rkp-filters" aria-label="Filtros do ranking">
        {choices.length > 1 && (
          <div className="rkp-cats" role="tablist" aria-label="Categoria">
            {choices.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                data-sfx="select"
                className={b.id === 'daily' ? 'daily' : ''}
                aria-selected={board === b.id}
                onClick={() => go({ modo: b.id, periodo: undefined })}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
        <div className="rkp-row2">
          <div className="rkp-seg" role="radiogroup" aria-label="Período">
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
            <div className="rkp-seg who" role="radiogroup" aria-label="Quem aparece">
              <button type="button" role="radio" data-sfx="select" aria-checked={scope === 'all'} onClick={() => go({ quem: undefined })}>
                Todos
              </button>
              <button type="button" role="radio" data-sfx="select" aria-checked={scope === 'friends'} onClick={() => go({ quem: 'friends' })}>
                Amigos
              </button>
            </div>
          )}
        </div>
        <p className="mono rkp-note">{note}</p>
      </section>

      {/* 3. A classificação */}
      {query.isPending && query.fetchStatus !== 'paused' && <Skeleton />}
      {(query.isError || (query.isPending && query.fetchStatus === 'paused')) && (
        <LoadFailed
          what="o ranking"
          onRetry={() => void query.refetch()}
          offlineText="O ranking só carrega online. Você ainda pode jogar nos Modos de partida."
        />
      )}

      {query.isSuccess && entries.length === 0 && (
        <div className="rkp-empty" data-testid="ranking-empty">
          <Trophy size={34} aria-hidden="true" />
          <b>Ninguém no ranking ainda</b>
          <span className="mono">
            {scope === 'friends'
              ? 'Nem você nem seus amigos jogaram esta categoria neste período.'
              : 'Ninguém jogou esta categoria neste período. Seja a primeira pessoa!'}
          </span>
          <Link to={GAME_PATH[game]} className="btn alt" data-sfx="start">
            Jogar agora
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <section className="rkp-board" aria-label="Classificação">
          <h2 className="rkp-h">
            Classificação <small className="mono">{query.data?.total ?? entries.length} NO TOTAL</small>
          </h2>
          <Podium top={entries.slice(0, 3)} {...score} />
          {rest.length > 0 && <Rows rows={rest} {...score} />}
        </section>
      )}

      {query.isSuccess && !user && (
        <p className="rkp-guest">
          O ranking é só de quem tem conta.{' '}
          <Link to="/criar-conta" className="rp-link">
            Crie a sua
          </Link>{' '}
          para aparecer aqui.
        </p>
      )}

      {/* 4. Sua posição, fixa embaixo */}
      {user && query.isSuccess && me && (
        <aside className={`rkp-me${me.rank === 1 ? ' first' : ''}`} aria-label="Sua posição" data-testid="my-rank">
          <span className="rkp-me-pos">{me.rank}º</span>
          <span className="rkp-me-body">
            <b>
              Você · <Score entry={me} {...score} />
            </b>
            <span className="mono">
              {dailySum && me.days !== undefined && `${streakLabel(me.days).toUpperCase()} · `}
              {meLine}
            </span>
          </span>
        </aside>
      )}
      {user && query.isSuccess && !me && entries.length > 0 && (
        <aside className="rkp-me out" aria-label="Sua posição">
          <span className="rkp-me-body">
            <b>Você ainda não está aqui</b>
            <span className="mono">Jogue esta categoria neste período para entrar.</span>
          </span>
          <Link to={GAME_PATH[game]} className="rkp-play" data-sfx="start">
            Jogar
          </Link>
        </aside>
      )}

    </main>
  );
}
