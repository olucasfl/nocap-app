import { useEffect, useState } from 'react';
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
 * A rodada do Tempo, em três toques: COMEÇAR (prepara), COMEÇAR A CONTAR (dispara o relógio) e
 * PARAR. O alvo fica à vista o tempo todo.
 *
 * Valendo, a tela mostra um aviso FIXO ("VALENDO", com ponto parado) e muda de cor. Nada pisca,
 * nada anda e nenhum número muda (RULES.md: sem cronômetro, número correndo, barra, animação
 * rítmica ou som na contagem): o alvo é sempre o mesmo e não revela o tempo que passou.
 * O botão PARAR não usa `.btn` (que toca o "clack" global) e nada vibra.
 */
export function RoundScreen({ target, noOvershoot, counting, onBegin, onStop }: Props) {
  // Preparado: o próximo toque dispara o relógio. Estado local; some quando a contagem começa.
  const [armed, setArmed] = useState(false);

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
          <div className="mono tm-label tm-idle">{armed ? 'PREPARADO' : 'PRONTO'}</div>
        )}
      </div>
      <div className="tm-target-time" aria-label={`Alvo: ${formatSeconds(target)}`}>
        {formatSeconds(target)}
      </div>
      <p className="lead">
        {counting
          ? 'Conte de cabeça e toque em PARAR quando achar que chegou no alvo.'
          : armed
            ? 'Quando você tocar no botão grande, o tempo começa a valer. Toque de novo para parar.'
            : 'Toque em COMEÇAR para se preparar. Depois é só tocar para começar a contar e tocar de novo para parar.'}
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
        ) : armed ? (
          <button
            type="button"
            className="tm-arm"
            onPointerDown={onBegin}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onBegin();
              }
            }}
          >
            Clique para começar a contar
          </button>
        ) : (
          <button type="button" className="btn alt" onClick={() => setArmed(true)}>
            Começar
          </button>
        )}
      </div>
    </section>
  );
}
