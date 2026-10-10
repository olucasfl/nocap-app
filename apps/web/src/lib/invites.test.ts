import { describe, expect, it } from 'vitest';
import { inviteIsDead, inviteQueue, inviteText, pickCurrent, type RoomInvite } from './invites';

const invite = (
  id: string,
  from = 'ana',
  code = 'ABCD',
  at = '2026-10-06T12:00:00.000Z',
): RoomInvite => ({
  id,
  code,
  from: { username: from },
  createdAt: at,
});

describe('convites', () => {
  it('o aviso diz quem chamou', () => {
    expect(inviteText(invite('1', 'ana'))).toBe('@ana te chamou para uma sala');
  });

  it('a fila vai do mais antigo ao mais novo, sem os dispensados', () => {
    const list = [
      invite('c', 'caio', 'CCCC', '2026-10-06T12:00:03.000Z'),
      invite('b', 'bia', 'BBBB', '2026-10-06T12:00:02.000Z'),
      invite('a', 'ana', 'AAAA', '2026-10-06T12:00:01.000Z'),
    ];
    expect(inviteQueue(list, new Set()).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(inviteQueue(list, new Set(['a'])).map((i) => i.id)).toEqual(['b', 'c']);
    expect(inviteQueue(list, new Set(['a', 'b', 'c']))).toEqual([]);
    expect(inviteQueue([], new Set())).toEqual([]);
  });

  it('várias pessoas chamando para a mesma sala viram um aviso só (o mais novo)', () => {
    const list = [
      invite('2', 'bia', 'ABCD', '2026-10-06T12:00:05.000Z'),
      invite('1', 'ana', 'ABCD', '2026-10-06T12:00:01.000Z'),
    ];
    const queue = inviteQueue(list, new Set());
    expect(queue).toHaveLength(1);
    expect(queue[0]!.id).toBe('2');
  });

  it('o aviso da tela não é trocado por um que chegou depois; só sai quando acaba', () => {
    const first = invite('a', 'ana', 'AAAA', '2026-10-06T12:00:01.000Z');
    const second = invite('b', 'bia', 'BBBB', '2026-10-06T12:00:02.000Z');
    expect(pickCurrent(inviteQueue([first], new Set()), null)?.id).toBe('a');
    // Chegou outro enquanto o primeiro está na tela: o primeiro fica.
    expect(pickCurrent(inviteQueue([second, first], new Set()), 'a')?.id).toBe('a');
    // O primeiro foi aceito ou recusado: entra o seguinte.
    expect(pickCurrent(inviteQueue([second, first], new Set(['a'])), 'a')?.id).toBe('b');
    expect(pickCurrent([], 'a')).toBeNull();
  });

  it('reconhece o erro de convite que não tem mais conserto', () => {
    expect(inviteIsDead('Não achamos essa sala. Confira o código.')).toBe(true);
    expect(inviteIsDead('A sala está cheia.')).toBe(true);
    expect(inviteIsDead('A partida dessa sala já começou.')).toBe(true);
    expect(inviteIsDead('Sem conexão')).toBe(false);
  });
});
