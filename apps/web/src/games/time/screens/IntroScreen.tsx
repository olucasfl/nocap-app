import { SURVIVAL_LIVES, survivalMinScore } from '@nocap/games';
import { ArrowRight } from '@/components/icons';
import { formatSeconds } from '../format';
import type { Run } from '../types';

const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  quick: 'Rápido',
  strict: 'Sem estourar',
  sequence: 'Sequência',
  survival: 'Sobrevivência',
};

/** Linha extra de cada modo, além dos passos que valem para todos. */
function extra(run: Run): string {
  const rounds = run.settings.rounds;
  switch (run.preset) {
    case 'quick':
      return 'É uma rodada só.';
    case 'strict':
      return `São ${rounds} rodadas. Passou do alvo, a rodada vale zero.`;
    case 'sequence':
      return `São ${rounds} alvos curtos seguidos, sem pausa. As notas aparecem no fim.`;
    case 'survival':
      return `Você tem ${SURVIVAL_LIVES} vidas. Nota abaixo de ${survivalMinScore('time', 0)} perde uma vida. Vale quantas rodadas você aguenta.`;
    default:
      return run.mode === 'daily'
        ? `São ${rounds} rodadas, iguais para todo mundo, e só vale uma vez por dia.`
        : `São ${rounds} rodadas, alternando alvos curtos e longos.`;
  }
}

/** Instruções antes da primeira rodada. O botão leva à tela do tempo alvo. */
export function IntroScreen({ run, onBegin }: { run: Run; onBegin: () => void }) {
  return (
    <section className="screen tm-intro">
      <div className="mono tm-label">
        {(run.mode === 'daily' ? 'DAILY' : MODE_NAME[run.preset])?.toUpperCase()}
      </div>
      <h1>Como jogar</h1>
      <ol className="tm-steps">
        <li>
          <b>1</b>
          <span>Você vê um tempo alvo, por exemplo {formatSeconds(8400)}.</span>
        </li>
        <li>
          <b>2</b>
          <span>
            Quando estiver pronto, toque no botão redondo INICIAR. O tempo começa na hora.
          </span>
        </li>
        <li>
          <b>3</b>
          <span>Conte de cabeça. A tela não mostra relógio nem som: confie no seu ritmo.</span>
        </li>
        <li>
          <b>4</b>
          <span>Toque no mesmo botão quando achar que chegou no alvo.</span>
        </li>
      </ol>
      <p className="tm-intro-extra">{extra(run)}</p>
      <div className="stack">
        <button type="button" className="btn" data-sfx="start" onClick={onBegin}>
          Começar <ArrowRight />
        </button>
      </div>
    </section>
  );
}
