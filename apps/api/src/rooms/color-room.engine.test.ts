import { colorGame } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import {
  ColorRoomEngine,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  REVEAL_MS,
  SHOW_GRACE_MS,
  RoomError,
} from './color-room.engine';

function setup() {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const room = new ColorRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed-x' });
  return { room, clock };
}

/** A resposta que acerta o alvo da rodada (nota 10). */
function perfect(seed: string, index: number, settings = DEFAULT_SETTINGS) {
  return colorGame.generateRound(seed, settings, index);
}

function started(players = ['ana', 'bia']) {
  const ctx = setup();
  players.forEach((p) => ctx.room.join(p, p));
  players.slice(1).forEach((p) => ctx.room.setReady(p, true));
  ctx.room.start(players[0]!);
  return ctx;
}

const toPick = (c: ReturnType<typeof setup>) => {
  c.clock.advance(DEFAULT_SETTINGS.showMs + SHOW_GRACE_MS);
  c.room.tick();
};

describe('lobby', () => {
  it('o primeiro a entrar é o host; se ele cair, o mais antigo conectado assume', () => {
    const { room, clock } = setup();
    room.join('ana', 'ana');
    clock.advance(10);
    room.join('bia', 'bia');
    clock.advance(10);
    room.join('caio', 'caio');
    expect(room.snapshot().hostId).toBe('ana');
    room.disconnect('ana');
    expect(room.snapshot().hostId).toBe('bia');
    room.leave('bia');
    expect(room.snapshot().hostId).toBe('caio');
  });

  it('quem volta depois de cair não toma o host de volta', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    room.disconnect('ana');
    room.join('ana', 'ana');
    expect(room.snapshot().hostId).toBe('bia');
  });

  it('respeita o limite de 12 e só aceita gente nova no lobby', () => {
    const { room } = setup();
    for (let i = 0; i < MAX_PLAYERS; i++) room.join(`p${i}`, `p${i}`);
    expect(() => room.join('extra', 'extra')).toThrow('cheia');
    const g = started();
    expect(() => g.room.join('novo', 'novo')).toThrow('já começou');
  });

  it('só o host configura, só no lobby e com valores válidos; regra nova zera os "pronto"', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    room.setReady('bia', true);
    expect(() => room.configure('bia', { rounds: 3 })).toThrow('Só quem criou');
    expect(() => room.configure('ana', { rounds: 0 })).toThrow('inválidas');
    expect(() => room.configure('ana', { rounds: 11 })).toThrow('inválidas');
    expect(() => room.configure('ana', { showMs: 50 })).toThrow('inválidas');
    room.configure('ana', { rounds: 3, showMs: 500 });
    expect(room.currentSettings).toMatchObject({ rounds: 3, showMs: 500 });
    expect(room.snapshot().members.every((m) => !m.ready)).toBe(true);
  });

  it('só inicia com 2+ pessoas e todos os outros prontos', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    expect(() => room.start('ana')).toThrow('precisas');
    room.join('bia', 'bia');
    expect(() => room.start('ana')).toThrow('"pronto"');
    room.setReady('bia', true);
    expect(() => room.start('bia')).toThrow('Só quem criou');
    room.start('ana');
    expect(room.currentPhase).toBe('show');
  });

  it('o host pode expulsar; não a si mesmo', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    expect(() => room.kick('ana', 'ana')).toThrow('se expulsar');
    expect(() => room.kick('bia', 'ana')).toThrow('Só quem criou');
    room.kick('ana', 'bia');
    expect(room.has('bia')).toBe(false);
  });
});

describe('partida', () => {
  it('show vira pick no tempo certo e o servidor guarda a seed', () => {
    const c = started();
    expect(c.room.currentPhase).toBe('show');
    c.clock.advance(DEFAULT_SETTINGS.showMs + SHOW_GRACE_MS - 1);
    expect(c.room.tick()).toBe(false);
    c.clock.advance(1);
    expect(c.room.tick()).toBe(true);
    expect(c.room.currentPhase).toBe('pick');
    expect(c.room.currentSeed).toBe('seed-x');
  });

  it('todos travam: vai para a revelação na hora, com notas recalculadas pelo servidor', () => {
    const c = started();
    toPick(c);
    c.room.lock('ana', perfect('seed-x', 0));
    expect(c.room.currentPhase).toBe('pick');
    c.room.lock('bia', { h: (perfect('seed-x', 0).h + 180) % 360, s: 40, b: 40 });
    expect(c.room.currentPhase).toBe('reveal');
    const res = c.room.snapshot().round!.results!;
    expect(res.find((r) => r.id === 'ana')!.score).toBe(10);
    expect(res.find((r) => r.id === 'bia')!.score).toBeLessThan(5);
  });

  it('não vaza resposta dos outros antes da revelação', () => {
    const c = started();
    toPick(c);
    c.room.lock('ana', perfect('seed-x', 0));
    const snap = c.room.snapshot();
    expect(snap.round!.results).toBeNull();
    expect(snap.members.find((m) => m.id === 'ana')!.locked).toBe(true);
    expect(JSON.stringify(snap)).not.toContain('"answer"');
  });

  it('estourou o tempo: quem não respondeu fica com 0', () => {
    const c = started();
    toPick(c);
    c.room.lock('ana', perfect('seed-x', 0));
    c.clock.advance(DEFAULT_SETTINGS.pickMs);
    c.room.tick();
    expect(c.room.currentPhase).toBe('reveal');
    const res = c.room.snapshot().round!.results!;
    expect(res.find((r) => r.id === 'bia')).toMatchObject({ answer: null, score: 0 });
  });

  it('rejeita resposta inválida, fora de fase e duplicada (vale a primeira)', () => {
    const c = started();
    expect(() => c.room.lock('ana', { h: 1, s: 1, b: 1 })).toThrow('Agora não');
    toPick(c);
    expect(() => c.room.lock('ana', { h: 999, s: 1, b: 1 })).toThrow('inválida');
    expect(() => c.room.lock('ana', { h: 1.5, s: 1, b: 1 })).toThrow('inválida');
    c.room.lock('ana', perfect('seed-x', 0));
    c.room.lock('ana', { h: 0, s: 0, b: 0 });
    c.clock.advance(DEFAULT_SETTINGS.pickMs);
    c.room.tick();
    expect(c.room.snapshot().round!.results!.find((r) => r.id === 'ana')!.score).toBe(10);
  });

  it('jogador desconectado não trava a rodada', () => {
    const c = started(['ana', 'bia', 'caio']);
    toPick(c);
    c.room.lock('ana', perfect('seed-x', 0));
    c.room.lock('bia', perfect('seed-x', 0));
    expect(c.room.currentPhase).toBe('pick');
    c.room.disconnect('caio');
    expect(c.room.currentPhase).toBe('reveal');
  });

  it('a revelação passa sozinha ou quando o host manda, e a última leva ao pódio', () => {
    const c = started();
    for (let i = 0; i < 5; i++) {
      toPick(c);
      c.room.lock('ana', perfect('seed-x', i));
      c.room.lock('bia', perfect('seed-x', i));
      expect(c.room.currentPhase).toBe('reveal');
      if (i % 2 === 0) {
        c.clock.advance(REVEAL_MS);
        c.room.tick();
      } else {
        c.room.next('ana');
      }
    }
    expect(c.room.currentPhase).toBe('final');
    expect(c.room.snapshot().final).toEqual([
      expect.objectContaining({ username: 'ana', totalTenths: 500, placement: 1 }),
      expect.objectContaining({ username: 'bia', totalTenths: 500, placement: 1 }),
    ]);
  });

  it('pódio ordena por nota e empate divide a colocação', () => {
    const c = started(['ana', 'bia', 'caio']);
    const rounds = c.room.currentSettings.rounds;
    for (let i = 0; i < rounds; i++) {
      toPick(c);
      c.room.lock('ana', perfect('seed-x', i));
      c.room.lock('bia', { h: 0, s: 0, b: 0 });
      c.room.lock('caio', { h: 0, s: 0, b: 0 });
      c.clock.advance(REVEAL_MS);
      c.room.tick();
    }
    const rows = c.room.finalRows();
    expect(rows[0]).toMatchObject({ userId: 'ana', placement: 1, totalTenths: 500 });
    expect(rows[1]!.placement).toBe(2);
    expect(rows[2]!.placement).toBe(rows[1]!.totalTenths === rows[2]!.totalTenths ? 2 : 3);
  });

  const toFinal = (c: ReturnType<typeof started>) => {
    for (let i = 0; i < c.room.currentSettings.rounds; i++) {
      toPick(c);
      c.room.lock('ana', perfect('seed-x', i));
      c.room.lock('bia', perfect('seed-x', i));
      c.room.next('ana');
    }
    expect(c.room.currentPhase).toBe('final');
  };

  it('revanche: só volta ao lobby quando todo mundo vota em jogar de novo', () => {
    const c = started();
    toFinal(c);
    c.room.voteRematch('bia', true);
    expect(c.room.currentPhase).toBe('final'); // falta a ana
    expect(c.room.snapshot().members.find((m) => m.id === 'bia')!.rematch).toBe(true);
    c.room.voteRematch('ana', true);
    const snap = c.room.snapshot();
    expect(snap.phase).toBe('lobby');
    expect(snap.round).toBeNull();
    expect(snap.final).toBeNull();
    // Quem topou já entra pronto: o host pode começar sem ninguém apertar "pronto".
    expect(snap.members.every((m) => m.committed && m.ready)).toBe(true);
    c.room.start('ana');
    expect(c.room.currentPhase).toBe('show');
  });

  it('o voto pode ser retirado antes de todos votarem', () => {
    const c = started();
    toFinal(c);
    c.room.voteRematch('bia', true);
    c.room.voteRematch('bia', false);
    c.room.voteRematch('ana', true);
    expect(c.room.currentPhase).toBe('final');
  });

  it('quem sai no pódio deixa de contar: os que ficam e votaram abrem a revanche', () => {
    const c = started(['ana', 'bia', 'caio']);
    for (let i = 0; i < c.room.currentSettings.rounds; i++) {
      toPick(c);
      for (const p of ['ana', 'bia', 'caio']) c.room.lock(p, perfect('seed-x', i));
      c.room.next('ana');
    }
    c.room.voteRematch('ana', true);
    c.room.voteRematch('bia', true);
    expect(c.room.currentPhase).toBe('final'); // o caio ainda não votou
    c.room.leave('caio'); // não quer jogar de novo e sai
    const snap = c.room.snapshot();
    expect(snap.phase).toBe('lobby');
    expect(snap.members.map((m) => m.id)).toEqual(['ana', 'bia']);
  });

  it('o host muda as regras na revanche e quem topou continua pronto', () => {
    const c = started();
    toFinal(c);
    c.room.voteRematch('ana', true);
    c.room.voteRematch('bia', true);
    c.room.configure('ana', { rounds: 3 });
    const snap = c.room.snapshot();
    expect(snap.settings.rounds).toBe(3);
    expect(snap.members.every((m) => m.ready)).toBe(true);
    c.room.start('ana');
    expect(c.room.currentPhase).toBe('show');
  });

  it('só dá para votar no pódio', () => {
    const c = started();
    expect(() => c.room.voteRematch('bia', true)).toThrow(RoomError);
  });
});

describe('reconexão e saída', () => {
  it('quem cai e volta continua de onde parou', () => {
    const c = started();
    toPick(c);
    c.room.disconnect('bia');
    c.room.join('bia', 'bia');
    expect(c.room.snapshot().members.find((m) => m.id === 'bia')!.connected).toBe(true);
    c.room.lock('bia', perfect('seed-x', 0));
    expect(c.room.snapshot().members.find((m) => m.id === 'bia')!.locked).toBe(true);
  });

  it('se sobrar uma pessoa no meio da partida, a sala volta ao lobby', () => {
    const c = started();
    toPick(c);
    c.room.leave('bia');
    expect(c.room.currentPhase).toBe('lobby');
    expect(c.room.snapshot().round).toBeNull();
  });

  it('host que cai no meio da partida passa o comando', () => {
    const c = started(['ana', 'bia', 'caio']);
    toPick(c);
    c.room.disconnect('ana');
    expect(c.room.snapshot().hostId).toBe('bia');
    expect(() => c.room.next('ana')).toThrow();
  });

  it('erros de regra são RoomError (a camada de rede os mostra ao usuário)', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    expect(() => room.start('ana')).toThrow(RoomError);
  });
});

describe('modos da sala da Cor', () => {
  it('Flash pisca por 0,4 s e voltar ao clássico restaura o tempo de decorar', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    room.configure('ana', { mode: 'flash' });
    expect(room.currentSettings).toMatchObject({ showMs: 400 });
    expect(room.snapshot().mode).toBe('flash');
    room.configure('ana', { mode: 'classic' });
    expect(room.currentSettings).toMatchObject({ showMs: DEFAULT_SETTINGS.showMs });
  });

  it('Às cegas é um modo válido; modo desconhecido é recusado', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    room.configure('ana', { mode: 'blind' });
    expect(room.snapshot().mode).toBe('blind');
    expect(() => room.configure('ana', { mode: 'survival' })).toThrow(RoomError);
  });

  it('só o host muda o modo', () => {
    const { room } = setup();
    room.join('ana', 'ana');
    room.join('bia', 'bia');
    expect(() => room.configure('bia', { mode: 'flash' })).toThrow(RoomError);
  });
});
