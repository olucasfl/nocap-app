import { describe, expect, it } from 'vitest';
import { RoomError, SHOW_GRACE_MS } from '../color-room.engine';
import { DEFAULT_IMPOSTOR_SETTINGS, ImpostorRoomEngine } from './impostor-room.engine';
import { HINT_COUNT, PALETTE, paletteRound } from './palette';

type View = ReturnType<ImpostorRoomEngine['snapshot']>;
const imp = (v: View) =>
  (v as unknown as { impostor: Record<string, unknown> }).impostor as {
    role: 'crew' | 'impostor' | null;
    color: { h: number; s: number; b: number } | null;
    hint: string | null;
    colorName: string | null;
    count: number;
    myVote: string | null;
    voted: string[];
    reveal: {
      impostors: string[];
      caught: string[];
      counts: Record<string, number>;
      points: Record<string, number>;
      votes: { voter: string; target: string }[] | null;
    } | null;
  };

function setup(players = ['ana', 'bia', 'caio'], impostors = 1, anonymous = false) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const room = new ImpostorRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => 'seed-i' });
  players.forEach((p) => room.join(p, p));
  room.configure(players[0]!, { impostors, anonymous });
  players.slice(1).forEach((p) => room.setReady(p, true));
  return { room, clock, players };
}

const snapOf = (room: ImpostorRoomEngine, id: string) => room.snapshot(id);

describe('lobby do Intruso', () => {
  it('precisa de no mínimo 3 pessoas', () => {
    const { room } = setup(['ana', 'bia']);
    expect(() => room.start('ana')).toThrow(RoomError);
  });

  it('com 3 pessoas dá para ter até 2 intrusos (1 normal), mas nunca 3', () => {
    const { room, players } = setup(['ana', 'bia', 'caio'], 3);
    room.start('ana');
    const roles = players.map((p) => imp(snapOf(room, p)).role);
    expect(roles.filter((r) => r === 'impostor')).toHaveLength(2);
    expect(roles.filter((r) => r === 'crew')).toHaveLength(1);
  });

  it('o pedido do host se adapta à sala (4 pessoas e 3 intrusos: 3)', () => {
    const { room } = setup(['a', 'b', 'c', 'd'], 3);
    room.start('a');
    expect(imp(snapOf(room, 'a')).count).toBe(3);
  });

  it('aguenta 12 pessoas e recusa a 13ª: com 3 intrusos sobram 9 normais', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const { room, players } = setup(ids, 3);
    expect(() => room.join('p12', 'p12')).toThrow('cheia');
    room.start('p0');
    const roles = players.map((p) => imp(snapOf(room, p)).role);
    expect(roles.filter((r) => r === 'impostor')).toHaveLength(3);
    expect(roles.filter((r) => r === 'crew')).toHaveLength(9);
    // Só quem é intruso recebe a dica; ninguém além da tripulação vê a cor.
    for (const p of players) {
      const v = imp(snapOf(room, p));
      expect(v.hint !== null).toBe(v.role === 'impostor');
      expect(v.color !== null).toBe(v.role === 'crew');
    }
  });

  it('regras inválidas são recusadas', () => {
    const { room } = setup();
    expect(() => room.configure('ana', { impostors: 4 })).toThrow(RoomError);
    expect(() => room.configure('ana', { rounds: 9 })).toThrow(RoomError);
  });
});

describe('segredo no servidor', () => {
  it('a seed nunca vai ao cliente; cor só para a tripulação; dica só para o intruso', () => {
    const { room, players } = setup();
    room.start('ana');
    const target = paletteRound('seed-i', 0);
    for (const p of players) {
      const snap = snapOf(room, p) as unknown as { round: { seed: string } };
      expect(snap.round.seed).toBe('');
      const v = imp(snapOf(room, p));
      if (v.role === 'impostor') {
        expect(v.color).toBeNull();
        expect(v.hint).toBe(target.hint);
      } else {
        expect(v.color).toEqual(target.color);
        expect(v.hint).toBeNull();
      }
      expect(v.colorName).toBeNull();
      expect(JSON.stringify(snapOf(room, p))).not.toContain('seed-i');
    }
  });

  it('depois de decorar a cor some do estado da tripulação; a dica fica com o intruso', () => {
    const { room, clock, players } = setup();
    room.start('ana');
    clock.advance(DEFAULT_IMPOSTOR_SETTINGS.showMs + SHOW_GRACE_MS);
    room.tick();
    expect(room.currentPhase).toBe('pick');
    for (const p of players) {
      const v = imp(snapOf(room, p));
      expect(v.color).toBeNull();
      expect(v.hint === null).toBe(v.role === 'crew');
    }
  });

  it('o papel dos outros só aparece na revelação', () => {
    const { room, clock, players } = setup();
    room.start('ana');
    clock.advance(DEFAULT_IMPOSTOR_SETTINGS.showMs + SHOW_GRACE_MS);
    room.tick();
    for (const p of players) {
      room.lock(p, { h: 10, s: 10, b: 10 });
    }
    expect(room.currentPhase).toBe('vote');
    expect(imp(snapOf(room, 'ana')).reveal).toBeNull();
    for (const p of players) room.vote(p, null);
    expect(room.currentPhase).toBe('reveal');
    const reveal = imp(snapOf(room, 'ana')).reveal!;
    expect(reveal.impostors).toHaveLength(1);
    expect(imp(snapOf(room, 'ana')).colorName).toBeTruthy();
  });
});

/** Joga uma rodada inteira: todos recriam e votam em `suspect(p)`. */
function playRound(
  room: ImpostorRoomEngine,
  clock: { advance: (n: number) => number },
  players: string[],
  suspect: (voter: string, impostors: string[]) => string | null,
) {
  clock.advance(DEFAULT_IMPOSTOR_SETTINGS.showMs + SHOW_GRACE_MS);
  room.tick();
  const target = paletteRound('seed-i', 0).color;
  for (const p of players) room.lock(p, target);
  const impostors = players.filter((p) => imp(snapOf(room, p)).role === 'impostor');
  for (const p of players) room.vote(p, suspect(p, impostors));
  return impostors;
}

describe('votação', () => {
  it('voto em si mesmo e fora da fase são recusados; dá para trocar o voto', () => {
    const { room, clock, players } = setup();
    room.start('ana');
    expect(() => room.vote('ana', 'bia')).toThrow(RoomError);
    clock.advance(DEFAULT_IMPOSTOR_SETTINGS.showMs + SHOW_GRACE_MS);
    room.tick();
    for (const p of players) room.lock(p, { h: 1, s: 1, b: 1 });
    expect(() => room.vote('ana', 'ana')).toThrow(RoomError);
    room.vote('ana', 'bia');
    expect(imp(snapOf(room, 'ana')).myVote).toBe('bia');
    room.vote('ana', 'caio');
    expect(imp(snapOf(room, 'ana')).myVote).toBe('caio');
    expect(room.currentPhase).toBe('vote');
  });

  it('os intrusos também votam, e a tripulação que acerta pontua', () => {
    const { room, clock, players } = setup();
    room.start('ana');
    playRound(room, clock, players, (voter, impostors) =>
      voter === impostors[0] ? players.find((p) => p !== voter)! : impostors[0]!,
    );
    const reveal = imp(snapOf(room, 'ana')).reveal!;
    expect(reveal.caught).toHaveLength(1);
    const impostor = reveal.impostors[0]!;
    for (const p of players.filter((x) => x !== impostor)) {
      // nota 10 (recriou a cor exata) + 3 do voto certo
      expect(reveal.points[p]).toBeGreaterThanOrEqual(13);
    }
    expect(reveal.votes).toHaveLength(3);
  });

  it('voto anônimo esconde quem votou em quem, mas a contagem aparece', () => {
    const { room, clock, players } = setup(['ana', 'bia', 'caio'], 1, true);
    room.start('ana');
    playRound(room, clock, players, (voter, impostors) =>
      voter === impostors[0] ? players.find((p) => p !== voter)! : impostors[0]!,
    );
    const reveal = imp(snapOf(room, 'ana')).reveal!;
    expect(reveal.votes).toBeNull();
    expect(Object.values(reveal.counts).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('quando o tempo da votação acaba, quem não votou conta como abstenção', () => {
    const { room, clock, players } = setup();
    room.start('ana');
    clock.advance(DEFAULT_IMPOSTOR_SETTINGS.showMs + SHOW_GRACE_MS);
    room.tick();
    for (const p of players) room.lock(p, { h: 5, s: 5, b: 5 });
    expect(room.currentPhase).toBe('vote');
    clock.advance(DEFAULT_IMPOSTOR_SETTINGS.voteMs);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('reveal');
    expect(imp(snapOf(room, 'ana')).reveal!.caught).toEqual([]);
  });

  it('partida completa: rodadas, pódio por pontos e nenhuma cor repetida', () => {
    const { room, clock, players } = setup();
    room.configure('ana', { rounds: 2 });
    players.slice(1).forEach((p) => room.setReady(p, true));
    room.start('ana');
    for (let r = 0; r < 2; r++) {
      clock.advance(DEFAULT_IMPOSTOR_SETTINGS.showMs + SHOW_GRACE_MS);
      room.tick();
      const target = paletteRound('seed-i', r).color;
      for (const p of players) room.lock(p, target);
      for (const p of players) room.vote(p, null);
      room.next('ana');
    }
    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]!.totalTenths).toBeGreaterThanOrEqual(rows[2]!.totalTenths);
    expect(paletteRound('seed-i', 0).name).not.toBe(paletteRound('seed-i', 1).name);
  });
});

describe('paleta de dicas', () => {
  it('tem mais de 1000 dicas', () => {
    expect(HINT_COUNT).toBeGreaterThanOrEqual(1000);
  });

  it('cada cor tem HSB válido e nome único', () => {
    const names = new Set<string>();
    for (const c of PALETTE) {
      expect(c.hints.length).toBeGreaterThanOrEqual(5);
      expect(c.hsb.h).toBeGreaterThanOrEqual(0);
      expect(c.hsb.h).toBeLessThanOrEqual(360);
      expect(c.hsb.s).toBeGreaterThanOrEqual(0);
      expect(c.hsb.s).toBeLessThanOrEqual(100);
      expect(c.hsb.b).toBeGreaterThanOrEqual(0);
      expect(c.hsb.b).toBeLessThanOrEqual(100);
      expect(names.has(c.name)).toBe(false);
      names.add(c.name);
    }
  });

  it('nenhuma dica se repete e nenhuma é vazia', () => {
    const seen = new Set<string>();
    for (const c of PALETTE) {
      for (const h of c.hints) {
        expect(h.trim().length).toBeGreaterThan(15);
        expect(seen.has(h)).toBe(false);
        seen.add(h);
      }
    }
  });

  it('a rodada é determinística e as rodadas da partida têm cores diferentes', () => {
    expect(paletteRound('x', 2)).toEqual(paletteRound('x', 2));
    const names = new Set([0, 1, 2, 3, 4].map((i) => paletteRound('x', i).name));
    expect(names.size).toBe(5);
  });
});
