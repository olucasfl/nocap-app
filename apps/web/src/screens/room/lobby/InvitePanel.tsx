import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MIN_SEARCH, fetchFriends, searchUsers } from '@/lib/friends';
import { useAuth } from '@/lib/auth';
import { inviteFriend, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { GAME_OF } from './rules';

/** Mais que isto e a lista de amigos ganha uma busca. */
const SEARCH_FROM = 8;

type Done = 'share' | 'link' | 'code' | null;

/** Convidar: enviar o link, copiar o link ou o código e, embaixo, chamar amigos do NoCap. */
export function InvitePanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const invited = useRoom((s) => s.invited);
  const invitedEver = useRoom((s) => s.invitedEver);
  const user = useAuth((st) => st.user);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: !!user });
  const [done, setDone] = useState<Done>(null);
  const [filter, setFilter] = useState('');
  const [handle, setHandle] = useState('');
  /** Termo pesquisado (só pesquisa ao enviar, não a cada letra). */
  const [term, setTerm] = useState('');
  const found = useQuery({
    queryKey: ['user-search', term],
    queryFn: () => searchUsers(term),
    enabled: term.length >= MIN_SEARCH,
  });
  const link = `${location.origin}/sala/${snapshot.code}`;
  const message = `Entra na minha sala ${GAME_OF[snapshot.game]}: ${snapshot.code} ${link}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const inRoom = new Set(snapshot.members.map((m) => m.username));
  const all = friends.data?.friends ?? [];
  const list = all
    .filter((f) => !inRoom.has(f.username))
    .filter((f) => f.username.includes(filter.trim().toLowerCase().replace(/^@/, '')));

  // Quem já está na sala não precisa de convite.
  const results = (found.data ?? []).filter((u) => !inRoom.has(u.username));

  const flash = (what: Done) => {
    setDone(what);
    setTimeout(() => setDone(null), 2000);
  };

  const copy = async (text: string, what: Done) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(what);
    } catch {
      /* sem permissão para copiar: o texto continua visível na tela */
    }
  };

  const share = async () => {
    if (!canShare) return copy(message, 'share');
    try {
      await navigator.share({ title: 'NoCap', text: message, url: link });
    } catch {
      /* cancelou a folha de compartilhar */
    }
  };

  const row = (username: string, badge?: string) => (
    <li key={username} className="lb3-inv-row">
      <span className="lb3-inv-name">
        @{username}
        {badge && <small className="mono">{badge}</small>}
      </span>
      {invited.includes(username) ? (
        <span className="mono lb3-inv-sent">Enviado</span>
      ) : (
        <button
          type="button"
          className="fr-btn"
          data-sfx="send"
          onClick={() => inviteFriend(username)}
        >
          {invitedEver.includes(username) ? 'Chamar de novo' : 'Chamar'}
        </button>
      )}
    </li>
  );

  return (
    <div className="lb3-invite">
      <section className="lb3-share" aria-label="Link da sala">
        <div className="lb3-share-code">
          <span className="mono">CÓDIGO</span>
          <b>{snapshot.code}</b>
        </div>
        <div className="lb3-share-btns">
          <button type="button" className="btn alt" data-sfx="send" onClick={() => void share()}>
            {done === 'share' ? 'Mensagem copiada' : 'Enviar convite'}
          </button>
          <button
            type="button"
            className="btn ghost"
            data-sfx="send"
            onClick={() => void copy(link, 'link')}
          >
            {done === 'link' ? 'Link copiado' : 'Copiar link'}
          </button>
        </div>
        <p className="mono lb3-hint">Quem recebe o link entra direto, mesmo sem conta.</p>
      </section>

      {user ? (
        <>
          <section className="lb3-sec" aria-label="Amigos">
            <h3>Seus amigos</h3>
            {all.length >= SEARCH_FROM && (
              <input
                className="ch-input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar amigo"
                aria-label="Buscar amigo"
                autoCapitalize="none"
                autoCorrect="off"
              />
            )}
            {friends.isPending ? (
              <p className="mono lb3-hint">Carregando...</p>
            ) : list.length === 0 ? (
              <p className="mono lb3-hint">
                {all.length === 0
                  ? 'Você ainda não tem amigos no NoCap. Use o link acima.'
                  : filter
                    ? 'Ninguém com esse nome.'
                    : 'Todos os seus amigos já estão na sala.'}
              </p>
            ) : (
              <ul className="lb3-inv-list">{list.map((f) => row(f.username))}</ul>
            )}
          </section>

          <section className="lb3-sec" aria-label="Procurar pessoa">
            <h3>Procurar por @usuário</h3>
            <form
              className="ch-form"
              onSubmit={(e) => {
                e.preventDefault();
                setTerm(handle.trim().replace(/^@/, '').toLowerCase());
              }}
            >
              <input
                className="ch-input"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={`@usuário (mín. ${MIN_SEARCH} letras)`}
                aria-label="Procurar pelo @usuário"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button
                type="submit"
                className="ch-send"
                data-sfx="send"
                disabled={handle.trim().replace(/^@/, '').length < MIN_SEARCH}
              >
                Buscar
              </button>
            </form>
            {found.isFetching && <p className="mono lb3-hint">Procurando...</p>}
            {found.isError && (
              <p className="mono lb3-hint">Não deu para pesquisar. Tente de novo.</p>
            )}
            {found.isSuccess && results.length === 0 && (
              <p className="mono lb3-hint">Ninguém encontrado.</p>
            )}
            {results.length > 0 && (
              <ul className="lb3-inv-list">
                {results.map((u) => row(u.username, u.state === 'friends' ? 'amigo' : undefined))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="mono lb3-hint">Crie uma conta para chamar amigos do NoCap direto daqui.</p>
      )}
    </div>
  );
}
