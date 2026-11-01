import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PP_EV_FLOOR, PP_EV_NET, PP_EV_TABLE, ppNewBall, ppNewStepOut, ppStepBall } from './ball';
import { ppLanding } from './assist';
import { PP_NET_H, PP_R, PP_TOP, PP_V_MAX, PP_VZ_MAX, PP_W } from './constants';
import { PpBot, PP_BOT_LEVELS } from './bot';
import { ppPaddleHit } from './paddle';
import {
  PpMatch,
  ppIdleInput,
  ppPadStep,
  ppServerFor,
  type PpEvent,
  type PpInput,
  type PpPaddle,
} from './match';

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

describe('previsão de onde a bola cai', () => {
  it('uma bola boa cai na mesa do outro lado; uma bola baixa demais bate na rede', () => {
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

  it('o saque: a bola sobe, desce e a raquete que avança bate nela de verdade, mandando-a para o outro lado', () => {
    const m = new PpMatch(0);
    const hold = { ...ppIdleInput(), x: 0, y: 1.65 };
    run(m, 5, hold, ppIdleInput());
    expect(m.phase).toBe('serve');
    const toss = run(m, 3, { ...hold, serve: true }, ppIdleInput());
    expect(toss.some((e) => e.type === 'toss')).toBe(true);
    let hit: PpEvent | undefined;
    for (let i = 0; i < 150 && !hit; i++) {
      // a mão espera a bola descer até a altura da raquete e então avança batendo para a frente e um pouco para cima
      const go = m.ball.vy < 0 && m.ball.y <= 1.7;
      m.step([
        go ? { ...hold, swing: { vx: 0, vy: 3, vz: 4.5, reach: 0.34 } } : hold,
        ppIdleInput(),
      ]);
      hit = m.drain().find((e) => e.type === 'hit');
    }
    expect(hit && hit.type === 'hit' && hit.serve).toBe(true);
    expect(m.phase).toBe('rally');
    expect(m.ball.vz).toBeLessThan(0);
    expect(ppLanding(m.ball, 0).ok).toBe(true);
  });

  it('saque em que a raquete não avança até a bola cai na própria mesa: falta, e na segunda falta é ponto do outro', () => {
    const m = new PpMatch(0);
    const hold = { ...ppIdleInput(), x: 0, y: 0.6 };
    const faults: PpEvent[] = [];
    for (let n = 0; n < 2; n++) {
      faults.push(...run(m, 3, hold, ppIdleInput()));
      faults.push(...run(m, 3, { ...hold, serve: true }, ppIdleInput()));
      faults.push(...run(m, 150, hold, ppIdleInput()));
      faults.push(...run(m, 3, hold, ppIdleInput()));
    }
    expect(faults.filter((e) => e.type === 'fault').length).toBe(2);
    const point = faults.find((e) => e.type === 'point');
    expect(point && point.type === 'point' && point.winner).toBe(1);
    expect(m.score).toEqual([0, 1]);
  });

  it('saque fácil: a bola descendo na frente da raquete parada é rebatida e cai na mesa do outro lado', () => {
    const m = new PpMatch(0);
    const hold = { ...ppIdleInput(), x: 0, y: 1.5 };
    const ev = [
      ...run(m, 3, hold, ppIdleInput()),
      ...run(m, 3, { ...hold, serve: true }, ppIdleInput()),
    ];
    ev.push(...run(m, 200, hold, ppIdleInput()));
    expect(ev.some((e) => e.type === 'hit' && e.serve)).toBe(true);
    expect(ev.some((e) => e.type === 'fault')).toBe(false);
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

describe('a batida de verdade', () => {
  const incoming = () => {
    const b = ppNewBall();
    b.x = 0;
    b.y = 1.3;
    b.z = 2.45;
    b.vz = 5;
    b.vy = -1.5;
    return b;
  };
  const hit = (vx: number, vy: number, vz: number) => {
    const b = incoming();
    const info = ppPaddleHit(b, 0, { x: 0, y: 1.3, vx, vy, vz }, false);
    return { b, info };
  };

  it('quanto mais rápido a raquete vai para a frente, mais rápido a bola vai (parada, devolve fraco)', () => {
    const still = hit(0, 0, 0).info.speed;
    const soft = hit(0, 0, 2.5).info.speed;
    const hard = hit(0, 0, 6).info.speed;
    expect(still).toBeLessThan(soft);
    expect(soft).toBeLessThan(hard);
    expect(still).toBeLessThan(6.5);
  });

  it('de baixo para cima levanta a bola (lob) e de cima para baixo a manda para baixo', () => {
    const up = hit(0, 4, 2.5).b;
    const flat = hit(0, 0, 2.5).b;
    const down = hit(0, -4, 2.5).b;
    expect(up.vy).toBeGreaterThan(flat.vy);
    expect(flat.vy).toBeGreaterThan(down.vy);
    expect(up.vy).toBeGreaterThan(1);
    expect(down.vy).toBeLessThan(0);
  });

  it('o efeito vem do movimento: subir dá topspin (a bola mergulha) e descer dá backspin', () => {
    const up = hit(0, 4, 3).b;
    const down = hit(0, -4, 3).b;
    expect(up.wx).toBeLessThan(0); // topspin para quem bate de perto da câmera
    expect(down.wx).toBeGreaterThan(0);
    expect(up.wx).toBeLessThan(down.wx);
  });

  it('o movimento para o lado vira a bola para o lado', () => {
    const left = hit(-4, 1, 3).b;
    const right = hit(4, 1, 3).b;
    expect(right.vx).toBeGreaterThan(left.vx);
    expect(Math.abs(right.vx)).toBeGreaterThan(0.3);
  });

  it('a bola nunca sai mais rápida que o limite, nem com a raquete a toda', () => {
    const { info } = hit(8, 8, 12);
    expect(info.speed).toBeLessThanOrEqual(PP_V_MAX + 1e-9);
  });

  it('a mão acompanha o ponteiro e o alcance cresce com a rapidez (parada, a raquete fica no plano de espera)', () => {
    const slow: PpPaddle = { x: 0, y: 1.3, vx: 0, vy: 0, reach: 0, vz: 0, swing: 0 };
    for (let i = 0; i < 20; i++) ppPadStep(slow, 0.2, 1.3, 1 / 60);
    expect(slow.reach).toBeLessThan(0.05);
    const fast: PpPaddle = { x: 0, y: 1.3, vx: 0, vy: 0, reach: 0, vz: 0, swing: 0 };
    let peak = 0;
    for (let i = 0; i < 12; i++) {
      ppPadStep(fast, 0.2 * i, 1.3 + 0.12 * i, 1 / 60);
      peak = Math.max(peak, fast.vz);
    }
    expect(fast.reach).toBeGreaterThan(0.15);
    expect(peak).toBeGreaterThan(2);
    expect(peak).toBeLessThanOrEqual(PP_VZ_MAX);
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
    for (let i = 0; i < 10; i++) if (play('dificil', 'facil', 'n' + i).m.winner === 0) wins++;
    expect(wins).toBeGreaterThanOrEqual(7);
  });
});

describe('ajuda de leitura da batida', () => {
  const swing = (vy: number, vz: number) => {
    const b = ppNewBall();
    b.x = 0;
    b.y = 1.3;
    b.z = 2.7;
    b.vy = -1;
    b.vz = 3;
    ppPaddleHit(b, 0, { x: 0, y: 1.3, vx: 0, vy, vz });
    return ppLanding(b, 0);
  };
  it('batida fraca e batida forte passam a rede e caem na mesa do outro lado', () => {
    const strokes: [number, number][] = [
      [0, 0.5],
      [1, 2],
      [2, 4],
      [-2, 6],
      [3, 7.5],
    ];
    for (const [vy, vz] of strokes) {
      expect(swing(vy, vz).ok).toBe(true);
    }
  });
});

describe('jogo justo: sempre dá para acertar a bola', () => {
  it('quem joga com a mão quase nunca perde ponto por não alcançar a bola (a raquete se posiciona)', () => {
    for (const lvl of ['facil', 'medio'] as const) {
      const rng = createRng('justo' + lvl);
      const m = new PpMatch(0);
      const bot = new PpBot(PP_BOT_LEVELS[lvl], rng);
      let missed = 0;
      let points = 0;
      for (let i = 0; i < 60 * 300 && m.phase !== 'over'; i++) {
        const human = {
          x: Math.sin(i / 90) * 0.8,
          y: 1.3,
          serve: m.phase === 'serve' && i % 30 < 5,
          tossV: 0.3,
        };
        m.step([human, bot.input(m, 1)]);
        for (const e of m.drain()) {
          if (e.type !== 'point') continue;
          points++;
          if (e.winner === 1 && e.reason === 'miss') missed++;
        }
      }
      expect(points).toBeGreaterThan(5);
      expect(missed).toBeLessThanOrEqual(1);
    }
  });

  it('o saque sobe mais alto com a barra cheia do que com a barra baixa', () => {
    const peak = (v: number) => {
      const m = new PpMatch(0);
      const idle = ppIdleInput();
      run(m, 3, idle, idle);
      let top = 0;
      m.step([{ ...idle, serve: true, tossV: v }, idle]);
      for (let i = 0; i < 80 && m.phase === 'toss'; i++) {
        m.step([idle, idle]);
        top = Math.max(top, m.ball.y);
      }
      return top;
    };
    expect(peak(1)).toBeGreaterThan(peak(0) + 1.5);
  });

  it('bola mansa não vira foguete: devolvida com a mão parada sai devagar, e bola forte bloqueada sobe em lob', () => {
    const hit = (vz: number, vy: number, hand: number) => {
      const b = ppNewBall();
      b.x = 0;
      b.y = 1.3;
      b.z = 2.9;
      b.vz = vz;
      b.vy = vy;
      ppPaddleHit(b, 0, { x: 0, y: 1.3, vx: 0, vy: 0, vz: hand });
      return b;
    };
    expect((({ vx, vy, vz }) => Math.hypot(vx, vy, vz))(hit(2.5, 0, 0))).toBeLessThan(8);
    const block = hit(11, -1, 0);
    expect(block.vy).toBeGreaterThan(1.5);
    expect(ppLanding(block, 0).ok).toBe(true);
  });
});
