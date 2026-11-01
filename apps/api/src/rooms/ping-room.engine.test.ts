import {
  PP_BOT_LEVELS,
  PP_ROOM_COUNTDOWN_MS,
  PP_TICK,
  PpBot,
  PpNetSim,
  createRng,
  type PpNetEvent,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { RoomError } from './color-room.engine';
import { PingRoomEngine } from './ping-room.engine';

const T0 = 1_000_000;
const TICK_MS = PP_TICK * 1000;

function started(names = ['ana', 'bia', 'caio']) {
  let t = T0;
  const clock = {
    set: (ms: number) => (t = ms),
    advance: (ms: number) => (t += ms),
    get now() {
      return t;
    },
  };
  const room = new PingRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed-ping' });
  for (const n of names) room.join(n, n);
  for (const n of names.slice(1)) room.setReady(n, true);
  room.start(names[0]!);
  return { room, clock };
}

const info = (room: PingRoomEngine, id = 'ana') =>
  (
    room.snapshot(id) as unknown as {
      pingpong: {
        players: [string, string] | null;
        startAt: number | null;
        firstServer: number;
        score: number[];
        forfeit: string | null;
      };
    }
  ).pingpong;

describe('sala do Ping Fox!', () => {
  it('começa pela contagem; jogam os 2 primeiros e o terceiro assiste', () => {
    const { room, clock } = started();
    expect(room.currentPhase).toBe('show');
    expect(info(room).players).toEqual(['ana', 'bia']);
    expect(info(room).startAt).toBe(T0 + PP_ROOM_COUNTDOWN_MS);
    clock.advance(PP_ROOM_COUNTDOWN_MS);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('play');
  });

  it('não começa com uma pessoa só', () => {
    const room = new PingRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    expect(() => room.start('ana')).toThrow(RoomError);
  });

  it('dois aparelhos com bots jogam por ela: os três terminam com o mesmo placar', () => {
    const { room, clock } = started(['ana', 'bia']);
    const first = info(room).firstServer;
    const A = new PpNetSim(first, 0);
    const B = new PpNetSim(first, 1);
    const rng = createRng('room-bots');
    const botA = new PpBot(PP_BOT_LEVELS.medio, rng);
    const botB = new PpBot(PP_BOT_LEVELS.medio, rng);
    const start = T0 + PP_ROOM_COUNTDOWN_MS;
    let rejected = 0;
    // 40 s de partida a 60 passos por segundo; os eventos chegam com 3 ticks de atraso
    const queue: { at: number; side: 'a' | 'b' | 's'; ev: PpNetEvent; from?: 'ana' | 'bia' }[] = [];
    for (let n = 1; n <= 60 * 40; n++) {
      clock.set(start + n * TICK_MS);
      room.tick();
      for (let i = queue.length - 1; i >= 0; i--) {
        const m = queue[i]!;
        if (m.at > n) continue;
        queue.splice(i, 1);
        if (m.side === 's') {
          const res = room.receive(m.from!, m.ev);
          if (res.accepted)
            queue.push({ at: n + 3, side: m.from === 'ana' ? 'b' : 'a', ev: res.accepted });
          else if (res.rejected) rejected++;
        } else (m.side === 'a' ? A : B).add(m.ev);
      }
      A.advanceTo(n, botA.input(A.match, 0));
      B.advanceTo(n, botB.input(B.match, 1));
      for (const ev of A.outgoing()) queue.push({ at: n + 3, side: 's', ev, from: 'ana' });
      for (const ev of B.outgoing()) queue.push({ at: n + 3, side: 's', ev, from: 'bia' });
      for (const ev of room.drainOutbox()) {
        queue.push({ at: n + 3, side: 'a', ev });
        queue.push({ at: n + 3, side: 'b', ev });
      }
    }
    const score = info(room).score;
    expect(rejected).toBe(0);
    expect(score[0]! + score[1]!).toBeGreaterThan(3);
    expect([...A.match.score]).toEqual(score);
    expect([...B.match.score]).toEqual(score);
  });

  it('batida de quem não joga, sem estar na sala ou com formato errado é ignorada', () => {
    const { room, clock } = started();
    clock.advance(PP_ROOM_COUNTDOWN_MS + 500);
    room.tick();
    const toss = { k: 'toss', t: room.currentTick(), p: 0, x: 0 };
    expect(room.receive('caio', toss)).toEqual({ accepted: null, rejected: null });
    expect(room.receive('ana', { k: 'nada' })).toEqual({ accepted: null, rejected: null });
    expect(room.receive('ana', null)).toEqual({ accepted: null, rejected: null });
  });

  it('batida de quem não é a vez é recusada', () => {
    const { room, clock } = started(['ana', 'bia']);
    clock.advance(PP_ROOM_COUNTDOWN_MS + 500);
    room.tick();
    const t = room.currentTick();
    const hit = {
      k: 'hit',
      t,
      p: 1,
      serve: false,
      smash: false,
      kmh: 50,
      quality: 'normal',
      assisted: false,
      spin: 0,
      b: [0, 1.4, -2.4, 0, 1, 7, 0, 0, 0],
    };
    expect(room.receive('bia', hit).rejected).toBeTruthy();
    // e ninguém pode bater pelo outro
    expect(room.receive('ana', hit).rejected).toBeTruthy();
  });

  it('quem sai no meio perde: a partida vai ao pódio com o outro em 1º', () => {
    const { room, clock } = started(['ana', 'bia']);
    clock.advance(PP_ROOM_COUNTDOWN_MS + 500);
    room.tick();
    room.leave('ana');
    expect(room.currentPhase).toBe('final');
    expect(room.finalRows()[0]?.userId).toBe('bia');
    expect(room.finalRows()[0]?.placement).toBe(1);
  });

  it('quem cai da rede e não volta em 25 s perde', () => {
    const { room, clock } = started(['ana', 'bia']);
    clock.advance(PP_ROOM_COUNTDOWN_MS + 500);
    room.tick();
    room.disconnect('bia');
    clock.advance(10_000);
    room.tick();
    expect(room.currentPhase).toBe('play');
    clock.advance(20_000);
    room.tick();
    expect(room.currentPhase).toBe('final');
    expect(room.finalRows()[0]?.userId).toBe('ana');
  });
});
