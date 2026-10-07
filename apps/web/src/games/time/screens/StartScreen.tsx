import { useQuery } from '@tanstack/react-query';
import { dailyDate, timePresets } from '@nocap/games';
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
  { id: 'quick', label: 'Rápido' },
  { id: 'strict', label: 'Sem estourar' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Você vê um tempo alvo. Toque em COMEÇAR, conte de cabeça e toque em PARAR. Alternamos alvos curtos (menos de 10 s) e longos.',
  quick: 'Uma rodada só, quase sempre curta. Conte o tempo de cabeça e veja o quanto chegou perto.',
  strict: 'Passou do alvo, a rodada vale zero. Melhor parar um pouco antes do que estourar.',
  daily: 'Os alvos de hoje são os mesmos para todo mundo. Três rodadas, uma única chance por dia.',
};

interface Props {
  mode: Mode;
  busy: boolean;
  error: string;
  onMode: (m: Mode) => void;
  onStart: () => void;
}

export function StartScreen({ mode, busy, error, onMode, onStart }: Props) {
  const user = useAuth((s) => s.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const daily = stats.data?.daily.time;
  const preset = timePresets[mode === 'daily' ? 'classic' : mode]!;
  const [, mm, dd] = dailyDate().split('-');
  const isDaily = mode === 'daily';
  const dailyDone = isDaily && !!daily?.playedToday;

  return (
    <section className="screen">
      <h1>{isDaily ? 'Daily' : 'Tempo'}</h1>
      {isDaily ? (
        <div className="mono tm-daily-tag">
          TEMPO · DAILY {dd}/{mm}
          {daily && daily.current > 0 && ` · SEQUÊNCIA ${streakLabel(daily.current).toUpperCase()}`}
        </div>
      ) : (
        <div className="tm-seg" role="radiogroup" aria-label="Modo de jogo">
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
      <div className="tm-rules">
        <div className="tm-rule">
          <b>{preset.rounds}</b>
          {preset.rounds === 1 ? 'rodada' : 'rodadas'}
        </div>
        <div className="tm-rule">
          <b>
            {preset.minMs / 1000}–{preset.maxMs / 1000}s
          </b>
          alvos
        </div>
        <div className="tm-rule">
          <b>{preset.rounds * 10}</b>pontos max
        </div>
      </div>
      {error && (
        <p className="acc-failure mono" role="alert">
          {error}
        </p>
      )}
      {dailyDone && daily ? (
        <DailyDone game="time" info={daily} />
      ) : (
        <div className="stack">
          <PlayGate>
            <button type="button" className="btn" disabled={busy} onClick={onStart}>
              {busy ? 'Preparando...' : isDaily ? 'Jogar o Daily' : 'Jogar'} <ArrowRight />
            </button>
          </PlayGate>
          {!isDaily && (
            <>
              {daily && (
                <div className="mono tm-streak">
                  SEQUÊNCIA DO DAILY DO TEMPO: {streakLabel(daily.current).toUpperCase()}
                </div>
              )}
              <GameLinks game="time" />
            </>
          )}
        </div>
      )}
    </section>
  );
}
