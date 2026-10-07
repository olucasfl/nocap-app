import { ECO_TAP_TIMEOUT_MS, leaderCreateMs, leaderTaps, validLeaderSequence } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { EcoLeaderRoomEngine } from './eco-leader-room.engine';

const SEED = 'seed-l';

type Snap = {
  phase: string;
  eco: { leader: string; sequence: number[] | null; participants: string[]; round: number };
  round: { seed: string; results: { id: string; score: number }[] | null };
};

function started(ids = ['ana', 'bia', 'cris'], rounds = 4) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const room = new EcoLeaderRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => SEED });
  ids.forEach((id) => room.join(id, id));
  room.configure(ids[0]!, { rounds });
  ids.slice(1).forEach((id) => room.setReady(id, true));
  room.start(ids[0]!);
  return { room, clock };
}

const snap = (room: EcoLeaderRoomEngine, viewer = 'ana') =>
  room.snapshot(viewer) as unknown as Snap;

/** Cria a sequência válida (a mesma do plano B do servidor) e deixa a reprodução passar. */
function createAndShow(
  room: EcoLeaderRoomEngine,
  clock: { advance: (ms: number) => number },
  round: number,
) {
  const leader = snap(room).eco.leader;
  const seq = validLeaderSequence(SEED, round);
  room.submit(leader, seq);
  clock.advance(600 + leaderTaps(round) * 700 + 1);
  room.tick();
  return { leader, seq };
}

describe('EcoLeaderRoomEngine (Siga o Líder)', () => {
  it('começa na criação, sem a sequência nem a seed para ninguém', () => {
    const { room } = started();
    const s = snap(room);
    expect(s.phase).toBe('create');
    expect(s.round.seed).toBe('');
    expect(s.eco.sequence).toBeNull();
    expect(['ana', 'bia', 'cris']).toContain(s.eco.leader);
    expect(s.eco.participants).not.toContain(s.eco.leader);
  });

  it('só o criador envia e o servidor recusa sequência que quebra a regra', () => {
    const { room } = started();
    const leader = snap(room).eco.leader;
    const other = ['ana', 'bia', 'cris'].find((id) => id !== leader)!;
    expect(() => room.submit(other, [0, 1, 2, 3])).toThrow(/outra pessoa/);
    expect(() => room.submit(leader, [0, 1])).toThrow(/Falta cumprir/);
    expect(() => room.submit(leader, [0, 1, 2, 9])).toThrow(/Falta cumprir/);
  });

  it('depois do envio toca para todos e a sequência aparece só então', () => {
    const { room, clock } = started();
    const leader = snap(room).eco.leader;
    room.submit(leader, validLeaderSequence(SEED, 1));
    expect(room.currentPhase).toBe('show');
    expect(snap(room, 'ana').eco.sequence).toEqual(validLeaderSequence(SEED, 1));
    clock.advance(10_000);
    room.tick();
    expect(room.currentPhase).toBe('play');
  });

  it('seguidores completam, o servidor dá a nota e o criador pontua pelo erro dos outros', () => {
    const { room, clock } = started();
    const { leader, seq } = createAndShow(room, clock, 1);
    const [a, b] = ['ana', 'bia', 'cris'].filter((id) => id !== leader) as [string, string];
    for (const p of seq) room.tap(a, p);
    for (const p of seq.slice(0, 2)) room.tap(b, p);
    room.tap(b, (seq[2]! + 1) % 4);
    expect(room.currentPhase).toBe('reveal');
    const scores = Object.fromEntries(snap(room).round.results!.map((r) => [r.id, r.score]));
    expect(scores[a]).toBe(10);
    expect(scores[b]).toBe(5);
    // média 7,5 → 0,7 × 2,5 = 1,75 → 1,8
    expect(scores[leader]).toBeCloseTo(1.8, 1);
  });

  it('criador que estoura o tempo ganha zero e o servidor monta uma sequência válida', () => {
    const { room, clock } = started();
    const leader = snap(room).eco.leader;
    clock.advance(leaderCreateMs(1) + 1);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('show');
    clock.advance(10_000);
    room.tick();
    for (const id of ['ana', 'bia', 'cris'].filter((x) => x !== leader)) {
      for (const p of validLeaderSequence(SEED, 1)) room.tap(id, p);
    }
    const scores = Object.fromEntries(snap(room).round.results!.map((r) => [r.id, r.score]));
    expect(scores[leader]).toBe(0);
  });

  it('seguidor parado por 8 s fecha a rodada com os acertos que tinha', () => {
    const { room, clock } = started();
    const { leader, seq } = createAndShow(room, clock, 1);
    const [a, b] = ['ana', 'bia', 'cris'].filter((id) => id !== leader) as [string, string];
    for (const p of seq) room.tap(a, p);
    room.tap(b, seq[0]!);
    clock.advance(ECO_TAP_TIMEOUT_MS + 1);
    room.tick();
    expect(room.currentPhase).toBe('reveal');
    const bScore = snap(room).round.results!.find((r) => r.id === b)!.score;
    expect(bScore).toBe(2.5);
  });

  it('o criador muda a cada rodada e a partida termina no total escolhido', () => {
    const { room, clock } = started(['ana', 'bia', 'cris'], 4);
    const leaders: string[] = [];
    for (let round = 1; round <= 4; round++) {
      const { leader, seq } = createAndShow(room, clock, round);
      leaders.push(leader);
      for (const id of ['ana', 'bia', 'cris'].filter((x) => x !== leader)) {
        for (const p of seq) room.tap(id, p);
      }
      clock.advance(9000);
      room.tick();
    }
    expect(room.currentPhase).toBe('final');
    expect(leaders.slice(0, 3).sort()).toEqual(['ana', 'bia', 'cris']);
    expect(room.persistable).toBe(true);
    expect(room.finalRows()).toHaveLength(3);
  });
});

describe('troca de formato no lobby do Ecooo', () => {
  it('leva as pessoas, o líder e o chat para o outro motor e zera o "pronto"', async () => {
    const { EcoRoomEngine } = await import('./eco-room.engine');
    const opts = { code: 'ABCD', now: () => 1_000, newSeed: () => 's' };
    const corrida = new EcoRoomEngine(opts);
    corrida.join('ana', 'ana');
    corrida.join('bia', 'bia');
    corrida.setReady('bia', true);
    corrida.sendChat('ana', 'oi');
    const leader = new EcoLeaderRoomEngine(opts);
    leader.adoptFrom(corrida);
    expect(leader.isHost('ana')).toBe(true);
    expect(leader.snapshot().members.map((m) => m.id)).toEqual(['ana', 'bia']);
    expect(leader.snapshot().members.every((m) => !m.ready)).toBe(true);
    expect(leader.chat.history()).toHaveLength(1);
    expect(leader.snapshot().game).toBe('eco');
    expect(leader.snapshot().mode).toBe('leader');
  });
});
