import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MIN_SEARCH, fetchFriends, searchUsers } from '@/lib/friends';
import { inviteFriend, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { GAME_OF } from './rules';

/** Mais que isto e a lista de amigos ganha uma busca. */
const SEARCH_FROM = 8;

type Done = 'share' | 'link' | 'code' | null;

/** Convidar: enviar o link, copiar o link ou o código e, embaixo, chamar amigos do NoCap. */
export function InvitePanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const invited = useRoom((s) => s.invited);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
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

  return (
    <div className="lb-invite">
      <section className="lb-block" aria-label="Convidar">
        <div className="mono rm-label">CONVIDAR</div>
        <button type="button" className="btn alt" data-sfx="send" onClick={() => void share()}>
          {done === 'share' ? 'Mensagem copiada' : 'Enviar o link por...'}
        </button>
        <div className="lb-shortcuts">
          <button
            type="button"
            className="fr-btn ghost"
            data-sfx="send"
            onClick={() => void copy(link, 'link')}
          >
            {done === 'link' ? 'Link copiado' : 'Copiar link'}
          </button>
          <button
            type="button"
            className="fr-btn ghost"
            data-sfx="send"
            onClick={() => void copy(snapshot.code, 'code')}
          >
            {done === 'code' ? 'Código copiado' : 'Copiar código'}
          </button>
        </div>
        <p className="mono rm-mode-note">
          {canShare
            ? 'Quem entra precisa ter uma conta no NoCap.'
            : 'Este aparelho não abre a lista de apps: o botão de cima copia a mensagem pronta.'}
        </p>
      </section>

      <section className="lb-block" aria-label="Procurar pessoa">
        <div className="mono rm-label">PROCURAR PESSOA (NÃO PRECISA SER AMIGO)</div>
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
            placeholder={`@usuário (ao menos ${MIN_SEARCH} letras)`}
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
            Pesquisar
          </button>
        </form>
        {found.isFetching && <p className="mono lb-hint">Procurando...</p>}
        {found.isError && <p className="mono lb-hint">Não deu para pesquisar. Tente de novo.</p>}
        {found.isSuccess && results.length === 0 && (
          <p className="mono lb-hint">Ninguém com esse começo de @usuário.</p>
        )}
        {results.length > 0 && (
          <ul className="fr-list">
            {results.map((u) => (
              <li key={u.username} className="fr-row">
                <span className="fr-name">
                  @{u.username}
                  {u.state === 'friends' && <span className="mono rm-badge">AMIGO</span>}
                </span>
                {invited.includes(u.username) ? (
                  <span className="mono fr-state">CONVITE ENVIADO</span>
                ) : (
                  <button
                    type="button"
                    className="fr-btn"
                    data-sfx="send"
                    onClick={() => inviteFriend(u.username)}
                  >
                    Convidar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mono rm-mode-note">
          Ache a pessoa e toque em Convidar. Quando ela entrar, você pode pedir amizade pela aba
          Membros.
        </p>
      </section>

      <section className="lb-block" aria-label="Chamar amigos">
        <div className="mono rm-label">CHAMAR AMIGOS DO NOCAP</div>
        {all.length >= SEARCH_FROM && (
          <input
            className="ch-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar pelo @usuário"
            aria-label="Buscar amigo"
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}
        {friends.isPending ? (
          <p className="mono lb-hint">Carregando seus amigos...</p>
        ) : list.length === 0 ? (
          <p className="mono lb-hint">
            {all.length === 0
              ? 'Você ainda não tem amigos no NoCap. Use o link ou o código.'
              : filter
                ? 'Ninguém com esse @usuário.'
                : 'Todos os seus amigos já estão na sala.'}
          </p>
        ) : (
          <ul className="fr-list">
            {list.map((f) => (
              <li key={f.username} className="fr-row">
                <span className="fr-name">@{f.username}</span>
                {invited.includes(f.username) ? (
                  <span className="mono fr-state">CONVITE ENVIADO</span>
                ) : (
                  <button
                    type="button"
                    className="fr-btn"
                    data-sfx="send"
                    onClick={() => inviteFriend(f.username)}
                  >
                    Convidar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
