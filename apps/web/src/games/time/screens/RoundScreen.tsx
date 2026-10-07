import { useEffect, useState } from 'react';
import { buzz, sfx } from '@/lib/sfx';
import { formatSeconds } from '../format';

interface Props {
  target: number;
  noOvershoot: boolean;
  /** `true` entre o início da contagem e o PARAR: a rodada está valendo. */
  counting: boolean;
  /** Toque que dispara o relógio (medido no `pointerdown`, sem esperar o clique). */
  onBegin: () => void;
  /** Toque em PARAR, com o instante exato (`performance.now()`). */
  onStop: (now: number) => void;
  /** Sequência: pula a tela de alvo e já abre o preparo (a partida corre sem pausa). */
  skipIntro?: boolean;
  /** Linha curta no preparo (ex.: a nota da rodada anterior na Sequência). */
  note?: string;
}

const keyTap = (run: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    run();
  }
};

/**
 * A rodada do Tempo em três momentos:
 * 1. alvo à vista e COMEÇAR (calmo);
 * 2. "tela de preparo" imersiva em tinta, com um botão redondo para iniciar quando estiver pronto;
 * 3. VALENDO: a tela inteira vira laranja de uma vez (a mudança é o aviso) e qualquer toque para.
 *
 * Valendo, nada pisca, anda ou muda (RULES.md: sem cronômetro, número, barra, som ou animação
 * rítmica na contagem). O alvo é fixo e não revela o tempo que passou. O som e a animação ficam
 * para a tela de resultado.
 */
export function RoundScreen({
  target,
  noOvershoot,
  counting,
  onBegin,
  onStop,
  skipIntro = false,
  note,
}: Props) {
  const [armed, setArmed] = useState(skipIntro);

  useEffect(() => {
    // Só ao mostrar o alvo (antes de valer).
    sfx.flip();
  }, []);

  if (counting) {
    return (
      <section
        className="tm-stage live"
        onPointerDown={() => onStop(performance.now())}
        onKeyDown={keyTap(() => onStop(performance.now()))}
        tabIndex={0}
        role="button"
        aria-label="Valendo. Toque para parar"
      >
        <div className="tm-pill" role="status">
          <i aria-hidden="true" />
          VALENDO
        </div>
        <div className="mono tm-stage-label">ALVO</div>
        <div className="tm-stage-target">{formatSeconds(target)}</div>
        <div className="tm-stage-hint">TOQUE EM QUALQUER LUGAR PARA PARAR</div>
        {noOvershoot && <div className="mono tm-stage-warn">PASSOU DO ALVO, VALE ZERO</div>}
      </section>
    );
  }

  if (armed) {
    return (
      <section className="tm-stage armed" aria-label="Preparado para começar">
        <div className="mono tm-stage-label">PREPARE-SE</div>
        {note && <div className="mono tm-stage-note">{note}</div>}
        <div className="tm-stage-target">{formatSeconds(target)}</div>
        <p className="tm-stage-text">
          Respire. Quando estiver pronto, toque no botão: o tempo começa no mesmo instante. Toque de
          novo quando achar que chegou.
          {noOvershoot && ' Passou do alvo, vale zero.'}
        </p>
        <button
          type="button"
          className="tm-go"
          onPointerDown={() => {
            buzz(20);
            onBegin();
          }}
          onKeyDown={keyTap(onBegin)}
        >
          <span>Iniciar</span>
        </button>
      </section>
    );
  }

  return (
    <section className="screen tm-round">
      <div className="tm-top">
        <div className="mono tm-label">ALVO</div>
        <div className="mono tm-label tm-idle">PRONTO</div>
      </div>
      <div className="tm-target-time" aria-label={`Alvo: ${formatSeconds(target)}`}>
        {formatSeconds(target)}
      </div>
      <p className="lead">
        Conte esse tempo de cabeça. Toque em COMEÇAR para ir para a tela de preparo.
        {noOvershoot && ' Passou do alvo, vale zero.'}
      </p>
      <div className="stack">
        <button type="button" className="btn alt" onClick={() => setArmed(true)}>
          Começar
        </button>
      </div>
    </section>
  );
}
