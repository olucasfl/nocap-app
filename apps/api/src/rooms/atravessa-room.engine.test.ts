import {
  ATR_IDLE_KILL_TICKS,
  ATR_ROOM_COLORS,
  ATR_ROOM_COUNTDOWN_MS,
  AtravessaSim,
  atravessaRoomRules,
  type AtravessaInput,
  type AtravessaRoomMode,
  type Dir,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { RoomError } from './color-room.engine';
import {
  ATRAVESSA_FINISH_GRACE_MS,
  ATRAVESSA_REVEAL_MS,
  ATRAVESSA_STALL_MS,
  AtravessaRoomEngine,
  POS_ALIVE,
  POS_FINISHED,
  POS_STALLED,
} from './atravessa-room.engine';

const T0 = 1_000_000;

function lobby(names = ['ana', 'bia']) {
  let t = T0;
  const clock = {
    set: (ms: number) => (t = ms),
    advance: (ms: number) => (t += ms),
    get now() {
      return t;
    },
  };
  const room = new AtravessaRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 's2' });
  for (const n of names) room.join(n, n);
  return { room, clock };
}

function started(opts: { names?: string[]; mode?: AtravessaRoomMode; rounds?: number; size?: string } = {}) {
  const { room, clock } = lobby(opts.names);
  const cfg: Record<string, unknown> = {};
  if (opts.mode) cfg.mode = opts.mode;
  if (opts.rounds) cfg.rounds = opts.rounds;
  if (opts.size) cfg.size = opts.size;
  if (Object.keys(cfg).length) room.configure('ana', cfg as never);
  for (const n of opts.names ?? ['ana', 'bia']) if (n !== 'ana') room.setReady(n, true);
  room.start('ana');
  return { room, clock, names: opts.names ?? ['ana', 'bia'] };
}

const startAt = () => T0 + ATR_ROOM_COUNTDOWN_MS;
const msAt = (tick: number) => startAt() + Math.ceil((tick * 1000) / 60);

/** Um jogador simples: pula para a frente de tempos em tempos e de lado de vez em quando. */
function plan(seed: string, mode: AtravessaRoomMode, ticks: number, every: number, slot = 0): AtravessaInput[] {
  const sim = new AtravessaSim(seed, undefined, atravessaRoomRules(mode, 'pequeno', slot));
  const inputs: AtravessaInput[] = [];
  while (!sim.halted && sim.tick < ticks) {
    if (sim.alive && sim.tick % every === 0) {
      const d: Dir = sim.tick % 70 === 0 ? 2 : sim.tick % 91 === 0 ? 3 : 0;
      inputs.push({ t: sim.tick + 1, d });
      sim.input(d);
    }
    sim.step();
  }
  return inputs;
}

/** Um herói que só anda de lado na primeira linha (sem tráfego): fica vivo enquanto os passos durarem. */
function sidePlan(ticks: number): AtravessaInput[] {
  const out: AtravessaInput[] = [];
  for (let t = 10, i = 0; t < ticks; t += 60, i++) out.push({ t, d: i % 2 === 0 ? 2 : 3 });
  return out;
}

const tickNow = (clock: { now: number }) => Math.floor(((clock.now - startAt()) * 60) / 1000);

/**
 * Faz os aparelhos relatarem de 6 em 6 ticks (10 por segundo), cada um com os passos do seu plano,
 * e deixa a sala andar. Os planos acabam sozinhos quando o herói morre; depois disso o aparelho
 * continua repetindo o mesmo tick.
 */
function drive(
  room: AtravessaRoomEngine,
  clock: { set(ms: number): number },
  plans: Record<string, AtravessaInput[]>,
  upTo: number,
  from = 0,
) {
  const acked: Record<string, number> = {};
  for (const id of Object.keys(plans)) acked[id] = 0;
  for (let t = from + 6; t <= upTo; t += 6) {
    clock.set(msAt(t));
    for (const [id, list] of Object.entries(plans)) {
      const batch = list.filter((i) => i.t <= t).slice(acked[id]!);
      const n = room.report(id, t, batch, acked[id]);
      if (n !== null) acked[id] = n;
    }
    room.tick();
    if (room.currentPhase !== 'play') return;
  }
}

describe('AtravessaRoomEngine · lobby', () => {
  it('começa no Infinito com 3 rodadas, é do jogo atravessa e não guarda histórico', () => {
    const { room } = lobby();
    const s = room.snapshot('ana');
    expect(s.game).toBe('atravessa');
    expect(s.mode).toBe('infinito');
    expect(s.settings).toMatchObject({ rounds: 3, size: 'medio' });
    expect(s.maxPlayers).toBe(8);
    expect(room.persistable).toBe(false);
    expect((s as unknown as { atravessa: { mode: string } }).atravessa.mode).toBe('infinito');
  });

  it('só o líder muda as regras; Infinito de 1 a 10 rodadas', () => {
    const { room } = lobby();
    expect(() => room.configure('bia', { rounds: 5 })).toThrow(RoomError);
    room.configure('ana', { rounds: 10 });
    expect(room.snapshot().settings.rounds).toBe(10);
    expect(() => room.configure('ana', { rounds: 11 })).toThrow(RoomError);
    expect(() => room.configure('ana', { rounds: 0 })).toThrow(RoomError);
    expect(() => room.configure('ana', { mode: 'nao-existe' })).toThrow(RoomError);
    expect(() => room.configure('ana', { size: 'imenso' } as never)).toThrow(RoomError);
  });

  it('o Checkpoint é uma corrida só, com o tamanho do mapa; voltar ao Infinito volta às 3 rodadas', () => {
    const { room } = lobby();
    room.configure('ana', { mode: 'checkpoint', size: 'gigante' } as never);
    expect(room.snapshot().settings).toMatchObject({ rounds: 1, size: 'gigante' });
    const extra = (room.snapshot() as unknown as { atravessa: { length: number; checkpoints: number[] } }).atravessa;
    expect(extra.length).toBe(1000);
    expect(extra.checkpoints).toEqual([50, 100, 150, 200, 275, 350, 425, 500, 600, 700, 800, 900]);
    expect(() => room.configure('ana', { rounds: 3 })).toThrow(RoomError);
    room.configure('ana', { mode: 'infinito' });
    expect(room.snapshot().settings).toMatchObject({ rounds: 3, size: 'gigante' });
  });

  it('cabem 8 pessoas', () => {
    const { room } = lobby(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    expect(() => room.join('a9', 'a9')).toThrow(RoomError);
  });

  it('cada pessoa recebe uma cor diferente e pode trocar por uma livre', () => {
    const { room } = lobby(['ana', 'bia', 'caio']);
    const colors = (room.snapshot() as unknown as { atravessa: { colors: Record<string, string> } }).atravessa.colors;
    expect(new Set(Object.values(colors)).size).toBe(3);
    const free = ATR_ROOM_COLORS.find((c) => !Object.values(colors).includes(c.hex))!;
    room.setReady('bia', true);
    room.setColor('bia', free.hex);
    expect(room.snapshot().members.find((m) => m.id === 'bia')!.ready).toBe(false);
    expect(() => room.setColor('ana', free.hex)).toThrow(RoomError);
    expect(() => room.setColor('ana', '#123456')).toThrow(RoomError);
  });

  it('a cor só muda no lobby e fica depois da revanche', () => {
    const { room } = started();
    expect(() => room.setColor('ana', ATR_ROOM_COLORS[5]!.hex)).toThrow(RoomError);
  });
});

describe('AtravessaRoomEngine · largada', () => {
  it('conta 3-2-1 com hora marcada, e a seed da rodada vai no snapshot', () => {
    const { room } = started();
    expect(room.currentPhase).toBe('show');
    const s = room.snapshot('ana') as unknown as {
      round: { seed: string; index: number; total: number };
      atravessa: { startAt: number; slots: Record<string, number> };
    };
    expect(s.atravessa.startAt).toBe(startAt());
    expect(s.round.seed).toBe('s2:r0');
    expect(s.atravessa.slots).toEqual({ ana: 0, bia: 1 });
  });

  it('vira corrida na hora marcada e não antes', () => {
    const { room, clock } = started();
    clock.set(startAt() - 1);
    expect(room.tick()).toBe(false);
    expect(room.currentPhase).toBe('show');
    clock.set(startAt());
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('play');
  });

  it('relato antes da hora marcada não vale; no instante da largada vale, mesmo antes da fase virar', () => {
    const { room, clock } = started();
    clock.set(startAt() - 10);
    expect(room.report('ana', 0, [], 0)).toBeNull();
    clock.set(startAt() + 100);
    expect(room.report('ana', 6, [], 0)).toBe(0);
  });

  it('o chat fecha na largada e na corrida', () => {
    const { room, clock } = started();
    expect(room.snapshot().chat.open).toBe(false);
    clock.set(startAt());
    room.tick();
    expect(room.snapshot().chat.open).toBe(false);
  });
});

describe('AtravessaRoomEngine · relatos', () => {
  function playing() {
    const r = started();
    r.clock.set(startAt());
    r.room.tick();
    return r;
  }

  it('o servidor confirma quantos passos aceitou e reenvios não duplicam nada', () => {
    const { room, clock } = playing();
    clock.set(msAt(60));
    // dois passos de lado, na primeira linha (sem tráfego)
    expect(room.report('ana', 30, [{ t: 10, d: 2 }, { t: 20, d: 3 }], 0)).toBe(2);
    // o aparelho não viu a confirmação e reenvia tudo, com mais um passo
    expect(room.report('ana', 50, [{ t: 10, d: 2 }, { t: 20, d: 3 }, { t: 40, d: 2 }], 0)).toBe(3);
    // pulou um número: recusa e continua esperando o passo certo
    expect(room.report('ana', 55, [{ t: 52, d: 3 }], 5)).toBeNull();
    expect(room.report('ana', 55, [{ t: 52, d: 3 }], 3)).toBe(4);
  });

  it('recusa relato inválido, de quem não joga ou além do relógio da sala', () => {
    const { room, clock } = playing();
    clock.set(msAt(60));
    expect(room.report('ana', 'x', [], 0)).toBeNull();
    expect(room.report('ana', 30, [{ t: 40, d: 2 }], 0)).toBeNull();
    expect(room.report('ana', 30, [{ t: 5, d: 9 }], 0)).toBeNull();
    expect(room.report('fantasma', 30, [], 0)).toBeNull();
    // o relógio da sala está no tick 60: 60 + folga de 90 é o máximo
    expect(room.report('ana', 200, [], 0)).toBeNull();
    expect(room.report('ana', 140, [], 0)).toBe(0);
  });

  it('as posições têm o formato combinado e mostram quem está vivo', () => {
    const { room, clock } = playing();
    clock.set(msAt(60));
    room.report('ana', 60, [{ t: 10, d: 3 }], 0);
    const pos = room.positions();
    expect(pos).toHaveLength(2);
    const ana = pos.find((p) => p[0] === 0)!;
    expect(ana).toHaveLength(11);
    expect(ana[1]).toBe(60);
    expect(ana[2]).toBe(1); // um passo para a direita
    expect(ana[6]! & POS_ALIVE).toBe(POS_ALIVE);
    // bia nunca relatou: o servidor ainda a vê na largada
    expect(pos.find((p) => p[0] === 1)![1]).toBe(0);
  });
});

describe('AtravessaRoomEngine · Infinito', () => {
  it('quem morre fica parado; a rodada acaba quando todos morreram; a soma dos metros decide', () => {
    const { room, clock } = started({ rounds: 2 });
    clock.set(startAt());
    room.tick();
    const plans = {
      ana: plan('s2:r0', 'infinito', 60 * 60, 12),
      bia: plan('s2:r0', 'infinito', 60 * 60, 25, 1),
    };
    drive(room, clock, plans, 60 * 60);
    // depois de morrer ou ficar parado 12 s, os dois estão fora: placar da rodada
    expect(room.currentPhase).toBe('reveal');
    const reveal = room.snapshot() as unknown as {
      atravessa: { roundMeters: Record<string, number>; totals: Record<string, number> };
    };
    expect(reveal.atravessa.roundMeters.ana).toBeGreaterThan(0);
    expect(reveal.atravessa.totals).toEqual(reveal.atravessa.roundMeters);

    // a revelação passa sozinha e vem a segunda rodada, com outra seed
    clock.advance(ATRAVESSA_REVEAL_MS);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('show');
    expect((room.snapshot() as unknown as { round: { seed: string } }).round.seed).toBe('s2:r1');
  });

  it('fecha o pódio com a soma das rodadas, sem placar entre a última rodada e o pódio', () => {
    const { room, clock } = started({ rounds: 1 });
    clock.set(startAt());
    room.tick();
    const plans = {
      ana: plan('s2:r0', 'infinito', 60 * 60, 10),
      bia: plan('s2:r0', 'infinito', 60 * 60, 30, 1),
    };
    drive(room, clock, plans, 60 * 60);
    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.totalTenths).toBeGreaterThanOrEqual(rows[1]!.totalTenths);
    expect(rows[0]!.placement).toBe(1);
    const fin = (room.snapshot() as unknown as {
      final: { userId: string; totalTenths: number }[];
      atravessa: { results: Record<string, { meters: number }> };
    });
    for (const r of fin.final) expect(fin.atravessa.results[r.userId]!.meters * 10).toBe(r.totalTenths);
  });

  it('quem some não segura a rodada: depois de 8 s sem relato ela fecha com a distância que tinha', () => {
    const { room, clock } = started({ rounds: 1 });
    clock.set(startAt());
    room.tick();
    // bia nunca relata; ana joga até morrer
    drive(room, clock, { ana: plan('s2:r0', 'infinito', 60 * 60, 12) }, 60 * 60);
    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows[0]!.userId).toBe('ana');
    expect(rows[1]!.totalTenths).toBe(0);
  });

  it('se ninguém joga, o Infinito acaba sozinho (parado 12 s e depois o prazo de 8 s)', () => {
    const { room, clock } = started({ rounds: 1 });
    clock.set(startAt() + ATRAVESSA_STALL_MS + 1000);
    room.tick(); // vira corrida
    room.tick(); // ninguém relatou: todos parados
    expect(room.currentPhase).toBe('final');
    expect(ATR_IDLE_KILL_TICKS).toBe(720);
  });

  it('o líder pode encerrar a rodada, ninguém mais', () => {
    const { room, clock } = started({ rounds: 1 });
    clock.set(startAt());
    room.tick();
    drive(room, clock, { ana: sidePlan(600), bia: sidePlan(600) }, 6 * 5);
    expect(() => room.endRound('bia')).toThrow(RoomError);
    expect(room.currentPhase).toBe('play');
    room.endRound('ana');
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('final');
  });

  it('quem sai no meio de uma partida de dois volta o lobby', () => {
    const { room, clock } = started();
    clock.set(startAt());
    room.tick();
    room.leave('bia');
    expect(room.currentPhase).toBe('lobby');
    expect(room.snapshot().members.map((m) => m.id)).toEqual(['ana']);
  });

  it('a revanche volta ao lobby mantendo as cores', () => {
    const { room, clock } = started({ rounds: 1 });
    const before = (room.snapshot() as unknown as { atravessa: { colors: Record<string, string> } }).atravessa.colors;
    clock.set(startAt() + ATRAVESSA_STALL_MS + 1000);
    room.tick();
    room.tick();
    expect(room.currentPhase).toBe('final');
    room.voteRematch('ana', true);
    room.voteRematch('bia', true);
    expect(room.currentPhase).toBe('lobby');
    expect((room.snapshot() as unknown as { atravessa: { colors: Record<string, string> } }).atravessa.colors).toEqual(before);
  });
});

describe('AtravessaRoomEngine · Checkpoint', () => {
  it('é uma corrida só, sem placar entre rodadas, e o primeiro a chegar abre o prazo dos outros', () => {
    const { room, clock } = started({ mode: 'checkpoint', size: 'pequeno' });
    clock.set(startAt());
    room.tick();
    const sims = (room as unknown as {
      runs: Map<string, { mirror: { sim: { finished: boolean; finishTick: number; best: number } } }>;
    }).runs;
    // ana chegou ao fim; bia continua jogando
    const ana = sims.get('ana')!.mirror.sim;
    ana.finished = true;
    ana.finishTick = 3000;
    ana.best = 100;
    clock.set(msAt(3000));
    expect(room.report('bia', 3000, [], 0)).toBe(0);
    expect(room.tick()).toBe(true); // publica o prazo
    const snap = room.snapshot() as unknown as { atravessa: { endsAt: number } };
    expect(snap.atravessa.endsAt).toBe(clock.now + ATRAVESSA_FINISH_GRACE_MS);
    expect(room.currentPhase).toBe('play');
    // bia segue relatando sem acabar; o prazo vence e a corrida fecha
    clock.set(snap.atravessa.endsAt - 1);
    expect(room.report('bia', tickNow(clock), [], 0)).toBe(0);
    expect(room.tick()).toBe(false);
    clock.set(snap.atravessa.endsAt);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('final');
  });

  it('o pódio põe quem chegou por tempo e depois os outros por distância', () => {
    const { room, clock } = started({ names: ['ana', 'bia', 'caio', 'duda'], mode: 'checkpoint', size: 'pequeno' });
    clock.set(startAt());
    room.tick();
    const runs = (room as unknown as {
      runs: Map<string, { mirror: { sim: { finished: boolean; finishTick: number; best: number; deaths: number } } }>;
    }).runs;
    const set = (id: string, v: { finished?: boolean; finishTick?: number; best: number; deaths?: number }) =>
      Object.assign(runs.get(id)!.mirror.sim, v);
    set('ana', { best: 100, finished: true, finishTick: 4000 });
    set('bia', { best: 100, finished: true, finishTick: 3500 });
    set('caio', { best: 60, deaths: 3 });
    set('duda', { best: 60, deaths: 1 });
    room.endRound('ana');
    clock.advance(100);
    room.tick();
    expect(room.currentPhase).toBe('final');
    expect(room.finalRows().map((r) => [r.userId, r.placement])).toEqual([
      ['bia', 1],
      ['ana', 2],
      ['duda', 3],
      ['caio', 4],
    ]);
    const results = (room.snapshot() as unknown as {
      atravessa: { results: Record<string, { ms: number | null; finished: boolean }> };
    }).atravessa.results;
    expect(results.bia).toMatchObject({ finished: true, ms: Math.round((3500 * 1000) / 60) });
    expect(results.caio).toMatchObject({ finished: false, ms: null });
  });

  it('a posição inclui o fim e o checkpoint de cada um', () => {
    const { room, clock } = started({ mode: 'checkpoint', size: 'pequeno' });
    clock.set(startAt());
    room.tick();
    const ana = (room as unknown as {
      runs: Map<string, { mirror: { sim: { finished: boolean; finishTick: number; checkpointRow: number } } }>;
    }).runs.get('ana')!.mirror.sim;
    ana.finished = true;
    ana.finishTick = 777;
    ana.checkpointRow = 50;
    const p = room.positions().find((x) => x[0] === 0)!;
    expect(p[6]! & POS_FINISHED).toBe(POS_FINISHED);
    expect(p[9]).toBe(50);
    expect(p[10]).toBe(777);
    expect(POS_STALLED).toBe(4);
  });
});
