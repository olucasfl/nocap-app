import { colorPresets, dailyDate } from '@nocap/games';
import { ArrowRight } from '@/components/icons';
import type { Mode } from '../types';

const MODES: { id: Mode; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'flash', label: 'Flash' },
  { id: 'quick', label: 'Rápido' },
  { id: 'daily', label: 'Daily' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Uma cor aparece por 3 segundos. Depois some. Recrie de memória nos controles e veja o quanto você chegou perto.',
  flash: 'A cor pisca por menos de meio segundo. Sem tempo pra pensar: confie no olho.',
  quick: 'Só uma rodada, com 3 segundos pra decorar. Ideal pra jogar em 30 segundos.',
  daily: 'A cor de hoje é a mesma para todo mundo. Mesmas 5 cores, uma chance de brilhar.',
};

const seconds = (ms: number) => `${ms / 1000}s`.replace('.', ',');

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  onStart: () => void;
}

export function StartScreen({ mode, onMode, onStart }: Props) {
  const preset = colorPresets[mode === 'daily' ? 'classic' : mode]!;
  const [, mm, dd] = dailyDate().split('-');

  return (
    <section className="screen">
      <h1>Cor</h1>
      <div className="cg-seg" role="radiogroup" aria-label="Modo de jogo">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => onMode(m.id)}
          >
            {m.id === 'daily' ? `Daily ${dd}/${mm}` : m.label}
          </button>
        ))}
      </div>
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
      <div className="stack">
        <button type="button" className="btn" onClick={onStart}>
          Jogar <ArrowRight />
        </button>
      </div>
    </section>
  );
}
