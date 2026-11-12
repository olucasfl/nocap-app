import {
  GP_DNF_SEC,
  GP_LIGHTS_HOLD_MAX,
  GP_LIGHTS_HOLD_MIN,
  GP_MAX_PLAYERS,
  GP_QUALI_MAX_SEC,
  GP_ROOM_GRID_MS,
  GP_ROOM_LIGHTS_MS,
  GP_ROOM_QUALI_COUNT_MS,
  GP_ROOM_STALL_MS,
  gpDefaultKartPaint,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { ColorRoomEngine, RoomError } from './color-room.engine';
import { FoxGpRoomEngine } from './foxgp-room.engine';

const T0 = 1_000_000;
/** Um carro válido (pelo, F1 e kart da garagem). */
const CAR = {
  fur: 0xff7d26,
  f1: { body: 0xff7d26, accent: 0x2f5bff, pattern: 'faixa', number: 7 },
  kart: gpDefaultKartPaint(),
};

interface GpSnap {
  stage: string | null;
  qualiAt: number | null;
  raceAt: number | null;
  holdMs: number | null;
  physics: string;
  slots: Record<string, number>;
  colors: Record<string, string>;
  quali: Record<string, number | null>;
  grid: string[];
  finish: Record<string, number>;
  best: Record<string, number>;
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
  s.clock.advance(GP_ROOM_GRID_MS + GP_ROOM_LIGHTS_MS + GP_LIGHTS_HOLD_MAX * 1000 + 10);
  s.room.tick();
  return s;
}

describe('sala do Fox GP', () => {
  it('sem escolher cor: dá para ficar pronto e começar; quem chega por troca de jogo também', () => {
    const before = new ColorRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    before.join('ana', 'ana');
    before.join('bia', 'bia');
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.adoptFrom(before);
    room.setReady('bia', true);
    room.start('ana');
    expect(room.currentPhase).toBe('show');
  });

  it('regra Física: Arcade por padrão, só o líder troca, só Arcade ou Realista', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    expect(snap(room).physics).toBe('arcade');
    expect(() => room.configure('bia', { physics: 'real' } as never)).toThrow(RoomError);
    expect(() => room.configure('ana', { physics: 'drift' } as never)).toThrow(RoomError);
    room.configure('ana', { physics: 'real' } as never);
    expect(snap(room, 'bia').physics).toBe('real');
    expect(room.physics).toBe('real');
  });

  it('até 12 na sala (a 13ª vaga é recusada); 12 pessoas com o mesmo carro entram sem erro', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    const ids = Array.from({ length: GP_MAX_PLAYERS }, (_, i) => `p${i}`);
    for (const id of ids) room.join(id, id);
    expect(() => room.join('extra', 'extra')).toThrow(RoomError);
    for (const id of ids) room.setPaint(id, CAR);
    expect(new Set(Object.values(snap(room).colors)).size).toBe(1);
    for (const id of ids.slice(1)) room.setReady(id, true);
    room.start('p0');
    expect(Object.keys(snap(room).slots).length).toBe(GP_MAX_PLAYERS);
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
    // a espera com as luzes acesas é sorteada pelo servidor (uma para todos)
    expect(s.holdMs).toBeGreaterThanOrEqual(GP_LIGHTS_HOLD_MIN * 1000);
    expect(s.holdMs).toBeLessThanOrEqual(GP_LIGHTS_HOLD_MAX * 1000);
    expect(s.raceAt).toBe(clock.now + GP_ROOM_GRID_MS + GP_ROOM_LIGHTS_MS + s.holdMs!);
  });

  it('a classificação acaba antes do tempo se todo mundo já marcou', () => {
    const { room } = racing();
    expect(snap(room).stage).toBe('race');
    expect(snap(room).grid).toEqual(['bia', 'ana', 'caio']);
  });

  it('chegada: valida as voltas, ordena por tempo e o pódio tem a volta mais rápida', () => {
    const { room, clock } = racing();
    clock.advance(130_000);
    // soma das voltas não bate com o tempo: ignorado
    room.finishLine('bia', { ms: 129_000, laps: [40_000, 40_000, 40_000] });
    expect(snap(room).finish.bia).toBeUndefined();
    room.finishLine('bia', { ms: 128_500, laps: [44_000, 42_000, 42_500] });
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

  it('o carro de cada um (pelo, F1 e kart): validado pelas listas, vai para todos e some com quem sai', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    room.setPaint('ana', CAR);
    expect(() => room.setPaint('ana', { ...CAR, fur: 0x123456 })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { ...CAR, f1: { ...CAR.f1, body: 0x123456 } })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { ...CAR, f1: { ...CAR.f1, pattern: 'xis' } })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { ...CAR, f1: { ...CAR.f1, number: 120 } })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { ...CAR, kart: { ...CAR.kart, finish: 'cromado' } })).toThrow(RoomError);
    expect(() => room.setPaint('ana', { fur: CAR.fur, f1: CAR.f1 })).toThrow(RoomError);
    const paints = (room.snapshot('bia') as unknown as { foxgp: { paints: Record<string, unknown> } }).foxgp.paints;
    expect(paints.ana).toEqual(CAR);
    expect(snap(room, 'bia').colors.ana).toBe('#ff7d26');
    room.leave('ana');
    expect((room.snapshot('bia') as unknown as { foxgp: { paints: Record<string, unknown> } }).foxgp.paints.ana).toBeUndefined();
  });

  it('bots completam a sala (12.4): até o total escolhido, nunca mais que 12, com nome e carro; não seguram o fim', () => {
    let t = T0;
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed' });
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    expect(() => room.configure('bia', { fill: 6 } as never)).toThrow(RoomError);
    expect(() => room.configure('ana', { fill: 13 } as never)).toThrow(RoomError);
    expect(() => room.configure('ana', { botLevel: 'insano' } as never)).toThrow(RoomError);
    room.configure('ana', { fill: 6, botLevel: 'dificil' } as never);
    room.setReady('bia', true);
    room.start('ana');
    const st = (room.snapshot('ana') as unknown as { foxgp: { slots: Record<string, number>; bots: { id: string; name: string }[]; paints: Record<string, unknown>; botLevel: string } }).foxgp;
    expect(Object.keys(st.slots).length).toBe(6);
    expect(st.bots.length).toBe(4);
    expect(st.botLevel).toBe('dificil');
    for (const b of st.bots) expect(st.paints[b.id]).toBeTruthy();
    // a classificação não espera os bots: as duas pessoas marcam e o grid sai
    t += GP_ROOM_QUALI_COUNT_MS + 10;
    room.tick();
    t += 30_000;
    room.qualiTime('ana', { ms: 29_000 });
    room.qualiTime('bia', { ms: 29_500 });
    room.tick();
    expect((room.snapshot('ana') as unknown as { foxgp: { stage: string } }).foxgp.stage).toBe('grid');
  });

  it('com 12 pessoas e total 12, nenhum bot entra', () => {
    const room = new FoxGpRoomEngine({ code: 'ABCD', now: () => T0, newSeed: () => 's' });
    const ids = Array.from({ length: GP_MAX_PLAYERS }, (_, i) => `p${i}`);
    for (const id of ids) room.join(id, id);
    room.configure('p0', { fill: 12 } as never);
    for (const id of ids.slice(1)) room.setReady(id, true);
    room.start('p0');
    expect(Object.keys(snap(room).slots).length).toBe(GP_MAX_PLAYERS);
  });

  it('não grava ranking nem histórico', () => {
    const { room } = started();
    expect(room.persistable).toBe(false);
  });
});
