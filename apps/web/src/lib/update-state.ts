import { create } from 'zustand';

/**
 * Tem versão nova esperando? O `UpdatePrompt` (que conhece o service worker) avisa aqui para o resto
 * do app saber, por exemplo para a sala não entrar sozinha por um link com a versão velha.
 */
export const useUpdateNeeded = create<{ needed: boolean }>(() => ({ needed: false }));
