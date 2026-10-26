import { useState } from 'react';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BackButton } from '@/components/BackButton';
import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { Records } from '@/components/Records';
import {
  ago,
  fetchFriendProfile,
  fetchFriendWords,
  removeFriend,
  presenceText,
  type FriendProfile as FriendProfileData,
} from '@/lib/friends';
import { gameLabel, modeLabel } from '@/lib/labels';
import { streakLabel, type Stats } from '@/lib/stats';
import './profile.css';

const route = getRouteApi('/tabs/amigos/$username');

/** Total de partidas e o jogo que mais aparece, a partir dos recordes por modo. */
function playSummary(stats: Stats) {
  const byGame = new Map<string, number>();
  for (const m of stats.modes) byGame.set(m.game, (byGame.get(m.game) ?? 0) + m.matches);
  const total = [...byGame.values()].reduce((a, b) => a + b, 0);
  const favorite = [...byGame.entries()].sort((a, b) => b[1] - a[1])[0];
  return { total, favorite: favorite && favorite[1] > 0 ? favorite[0] : null };
}

function Details({ data: raw }: { data: FriendProfileData }) {
  // Campos novos podem faltar (resposta de uma API ainda não atualizada): a tela não quebra.
  const data: FriendProfileData = {
    ...raw,
    online: raw.online ?? false,
    lastSeenAt: raw.lastSeenAt ?? null,
    lastPlayed: raw.lastPlayed ?? null,
  };
  const { total, favorite } = playSummary(data.stats);
  const words = useQuery({
    queryKey: ['friend-words', data.username],
    queryFn: () => fetchFriendWords(data.username),
    retry: false,
  });
  return (
    <>
      <section className={`pfx-hero${data.online ? ' on' : ''}`}>
        <div className="pfx-avatar" aria-hidden="true">
          {data.username.charAt(0).toUpperCase()}
          <i className={`pf-dot${data.online ? ' on' : ''}`} />
        </div>
        <div className="pfx-id">
          <h1 className="pfx-name">@{data.username}</h1>
          <span className={`pfx-pill mono${data.online ? ' on' : ''}`}>
            {presenceText(data).toUpperCase()}
          </span>
        </div>
        <Link to="/ranking" search={{ quem: 'friends' }} className="pfx-rank" data-sfx="select">
          Ver ranking entre amigos
        </Link>
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

      <h2 className="pfx-h">Recordes</h2>
      <Records stats={data.stats} words={words.data ?? (words.isError ? null : undefined)} />
      <RemoveFriend username={data.username} />
    </>
  );
}

/** Desfazer a amizade: fica aqui no perfil (longe dos toques da lista) e pede confirmação. */
function RemoveFriend({ username }: { username: string }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeFriend(username),
    onSuccess: async () => {
      // Amigos novos ou removidos mudam o recorte "Amigos" do ranking.
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.removeQueries({ queryKey: ['friend-profile', username] });
      await navigate({ to: '/amigos' });
    },
    onError: () => setError('Não deu para remover agora. Tente de novo.'),
  });
  return (
    <section className="pf-danger" aria-label="Remover amigo">
      {error && (
        <p className="acc-failure mono" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn ghost"
        data-sfx="remove"
        disabled={remove.isPending}
        onClick={() => setAsking(true)}
      >
        {remove.isPending ? 'Removendo...' : `Remover @${username} dos amigos`}
      </button>
      <ConfirmDialog
        open={asking}
        title="Remover amigo?"
        text={`@${username} sai da sua lista de amigos e vocês deixam de aparecer no ranking um do outro. Para voltar, é preciso pedir amizade de novo.`}
        confirmLabel="Remover"
        confirmSfx="remove"
        onConfirm={() => {
          setAsking(false);
          setError('');
          remove.mutate();
        }}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}

/**
 * Perfil de um amigo: se está online, quando entrou por último, o que jogou por último, a
 * dias seguidos e recordes. Só amigos veem.
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
