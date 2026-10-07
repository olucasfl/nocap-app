import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Message } from '@/components/icons';
import { useAuth } from '@/lib/auth';
import { markChatRead, muteMember, sendChat, useRoom, type RoomSnapshot } from '@/lib/rooms';
import './chat.css';

const MAX = 200;

const time = (at: number) =>
  new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Conversa da sala (spec 014): mensagens, campo de texto e, para o líder, silenciar. */
export function ChatPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useAuth((s) => s.user?.id);
  const messages = useRoom((s) => s.chat);
  const error = useRoom((s) => s.message);
  const [text, setText] = useState('');
  const list = useRef<HTMLUListElement>(null);
  const isHost = snapshot.hostId === me;
  const open = snapshot.chat.open;
  const silenced = !!me && snapshot.chat.muted.includes(me);

  const [away, setAway] = useState(false);
  const stick = useRef(true);

  const toBottom = () => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
    setAway(false);
  };

  // Painel à vista = mensagens lidas. Só desce sozinho se a pessoa já estava no fim (ou se a
  // mensagem é dela); senão mostra "novas mensagens" para ela não perder o que está lendo.
  const last = messages[messages.length - 1];
  useEffect(() => {
    markChatRead();
    if (stick.current || last?.userId === me) toBottom();
    else setAway(true);
  }, [messages.length]);

  const onScroll = () => {
    const el = list.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (stick.current) setAway(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || !open || silenced) return;
    sendChat(clean);
    setText('');
  };

  return (
    <div className="ch">
      <ul
        className="ch-list"
        ref={list}
        onScroll={onScroll}
        aria-live="polite"
        aria-label="Mensagens da sala"
      >
        {messages.length === 0 && <li className="ch-empty mono">NINGUÉM FALOU AINDA.</li>}
        {messages.map((m, i) => {
          const mine = m.userId === me;
          const prev = messages[i - 1];
          // Mensagens seguidas da mesma pessoa agrupam: o nome e a hora aparecem uma vez.
          const head = !prev || prev.userId !== m.userId || m.at - prev.at > 60_000;
          const muted = snapshot.chat.muted.includes(m.userId);
          return (
            <li key={m.id} className={`ch-msg${mine ? ' me' : ''}${head ? ' head' : ''}`}>
              {head && (
                <div className="ch-meta mono">
                  <b>@{m.username}</b>
                  <span>{time(m.at)}</span>
                  {isHost && !mine && (
                    <button
                      type="button"
                      className="ch-mute"
                      data-sfx="select"
                      onClick={() => muteMember(m.userId)}
                    >
                      {muted ? 'LIBERAR' : 'SILENCIAR'}
                    </button>
                  )}
                </div>
              )}
              <p>{m.text}</p>
            </li>
          );
        })}
      </ul>
      {away && (
        <button type="button" className="ch-new mono" data-sfx="select" onClick={toBottom}>
          NOVAS MENSAGENS ↓
        </button>
      )}
      {error && /chat|Calma|longa|silenci|Escreva/i.test(error) && (
        <p className="acc-failure mono" role="alert">
          {error}
        </p>
      )}
      <form className="ch-form" onSubmit={submit}>
        <input
          className="ch-input"
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            silenced
              ? 'O líder silenciou você'
              : open
                ? 'Escreva uma mensagem'
                : 'Chat fechado agora'
          }
          disabled={!open || silenced}
          aria-label="Mensagem"
          autoComplete="off"
          enterKeyHint="send"
        />
        {text.length > MAX - 40 && <span className="ch-count mono">{MAX - text.length}</span>}
        <button
          type="submit"
          className="ch-send"
          data-sfx="send"
          disabled={!open || silenced || !text.trim()}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

/**
 * Durante a partida: botão com o contador de não lidas e uma gaveta com a conversa. Quando o
 * jogo fecha o chat (Já Deu? na contagem, Intruso nas rodadas) some tudo, inclusive o contador.
 */
export function ChatDock({ snapshot }: { snapshot: RoomSnapshot }) {
  const unread = useRoom((s) => s.unread);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (!snapshot.chat.open) return null;
  return (
    <>
      <button
        type="button"
        className="ch-fab"
        data-sfx="select"
        aria-label={unread ? `Chat, ${unread} novas` : 'Chat'}
        onClick={() => setOpen(true)}
      >
        <Message size={22} />
        {unread > 0 && <b className="mono">{unread > 9 ? '9+' : unread}</b>}
      </button>
      {open && (
        <div className="ch-backdrop" onClick={() => setOpen(false)}>
          <div
            className="ch-drawer"
            role="dialog"
            aria-label="Chat da sala"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ch-head">
              <h2 className="mono">CHAT</h2>
              <button
                type="button"
                className="ch-close"
                data-sfx="back"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>
            <ChatPanel snapshot={snapshot} />
          </div>
        </div>
      )}
    </>
  );
}
