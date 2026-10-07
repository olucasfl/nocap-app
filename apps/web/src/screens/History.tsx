import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { GameArt, GAME_LABEL } from '@/components/GameArt';
import { Choice } from '@/components/RankingList';
import { toHex } from '@/games/color/hex';
import { formatDiff, formatSeconds } from '@/games/time/format';
import { useAuth } from '@/lib/auth';
import {
  classifyMatch,
  colorRounds,
  fetchHistory,
  formatPlayedAt,
  kindLabel,
  scoreParts,
  modeLabel,
  timeRounds,
  type HistoryItem,
} from '@/lib/history';
import type { GameId } from '@/lib/stats';
import './history.css';

const GAMES: { id: GameId; label: string }[] = [
  { id: 'color', label: 'Cor' },
  { id: 'time', label: 'Tempo' },
];

function ColorDetail({ item }: { item: HistoryItem }) {
  const rounds = colorRounds(item);
  if (!rounds) return <Expired />;
  return (
    <ol className="hist-rounds">
      {rounds.map((r, i) => (
        <li key={i} className="hist-round">
          <span className="mono hist-round-n">{i + 1}</span>
          <span
            className="hist-swatch"
            style={{ background: toHex(r.target) }}
            title={toHex(r.target)}
          />
          <span className="mono hist-vs">×</span>
          <span
            className="hist-swatch"
            style={{ background: toHex(r.guess) }}
            title={toHex(r.guess)}
          />
          <span className="mono hist-round-score">{r.score.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

function TimeDetail({ item }: { item: HistoryItem }) {
  const rounds = timeRounds(item);
  if (!rounds) return <Expired />;
  return (
    <ol className="hist-rounds">
      {rounds.map((r, i) => (
        <li key={i} className="hist-round">
          <span className="mono hist-round-n">{i + 1}</span>
          <span className="mono hist-time">
            {formatSeconds(r.target)} → {formatSeconds(r.answer)}
          </span>
          <span className="mono hist-vs">{formatDiff(r.answer - r.target)}</span>
          <span className="mono hist-round-score">{r.score.toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

function Expired() {
  return <p className="mono hist-note">DETALHE EXPIRADO: SÓ O RESUMO FICA GUARDADO.</p>;
}

function MatchRow({ item }: { item: HistoryItem }) {
  const [open, setOpen] = useState(false);
  const cls = classifyMatch(item);
  return (
    <li className="hist-item">
      <button
        type="button"
        className="hist-row"
        data-sfx="select"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hist-row-main">
          <span className="hist-row-title">
            {modeLabel(item.mode)}
            <span className="mono hist-badge">{kindLabel(item.kind).toUpperCase()}</span>
          </span>
          <span className="mono hist-row-date">{formatPlayedAt(item.playedAt)}</span>
          <span className={`mono hist-class ${cls.tone}`}>{cls.label}</span>
        </span>
        <span className="hist-row-score">
          {scoreParts(item).main}
          <small className="mono">{scoreParts(item).unit}</small>
        </span>
      </button>
      {open && (item.game === 'time' ? <TimeDetail item={item} /> : <ColorDetail item={item} />)}
    </li>
  );
}

/** Histórico separado por jogo; cada partida mostra a classificação (colocação na sala ou faixa da nota). */
export function History() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [game, setGame] = useState<GameId>('color');
  /** Página mostrada (0 = a mais recente). As já vistas ficam em cache; a próxima vem do servidor. */
  const [page, setPage] = useState(0);

  const q = useInfiniteQuery({
    queryKey: ['history', game],
    queryFn: ({ pageParam }) => fetchHistory(game, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user,
  });

  const items = q.data?.pages[page]?.items ?? [];
  const hasNext = page + 1 < (q.data?.pages.length ?? 0) || !!q.hasNextPage;
  const goNext = async () => {
    if (page + 1 >= (q.data?.pages.length ?? 0)) await q.fetchNextPage();
    setPage((p) => p + 1);
  };

  if (status !== 'loading' && !user) {
    return (
      <main className="hist">
        <h1>Histórico</h1>
        <p className="lead">
          O histórico guarda as suas partidas de cada jogo. Entre na sua conta para ver o seu.
        </p>
        <div className="hist-guest">
          <Link to="/entrar" className="btn alt">
            Entrar
          </Link>
          <Link to="/criar-conta" className="btn ghost">
            Criar conta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="hist">
      <h1>Histórico</h1>
      <Choice
        label="Jogo"
        value={game}
        options={GAMES}
        onChange={(g) => {
          setGame(g);
          setPage(0);
        }}
      />
      <div className="hist-game">
        <GameArt game={game} size="sm" />
        <div className="mono hist-game-name">PARTIDAS DE {GAME_LABEL[game].toUpperCase()}</div>
      </div>
      {q.isPending && q.fetchStatus !== 'paused' && <Loader inline />}
      {(q.isError || (q.isPending && q.fetchStatus === 'paused')) && (
        <LoadFailed what="o histórico" onRetry={() => void q.refetch()} />
      )}
      {q.isSuccess && items.length === 0 && (
        <p className="lead">
          Nenhuma partida de {GAME_LABEL[game]} ainda. Jogue uma e ela aparece aqui.
        </p>
      )}
      {items.length > 0 && (
        <ul className="hist-list">
          {items.map((item) => (
            <MatchRow key={item.matchId} item={item} />
          ))}
        </ul>
      )}
      {(page > 0 || hasNext) && (
        <nav className="hist-pager" aria-label="Páginas do histórico">
          <button
            type="button"
            className="btn ghost"
            data-sfx="page"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="mono hist-page">PÁGINA {page + 1}</span>
          <button
            type="button"
            className="btn ghost"
            data-sfx="page"
            disabled={!hasNext || q.isFetchingNextPage}
            onClick={() => void goNext()}
          >
            {q.isFetchingNextPage ? 'Carregando...' : 'Próxima'}
          </button>
        </nav>
      )}
    </main>
  );
}
