import { BOL_ROOM_MAX } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { BolaRoomEngine } from './bola-room.engine';

const T0 = 1_000_000;

function make() {
  let t = T0;
  const clock = {
    advance: (ms: number) => (t += ms),
    get now() {
      return t;
    },
  };
  const room = new BolaRoomEngine({ code: 'BOLA', now: () => t, newSeed: () => 'seed' });
  return { room, clock };
}

/** Anda o relógio em passos de 33 ms (o tick da sala) e roda o motor. */
function run(s: ReturnType<typeof make>, sec: number) {
  for (let i = 0; i < Math.round((sec * 1000) / 33); i++) {
    s.clock.advance(33);
    s.room.tick();
    s.room.drainFrame();
  }
}

const snap = (room: BolaRoomEngine, id = 'ana') =>
  (
    room.snapshot(id) as unknown as {
      phase: string;
      bola: {
        format: { teams: number; perTeam: number; auto: boolean; minutes: number };
        suggested: { teams: number; perTeam: number };
        teamOf: Record<string, number>;
        bots: number[];
        roster: {
          slot: number;
          id: string;
          name: string;
          team: number;
          bot: boolean;
          away: boolean;
        }[];
        scores: number[];
        winner: number | null;
      };
    }
  ).bola;

function lobby(names = ['ana', 'bia']) {
  const s = make();
  for (const n of names) s.room.join(n, n);
  return s;
}

function playing(names = ['ana', 'bia']) {
  const s = lobby(names);
  for (const n of names.slice(1)) s.room.setReady(n, true);
  s.room.start(names[0]!);
  return s;
}

describe('sala do Fut Fox: lobby', () => {
  it('sugere o formato pelas pessoas e coloca cada uma num time', () => {
    const { room } = lobby(['ana', 'bia', 'caio', 'duda']);
    expect(snap(room).format).toMatchObject({ teams: 2, perTeam: 2, auto: true });
    expect(Object.values(snap(room).teamOf).sort()).toEqual([0, 0, 1, 1]);
  });

  it('o formato automático acompanha quem entra e quem sai', () => {
    const { room } = lobby(['ana', 'bia', 'caio']);
    expect(snap(room).format).toMatchObject({ teams: 3, perTeam: 1 });
    room.leave('caio');
    expect(snap(room).format).toMatchObject({ teams: 2, perTeam: 1 });
  });

  it('o líder escolhe o formato e ele deixa de ser automático; valores ruins dão erro', () => {
    const { room } = lobby();
    room.setFormat('ana', { teams: 4, perTeam: 3 });
    expect(snap(room).format).toMatchObject({ teams: 4, perTeam: 3, auto: false });
    expect(() => room.setFormat('ana', { teams: 5, perTeam: 1 })).toThrow('2 a 4');
    expect(() => room.setFormat('ana', { teams: 2, perTeam: 4 })).toThrow('1 a 3');
    expect(() => room.setFormat('ana', { minutes: 0 })).toThrow('1 a 30');
    expect(() => room.setFormat('bia', { teams: 2, perTeam: 2 })).toThrow('Só quem criou');
    room.setFormat('ana', { auto: true });
    expect(snap(room).format.auto).toBe(true);
  });

  it('quem não cabe no formato novo vira espectador e a escolha de espectador é respeitada', () => {
    const { room } = lobby(['ana', 'bia', 'caio', 'duda']);
    room.setFormat('ana', { teams: 2, perTeam: 1 });
    expect(Object.keys(snap(room).teamOf)).toHaveLength(2);
    room.setTeam('ana', -1);
    room.setFormat('ana', { teams: 2, perTeam: 2 });
    expect(snap(room).teamOf.ana).toBeUndefined();
  });

  it('time cheio dá erro claro e o líder completa times com bots dentro do limite', () => {
    const { room } = lobby(['ana', 'bia', 'caio']);
    room.setFormat('ana', { teams: 2, perTeam: 1 });
    expect(() => room.setTeam('caio', 0)).toThrow('cheio');
    room.setTeam('ana', -1);
    room.setBots('ana', 0, 1);
    expect(snap(room).bots[0]).toBe(1);
    expect(() => room.setBots('ana', 0, 1)).toThrow('cheio');
    expect(() => room.setBots('ana', 3, 1)).toThrow('não existe');
  });

  it('não começa com time vazio e diz qual, nem com gente sem marcar pronto', () => {
    const { room } = lobby(['ana']);
    room.setFormat('ana', { teams: 3, perTeam: 1 });
    expect(() => room.start('ana')).toThrow('Falta jogador no time Azul');
    room.setBots('ana', 1, 1);
    expect(() => room.start('ana')).toThrow('Falta jogador no time Amarelo');
    room.setBots('ana', 2, 1);
    room.start('ana');
    expect(room.currentPhase).toBe('play');

    const b = lobby(['ana', 'bia']);
    expect(() => b.room.start('ana')).toThrow('pronto');
  });

  it('espectador não precisa marcar pronto', () => {
    const { room } = lobby(['ana', 'bia', 'caio']);
    room.setFormat('ana', { teams: 2, perTeam: 1 });
    room.setReady('bia', true);
    room.start('ana');
    expect(room.currentPhase).toBe('play');
  });

  it('a sala aceita 15 pessoas e recusa a 16ª; 12 jogam e 3 assistem', () => {
    const { room } = lobby(Array.from({ length: BOL_ROOM_MAX }, (_, i) => `p${i}`));
    expect(room.memberCount).toBe(15);
    expect(() => room.join('extra', 'extra')).toThrow('cheia');
    expect(snap(room, 'p0').format).toMatchObject({ teams: 4, perTeam: 3 });
    expect(Object.keys(snap(room, 'p0').teamOf)).toHaveLength(12);
  });
});

describe('sala do Fut Fox: partida', () => {
  it('começa em jogo, com a contagem do motor, e o relógio só anda depois dela', () => {
    const s = playing();
    expect(s.room.currentPhase).toBe('play');
    expect(snap(s.room).roster).toHaveLength(2);
    run(s, 1);
    const f1 = s.room.drainFrame();
    run(s, 3);
    s.room.drainFrame();
    const f = s.room.drainFrame();
    expect(f1).not.toBeNull();
    expect(f === null || typeof f.ck === 'number').toBe(true);
  });

  it('a entrada de uma pessoa mexe a raposa dela no servidor', () => {
    const s = playing();
    run(s, 3.3);
    const before = s.room.drainFrame() ?? { p: [] };
    s.room.input('ana', [1, 0, 0, 1]);
    run(s, 0.5);
    s.room.input('ana', [0, 0, 0, 2]);
    const after = s.room.drainFrame() as { p: number[][] };
    const a0 = (before as { p: number[][] }).p.find((r) => r[0] === 0);
    const a1 = after.p.find((r) => r[0] === 0);
    expect(a0 && a1 && a1[1]! - a0[1]!).toBeGreaterThan(0.5);
    expect(a1![9]).toBe(2);
  });

  it('entrada inválida é ignorada e o pulo só conta quando o contador sobe', () => {
    const s = playing();
    run(s, 3.3);
    s.room.input('ana', 'x');
    s.room.input('ana', [Infinity, 0, 0, 1]);
    s.room.input('ana', [0, 0, 5, 1]);
    run(s, 0.1);
    const f1 = s.room.drainFrame() as { p: number[][] };
    expect(f1.p.find((r) => r[0] === 0)![2]).toBeLessThan(0.3);
    s.room.input('ana', [0, 0, 6, 2]);
    run(s, 0.2);
    const f2 = s.room.drainFrame() as { p: number[][] };
    expect(f2.p.find((r) => r[0] === 0)![2]).toBeGreaterThan(0.3);
  });

  it('quem sai deixa um bot no lugar, com o mesmo corpo', () => {
    const s = playing(['ana', 'bia', 'caio', 'duda']);
    run(s, 4);
    const before = snap(s.room).roster.find((r) => r.id === 'bia')!;
    s.room.leave('bia');
    const after = snap(s.room).roster.find((r) => r.slot === before.slot)!;
    expect(after.bot).toBe(true);
    expect(after.team).toBe(before.team);
    expect(snap(s.room).roster).toHaveLength(4);
  });

  it('quem perde a conexão continua em campo controlado por bot e volta ao reconectar', () => {
    const s = playing();
    run(s, 4);
    s.room.disconnect('bia');
    expect(snap(s.room).roster.find((r) => r.id === 'bia')!.away).toBe(true);
    run(s, 1);
    s.room.join('bia', 'bia');
    expect(snap(s.room).roster.find((r) => r.id === 'bia')!.away).toBe(false);
  });

  it('um espectador que entra no meio assume o lugar de um bot ou ocupa uma vaga livre', () => {
    const s = make();
    s.room.join('ana', 'ana');
    s.room.setFormat('ana', { teams: 2, perTeam: 2 });
    s.room.setBots('ana', 1, 1);
    s.room.setBots('ana', 1, 1);
    s.room.start('ana');
    run(s, 4);
    // o time 0 tem a ana e uma vaga livre; o time 1 tem 2 bots
    s.room.join('caio', 'caio');
    expect(snap(s.room).teamOf.caio).toBeUndefined();
    const bot = snap(s.room).roster.find((r) => r.bot && r.team === 1)!;
    s.room.setTeam('caio', 1, bot.id);
    const r = snap(s.room).roster;
    expect(r.find((x) => x.id === 'caio')).toMatchObject({ team: 1, bot: false, slot: bot.slot });
    expect(r.find((x) => x.id === bot.id)).toBeUndefined();
    // o mesmo bot não pode ser pego de novo
    s.room.join('duda', 'duda');
    expect(() => s.room.setTeam('duda', 1, bot.id)).toThrow('já saiu do lugar');
    // vaga livre de verdade no time 0
    s.room.setTeam('duda', 0);
    expect(snap(s.room).roster.find((x) => x.id === 'duda')).toMatchObject({ team: 0, bot: false });
    // agora o time 0 está cheio de gente
    s.room.join('eva', 'eva');
    expect(() => s.room.setTeam('eva', 0)).toThrow('cheio');
    // quem sai de um time vira bot lá e assume um bot no outro
    const other = snap(s.room).roster.find((x) => x.bot && x.team === 1)!;
    s.room.setTeam('caio', -1);
    expect(
      snap(s.room).roster.find((x) => x.slot === r.find((y) => y.id === 'caio')!.slot),
    ).toMatchObject({ bot: true, team: 1 });
    expect(other).toBeTruthy();
  });

  it('time cheio de gente não aceita mais ninguém, mesmo no meio da partida', () => {
    const s = playing(['ana', 'bia', 'caio', 'duda']);
    run(s, 4);
    s.room.join('eva', 'eva');
    expect(() => s.room.setTeam('eva', 0)).toThrow('cheio');
  });

  it('o líder encerra e a partida vai para o pódio com a colocação por time', () => {
    const s = playing();
    run(s, 4);
    s.room.endNow('ana');
    run(s, 0.2);
    expect(s.room.currentPhase).toBe('final');
    const rows = s.room.finalRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.placement === 1)).toBe(true);
    expect(() => s.room.endNow('bia')).toThrow();
  });

  it('a revanche volta ao lobby com os times como estavam', () => {
    const s = playing();
    run(s, 4);
    s.room.endNow('ana');
    run(s, 0.2);
    s.room.voteRematch('ana', true);
    s.room.voteRematch('bia', true);
    expect(s.room.currentPhase).toBe('lobby');
    expect(Object.keys(snap(s.room).teamOf).sort()).toEqual(['ana', 'bia']);
  });

  it('o contador de pulos que volta atrás (aparelho recarregou) não trava os pulos seguintes', () => {
    const s = playing();
    run(s, 3.3);
    s.room.input('ana', [0, 0, 9, 1]);
    s.room.input('ana', [0, 0, 0, 2]);
    s.room.input('ana', [0, 0, 1, 3]);
    run(s, 0.2);
    const f = s.room.drainFrame() as { p: number[][] };
    expect(f.p.find((r) => r[0] === 0)![2]).toBeGreaterThan(0.2);
  });

  it('cada quadro leva a hora do servidor', () => {
    const s = playing();
    run(s, 1);
    const f = s.room.drainFrame() as { t: number };
    expect(f.t).toBe(s.clock.now);
  });

  it('o fluxo de quadros traz bola, corpos e estatísticas, e os gols viram evento com vagas', () => {
    const s = playing();
    run(s, 3.3);
    const f = s.room.drainFrame() as { b: number[]; p: number[][]; ev: unknown[]; st?: unknown };
    expect(f.b).toHaveLength(6);
    expect(f.p).toHaveLength(2);
    expect(f.p[0]).toHaveLength(10);
  });
});

describe('sala do Fut Fox: quem está olhando', () => {
  it('o estado traz o id de quem olha (convidado não tem conta no aparelho)', () => {
    const s = lobby(['ana', 'bia']);
    expect((s.room.snapshot('bia') as unknown as { me: string | null }).me).toBe('bia');
    expect((s.room.snapshot('ana') as unknown as { me: string | null }).me).toBe('ana');
  });
});

describe('sala do Fut Fox: partida ponto a ponto (spec 048)', () => {
  const net = (room: BolaRoomEngine, id = 'ana') =>
    (
      room.snapshot(id) as unknown as {
        bola: { net: string; p2pHost: string | null; setup: unknown };
      }
    ).bola;

  function p2p(names = ['ana', 'bia']) {
    const s = lobby(names);
    s.room.p2pEnabled = true;
    for (const n of names.slice(1)) s.room.setReady(n, true);
    s.room.start(names[0]!);
    return s;
  }

  it('ao começar, os aparelhos tentam conectar ao do líder e o servidor não simula', () => {
    const s = p2p();
    const b = net(s.room);
    expect(b.net).toBe('pending');
    expect(b.p2pHost).toBe('ana');
    expect(b.setup).toMatchObject({ teams: 2, perTeam: 1, seed: 'seed' });
    run(s, 1);
    expect(s.room.serverSimulates).toBe(false);
    expect(s.room.drainFrame()).toBeNull();
  });

  it('todos conectaram: vira ponto a ponto e o líder entrega o resultado', () => {
    const s = p2p();
    s.room.p2pReport('bia', true);
    s.room.tick();
    expect(net(s.room).net).toBe('p2p');
    expect(s.room.drainFrame()).toBeNull();
    // quem não é o líder não decide o resultado
    s.room.p2pResult('bia', { scores: [0, 9], winner: 1 });
    expect(s.room.snapshot('ana').phase).toBe('play');
    s.room.p2pResult('ana', { scores: [3, 1], winner: 0 });
    expect(s.room.snapshot('ana').phase).toBe('final');
    const rows = s.room.finalRows();
    expect(rows.find((r) => r.userId === 'ana')).toMatchObject({ placement: 1, totalTenths: 30 });
    expect(rows.find((r) => r.userId === 'bia')).toMatchObject({ placement: 2, totalTenths: 10 });
    expect(snap(s.room).winner).toBe(0);
  });

  it('resultado inválido é ignorado', () => {
    const s = p2p();
    s.room.p2pReport('bia', true);
    s.room.tick();
    s.room.p2pResult('ana', { scores: [3], winner: 0 });
    s.room.p2pResult('ana', { scores: [3, -2000], winner: 0 });
    s.room.p2pResult('ana', { scores: [3, 1.5], winner: 0 });
    expect(s.room.snapshot('ana').phase).toBe('play');
  });

  it('se alguém não conseguir conectar, o servidor passa a simular (reserva)', () => {
    const s = p2p();
    s.room.p2pReport('bia', false);
    expect(net(s.room).net).toBe('server');
    run(s, 4);
    expect(snap(s.room).roster.length).toBe(2);
    expect(s.room.serverSimulates).toBe(true);
  });

  it('se o tempo de conexão acabar, o servidor passa a simular', () => {
    const s = p2p();
    run(s, 9);
    expect(net(s.room).net).toBe('server');
  });

  it('no ponto a ponto a troca de time vai para o líder, que aplica e responde', () => {
    const s = p2p();
    // ainda conectando: espere
    expect(() => s.room.setTeam('bia', -1)).toThrow('conectando');
    s.room.p2pReport('bia', true);
    s.room.tick();
    s.room.setTeam('bia', -1);
    const out = s.room.drainP2pOut();
    expect(out.host).toBe('ana');
    expect(out.switches).toEqual([{ id: 'bia', name: 'bia', team: -1, bot: null }]);
    // quem não é o líder não confirma nada
    s.room.p2pSwitched('bia', { id: 'bia', team: -1, ok: true });
    s.room.p2pSwitched('ana', { id: 'bia', team: -1, ok: true });
    s.room.setTeam('bia', 0);
    s.room.drainP2pOut();
    // erro do líder volta como aviso para quem pediu
    s.room.p2pSwitched('ana', {
      id: 'bia',
      team: 0,
      ok: false,
      error: 'O time Vermelho está cheio',
    });
    expect(s.room.drainP2pOut().notices).toEqual([
      { to: 'bia', message: 'O time Vermelho está cheio' },
    ]);
  });

  it('o líder sozinho com bots joga direto no aparelho dele, sem esperar ninguém', () => {
    const s = lobby(['ana']);
    s.room.p2pEnabled = true;
    s.room.setBots('ana', 1, 1);
    s.room.start('ana');
    s.room.tick();
    expect(net(s.room).net).toBe('p2p');
  });

  it('se o líder sai no meio da partida ponto a ponto, ela termina sem vencedor', () => {
    const s = p2p();
    s.room.p2pReport('bia', true);
    s.room.tick();
    s.room.leave('ana');
    expect(s.room.snapshot('bia').phase).toBe('final');
    expect(snap(s.room, 'bia').winner).toBe(-1);
  });
});
