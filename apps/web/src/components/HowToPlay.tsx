import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './how-to-play.css';

/** As regras de cada jogo do Fox Cap!, curtas: o que é, como vence e o que apertar. */
export const HOW_TO_PLAY = {
  atravessa: {
    title: 'Atravessa! Infinito',
    points: [
      'Pule de faixa em faixa e chegue o mais longe que der. Cada linha nova vale um ponto.',
      'Desvie dos carros e do trem. No rio, pise nas toras e nas pedras, nunca na água.',
      'Parado demais, um perigo desce pela sua coluna: pule para o lado.',
    ],
    keys: 'Computador: W A S D ou setas. Celular: toque pula, deslize muda de faixa.',
  },
  desmorona: {
    title: 'Desmorona! Treino',
    points: [
      'Todo mundo cai do céu. O ladrilho que você pisa racha e some.',
      'Sem chão, você cai para a camada de baixo; da última, na lava.',
      'Vence o último de pé.',
    ],
    keys: 'Computador: W A S D, Espaço pula (de novo no ar, pulo duplo), mouse gira a câmera. Celular: joystick e dedo à direita.',
  },
  bola: {
    title: 'Fut Fox Treino',
    points: [
      'Futebol de raposas com 2 a 4 times. O gol vale para quem tocou na bola por último.',
      'Pule duas vezes com uma direção apertada para dar o mortal: ele chuta a bola.',
      'Vence quem fizer mais gols; empate vai para o gol de ouro.',
    ],
    keys: 'Computador: W A S D, Espaço pula, F prende ou solta a câmera. Celular: joystick e botão Pular.',
  },
} as const;

export type HowGame = keyof typeof HOW_TO_PLAY;

/** O popup "Como jogar?": minimalista, fecha com o botão, o fundo ou Esc. */
export function HowToPlay({ game, onClose }: { game: HowGame; onClose: () => void }) {
  const how = HOW_TO_PLAY[game];
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ok.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="htp" role="presentation" onClick={onClose}>
      <div
        className="htp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="htp-title"
        data-testid="how-to-play"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="htp-title">{how.title}</h2>
        <ul>
          {how.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mono htp-keys">{how.keys}</p>
        <button ref={ok} type="button" className="btn alt" onClick={onClose} data-testid="htp-ok">
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  );
}
