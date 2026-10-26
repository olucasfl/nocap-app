import { useApertaAllowed } from '@/lib/aperta-access';
import { ApertaArt, FoxCapArt, BlocksArt, ColorArt, EcoArt, TimeArt } from '@/components/HubArt';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { WordsHubArt } from '@/games/words/words-art';
import { useQuery } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { ThemeButton } from '@/components/ThemeButton';
import { useAuth } from '@/lib/auth';
import {
  bestTenths,
  fetchStats,
  formatBest,
  streakLabel,
  type GameId,
  type Stats,
} from '@/lib/stats';
import './hub.css';

/** Recorde do modo Clássico do jogo (os outros modos mostram o recorde na ficha de cada um). */
function bestLabel(stats: Stats | undefined, game: GameId): string | null {
  if (!stats) return null;
  const best = bestTenths(stats, game, 'classic');
  if (best <= 0) return 'SEM RECORDE NO CLÁSSICO';
  return `RECORDE CLÁSSICO ${formatBest(game, 'classic', best)}`;
}

/** O recorde do Atravessa!: o da conta (sem conta não há recorde). */
function atravessaBestLabel(stats: Stats | undefined): string | null {
  if (!stats) return null;
  const rows = Math.floor(bestTenths(stats, 'atravessa', 'infinito') / 10);
  return rows > 0 ? `RECORDE ${rows} LINHAS` : 'SEM RECORDE AINDA';
}

/** O recorde do Block's: o da conta (sem conta não há recorde). */
function blocksBestLabel(stats: Stats | undefined): string | null {
  if (!stats) return null;
  const points = Math.floor(bestTenths(stats, 'blocks', 'classic') / 10);
  return points > 0 ? `RECORDE ${points} PTS` : 'SEM RECORDE AINDA';
}

/** Os Dailys de hoje: o que cada jogo mostra no chip. */
const DAILIES = [
  { game: 'color', name: 'Mesmíssima', to: '/cor' },
  { game: 'time', name: 'Já Deu?', to: '/tempo' },
  { game: 'eco', name: 'Ecooo', to: '/eco' },
  { game: 'wclassic', name: "Word's", to: '/words/classic' },
] as const;

function DailyChip({
  game,
  name,
  to,
  stats,
  loading,
}: {
  game: GameId;
  name: string;
  to: string;
  stats: Stats | undefined;
  loading: boolean;
}) {
  const done = !!stats?.daily[game]?.playedToday;
  const state = loading ? 'loading' : !stats ? 'plain' : done ? 'done' : 'todo';
  return (
    <Link
      to={to as '/'}
      search={game === 'wclassic' ? undefined : ({ modo: 'daily' } as never)}
      className={`hz-pill ${state}`}
      data-sfx="start"
      data-testid={`daily-${game}`}
      aria-label={`Daily de ${name}${done ? ', feito hoje' : ''}`}
    >
      <span className="hz-pill-dot" aria-hidden="true">
        {done && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      {name}
    </Link>
  );
}

/** Um cartão de jogo (a capa). `wide` ocupa a linha inteira, com a capa ao lado do texto. */
function GameCard({
  to,
  cls,
  art,
  name,
  size,
  lines,
  wide = false,
  badge,
  loading = false,
}: {
  to: string;
  cls: string;
  art: ReactNode;
  name: string;
  size?: 'mid' | 'long';
  lines: (string | null)[];
  wide?: boolean;
  badge?: string;
  /** A conta ainda carrega: no lugar do recorde vai uma barrinha apagada. */
  loading?: boolean;
}) {
  return (
    <Link
      to={to as '/'}
      className={`hub-card ${cls}${wide ? ' wide' : ''}`}
      data-sfx="start"
      data-testid={`card-${cls.replace('hub-card-', '')}`}
    >
      {badge && <span className="hz-badge mono">{badge}</span>}
      <div className="hub-art">{art}</div>
      <div className="hub-card-foot">
        <div className={`hub-card-name${size ? ` ${size}` : ''}`}>{name}</div>
        {loading ? (
          <div className="hub-card-meta skel" aria-hidden="true" />
        ) : (
          lines
            .filter((l): l is string => !!l)
            .map((l) => (
              <div key={l} className="mono hub-card-meta">
                {l}
              </div>
            ))
        )}
      </div>
    </Link>
  );
}

export function Hub() {
  const user = useAuth((s) => s.user);
  const apertaOk = useApertaAllowed();
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: !!user,
    retry: false,
  });
  const authStatus = useAuth((s) => s.status);
  const data = user ? stats.data : undefined;
  // a conta (e os números dela) ainda carregando: mostra um carregando, nunca "só com conta"
  const loading = authStatus === 'loading' || (!!user && stats.isPending);
  const streak = data?.visit.current ?? 0;
  const rawName = user?.name?.trim().split(/\s+/)[0] || user?.username || '';
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : '';

  return (
    <main className="hub hz">
      <header className="top">
        <div className="logo hub-logo">
          no cap<span>!</span>
        </div>
        <div className="top-actions">
          <ThemeButton />
          <MuteButton />
        </div>
      </header>

      <RoomBanner />

      <section className="hz-hello" aria-label="Resumo">
        <div>
          <h1>{firstName ? `Olá, ${firstName}!` : 'Bora jogar?'}</h1>
          {!user && authStatus === 'ready' && (
            <p className="mono">ENTRE PARA GUARDAR RECORDES E DAILYS</p>
          )}
        </div>
        {streak > 0 && (
          <span className="hz-streak mono" title="Dias seguidos entrando no NoCap">
            <b>{streak}</b> {streakLabel(streak).replace(/^\d+ /, '').toUpperCase()} SEGUIDOS
          </span>
        )}
      </section>

      <section className="hz-sec hz-daily" aria-label="Dailys de hoje">
        <h2 className="hz-h">
          Dailys <small className="mono">1 POR JOGO, POR DIA</small>
        </h2>
        <div className="hz-pills">
          {DAILIES.map((d) => (
            <DailyChip
              key={d.game}
              game={d.game}
              name={d.name}
              to={d.to}
              stats={data}
              loading={loading}
            />
          ))}
        </div>
      </section>

      <section className="hz-sec" aria-label="Palavras">
        <h2 className="hz-h">
          Palavras <small className="mono">CLASSIC, CONNECT E BEE</small>
        </h2>
        <div className="hz-grid one">
          <GameCard
            to="/words"
            cls="hub-card-words"
            art={<WordsHubArt />}
            name="Word's"
            lines={['JOGOS DE PALAVRAS', 'DAILY COM RANKING E CENTENAS DE FASES']}
            wide
          />
        </div>
      </section>

      <section className="hz-sec" aria-label="Arcade">
        <h2 className="hz-h">
          Arcade <small className="mono">BATA SEU RECORDE</small>
        </h2>
        <div className="hz-grid">
          <GameCard
            to="/blocks"
            cls="hub-card-blocks"
            art={<BlocksArt />}
            name="Block's"
            lines={[blocksBestLabel(data)]}
            loading={loading}
          />
          <GameCard
            to="/fox-cap"
            cls="hub-card-atravessa"
            art={<FoxCapArt />}
            name="Fox Cap!"
            size="long"
            lines={[atravessaBestLabel(data)]}
            loading={loading}
            badge="NOVO"
          />
          {/* Em teste: o cartão só aparece para a conta liberada pelo servidor (visitante e outras contas não veem). */}
          {apertaOk === true && (
            <GameCard
              to="/arcade/aperta"
              cls="hub-card-aperta"
              art={<ApertaArt />}
              name="Aperta!"
              lines={['CLICKER NO ESPAÇO']}
            />
          )}
        </div>
      </section>

      <section className="hz-sec" aria-label="Reflexo e precisão">
        <h2 className="hz-h">
          Reflexo e precisão <small className="mono">COR, TEMPO E RITMO</small>
        </h2>
        <div className="hz-grid">
          <GameCard
            to="/cor"
            cls="hub-card-color"
            art={<ColorArt />}
            name="Mesmíssima"
            size="long"
            lines={[bestLabel(data, 'color')]}
            loading={loading}
          />
          <GameCard
            to="/tempo"
            cls="hub-card-time"
            art={<TimeArt />}
            name="Já Deu?"
            size="mid"
            lines={[bestLabel(data, 'time')]}
            loading={loading}
          />
          <GameCard
            to="/eco"
            cls="hub-card-eco"
            art={<EcoArt />}
            name="Ecooo"
            lines={[bestLabel(data, 'eco')]}
            loading={loading}
          />
        </div>
      </section>

      <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
    </main>
  );
}
