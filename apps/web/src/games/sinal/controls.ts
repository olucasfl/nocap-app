import { joyCenter, type Layout } from './camera';

/** No celular, o analógico fixo à direita; no computador, W A S D e as setas. */
export interface Controls {
  /** O vetor do analógico no mundo: x para a direita e y para a frente, de -1 a 1. */
  vector(): [number, number];
  /** Posição do pino do analógico na tela (-1 a 1) e se o dedo está nele. */
  joy(): { dx: number; dy: number; active: boolean };
  /** Alguma tecla já foi usada (some a dica das teclas). */
  usedKeys(): boolean;
  /** O aparelho é de toque (mostra o analógico). */
  touch(): boolean;
  dispose(): void;
}

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

export function attachControls(el: HTMLElement, getLayout: () => Layout): Controls {
  const down = new Set<string>();
  let touch = isTouchDevice();
  let usedKeys = false;
  let pid: number | null = null;
  let jx = 0;
  let jy = 0;

  const setFrom = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    const c = joyCenter(getLayout());
    const dx = (e.clientX - rect.left - c.x) / c.r;
    const dy = (e.clientY - rect.top - c.y) / c.r;
    const len = Math.sqrt(dx * dx + dy * dy);
    jx = len > 1 ? dx / len : dx;
    jy = len > 1 ? dy / len : dy;
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') touch = true;
    if (!touch || pid !== null) return;
    const rect = el.getBoundingClientRect();
    const c = joyCenter(getLayout());
    const d = Math.hypot(e.clientX - rect.left - c.x, e.clientY - rect.top - c.y);
    // A área de toque é bem maior que o desenho: o polegar acha o analógico sem olhar.
    if (d > c.r * 2.1) return;
    pid = e.pointerId;
    el.setPointerCapture(e.pointerId);
    setFrom(e);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId === pid) setFrom(e);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = null;
    jx = 0;
    jy = 0;
  };
  const onKey = (e: KeyboardEvent) => {
    if (!(e.code in KEYS)) return;
    e.preventDefault();
    usedKeys = true;
    down.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    down.delete(e.code);
  };
  const clear = () => {
    down.clear();
    pid = null;
    jx = 0;
    jy = 0;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);

  return {
    vector() {
      if (pid !== null) return [jx, -jy];
      let x = 0;
      let y = 0;
      for (const code of down) {
        x += KEYS[code]![0];
        y += KEYS[code]![1];
      }
      return [x, y];
    },
    joy: () => ({ dx: jx, dy: jy, active: pid !== null }),
    usedKeys: () => usedKeys,
    touch: () => touch,
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
    },
  };
}
