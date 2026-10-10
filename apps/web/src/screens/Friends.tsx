import { LoadFailed } from '@/components/LoadFailed';
import { Loader } from '@/components/Loader';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field } from '@/components/Field';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { gameLabel } from '@/lib/history';
import {
  MIN_SEARCH,
  ago,
  presenceText,
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

type Tab = 'friends' | 'requests' | 'add';

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
        <button
          type="submit"
          className="btn alt fr-go"
          data-sfx="send"
          disabled={text.trim().length < MIN_SEARCH}
        >
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
                    data-sfx={u.state === 'incoming' ? 'success' : 'send'}
                    disabled={act.isPending}
                    aria-busy={act.isPending && act.variables?.username === u.username}
                    onClick={() => act.mutate(u)}
                  >
                    {act.isPending && act.variables?.username === u.username
                      ? u.state === 'incoming'
                        ? 'Aceitando...'
                        : 'Enviando...'
                      : label}
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
  /** Amigo que a pessoa tocou em "Remover": a remoção só acontece depois de confirmar. */
  const [removing, setRemoving] = useState<string | null>(null);
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user });
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab | null>(null);
  const [filter, setFilter] = useState('');

  const refresh = () => {
    // Amigos novos mudam o recorte "Amigos" do ranking.
    void queryClient.invalidateQueries({ queryKey: ['ranking'] });
    return queryClient.invalidateQueries({ queryKey: ['friends'] });
  };

  // `id` diz qual botão foi tocado (ex.: "accept:ana"): só ele mostra o carregamento, e enquanto
  // a ação não termina (e a lista não recarrega) os outros ficam travados.
  const mutate = useMutation({
    mutationFn: ({ run }: { id: string; run: () => Promise<unknown> }) => run(),
    onSuccess: async () => {
      setError('');
      await refresh();
    },
    onError: (e) => setError(message(e)),
  });
  const busyId = mutate.isPending ? mutate.variables?.id : undefined;
  const lock = mutate.isPending;

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
  const pending = (data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0);
  // Quem não tem amigos ainda começa na busca; quem tem pedido esperando vê os pedidos primeiro.
  const firstTab: Tab = !data
    ? 'friends'
    : data.incoming.length > 0
      ? 'requests'
      : data.friends.length === 0
        ? 'add'
        : 'friends';
  const current = tab ?? firstTab;
  const term = filter.trim().toLowerCase().replace(/^@/, '');
  const shown = (data?.friends ?? []).filter((f) => f.username.includes(term));
  const tabs: [Tab, string, number][] = [
    ['friends', 'Amigos', data?.friends.length ?? 0],
    ['requests', 'Pedidos', pending],
    ['add', 'Adicionar', 0],
  ];

  return (
    <main className="fr">
      <h1>Amigos</h1>
      <div className="fr-tabs" role="tablist" aria-label="Seções de amigos">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-sfx="tab"
            aria-selected={current === id}
            className={current === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
            {n > 0 && (
              <small className={id === 'requests' && (data?.incoming.length ?? 0) > 0 ? 'hot' : ''}>
                {n}
              </small>
            )}
          </button>
        ))}
      </div>
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

      {current === 'add' && <Search onChanged={refresh} />}

      {current === 'requests' && data && (
        <>
          {pending === 0 && <p className="lead">Nenhum pedido por enquanto.</p>}
          {data.incoming.length > 0 && (
            <section className="fr-section" aria-label="Pedidos recebidos">
              <h2 className="mono fr-title">QUEREM SER SEUS AMIGOS</h2>
              <ul className="fr-list">
                {data.incoming.map((p) => (
                  <Person key={p.username} username={p.username}>
                    <button
                      type="button"
                      className="fr-btn"
                      data-sfx="success"
                      disabled={lock}
                      aria-busy={busyId === `accept:${p.username}`}
                      onClick={() =>
                        mutate.mutate({
                          id: `accept:${p.username}`,
                          run: () => acceptRequest(p.username),
                        })
                      }
                    >
                      {busyId === `accept:${p.username}` ? 'Aceitando...' : 'Aceitar'}
                    </button>
                    <button
                      type="button"
                      className="fr-btn ghost"
                      data-sfx="cancel"
                      disabled={lock}
                      aria-busy={busyId === `decline:${p.username}`}
                      onClick={() =>
                        mutate.mutate({
                          id: `decline:${p.username}`,
                          run: () => declineRequest(p.username),
                        })
                      }
                    >
                      {busyId === `decline:${p.username}` ? 'Recusando...' : 'Recusar'}
                    </button>
                  </Person>
                ))}
              </ul>
            </section>
          )}
          {data.outgoing.length > 0 && (
            <section className="fr-section" aria-label="Pedidos enviados">
              <h2 className="mono fr-title">AGUARDANDO RESPOSTA</h2>
              <ul className="fr-list">
                {data.outgoing.map((p) => (
                  <Person key={p.username} username={p.username}>
                    <button
                      type="button"
                      className="fr-btn ghost"
                      data-sfx="remove"
                      disabled={lock}
                      aria-busy={busyId === `cancel:${p.username}`}
                      onClick={() =>
                        mutate.mutate({
                          id: `cancel:${p.username}`,
                          run: () => removeFriend(p.username),
                        })
                      }
                    >
                      {busyId === `cancel:${p.username}` ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </Person>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {current === 'friends' && data && (
        <section className="fr-section" aria-label="Seus amigos">
          {data.friends.length === 0 ? (
            <div className="fr-empty">
              <p className="lead">Você ainda não tem amigos no NoCap.</p>
              <button type="button" className="btn alt" onClick={() => setTab('add')}>
                Procurar pessoas
              </button>
            </div>
          ) : (
            <>
              {data.friends.length >= 8 && (
                <input
                  className="ch-input"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar pelo @usuário"
                  aria-label="Filtrar amigos"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              )}
              {shown.length === 0 && <p className="lead">Ninguém com esse @usuário.</p>}
              <ul className="fr-grid">
                {shown.map((p) => (
                  <li key={p.username} className="fr-card">
                    <Link
                      to="/amigos/$username"
                      params={{ username: p.username }}
                      className="fr-card-who"
                    >
                      <span className="fr-avatar big" aria-hidden="true">
                        {p.username.charAt(0).toUpperCase()}
                        <i className={`fr-dot${p.online ? ' on' : ''}`} />
                      </span>
                      <span className="fr-name">@{p.username}</span>
                      <span className={`mono fr-presence${p.online ? ' on' : ''}`}>
                        {presenceText(p)}
                      </span>
                      <span className="mono fr-last">
                        {p.lastPlayed
                          ? `Jogou ${gameLabel(p.lastPlayed.game)} ${ago(p.lastPlayed.playedAt)}`
                          : 'Ainda não jogou'}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="fr-remove"
                      data-sfx="remove"
                      disabled={lock}
                      aria-busy={busyId === `remove:${p.username}`}
                      onClick={() => setRemoving(p.username)}
                    >
                      {busyId === `remove:${p.username}` ? 'Removendo...' : 'Remover'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Remover amigo?"
        text={`@${removing ?? ''} sai da sua lista de amigos e vocês deixam de aparecer no ranking um do outro. Para voltar, é preciso pedir amizade de novo.`}
        confirmLabel="Remover"
        confirmSfx="remove"
        onConfirm={() => {
          const who = removing;
          setRemoving(null);
          if (who) mutate.mutate({ id: `remove:${who}`, run: () => removeFriend(who) });
        }}
        onCancel={() => setRemoving(null)}
      />
    </main>
  );
}
