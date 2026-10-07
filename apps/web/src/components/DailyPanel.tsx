import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchFriends } from '@/lib/friends';
import { fetchRanking, type Game, type RankingEntry } from '@/lib/ranking';
import { dailyMax, fetchStats, streakLabel } from '@/lib/stats';
import { Loader } from './Loader';
import { RankingPanel } from './RankingPanel';
import { TabBar } from './TabBar';
import './daily-panel.css';

const tenthsOf = (n: number) => (n / 10).toFixed(1);

type Tab = 'summary' | 'ranking' | 'friends' | 'rules';
const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Resumo' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'friends', label: 'Amigos' },
  { id: 'rules', label: 'Regras' },
];

/**
 * A parte social do Daily de hoje, em abas: Resumo (quantos jogaram, melhor, média, sua
 * posição), Ranking (hoje, semana, sempre), Amigos (quem já jogou e quem falta) e Regras. Os
 * alvos do dia nunca aparecem aqui, só notas (não estraga o Daily de quem ainda não jogou).
 */
export function DailyPanel({ game, initialTab = 'summary' }: { game: Game; initialTab?: Tab }) {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>(initialTab);
  /** Eco: a nota é o número de passos (inteiro, sem máximo); nos outros jogos é em pontos. */
  const eco = game === 'eco';
  const tenths = (n: number) => (eco && Number.isInteger(n / 10) ? String(n / 10) : tenthsOf(n));
  const all = useQuery({
    queryKey: ['ranking', game, 'daily', 'day', 'all', user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', 'day', 'all'),
  });
  const friends = useQuery({
    queryKey: ['ranking', game, 'daily', 'day', 'friends', user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', 'day', 'friends'),
    enabled: !!user,
  });
  const friendList = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user });
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });

  const entries: RankingEntry[] = all.data?.entries ?? [];
  const total = all.data?.total ?? 0;
  const max = dailyMax(game);
  const best = entries[0]?.score;
  const avg = entries.length
    ? entries.reduce((a, e) => a + e.score, 0) / entries.length
    : undefined;
  const me = all.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const beaten = me && total > 1 ? Math.round(((total - me.rank) / (total - 1)) * 100) : null;
  const played = friends.data?.entries.filter((e) => !e.isMe) ?? [];
  const playedNames = new Set(played.map((e) => e.username));
  const missing = (friendList.data?.friends ?? []).filter((f) => !playedNames.has(f.username));
  const info = stats.data?.daily[game];

  return (
    <section className="dp" aria-label="O Daily de hoje">
      <TabBar game={game} label="Seções do Daily" tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'summary' && (
        <div className="dp-pane">
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
                  <span className="mono">MELHOR</span>
                </div>
                <div className="dp-stat">
                  <b>{avg !== undefined ? tenths(avg) : '—'}</b>
                  <span className="mono">MÉDIA</span>
                </div>
              </div>
              {me ? (
                <div className="dp-me">
                  <div className="dp-me-pos">
                    <b>{me.rank}º</b>
                    <span className="mono">DE {total}</span>
                  </div>
                  <div className="dp-me-body">
                    <div className="dp-me-score">
                      {tenths(me.score)}
                      <small className="mono">{eco ? ' passos' : `/${max}`}</small>
                    </div>
                    {avg !== undefined && (
                      <div className="mono dp-me-line">
                        {me.score >= avg
                          ? `${tenths(me.score - avg)} ACIMA DA MÉDIA`
                          : `${tenths(avg - me.score)} ABAIXO DA MÉDIA`}
                      </div>
                    )}
                    {beaten !== null && (
                      <div className="mono dp-me-line">MELHOR QUE {beaten}% DE QUEM JOGOU</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="dp-empty">
                  Jogue o Daily de hoje para ver a sua posição e como você foi contra a média.
                </p>
              )}
              {info && (
                <div className="dp-streak">
                  <span className="mono">SEQUÊNCIA</span>
                  <b>{streakLabel(info.current)}</b>
                  <span className="mono">MELHOR {streakLabel(info.best).toUpperCase()}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'ranking' && (
        <div className="dp-pane">
          <RankingPanel game={game} initialBoard="daily" hideModes />
        </div>
      )}

      {tab === 'friends' && (
        <div className="dp-pane">
          {!user && <p className="dp-empty">Entre na sua conta para ver os amigos que jogaram.</p>}
          {user && friends.isPending && <Loader inline label="Carregando amigos" />}
          {user && friends.isSuccess && (
            <>
              <div>
                <div className="mono dp-sub">JÁ JOGARAM · {played.length}</div>
                {played.length === 0 ? (
                  <p className="dp-empty">Nenhum amigo jogou o Daily de hoje ainda.</p>
                ) : (
                  <ul className="dp-flist">
                    {played.map((e) => (
                      <li key={e.username}>
                        <span className="dp-fname">@{e.username}</span>
                        <span className="mono dp-fscore">
                          {tenths(e.score)}
                          {eco ? ' passos' : `/${max}`}
                        </span>
                        <span className={`mono dp-fvs ${me && e.score > me.score ? 'up' : 'down'}`}>
                          {!me
                            ? ''
                            : e.score > me.score
                              ? 'À FRENTE'
                              : e.score < me.score
                                ? 'ATRÁS'
                                : 'EMPATE'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {missing.length > 0 && (
                <div>
                  <div className="mono dp-sub">AINDA NÃO JOGARAM · {missing.length}</div>
                  <ul className="dp-flist dp-missing">
                    {missing.map((f) => (
                      <li key={f.username}>
                        <span className="dp-fname">@{f.username}</span>
                        <span className="mono dp-fvs">FALTA JOGAR</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <ul className="dp-rules">
          <li>Uma partida por dia, por jogo, valendo em qualquer aparelho.</li>
          <li>
            {game === 'color'
              ? 'As mesmas cores'
              : game === 'eco'
                ? 'A mesma sequência'
                : 'Os mesmos alvos'}{' '}
            para todo mundo, e o dia vira à meia-noite (horário de São Paulo).
          </li>
          <li>Só vale online: a nota entra no ranking do dia.</li>
          <li>Na semana e em "sempre", o ranking soma os dailys jogados.</li>
          <li>Jogar todo dia mantém a sua sequência.</li>
        </ul>
      )}
    </section>
  );
}
