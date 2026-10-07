import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { dailyDate } from '@nocap/games';
import { MuteButton } from '@/components/MuteButton';
import { ThemeButton } from '@/components/ThemeButton';
import { User } from '@/components/icons';
import { useAuth } from '@/lib/auth';
import { dailyMax, fetchStats, gameModes, modeMax, type GameId, type Stats } from '@/lib/stats';
import './hub.css';

const SWATCHES = [
  'var(--yellow)',
  'var(--blue)',
  'var(--paper)',
  'var(--ink)',
  'var(--pink)',
  'var(--green)',
];

/** Melhor nota entre os modos de 5/3 rodadas do jogo (não mistura com o rápido de 10 pontos). */
function bestLabel(stats: Stats | undefined, game: GameId): string {
  if (!stats) return 'ENTRE PARA JOGAR';
  const best = gameModes(stats, game)
    .filter((m) => m.mode !== 'quick')
    .reduce((acc, m) => Math.max(acc, m.best), 0);
  if (best === 0) return 'SEM RECORDE AINDA';
  return `RECORDE ${(best / 10).toFixed(1)}/${modeMax(game, 'classic')}`;
}

function dailyStatus(stats: Stats | undefined, game: GameId): string {
  const info = stats?.daily[game];
  if (!info) return '—';
  return info.playedToday ? `${((info.totalScore ?? 0) / 10).toFixed(1)}/${dailyMax(game)}` : 'FALTA';
}

export function Hub() {
  const user = useAuth((s) => s.user);
  const [, mm, dd] = dailyDate().split('-');
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user, retry: false });
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
          <Link
            to="/perfil"
            className="chip hub-avatar"
            aria-label={user ? `Perfil de ${user.name}` : 'Entrar'}
          >
            <User />
          </Link>
        </div>
      </header>

      <h1 className="hub-title">
        O que vai
        <br />
        ser hoje?
      </h1>

      <Link to="/daily" className="hub-daily">
        <div>
          <div className="mono hub-daily-label">
            DAILY · {dd}/{mm}
          </div>
          <div className="hub-daily-text">Uma Cor e um Tempo por dia</div>
          <div className="mono hub-daily-streak">
            {user ? `COR ${dailyStatus(data, 'color')} · TEMPO ${dailyStatus(data, 'time')}` : 'ENTRE PARA JOGAR'}
          </div>
        </div>
        <span className="hub-daily-go">ABRIR</span>
      </Link>

      <div className="hub-grid">
        <Link to="/cor" className="hub-card hub-card-color">
          <div className="hub-swatches" aria-hidden="true">
            {SWATCHES.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Cor</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'color')}</div>
          </div>
        </Link>

        <Link to="/tempo" className="hub-card hub-card-time">
          <div className="hub-clock" aria-hidden="true">
            <i className="hub-clock-hand" />
            <i className="hub-clock-hand2" />
            <i className="hub-clock-dot" />
          </div>
          <div className="hub-card-foot">
            <div className="hub-card-name">Tempo</div>
            <div className="mono hub-card-meta">{bestLabel(data, 'time')}</div>
          </div>
        </Link>

        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
