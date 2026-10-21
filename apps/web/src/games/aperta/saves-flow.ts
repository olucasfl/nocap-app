import type { SaveSlot } from './save-store';

/** Estado do modal de saves: no máximo um espaço pedindo a segunda confirmação de apagar. */
export interface SavesModalState {
  confirmingDelete: SaveSlot | null;
}

export const savesModalStart: SavesModalState = { confirmingDelete: null };

/** Passo 1 de apagar. Pedir outro espaço troca a pergunta (nunca duas ao mesmo tempo). */
export function askDelete(_s: SavesModalState, slot: SaveSlot): SavesModalState {
  return { confirmingDelete: slot };
}

export function cancelDelete(): SavesModalState {
  return savesModalStart;
}

/**
 * Esc e "Voltar": se há uma confirmação aberta, ela fecha primeiro e o modal fica;
 * senão, o modal fecha.
 */
export function backOrClose(s: SavesModalState): { state: SavesModalState; close: boolean } {
  if (s.confirmingDelete) return { state: savesModalStart, close: false };
  return { state: s, close: true };
}

/** Quem entra: o convidado vê o convite, só quem tem conta joga. */
export type ApertaAccess = 'checking' | 'guest' | 'player';

export function apertaAccess(status: 'loading' | 'ready', hasUser: boolean): ApertaAccess {
  if (status === 'loading') return 'checking';
  return hasUser ? 'player' : 'guest';
}

/** O que o save pede ao abrir: novo jogo (ou save sem história vista) começa pela história. */
export function afterPick(storySeen: boolean): 'story' | 'game' {
  return storySeen ? 'game' : 'story';
}
