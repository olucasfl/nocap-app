import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchRanking, type Game, type RankingEntry } from '@/lib/ranking';
import { dailyMax } from '@/lib/stats';
import { Loader } from './Loader';
import { RankingPanel } from './RankingPanel';
import './daily-panel.css';

const tenths = (n: number) => (n / 10).toFixed(1);

/**
 * A parte social do Daily de hoje: quantas pessoas jogaram, melhor nota, média, a sua posição
 * e como você foi contra a média, os amigos que já jogaram e o ranking completo do dia.
 * Os alvos do dia nunca aparecem aqui, só as notas (não estraga o Daily de quem ainda não jogou).
 */
export function DailyPanel({ game }: { game: Game }) {
  const user = useAuth((s) => s.user);
  const all = useQuery({
    queryKey: ['ranking', game, 'daily', 'day', 'all', user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', 'day', 'all'),
  });
  const friends = useQuery({
    queryKey: ['ranking', game, 'daily', 'day', 'friends', user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', 'day', 'friends'),
    enabled: !!user,
  });

  const entries: RankingEntry[] = all.data?.entries ?? [];
  const total = all.data?.total ?? 0;
  const max = dailyMax(game);
  const best = entries[0]?.score;
  const avg = entries.length
    ? entries.reduce((a, e) => a + e.score, 0) / entries.length
    : undefined;
  const me = all.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const beaten = me && total > 1 ? Math.round(((total - me.rank) / (total - 1)) * 100) : null;
  const friendEntries = friends.data?.entries.filter((e) => !e.isMe) ?? [];

  return (
    <section className="dp" aria-label="O Daily de hoje">
      <h2 className="dp-h mono">O DAILY DE HOJE</h2>
      {all.isPending && <Loader inline label="Carregando o Daily" />}
      {all.isSuccess && (
        <>
          <div className="dp-grid">
            <div className="dp-stat">
              <b>{total}</b>
              <span className="mono">{total === 1 ? 'JOGOU' : 'JOGARAM'}</span>
            </div>
            <div className="dp-stat">
              <b>{best !== undefined ? tenths(best) : '—'}</b>
              <span className="mono">MELHOR /{max}</span>
            </div>
            <div className="dp-stat">
              <b>{avg !== undefined ? tenths(avg) : '—'}</b>
              <span className="mono">MÉDIA</span>
            </div>
          </div>

          {me && (
            <div className="dp-me">
              <div className="dp-me-pos">
                <b>{me.rank}º</b>
                <span className="mono">DE {total}</span>
              </div>
              <p className="dp-me-text">
                Você fez <b>{tenths(me.score)}</b>
                {avg !== undefined && (
                  <>
                    {', '}
                    {me.score >= avg
                      ? `${tenths(me.score - avg)} acima da média do dia`
                      : `${tenths(avg - me.score)} abaixo da média do dia`}
                  </>
                )}
                {beaten !== null && `. Melhor que ${beaten}% de quem jogou.`}
              </p>
            </div>
          )}

          {user && friends.isSuccess && (
            <div className="dp-friends">
              <div className="mono dp-sub">AMIGOS QUE JÁ JOGARAM HOJE · {friendEntries.length}</div>
              {friendEntries.length === 0 ? (
                <p className="dp-empty">Nenhum amigo jogou o Daily hoje ainda. Chame alguém.</p>
              ) : (
                <ul className="dp-flist">
                  {friendEntries.slice(0, 5).map((e) => (
                    <li key={e.username}>
                      <span className="dp-fname">@{e.username}</span>
                      <span className="mono dp-fscore">
                        {tenths(e.score)}/{max}
                      </span>
                      <span className={`mono dp-fvs ${me && e.score > me.score ? 'up' : 'down'}`}>
                        {me
                          ? e.score > me.score
                            ? 'À FRENTE'
                            : e.score < me.score
                              ? 'ATRÁS'
                              : 'EMPATE'
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      <div className="dp-rank">
        <div className="mono dp-sub">RANKING DO DAILY</div>
        <RankingPanel game={game} initialBoard="daily" hideModes />
      </div>
    </section>
  );
}
