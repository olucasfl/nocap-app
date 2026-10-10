import { describe, expect, it } from 'vitest';
import { presenceOf, type MyRoom } from './my-room';
import type { RoomSnapshot } from './rooms';

const server: MyRoom = {
  code: 'WMHX',
  game: 'eco',
  phase: 'lobby',
  members: 3,
  maxPlayers: 12,
  host: 'bia',
  connected: false,
};

const snapshot = {
  code: 'ABCD',
  game: 'color',
  phase: 'play',
  maxPlayers: 8,
  members: [
    { id: '1', username: 'ana', isHost: false },
    { id: '2', username: 'bia', isHost: true },
  ],
} as unknown as RoomSnapshot;

describe('sala atual da pessoa', () => {
  it('sem sala ao vivo e sem registro no servidor, não há aviso', () => {
    expect(presenceOf(null, 'idle', null)).toBeNull();
    expect(presenceOf(null, 'closed', undefined)).toBeNull();
  });

  it('só o servidor sabe da sala: aparece como "não está ao vivo" para poder voltar', () => {
    expect(presenceOf(null, 'idle', server)).toMatchObject({
      code: 'WMHX',
      game: 'eco',
      live: false,
      members: 3,
      host: 'bia',
    });
  });

  it('a conexão ao vivo manda: usa a sala daqui, mesmo que o servidor diga outra coisa', () => {
    const p = presenceOf(snapshot, 'connected', server);
    expect(p).toMatchObject({ code: 'ABCD', live: true, members: 2, maxPlayers: 8, host: 'bia' });
  });

  it('reconectando continua sendo a mesma sala, marcada como reconectando', () => {
    expect(presenceOf(null, 'reconnecting', server)?.reconnecting).toBe(true);
    expect(presenceOf(snapshot, 'connected', null)?.reconnecting).toBe(false);
  });
});
