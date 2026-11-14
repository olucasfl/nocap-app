import { describe, expect, it } from 'vitest';
import { norm, pickDaily } from './home-daily';

const mk = (game: string, plays: number, done = false) => ({ game, plays, done });

describe('desafio do dia', () => {
  it('prefere o jogo mais jogado que ainda não foi feito', () => {
    expect(pickDaily([mk('color', 3), mk('time', 9), mk('eco', 1)], '2026-11-14')?.game).toBe('time');
    expect(pickDaily([mk('color', 3), mk('time', 9, true), mk('eco', 1)], '2026-11-14')?.game).toBe('color');
  });
  it('sem histórico sorteia pelo dia e repete no mesmo dia', () => {
    const l = [mk('color', 0), mk('time', 0), mk('eco', 0), mk('wclassic', 0)];
    const a = pickDaily(l, '2026-11-14')!.game;
    expect(pickDaily(l, '2026-11-14')!.game).toBe(a);
    const days = new Set(Array.from({ length: 20 }, (_, i) => pickDaily(l, `2026-12-${i + 1}`)!.game));
    expect(days.size).toBeGreaterThan(1);
  });
  it('fez todos: não sobra nenhum', () => {
    expect(pickDaily([mk('color', 3, true), mk('time', 9, true)], '2026-11-14')).toBeNull();
    expect(pickDaily([], '2026-11-14')).toBeNull();
  });
  it('a busca ignora acento e caixa', () => {
    expect(norm('Mesmíssima')).toBe('mesmissima');
    expect(norm('Ecooo')).toBe('ecooo');
  });
});
