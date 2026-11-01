import { createPortal } from 'react-dom';
import type { PpBotName } from '@nocap/games';
import './ping.css';

const LEVELS: { id: PpBotName; name: string; desc: string }[] = [
  { id: 'facil', name: 'Fácil', desc: 'Devolve devagar e erra bastante.' },
  { id: 'medio', name: 'Médio', desc: 'Joga direitinho e dá uns smashes.' },
  { id: 'dificil', name: 'Difícil', desc: 'Rápido, mira nos cantos e quase não erra.' },
];

/** A escolha do nível do bot no treino do Ping Fox! (Fox Cap!). */
export function PingPicker({
  level,
  onChange,
  onStart,
  onCancel,
}: {
  level: PpBotName;
  onChange: (l: PpBotName) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="png-pick" role="dialog" aria-modal="true" aria-label="Nível do adversário">
      <div className="png-pick-card">
        <h2>Contra quem?</h2>
        <p className="mono">PARTIDA DE 11 PONTOS</p>
        <div className="png-levels" role="radiogroup" aria-label="Nível do adversário">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={level === l.id}
              className={`png-level${level === l.id ? ' is-on' : ''}`}
              onClick={() => onChange(l.id)}
              data-testid={`png-level-${l.id}`}
            >
              <b>{l.name}</b>
              <span>{l.desc}</span>
            </button>
          ))}
        </div>
        <div className="png-pick-btns">
          <button type="button" className="png-btn" onClick={onStart} data-testid="png-start">
            Jogar
          </button>
          <button type="button" className="png-btn is-ghost" onClick={onCancel}>
            Voltar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
