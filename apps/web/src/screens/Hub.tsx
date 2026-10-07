import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { ThemeButton } from '@/components/ThemeButton';
import { useAuth } from '@/lib/auth';
import { modeLabel } from '@/lib/history';
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

/** Recorde do jogo: a melhor nota em relação ao máximo do modo, de qualquer modo (inclui o rápido). */
function bestLabel(stats: Stats | undefined, game: GameId): string {
  if (!stats) return 'ENTRE PARA JOGAR';
  let top: { mode: string; best: number; max: number } | null = null;
  for (const m of gameModes(stats, game)) {
    const max = modeMax(game, m.mode);
    if (!max || m.best <= 0) continue;
    if (!top || m.best / 10 / max > top.best / 10 / top.max)
      top = { mode: m.mode, best: m.best, max };
  }
  if (!top) return 'SEM RECORDE AINDA';
  return `RECORDE ${(top.best / 10).toFixed(1)}/${top.max} · ${modeLabel(top.mode).toUpperCase()}`;
}

/** Situação do Daily do jogo hoje, em palavras: jogado (com a nota) ou ainda disponível. */
function dailyStatus(stats: Stats | undefined, game: GameId): string {
  const info = stats?.daily[game];
  if (!info) return 'DAILY DISPONÍVEL';
  return info.playedToday
    ? `DAILY FEITO · ${((info.totalScore ?? 0) / 10).toFixed(1)}/${dailyMax(game)}`
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
        O que vai
        <br />
        ser hoje?
      </h1>

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
            <div className="mono hub-card-meta">{dailyStatus(data, 'color')}</div>
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
            <div className="mono hub-card-meta">{dailyStatus(data, 'time')}</div>
          </div>
        </Link>

        <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
      </div>
    </main>
  );
}
