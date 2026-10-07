import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFriends } from '@/lib/friends';
import { inviteFriend, useRoom, type RoomSnapshot } from '@/lib/rooms';
import { GAME_OF } from './rules';

/** Mais que isto e a lista de amigos ganha uma busca. */
const SEARCH_FROM = 8;

type Done = 'share' | 'link' | 'code' | null;

/**
 * Central de chamar gente, em blocos do mais usado para o menos: enviar o link escolhendo o
 * app, atalhos diretos, amigos do NoCap e quem pode entrar.
 */
export function InvitePanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const invited = useRoom((s) => s.invited);
  const friends = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
  const [done, setDone] = useState<Done>(null);
  const [filter, setFilter] = useState('');
  const link = `${location.origin}/sala/${snapshot.code}`;
  const message = `Entra na minha sala ${GAME_OF[snapshot.game]}: ${snapshot.code} ${link}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const inRoom = new Set(snapshot.members.map((m) => m.username));
  const all = friends.data?.friends ?? [];
  const list = all
    .filter((f) => !inRoom.has(f.username))
    .filter((f) => f.username.includes(filter.trim().toLowerCase().replace(/^@/, '')));
  const free = snapshot.maxPlayers - snapshot.members.length;

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

  const text = encodeURIComponent(message);

  return (
    <div className="lb-invite">
      <section className="lb-block" aria-label="Enviar o link">
        <div className="mono rm-label">ENVIAR O LINK</div>
        <button type="button" className="btn alt" data-sfx="send" onClick={() => void share()}>
          {done === 'share' ? 'Link copiado' : 'Enviar o link por...'}
        </button>
        <p className="mono rm-mode-note">
          {canShare
            ? 'Abre a lista de apps do seu aparelho: WhatsApp, Telegram, mensagens...'
            : 'Este aparelho não abre a lista de apps, então o botão copia a mensagem pronta.'}
        </p>
      </section>

      <section className="lb-block" aria-label="Atalhos">
        <div className="mono rm-label">ATALHOS</div>
        <div className="lb-shortcuts">
          <a
            className="fr-btn"
            data-sfx="send"
            href={`https://wa.me/?text=${text}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          <a
            className="fr-btn"
            data-sfx="send"
            href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
              `Entra na minha sala ${GAME_OF[snapshot.game]}: ${snapshot.code}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram
          </a>
          <a
            className="fr-btn"
            data-sfx="send"
            href={`mailto:?subject=${encodeURIComponent('Sala no NoCap')}&body=${text}`}
          >
            E-mail
          </a>
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
      </section>

      <section className="lb-block" aria-label="Chamar amigos">
        <div className="mono rm-label">CHAMAR AMIGOS DO NOCAP</div>
        {all.length >= SEARCH_FROM && (
          <input
            className="field-input"
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
              ? 'Você ainda não tem amigos no NoCap. Use o link ou o código acima.'
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

      <section className="lb-block" aria-label="Quem pode entrar">
        <div className="mono rm-label">QUEM PODE ENTRAR</div>
        <div className="lb-codebig">
          <b>{snapshot.code}</b>
          <span className="mono">
            {snapshot.members.length}/{snapshot.maxPlayers} NA SALA
            {free > 0 ? ` · ${free} ${free === 1 ? 'VAGA' : 'VAGAS'}` : ' · CHEIA'}
          </span>
        </div>
        <p className="mono rm-mode-note">Quem entra precisa ter uma conta no NoCap.</p>
      </section>
    </div>
  );
}
