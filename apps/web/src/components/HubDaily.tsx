import { useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { dailyDate } from '@nocap/games';
import { WlPanel } from '@/games/words/landing/WordsLanding';
import { useAuth } from '@/lib/auth';
import { formatCountdown, useNextWordCountdown } from '@/lib/daily-countdown';
import { fetchFriends } from '@/lib/friends';
import { useOnline } from '@/lib/network';
import { fetchRanking, type Game, type RankingEntry } from '@/lib/ranking';
import { dailyMax, fetchStats, streakLabel } from '@/lib/stats';

type Tab = 'summary' | 'ranking' | 'friends' | 'rules';
const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Resumo' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'friends', label: 'Amigos' },
  { id: 'rules', label: 'Regras' },
];

/** Os dados do Daily de hoje (ranking do dia, amigos e a sequência), buscados só quando a tela abre. */
export function useDailyData(game: Game, enabled: boolean) {
  const user = useAuth((s) => s.user);
  const all = useQuery({
    queryKey: ['ranking', game, 'daily', 'day', 'all', user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', 'day', 'all'),
    enabled,
  });
  const friends = useQuery({
    queryKey: ['ranking', game, 'daily', 'day', 'friends', user?.id ?? null],
    queryFn: () => fetchRanking(game, 'daily', 'day', 'friends'),
    enabled: enabled && !!user,
  });
  const friendList = useQuery({
    queryKey: ['friends'],
    queryFn: fetchFriends,
    enabled: enabled && !!user,
  });
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: enabled && !!user });
  return { all, friends, friendList, stats };
}
type DailyData = ReturnType<typeof useDailyData>;

const unitOf = (game: Game) => (game === 'eco' ? ' passos' : `/${dailyMax(game)}`);
const fmt = (game: Game, n: number) =>
  game === 'eco' && Number.isInteger(n / 10) ? String(n / 10) : (n / 10).toFixed(1);

/** O lado esquerdo do Daily: o estado de hoje, a regra do dia, o contador até o próximo e o botão de jogar. */
export function HubDailyPanel({
  game,
  data,
  intro,
  busy,
  error,
  onPlay,
  onBack,
}: {
  game: Game;
  data: DailyData;
  intro?: { rules: { value: string; label: string }[]; text: ReactNode };
  busy?: boolean;
  error?: string;
  onPlay: () => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const online = useOnline();
  const left = useNextWordCountdown(() => void data.stats.refetch());
  const info = data.stats.data?.daily[game as 'color' | 'time' | 'eco'];
  const [, mm, dd] = dailyDate().split('-');
  const played = !!info?.playedToday;
  const same =
    game === 'color' ? 'as mesmas cores' : game === 'eco' ? 'a mesma sequência' : 'os mesmos alvos';

  return (
    <WlPanel
      title="Daily"
      lead={`Uma partida por dia · ${dd}/${mm}`}
      onBack={onBack}
      testid="daily-panel"
    >
      {played && info ? (
        <div className="wl-state won" data-testid="daily-done">
          <span className="wl-badge">Você já jogou hoje</span>
          <b>
            {fmt(game, info.totalScore ?? 0)}
            {unitOf(game)}
          </b>
          <span>
            Volte amanhã para manter a sequência
            {info.current > 0 ? ` (${streakLabel(info.current)} seguidos)` : ''}.
          </span>
        </div>
      ) : (
        <div className="wl-state" data-testid="daily-todo">
          <span className="wl-badge">Ainda não jogou hoje</span>
          <b>Uma chance por dia</b>
          <span>Com {same} para todo mundo. Sua nota entra no ranking do dia.</span>
        </div>
      )}
      {!played && intro && (
        <div className="wl-rulechips">
          {intro.rules.map((r) => (
            <div key={r.label}>
              <b>{r.value}</b>
              {r.label}
            </div>
          ))}
        </div>
      )}
      <div
        className="wl-next"
        data-testid="daily-countdown"
        role="timer"
        aria-label="Tempo até o próximo Daily"
      >
        <small>{played ? 'Próximo Daily em' : 'O Daily de hoje acaba em'}</small>
        <b>FALTA {formatCountdown(left)}</b>
      </div>
      {info && (
        <div className="wl-nums" data-testid="daily-streak">
          <span>
            sequência <b>{streakLabel(info.current)}</b>
          </span>
          <span>
            melhor <b>{streakLabel(info.best)}</b>
          </span>
        </div>
      )}
      {error && (
        <p className="gx-err" role="alert">
          {error}
        </p>
      )}
      {!played &&
        (!online ? (
          <div className="wl-state lost">
            <b>Sem internet</b>
            <span>O Daily só vale online.</span>
          </div>
        ) : !user ? (
          <div className="wl-login">
            <button
              type="button"
              className="gx-enter"
              onClick={() => void navigate({ to: '/entrar' })}
            >
              Entrar
            </button>
            <button
              type="button"
              className="gx-enter"
              onClick={() => void navigate({ to: '/criar-conta' })}
            >
              Criar conta
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="wl-cta"
            data-sfx="start"
            disabled={busy}
            onClick={onPlay}
            data-testid="play-daily"
          >
            <span>{busy ? 'Preparando...' : 'Jogar o Daily'}</span>
            <small>→</small>
          </button>
        ))}
    </WlPanel>
  );
}

/** O lado direito do Daily: Resumo, Ranking, Amigos e Regras do dia, com o mesmo desenho do hub. */
export function HubDailyBoard({ game, data }: { game: Game; data: DailyData }) {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('summary');
  const { all, friends, friendList } = data;
  const entries: RankingEntry[] = all.data?.entries ?? [];
  const total = all.data?.total ?? 0;
  const best = entries[0]?.score;
  const avg = entries.length
    ? entries.reduce((a, e) => a + e.score, 0) / entries.length
    : undefined;
  const me = all.data?.me ?? entries.find((e) => e.isMe) ?? null;
  const beaten = me && total > 1 ? Math.round(((total - me.rank) / (total - 1)) * 100) : null;
  const played = friends.data?.entries.filter((e) => !e.isMe) ?? [];
  const names = new Set(played.map((e) => e.username));
  const missing = (friendList.data?.friends ?? []).filter((f) => !names.has(f.username));
  const same =
    game === 'color' ? 'As mesmas cores' : game === 'eco' ? 'A mesma sequência' : 'Os mesmos alvos';

  return (
    <div className="wl-board wl-dboard" data-testid="daily-board">
      <div className="wl-chips" role="tablist" aria-label="Seções do Daily">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="wl-chip"
            aria-selected={tab === t.id}
            aria-pressed={tab === t.id}
            data-testid={`daily-tab-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="wl-dpane">
          {all.isPending ? (
            <p>Carregando o Daily...</p>
          ) : (
            <>
              <div className="wl-rulechips">
                <div>
                  <b>{total}</b>
                  {total === 1 ? 'jogou' : 'jogaram'}
                </div>
                <div>
                  <b>{best !== undefined ? fmt(game, best) : '—'}</b>melhor
                </div>
                <div>
                  <b>{avg !== undefined ? fmt(game, avg) : '—'}</b>média
                </div>
              </div>
              {me ? (
                <div className="wl-state won">
                  <b>
                    {me.rank}º de {total}
                  </b>
                  <span>
                    {fmt(game, me.score)}
                    {unitOf(game)}
                    {avg !== undefined &&
                      ` · ${me.score >= avg ? fmt(game, me.score - avg) + ' acima' : fmt(game, avg - me.score) + ' abaixo'} da média`}
                    {beaten !== null && ` · melhor que ${beaten}%`}
                  </span>
                </div>
              ) : (
                <p>Jogue o Daily de hoje para ver a sua posição e como você foi contra a média.</p>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'ranking' && (
        <div className="wl-dpane">
          {all.isPending ? (
            <p>Carregando o ranking...</p>
          ) : entries.length === 0 ? (
            <p>Ninguém jogou o Daily de hoje ainda. Seja o primeiro!</p>
          ) : (
            <ol className="wl-rank">
              {entries.slice(0, 10).map((e) => (
                <li key={e.username} className={e.isMe ? 'me' : ''}>
                  <b>{e.rank}º</b>
                  <span>@{e.username}</span>
                  <em>
                    {fmt(game, e.score)}
                    {unitOf(game)}
                  </em>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="wl-dpane">
          {!user ? (
            <p>Entre na sua conta para ver os amigos que jogaram.</p>
          ) : friends.isPending ? (
            <p>Carregando amigos...</p>
          ) : (
            <>
              <h4>Já jogaram · {played.length}</h4>
              {played.length === 0 ? (
                <p>Nenhum amigo jogou o Daily de hoje ainda.</p>
              ) : (
                <ol className="wl-rank">
                  {played.map((e) => (
                    <li key={e.username}>
                      <span>@{e.username}</span>
                      <em>
                        {fmt(game, e.score)}
                        {unitOf(game)}
                        {me &&
                          ` · ${e.score > me.score ? 'à frente' : e.score < me.score ? 'atrás' : 'empate'}`}
                      </em>
                    </li>
                  ))}
                </ol>
              )}
              {missing.length > 0 && (
                <>
                  <h4>Ainda não jogaram · {missing.length}</h4>
                  <ol className="wl-rank dim">
                    {missing.map((f) => (
                      <li key={f.username}>
                        <span>@{f.username}</span>
                        <em>falta jogar</em>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <ol className="wl-rules">
          <li>Uma partida por dia, por jogo, valendo em qualquer aparelho.</li>
          <li>{same} para todo mundo, e o dia vira à meia-noite (horário de São Paulo).</li>
          <li>Só vale online: a nota entra no ranking do dia.</li>
          <li>Na semana e em "sempre", o ranking soma os dailys jogados.</li>
          <li>Jogar todo dia mantém a sua sequência.</li>
        </ol>
      )}
    </div>
  );
}
