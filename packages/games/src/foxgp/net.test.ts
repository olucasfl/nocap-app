import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GP_DT, GP_NET_VERSION, type GpPhysicsMode } from './constants';
import { gpBotInput, newGpBotMemory, type GpBotMemory } from './bots';
import { GpClient, GpHost, type GpInputPacket, type GpSnapshot } from './net';
import { GpWorld, type GpPlayerInfo } from './world';

/**
 * Rede simulada (spec 079, 1.2): um líder e dois aparelhos com 150 ms de ida e volta, variação e 5 % de perda. Cada pessoa
 * é dirigida por um bot que só vê o mundo do próprio aparelho (como uma pessoa vendo a tela dela).
 */
interface Pipe<T> {
  q: { at: number; v: T }[];
}
function send<T>(p: Pipe<T>, v: T, now: number, rng: () => number, oneWay: number, loss: number) {
  if (rng() < loss) return;
  p.q.push({ at: now + oneWay + (rng() - 0.5) * 30, v });
}
function due<T>(p: Pipe<T>, now: number): T[] {
  const out = p.q.filter((m) => m.at <= now).sort((a, b) => a.at - b.at);
  p.q = p.q.filter((m) => m.at > now);
  return out.map((m) => m.v);
}

function setup(oneWay: number, loss: number, phase: 'race' | 'quali' = 'race', mode: GpPhysicsMode = 'arcade') {
  const infos: GpPlayerInfo[] = ['h', 'a', 'b'].map((id, i) => ({ id, name: id, color: 0xff0000 + i }));
  const order = ['h', 'a', 'b'];
  const hostWorld = new GpWorld('net', infos, undefined, mode);
  hostWorld.autoEnd = false;
  if (phase === 'race') hostWorld.beginRace(order);
  const host = new GpHost(hostWorld, 'h');
  const clients = ['a', 'b'].map((id) => {
    const w = new GpWorld('net', infos, undefined, mode);
    w.goOnline(id);
    if (phase === 'race') w.beginRace(order);
    return new GpClient(w, id);
  });
  const rng = createRng('net:pipes');
  const brng = createRng('net:bots');
  const mem = new Map<string, GpBotMemory>(order.map((id, i) => [id, newGpBotMemory(0.86 + i * 0.03)]));
  const up = new Map(clients.map((c) => [c.meId, { q: [] } as Pipe<GpInputPacket>]));
  const down = new Map(clients.map((c) => [c.meId, { q: [] } as Pipe<GpSnapshot>]));
  return { host, clients, rng, brng, mem, up, down, oneWay, loss };
}

type Sim = ReturnType<typeof setup>;

/** Roda `seconds` de jogo; devolve o maior salto de um quadro para o outro no desenho (o próprio carro e os outros). */
function run(s: Sim, seconds: number) {
  let worstOwn = 0;
  let worstOther = 0;
  const prev = new Map<string, { x: number; z: number }>();
  let hostGap = 0;
  let hostGapN = 0;
  for (let n = 0; n < seconds / GP_DT; n++) {
    const now = n * GP_DT * 1000;
    for (const c of s.clients) {
      const me = c.world.car(c.meId)!;
      const pkt = c.local(gpBotInput(c.world, me, s.mem.get(c.meId)!, s.brng));
      send(s.up.get(c.meId)!, pkt, now, s.rng, s.oneWay, s.loss);
    }
    for (const c of s.clients) for (const p of due(s.up.get(c.meId)!, now)) s.host.receive(c.meId, p);
    const hw = s.host.world;
    s.host.step(gpBotInput(hw, hw.car('h')!, s.mem.get('h')!, s.brng));
    s.host.drainEvents();
    if (s.host.snapDue) {
      const snap = JSON.parse(JSON.stringify(s.host.snapshot())) as GpSnapshot;
      for (const c of s.clients) send(s.down.get(c.meId)!, snap, now, s.rng, s.oneWay, s.loss);
    }
    for (const c of s.clients) {
      for (const snap of due(s.down.get(c.meId)!, now)) c.receive(snap, now);
      c.frame(GP_DT, now);
      for (const car of c.world.cars) {
        const own = car.id === c.meId;
        const x = car.x + (own ? c.error.x : 0);
        const z = car.z + (own ? c.error.z : 0);
        const key = `${c.meId}:${car.id}`;
        const p = prev.get(key);
        if (p && n > 30) {
          const jump = Math.hypot(x - p.x, z - p.z);
          if (own) worstOwn = Math.max(worstOwn, jump);
          else worstOther = Math.max(worstOther, jump);
        }
        prev.set(key, { x, z });
      }
      // o próprio carro previsto aqui x o do líder (que está um pouco atrás no tempo): perto
      const mine = c.world.car(c.meId)!;
      const truth = hw.car(c.meId)!;
      hostGap += Math.hypot(mine.x - truth.x, mine.z - truth.z);
      hostGapN += 1;
    }
  }
  return { worstOwn, worstOther, meanGap: hostGap / hostGapN };
}

describe('rede do Fox GP (líder simula, aparelhos preveem)', () => {
  it('sem atraso: todo mundo vê o mesmo e ninguém teleporta', () => {
    const s = setup(0, 0);
    const r = run(s, 20);
    // um quadro a 60/s anda no máximo ~0,65 m (39 m/s), mais o empurrão de uma batida; teleporte seriam metros
    expect(r.worstOwn).toBeLessThan(1.5);
    expect(r.worstOther).toBeLessThan(1.5);
    expect(r.meanGap).toBeLessThan(2);
  });

  it('150 ms de ida e volta e 5 % de perda: continua liso e perto da verdade do líder', () => {
    const s = setup(75, 0.05);
    const r = run(s, 30);
    expect(r.worstOwn).toBeLessThan(1.5);
    expect(r.worstOther).toBeLessThan(1.5);
    // a previsão anda ~75 ms à frente do líder: a 30 m/s isso dá ~2,3 m
    expect(r.meanGap).toBeLessThan(4);
    for (const c of s.clients) expect(c.corrections).toBeGreaterThan(100);
  });

  it('Realista: 150 ms de ida e volta e 5 % de perda, sem teleporte (o aparelho prevê com o modo da sala)', () => {
    const s = setup(75, 0.05, 'race', 'real');
    const r = run(s, 30);
    expect(r.worstOwn).toBeLessThan(1.5);
    expect(r.worstOther).toBeLessThan(1.5);
    expect(r.meanGap).toBeLessThan(4);
    for (const c of s.clients) expect(c.world.mode).toBe('real');
  });

  it('os tempos do líder chegam a todos (voltas e setores)', () => {
    const s = setup(75, 0.05);
    run(s, 75);
    const truth = s.host.world.cars.map((c) => c.laps.length);
    expect(Math.max(...truth)).toBeGreaterThanOrEqual(1);
    for (const c of s.clients) {
      const seen = c.world.cars.map((x) => x.laps.length);
      expect(seen).toEqual(truth);
    }
  });

  it('na classificação os fantasmas também andam liso e o tempo de quem começou chega ao líder', () => {
    const s = setup(75, 0.05, 'quali');
    run(s, 15);
    // as entradas de "iniciar volta" são do próprio aparelho: o líder aplica as mesmas
    const a = s.clients[0]!;
    const mine = a.world.car(a.meId)!;
    const truth = s.host.world.car(a.meId)!;
    expect(Math.hypot(mine.x - truth.x, mine.z - truth.z)).toBeLessThan(6);
  });

  it('da classificação para a corrida: o relógio do líder recomeça e os estados da corrida não são descartados', () => {
    const s = setup(75, 0.02, 'quali');
    run(s, 12);
    const order = ['h', 'a', 'b'];
    s.host.world.beginRace(order);
    for (const c of s.clients) c.world.beginRace(order);
    run(s, 6);
    const a = s.clients[0]!;
    // o relógio do aparelho segue o do líder (e não ficou parado no zero)
    expect(a.world.t).toBeGreaterThan(4);
    // o carro do líder, desenhado no aparelho, anda junto com o de verdade
    const hostOnA = a.world.car('h')!;
    const truth = s.host.world.car('h')!;
    expect(truth.prog).toBeGreaterThan(40);
    expect(Math.hypot(hostOnA.x - truth.x, hostOnA.z - truth.z)).toBeLessThan(8);
  });

  it('entrada repetida, velha ou quebrada não entra duas vezes na fila', () => {
    const s = setup(0, 0);
    const pkt: GpInputPacket = { v: GP_NET_VERSION, rows: [[1, 1, 0, 0, 0, 0], [2, 1, 0, 0, 0, 0]] };
    s.host.receive('a', pkt);
    s.host.receive('a', pkt);
    s.host.receive('a', { v: GP_NET_VERSION, rows: [[3, 1, 0, 0, Number.NaN, 0] as never, [0, 1, 0, 0, 0, 0]] });
    // versão antiga do protocolo: ignorado
    s.host.receive('a', { v: GP_NET_VERSION - 1, rows: [[9, 1, 0, 0, 0, 0]] });
    s.host.step({ throttle: 0, brake: 0, steer: 0 });
    s.host.step({ throttle: 0, brake: 0, steer: 0 });
    const snap = s.host.snapshot();
    const row = snap.full.find((r) => r[0] === 1)!;
    expect(row[1]).toBe(2);
  });
});
