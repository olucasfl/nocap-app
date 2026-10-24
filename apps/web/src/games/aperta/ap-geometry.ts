/**
 * Geometria do Aperta! com a tela girada: no celular em pé o jogo inteiro (`.ap`) é girado 90 graus por CSS, então
 * `getBoundingClientRect` e os eventos de ponteiro vêm no espaço da tela, e o layout (posições absolutas) vive no espaço
 * do jogo. Aqui se converte um no outro (sem giro a matriz é a identidade e nada muda). A raiz `.ap` fica em 0,0 da tela.
 */

export interface LocalRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function root(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('.ap');
}

function inverseOf(ap: HTMLElement | null): DOMMatrix | null {
  if (!ap || typeof DOMMatrix === 'undefined') return null;
  const t = getComputedStyle(ap).transform;
  if (!t || t === 'none') return null;
  try {
    return new DOMMatrix(t).inverse();
  } catch {
    return null;
  }
}

/** O retângulo de `el` nas coordenadas do jogo (as da raiz `.ap`), mesmo com a raiz girada. */
export function localRect(el: Element): LocalRect {
  const r = el.getBoundingClientRect();
  const inv = inverseOf(root(el));
  if (!inv) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  const a = inv.transformPoint({ x: r.left, y: r.top });
  const b = inv.transformPoint({ x: r.right, y: r.bottom });
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** Um ponto da tela (ex.: `clientX`, `clientY`) nas coordenadas do jogo. */
export function localPoint(el: Element, x: number, y: number): { x: number; y: number } {
  const inv = inverseOf(root(el));
  if (!inv) return { x, y };
  const p = inv.transformPoint({ x, y });
  return { x: p.x, y: p.y };
}

/** Um deslocamento da tela (ex.: o arrasto do dedo) nas direções do jogo. */
export function localDelta(el: Element, dx: number, dy: number): { x: number; y: number } {
  const inv = inverseOf(root(el));
  if (!inv) return { x: dx, y: dy };
  return { x: inv.a * dx + inv.c * dy, y: inv.b * dx + inv.d * dy };
}
