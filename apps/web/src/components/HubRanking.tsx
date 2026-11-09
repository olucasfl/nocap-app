import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  PERIODS,
  SCOPES,
  boardsOf,
  defaultPeriod,
  fetchRanking,
  type Board,
  type Game,
  type Period,
  type Scope,
} from '@/lib/ranking';
import { formatBest } from '@/lib/stats';
import '@/games/words/landing/words-landing.css';

/**
 * O ranking dentro do hub do jogo (spec 071), com o tema dele: um quadro por modo, o período (hoje, semana, sempre), todos ou só
 * amigos, o top da lista e a sua posição mesmo fora dele. `fixedBoard` trava num quadro só (o Daily do Classic Word's).
 */
export function HubRanking({ game, fixedBoard }: { game: Game; fixedBoard?: Board }) {
  const user = useAuth((s) => s.user);
  const boards = fixedBoard ? [{ id: fixedBoard, label: 'Daily' }] : boardsOf(game);
  const [board, setBoard] = useState<Board>(fixedBoard ?? boards[0]!.id);
  const [period, setPeriod] = useState<Period>(defaultPeriod(fixedBoard ?? boards[0]!.id));
  const [scope, setScope] = useState<Scope>('all');
  const q = useQuery({
    queryKey: ['ranking', game, board, period, scope, user?.id ?? null],
    queryFn: () => fetchRanking(game, board, period, scope),
  });
  const entries = q.data?.entries ?? [];
  const me = q.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const dailySum = board === 'daily' && period !== 'day';

  return (
    <div className="wl-rankbox" data-testid="hub-ranking">
      {boards.length > 1 && (
        <div className="wl-chips" role="tablist" aria-label="Modo do ranking">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              className="wl-chip"
              aria-selected={board === b.id}
              aria-pressed={board === b.id}
              data-sfx="select"
              data-testid={`rank-board-${b.id}`}
              onClick={() => {
                setBoard(b.id);
                setPeriod(defaultPeriod(b.id));
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div className="wl-chips wl-chips-sub">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="wl-chip small"
            aria-pressed={period === p.id}
            data-testid={`rank-period-${p.id}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
        {user &&
          SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="wl-chip small"
              aria-pressed={scope === s.id}
              data-testid={`rank-scope-${s.id}`}
              onClick={() => setScope(s.id)}
            >
              {s.label}
            </button>
          ))}
      </div>
      {q.isPending ? (
        <p className="wl-rank-note">Carregando o ranking...</p>
      ) : q.isError ? (
        <p className="wl-rank-note">Não deu para carregar o ranking agora.</p>
      ) : entries.length === 0 ? (
        <p className="wl-rank-note">
          {scope === 'friends'
            ? 'Nenhum amigo apareceu aqui ainda.'
            : 'Ninguém apareceu neste ranking ainda. Seja o primeiro!'}
        </p>
      ) : (
        <>
          {dailySum && <p className="wl-rank-note">Soma dos dailys do período (um por dia).</p>}
          <ol className="wl-rank" aria-label="Ranking">
            {entries.slice(0, 20).map((e) => (
              <li
                key={e.username}
                className={`${e.isMe ? 'me' : ''}${e.rank <= 3 ? ` top t${e.rank}` : ''}`}
              >
                <b>{e.rank}º</b>
                <span>@{e.username}</span>
                <em>{formatBest(game, board, e.score)}</em>
              </li>
            ))}
          </ol>
          {me && !entries.slice(0, 20).some((e) => e.isMe) && (
            <div className="wl-state won">
              <b>
                Você: {me.rank}º de {q.data?.total}
              </b>
              <span>{formatBest(game, board, me.score)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
