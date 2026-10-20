import { AtravessaArt, BlocksArt, ColorArt, EcoArt, TimeArt } from '@/components/HubArt';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { WordsHubArt } from '@/games/words/words-art';
import { useQuery } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { RoomBanner } from '@/components/RoomBanner';
import { ThemeButton } from '@/components/ThemeButton';
import { classicProgress } from '@/games/words/classic-engine';
import { beeProgress, useProgress } from '@/games/words/levels/progress';
import { useAuth } from '@/lib/auth';
import {
  bestTenths,
  dailyScoreText,
  fetchStats,
  formatBest,
  streakLabel,
  type GameId,
  type Stats,
} from '@/lib/stats';
import './hub.css';

/** Recorde do modo Clássico do jogo (os outros modos mostram o recorde na ficha de cada um). */
function bestLabel(stats: Stats | undefined, game: GameId): string {
  if (!stats) return 'JOGUE SEM CONTA';
  const best = bestTenths(stats, game, 'classic');
  if (best <= 0) return 'SEM RECORDE NO CLÁSSICO';
  return `RECORDE CLÁSSICO ${formatBest(game, 'classic', best)}`;
}

/** O recorde do Atravessa!: o da conta (sem conta não há recorde). */
function atravessaBestLabel(stats: Stats | undefined): string {
  if (!stats) return 'JOGUE SEM CONTA';
  const rows = Math.floor(bestTenths(stats, 'atravessa', 'infinito') / 10);
  return rows > 0 ? `RECORDE ${rows} LINHAS` : 'SEM RECORDE AINDA';
}

/** O recorde do Block's: o da conta (sem conta não há recorde). */
function blocksBestLabel(stats: Stats | undefined): string {
  if (!stats) return 'JOGUE SEM CONTA';
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

function DailyChip({ game, name, to, stats }: { game: GameId; name: string; to: string; stats: Stats | undefined }) {
  const info = stats?.daily[game];
  const done = !!info?.playedToday;
  const result = done ? dailyScoreText(game, info!.totalScore ?? 0) : null;
  const state = !stats ? 'guest' : done ? 'done' : 'todo';
  return (
    <Link
      to={to as '/'}
      search={game === 'wclassic' ? undefined : ({ modo: 'daily' } as never)}
      className={`hz-chip ${game} ${state}`}
      data-sfx="start"
      data-testid={`daily-${game}`}
    >
      <span className="hz-chip-mark" aria-hidden="true">
        {done && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      <span className="hz-chip-body">
        <b>{name}</b>
        <small className="mono">{state === 'guest' ? 'SÓ COM CONTA' : done ? `FEITO · ${result}` : 'AINDA NÃO FEZ HOJE'}</small>
      </span>
      {state !== 'done' && <span className="hz-chip-go mono">{state === 'todo' ? 'JOGAR' : 'ABRIR'}</span>}
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
}: {
  to: string;
  cls: string;
  art: ReactNode;
  name: string;
  size?: 'mid' | 'long';
  lines: string[];
  wide?: boolean;
  badge?: string;
}) {
  return (
    <Link to={to as '/'} className={`hub-card ${cls}${wide ? ' wide' : ''}`} data-sfx="start" data-testid={`card-${cls.replace('hub-card-', '')}`}>
      {badge && <span className="hz-badge mono">{badge}</span>}
      <div className="hub-art">{art}</div>
      <div className="hub-card-foot">
        <div className={`hub-card-name${size ? ` ${size}` : ''}`}>{name}</div>
        {lines.map((l) => (
          <div key={l} className="mono hub-card-meta">
            {l}
          </div>
        ))}
      </div>
    </Link>
  );
}

/** A última coisa que ficou pela metade nos jogos de fases (Bee e Classic): o botão "Continuar". */
function useContinue(): { to: string; params?: Record<string, string>; title: string; sub: string } | null {
  const bee = useProgress(beeProgress);
  const c = useProgress(classicProgress.classic);
  const d = useProgress(classicProgress.dueto);
  const q = useProgress(classicProgress.quarteto);
  const options: { at: number; to: string; params: Record<string, string>; title: string; sub: string }[] = [];
  for (const [n, p] of Object.entries(bee)) {
    if (!p.closed && p.found.length > 0) {
      options.push({ at: p.at, to: '/words/bee/fase/$n', params: { n }, title: "Bee Word's", sub: `Fase ${n} · ${p.found.length} palavras` });
    }
  }
  const classic = [
    ['classic', '1 palavra', c],
    ['dueto', '2 palavras', d],
    ['quarteto', '4 palavras', q],
  ] as const;
  for (const [modo, label, prog] of classic) {
    for (const [n, p] of Object.entries(prog)) {
      if (!p.done && p.guesses.length > 0) {
        options.push({ at: p.at, to: '/words/classic/fase/$modo/$n', params: { modo, n }, title: "Classic Word's", sub: `${label} · fase ${n}` });
      }
    }
  }
  const last = options.sort((a, b) => b.at - a.at)[0];
  return last ?? null;
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
  const resume = useContinue();
  const doneToday = DAILIES.filter((d) => data?.daily[d.game]?.playedToday).length;
  const streak = data?.visit.current ?? 0;

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
          <h1>{user?.username ? `Oi, @${user.username}` : 'Bora jogar?'}</h1>
          <p className="mono">
            {data ? `${doneToday} DE ${DAILIES.length} DAILYS FEITOS HOJE` : 'ENTRE PARA GUARDAR RECORDES E DAILYS'}
          </p>
        </div>
        {streak > 0 && (
          <span className="hz-streak mono" title="Dias seguidos entrando no NoCap">
            <b>{streak}</b> {streakLabel(streak).replace(/^\d+ /, '').toUpperCase()} SEGUIDOS
          </span>
        )}
      </section>

      <section className="hz-sec" aria-label="Dailys de hoje">
        <h2 className="hz-h">
          Dailys de hoje{' '}
          <small className="mono">
            {data ? (doneToday === DAILIES.length ? 'TUDO FEITO. VOLTE AMANHÃ' : `FALTAM ${DAILIES.length - doneToday} DE ${DAILIES.length}`) : 'UM POR JOGO, TODO DIA'}
          </small>
        </h2>
        {data && (
          <div
            className="hz-prog"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={DAILIES.length}
            aria-valuenow={doneToday}
            aria-label="Dailys feitos hoje"
          >
            {DAILIES.map((d) => (
              <i key={d.game} className={data.daily[d.game]?.playedToday ? 'on' : ''} />
            ))}
          </div>
        )}
        <div className="hz-chips">
          {DAILIES.map((d) => (
            <DailyChip key={d.game} game={d.game} name={d.name} to={d.to} stats={data} />
          ))}
        </div>
      </section>

      {resume && (
        <Link
          to={resume.to as '/'}
          params={resume.params as never}
          className="hz-resume"
          data-sfx="start"
          data-testid="resume"
        >
          <span className="hz-resume-icon" aria-hidden="true">
            ▶
          </span>
          <span>
            <b>Continuar</b>
            <small className="mono">
              {resume.title.toUpperCase()} · {resume.sub.toUpperCase()}
            </small>
          </span>
          <i aria-hidden="true">→</i>
        </Link>
      )}

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
            badge="NOVO"
          />
        </div>
      </section>

      <section className="hz-sec" aria-label="Arcade">
        <h2 className="hz-h">
          Arcade <small className="mono">BATA SEU RECORDE</small>
        </h2>
        <div className="hz-grid">
          <GameCard to="/blocks" cls="hub-card-blocks" art={<BlocksArt />} name="Block's" lines={[blocksBestLabel(data)]} />
          <GameCard to="/atravessa" cls="hub-card-atravessa" art={<AtravessaArt />} name="Atravessa!" size="long" lines={[atravessaBestLabel(data)]} />
        </div>
      </section>

      <section className="hz-sec" aria-label="Reflexo e precisão">
        <h2 className="hz-h">
          Reflexo e precisão <small className="mono">COR, TEMPO E RITMO</small>
        </h2>
        <div className="hz-grid">
          <GameCard to="/cor" cls="hub-card-color" art={<ColorArt />} name="Mesmíssima" size="long" lines={[bestLabel(data, 'color')]} />
          <GameCard to="/tempo" cls="hub-card-time" art={<TimeArt />} name="Já Deu?" size="mid" lines={[bestLabel(data, 'time')]} />
          <GameCard to="/eco" cls="hub-card-eco" art={<EcoArt />} name="Ecooo" lines={[bestLabel(data, 'eco')]} />
        </div>
      </section>

      <div className="hub-more mono">+ MAIS JOGOS EM BREVE</div>
    </main>
  );
}
