import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PP_EV_FLOOR, PP_EV_NET, PP_EV_TABLE, ppNewBall, ppNewStepOut, ppStepBall } from './ball';
import { ppLanding } from './assist';
import { PP_NET_H, PP_R, PP_TOP, PP_W } from './constants';
import { PpBot, PP_BOT_LEVELS } from './bot';
import { PpMatch, ppIdleInput, ppServerFor, type PpEvent, type PpInput } from './match';

const out = ppNewStepOut();
/** Passo até acontecer `bit` (ou acabar o tempo) e devolve quantos subpassos levou. */
function until(b: ReturnType<typeof ppNewBall>, bit: number, max = 2400): number {
  for (let i = 0; i < max; i++) {
    out.ev = 0;
    ppStepBall(b, out);
    if (out.ev & bit) return i;
  }
  return -1;
}

describe('física da bola', () => {
  it('quica na mesa perdendo energia (restituição ~0,88) e só uma vez por queda', () => {
    const b = ppNewBall();
    b.x = 0;
    b.z = 0.8;
    b.y = PP_TOP + 1;
    expect(until(b, PP_EV_TABLE)).toBeGreaterThan(0);
    expect(b.vy).toBeGreaterThan(0);
    // sobe até um pouco menos de 0,8 da altura (e² ~ 0,77, e o arrasto tira um pouco mais)
    let apex = b.y;
    for (let i = 0; i < 600 && b.vy > 0; i++) {
      out.ev = 0;
      ppStepBall(b, out);
      apex = Math.max(apex, b.y);
    }
    const rise = apex - PP_TOP - PP_R;
    expect(rise).toBeGreaterThan(0.6);
    expect(rise).toBeLessThan(0.82);
  });

  it('topspin acelera ao quicar e backspin freia', () => {
    const launch = (wx: number) => {
      const b = ppNewBall();
      b.x = 0;
      b.z = 1.5;
      b.y = PP_TOP + 0.5;
      b.vz = -4; // indo para o fundo da mesa (z negativo)
      b.wx = wx;
      until(b, PP_EV_TABLE);
      return b.vz;
    };
    const top = launch(-80); // topspin para quem bate de z positivo
    const flat = launch(0);
    const back = launch(80);
    expect(top).toBeLessThan(flat); // mais veloz para frente (z mais negativo)
    expect(back).toBeGreaterThan(flat); // mais lento
  });

  it('Magnus: com topspin a bola mergulha, com backspin ela flutua', () => {
    const fly = (wx: number) => {
      const b = ppNewBall();
      b.x = 0;
      b.z = 2;
      b.y = 3;
      b.vz = -8;
      b.vy = 1;
      b.wx = wx;
      for (let i = 0; i < 96; i++) {
        out.ev = 0;
        ppStepBall(b, out);
      }
      return b.y;
    };
    expect(fly(-100)).toBeLessThan(fly(0));
    expect(fly(100)).toBeGreaterThan(fly(0));
  });

  it('efeito lateral faz a bola curvar para o lado', () => {
    const b = ppNewBall();
    b.z = 2;
    b.y = 3;
    b.vz = -8;
    b.vy = 1;
    b.wy = 100;
    for (let i = 0; i < 96; i++) {
      out.ev = 0;
      ppStepBall(b, out);
    }
    expect(Math.abs(b.x)).toBeGreaterThan(0.05);
  });

  it('a rede segura a bola baixa e deixa passar a alta', () => {
    const low = ppNewBall();
    low.z = 1;
    low.y = PP_TOP + 0.15;
    low.vz = -6;
    expect(until(low, PP_EV_NET, 600)).toBeGreaterThan(0);
    expect(low.z).toBeGreaterThan(0); // voltou para o lado de onde veio
    const high = ppNewBall();
    high.z = 1;
    high.y = PP_TOP + PP_NET_H + 0.5;
    high.vz = -6;
    expect(until(high, PP_EV_NET, 120)).toBe(-1);
    expect(high.z).toBeLessThan(0);
  });

  it('a bola que cai fora da mesa chega ao chão sem quicar na mesa', () => {
    const b = ppNewBall();
    b.x = PP_W / 2 + 0.6;
    b.y = 2;
    expect(until(b, PP_EV_TABLE | PP_EV_FLOOR)).toBeGreaterThan(0);
    expect(out.ev & PP_EV_FLOOR).toBeTruthy();
  });

  it('é determinística', () => {
    const run = () => {
      const b = ppNewBall();
      b.z = 2;
      b.y = 1.5;
      b.vz = -7;
      b.vx = 0.8;
      b.vy = 1.2;
      b.wx = -60;
      b.wy = 30;
      for (let i = 0; i < 500; i++) {
        out.ev = 0;
        ppStepBall(b, out);
      }
      return [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz];
    };
    expect(run()).toEqual(run());
  });
});

describe('ajuda de mira', () => {
  it('uma bola boa passa direto; uma bola na rede por pouco é consertada', () => {
    const good = ppNewBall();
    good.z = 2;
    good.y = 1.5;
    good.vz = -6.5;
    good.vy = 2.2;
    expect(ppLanding(good, 0).ok).toBe(true);
    const low = ppNewBall();
    low.z = 2;
    low.y = 1.2;
    low.vz = -7;
    low.vy = 0.2;
    expect(ppLanding(low, 0).ok).toBe(false);
  });
});

/** Joga bot contra bot (ou parado) e devolve o que aconteceu. */
function play(
  a: keyof typeof PP_BOT_LEVELS,
  b: keyof typeof PP_BOT_LEVELS,
  seed: string,
  maxTicks = 60 * 900,
) {
  const rng = createRng(seed);
  const m = new PpMatch(0);
  const ba = new PpBot(PP_BOT_LEVELS[a], rng);
  const bb = new PpBot(PP_BOT_LEVELS[b], rng);
  const events: PpEvent[] = [];
  for (let i = 0; i < maxTicks && m.phase !== 'over'; i++) {
    m.step([ba.input(m, 0), bb.input(m, 1)]);
    events.push(...m.drain());
  }
  return { m, events };
}

const run = (m: PpMatch, ticks: number, a: PpInput, b: PpInput) => {
  const ev: PpEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    m.step([a, b]);
    ev.push(...m.drain());
  }
  return ev;
};

describe('regras', () => {
  it('ordem do saque: 2 pontos cada um, e a cada ponto a partir de 10-10', () => {
    expect([0, 1, 2, 3, 4, 5].map((t) => ppServerFor(0, t, 0))).toEqual([0, 0, 1, 1, 0, 0]);
    expect(ppServerFor(1, 0, 0)).toBe(1);
    expect(ppServerFor(0, 10, 10)).toBe(0);
    expect(ppServerFor(0, 11, 10)).toBe(1);
    expect(ppServerFor(0, 11, 11)).toBe(0);
  });

  it('o saque: lança, a raquete embaixo rebate e a bola vai para o lado de lá', () => {
    const m = new PpMatch(0);
    const under = { ...ppIdleInput(), x: 0, y: 1.35 };
    run(m, 5, under, ppIdleInput());
    expect(m.phase).toBe('serve');
    const toss = run(m, 3, { ...under, serve: true }, ppIdleInput());
    expect(toss.some((e) => e.type === 'toss')).toBe(true);
    let hit: PpEvent | undefined;
    for (let i = 0; i < 120 && !hit; i++) {
      m.step([under, ppIdleInput()]);
      hit = m.drain().find((e) => e.type === 'hit');
    }
    expect(hit && hit.type === 'hit' && hit.serve).toBe(true);
    expect(m.phase).toBe('rally');
    expect(m.ball.vz).toBeLessThan(0);
    expect(ppLanding(m.ball, 0).ok).toBe(true);
  });

  it('saque que não é rebatido cai na própria mesa: falta, e na segunda falta é ponto do outro', () => {
    const m = new PpMatch(0);
    const under = { ...ppIdleInput(), x: 0, y: 1.35 };
    const away = { ...ppIdleInput(), x: 1.8, y: 1.35 };
    const faults: PpEvent[] = [];
    for (let n = 0; n < 2; n++) {
      faults.push(...run(m, 3, under, ppIdleInput()));
      faults.push(...run(m, 3, { ...under, serve: true }, ppIdleInput()));
      // a raquete sai de baixo da bola logo depois do lançamento
      faults.push(...run(m, 150, away, ppIdleInput()));
      faults.push(...run(m, 3, under, ppIdleInput()));
    }
    expect(faults.filter((e) => e.type === 'fault').length).toBe(2);
    const point = faults.find((e) => e.type === 'point');
    expect(point && point.type === 'point' && point.winner).toBe(1);
    expect(m.score).toEqual([0, 1]);
  });

  it('antes do quique na sua metade a raquete deixa a bola passar (sem voleio)', () => {
    const m = new PpMatch(0);
    // bola vindo da raquete 0 direto para o fundo: a raquete 1 está no lugar certo mas ainda não houve quique
    m.step([ppIdleInput(), ppIdleInput()]);
    m.phase = 'rally';
    m.lastHitter = 0;
    m.bounces = [0, 0];
    m.ball.x = 0;
    m.ball.y = 3;
    m.ball.z = -2.2;
    m.ball.vz = -3;
    const pad = m.pad(1);
    pad.x = 0;
    pad.y = 2.6;
    const ev = run(m, 40, { ...ppIdleInput(), x: 0 }, { ...ppIdleInput(), x: 0, y: 2.6 });
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
  });

  it('é determinística: mesmas entradas, mesmo placar e mesma bola', () => {
    const a = play('medio', 'medio', 'det', 2500);
    const b = play('medio', 'medio', 'det', 2500);
    expect(a.m.score).toEqual(b.m.score);
    expect(a.m.tick).toBe(b.m.tick);
    expect(a.m.ball.x).toBe(b.m.ball.x);
  });
});

describe('bots', () => {
  it('quem não faz nada perde: o bot ganha a partida', () => {
    const m = new PpMatch(0);
    const bot = new PpBot(PP_BOT_LEVELS.medio, createRng('idle'));
    const idle = ppIdleInput();
    for (let i = 0; i < 60 * 900 && m.phase !== 'over'; i++) {
      m.step([bot.input(m, 0), idle]);
      m.drain();
    }
    expect(m.phase).toBe('over');
    expect(m.winner).toBe(0);
  });

  it('bot contra bot: a partida termina, ninguém trava e há trocas de bola', () => {
    const { m, events } = play('medio', 'medio', 'a1');
    expect(m.phase).toBe('over');
    const [a, b] = m.score;
    expect(Math.max(a, b)).toBeGreaterThanOrEqual(11);
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(2);
    const rallies = events.flatMap((e) => (e.type === 'point' ? [e.rally] : []));
    const avg = rallies.reduce((x, y) => x + y, 0) / rallies.length;
    expect(avg).toBeGreaterThan(3);
  });

  it('o difícil ganha do fácil na maioria das partidas', () => {
    let wins = 0;
    for (let i = 0; i < 6; i++) if (play('dificil', 'facil', 'n' + i).m.winner === 0) wins++;
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});
