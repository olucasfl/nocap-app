import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  GAMES,
  boardsOf,
  BOARD_MAX,
  PERIODS,
  SCOPES,
  fetchRanking,
  type Board,
  type Game,
  type Period,
  type Scope,
  type RankingEntry,
} from '@/lib/ranking';
import { useAuth } from '@/lib/auth';
import './ranking.css';

function Row({ entry, max }: { entry: RankingEntry; max: number }) {
  return (
    <li className={`rk-row${entry.isMe ? ' me' : ''}`}>
      <span className="mono rk-pos">{entry.rank}</span>
      <span className="rk-name">@{entry.username}</span>
      <span className="rk-score">
        {(entry.score / 10).toFixed(1)}
        <small className="mono">/{max}</small>
      </span>
    </li>
  );
}

export function Ranking() {
  const [game, setGame] = useState<Game>('color');
  const [board, setBoard] = useState<Board>('classic');
  const [period, setPeriod] = useState<Period>('week');
  const [scope, setScope] = useState<Scope>('all');
  const user = useAuth((s) => s.user);
  // O token (se houver) vai junto: assim a resposta traz a sua posição.
  const q = useQuery({
    queryKey: ['ranking', game, board, period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, board, period, scope),
  });

  const max = BOARD_MAX[board];
  const listed = q.data?.entries ?? [];
  const meOutside = q.data?.me && !listed.some((e) => e.isMe) ? q.data.me : null;

  return (
    <main className="rk">
      <h1>Ranking</h1>
      <div className="rk-seg rk-scopes" role="radiogroup" aria-label="Jogo">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={game === g.id}
            onClick={() => {
              setGame(g.id);
              // Cada jogo tem seus quadros: volta ao Clássico, que existe nos dois.
              setBoard('classic');
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      {user && (
        <div className="rk-seg rk-scopes" role="radiogroup" aria-label="Quem aparece">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={scope === s.id}
              onClick={() => setScope(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="rk-seg" role="radiogroup" aria-label="Modo">
        {boardsOf(game).map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={board === b.id}
            onClick={() => setBoard(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="rk-seg rk-periods" role="radiogroup" aria-label="Período">
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

      {q.isPending && <p className="lead">Carregando...</p>}
      {q.isError && (
        <div className="rk-state">
          <p className="lead">Não deu para carregar o ranking. Confira a conexão.</p>
          <button type="button" className="btn ghost" onClick={() => void q.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {q.isSuccess && listed.length === 0 && (
        <p className="lead">
          {scope === 'friends'
            ? 'Nem você nem seus amigos jogaram isso neste período.'
            : 'Ninguém jogou isso ainda neste período. Seja a primeira pessoa.'}
        </p>
      )}
      {listed.length > 0 && (
        <ol className="rk-list">
          {listed.map((e) => (
            <Row key={e.username} entry={e} max={max} />
          ))}
        </ol>
      )}
      {meOutside && (
        <section aria-label="Sua posição">
          <p className="mono rk-you">SUA POSIÇÃO</p>
          <ol className="rk-list">
            <Row entry={{ ...meOutside, isMe: true }} max={max} />
          </ol>
        </section>
      )}
      {q.isSuccess && !user && (
        <p className="lead rk-note">
          O ranking é só de quem tem conta.{' '}
          <Link to="/criar-conta" className="rk-link">
            Crie a sua
          </Link>{' '}
          para aparecer aqui.
        </p>
      )}
    </main>
  );
}
