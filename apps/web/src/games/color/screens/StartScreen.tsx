import { useQuery } from '@tanstack/react-query';
import { colorPresets, dailyDate } from '@nocap/games';
import { DailyDone } from '@/components/DailyDone';
import { GameLinks } from '@/components/GameLinks';
import { ArrowRight } from '@/components/icons';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchStats, streakLabel } from '@/lib/stats';
import type { Mode } from '../types';

/** Modos do dia a dia. O Daily não é um modo: é um jogo especial com tela própria. */
const MODES: { id: Exclude<Mode, 'daily'>; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'flash', label: 'Flash' },
  { id: 'quick', label: 'Rápido' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Uma cor aparece por 3 segundos. Depois some. Recrie de memória nos controles e veja o quanto você chegou perto.',
  flash: 'A cor pisca por menos de meio segundo. Sem tempo pra pensar: confie no olho.',
  quick: 'Só uma rodada, com 3 segundos pra decorar. Ideal pra jogar em 30 segundos.',
  daily: 'A cor de hoje é a mesma para todo mundo. Mesmas 5 cores, uma única chance por dia.',
};

const seconds = (ms: number) => `${ms / 1000}s`.replace('.', ',');

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  onStart: () => void;
}

export function StartScreen({ mode, onMode, onStart }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.color;
  const preset = colorPresets[mode === 'daily' ? 'classic' : mode]!;
  const [, mm, dd] = dailyDate().split('-');
  const isDaily = mode === 'daily';
  const dailyDone = isDaily && !!daily?.playedToday;

  return (
    <section className="screen">
      <h1>{isDaily ? 'Daily' : 'Cor'}</h1>
      {isDaily ? (
        <div className="mono cg-daily-tag">
          COR · DAILY {dd}/{mm}
          {daily && daily.current > 0 && ` · SEQUÊNCIA ${streakLabel(daily.current).toUpperCase()}`}
        </div>
      ) : (
        <div className="cg-seg" role="radiogroup" aria-label="Modo de jogo">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => onMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <p className="lead">{LEAD[mode]}</p>
      <div className="cg-deco" aria-hidden="true">
        <i style={{ background: 'var(--orange)' }} />
        <i style={{ background: 'var(--blue)' }} />
        <i style={{ background: 'var(--yellow)' }} />
        <i style={{ background: 'var(--green)' }} />
      </div>
      <div className="cg-rules">
        <div className="cg-rule">
          <b>{preset.rounds}</b>
          {preset.rounds === 1 ? 'rodada' : 'rodadas'}
        </div>
        <div className="cg-rule">
          <b>{seconds(preset.showMs)}</b>pra decorar
        </div>
        <div className="cg-rule">
          <b>{preset.rounds * 10}</b>pontos max
        </div>
      </div>
      {dailyDone && daily ? (
        <DailyDone game="color" info={daily} />
      ) : (
        <div className="stack">
          <PlayGate>
            <button type="button" className="btn" onClick={onStart}>
              {isDaily ? 'Jogar o Daily' : 'Jogar'} <ArrowRight />
            </button>
          </PlayGate>
          {!isDaily && (
            <>
              {daily && (
                <div className="mono cg-streak">
                  SEQUÊNCIA DO DAILY DA COR: {streakLabel(daily.current).toUpperCase()}
                </div>
              )}
              <GameLinks game="color" />
            </>
          )}
        </div>
      )}
    </section>
  );
}
