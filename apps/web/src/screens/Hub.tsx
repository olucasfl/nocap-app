import { Link } from '@tanstack/react-router';
import { dailyDate } from '@nocap/games';
import { MuteButton } from '@/components/MuteButton';
import { ThemeButton } from '@/components/ThemeButton';
import { User } from '@/components/icons';
import { getBest } from '@/lib/records';
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
          <div className="hub-daily-text">A Cor de hoje te espera</div>
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

        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
