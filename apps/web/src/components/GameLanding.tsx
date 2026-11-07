import { useEffect, type ReactNode } from 'react';
import { MuteButton } from '@/components/MuteButton';
import './game-landing.css';

/** Tema de cada jogo do Fox Cap! na tela do jogo (spec 058, seção 10). Só cores e textos: a estrutura é a mesma. */
export const GAME_LANDING = {
  atravessa: { name: 'Atravessa!', tag: 'Infinito', a: '#ff5a4d', b: '#7a1d2e', sym: 'A', friends: false },
  bola: { name: 'Fut Fox', tag: 'Futebol de raposas', a: '#38d27a', b: '#0f5a3a', sym: 'F', friends: true },
  pingpong: { name: 'Ping Fox!', tag: 'Pingue-pongue 1x1', a: '#4a8dff', b: '#16347a', sym: 'P', friends: true },
  desmorona: { name: 'Desmorona!', tag: 'O chão some', a: '#ff9d2e', b: '#7a3a0b', sym: 'D', friends: true },
} as const;
export type LandingGame = keyof typeof GAME_LANDING;

/**
 * Tela própria do jogo (no padrão do Counter Fox): cores e símbolo do jogo, Jogar offline, Com amigos, Como jogar,
 * Configurações (som) e Sair. Animação só em transform/opacity e desligada com prefers-reduced-motion.
 */
export function GameLanding({
  game,
  extra,
  onOffline,
  onFriends,
  onHelp,
  onExit,
}: {
  game: LandingGame;
  /** Conteúdo a mais do jogo (por exemplo recorde). */
  extra?: ReactNode;
  onOffline: () => void;
  onFriends: () => void;
  onHelp: () => void;
  onExit: () => void;
}) {
  const t = GAME_LANDING[game];
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.code === 'Escape' && onExit();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onExit]);
  return (
    <main
      className="gl"
      data-testid={`gl-${game}`}
      style={{ ['--gl-a' as string]: t.a, ['--gl-b' as string]: t.b }}
    >
      <div className="gl-bg" aria-hidden="true">
        <i /> <i /> <i />
      </div>
      <div className="gl-wrap">
        <div className="gl-logo">
          <span className="gl-sym" aria-hidden="true">{t.sym}</span>
          <h1>{t.name}</h1>
          <p>{t.tag}</p>
        </div>
        <nav className="gl-menu" aria-label={`Menu do ${t.name}`}>
          <button type="button" className="gl-btn main" onClick={onOffline} data-sfx="start" data-testid="gl-offline">
            <b>Jogar offline</b>
            <span>contra bots, no seu aparelho</span>
          </button>
          {t.friends && (
            <button type="button" className="gl-btn" onClick={onFriends} data-sfx="start" data-testid="gl-friends">
              <b>Jogar com amigos</b>
              <span>criar sala e convidar</span>
            </button>
          )}
          <button type="button" className="gl-btn" onClick={onHelp} data-sfx="select" data-testid="gl-help">
            <b>Como jogar</b>
            <span>regras e controles</span>
          </button>
          <div className="gl-set" data-testid="gl-settings">
            <b>Configurações</b>
            <span>Som do jogo</span>
            <MuteButton />
          </div>
          {extra}
          <button type="button" className="gl-btn danger" onClick={onExit} data-sfx="back" data-testid="gl-exit">
            <b>Sair do {t.name}</b>
          </button>
        </nav>
      </div>
    </main>
  );
}
