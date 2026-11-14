import { expect, it } from 'vitest';
(globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
import { buildCar } from './car-model';
it('decals', () => {
  const car = buildCar({ fur: 0xff7d26, pbr: false });
  const found: number[] = [];
  car.group.traverse((o) => {
    if (o.userData.tag === 'number') {
      const g = (o as unknown as { geometry: { attributes: { position: { count: number } } } }).geometry;
      found.push(g.attributes.position.count);
    }
  });
  console.log('decals', found);
  expect(found.length).toBe(3);
  expect(found.every((n) => n > 6)).toBe(true);
});
