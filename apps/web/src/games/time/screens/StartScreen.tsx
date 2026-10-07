import { timePresets } from '@nocap/games';
import { ArrowRight } from '@/components/icons';
import { dailyDate } from '@nocap/games';
import type { Mode } from '../types';

const MODES: { id: Mode; label: string }[] = [
  { id: 'classic', label: 'Clássico' },
  { id: 'quick', label: 'Rápido' },
  { id: 'strict', label: 'Sem estourar' },
  { id: 'daily', label: 'Daily' },
];

const LEAD: Record<Mode, string> = {
  classic:
    'Você vê um tempo alvo. Toque para começar, conte de cabeça e toque para parar. Nada de relógio: só o seu senso de tempo.',
  quick: 'Uma rodada só. Conte o tempo de cabeça e veja o quanto você chegou perto.',
  strict: 'Passou do alvo, a rodada vale zero. Melhor parar um pouco antes do que estourar.',
  daily: 'Os alvos de hoje são os mesmos para todo mundo. Mesmas 5 rodadas, uma chance de brilhar.',
};

interface Props {
  mode: Mode;
  busy: boolean;
  error: string;
  onMode: (m: Mode) => void;
  onStart: () => void;
}

export function StartScreen({ mode, busy, error, onMode, onStart }: Props) {
  const preset = timePresets[mode === 'daily' ? 'classic' : mode]!;
  const [, mm, dd] = dailyDate().split('-');

  return (
    <section className="screen">
      <h1>Tempo</h1>
      <div className="tm-seg" role="radiogroup" aria-label="Modo de jogo">
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
      <div className="stack">
        <button type="button" className="btn" disabled={busy} onClick={onStart}>
          {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
        </button>
      </div>
    </section>
  );
}
