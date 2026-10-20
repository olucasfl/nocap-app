import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ProgressRow, WordsProgressRepository } from './words-progress.repository';
import { WordsProgressService } from './words-progress.service';

/** Um repositório em memória que faz o mesmo que o de verdade: junta com o que já existe. */
function memoryRepo() {
  const rows = new Map<string, unknown>();
  const repo = {
    all: async () => [...rows].map(([k, data]) => ({ game: k.split(':')[0]!, level: Number(k.split(':')[1]), data })),
    apply: async (_u: string, incoming: ProgressRow[], merge: (e: unknown, r: ProgressRow) => unknown) => {
      for (const r of incoming) rows.set(`${r.game}:${r.level}`, merge(rows.get(`${r.game}:${r.level}`), r));
    },
  } as unknown as WordsProgressRepository;
  return repo;
}

describe('progresso das fases na conta', () => {
  it('grava a fase e devolve agrupado por jogo', async () => {
    const s = new WordsProgressService(memoryRepo());
    expect(await s.save('u', [{ game: 'classic-c', level: 3, data: { guesses: ['casas'], at: 5 } }])).toEqual({ saved: 1 });
    expect(await s.load('u')).toEqual({ 'classic-c': { '3': { guesses: ['casas'], at: 5 } } });
  });

  it('nunca diminui: um aparelho atrasado não apaga o que o outro já fez', async () => {
    const s = new WordsProgressService(memoryRepo());
    await s.save('u', [{ game: 'bee', level: 1, data: { found: ['casa', 'mesa', 'rosa'], closed: true, at: 9 } }]);
    await s.save('u', [{ game: 'bee', level: 1, data: { found: ['casa'], closed: false, at: 2 } }]);
    const bee = (await s.load('u')).bee!['1'] as { found: string[]; closed: boolean };
    expect(bee.found).toEqual(['casa', 'mesa', 'rosa']);
    expect(bee.closed).toBe(true);
  });

  it('Connect e Classic ficam com a lista de palpites mais longa', async () => {
    const s = new WordsProgressService(memoryRepo());
    await s.save('u', [{ game: 'classic-d', level: 2, data: { guesses: ['casas', 'amigo'], at: 3, done: true } }]);
    await s.save('u', [{ game: 'classic-d', level: 2, data: { guesses: ['casas'], at: 8 } }]);
    expect((await s.load('u'))['classic-d']!['2']).toEqual({ guesses: ['casas', 'amigo'], at: 8, done: true });
  });

  it('recusa jogo, fase ou dado inválido e envio grande demais', async () => {
    const s = new WordsProgressService(memoryRepo());
    await expect(s.save('u', [{ game: 'xadrez', level: 1, data: {} }])).rejects.toThrow(BadRequestException);
    await expect(s.save('u', [{ game: 'bee', level: 0, data: { found: [], closed: false, at: 1 } }])).rejects.toThrow(BadRequestException);
    await expect(s.save('u', [{ game: 'bee', level: 1, data: { found: 'x' } }])).rejects.toThrow(BadRequestException);
    const one = { game: 'bee', level: 1, data: { found: [], closed: false, at: 1 } };
    await expect(s.save('u', Array(501).fill(one))).rejects.toThrow(BadRequestException);
  });

  it('duas versões da mesma fase no mesmo envio também são juntadas', async () => {
    const s = new WordsProgressService(memoryRepo());
    await s.save('u', [
      { game: 'bee', level: 4, data: { found: ['a1'], closed: false, at: 1 } },
      { game: 'bee', level: 4, data: { found: ['b2'], closed: false, at: 2 } },
    ]);
    expect(((await s.load('u')).bee!['4'] as { found: string[] }).found).toEqual(['a1', 'b2']);
  });
});
