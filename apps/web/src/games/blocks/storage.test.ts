import { beforeEach, describe, expect, it } from 'vitest';
import { clearSavedRun, loadSavedRun, saveRun, type SavedRun } from './storage';

const run = (over: Partial<SavedRun> = {}): SavedRun => ({
  v: 1,
  userId: 'u1',
  matchId: 'm1',
  seed: 'abc',
  session: 'sess',
  moves: [1, 2],
  thumbs: 1,
  perfects: 0,
  hintsUsed: 1,
  before: 100,
  savedAt: 1_000_000,
  ...over,
});

describe('partida guardada do Block Classic', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
      },
    });
  });

  it('volta o que foi guardado', () => {
    saveRun(run());
    expect(loadSavedRun('u1', 1_000_500)?.moves).toEqual([1, 2]);
  });
  it('não entrega a partida de outra conta nem sem conta', () => {
    saveRun(run());
    expect(loadSavedRun('u2', 1_000_500)).toBeNull();
    expect(loadSavedRun(undefined, 1_000_500)).toBeNull();
  });
  it('expira em 6 dias', () => {
    saveRun(run());
    expect(loadSavedRun('u1', 1_000_000 + 6 * 24 * 3600_000 + 1)).toBeNull();
  });
  it('ignora partida sem jogadas ou sem sessão', () => {
    saveRun(run({ moves: [] }));
    expect(loadSavedRun('u1', 1_000_500)).toBeNull();
    saveRun(run({ session: '' }));
    expect(loadSavedRun('u1', 1_000_500)).toBeNull();
  });
  it('limpar apaga', () => {
    saveRun(run());
    clearSavedRun();
    expect(loadSavedRun('u1', 1_000_500)).toBeNull();
  });
});
