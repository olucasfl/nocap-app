/** Colisão 2D simples: caixas (com rotação opcional) e círculos. y para cima, como no Cocos do Slash. */
export interface BoxShape {
  kind: 'box';
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Rotação em radianos (anti-horária). */
  rot?: number;
}
export interface CircleShape {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}
export type Shape = BoxShape | CircleShape;

function corners(b: BoxShape): [number, number][] {
  const c = Math.cos(b.rot ?? 0);
  const s = Math.sin(b.rot ?? 0);
  const hw = b.w / 2;
  const hh = b.h / 2;
  return (
    [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as [number, number][]
  ).map(([x, y]) => [b.cx + x * c - y * s, b.cy + x * s + y * c] as [number, number]);
}

function project(pts: [number, number][], ax: number, ay: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of pts as [number, number][]) {
    const d = x * ax + y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

function boxBox(a: BoxShape, b: BoxShape): boolean {
  if (!a.rot && !b.rot) {
    return Math.abs(a.cx - b.cx) * 2 < a.w + b.w && Math.abs(a.cy - b.cy) * 2 < a.h + b.h;
  }
  const pa = corners(a);
  const pb = corners(b);
  for (const box of [a, b]) {
    const c = Math.cos(box.rot ?? 0);
    const s = Math.sin(box.rot ?? 0);
    for (const [ax, ay] of [
      [c, s],
      [-s, c],
    ] as [number, number][]) {
      const [a0, a1] = project(pa, ax, ay);
      const [b0, b1] = project(pb, ax, ay);
      if (a1 < b0 || b1 < a0) return false;
    }
  }
  return true;
}

function circleBox(c: CircleShape, b: BoxShape): boolean {
  const cos = Math.cos(-(b.rot ?? 0));
  const sin = Math.sin(-(b.rot ?? 0));
  const dx = c.cx - b.cx;
  const dy = c.cy - b.cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const px = Math.max(-b.w / 2, Math.min(b.w / 2, lx));
  const py = Math.max(-b.h / 2, Math.min(b.h / 2, ly));
  return (lx - px) ** 2 + (ly - py) ** 2 <= c.r * c.r;
}

export function overlaps(a: Shape, b: Shape): boolean {
  if (a.kind === 'box' && b.kind === 'box') return boxBox(a, b);
  if (a.kind === 'circle' && b.kind === 'circle')
    return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 <= (a.r + b.r) ** 2;
  return a.kind === 'circle' ? circleBox(a, b as BoxShape) : circleBox(b as CircleShape, a);
}
