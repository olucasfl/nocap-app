import { ECO_TAP_TIMEOUT_MS, ecoPresets, expectedTaps, playbackMs } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { EcoRoomEngine } from './eco-room.engine';

const SEED = 'seed-e';

function started(ids = ['ana', 'bia', 'cris']) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const room = new EcoRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => SEED });
  ids.forEach((id) => room.join(id, id));
  ids.slice(1).forEach((id) => room.setReady(id, true));
  room.start(ids[0]!);
  return { room, clock };
}

const snap = (room: EcoRoomEngine) =>
  room.snapshot('ana') as unknown as {
    round: { seed: string };
    eco: { sequence: number[]; alive: string[]; round: number };
  };

const expected = (round: number) => expectedTaps(SEED, ecoPresets.classic, round);
const wrong = (round: number) => (expected(round)[0]! + 1) % 4;

/** Deixa a reprodução da rodada passar e abre a fase de repetir. */
function play(room: EcoRoomEngine, clock: { advance: (ms: number) => number }, round: number) {
  clock.advance(600 + playbackMs(ecoPresets.classic, round) + 1);
  room.tick();
}

function tapAll(room: EcoRoomEngine, id: string, round: number) {
  for (const pad of expected(round)) room.tap(id, pad);
}

describe('EcoRoomEngine (Corrida)', () => {
  it('começa mostrando a sequência, sem entregar a seed', () => {
    const { room } = started();
    const s = snap(room);
    expect(room.currentPhase).toBe('show');
    expect(s.round.seed).toBe('');
    expect(s.eco.sequence).toEqual(expected(1));
  });

  it('quem erra vira plateia; a rodada fecha quando todos resolvem', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    expect(room.currentPhase).toBe('play');
    tapAll(room, 'ana', 1);
    tapAll(room, 'bia', 1);
    room.tap('cris', wrong(1));
    expect(room.currentPhase).toBe('reveal');
    const eco = snap(room).eco;
    expect(eco.alive.sort()).toEqual(['ana', 'bia']);
  });

  it('ficar 8 s parado derruba quem não tocou', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    tapAll(room, 'ana', 1);
    tapAll(room, 'bia', 1);
    clock.advance(ECO_TAP_TIMEOUT_MS + 1);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('reveal');
    expect(snap(room).eco.alive).not.toContain('cris');
  });

  it('acaba quando sobra uma pessoa, e ela vence', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    tapAll(room, 'ana', 1);
    room.tap('bia', wrong(1));
    room.tap('cris', wrong(1));
    clock.advance(5000);
    room.tick();
    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows[0]).toMatchObject({ userId: 'ana', placement: 1, totalTenths: 10 });
    expect(rows.slice(1).every((r) => r.placement === 2 && r.totalTenths === 0)).toBe(true);
  });

  it('com dois ainda de pé, a partida segue para a próxima rodada', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    tapAll(room, 'ana', 1);
    tapAll(room, 'bia', 1);
    room.tap('cris', wrong(1));
    clock.advance(5000);
    room.tick();
    expect(room.currentPhase).toBe('show');
    expect(snap(room).eco.round).toBe(2);
  });

  it('desempata por toques certos na rodada da queda', () => {
    const { room, clock } = started(['ana', 'bia', 'cris']);
    play(room, clock, 1);
    tapAll(room, 'ana', 1);
    tapAll(room, 'bia', 1);
    tapAll(room, 'cris', 1);
    clock.advance(5000);
    room.tick();
    play(room, clock, 2);
    tapAll(room, 'ana', 2);
    // bia acerta o primeiro toque e erra o segundo; cris erra logo no primeiro.
    room.tap('bia', expected(2)[0]!);
    room.tap('bia', (expected(2)[1]! + 1) % 4);
    room.tap('cris', wrong(2));
    clock.advance(5000);
    room.tick();
    expect(room.currentPhase).toBe('final');
    const order = room.finalRows().map((r) => `${r.userId}:${r.placement}`);
    expect(order).toEqual(['ana:1', 'bia:2', 'cris:3']);
  });

  it('ignora toque antes da hora e de quem já caiu; recusa botão inexistente', () => {
    const { room, clock } = started();
    expect(() => room.tap('ana', 0)).not.toThrow();
    play(room, clock, 1);
    expect(() => room.tap('ana', 99)).toThrow(/inválido/);
    room.tap('cris', wrong(1));
    expect(() => room.tap('cris', expected(1)[0]!)).not.toThrow();
  });
});
