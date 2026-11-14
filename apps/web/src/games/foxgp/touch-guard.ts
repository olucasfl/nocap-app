import { useEffect } from 'react';

/**
 * Trava os "recursos" do celular que atrapalham quem joga com os dedos (14/11/2026): lupa e seleção de texto ao segurar,
 * menu de contexto, zoom por pinça (o Safari do iPhone ignora `user-scalable=no`), zoom por toque duplo, arrastar de imagem
 * e a seleção que fica marcada. Só vale enquanto a partida está na tela.
 */
export function useTouchGuard(active = true) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    html.classList.add('gp-playing');
    const stop = (e: Event) => e.preventDefault();
    const inField = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, [contenteditable="true"]');
    const stopUnlessField = (e: Event) => {
      if (!inField(e.target)) e.preventDefault();
    };
    // pinça do iPhone (eventos de gesto do WebKit)
    const gestures = ['gesturestart', 'gesturechange', 'gestureend'] as const;
    for (const g of gestures) document.addEventListener(g, stop, { passive: false });
    document.addEventListener('contextmenu', stopUnlessField);
    document.addEventListener('selectstart', stopUnlessField);
    document.addEventListener('dragstart', stop);
    // pinça (dois dedos) em qualquer navegador
    const multi = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchmove', multi, { passive: false });
    document.addEventListener('touchstart', multi, { passive: false });
    // toque duplo nos botões de jogo: sem zoom
    let lastEnd = 0;
    const dbl = (e: TouchEvent) => {
      const now = Date.now();
      const onPad = e.target instanceof HTMLElement && !!e.target.closest('.gp-pads');
      if (onPad && now - lastEnd < 350) e.preventDefault();
      lastEnd = now;
    };
    document.addEventListener('touchend', dbl, { passive: false });
    // se algo ficar selecionado, desmarca na hora (a lupa do iOS some junto)
    const clear = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && !inField(document.activeElement)) sel.removeAllRanges();
    };
    document.addEventListener('selectionchange', clear);
    return () => {
      html.classList.remove('gp-playing');
      for (const g of gestures) document.removeEventListener(g, stop);
      document.removeEventListener('contextmenu', stopUnlessField);
      document.removeEventListener('selectstart', stopUnlessField);
      document.removeEventListener('dragstart', stop);
      document.removeEventListener('touchmove', multi);
      document.removeEventListener('touchstart', multi);
      document.removeEventListener('touchend', dbl);
      document.removeEventListener('selectionchange', clear);
    };
  }, [active]);
}
