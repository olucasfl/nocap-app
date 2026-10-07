import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatedText } from '@/components/AnimatedText';
import { MuteButton } from '@/components/MuteButton';
import { ThemeButton } from '@/components/ThemeButton';
import { useAuth } from '@/lib/auth';
import {
  bestTenths,
  dailyScoreText,
  fetchStats,
  formatBest,
  type GameId,
  type Stats,
} from '@/lib/stats';
import './hub.css';

const SWATCHES = [
  'var(--yellow)',
  'var(--blue)',
  'var(--paper)',
  'var(--ink)',
  'var(--pink)',
  'var(--green)',
];

/** Recorde do modo Clássico do jogo (os outros modos mostram o recorde na ficha de cada um). */
function bestLabel(stats: Stats | undefined, game: GameId): string {
  if (!stats) return 'ENTRE PARA JOGAR';
  const best = bestTenths(stats, game, 'classic');
  if (best <= 0) return 'SEM RECORDE NO CLÁSSICO';
  return `RECORDE CLÁSSICO ${formatBest(game, 'classic', best)}`;
}

/** Situação do Daily do jogo hoje, em palavras: jogado (com a nota) ou ainda disponível. */
function dailyStatus(stats: Stats | undefined, game: GameId): string {
  const info = stats?.daily[game];
  if (!info) return 'DAILY DISPONÍVEL';
  return info.playedToday
    ? `DAILY FEITO · ${dailyScoreText(game, info.totalScore ?? 0)}`
    : 'DAILY DISPONÍVEL';
}

export function Hub() {
  const user = useAuth((s) => s.user);
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: !!user,
    retry: false,
  });
  const data = user ? stats.data : undefined;

  return (
    <main className="hub">
      <header className="top">
        <div className="logo hub-logo">
          no cap<span>!</span>
        </div>
        <div className="top-actions">
          <ThemeButton />
          <MuteButton />
        </div>
      </header>

      <h1 className="hub-title">
        <AnimatedText lines={['O que vai', 'ser hoje?']} />
      </h1>

      <div className="hub-grid">
        <Link to="/cor" className="hub-card hub-card-color" data-sfx="start">
          <div className="hub-swatches" aria-hidden="true">
            {SWATCHES.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name long">Mesmíssima</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'color')}</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'color')}</div>
          </div>
        </Link>

        <Link to="/tempo" className="hub-card hub-card-time" data-sfx="start">
          <div className="hub-clock" aria-hidden="true">
            <i className="hub-clock-hand" />
            <i className="hub-clock-hand2" />
            <i className="hub-clock-dot" />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name mid">Já Deu?</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'time')}</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'time')}</div>
          </div>
        </Link>

        <Link to="/eco" className="hub-card hub-card-eco" data-sfx="start">
          <div className="hub-pads" aria-hidden="true">
            <i style={{ background: 'var(--orange)' }} />
            <i style={{ background: 'var(--blue)' }} />
            <i style={{ background: 'var(--yellow)' }} />
            <i style={{ background: 'var(--eco-purple)' }} />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Ecooo</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'eco')}</div>
            <div className="mono hub-card-meta">{dailyStatus(data, 'eco')}</div>
          </div>
        </Link>

        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
