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
  matchMax,
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
          <span className="hist-swatch" style={{ background: toHex(r.target) }} title={toHex(r.target)} />
          <span className="mono hist-vs">×</span>
          <span className="hist-swatch" style={{ background: toHex(r.guess) }} title={toHex(r.guess)} />
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
          {(item.totalScore / 10).toFixed(1)}
          <small className="mono">/{matchMax(item)}</small>
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

  const q = useInfiniteQuery({
    queryKey: ['history', game],
    queryFn: ({ pageParam }) => fetchHistory(game, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!user,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

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
      <Choice label="Jogo" value={game} options={GAMES} onChange={setGame} />
      <div className="hist-game">
        <GameArt game={game} size="sm" />
        <div className="mono hist-game-name">PARTIDAS DE {GAME_LABEL[game].toUpperCase()}</div>
      </div>
      {q.isPending && <Loader inline />}
      {q.isError && (
        <div className="hist-state">
          <p className="lead">Não deu para carregar o histórico. Confira a conexão.</p>
          <button type="button" className="btn ghost" onClick={() => void q.refetch()}>
            Tentar de novo
          </button>
        </div>
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
      {q.hasNextPage && (
        <button
          type="button"
          className="btn ghost hist-more"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </main>
  );
}
