import type { Board } from '@/lib/ranking';
import type { GameTab } from './GameTabs';

/**
 * Botões do fim de partida que levam de volta ao menu do jogo: o ranking (já no quadro do modo
 * jogado) e a lista de modos. São botões (não links) porque a partida e o menu são a mesma rota:
 * quem troca a tela é o próprio jogo.
 */
export function EndActions({
  board,
  onMenu,
}: {
  /** Quadro do ranking a abrir (o modo que acabou de ser jogado). */
  board?: Board;
  onMenu: (tab: GameTab, board?: Board) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="btn ghost"
        data-sfx="select"
        onClick={() => onMenu('ranking', board)}
      >
        Ver ranking
      </button>
      <button type="button" className="btn ghost" data-sfx="back" onClick={() => onMenu('modes')}>
        Modos do jogo
      </button>
    </>
  );
}
