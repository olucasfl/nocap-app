import { dailyDate } from '@nocap/games';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { dailyMax, streakLabel, type DailyInfo, type GameId } from '@/lib/stats';
import { ArrowRight } from './icons';
import './daily-card.css';

/**
 * O Daily deste jogo, dentro da aba de modos: uma partida por dia, igual para todo mundo.
 * Feito, mostra a nota e leva ao ranking do Daily; senão, o botão de jogar.
 */
export function DailyCard({
  game,
  info,
  busy,
  onPlay,
  onRanking,
}: {
  game: GameId;
  info: DailyInfo | undefined;
  busy?: boolean;
  onPlay: () => void;
  onRanking: () => void;
}) {
  const user = useAuth((s) => s.user);
  const [, mm, dd] = dailyDate().split('-');
  const done = !!info?.playedToday;
  return (
    <section className="dc" aria-label="Daily de hoje">
      <div className="dc-head">
        <span className="mono dc-tag">
          DAILY · {dd}/{mm}
        </span>
        {user && info && (
          <span className="mono dc-streak">
            SEQUÊNCIA {streakLabel(info.current).toUpperCase()}
          </span>
        )}
      </div>
      {done && info ? (
        <>
          <div className="dc-score">
            {((info.totalScore ?? 0) / 10).toFixed(1)}
            <small className="mono">/{dailyMax(game)}</small>
          </div>
          <p className="dc-text">Feito hoje. Volte amanhã para manter a sequência.</p>
          <button type="button" className="btn ghost" onClick={onRanking}>
            Ver ranking do Daily
          </button>
        </>
      ) : (
        <>
          <p className="dc-text">
            Uma partida por dia, com {game === 'color' ? 'as mesmas cores' : 'os mesmos alvos'} para
            todo mundo. Tem ranking próprio.
          </p>
          <PlayGate what="jogar o Daily">
            <button type="button" className="btn alt" disabled={busy} onClick={onPlay}>
              {busy ? 'Preparando...' : 'Jogar o Daily'} <ArrowRight />
            </button>
          </PlayGate>
        </>
      )}
    </section>
  );
}
