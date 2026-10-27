import type { Dir } from '@nocap/games';
import { isTyping } from '@/lib/game-chat-state';

/** Quanto o dedo precisa andar (px) para valer como deslize. Menos que isso é toque. */
export const SWIPE_MIN = 22;

/**
 * O que um gesto quer dizer: toque = frente; deslizar = a direção do lado maior. `null` = ainda não
 * andou o suficiente para decidir.
 */
export function swipeDir(dx: number, dy: number, min = SWIPE_MIN): Dir | null {
  if (Math.hypot(dx, dy) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 2 : 3;
  return dy < 0 ? 0 : 1;
}

export const KEY_DIR: Record<string, Dir> = {
  w: 0,
  arrowup: 0,
  s: 1,
  arrowdown: 1,
  a: 2,
  arrowleft: 2,
  d: 3,
  arrowright: 3,
};

export interface Controls {
  /** Alguma vez usou o teclado (some a dica). */
  usedKeys(): boolean;
  dispose(): void;
}

/**
 * Teclado (W A S D e setas) e toque (toque = frente, deslizar = direção). O deslize vale assim que o
 * dedo passa do limite, sem esperar soltar: o pulo sai na hora. Segurar a tecla repete o pulo.
 */
export function attachControls(el: HTMLElement, onDir: (d: Dir) => void): Controls {
  let usedKeys = false;
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    const d = KEY_DIR[e.key.toLowerCase()];
    if (d === undefined) return;
    e.preventDefault();
    usedKeys = true;
    onDir(d);
  };
  window.addEventListener('keydown', onKey);

  let start: { id: number; x: number; y: number; done: boolean } | null = null;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    start = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
  };
  const move = (e: PointerEvent) => {
    if (!start || start.id !== e.pointerId || start.done) return;
    const d = swipeDir(e.clientX - start.x, e.clientY - start.y);
    if (d === null) return;
    start.done = true;
    onDir(d);
  };
  const up = (e: PointerEvent) => {
    if (!start || start.id !== e.pointerId) return;
    if (!start.done) onDir(0);
    start = null;
  };
  const cancel = () => {
    start = null;
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);

  return {
    usedKeys: () => usedKeys,
    dispose() {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    },
  };
}
