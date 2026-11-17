import { useEffect, useRef, useState, type FormEvent } from 'react';
import { markChatRead, sendChat, useRoom } from '@/lib/rooms';
import { play } from '../impostor/audio';
import { Coin, Icon, Sheet } from '../impostor/ui';
import { useLooks, type Snap } from './looks';

/**
 * Chat do Impostor, com o visual do jogo: um botão no alto da tela (ao lado de convidar), a folha abre de baixo com a
 * conversa. Fica fechado nas fases com segredo (papel, dicas, voto) para ninguém entregar nada.
 */
export function SalaChatButton({ snap }: { snap: Snap }) {
  const [open, setOpen] = useState(false);
  const unread = useRoom((s) => s.unread);
  const enabled = snap.chat.open;
  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);
  return (
    <>
      <button
        type="button"
        className={`im-iconbtn im-chatbtn${unread > 0 && !open ? ' new' : ''}`}
        aria-label={!enabled ? 'Chat fechado agora' : unread ? `Chat, ${unread} mensagens novas` : 'Chat'}
        aria-disabled={!enabled}
        disabled={!enabled}
        data-testid="sala-chat-btn"
        onClick={() => { play('tap'); setOpen(true); markChatRead(); }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H10l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
        {unread > 0 && !open && <b className="im-badge">{unread > 9 ? '9+' : unread}</b>}
      </button>
      {open && enabled && <ChatSheet snap={snap} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatSheet({ snap, onClose }: { snap: Snap; onClose: () => void }) {
  const chat = useRoom((s) => s.chat);
  const looks = useLooks(snap);
  const me = snap.me ?? '';
  const [text, setText] = useState('');
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    markChatRead();
    end.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);
  const send = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    play('add');
    sendChat(t);
    setText('');
  };
  const byName = new Map(snap.members.map((m) => [m.username, m.id]));
  return (
    <Sheet title="Chat da sala" onClose={onClose} icon={<Icon name="cartas" size={44} />}>
      <ul className="im-chatlist" aria-label="Mensagens" data-testid="sala-chat-list">
        {chat.length === 0 && <li className="im-sub center">Ninguém falou ainda. Mande a primeira.</li>}
        {chat.map((m) => {
          const id = byName.get(m.username) ?? m.userId;
          const mine = id === me || m.userId === me;
          const lk = looks(id);
          return (
            <li key={m.id} className={`im-msg${mine ? ' mine' : ''}`}>
              {!mine && <Coin avatar={lk.avatar} color={lk.color} size="sm" />}
              <span><small>{mine ? 'Você' : m.username}</small>{m.text}</span>
            </li>
          );
        })}
        <li ref={end} aria-hidden="true" />
      </ul>
      <form className="im-add" onSubmit={send}>
        <input id="sala-chat-input" data-testid="sala-chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem" maxLength={200} autoComplete="off" enterKeyHint="send" aria-label="Mensagem" />
        <button className="im-iconbtn pri" aria-label="Enviar mensagem" data-testid="sala-chat-send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
    </Sheet>
  );
}
