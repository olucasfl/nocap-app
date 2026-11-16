import { describe, expect, it } from 'vitest';
import { gpPreviewId } from '@/games/foxgp/TrackPreview';
import { rulesSummary } from './rules';
import type { RoomSnapshot } from '@/lib/rooms';

const snap = (foxgp: Record<string, unknown>, settings: Record<string, unknown> = {}) =>
  ({
    game: 'foxgp',
    mode: 'classico',
    settings: { rounds: 1, ...settings },
    members: [],
    foxgp,
  }) as unknown as RoomSnapshot;

describe('Fox GP no lobby: a pista segue o modo (spec 086)', () => {
  it('Arcade com poderes é a Castle Circuit; sem poderes, a Bala Track; Realista usa a escolhida', () => {
    expect(gpPreviewId('arcade', null, true)).toBe('castle');
    expect(gpPreviewId('arcade', 'castle', false)).toBe('bala');
    expect(gpPreviewId('real', 'interlagos', false)).toBe('interlagos');
    expect(gpPreviewId('real', 'castle', true)).toBe('marina');
  });

  it('o resumo da sala diz a pista certa para todos', () => {
    expect(rulesSummary(snap({ physics: 'arcade', powers: true }))).toContain('Castle Circuit');
    expect(rulesSummary(snap({ physics: 'arcade', powers: false }))).toContain('Bala Track');
    expect(rulesSummary(snap({ physics: 'real', track: 'interlagos' }))).toContain('Interlagos');
  });
});
