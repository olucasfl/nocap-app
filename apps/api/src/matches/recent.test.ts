import { describe, expect, it, vi } from 'vitest';
import type { MatchesRepository } from './matches.repository';
import { MatchesService, RECENT_MATCHES } from './matches.service';

const item = (i: number) => ({
  matchId: `m${i}`,
  game: 'color',
  mode: 'classic',
  kind: 'solo',
  seed: 'segredo',
  playedAt: `2026-10-10T12:00:0${i}.000Z`,
  totalScore: 200,
  placement: null,
  answers: [1, 2, 3],
});

function setup() {
  const history = vi.fn().mockResolvedValue({ items: [1, 2, 3, 4, 5].map(item), nextCursor: null });
  const repo = {
    playerIdsOf: vi.fn().mockResolvedValue(['p']),
    history,
  } as unknown as MatchesRepository;
  return { service: new MatchesService(repo), history };
}

describe('atividade recente do perfil de um amigo', () => {
  it('pede no máximo as últimas 5, mesmo que peçam mais', async () => {
    expect(RECENT_MATCHES).toBe(5);
    const { service, history } = setup();
    await service.recentOf('u', 20);
    expect(history).toHaveBeenCalledWith(['p'], 5);
    await service.recentOf('u');
    expect(history).toHaveBeenLastCalledWith(['p'], 5);
    await service.recentOf('u', 2);
    expect(history).toHaveBeenLastCalledWith(['p'], 2);
  });

  it('só devolve o que um amigo pode ver: nunca a seed nem as respostas', async () => {
    const { service } = setup();
    const out = await service.recentOf('u');
    expect(out).toHaveLength(5);
    expect(Object.keys(out[0]!).sort()).toEqual(
      ['game', 'kind', 'mode', 'placement', 'playedAt', 'totalScore'].sort(),
    );
  });
});
