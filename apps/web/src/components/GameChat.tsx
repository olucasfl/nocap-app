import { useEffect, useRef, useState } from 'react';
import { ChatPanel } from '@/components/Chat';
import { useGameChat } from '@/lib/game-chat-state';
import { BOL_TEAM_COLORS } from '@nocap/games';
import { at, useRoom, type ChatMessage, type RoomSnapshot } from '@/lib/rooms';
import './game-chat.css';

/** Quanto tempo uma mensagem nova fica à vista (ms) antes de sumir. */
const SHOW_MS = 5000;

/** Balão de conversa com três pontinhos: o ícone do chat da partida. */
function IcChat({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M5 4.5h14a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-6.2L8 21.5v-4H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z"
        fill="currentColor"
        stroke="#1b1535"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="8.3" cy="11" r="1.35" fill="#1b1535" />
      <circle cx="12" cy="11" r="1.35" fill="#1b1535" />
      <circle cx="15.7" cy="11" r="1.35" fill="#1b1535" />
    </svg>
  );
}

const SPECTATOR = '#9a9aa5';
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Como a pessoa aparece no chat: no Fut Fox a cor do time; no Desmorona! e no Atravessa! a cor da raposa; quem está de
 * fora da partida (espectador, entrou depois) fica cinza.
 */
export function chatColor(snapshot: RoomSnapshot, userId: string): string | null {
  const b = snapshot.bola;
  if (b) {
    const team = b.teamOf[userId];
    return team === undefined || team < 0 ? SPECTATOR : hex(BOL_TEAM_COLORS[team] ?? 0x888888);
  }
  const g = snapshot.desmorona ?? snapshot.atravessa;
  if (g) {
    const playing = Object.keys(g.slots).length > 0;
    if (playing && g.slots[userId] === undefined) return SPECTATOR;
    return g.colors[userId] ?? SPECTATOR;
  }
  return null;
}

const count = (n: number) => (n > 99 ? '99+' : String(n));

/**
 * Chat por cima da partida (Fut Fox, Desmorona! e Atravessa! em sala). Fechado é só um botão com o número de mensagens
 * novas; quando alguém escreve, a mensagem aparece ao lado por alguns segundos e some. A tecla T (ou o botão) abre e fecha;
 * ao abrir o mouse volta a aparecer e o campo de texto já fica pronto. `onClosed` devolve o controle ao jogo (prender o mouse).
 */
export function GameChat({
  enabled = true,
  onClosed,
}: {
  enabled?: boolean;
  /** O chat fechou; `wasLocked` diz se o mouse estava preso à câmera antes de abrir (então deve voltar a ficar). */
  onClosed?: (wasLocked: boolean) => void;
}) {
  const snapshot = useRoom((s) => s.snapshot);
  const messages = useRoom((s) => s.chat);
  const unread = useRoom((s) => s.unread);
  const open = useGameChat((s) => s.open);
  const [shown, setShown] = useState<ChatMessage[]>([]);
  const lastId = useRef<number | null>(null);
  const timers = useRef(new Map<number, number>());
  const closedCb = useRef(onClosed);
  closedCb.current = onClosed;
  const wasLocked = useRef(false);

  const setOpen = (v: boolean) => {
    if (useGameChat.getState().open === v) return;
    useGameChat.setState({ open: v });
    if (v) {
      // o mouse volta a aparecer para poder clicar e digitar (e lembra se estava preso, para prender de novo ao fechar)
      wasLocked.current = !!document.pointerLockElement;
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      // o Esc que fechou o chat ainda está sendo tratado pelo navegador (que solta o mouse preso): prender no mesmo instante
      // faria o jogo achar que a pessoa soltou de propósito e abrir o menu. Espera o Esc passar.
      const was = wasLocked.current;
      wasLocked.current = false;
      window.setTimeout(() => {
        if (!useGameChat.getState().open) closedCb.current?.(was);
      }, 250);
    }
  };

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

  // T abre e fecha (Enter também abre); Esc fecha; Enter com o campo vazio fecha (sem abrir o menu do jogo junto)
  useEffect(() => {
    if (
      !enabled &&
      !(import.meta.env.DEV && (window as unknown as { __gameChatDemo?: boolean }).__gameChatDemo)
    )
      return undefined;
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const input = e.target instanceof HTMLInputElement ? e.target : null;
      const typing = !!input || (e.target instanceof HTMLElement && !!e.target.closest('textarea'));
      const isOpen = useGameChat.getState().open;
      const menuOpen = !!document.querySelector('.gm-wrap');
      if (e.code === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
      } else if (e.code === 'Enter' && isOpen && input && input.value.trim() === '') {
        e.preventDefault();
        setOpen(false);
      } else if (!typing && !menuOpen && !e.repeat && (e.code === 'KeyT' || e.code === 'Enter')) {
        if (e.code === 'Enter' && isOpen) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [enabled]);

  const demo =
    import.meta.env.DEV && !!(window as unknown as { __gameChatDemo?: boolean }).__gameChatDemo;
  if (!(enabled || demo) || !snapshot || !snapshot.chat.open) return null;
  const latest = shown[shown.length - 1];
  return (
    <>
      <div className="gc" data-testid="game-chat">
        <button
          type="button"
          className={`gc-btn${unread > 0 && !open ? ' new' : ''}${open ? ' is-open' : ''}`}
          aria-label={unread ? `Chat, ${unread} mensagens novas` : 'Chat'}
          aria-expanded={open}
          data-testid="game-chat-btn"
          onClick={() => setOpen(!open)}
        >
          <IcChat size={26} />
          {unread > 0 && !open && (
            <b className="gc-count mono" data-testid="game-chat-count">
              {count(unread)}
            </b>
          )}
          <kbd className="gc-key gc-hide-touch">T</kbd>
        </button>
        {!open && shown.length > 0 && (
          <ul className="gc-toasts" aria-live="polite">
            {shown.map((m) => (
              <li key={m.id} className={`gc-toast${m === latest ? ' is-latest' : ''}`}>
                <i
                  className="gc-dot"
                  style={{ background: chatColor(snapshot, m.userId) ?? '#fff' }}
                  aria-hidden="true"
                />
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
            <span className="gc-title">
              <IcChat size={20} />
              <h2>Chat da sala</h2>
            </span>
            <button
              type="button"
              className="gc-x"
              aria-label="Fechar o chat"
              data-sfx="back"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <kbd className="gc-key gc-hide-touch">Esc</kbd>
            </button>
          </div>
          <ChatPanel snapshot={snapshot} autoFocus colorOf={(id) => chatColor(snapshot, id)} />
        </div>
      )}
    </>
  );
}
