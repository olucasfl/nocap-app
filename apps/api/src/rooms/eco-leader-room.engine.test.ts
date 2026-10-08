import {
  ECO_TAP_TIMEOUT_MS,
  LEADER_ANNOUNCE_MS,
  leaderCreateMs,
  leaderTaps,
  validLeaderSequence,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { EcoLeaderRoomEngine } from './eco-leader-room.engine';

const SEED = 'seed-l';

type Snap = {
  phase: string;
  eco: {
    leader: string;
    sequence: number[] | null;
    participants: string[];
    round: number;
    announceMs?: number;
    timedOut?: boolean;
    hits?: Record<string, number>;
  };
  round: { seed: string; results: { id: string; score: number }[] | null };
};

function started(ids = ['ana', 'bia', 'cris'], rounds = 3) {
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
  clock.advance(600 + leaderTaps(SEED, round) * 700 + 1);
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

  it('terminou a rodada, já vem o próximo criador: sem tela de resultado nem notas no meio', () => {
    const { room, clock } = started();
    const { leader, seq } = createAndShow(room, clock, 1);
    for (const id of ['ana', 'bia', 'cris'].filter((x) => x !== leader)) {
      for (const p of seq) room.tap(id, p);
    }
    const s = snap(room);
    expect(room.currentPhase).toBe('create');
    expect(s.eco.round).toBe(2);
    expect(s.eco.leader).not.toBe(leader);
    expect(s.eco.announceMs).toBe(LEADER_ANNOUNCE_MS);
    expect(s.round.results).toBeNull();
  });

  it('criador que estoura o tempo: o servidor monta uma sequência válida e toca para todos', () => {
    const { room, clock } = started();
    // O aviso "O LÍDER É ..." não conta no tempo de criar.
    clock.advance(LEADER_ANNOUNCE_MS + leaderCreateMs(3) - 1);
    expect(room.tick()).toBe(false);
    clock.advance(2);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('show');
    expect(snap(room).eco.timedOut).toBe(true);
    expect(snap(room, 'ana').eco.sequence).toEqual(validLeaderSequence(SEED, 1));
  });

  it('só no pódio aparece a soma de acertos; seguidor parado por 8 s conta os que acertou', () => {
    const { room, clock } = started(['ana', 'bia', 'cris'], 3);
    const expected: Record<string, number> = { ana: 0, bia: 0, cris: 0 };
    for (let round = 1; round <= 3; round++) {
      const { leader, seq } = createAndShow(room, clock, round);
      const followers = ['ana', 'bia', 'cris'].filter((x) => x !== leader);
      expect(snap(room).eco.hits).toBeUndefined();
      for (const p of seq) room.tap(followers[0]!, p);
      expected[followers[0]!]! += seq.length;
      if (round === 1) {
        // O segundo seguidor acerta um toque e para.
        room.tap(followers[1]!, seq[0]!);
        expected[followers[1]!]! += 1;
        clock.advance(ECO_TAP_TIMEOUT_MS + 1);
        room.tick();
      } else {
        for (const p of seq) room.tap(followers[1]!, p);
        expected[followers[1]!]! += seq.length;
      }
    }
    expect(room.currentPhase).toBe('final');
    expect(snap(room).eco.hits).toEqual(expected);
  });

  it('o criador muda a cada rodada e a partida termina no total escolhido', () => {
    const { room, clock } = started(['ana', 'bia', 'cris'], 3);
    const leaders: string[] = [];
    for (let round = 1; round <= 3; round++) {
      const { leader, seq } = createAndShow(room, clock, round);
      leaders.push(leader);
      for (const id of ['ana', 'bia', 'cris'].filter((x) => x !== leader)) {
        for (const p of seq) room.tap(id, p);
      }
    }
    expect(room.currentPhase).toBe('final');
    expect(leaders.slice(0, 3).sort()).toEqual(['ana', 'bia', 'cris']);
    expect(room.persistable).toBe(true);
    expect(room.finalRows()).toHaveLength(3);
  });
});

describe('nota final por porcentagem', () => {
  it('é a média das rodadas jogadas: criar uma rodada fácil ou difícil não decide sozinho', () => {
    const { room, clock } = started(['ana', 'bia', 'cris'], 3);
    for (let round = 1; round <= 3; round++) {
      const { leader, seq } = createAndShow(room, clock, round);
      for (const id of ['ana', 'bia', 'cris'].filter((x) => x !== leader)) {
        for (const p of seq) room.tap(id, p);
      }
    }
    const rows = room.finalRows();
    // Cada um seguiu 2 rodadas com nota 10 e criou 1 com nota 0: média 6,7%... (667 décimos)
    expect(rows.every((r) => r.totalTenths === 667)).toBe(true);
    expect(rows.every((r) => r.placement === 1)).toBe(true);
  });

  it('o início ajusta as rodadas para um múltiplo do número de jogadores', () => {
    let t = 1_000;
    const room = new EcoLeaderRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => SEED });
    ['ana', 'bia', 'cris'].forEach((id) => room.join(id, id));
    room.configure('ana', { rounds: 4 });
    ['bia', 'cris'].forEach((id) => room.setReady(id, true));
    room.start('ana');
    t += 1;
    expect(room.currentSettings).toEqual({ rounds: 6 });
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
