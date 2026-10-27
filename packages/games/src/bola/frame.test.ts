import { describe, expect, it } from 'vitest';
import { packBolaFrame, unpackBolaFrame } from './frame';

describe('quadro compacto do Fut Fox', () => {
  const frame = {
    t: 1_700_000_000_000,
    ph: 'p',
    b: [1.234, 0.9, -4.567, 7.81, -0.02, 3.3],
    p: [
      [
        0, 12.34, 0, -3.21, 4.56, 0, 7.89, 1.57, 5, 123, 0.31, 0.6, -0.8, 100, -50, 2.4, 0.5, -0.8,
        64,
      ],
      [3, -29.5, 2.2, 8.88, -1.1, 6.5, 0.01, -3.14, 0, 7, 0, 0, 0, 0, 0, 3.2, 0, 0, 100],
    ],
    ev: [{ t: 'goal', n: 4 }],
  };

  it('volta quase igual (centésimos) e não mexe no resto do quadro', () => {
    const packed = packBolaFrame(frame);
    expect(packed.q).toBe(1);
    expect((packed.b as number[]).every(Number.isInteger)).toBe(true);
    const back = unpackBolaFrame(packed) as typeof frame & { q?: number };
    expect(back.q).toBeUndefined();
    expect(back.t).toBe(frame.t);
    expect(back.ev).toEqual(frame.ev);
    back.b.forEach((v, i) => expect(v).toBeCloseTo(frame.b[i]!, 2));
    back.p.forEach((r, i) =>
      r.forEach((v, j) =>
        expect(v).toBeCloseTo(
          (frame.p[i] as number[])[j]!,
          j === 0 || j === 8 || j === 9 || j === 13 || j === 14 || j === 18 ? 5 : 2,
        ),
      ),
    );
  });

  it('quadro no formato antigo passa como veio', () => {
    expect(unpackBolaFrame(frame)).toBe(frame);
  });

  it('o compacto é bem menor que o antigo', () => {
    expect(JSON.stringify(packBolaFrame(frame)).length).toBeLessThan(JSON.stringify(frame).length);
  });
});
