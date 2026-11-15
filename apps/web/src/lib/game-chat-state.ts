import { create } from 'zustand';

/**
 * O chat em cima da partida está aberto (a pessoa clicou nele)? Os jogos olham isto para não tratar as teclas digitadas
 * como controles e para não abrir o menu quando o mouse é solto para clicar no chat.
 */
export const useGameChat = create<{ open: boolean; at: number }>(() => ({ open: false, at: 0 }));

/** O chat abriu ou fechou há pouco? O navegador avisa que o mouse foi solto/preso um instante depois; isso não é pedido de menu. */
export const chatJustChanged = (ms = 700): boolean => performance.now() - useGameChat.getState().at < ms;

export const gameChatOpen = () => useGameChat.getState().open;

/** A tecla foi digitada num campo de texto (o chat)? Então não é controle do jogo. */
export const isTyping = (e: KeyboardEvent): boolean =>
  e.target instanceof HTMLElement && !!e.target.closest('input, textarea');
