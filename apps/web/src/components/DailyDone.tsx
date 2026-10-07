import { Link } from '@tanstack/react-router';
import { dailyMax, streakLabel, type DailyInfo, type GameId } from '@/lib/stats';
import './game-ui.css';

/** Quem já jogou o Daily de hoje vê a nota e volta amanhã: é uma partida por dia, por jogo. */
export function DailyDone({ game, info }: { game: GameId; info: DailyInfo }) {
  return (
    <section className="dd" aria-label="Daily de hoje feito">
      <div className="mono dd-label">DAILY DE HOJE FEITO</div>
      <div className="dd-score">
        {((info.totalScore ?? 0) / 10).toFixed(1)}
        <small className="mono">/{dailyMax(game)}</small>
      </div>
      <p className="dd-text">
        Cada jogo tem um Daily por dia. Volte amanhã
        {info.current > 0 ? ` e chegue a ${streakLabel(info.current + 1)} seguidos` : ''}.
      </p>
      <Link to="/daily" className="btn ghost">
        Ver ranking do Daily
      </Link>
    </section>
  );
}
