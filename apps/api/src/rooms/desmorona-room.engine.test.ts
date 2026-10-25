import { DSM_ROOM_COUNTDOWN_MS, DSM_ROOM_MAX_SEC, DSM_ROOM_STALL_MS } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { RoomError } from './color-room.engine';
import { DesmoronaRoomEngine } from './desmorona-room.engine';

const T0 = 1_000_000;

function started(names = ['ana', 'bia', 'caio']) {
  let t = T0;
  const clock = { advance: (ms: number) => (t += ms), get now() { return t; } };
  const room = new DesmoronaRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed' });
  for (const n of names) room.join(n, n);
  for (const n of names.slice(1)) room.setReady(n, true);
  room.start(names[0]!);
  return { room, clock };
}

/** Passa da contagem e dos primeiros segundos (a queda inicial). */
function racing(names?: string[]) {
  const s = started(names);
  s.clock.advance(DSM_ROOM_COUNTDOWN_MS + 2000);
  s.room.tick();
  return s;
}

const snap = (room: DesmoronaRoomEngine, id = 'ana') => (room.snapshot(id) as unknown as { desmorona: { dead: Record<string, number>; slots: Record<string, number>; startAt: number | null; winnerId: string | null } }).desmorona;

describe('sala do Desmorona!', () => {
  it('aceita de 2 a 8 pessoas e começa pela contagem, com vagas por ordem de entrada', () => {
    const { room, clock } = started();
    expect(room.currentPhase).toBe('show');
    expect(snap(room).slots).toEqual({ ana: 0, bia: 1, caio: 2 });
    expect(snap(room).startAt).toBe(T0 + DSM_ROOM_COUNTDOWN_MS);
    clock.advance(DSM_ROOM_COUNTDOWN_MS);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('play');
  });

  it('não começa com uma pessoa só', () => {
    const room = new DesmoronaRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    expect(() => room.start('ana')).toThrow(RoomError);
  });

  it('o primeiro a pisar fixa a hora do ladrilho; repetição e ladrilho fora da arena são ignorados', () => {
    const { room, clock } = racing();
    room.step('ana', { l: 0, q: 1, r: 0 });
    clock.advance(500);
    room.step('bia', { l: 0, q: 1, r: 0 });
    room.step('bia', { l: 0, q: 99, r: 0 });
    room.step('bia', { l: 9, q: 0, r: 0 });
    const out = room.drainSteps();
    expect(out).toHaveLength(1);
    expect(out[0]!.slice(0, 3)).toEqual([0, 1, 0]);
    expect(out[0]![3]).toBeGreaterThanOrEqual(1900);
    expect(room.drainSteps()).toEqual([]);
    expect(room.allSteps()).toHaveLength(1);
  });

  it('posição inválida é ignorada e a válida entra no fluxo pos', () => {
    const { room } = racing();
    room.report('ana', [1, 'x', 0, 0, 0, 0, 1]);
    room.report('ana', [9999, 0, 0, 0, 0, 0, 1]);
    expect(room.positions()).toEqual([]);
    room.report('ana', [1, 2, 3, 0.5, 0.5, 1, 1]);
    expect(room.positions()).toEqual([[0, 1, 2, 3, 0.5, 0.5, 1, 1]]);
  });

  it('a morte só vale depois da queda inicial, e o último vivo vence', () => {
    const s = started();
    s.clock.advance(DSM_ROOM_COUNTDOWN_MS + 200);
    s.room.tick();
    s.room.die('bia');
    expect(snap(s.room).dead).toEqual({});
    s.clock.advance(3000);
    s.room.die('bia');
    s.clock.advance(1000);
    s.room.die('caio');
    expect(s.room.tick()).toBe(true);
    expect(s.room.currentPhase).toBe('final');
    expect(snap(s.room).winnerId).toBe('ana');
    const rows = s.room.finalRows();
    expect(rows.map((r) => [r.userId, r.placement])).toEqual([
      ['ana', 1],
      ['caio', 2],
      ['bia', 3],
    ]);
  });

  it('quem sai ou some no meio da partida cai; sem relato por muito tempo também', () => {
    const { room, clock } = racing(['ana', 'bia', 'caio']);
    room.leave('bia');
    expect(Object.keys(snap(room).dead)).toContain('bia');
    clock.advance(DSM_ROOM_STALL_MS + 1000);
    room.report('ana', [0, 0, 0, 0, 0, 0, 1]);
    room.tick();
    expect(room.currentPhase).toBe('final');
  });

  it('no limite de tempo todos os vivos dividem o 1º lugar', () => {
    const { room, clock } = racing(['ana', 'bia']);
    for (let i = 0; i < DSM_ROOM_MAX_SEC / 5; i++) {
      clock.advance(5000);
      room.report('ana', [0, 0, 0, 0, 0, 0, 1]);
      room.report('bia', [0, 0, 0, 0, 0, 0, 1]);
      room.tick();
    }
    expect(room.currentPhase).toBe('final');
    expect(room.finalRows().map((r) => r.placement)).toEqual([1, 1]);
  });

  it('atraso de 300 ms nas mensagens não muda quem vence nem a ordem das quedas', () => {
    const play = (lag: number) => {
      const { room, clock } = racing();
      const script: [number, string][] = [
        [1000, 'caio'],
        [2500, 'bia'],
      ];
      let elapsed = 0;
      for (const [at, who] of script) {
        clock.advance(at - elapsed + lag);
        elapsed = at;
        room.die(who);
        room.tick();
      }
      return room.finalRows().map((r) => r.userId);
    };
    expect(play(300)).toEqual(play(0));
  });

  it('a revanche volta ao lobby sem estado da partida anterior', () => {
    const { room, clock } = racing(['ana', 'bia']);
    clock.advance(1000);
    room.die('bia');
    room.tick();
    expect(room.currentPhase).toBe('final');
    room.voteRematch('ana', true);
    room.voteRematch('bia', true);
    expect(room.currentPhase).toBe('lobby');
    expect(snap(room).dead).toEqual({});
    expect(room.drainSteps()).toEqual([]);
  });

  it('o empurrão vai só para quem foi empurrado, limitado e com espera entre dois', () => {
    const { room, clock } = racing();
    room.push('ana', { to: 'bia', kx: 100, kz: 0 });
    room.push('ana', { to: 'bia', kx: 5, kz: 0 });
    room.push('ana', { to: 'ana', kx: 5, kz: 0 });
    room.push('ana', { to: 'zzz', kx: 5, kz: 0 });
    room.push('ana', { to: 'bia', kx: 'x', kz: 0 });
    const out = room.drainPushes();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ to: 'bia', from: 0 });
    expect(Math.hypot(out[0]!.kx, out[0]!.kz)).toBeLessThanOrEqual(13.01);
    clock.advance(1000);
    room.push('ana', { to: 'bia', kx: 5, kz: 0 });
    expect(room.drainPushes()).toHaveLength(1);
  });
});
