import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal acessível: o foco entra no diálogo, Tab e Shift+Tab ficam dentro dele, Esc chama
 * `onEscape` e, ao fechar, o foco volta para quem abriu.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  // O Esc mais recente, sem refazer o foco a cada render.
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;
    root.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        escape.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [ref]);
}
