import { useEffect, useRef, useState } from 'react';
import { Message } from '@/components/icons';
import { ChatPanel } from '@/components/Chat';
import { useGameChat } from '@/lib/game-chat-state';
import { at, useRoom, type ChatMessage } from '@/lib/rooms';
import './game-chat.css';

/** Quanto tempo uma mensagem nova fica à vista (ms) antes de sumir. */
const SHOW_MS = 5000;

/**
 * Chat por cima da partida (Fut Fox, Desmorona! e Atravessa! em sala): só um botão pequeno. Quando alguém escreve, a
 * mensagem aparece ao lado por alguns segundos e some. Tocando no botão (ou Enter) o chat abre e fica até a pessoa fechar.
 */
export function GameChat({ enabled = true }: { enabled?: boolean }) {
  const snapshot = useRoom((s) => s.snapshot);
  const messages = useRoom((s) => s.chat);
  const unread = useRoom((s) => s.unread);
  const open = useGameChat((s) => s.open);
  const setOpen = (v: boolean) => useGameChat.setState({ open: v });
  const [shown, setShown] = useState<ChatMessage[]>([]);
  const lastId = useRef<number | null>(null);
  const timers = useRef(new Map<number, number>());

  // mensagem nova (de qualquer pessoa): aparece um instante e some
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (lastId.current === null) {
      // primeira leitura (histórico da sala): não mostra mensagens velhas
      lastId.current = last.id;
      return;
    }
    if (last.id === lastId.current) return;
    lastId.current = last.id;
    if (open) return;
    setShown((cur) => [...cur.slice(-2), last]);
    const t = window.setTimeout(() => {
      setShown((cur) => cur.filter((m) => m.id !== last.id));
      timers.current.delete(last.id);
    }, SHOW_MS);
    timers.current.set(last.id, t);
  }, [messages, open]);
  useEffect(
    () => () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      useGameChat.setState({ open: false });
    },
    [],
  );

  // Enter abre o chat; Esc fecha (sem abrir o menu do jogo junto)
  useEffect(() => {
    if (!enabled) return undefined;
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea');
      if (
        e.key === 'Enter' &&
        !typing &&
        !useGameChat.getState().open &&
        !document.querySelector('.gm-wrap')
      ) {
        e.preventDefault();
        setOpen(true);
        if (document.pointerLockElement) document.exitPointerLock();
      } else if (e.key === 'Escape' && useGameChat.getState().open) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [enabled]);

  if (!enabled || !snapshot || !snapshot.chat.open) return null;
  return (
    <>
      <div className="gc" data-testid="game-chat">
        <button
          type="button"
          className={`gc-btn${unread > 0 && !open ? ' new' : ''}`}
          aria-label={unread ? `Chat, ${unread} novas` : 'Chat'}
          aria-expanded={open}
          data-testid="game-chat-btn"
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setOpen(!open);
          }}
        >
          <Message size={20} />
          {unread > 0 && !open && <b className="mono">{unread > 9 ? '9+' : unread}</b>}
        </button>
        {!open && shown.length > 0 && (
          <ul className="gc-toasts" aria-live="polite">
            {shown.map((m) => (
              <li key={m.id} className="gc-toast">
                <b>{at(m.username)}</b> {m.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && (
        <div
          className="gc-panel"
          role="dialog"
          aria-label="Chat da sala"
          data-testid="game-chat-panel"
        >
          <div className="gc-head">
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
      )}
    </>
  );
}
