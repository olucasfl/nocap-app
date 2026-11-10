import {
  ATR_ROOM_COLORS,
  GP_DNF_SEC,
  GP_QUALI_MAX_SEC,
  GP_ROOM_GRID_MS,
  GP_ROOM_LIGHTS_MS,
  GP_ROOM_QUALI_COUNT_MS,
  GP_ROOM_STALL_MS,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { ColorRoomEngine, RoomError } from './color-room.engine';
import { FoxGpRoomEngine } from './foxgp-room.engine';

const T0 = 1_000_000;

interface GpSnap {
  stage: string | null;
  qualiAt: number | null;
  raceAt: number | null;
  slots: Record<string, number>;
  colors: Record<string, string>;
  quali: Record<string, number | null>;
  grid: string[];
  finish: Record<string, number>;
  best: Record<string, number>;
  passes: Record<string, number>;
  gone: string[];
  fastest: { id: string; ms: number } | null;
  order: string[] | null;
  dnf: string[];
}

const snap = (room: FoxGpRoomEngine, id = 'ana') =>
  (room.snapshot(id) as unknown as { foxgp: GpSnap }).foxgp;

function started(names = ['ana', 'bia', 'caio']) {
  let t = T0;
  const clock = {
    advance: (ms: number) => (t += ms),
    get now() {
      return t;
    },
  };
  const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed' });
  for (const n of names) room.join(n, n);
  for (const n of names.slice(1)) room.setReady(n, true);
  room.start(names[0]!);
  return { room, clock };
}

/** Passa da contagem: a classificação está valendo. */
function qualifying(names?: string[]) {
  const s = started(names);
  s.clock.advance(GP_ROOM_QUALI_COUNT_MS + 10);
  s.room.tick();
  return s;
}

const pos = (prog: number) => [0, 0, 0, 20, prog, 0, 0, 0.2, 0];

/** Todo mundo marca tempo e a corrida começa (luzes apagadas). */
function racing(times: Record<string, number> = { ana: 41_000, bia: 40_000, caio: 42_000 }) {
  const s = qualifying(Object.keys(times));
  // a volta só vale se couber no tempo que já passou desde o começo da classificação
  s.clock.advance(45_000);
  for (const [id, ms] of Object.entries(times)) {
    s.clock.advance(100);
    s.room.qualiTime(id, { ms });
  }
  s.room.tick();
  s.clock.advance(GP_ROOM_GRID_MS + GP_ROOM_LIGHTS_MS + 10);
  s.room.tick();
  return s;
}

describe('sala do Fox GP', () => {
  it('cada pessoa ganha uma cor diferente ao entrar e troca no lobby sem repetir', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    const c = snap(room).colors;
    expect(c.ana).toBeTruthy();
    expect(c.ana).not.toBe(c.bia);
    expect(() => room.setColor('bia', c.ana!)).toThrow(RoomError);
    const free = ATR_ROOM_COLORS.find((x) => x.hex !== c.ana && x.hex !== c.bia)!.hex;
    room.setColor('bia', free);
    expect(snap(room).colors.bia).toBe(free);
    room.clearColor('bia');
    expect(() => room.setReady('bia', true)).toThrow(RoomError);
  });

  it('quem chega por troca de jogo (sala do Fox Cap!) já ganha cor e pode ficar pronto', () => {
    const before = new ColorRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    before.join('ana', 'ana');
    before.join('bia', 'bia');
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.adoptFrom(before);
    const c = snap(room).colors;
    expect(c.ana).toBeTruthy();
    expect(c.bia).toBeTruthy();
    expect(c.ana).not.toBe(c.bia);
    room.setReady('bia', true);
    room.start('ana');
    expect(room.currentPhase).toBe('show');
  });

  it('não começa com uma pessoa só', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    expect(() => room.start('ana')).toThrow(RoomError);
  });

  it('começa pela contagem da classificação, com as vagas por ordem de entrada', () => {
    const { room, clock } = started();
    expect(room.currentPhase).toBe('show');
    expect(snap(room).stage).toBe('quali');
    expect(snap(room).slots).toEqual({ ana: 0, bia: 1, caio: 2 });
    expect(snap(room).qualiAt).toBe(T0 + GP_ROOM_QUALI_COUNT_MS);
    clock.advance(GP_ROOM_QUALI_COUNT_MS);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('play');
  });

  it('o grid sai dos tempos (menor na frente; empate para quem marcou antes; sem tempo no fim)', () => {
    const { room, clock } = qualifying(['ana', 'bia', 'caio', 'davi']);
    // tempo maior do que já passou na sessão: impossível, ignorado
    clock.advance(30_000);
    room.qualiTime('caio', { ms: 41_000 });
    expect(snap(room).quali.caio).toBeNull();
    clock.advance(14_000);
    room.qualiTime('caio', { ms: 41_000 });
    clock.advance(500);
    room.qualiTime('ana', { ms: 41_000 });
    room.qualiTime('bia', { ms: 40_500 });
    // tempo impossível (curto demais) e repetido são ignorados
    room.qualiTime('davi', { ms: 5_000 });
    room.qualiTime('bia', { ms: 30_000 });
    expect(snap(room).quali).toMatchObject({ bia: 40_500, caio: 41_000, ana: 41_000, davi: null });
    room.tick();
    expect(snap(room).stage).toBe('quali');
    clock.advance(GP_QUALI_MAX_SEC * 1000 - 44_500);
    expect(room.tick()).toBe(true);
    const s = snap(room);
    expect(s.stage).toBe('grid');
    expect(s.grid).toEqual(['bia', 'caio', 'ana', 'davi']);
    expect(s.raceAt).toBe(clock.now + GP_ROOM_GRID_MS + GP_ROOM_LIGHTS_MS);
  });

  it('a classificação acaba antes do tempo se todo mundo já marcou', () => {
    const { room } = racing();
    expect(snap(room).stage).toBe('race');
    expect(snap(room).grid).toEqual(['bia', 'ana', 'caio']);
  });

  it('chegada: valida as voltas, ordena por tempo e o pódio tem a volta mais rápida e as ultrapassagens', () => {
    const { room, clock } = racing();
    clock.advance(130_000);
    // soma das voltas não bate com o tempo: ignorado
    room.finishLine('bia', { ms: 129_000, laps: [40_000, 40_000, 40_000] });
    expect(snap(room).finish.bia).toBeUndefined();
    room.finishLine('bia', { ms: 128_500, laps: [44_000, 42_000, 42_500], passes: 2 });
    room.finishLine('ana', { ms: 129_200, laps: [44_500, 41_900, 42_800] });
    room.lap('caio', { lap: 1, ms: 45_000 });
    room.lap('caio', { lap: 2, ms: 41_000 });
    // volta fora de ordem: ignorada
    room.lap('caio', { lap: 5, ms: 30_000 });
    room.report('caio', pos(2000));
    room.tick();
    const s = snap(room);
    expect(s.finish).toEqual({ bia: 128_500, ana: 129_200 });
    expect(s.fastest).toEqual({ id: 'caio', ms: 41_000 });
    expect(s.passes).toEqual({ bia: 2 });
    expect(room.currentPhase).toBe('play');
  });

  it('30 s depois do primeiro, quem não terminou é DNF, na ordem da distância', () => {
    const { room, clock } = racing({ ana: 41_000, bia: 40_000, caio: 42_000, davi: 43_000 });
    // todos relatando a cada 4 s (sem relato por 12 s o carro sai)
    for (let i = 0; i < 32; i++) {
      clock.advance(4000);
      room.report('bia', pos(3000));
      room.report('ana', pos(2500));
      room.report('caio', pos(1500));
      room.report('davi', pos(1900));
      room.tick();
    }
    room.finishLine('bia', { ms: 128_000, laps: [44_000, 42_000, 42_000] });
    room.tick();
    expect(room.currentPhase).toBe('play');
    for (let i = 0; i < GP_DNF_SEC; i++) {
      clock.advance(1000);
      room.report('ana', pos(2500));
      room.report('caio', pos(1500));
      room.report('davi', pos(1900));
      room.tick();
    }
    expect(room.currentPhase).toBe('final');
    const s = snap(room);
    expect(s.order).toEqual(['bia', 'ana', 'davi', 'caio']);
    expect(s.dnf.sort()).toEqual(['ana', 'caio', 'davi']);
    expect(room.finalRows().map((r) => r.placement)).toEqual([1, 2, 3, 4]);
  });

  it('acaba quando todos terminam', () => {
    const { room, clock } = racing();
    clock.advance(140_000);
    room.finishLine('bia', { ms: 128_000, laps: [44_000, 42_000, 42_000] });
    room.finishLine('ana', { ms: 129_000, laps: [44_000, 42_000, 43_000] });
    room.finishLine('caio', { ms: 131_000, laps: [45_000, 43_000, 43_000] });
    room.tick();
    expect(room.currentPhase).toBe('final');
    expect(snap(room).order).toEqual(['bia', 'ana', 'caio']);
    expect(snap(room).dnf).toEqual([]);
  });

  it('desconectou na corrida: some e é DNF; parado sem relatar também sai', () => {
    const { room, clock } = racing({ ana: 41_000, bia: 40_000, caio: 42_000, davi: 43_000 });
    room.disconnect('caio');
    clock.advance(1000);
    room.report('ana', pos(10));
    room.report('bia', pos(12));
    room.tick();
    expect(snap(room).gone).toContain('caio');
    clock.advance(GP_ROOM_STALL_MS + 100);
    room.report('ana', pos(200));
    room.report('bia', pos(220));
    room.tick();
    expect(snap(room).gone.sort()).toEqual(['caio', 'davi']);
    expect(room.positions().map((p) => p[0])).toEqual([0, 1]);
  });

  it('quem entra com a corrida andando assiste e joga a próxima', () => {
    const { room, clock } = racing();
    expect(room.joinableInPlay).toBe(true);
    room.join('eva', 'eva');
    expect(snap(room, 'eva').slots.eva).toBeUndefined();
    expect(snap(room).colors.eva).toBeTruthy();
    // e não atrapalha o fim
    clock.advance(140_000);
    room.finishLine('bia', { ms: 128_000, laps: [44_000, 42_000, 42_000] });
    room.finishLine('ana', { ms: 129_000, laps: [44_000, 42_000, 43_000] });
    room.finishLine('caio', { ms: 131_000, laps: [45_000, 43_000, 43_000] });
    room.tick();
    expect(room.currentPhase).toBe('final');
    // revanche: todos votam e a eva entra na próxima
    for (const id of ['ana', 'bia', 'caio', 'eva']) room.voteRematch(id, true);
    expect(room.currentPhase).toBe('lobby');
    room.start('ana');
    expect(snap(room).slots.eva).toBe(3);
  });

  it('posições só valem dirigindo e o progresso não passa do que o carro aguenta', () => {
    const { room, clock } = started();
    room.report('ana', pos(0));
    expect(room.positions()).toEqual([]);
    clock.advance(GP_ROOM_QUALI_COUNT_MS + 10);
    room.tick();
    room.report('ana', pos(0));
    expect(room.positions()).toHaveLength(1);
    // relato quebrado é ignorado
    room.report('bia', [1, 2, 3]);
    room.report('caio', [Number.NaN, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(room.positions()).toHaveLength(1);
  });

  it('o líder encerra a partida pelo menu', () => {
    const { room } = racing();
    expect(() => room.endNow('bia')).toThrow(RoomError);
    room.endNow('ana');
    expect(room.currentPhase).toBe('final');
  });

  it('quem simula (o líder) relata posições, voltas e chegada por todos; os outros só por si', () => {
    const { room, clock } = racing();
    clock.advance(1000);
    room.reportAll('ana', [
      [1, 5, 6, 0, 20, 300, 0, 0, 0.1, 0],
      [2, 7, 8, 0, 20, 280, 0, 0, 0.1, 0],
    ]);
    expect(room.positions().map((r) => r[0]).sort()).toEqual([1, 2]);
    // quem não simula não relata pelos outros
    room.reportAll('bia', [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0]]);
    expect(room.positions().find((r) => r[0] === 2)![1]).toBe(7);
    clock.advance(135_000);
    room.lap('ana', { id: 'caio', lap: 1, ms: 45_000 });
    expect(snap(room).best.caio).toBe(45_000);
    room.finishLine('ana', { id: 'bia', ms: 128_500, laps: [44_000, 42_000, 42_500] });
    room.finishLine('caio', { id: 'ana', ms: 120_000, laps: [40_000, 40_000, 40_000] });
    // o caio não relata pela ana (vale como o tempo dele mesmo)
    expect(snap(room).finish.bia).toBe(128_500);
    expect(snap(room).finish.ana).toBeUndefined();
    expect((room.snapshot('ana') as unknown as { foxgp: { host: string } }).foxgp.host).toBe('ana');
  });

  it('se quem simula cai, a partida acaba', () => {
    const { room } = racing();
    room.disconnect('ana');
    room.tick();
    expect(room.currentPhase).toBe('final');
  });

  it('pintura do carro: validada, vai para todos e some com quem sai', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    room.setPaint('ana', { body: '#FF7D26', accent: '#2f5bff', pattern: 'faixa', number: 7 });
    expect(() => room.setPaint('ana', { body: 'red', accent: '#2f5bff', pattern: 'faixa', number: 7 })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { body: '#ff0000', accent: '#2f5bff', pattern: 'xadrez', number: 7 })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { body: '#ff0000', accent: '#2f5bff', pattern: 'faixa', number: 120 })).toThrow(RoomError);
    const paints = (room.snapshot('bia') as unknown as { foxgp: { paints: Record<string, unknown> } }).foxgp.paints;
    expect(paints.ana).toEqual({ body: '#ff7d26', accent: '#2f5bff', pattern: 'faixa', number: 7 });
    room.leave('ana');
    expect((room.snapshot('bia') as unknown as { foxgp: { paints: Record<string, unknown> } }).foxgp.paints.ana).toBeUndefined();
  });

  it('não grava ranking nem histórico', () => {
    const { room } = started();
    expect(room.persistable).toBe(false);
  });
});
