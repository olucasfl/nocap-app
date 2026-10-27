import { create } from 'zustand';

/**
 * O chat em cima da partida está aberto (a pessoa clicou nele)? Os jogos olham isto para não tratar as teclas digitadas
 * como controles e para não abrir o menu quando o mouse é solto para clicar no chat.
 */
export const useGameChat = create<{ open: boolean }>(() => ({ open: false }));

export const gameChatOpen = () => useGameChat.getState().open;

/** A tecla foi digitada num campo de texto (o chat)? Então não é controle do jogo. */
export const isTyping = (e: KeyboardEvent): boolean =>
  e.target instanceof HTMLElement && !!e.target.closest('input, textarea');
