import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Backdrop, Emblem, type ThemeGame } from '@/components/GameLandingArt';
import { Backdrop as WordsBackdrop, Emblem as WordsEmblem, type WordsGame } from '@/games/words/landing/WordsLandingArt';
import { WORDS_LANDING } from '@/games/words/landing/WordsLanding';
import '@/games/words/landing/words-landing.css';
import type { RoomSnapshot } from '@/lib/rooms';
import { useRoom } from '@/lib/rooms';
import { bolaHint } from './bola-hint';
import { ChatPanel } from '@/components/Chat';
import { chatColor } from '@/components/GameChat';
import { GAME_LANDING, type LandingGame } from '@/components/GameLanding';
import { GamePicker } from './GamePicker';
import { MIN_PLAYERS, rulesSummary } from './rules';
import './lobby.css';

export type LobbyTab = 'members' | 'rules' | 'invite' | 'chat' | 'games';

/** A aba aberta de cada sala: na sala do Fox Cap! trocar de jogo troca a tela do lobby, e a aba tem que ficar onde estava. */
export const tabMemo = new Map<string, string>();
/** O Counter Fox usa outros nomes de aba: este mapa deixa a mesma aba aberta ao trocar de jogo. */
export const CF_TO_SHELL: Record<string, LobbyTab> = { sala: 'members', jogadores: 'members', modo: 'rules', convidar: 'invite', chat: 'chat', jogos: 'games' };
export const SHELL_TO_CF: Record<LobbyTab, string> = { members: 'jogadores', rules: 'modo', invite: 'convidar', chat: 'chat', games: 'jogos' };

/** Uma linha só com o que falta para começar. */
export function startHint(snapshot: RoomSnapshot): { text: string; ok: boolean } {
  if (snapshot.game === 'foxcap') return { text: 'Escolha o jogo para começar', ok: false };
  if (snapshot.game === 'bola') return bolaHint(snapshot);
  const connected = snapshot.members.filter((m) => m.connected);
  const needed = MIN_PLAYERS[snapshot.game];
  if (connected.length < needed) {
    const n = needed - connected.length;
    return {
      text: `Falta${n > 1 ? 'm' : ''} ${n} pessoa${n > 1 ? 's' : ''} para começar`,
      ok: false,
    };
  }
  const waiting = connected.filter((m) => !m.isHost && !m.ready && !m.committed).length;
  if (waiting > 0)
    return { text: `Falta${waiting > 1 ? 'm' : ''} ${waiting} marcar "pronto"`, ok: false };
  return { text: 'Todo mundo pronto', ok: true };
}

/**
 * A moldura do lobby (spec 045, segunda versão): uma barra com o código e o estado, três abas (Jogadores, Regras,
 * Convidar), cada uma só com o seu assunto, e uma barra de ação fixa embaixo com UMA ação principal. No computador a
 * aba Jogadores fica sempre à esquerda e Regras e Convidar dividem o painel da direita.
 */
export function LobbyShell({
  snapshot,
  me,
  members,
  rules,
  invite,
  footer,
}: {
  snapshot: RoomSnapshot;
  me: string | undefined;
  members: (goInvite: () => void) => ReactNode;
  rules: ReactNode;
  invite: ReactNode;
  footer: ReactNode;
}) {
  const message = useRoom((s) => s.message);
  const [tabRaw, setTabState] = useState<LobbyTab>(() => {
    const m = tabMemo.get(snapshot.code);
    return m && m in SHELL_TO_CF ? (m as LobbyTab) : (m ? CF_TO_SHELL[m] : undefined) ?? 'members';
  });
  const setTab = (t: LobbyTab) => {
    tabMemo.set(snapshot.code, t);
    setTabState(t);
  };
  const uid = useId();
  const hint = startHint(snapshot);
  const wordsTheme = WORDS_ROOM[snapshot.game] ? WORDS_LANDING[WORDS_ROOM[snapshot.game]!] : undefined;
  const theme = GAME_LANDING[snapshot.game as LandingGame] ?? wordsTheme;
  const noGame = snapshot.flex && snapshot.game === 'foxcap';
  // sem jogo não existe a aba Configurar: cai em Jogadores
  const tab: LobbyTab = noGame && tabRaw === 'rules' ? 'members' : tabRaw;
  const meIsLeader = snapshot.hostId === me;
  const tabs: { id: LobbyTab; label: string; count?: string }[] = [
    {
      id: 'members',
      label: 'Jogadores',
      count: `${snapshot.members.length}/${snapshot.maxPlayers}`,
    },
    // sem jogo escolhido não há o que configurar: a aba é só a lista de jogos
    ...(noGame ? [] : [{ id: 'rules' as LobbyTab, label: snapshot.flex ? 'Configurar' : 'Regras' }]),
    { id: 'invite', label: 'Convidar' },
    { id: 'chat', label: 'Chat' },
    ...(snapshot.flex ? [{ id: 'games' as LobbyTab, label: noGame ? 'Jogos' : 'Outros jogos' }] : []),
  ];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight'
        ? tabs[(i + 1) % tabs.length]
        : e.key === 'ArrowLeft'
          ? tabs[(i + tabs.length - 1) % tabs.length]
          : null;
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    document.getElementById(`${uid}-tab-${next.id}`)?.focus();
  };

  const content = (
    <section
      className="screen rm lb3"
      data-tab={tab}
      data-game={snapshot.game}
      // a sala toma as cores do jogo escolhido (e muda quando o líder troca de jogo)
      style={theme ? ({ ['--gl-a' as string]: theme.a, ['--gl-b' as string]: theme.b } as React.CSSProperties) : undefined}
    >
      <header className="lb3-bar">
        <div className="lb3-bar-code">
          <span className="mono">SALA</span>
          <b>{snapshot.code}</b>
        </div>
        <div className="lb3-bar-info">
          <span className="lb3-bar-rules mono">{rulesSummary(snapshot)}</span>
          <span className={`lb3-bar-hint mono${hint.ok ? ' ok' : ''}`}>{hint.text}</span>
        </div>
        <span className="lb3-role mono">{meIsLeader ? 'Você é o líder' : 'Convidado'}</span>
      </header>

      <div className="lb3-tabs" role="tablist" aria-label="Seções da sala" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            type="button"
            role="tab"
            data-sfx="tab"
            data-tab={t.id}
            aria-selected={tab === t.id || (tab === 'members' && t.id === 'rules' && false)}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count && <small className="mono">{t.count}</small>}
          </button>
        ))}
      </div>

      <div className="lb3-body">
        <div
          id={`${uid}-panel-members`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-members`}
          className={`lb3-pane pane-members${tab === 'members' ? ' on' : ''}`}
        >
          {members(() => setTab('invite'))}
        </div>
        <div className="lb3-side">
          {!noGame && (
            <div
              id={`${uid}-panel-rules`}
              role="tabpanel"
              aria-labelledby={`${uid}-tab-rules`}
              className={`lb3-pane pane-rules${tab === 'rules' ? ' on' : ''}`}
            >
              <h2 className="lb3-h">{snapshot.flex ? 'Configurar' : 'Regras'}</h2>
              {rules}
            </div>
          )}
          <div
            id={`${uid}-panel-invite`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-invite`}
            className={`lb3-pane pane-invite${tab === 'invite' ? ' on' : ''}`}
          >
            <h2 className="lb3-h">Convidar</h2>
            {invite}
          </div>
          {snapshot.flex && (
            <div
              id={`${uid}-panel-games`}
              role="tabpanel"
              aria-labelledby={`${uid}-tab-games`}
              className={`lb3-pane pane-games${tab === 'games' ? ' on' : ''}`}
            >
              <h2 className="lb3-h">{noGame ? 'Escolha o jogo' : 'Outros jogos'}</h2>
              <GamePicker snapshot={snapshot} me={me} />
            </div>
          )}
          <div
            id={`${uid}-panel-chat`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-chat`}
            className={`lb3-pane pane-chat${tab === 'chat' ? ' on' : ''}`}
          >
            <h2 className="lb3-h">Chat</h2>
            {(tab === 'chat' || (typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches)) && (
              <ChatPanel snapshot={snapshot} colorOf={(id) => chatColor(snapshot, id)} />
            )}
          </div>
        </div>
      </div>

      {message && (
        <p className="acc-failure mono" role="alert">
          {message}
        </p>
      )}

      <div className="lb3-foot">{footer}</div>
    </section>
  );
  // a moldura temática (cenário, símbolo, fontes) é só dos jogos do Fox Cap!; Já Deu, Blocks, Mesmíssima, Echo etc. mantêm a sala deles
  if (!FOX_CAP_GAMES.includes(snapshot.game) && !snapshot.flex && !wordsTheme) return content;
  return createPortal(
    wordsTheme ? (
      <LobbyFrame game={WORDS_ROOM[snapshot.game]!}>{content}</LobbyFrame>
    ) : (
      <LobbyFrame game={(snapshot.game in GAME_LANDING ? snapshot.game : 'foxcap') as ThemeGame}>{content}</LobbyFrame>
    ),
    document.body,
  );
}

/** Jogos de rodadas com sala (spec 068): a sala usa o cenário e o símbolo do hub do jogo. */
const WORDS_ROOM: Record<string, WordsGame | undefined> = { color: 'color', impostor: 'color', time: 'time', eco: 'eco' };

/** Jogos que pertencem ao Fox Cap! (e a sala sem jogo escolhido). */
const FOX_CAP_GAMES: string[] = ['foxcap', 'atravessa', 'desmorona', 'bola', 'pingpong', 'foxshot'];

const FC_THEME = { line1: 'FOX', line2: 'CAP!', a: '#ffb347', b: '#3a1f45' };
const FONTS = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';

/**
 * Moldura temática da sala (spec 058): tela cheia com o cenário e o símbolo do jogo escolhido (ou do Fox Cap! sem jogo),
 * no mesmo desenho do lobby do Counter Fox. A página de trás não rola; só esta moldura, e só se precisar.
 */
function LobbyFrame({ game, children }: { game: ThemeGame | WordsGame; children: ReactNode }) {
  const words = game === 'color' || game === 'time' || game === 'eco';
  const t = words ? WORDS_LANDING[game] : game === 'foxcap' ? FC_THEME : GAME_LANDING[game as LandingGame];
  useEffect(() => {
    if (!document.querySelector('link[data-cfh-fonts]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = FONTS;
      l.setAttribute('data-cfh-fonts', '1');
      document.head.appendChild(l);
    }
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev[0] ?? '';
      document.body.style.overflow = prev[1] ?? '';
    };
  }, []);
  return (
    <div className="gll" data-game={game} data-words={words ? '1' : undefined} data-testid="themed-lobby" style={{ ['--gl-a' as string]: t.a, ['--gl-b' as string]: t.b }}>
      {words ? <WordsBackdrop game={game} /> : <Backdrop game={game as ThemeGame} />}
      <div className="gll-wrap">
        <header className="gll-head">
          {words ? <WordsEmblem game={game} /> : <Emblem game={game as ThemeGame} />}
          <h1>
            <span>{t.line1}</span>
            <b>{t.line2}</b>
          </h1>
        </header>
        {children}
      </div>
    </div>
  );
}
