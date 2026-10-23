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
export function GoalModal({ state, onClose, onCollapse }: { state: SaveState; onClose: () => void; onCollapse?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, onClose);
  const view = collapseView(state);
  return (
    <div className="ap-modal-game">
      <div ref={root} className="ap-mcard-game ap-collapse" role="dialog" aria-modal="true" aria-labelledby="ap-goal-title" tabIndex={-1}>
        <h2 id="ap-goal-title">Sua meta: colapso {view.next}</h2>
        <p className="ap-sub">
          Quando você cumprir os três requisitos, o colapso é liberado e só acontece quando você escolher colapsar: você guarda um grimório proibido no Cofre, ganha Cintilas para a árvore e
          recomeça mais forte. Quanto mais poeira você farma, mais cedo chega lá.
        </p>
        <RequirementBars view={view} />
        <p className="ap-sub">{view.ready ? 'Meta cumprida: o colapso está liberado. Colapse quando quiser.' : view.hint}</p>
        <div className="ap-cc-actions">
          {onCollapse && (
            <button type="button" className="ap-hbtn ap-hbtn-go" disabled={!view.ready} onClick={onCollapse}>
              {view.ready ? 'Colapsar a estrela' : 'Colapso bloqueado'}
            </button>
          )}
          <button type="button" className="ap-hbtn" onClick={onClose}>
            {onCollapse ? 'Fechar' : 'Entendi'}
          </button>
        </div>
      </div>
    </div>
  );
}
