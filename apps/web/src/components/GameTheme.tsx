import { useEffect } from 'react';
import { Backdrop, type WordsGame } from '@/games/words/landing/WordsLandingArt';
import '@/games/words/landing/words-landing.css';
import './game-theme.css';

type HubGame = Extract<WordsGame, 'color' | 'time' | 'eco'>;

/**
 * A partida com o tema do hub do jogo (spec 068): cenário suave atrás e o detalhe de cor nos cabeçalhos. Durante a partida o
 * cenário fica parado (`still`), para não distrair nem marcar ritmo; nos resultados ele volta a se mexer.
 */
export function GameTheme({ game, still = false }: { game: HubGame; still?: boolean }) {
  useEffect(() => {
    document.body.dataset.hub = game;
    return () => {
      delete document.body.dataset.hub;
    };
  }, [game]);
  return (
    <div className={`wd-bg gt-bg wl-${game}${still ? ' still' : ''}`} aria-hidden="true">
      <Backdrop game={game} />
    </div>
  );
}
