import { create } from 'zustand';
import { useEffect } from 'react';

/**
 * Fila de popups do app: dois nunca aparecem juntos (nem um em cima do outro). Quem quer aparecer
 * se registra com uma prioridade (menor número = mais importante, vem primeiro); só o primeiro da
 * fila ganha a vez, e os outros esperam até ele sair.
 */
interface Want {
  priority: number;
  at: number;
}
interface PopupState {
  wants: Record<string, Want>;
}
let counter = 0;

export const usePopups = create<PopupState>(() => ({ wants: {} }));

/** Quem é o próximo da fila (ou `null`). */
export function nextPopup(wants: Record<string, Want>): string | null {
  let best: [string, Want] | null = null;
  for (const entry of Object.entries(wants)) {
    const [, w] = entry;
    if (!best || w.priority < best[1].priority || (w.priority === best[1].priority && w.at < best[1].at)) best = entry;
  }
  return best ? best[0] : null;
}

/** `wants`: este popup quer aparecer agora. Devolve `true` só quando é a vez dele. */
export function usePopupSlot(id: string, wants: boolean, priority: number): boolean {
  useEffect(() => {
    if (!wants) return;
    usePopups.setState((s) => ({ wants: { ...s.wants, [id]: { priority, at: ++counter } } }));
    return () => {
      usePopups.setState((s) => {
        const next = { ...s.wants };
        delete next[id];
        return { wants: next };
      });
    };
  }, [id, wants, priority]);
  return usePopups((s) => wants && nextPopup(s.wants) === id);
}
