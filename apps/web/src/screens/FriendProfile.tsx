import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BackButton } from '@/components/BackButton';
import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { Records } from '@/components/Records';
import { fetchFriendProfile } from '@/lib/friends';
import { streakLabel } from '@/lib/stats';
import './profile.css';

const route = getRouteApi('/tabs/amigos/$username');

/** Perfil de um amigo: @usuário, dias seguidos no NoCap e recordes por jogo. Só amigos veem. */
export function FriendProfile() {
  const { username } = route.useParams();
  const q = useQuery({
    queryKey: ['friend-profile', username],
    queryFn: () => fetchFriendProfile(username),
    retry: false,
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
      {q.data && (
        <>
          <section className="pf-card">
            <div className="pf-avatar" aria-hidden="true">
              {q.data.username.charAt(0).toUpperCase()}
            </div>
            <div className="pf-id">
              <div className="pf-name">@{q.data.username}</div>
              <div className="mono pf-email">AMIGO</div>
            </div>
          </section>
          <section className="pf-streak" aria-label="Dias seguidos no NoCap">
            <div className="mono pf-streak-label">DIAS SEGUIDOS NO NOCAP</div>
            <div className="pf-streak-value">{streakLabel(q.data.stats.visit.current)}</div>
            <div className="mono pf-streak-sub">
              MELHOR SEQUÊNCIA {streakLabel(q.data.stats.visit.best).toUpperCase()}
            </div>
          </section>
          <h2 className="mono fr-title">RECORDES</h2>
          <Records stats={q.data.stats} />
        </>
      )}
    </main>
  );
}
