import type { SaveState } from '@nocap/games';
import { useRef } from 'react';
import { RequirementBars } from './Requirements';
import { collapseView } from './game-logic';
import { useDialog } from './useDialog';
import './collapse.css';

/**
 * "Sua meta" (spec 041, A3): o que falta para a estrela colapsar, com a barra de cada requisito e uma explicação do que
 * é o colapso. Abre pelo chip de meta no topo da tela de jogo.
 */
export function GoalModal({ state, onClose }: { state: SaveState; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onClose);
  const view = collapseView(state);
  return (
    <div className="ap-modal-game">
      <div ref={root} className="ap-mcard-game ap-collapse" role="dialog" aria-modal="true" aria-labelledby="ap-goal-title" tabIndex={-1}>
        <h2 id="ap-goal-title">Sua meta: colapso {view.next}</h2>
        <p className="ap-sub">
          Quando você cumprir os três requisitos, a estrela colapsa: você guarda um grimório proibido no Cofre, ganha Cintilas para a árvore e
          recomeça mais forte. Quanto mais poeira você farma, mais cedo chega lá.
        </p>
        <RequirementBars view={view} />
        <p className="ap-sub">{view.ready ? 'Tudo pronto: toque em "Estrela pronta" para colapsar.' : view.hint}</p>
        <div className="ap-cc-actions">
          <button type="button" className="ap-hbtn" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
