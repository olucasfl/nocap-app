import { Link } from '@tanstack/react-router';
import { dailyDate } from '@nocap/games';
import { MuteButton } from '@/components/MuteButton';
import { ThemeButton } from '@/components/ThemeButton';
import { User } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { getBest } from '@/lib/records';
import { fetchStats, streakLabel } from '@/lib/stats';
import './hub.css';

const SWATCHES = [
  'var(--yellow)',
  'var(--blue)',
  'var(--paper)',
  'var(--ink)',
  'var(--pink)',
  'var(--green)',
];

export function Hub() {
  const [, mm, dd] = dailyDate().split('-');
  const best = getBest('color');
  // Sem API ou sem partidas: o card segue sem a sequência.
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, retry: false });
  const streak = stats.data?.daily;

  return (
    <main className="hub">
      <header className="top">
        <div className="logo hub-logo">
          no cap<span>!</span>
        </div>
        <div className="top-actions">
          <ThemeButton />
          <MuteButton />
          <div className="chip hub-avatar" aria-label="Convidado">
            <User />
          </div>
        </div>
      </header>

      <h1 className="hub-title">
        O que vai
        <br />
        ser hoje?
      </h1>

      <div className="hub-daily">
        <div>
          <div className="mono hub-daily-label">
            DAILY · {dd}/{mm}
          </div>
          <div className="hub-daily-text">
            {streak?.playedToday ? 'Daily de hoje feito' : 'A Cor de hoje te espera'}
          </div>
          {streak && streak.current > 0 && (
            <div className="mono hub-daily-streak">
              SEQUÊNCIA {streakLabel(streak.current).toUpperCase()}
            </div>
          )}
        </div>
        <Link to="/cor" search={{ modo: 'daily' }} className="hub-daily-go">
          JOGAR
        </Link>
      </div>

      <div className="hub-grid">
        <Link to="/cor" className="hub-card hub-card-color">
          <div className="hub-swatches" aria-hidden="true">
            {SWATCHES.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Cor</div>
            <div className="mono hub-card-meta">
              {best === null ? 'SEM RECORDE AINDA' : `RECORDE ${best.toFixed(1)}/50`}
            </div>
          </div>
        </Link>

        <div className="hub-card hub-card-time" aria-disabled="true">
          <div className="hub-clock" aria-hidden="true">
            <i className="hub-clock-hand" />
            <i className="hub-clock-hand2" />
            <i className="hub-clock-dot" />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Tempo</div>
            <div className="mono hub-card-meta">EM BREVE</div>
          </div>
        </div>

        <Link to="/sala" className="hub-rank">
          JOGAR EM SALA COM AMIGOS
        </Link>
        <Link to="/ranking" className="hub-rank">
          VER RANKING
        </Link>
        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
