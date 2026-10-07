import { describe, expect, it } from 'vitest';
import { CHAT_HISTORY } from './chat';
import { ColorRoomEngine, RoomError } from './color-room.engine';
import { ImpostorRoomEngine } from './impostor/impostor-room.engine';
import { TimeRoomEngine } from './time-room.engine';

function make<T extends ColorRoomEngine>(
  Engine: new (o: ConstructorParameters<typeof ColorRoomEngine>[0]) => T,
) {
  let t = 1_000;
  const room = new Engine({ code: 'ABCD', now: () => t, newSeed: () => 's' });
  room.join('ana', 'ana');
  room.join('bia', 'bia');
  return { room, wait: (ms: number) => (t += ms) };
}

describe('chat da sala', () => {
  it('só membro escreve e a mensagem sai com o @ de quem enviou', () => {
    const { room } = make(ColorRoomEngine);
    expect(room.sendChat('ana', '  oi   gente ')).toMatchObject({
      username: 'ana',
      text: 'oi gente',
    });
    expect(() => room.sendChat('zed', 'oi')).toThrow(RoomError);
  });

  it('recusa vazio, mais de 200 caracteres e limpa caracteres de controle', () => {
    const { room, wait } = make(ColorRoomEngine);
    expect(() => room.sendChat('ana', '   ')).toThrow(RoomError);
    expect(() => room.sendChat('ana', 'a'.repeat(201))).toThrow(/longa/);
    expect(room.sendChat('ana', 'a\u0000b\nc').text).toBe('a b c');
    wait(1000);
    expect(room.sendChat('ana', 'a'.repeat(200)).text).toHaveLength(200);
  });

  it('limita o ritmo: 1 por segundo e 5 a cada 10 segundos', () => {
    const { room, wait } = make(ColorRoomEngine);
    room.sendChat('ana', '1');
    expect(() => room.sendChat('ana', '2')).toThrow(/Calma/);
    for (let i = 0; i < 4; i++) {
      wait(1000);
      room.sendChat('ana', 'x');
    }
    wait(1000);
    expect(() => room.sendChat('ana', 'sexta')).toThrow(/Calma/);
    wait(10_000);
    expect(room.sendChat('ana', 'de novo').text).toBe('de novo');
  });

  it('guarda só as últimas 50', () => {
    const { room, wait } = make(ColorRoomEngine);
    for (let i = 0; i < CHAT_HISTORY + 5; i++) {
      wait(10_000);
      room.sendChat(i % 2 ? 'ana' : 'bia', `m${i}`);
    }
    const h = room.chat.history();
    expect(h).toHaveLength(CHAT_HISTORY);
    expect(h[0]!.text).toBe('m5');
  });

  it('o líder silencia e libera; os outros não podem', () => {
    const { room } = make(ColorRoomEngine);
    expect(() => room.muteMember('bia', 'ana')).toThrow(RoomError);
    expect(room.muteMember('ana', 'bia')).toBe(true);
    expect(room.snapshot().chat.muted).toEqual(['bia']);
    expect(() => room.sendChat('bia', 'oi')).toThrow(/silenciou/);
    expect(room.muteMember('ana', 'bia')).toBe(false);
    expect(room.sendChat('bia', 'oi').text).toBe('oi');
  });

  it('no Já Deu? fecha durante a contagem', () => {
    const { room } = make(TimeRoomEngine);
    expect(room.snapshot().chat.open).toBe(true);
    room.setReady('bia', true);
    room.start('ana');
    expect(room.currentPhase).toBe('play');
    expect(room.snapshot().chat.open).toBe(false);
    expect(() => room.sendChat('ana', 'oi')).toThrow(/fechado/);
  });

  it('no Intruso só abre fora das rodadas', () => {
    let t = 1_000;
    const room = new ImpostorRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 's' });
    for (const id of ['ana', 'bia', 'cris']) room.join(id, id);
    expect(room.snapshot('ana').chat.open).toBe(true);
    room.setReady('bia', true);
    room.setReady('cris', true);
    room.start('ana');
    expect(room.snapshot('ana').chat.open).toBe(false);
    t += 1;
    expect(() => room.sendChat('ana', 'a cor é azul')).toThrow(/fechado/);
  });
});
