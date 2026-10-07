import { ECO_TAP_TIMEOUT_MS, ecoPresets, expectedTaps, playbackMs } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { EcoRoomEngine } from './eco-room.engine';

const SEED = 'seed-e';

type Snap = {
  round: { seed: string };
  eco: { sequence: number[]; alive: string[]; round: number; turn: string; queue: string[] };
};

function started(ids = ['ana', 'bia', 'cris']) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const room = new EcoRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => SEED });
  ids.forEach((id) => room.join(id, id));
  ids.slice(1).forEach((id) => room.setReady(id, true));
  room.start(ids[0]!);
  return { room, clock };
}

const snap = (room: EcoRoomEngine) => room.snapshot('ana') as unknown as Snap;
const expected = (round: number) => expectedTaps(SEED, ecoPresets.classic, round);
const wrongPad = (round: number) => (expected(round)[0]! + 1) % 4;

/** Deixa a reprodução da vez passar e abre a fase de repetir. */
function play(room: EcoRoomEngine, clock: { advance: (ms: number) => number }, round: number) {
  clock.advance(1800 + 600 + playbackMs(ecoPresets.classic, round) + 1);
  room.tick();
}

/** Quem está na vez acerta a sequência inteira. */
function winTurn(room: EcoRoomEngine, round: number) {
  const who = snap(room).eco.turn;
  for (const pad of expected(round)) room.tap(who, pad);
  return who;
}

describe('EcoRoomEngine (por vez, em fila)', () => {
  it('começa mostrando a sequência para todos, sem entregar a seed, com um passo só', () => {
    const { room } = started();
    const s = snap(room);
    expect(room.currentPhase).toBe('show');
    expect(s.round.seed).toBe('');
    expect(s.eco.sequence).toEqual(expected(1));
    expect(s.eco.sequence).toHaveLength(1);
    expect(s.eco.turn).toBe('ana');
    expect(s.eco.queue).toEqual(['ana', 'bia', 'cris']);
  });

  it('só quem está na vez toca; o toque dos outros é ignorado', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    room.tap('bia', wrongPad(1));
    expect(room.currentPhase).toBe('play');
    expect(snap(room).eco.alive).toHaveLength(3);
  });

  it('acertou: passa para o próximo da fila, com a mesma sequência e um passo a mais', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    winTurn(room, 1);
    expect(room.currentPhase).toBe('reveal');
    clock.advance(3000);
    room.tick();
    const s = snap(room);
    expect(room.currentPhase).toBe('show');
    expect(s.eco.turn).toBe('bia');
    expect(s.eco.round).toBe(2);
    expect(s.eco.sequence).toEqual(expected(2));
    expect(s.eco.sequence.slice(0, 1)).toEqual(expected(1));
  });

  it('errou: sai da disputa e a fila segue sem ele', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    winTurn(room, 1);
    clock.advance(3000);
    room.tick();
    play(room, clock, 2);
    room.tap('bia', wrongPad(2));
    expect(snap(room).eco.alive.sort()).toEqual(['ana', 'cris']);
    clock.advance(3000);
    room.tick();
    expect(snap(room).eco.turn).toBe('cris');
    expect(snap(room).eco.queue).toEqual(['cris', 'ana']);
  });

  it('ficar 8 s parado na sua vez derruba', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    clock.advance(ECO_TAP_TIMEOUT_MS + 1);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('reveal');
    expect(snap(room).eco.alive).not.toContain('ana');
  });

  it('acaba quando sobra um, que vence; quem caiu por último fica em segundo', () => {
    const { room, clock } = started(['ana', 'bia', 'cris']);
    // ana cai na vez 1, bia cai na vez 2, cris sobra.
    play(room, clock, 1);
    room.tap('ana', wrongPad(1));
    clock.advance(3000);
    room.tick();
    play(room, clock, 2);
    expect(snap(room).eco.turn).toBe('bia');
    room.tap('bia', wrongPad(2));
    clock.advance(3000);
    room.tick();
    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows.map((r) => `${r.userId}:${r.placement}`)).toEqual(['cris:1', 'bia:2', 'ana:3']);
  });

  it('a pontuação do pódio é o tamanho da última sequência que a pessoa completou', () => {
    const { room, clock } = started(['ana', 'bia']);
    play(room, clock, 1);
    winTurn(room, 1);
    clock.advance(3000);
    room.tick();
    play(room, clock, 2);
    room.tap('bia', wrongPad(2));
    clock.advance(3000);
    room.tick();
    const rows = room.finalRows();
    expect(rows[0]).toMatchObject({ userId: 'ana', placement: 1, totalTenths: 10 });
    expect(rows[1]).toMatchObject({ userId: 'bia', placement: 2, totalTenths: 0 });
  });

  it('recusa botão inexistente de quem está na vez', () => {
    const { room, clock } = started();
    play(room, clock, 1);
    expect(() => room.tap('ana', 99)).toThrow(/inválido/);
  });
});
