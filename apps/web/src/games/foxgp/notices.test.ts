import { describe, expect, it } from 'vitest';
import { GpNoticeQueue, NOTICE_MIN_MS } from './notices';

describe('fila de avisos do Fox GP', () => {
  it('um aviso não atropela o outro: cada um fica pelo menos 2 s', () => {
    const q = new GpNoticeQueue();
    q.push('info', 'Volta 2/3');
    q.push('drs', 'DRS disponível');
    expect(q.tick(0)).toBe(true);
    expect(q.current?.text).toBe('Volta 2/3');
    expect(q.tick(NOTICE_MIN_MS - 1)).toBe(false);
    expect(q.current?.text).toBe('Volta 2/3');
    q.tick(5000);
    expect(q.current?.text).toBe('DRS disponível');
    q.tick(10_000);
    expect(q.current).toBeNull();
  });

  it('não repete o mesmo aviso e não deixa a fila crescer sem fim', () => {
    const q = new GpNoticeQueue();
    q.push('alert', 'Fora da pista');
    q.push('alert', 'Fora da pista');
    q.tick(0);
    q.push('alert', 'Fora da pista');
    for (let i = 0; i < 10; i++) q.push('info', `aviso ${i}`);
    let n = 0;
    for (let t = 1; t < 200_000 && q.current; t += 500) if (q.tick(t * 1)) n++;
    expect(n).toBeLessThanOrEqual(5);
  });

  it('tempo pedido menor que 2 s vira 2 s', () => {
    const q = new GpNoticeQueue();
    q.push('info', 'rápido', 300);
    q.tick(0);
    expect(q.current!.ms).toBe(NOTICE_MIN_MS);
  });
});
