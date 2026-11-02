import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PpBot, PP_BOT_LEVELS, type PpBotName } from './bot';
import { PpNetSim, ppParseNetEvent, type PpNetEvent } from './netsim';

interface Msg {
  at: number;
  to: 'A' | 'B' | 'S';
  ev?: PpNetEvent;
  rej?: PpNetEvent;
  from?: number;
}

/**
 * Três aparelhos (A joga de 0, B joga de 1 e S é a sala) trocando eventos com atraso e variação. Cada um roda a sua
 * `PpNetSim`; os bots dão as entradas. No fim todo mundo precisa ter o mesmo placar.
 */
function run(opts: {
  seed: string;
  a: PpBotName;
  b: PpBotName;
  lag: number;
  jitter: number;
  ticks: number;
}) {
  const rng = createRng(opts.seed);
  const A = new PpNetSim(0, 0);
  const B = new PpNetSim(0, 1);
  const S = new PpNetSim(0, -1, true);
  const botA = new PpBot(PP_BOT_LEVELS[opts.a], rng);
  const botB = new PpBot(PP_BOT_LEVELS[opts.b], rng);
  const q: Msg[] = [];
  const delay = () => Math.max(1, Math.round(opts.lag + (rng() - 0.5) * 2 * opts.jitter));
  let rejected = 0;
  let accepted = 0;
  const sims = { A, B, S };
  // depois que os bots param, a rede ainda esvazia o que está a caminho (uma batida do último tick demora a chegar)
  for (let n = 1; n <= opts.ticks + 60 || (q.length > 0 && n <= opts.ticks + 400); n++) {
    const drain = n > opts.ticks;
    // entrega o que chegou
    for (let i = q.length - 1; i >= 0; i--) {
      const m = q[i]!;
      if (m.at > n) continue;
      q.splice(i, 1);
      const sim = sims[m.to];
      if (m.rej) {
        sim.remove(m.rej);
        continue;
      }
      const ev = m.ev!;
      if (m.to === 'S') {
        if (S.validate(ev, m.from!)) {
          S.add(ev);
          accepted++;
          const other = m.from === 0 ? 'B' : 'A';
          q.push({ at: n + delay(), to: other, ev });
        } else {
          rejected++;
          q.push({ at: n + delay(), to: m.from === 0 ? 'A' : 'B', rej: ev });
        }
      } else sim.add(ev);
    }
    // no fim os bots param (sem novos saques): só deixa a rede esvaziar
    A.advanceTo(n, drain ? null : botA.input(A.match, 0));
    B.advanceTo(n, drain ? null : botB.input(B.match, 1));
    S.advanceTo(n);
    for (const ev of A.outgoing()) q.push({ at: n + delay(), to: 'S', ev, from: 0 });
    for (const ev of B.outgoing()) q.push({ at: n + delay(), to: 'S', ev, from: 1 });
    for (const ev of S.outgoing()) {
      q.push({ at: n + delay(), to: 'A', ev });
      q.push({ at: n + delay(), to: 'B', ev });
    }
  }
  return { A, B, S, rejected, accepted };
}

const snap = (s: PpNetSim) => ({
  score: [...s.match.score],
  phase: s.match.phase,
  server: s.match.server,
  rally: s.match.rally,
  tick: s.tick,
});

describe('partida em rede (PpNetSim)', () => {
  it('sem atraso os três aparelhos andam iguais e ninguém é recusado', () => {
    const r = run({ seed: 'n0', a: 'medio', b: 'medio', lag: 1, jitter: 0, ticks: 9000 });
    expect(snap(r.A)).toEqual(snap(r.S));
    expect(snap(r.B)).toEqual(snap(r.S));
    expect(r.rejected).toBe(0);
    expect(r.accepted).toBeGreaterThan(20);
    expect(r.S.match.score[0] + r.S.match.score[1]).toBeGreaterThan(2);
  });

  it('com 80 ms de atraso e variação os três chegam ao mesmo placar', () => {
    const r = run({ seed: 'n1', a: 'dificil', b: 'medio', lag: 5, jitter: 3, ticks: 12000 });
    expect(snap(r.A)).toEqual(snap(r.S));
    expect(snap(r.B)).toEqual(snap(r.S));
    expect(r.S.match.score[0] + r.S.match.score[1]).toBeGreaterThan(0);
  });

  it('com 200 ms de atraso (rede ruim) ainda convergem', () => {
    const r = run({ seed: 'n2', a: 'medio', b: 'medio', lag: 12, jitter: 4, ticks: 12000 });
    expect(snap(r.A)).toEqual(snap(r.S));
    expect(snap(r.B)).toEqual(snap(r.S));
  });

  it('a bola de A depois de uma batida de B converge para a mesma posição', () => {
    const r = run({ seed: 'n3', a: 'medio', b: 'medio', lag: 6, jitter: 2, ticks: 2400 });
    const a = r.A.match.ball;
    const s = r.S.match.ball;
    // (uma raquete parada bem em cima da bola ainda pode bater no fim, antes de a rede entregar: aí a conta é outra)
    if (
      (r.S.match.phase === 'rally' || r.S.match.phase === 'toss') &&
      r.A.match.rally === r.S.match.rally
    ) {
      expect(Math.hypot(a.x - s.x, a.y - s.y, a.z - s.z)).toBeLessThan(0.05);
    }
  });

  it('o saque sem ninguém sacando é lançado pela sala e a partida segue', () => {
    const S = new PpNetSim(0, -1, true);
    const A = new PpNetSim(0, -1);
    let tosses = 0;
    for (let n = 1; n <= 60 * 9; n++) {
      tosses += S.advanceTo(n).filter((t) => t.e.type === 'toss').length;
      for (const ev of S.outgoing()) A.add(ev);
      A.advanceTo(n);
    }
    expect(tosses).toBeGreaterThanOrEqual(1);
    expect(snap(A)).toEqual(snap(S));
  });

  it('quem entra no meio refaz a partida pelo histórico da sala e chega ao mesmo placar', () => {
    const r = run({ seed: 'n4', a: 'medio', b: 'medio', lag: 4, jitter: 2, ticks: 12000 });
    // um aparelho novo recebe o histórico antes de andar (como `psync`) e depois anda até o tick da sala
    const late = new PpNetSim(0, -1);
    for (const ev of r.S.history()) late.add(ev);
    while (late.tick < r.S.tick) late.advanceTo(Math.min(late.tick + 500, r.S.tick));
    expect(snap(late)).toEqual(snap(r.S));
    expect(r.S.match.score[0] + r.S.match.score[1]).toBeGreaterThan(3);
  });

  it('a sala recusa batida de quem não é a vez e batida velha demais', () => {
    const S = new PpNetSim(0, -1, true);
    S.advanceTo(200);
    const fake: PpNetEvent = {
      k: 'hit',
      t: 150,
      p: 1,
      serve: false,
      smash: false,
      kmh: 50,
      quality: 'normal',
      spin: 0,
      b: [0, 1.4, -2.4, 0, 1, 7, 0, 0, 0],
    };
    expect(S.validate(fake, 1)).toBe(false); // velha demais
    expect(S.validate({ ...fake, t: 199 }, 1)).toBe(false); // não é a vez (ninguém sacou)
    expect(S.validate({ ...fake, t: 199 }, 0)).toBe(false); // outro jogador
  });
});

describe('o smash cronometrado viaja na batida', () => {
  it('o evento de batida leva o golpe e o nível, e valores estranhos são limpos', () => {
    const base = {
      k: 'hit',
      t: 10,
      p: 0,
      serve: false,
      smash: true,
      kmh: 90,
      quality: 'normal',
      spin: 1,
      b: [0, 1.5, 1, 0, -5, -15, 0, 0, 0],
    };
    const ok = ppParseNetEvent({ ...base, stroke: 'smash', tier: 3 });
    expect(ok && ok.k === 'hit' && ok.tier).toBe(3);
    expect(ok && ok.k === 'hit' && ok.stroke).toBe('smash');
    const odd = ppParseNetEvent({ ...base, stroke: 'lixo', tier: 99 });
    expect(odd && odd.k === 'hit' && odd.stroke).toBe('normal');
    expect(odd && odd.k === 'hit' && odd.tier).toBe(3);
  });
});
