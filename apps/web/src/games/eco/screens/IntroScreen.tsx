import { ArrowRight } from '@/components/icons';
import { ECO_TAP_TIMEOUT_MS } from '@nocap/games';
import type { Run } from '../types';

const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  escalada: 'Escalada',
  velocidade: 'Velocidade',
  reverso: 'Reverso',
};

/** Linha extra de cada modo, além das regras que valem para todos. */
function extra(run: Run): string {
  if (run.mode === 'daily')
    return 'A sequência é a mesma para todo mundo e só vale uma vez por dia.';
  switch (run.preset) {
    case 'escalada':
      return 'A cada 3 rodadas entra um botão novo, até 9. Depois a sequência segue só com os 9. Fique de olho nos símbolos.';
    case 'velocidade':
      return 'A sequência acelera a cada rodada: na rodada 20 cada botão acende por um instante só. Vale até 30 passos.';
    case 'reverso':
      return 'Repita de trás para frente: o último botão que acendeu é o primeiro que você toca.';
    default:
      return 'Comece devagar: a primeira rodada tem só um passo.';
  }
}

/** Instruções antes da primeira rodada. O botão começa a partida (e destrava o som do aparelho). */
export function IntroScreen({ run, onBegin }: { run: Run; onBegin: () => void }) {
  return (
    <section className="screen eco-intro">
      <div className="mono eco-label">
        {(run.mode === 'daily' ? 'DAILY' : MODE_NAME[run.preset])?.toUpperCase()}
      </div>
      <h1>Como jogar</h1>
      <ol className="eco-steps">
        <li>
          <b>1</b>
          <span>Os botões se acendem numa ordem, cada um com a sua cor, símbolo e som.</span>
        </li>
        <li>
          <b>2</b>
          <span>Quando aparecer SUA VEZ, toque nos botões na mesma ordem.</span>
        </li>
        <li>
          <b>3</b>
          <span>
            A cada acerto a sequência ganha um passo. No computador, as teclas 1 a 9 também tocam.
          </span>
        </li>
        <li>
          <b>4</b>
          <span>
            Errou um botão, ou ficou {ECO_TAP_TIMEOUT_MS / 1000} segundos parado: a partida acaba.
          </span>
        </li>
      </ol>
      <p className="eco-intro-extra">{extra(run)}</p>
      <div className="stack">
        <button type="button" className="btn" data-sfx="start" onClick={onBegin}>
          Começar <ArrowRight />
        </button>
      </div>
    </section>
  );
}
