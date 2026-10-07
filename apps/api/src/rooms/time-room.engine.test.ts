import { generateTimeRound } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_SETTINGS, RoomError } from './color-room.engine';
import { TimeRoomEngine } from './time-room.engine';

function started(rounds = 3) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const room = new TimeRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed-t' });
  room.join('ana', 'ana');
  room.join('bia', 'bia');
  room.configure('ana', { rounds });
  room.setReady('bia', true);
  room.start('ana');
  return { room, clock };
}

const target = (i: number) => generateTimeRound('seed-t', DEFAULT_TIME_SETTINGS, i);

describe('TimeRoomEngine', () => {
  it('começa direto na fase de resposta, do jogo do tempo', () => {
    const { room } = started();
    expect(room.currentPhase).toBe('play');
    expect(room.snapshot().game).toBe('time');
  });

  it('o servidor mede o tempo entre COMEÇAR e PARAR e dá nota 10 para o alvo exato', () => {
    const { room, clock } = started();
    room.begin('ana');
    clock.advance(target(0));
    room.stop('ana');
    room.begin('bia');
    clock.advance(target(0) * 2);
    room.stop('bia');
    expect(room.currentPhase).toBe('reveal');
    const results = room.snapshot().round!.results!;
    expect(results.find((r) => r.id === 'ana')).toMatchObject({ answer: target(0), score: 10 });
    expect(results.find((r) => r.id === 'bia')!.score).toBeLessThan(5);
  });

  it('não deixa parar sem ter começado', () => {
    const { room } = started();
    expect(() => room.stop('ana')).toThrow(RoomError);
  });

  it('quem não responde até o limite fica com 0 e a rodada avança', () => {
    const { room, clock } = started();
    room.begin('ana');
    clock.advance(target(0));
    room.stop('ana');
    clock.advance(target(0) * 3 + 9000);
    room.tick();
    expect(room.currentPhase).toBe('reveal');
    const bia = room.snapshot().round!.results!.find((r) => r.id === 'bia')!;
    expect(bia).toMatchObject({ answer: null, score: 0 });
  });

  it('cada modo traz o seu preset; o host ajusta só as rodadas', () => {
    const room = new TimeRoomEngine({ code: 'ABCD', now: () => 0, newSeed: () => 's' });
    room.join('ana', 'ana');
    room.configure('ana', { mode: 'strict' });
    expect(room.currentSettings).toMatchObject({ noOvershoot: true, rounds: 3 });
    room.configure('ana', { mode: 'sequence' });
    expect(room.currentSettings).toMatchObject({
      noOvershoot: false,
      rounds: 5,
      minMs: 2000,
      maxMs: 6000,
    });
    room.configure('ana', { rounds: 7 });
    expect(room.currentSettings).toMatchObject({ rounds: 7 });
    expect(room.snapshot().mode).toBe('sequence');
    expect(() => room.configure('ana', { rounds: 11 })).toThrow(RoomError);
    expect(() => room.configure('ana', { minMs: 1000 })).toThrow(RoomError);
    expect(() => room.configure('ana', { mode: 'survival' })).toThrow(RoomError);
  });

  it('na Sequência os alvos são curtos (2 a 6 s)', () => {
    const room = new TimeRoomEngine({ code: 'ABCD', now: () => 0, newSeed: () => 'seq' });
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    room.configure('ana', { mode: 'sequence' });
    for (let i = 0; i < 5; i++) {
      const t = generateTimeRound('seq', room.currentSettings as typeof DEFAULT_TIME_SETTINGS, i);
      expect(t).toBeGreaterThanOrEqual(2000);
      expect(t).toBeLessThanOrEqual(6000);
    }
  });

  it('chega ao pódio ao fim das rodadas, ordenado pela soma', () => {
    const { room, clock } = started(1);
    room.begin('ana');
    room.begin('bia');
    clock.advance(target(0));
    room.stop('ana');
    clock.advance(target(0));
    room.stop('bia');
    room.next('ana');
    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows[0]).toMatchObject({ userId: 'ana', placement: 1 });
    expect(rows[1]).toMatchObject({ userId: 'bia', placement: 2 });
    expect(rows[0]!.answers).toEqual([target(0)]);
  });
});
