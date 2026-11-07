import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MuteButton } from '@/components/MuteButton';
import { Backdrop, Emblem, Showcase, type LandingGame } from './GameLandingArt';
import './game-landing.css';

export type { LandingGame };

/** Tema de cada jogo do Fox Cap! (cores, nome em duas linhas e frase). Spec 058, seção 10. */
export const GAME_LANDING: Record<LandingGame, { name: string; line1: string; line2: string; tag: string; a: string; b: string; sym: string; friends: boolean }> = {
  atravessa: { name: 'Atravessa!', line1: 'ATRAVESSA!', line2: 'INFINITO', tag: 'ATRAVESSE TUDO, SEM PARAR', a: '#ff5a4d', b: '#7a1d2e', sym: 'A', friends: true },
  bola: { name: 'Fut Fox', line1: 'FUT', line2: 'FOX', tag: 'FUTEBOL DAS RAPOSAS', a: '#38d27a', b: '#0f5a3a', sym: 'F', friends: true },
  pingpong: { name: 'Ping Fox!', line1: 'PING', line2: 'FOX!', tag: 'PINGUE-PONGUE 1 CONTRA 1', a: '#4a8dff', b: '#16347a', sym: 'P', friends: true },
  desmorona: { name: 'Desmorona!', line1: 'DESMORONA!', line2: 'O CHÃO SOME', tag: 'VENCE O ÚLTIMO DE PÉ', a: '#ff9d2e', b: '#7a3a0b', sym: 'D', friends: true },
};

const FONTS = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Saira+Stencil+One&display=swap';

export interface LandingRoom {
  busy: boolean;
  error: string | null;
  create: () => void;
  join: (code: string) => void;
  clearError: () => void;
}

type Screen = 'main' | 'friends' | 'settings';

/**
 * Tela própria de cada jogo do Fox Cap!, no desenho do menu do Counter Fox: botões à esquerda, cenário temático ao fundo e um
 * quadro do jogo à direita. "Jogar com amigos" abre a sala aqui dentro (criar ou entrar com código), sem sair da tela do jogo.
 * Sem barras de rolagem: a página de trás fica travada e só a coluna de botões rola em telas muito baixas.
 */
export function GameLanding({
  game,
  onOffline,
  onHelp,
  onExit,
  room,
}: {
  game: LandingGame;
  onOffline: () => void;
  onHelp: () => void;
  onExit: () => void;
  room: LandingRoom;
}) {
  const t = GAME_LANDING[game];
  const [screen, setScreen] = useState<Screen>('main');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (document.querySelector('link[data-cfh-fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    l.setAttribute('data-cfh-fonts', '1');
    document.head.appendChild(l);
  }, []);

  // a página de trás não rola enquanto a tela do jogo está aberta
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev[0] ?? '';
      body.style.overflow = prev[1] ?? '';
    };
  }, []);

  const back = () => {
    room.clearError();
    if (screen === 'main') onExit();
    else setScreen('main');
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      room.clearError();
      if (screen === 'main') onExit();
      else setScreen('main');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [screen, onExit, room]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    room.join(code);
  };

  return createPortal(
    <main className="gl" data-testid={`gl-${game}`} data-game={game} data-screen={screen} style={{ ['--gl-a' as string]: t.a, ['--gl-b' as string]: t.b }}>
      <Backdrop game={game} />
      <div className="gl-wrap">
        <div className="gl-left">
          <header className="gl-logo">
            <Emblem game={game} />
            <h1>
              <span>{t.line1}</span>
              <b>{t.line2}</b>
            </h1>
            <p>{t.tag}</p>
          </header>

          {screen === 'main' && (
            <nav className="gl-menu" aria-label={`Menu do ${t.name}`} data-testid="gl-main">
              <button type="button" className="gl-btn main" onClick={onOffline} data-sfx="start" data-testid="gl-offline">
                <b>Jogar offline</b>
                <span>contra bots, no seu aparelho</span>
              </button>
              <button type="button" className="gl-btn" onClick={() => setScreen('friends')} data-sfx="start" data-testid="gl-friends">
                <b>Jogar com amigos</b>
                <span>criar sala ou entrar com código</span>
              </button>
              <button type="button" className="gl-btn" onClick={onHelp} data-sfx="select" data-testid="gl-help">
                <b>Como jogar</b>
                <span>regras e controles</span>
              </button>
              <button type="button" className="gl-btn" onClick={() => setScreen('settings')} data-sfx="select" data-testid="gl-settings-btn">
                <b>Configurações</b>
                <span>som do jogo</span>
              </button>
              <div className="gl-gap" />
              <button type="button" className="gl-btn danger" onClick={onExit} data-sfx="back" data-testid="gl-exit">
                <b>Sair do {t.name}</b>
              </button>
            </nav>
          )}

          {screen === 'friends' && (
            <section className="gl-panel" data-testid="gl-friends-panel">
              <button type="button" className="gl-back" onClick={back} data-sfx="back" data-testid="gl-back">
                ‹ Voltar
              </button>
              <h2>Com amigos</h2>
              <p className="lead">Todo mundo na mesma sala, jogando {t.name}.</p>
              {room.error && (
                <p className="gl-err" role="alert" data-testid="gl-error">
                  {room.error}
                </p>
              )}
              <button type="button" className="gl-card" disabled={room.busy} onClick={room.create} data-sfx="start" data-testid="foxcap-friends">
                <b>{room.busy ? 'Criando...' : 'Criar sala'}</b>
                <span>Você é o líder: convida a galera e começa. Dá para trocar de jogo lá dentro.</span>
              </button>
              <form className="gl-card join" onSubmit={submit} noValidate>
                <b>Entrar com código</b>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    room.clearError();
                  }}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  placeholder="A B C D"
                  aria-label="Código da sala"
                  data-testid="gl-code"
                />
                <button type="submit" className="gl-enter" disabled={room.busy || code.trim().length < 4} data-sfx="start" data-testid="gl-join">
                  {room.busy ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </section>
          )}

          {screen === 'settings' && (
            <section className="gl-panel" data-testid="gl-settings">
              <button type="button" className="gl-back" onClick={back} data-sfx="back" data-testid="gl-back">
                ‹ Voltar
              </button>
              <h2>Configurações</h2>
              <div className="gl-row">
                <span>Som do jogo</span>
                <MuteButton />
              </div>
              <p className="lead">As opções de controle ficam no menu de pausa, durante a partida.</p>
            </section>
          )}
        </div>
        <aside className="gl-right">
          <Showcase game={game} />
        </aside>
      </div>
    </main>,
    document.body,
  );
}
