import { useEffect } from 'react';
import { buzz, sfx } from '@/lib/sfx';
import { formatSeconds } from '../format';

interface SurvivalInfo {
  round: number;
  lives: number;
  minScore: number;
}

interface Props {
  target: number;
  noOvershoot: boolean;
  /** `true` entre o início da contagem e o PARAR: a rodada está valendo. */
  counting: boolean;
  /** Toque que dispara o relógio (medido no `pointerdown`, sem esperar o clique). */
  onBegin: () => void;
  /** Toque em PARAR, com o instante exato (`performance.now()`). */
  onStop: (now: number) => void;
  /** Etapa da partida, no topo da tela (ex.: "2/5"). */
  step?: string;
  /** Sobrevivência: rodada, vidas e a nota mínima ficam à vista (parados) o tempo todo. */
  survival?: SurvivalInfo;
}

/**
 * A rodada do Tempo numa tela só, com UM botão redondo que fica no mesmo lugar:
 * - antes: tela escura, alvo grande e o botão INICIAR;
 * - ao tocar nele, só o visual muda (a tela vira laranja de uma vez e o botão passa a PARAR);
 * - tocar no mesmo botão de novo encerra a rodada.
 *
 * Valendo, nada pisca, anda ou muda (RULES.md: sem cronômetro, número, barra, som ou animação
 * rítmica na contagem). O alvo e a nota mínima são fixos e não revelam o tempo que passou. O som
 * e a animação ficam para a tela de resultado.
 */
export function RoundScreen({
  target,
  noOvershoot,
  counting,
  onBegin,
  onStop,
  step,
  survival,
}: Props) {
  useEffect(() => {
    // Só ao mostrar o alvo (antes de valer).
    sfx.flip();
  }, []);

  const press = () => {
    if (counting) {
      onStop(performance.now());
    } else {
      buzz(20);
      onBegin();
    }
  };

  return (
    <section
      className={`tm-stage ${counting ? 'live' : 'armed'}`}
      aria-label={counting ? 'Valendo' : 'Preparado para começar'}
    >
      {step && (
        <div className="chip y tm-step" aria-label={`Etapa ${step}`}>
          {step}
        </div>
      )}
      {counting && (
        <div className="tm-pill tm-pill-top" role="status">
          <i aria-hidden="true" />
          VALENDO
        </div>
      )}
      {survival && (
        <div className="tm-stage-sv">
          <span className="mono">RODADA {survival.round}</span>
          <span className="tm-stage-lives" aria-label={`${survival.lives} vidas`}>
            {[0, 1, 2].map((i) => (
              <i key={i} className={i < survival.lives ? 'on' : ''} />
            ))}
          </span>
          <span className="mono">NOTA MÍNIMA {survival.minScore}</span>
        </div>
      )}
      <div className="mono tm-stage-label">{counting ? 'ALVO' : 'TEMPO ALVO'}</div>
      <div className="tm-stage-target">{formatSeconds(target)}</div>
      <p className="tm-stage-text">
        {counting
          ? 'Conte de cabeça e toque no mesmo botão quando achar que chegou.'
          : 'Quando estiver pronto, toque no botão: o tempo começa no mesmo instante.'}
        {noOvershoot && ' Passou do alvo, vale zero.'}
      </p>
      <button
        type="button"
        className={`tm-go${counting ? ' on' : ''}`}
        onPointerDown={press}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            press();
          }
        }}
      >
        <span>{counting ? 'Parar' : 'Iniciar'}</span>
      </button>
    </section>
  );
}
