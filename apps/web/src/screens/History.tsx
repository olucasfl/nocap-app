import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { toHex } from '@/games/color/hex';
import {
  colorRounds,
  fetchHistory,
  formatPlayedAt,
  kindLabel,
  modeLabel,
  type HistoryItem,
} from '@/lib/history';
import './history.css';

function MatchDetail({ item }: { item: HistoryItem }) {
  const rounds = colorRounds(item);
  if (!rounds) {
    return <p className="mono hist-note">DETALHE EXPIRADO: SÓ O RESUMO FICA GUARDADO.</p>;
  }
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

function MatchRow({ item }: { item: HistoryItem }) {
  const [open, setOpen] = useState(false);
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
            Cor · {modeLabel(item.mode)}
            <span className="mono hist-badge">{kindLabel(item.kind).toUpperCase()}</span>
          </span>
          <span className="mono hist-row-date">{formatPlayedAt(item.playedAt)}</span>
        </span>
        <span className="hist-row-score">
          {(item.totalScore / 10).toFixed(1)}
          <small className="mono">/50</small>
        </span>
      </button>
      {open && <MatchDetail item={item} />}
    </li>
  );
}

export function History() {
  const q = useInfiniteQuery({
    queryKey: ['history'],
    queryFn: ({ pageParam }) => fetchHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <main className="hist">
      <h1>Histórico</h1>
      {q.isPending && <p className="lead">Carregando...</p>}
      {q.isError && (
        <div className="hist-state">
          <p className="lead">Não deu para carregar o histórico. Confira a conexão.</p>
          <button type="button" className="btn ghost" onClick={() => void q.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {q.isSuccess && items.length === 0 && (
        <p className="lead">Nenhuma partida ainda. Jogue uma rodada e ela aparece aqui.</p>
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
