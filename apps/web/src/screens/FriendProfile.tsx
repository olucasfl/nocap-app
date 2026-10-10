import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BackButton } from '@/components/BackButton';
import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { Records } from '@/components/Records';
import {
  ago,
  fetchFriendProfile,
  presenceText,
  type FriendProfile as FriendProfileData,
  type RecentMatch,
} from '@/lib/friends';
import { formatPlayedAt, gameLabel, kindLabel, modeLabel } from '@/lib/history';
import { countUnit, streakLabel, type Stats } from '@/lib/stats';
import './profile.css';

const route = getRouteApi('/tabs/amigos/$username');

const scoreText = (m: Pick<RecentMatch, 'game' | 'mode' | 'totalScore'>) => {
  const unit = countUnit(m.game, m.mode);
  return unit
    ? `${Math.round(m.totalScore / 10)} ${unit}`
    : `${(m.totalScore / 10).toFixed(1)} pts`;
};

/** Total de partidas e o jogo que mais aparece, a partir dos recordes por modo. */
function playSummary(stats: Stats) {
  const byGame = new Map<string, number>();
  for (const m of stats.modes) byGame.set(m.game, (byGame.get(m.game) ?? 0) + m.matches);
  const total = [...byGame.values()].reduce((a, b) => a + b, 0);
  const favorite = [...byGame.entries()].sort((a, b) => b[1] - a[1])[0];
  return { total, favorite: favorite && favorite[1] > 0 ? favorite[0] : null };
}

function Details({ data }: { data: FriendProfileData }) {
  const { total, favorite } = playSummary(data.stats);
  return (
    <>
      <section className="pf-card">
        <div className="pf-avatar pf-avatar-live" aria-hidden="true">
          {data.username.charAt(0).toUpperCase()}
          <i className={`pf-dot${data.online ? ' on' : ''}`} />
        </div>
        <div className="pf-id">
          <div className="pf-name">@{data.username}</div>
          <div className={`mono pf-status${data.online ? ' on' : ''}`}>
            {presenceText(data).toUpperCase()}
          </div>
        </div>
      </section>

      <section className="pf-facts" aria-label="Atividade">
        <div className="pf-fact">
          <span className="mono pf-fact-label">ÚLTIMA VEZ NO APP</span>
          <b>{data.online ? 'Agora' : data.lastSeenAt ? ago(data.lastSeenAt) : 'Nunca entrou'}</b>
        </div>
        <div className="pf-fact">
          <span className="mono pf-fact-label">ÚLTIMO JOGO</span>
          <b>{data.lastPlayed ? gameLabel(data.lastPlayed.game) : 'Nada ainda'}</b>
          {data.lastPlayed && (
            <small className="mono">
              {modeLabel(data.lastPlayed.mode)} · {ago(data.lastPlayed.playedAt)}
            </small>
          )}
        </div>
        <div className="pf-fact">
          <span className="mono pf-fact-label">PARTIDAS</span>
          <b>{total}</b>
          {favorite && (
            <small className="mono">MAIS JOGA {gameLabel(favorite).toUpperCase()}</small>
          )}
        </div>
        <div className="pf-fact">
          <span className="mono pf-fact-label">DIAS SEGUIDOS</span>
          <b>{streakLabel(data.stats.visit.current)}</b>
          <small className="mono">MELHOR {streakLabel(data.stats.visit.best).toUpperCase()}</small>
        </div>
      </section>

      <h2 className="mono fr-title">ATIVIDADE RECENTE</h2>
      {data.recent.length === 0 ? (
        <p className="lead">@{data.username} ainda não jogou nenhuma partida.</p>
      ) : (
        <ul className="pf-recent">
          {data.recent.map((m, i) => (
            <li key={`${m.playedAt}-${i}`} className="pf-recent-row">
              <div className="pf-recent-main">
                <b>{gameLabel(m.game)}</b>
                <span className="mono">
                  {modeLabel(m.mode)} · {kindLabel(m.kind)}
                </span>
              </div>
              <div className="pf-recent-side">
                <b>{m.kind === 'room' && m.placement ? `${m.placement}º lugar` : scoreText(m)}</b>
                <span className="mono">{formatPlayedAt(m.playedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mono fr-title">RECORDES</h2>
      <Records stats={data.stats} />
    </>
  );
}

/**
 * Perfil de um amigo: se está online, quando entrou por último, o que jogou por último, a
 * atividade recente (jogo, modo, nota e horário), dias seguidos e recordes. Só amigos veem.
 */
export function FriendProfile() {
  const { username } = route.useParams();
  const q = useQuery({
    queryKey: ['friend-profile', username],
    queryFn: () => fetchFriendProfile(username),
    retry: false,
    refetchInterval: 60_000,
  });

  return (
    <main className="pf">
      <BackButton to="/amigos" label="Amigos" />
      {q.isPending && q.fetchStatus !== 'paused' && <Loader label="Carregando perfil" />}
      {q.isPending && q.fetchStatus === 'paused' && (
        <LoadFailed what="o perfil" onRetry={() => void q.refetch()} />
      )}
      {q.isError && (
        <>
          <h1>@{username}</h1>
          <p className="lead">
            Não deu para abrir esse perfil. Só dá para ver o perfil de quem é seu amigo.
          </p>
          <Link to="/amigos" className="btn ghost">
            Voltar aos amigos
          </Link>
        </>
      )}
      {q.data && <Details data={q.data} />}
    </main>
  );
}
