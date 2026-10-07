import { useEffect } from 'react';
import { sfx } from '@/lib/sfx';
import { formatSeconds } from '../format';

interface Props {
  target: number;
  noOvershoot: boolean;
  /** `true` entre o COMEÇAR e o PARAR: a rodada está valendo. */
  counting: boolean;
  /** Toque em COMEÇAR (medido no `pointerdown`, sem esperar o clique). */
  onBegin: () => void;
  /** Toque em PARAR, com o instante exato (`performance.now()`). */
  onStop: (now: number) => void;
}

/**
 * A rodada do Tempo numa tela só: o alvo fica à vista e o botão COMEÇAR vira PARAR.
 *
 * Valendo, a tela mostra um aviso FIXO ("VALENDO", com ponto parado) e muda de cor. Nada pisca,
 * nada anda e nenhum número muda (RULES.md: sem cronômetro, número correndo, barra, animação
 * rítmica ou som na contagem): o alvo é sempre o mesmo e não revela o tempo que passou.
 * O botão PARAR não usa `.btn` (que toca o "clack" global) e nada vibra.
 */
export function RoundScreen({ target, noOvershoot, counting, onBegin, onStop }: Props) {
  useEffect(() => {
    // Só ao mostrar o alvo (antes de valer).
    sfx.flip();
  }, []);

  return (
    <section className={`screen tm-round${counting ? ' live' : ''}`}>
      <div className="tm-top">
        <div className="mono tm-label">ALVO</div>
        {counting ? (
          <div className="tm-pill" role="status">
            <i aria-hidden="true" />
            VALENDO
          </div>
        ) : (
          <div className="mono tm-label tm-idle">PRONTO</div>
        )}
      </div>
      <div className="tm-target-time" aria-label={`Alvo: ${formatSeconds(target)}`}>
        {formatSeconds(target)}
      </div>
      <p className="lead">
        {counting
          ? 'Conte de cabeça e toque em PARAR quando achar que chegou no alvo.'
          : 'Toque em COMEÇAR, conte de cabeça e toque em PARAR quando achar que chegou no alvo.'}
        {noOvershoot && ' Passou do alvo, vale zero.'}
      </p>
      <div className="stack">
        {counting ? (
          <button
            type="button"
            className="tm-stop"
            onPointerDown={() => onStop(performance.now())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onStop(performance.now());
              }
            }}
          >
            Parar
          </button>
        ) : (
          <button
            type="button"
            className="btn alt"
            onPointerDown={onBegin}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onBegin();
              }
            }}
          >
            Começar
          </button>
        )}
      </div>
    </section>
  );
}
