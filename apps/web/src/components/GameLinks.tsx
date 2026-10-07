import { Link } from '@tanstack/react-router';
import type { GameId } from '@/lib/stats';
import './game-ui.css';

/** Dentro de cada jogo: criar sala com amigos e ver o ranking daquele jogo. */
export function GameLinks({ game }: { game: GameId }) {
  return (
    <nav className="gl" aria-label="Mais do jogo">
      <Link to="/sala" search={{ jogo: game }} className="gl-btn">
        <span className="gl-title">Sala com amigos</span>
        <span className="mono gl-sub">CRIAR OU ENTRAR</span>
      </Link>
      <Link to={game === 'color' ? '/cor/ranking' : '/tempo/ranking'} className="gl-btn">
        <span className="gl-title">Ranking</span>
        <span className="mono gl-sub">DESTE JOGO</span>
      </Link>
    </nav>
  );
}
