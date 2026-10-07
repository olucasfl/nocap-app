import { describe, expect, it } from 'vitest';
import { inviteText, nextInvite, type RoomInvite } from './invites';

const invite = (id: string, from = 'ana'): RoomInvite => ({
  id,
  code: 'ABCD',
  from: { username: from },
  createdAt: '2026-10-06T12:00:00.000Z',
});

describe('convites', () => {
  it('o aviso diz quem chamou e para qual jogo', () => {
    expect(inviteText(invite('1', 'ana'))).toBe('@ana te chamou para uma sala da Cor');
  });

  it('mostra o primeiro (mais novo) que não foi dispensado', () => {
    const list = [invite('1'), invite('2', 'bia')];
    expect(nextInvite(list, new Set())?.id).toBe('1');
    expect(nextInvite(list, new Set(['1']))?.id).toBe('2');
    expect(nextInvite(list, new Set(['1', '2']))).toBeNull();
    expect(nextInvite([], new Set())).toBeNull();
  });
});
