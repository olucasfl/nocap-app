import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field } from '@/components/Field';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { inviteFriend, useRoom } from '@/lib/rooms';
import {
  MIN_SEARCH,
  acceptRequest,
  actionLabel,
  declineRequest,
  fetchFriends,
  removeFriend,
  searchUsers,
  sendRequest,
  stateLabel,
  type SearchResult,
} from '@/lib/friends';
import './account.css';
import './friends.css';

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Sem conexão. Tente de novo.');

function Person({
  username,
  link = false,
  children,
}: {
  username: string;
  /** Amigo aceito: o nome abre o perfil dele. */
  link?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="fr-row">
      {link ? (
        <Link to="/amigos/$username" params={{ username }} className="fr-who">
          <span className="fr-avatar" aria-hidden="true">
            {username.charAt(0).toUpperCase()}
          </span>
          <span className="fr-name">@{username}</span>
          <span className="mono fr-see">VER PERFIL</span>
        </Link>
      ) : (
        <span className="fr-name">@{username}</span>
      )}
      <span className="fr-actions">{children}</span>
    </li>
  );
}

function Search({ onChanged }: { onChanged: () => void }) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const results = useQuery({
    queryKey: ['user-search', term],
    queryFn: () => searchUsers(term),
    enabled: term.length >= MIN_SEARCH,
  });

  const act = useMutation({
    mutationFn: (u: SearchResult) =>
      u.state === 'incoming' ? acceptRequest(u.username) : sendRequest(u.username),
    onSuccess: () => {
      setError('');
      onChanged();
      void queryClient.invalidateQueries({ queryKey: ['user-search'] });
    },
    onError: (e) => setError(message(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setTerm(text.trim().toLowerCase());
  };

  return (
    <section className="fr-section" aria-label="Buscar pessoas">
      <form className="fr-search" onSubmit={submit}>
        <Field
          label="Buscar pelo @usuário"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          hint={`Digite ao menos ${MIN_SEARCH} letras`}
        />
        <button type="submit" className="btn alt fr-go" disabled={text.trim().length < MIN_SEARCH}>
          Buscar
        </button>
      </form>
      {error && (
        <p className="acc-failure mono" role="alert">
          {error}
        </p>
      )}
      {results.isFetching && <p className="lead">Buscando...</p>}
      {results.isSuccess && results.data.length === 0 && (
        <p className="lead">Ninguém com esse começo de @usuário.</p>
      )}
      {results.isSuccess && results.data.length > 0 && (
        <ul className="fr-list">
          {results.data.map((u) => {
            const label = actionLabel(u.state);
            return (
              <Person key={u.username} username={u.username}>
                {label ? (
                  <button
                    type="button"
                    className="fr-btn"
                    disabled={act.isPending}
                    onClick={() => act.mutate(u)}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="mono fr-state">{stateLabel(u.state)}</span>
                )}
              </Person>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Friends() {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user });
  // Se estou num lobby, cada amigo ganha o botão de chamar para a sala.
  const lobby = useRoom((s) => (s.snapshot?.phase === 'lobby' ? s.snapshot : null));
  const invited = useRoom((s) => s.invited);
  const [error, setError] = useState('');

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['friends'] });
    // Amigos novos mudam o recorte "Amigos" do ranking.
    void queryClient.invalidateQueries({ queryKey: ['ranking'] });
  };

  const mutate = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      setError('');
      refresh();
    },
    onError: (e) => setError(message(e)),
  });

  if (status === 'loading') {
    return (
      <main className="fr">
        <h1>Amigos</h1>
        <Loader inline />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="fr">
        <h1>Amigos</h1>
        <p className="lead">
          Para adicionar amigos e comparar notas só entre vocês, entre na sua conta.
        </p>
        <div className="fr-cta">
          <Link to="/criar-conta" className="btn alt">
            Criar conta
          </Link>
          <Link to="/entrar" className="btn ghost">
            Entrar
          </Link>
        </div>
      </main>
    );
  }

  const data = list.data;

  return (
    <main className="fr">
      <h1>Amigos</h1>
      {lobby && (
        <p className="mono fr-state">
          VOCÊ ESTÁ NA SALA {lobby.code}: TOQUE EM "CHAMAR" PARA CONVIDAR.
        </p>
      )}
      <Search onChanged={refresh} />
      {error && (
        <p className="acc-failure mono" role="alert">
          {error}
        </p>
      )}
      {list.isPending && list.fetchStatus !== 'paused' && <Loader inline />}
      {(list.isError || (list.isPending && list.fetchStatus === 'paused')) && (
        <LoadFailed
          what="seus amigos"
          onRetry={() => void list.refetch()}
          offlineText="Sem internet também não dá para jogar com amigos."
        />
      )}

      {data && data.incoming.length > 0 && (
        <section className="fr-section" aria-label="Pedidos recebidos">
          <h2 className="mono fr-title">PEDIDOS RECEBIDOS</h2>
          <ul className="fr-list">
            {data.incoming.map((p) => (
              <Person key={p.username} username={p.username}>
                <button
                  type="button"
                  className="fr-btn"
                  onClick={() => mutate.mutate(() => acceptRequest(p.username))}
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  className="fr-btn ghost"
                  onClick={() => mutate.mutate(() => declineRequest(p.username))}
                >
                  Recusar
                </button>
              </Person>
            ))}
          </ul>
        </section>
      )}

      {data && data.outgoing.length > 0 && (
        <section className="fr-section" aria-label="Pedidos enviados">
          <h2 className="mono fr-title">PEDIDOS ENVIADOS</h2>
          <ul className="fr-list">
            {data.outgoing.map((p) => (
              <Person key={p.username} username={p.username}>
                <button
                  type="button"
                  className="fr-btn ghost"
                  onClick={() => mutate.mutate(() => removeFriend(p.username))}
                >
                  Cancelar
                </button>
              </Person>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <section className="fr-section" aria-label="Seus amigos">
          <h2 className="mono fr-title">SEUS AMIGOS · {data.friends.length}</h2>
          {data.friends.length === 0 ? (
            <p className="lead">Você ainda não tem amigos. Busque pelo @usuário acima.</p>
          ) : (
            <ul className="fr-list">
              {data.friends.map((p) => (
                <Person key={p.username} username={p.username} link>
                  {lobby &&
                    !lobby.members.some((m) => m.username === p.username) &&
                    (invited.includes(p.username) ? (
                      <span className="mono fr-state">CONVITE ENVIADO</span>
                    ) : (
                      <button
                        type="button"
                        className="fr-btn"
                        onClick={() => inviteFriend(p.username)}
                      >
                        Chamar
                      </button>
                    ))}
                  <button
                    type="button"
                    className="fr-btn ghost"
                    onClick={() => mutate.mutate(() => removeFriend(p.username))}
                  >
                    Remover
                  </button>
                </Person>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
