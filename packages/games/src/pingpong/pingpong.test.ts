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
  ppPadStepZ,
  ppSmashCursor,
  ppSmashTier,
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

  it('o saque: o clique lança a bola, ela sobe e cai, e a raquetada na descida manda a bola ao outro lado', () => {
    const m = new PpMatch(0);
    const hold = { ...ppIdleInput(), x: 0, y: 1.5 };
    run(m, 5, hold, ppIdleInput());
    expect(m.phase).toBe('serve');
    const y0 = m.ball.y;
    m.step([{ ...hold, serve: true }, ppIdleInput()]);
    expect(m.phase).toBe('toss');
    let top = y0;
    let hit: PpEvent | undefined;
    for (let i = 0; i < 120 && !hit; i++) {
      top = Math.max(top, m.ball.y);
      // a mão espera a bola descer até a altura da raquete e então avança batendo para a frente
      const go = m.ball.vy < 0 && m.ball.y <= 1.75;
      m.step([go ? { ...hold, swing: { vx: 0, vy: 0, vz: 6, reach: 1.1 } } : hold, ppIdleInput()]);
      hit = m.drain().find((e) => e.type === 'hit');
    }
    expect(top).toBeGreaterThan(y0 + 0.6); // a bola subiu
    expect(hit && hit.type === 'hit' && hit.serve).toBe(true);
    expect(m.phase).toBe('rally');
    expect(m.ball.vz).toBeLessThan(0);
    expect(ppLanding(m.ball, 0).ok).toBe(true);
  });

  it('quem não clica a tempo tem o lançamento feito pela sala, e a bola que ninguém rebate é falta', () => {
    const m = new PpMatch(0);
    const ev = run(m, 60 * 16, ppIdleInput(), ppIdleInput());
    expect(ev.some((e) => e.type === 'toss')).toBe(true);
    expect(ev.some((e) => e.type === 'fault')).toBe(true);
  });

  it('saque: com a mão parada atrás da bola ninguém bate sozinho (falta de saque)', () => {
    const m = new PpMatch(0);
    const ev: PpEvent[] = [];
    let clicked = false;
    for (let i = 0; i < 60 * 3; i++) {
      m.step([
        {
          ...ppIdleInput(),
          manual: false,
          x: 0,
          y: 1.5,
          z: 0,
          serve: m.phase === 'serve' && !clicked && i > 20,
        },
        ppIdleInput(),
      ]);
      if (m.phase === 'toss') clicked = true;
      ev.push(...m.drain());
    }
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
  });
  it('saque: o clique lança e é a mão (avançando na hora) que bate; sem mão a bola não é batida sozinha', () => {
    for (const px of [-2.2, 0, 2.4]) {
      const m = new PpMatch(0);
      const ev: PpEvent[] = [];
      let clicked = false;
      for (let i = 0; i < 60 * 6; i++) {
        m.step([
          {
            ...ppIdleInput(),
            manual: false,
            x: px,
            y: 1.5,
            z: m.phase === 'toss' && m.ball.vy < 0 ? 1 : 0,
            serve: m.phase === 'serve' && !clicked && i > 20,
          },
          ppIdleInput(),
        ]);
        if (m.phase === 'toss') clicked = true;
        ev.push(...m.drain());
        if (ev.some((e) => e.type === 'bounce')) break;
      }
      expect(
        ev.some((e) => e.type === 'hit' && e.serve),
        `x=${px}`,
      ).toBe(true);
      expect(ev.some((e) => e.type === 'fault')).toBe(false);
      const first = ev.find((e) => e.type === 'bounce');
      expect(first && first.type === 'bounce' && first.side).toBe(1);
    }
  });

  it('com a mão (z), a raquete vai até a rede e a força vem do impulso para a frente', () => {
    const pad: PpPaddle = { x: 0, y: 1.3, vx: 0, vy: 0, reach: 0, vz: 0, swing: 0 };
    let top = 0;
    for (let i = 0; i < 40; i++) {
      ppPadStepZ(pad, 0, 1.4, 2.4, 1 / 60);
      top = Math.max(top, pad.vz);
    }
    expect(pad.reach).toBeGreaterThan(2.2);
    expect(top).toBeGreaterThan(8);
    // parada lá na frente, a força é zero
    for (let i = 0; i < 20; i++) ppPadStepZ(pad, 0, 1.4, 2.4, 1 / 60);
    expect(pad.vz).toBeLessThan(0.5);
  });

  it('o saque funciona de qualquer lugar e com qualquer rapidez: a bola cai na mesa do outro lado (sem falta)', () => {
    for (const px of [-2.6, -0.8, 0, 1.5, 3]) {
      for (const spd of [9, 12, 18]) {
        const m = new PpMatch(0);
        const ev: PpEvent[] = [];
        let t = 0;
        let clicked = false;
        for (let i = 0; i < 60 * 8; i++) {
          const toss = m.phase === 'toss';
          const falling = toss && m.ball.vy < 0 && m.ball.y < 1.9;
          if (falling) t++;
          m.step([
            {
              ...ppIdleInput(),
              manual: false,
              x: px,
              y: 1.5,
              z: falling ? Math.min(3.4, 0.2 + (t * spd) / 60) : 0,
              serve: m.phase === 'serve' && !clicked && i > 30,
            },
            ppIdleInput(),
          ]);
          if (m.phase === 'toss') clicked = true;
          ev.push(...m.drain());
          if (ev.some((e) => e.type === 'bounce')) break;
        }
        const first = ev.find((e) => e.type === 'bounce');
        expect(
          ev.some((e) => e.type === 'hit' && e.serve),
          `x=${px} v=${spd}`,
        ).toBe(true);
        expect(
          ev.some((e) => e.type === 'fault'),
          `x=${px} v=${spd}`,
        ).toBe(false);
        expect(first && first.type === 'bounce' && first.side, `x=${px} v=${spd}`).toBe(1);
      }
    }
  });

  it('toque levíssimo com a raquete no meio da mesa é a curtinha: passa a rede e cai logo depois', () => {
    const b = ppNewBall();
    b.x = 0;
    b.y = 1.3;
    b.z = 1.9;
    b.vy = -1;
    b.vz = 3;
    const info = ppPaddleHit(b, 0, { x: 0, y: 1.3, vx: 0, vy: 0, vz: 1, reach: 1.9 });
    expect(info.stroke).toBe('curta');
    const land = ppLanding(b, 0, true);
    expect(land.ok).toBe(true);
    expect(Math.abs(land.z)).toBeLessThan(1.4);
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

  it('cada jeito de jogar a raquete dá um golpe: corte, topspin, drive, curva, curta, lob e smash', () => {
    const stroke = (
      m: { vx?: number; vz: number; reach?: number },
      ball?: { y?: number; vz?: number },
    ) => {
      const b = ppNewBall();
      b.x = 0;
      b.y = ball?.y ?? 1.3;
      b.z = 3.2;
      b.vy = -1;
      b.vz = ball?.vz ?? 4;
      const info = ppPaddleHit(b, 0, {
        x: 0,
        y: b.y,
        vx: m.vx ?? 0,
        vy: 0,
        vz: m.vz,
        reach: m.reach,
      });
      return { info, b };
    };
    const corte = stroke({ vz: 1.8 });
    expect(corte.info.stroke).toBe('corte');
    expect(corte.b.wx).toBeGreaterThan(0); // backspin
    const top = stroke({ vz: 5.5 });
    expect(top.info.stroke).toBe('topspin');
    expect(top.b.wx).toBeLessThan(0); // topspin
    expect(stroke({ vz: 10 }).info.stroke).toBe('drive');
    const curva = stroke({ vz: 4.5, vx: 6 });
    expect(curva.info.stroke).toBe('curva');
    expect(Math.abs(curva.b.wy)).toBeGreaterThan(10);
    const curta = stroke({ vz: 2, reach: 2.8 });
    expect(curta.info.stroke).toBe('curta');
    expect(ppLanding(curta.b, 0, true).ok).toBe(true);
    expect(Math.abs(ppLanding(curta.b, 0, true).z)).toBeLessThan(1.2);
    expect(stroke({ vz: 0, reach: -0.6 }, { vz: 10 }).info.stroke).toBe('lob');
    expect(stroke({ vz: 0 }, { vz: 10 }).info.stroke).toBe('bloqueio');
    expect(stroke({ vz: 8 }, { y: 2.1 }).info.stroke).toBe('smash');
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
  it('quem não faz nada perde: o bot ganha mais pontos (o saque da sala é mansinho, o bot às vezes erra)', () => {
    const m = new PpMatch(0);
    const bot = new PpBot(PP_BOT_LEVELS.medio, createRng('idle'));
    const idle = { ...ppIdleInput(), x: -2.2 }; // parado no canto: só perde
    const won = [0, 0];
    for (let i = 0; i < 60 * 240 && m.phase !== 'over'; i++) {
      m.step([bot.input(m, 0), idle]);
      for (const e of m.drain()) if (e.type === 'point') won[e.winner === 0 ? 0 : 1]!++;
    }
    expect(won[0]!).toBeGreaterThan(5);
    // pontos do parado só vêm do saque que a sala faz por ele
    expect(won[1]!).toBeLessThanOrEqual(won[0]! + 1);
  });

  it('bot contra bot: a partida termina, ninguém trava e há trocas de bola', () => {
    const { m, events } = play('medio', 'medio', 'a1');
    expect(m.phase).toBe('over');
    const [a, b] = m.score;
    expect(Math.max(a, b)).toBeGreaterThanOrEqual(11);
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(2);
    const rallies = events.flatMap((e) => (e.type === 'point' ? [e.rally] : []));
    const avg = rallies.reduce((x, y) => x + y, 0) / rallies.length;
    expect(avg).toBeGreaterThan(2.5);
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
  it('batida mansa e média passam a rede e caem na mesa; batida de força para o cantinho sai da mesa', () => {
    const strokes: [number, number][] = [
      [0, 0.5],
      [1, 2],
      [2, 4],
    ];
    for (const [vy, vz] of strokes) expect(swing(vy, vz).ok).toBe(true);
    // forte e para o canto contra uma bola rápida: a ajuda não corrige, a bola sai
    const b = ppNewBall();
    b.x = 1.4;
    b.y = 1.3;
    b.z = 3.3;
    b.vy = -1;
    b.vz = 12;
    ppPaddleHit(b, 0, { x: 1.4, y: 1.3, vx: 9, vy: 0, vz: 9 });
    expect(ppLanding(b, 0).ok).toBe(false);
  });
});

describe('golpes e saque', () => {
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

describe('bola mal pegada e smash cronometrado', () => {
  const incoming = (x: number, vz: number) => {
    const b = ppNewBall();
    b.x = x;
    b.y = 1.4;
    b.z = 3.3;
    b.vy = -0.5;
    b.vz = vz;
    return b;
  };

  it('bola forte pega na borda da raquete sobe (subida); pega inteira, nada acontece', () => {
    const edge = incoming(0.46, 10);
    const info = ppPaddleHit(edge, 0, { x: 0, y: 1.4, vx: 0, vy: 0, vz: 1 });
    expect(info.quality).toBe('edge');
    expect(info.stroke).toBe('subida');
    expect(edge.vy).toBeGreaterThan(3.5);
    expect(ppLanding(edge, 0).ok).toBe(true);
    const clean = incoming(0.02, 10);
    expect(ppPaddleHit(clean, 0, { x: 0, y: 1.4, vx: 0, vy: 0, vz: 1 }).stroke).not.toBe('subida');
    // bola mansa na borda não vira subida
    const soft = incoming(0.46, 4);
    expect(ppPaddleHit(soft, 0, { x: 0, y: 1.4, vx: 0, vy: 0, vz: 1 }).stroke).not.toBe('subida');
  });

  it('o smash por nível: vermelho é mais fraco, verde forte, verde perfeito muito rápido, e todos caem na mesa', () => {
    const speeds = [1, 2, 3].map((tier) => {
      const b = ppNewBall();
      b.x = 0;
      b.y = 2.2;
      b.z = 1.2; // a raquete foi à frente, perto da rede
      b.vy = -1;
      b.vz = 1;
      const info = ppPaddleHit(b, 0, { x: 0, y: 2.2, vx: 0, vy: 0, vz: 7, smash: tier });
      expect(info.stroke).toBe('smash');
      expect(info.tier).toBe(tier);
      expect(b.vy).toBeLessThan(-2);
      expect(ppLanding(b, 0).ok).toBe(true);
      return info.speed;
    });
    expect(speeds[0]).toBeLessThan(speeds[1]!);
    expect(speeds[1]).toBeLessThan(speeds[2]!);
    expect(speeds[2]).toBeGreaterThan(16);
  });

  it('na partida: a subida liga a câmera lenta, a barra anda por ticks e o aperto vira o nível do smash', () => {
    const m = new PpMatch(0);
    m.phase = 'rally';
    m.applyHit({
      p: 1,
      serve: false,
      smash: false,
      kmh: 40,
      quality: 'edge',
      spin: 0,
      stroke: 'subida',
      b: [0, 2.6, -1.5, 0, 2, 2, 0, 0, 0],
    });
    expect(m.popup).toBe(true);
    const slow = new PpMatch(0);
    slow.phase = 'rally';
    slow.applyHit({
      p: 1,
      serve: false,
      smash: false,
      kmh: 40,
      quality: 'normal',
      spin: 0,
      stroke: 'normal',
      b: [0, 2.6, -1.5, 0, 2, 2, 0, 0, 0],
    });
    expect(slow.popup).toBe(false);
    for (let i = 0; i < 12; i++) {
      m.step([ppIdleInput(), ppIdleInput()]);
      slow.step([ppIdleInput(), ppIdleInput()]);
    }
    // mesma jogada, menos caminho andado (câmera lenta)
    expect(Math.abs(m.ball.z - -1.5)).toBeLessThan(Math.abs(slow.ball.z - -1.5) * 0.6);
    expect(m.popupTicks).toBe(12);
    expect(ppSmashTier(ppSmashCursor(12))).toBe(3); // no meio do verde
    expect(m.smashTap(0)).toBe(3);
    expect(m.smashTap(0)).toBe(0); // um aperto por bola
    expect(ppSmashTier(ppSmashCursor(0))).toBe(1); // na ponta é vermelho
  });
});

describe('a rede não derruba a batida', () => {
  it('batida de força (sem a ajuda completa) nunca vai na rede por baixo: só a altura sobe o que precisa', () => {
    const hits = [
      [4.5, 0, 3.8],
      [8, 0, 2.8],
      [10, 3, 1.5],
      [6, -4, 3.8],
    ];
    for (const [vz, vx, z] of hits) {
      const b = ppNewBall();
      b.x = 0;
      b.y = 1.4;
      b.z = z!;
      b.vy = -0.5;
      b.vz = 7;
      ppPaddleHit(b, 0, { x: 0, y: 1.4, vx: vx!, vy: 0, vz: vz!, reach: 3.825 - z! });
      const s = ppNewStepOut();
      let crossed = false;
      let net = false;
      for (let i = 0; i < 2400 && !net; i++) {
        const z0 = b.z;
        s.ev = 0;
        ppStepBall(b, s);
        if (z0 > 0 && b.z <= 0) crossed = true;
        if (s.ev & PP_EV_NET) net = true;
        if (crossed || s.ev & PP_EV_FLOOR) break;
      }
      expect(net).toBe(false);
    }
  });
});

describe('a batida não trava o jogo', () => {
  it('resolver uma batida (inclusive com a ajuda) leva poucos milissegundos, em média', () => {
    let total = 0;
    let n = 0;
    for (const vz of [1.5, 5, 8])
      for (const vx of [-6, 0, 6])
        for (const bx of [-3, 0, 3])
          for (const bz of [3.8, 0.8])
            for (const bvz of [3, 12]) {
              const b = ppNewBall();
              b.x = bx;
              b.y = 1.6;
              b.z = bz;
              b.vy = -1;
              b.vz = bvz;
              const t0 = performance.now();
              ppPaddleHit(b, 0, { x: bx, y: 1.6, vx, vy: 0, vz, reach: 3.8 - bz });
              total += performance.now() - t0;
              n++;
            }
    // antes da otimização a média passava de 5 ms (e o pior caso de 80 ms): era o "engasgo" ao bater
    expect(total / n).toBeLessThan(4);
  });
});

describe('o bot alcança a bola que morre curta', () => {
  it('o bot difícil devolve as bolas curtas do fácil: a maioria esmagadora dos pontos é dele', () => {
    let pa = 0;
    let pb = 0;
    for (let g = 0; g < 2; g++) {
      const rng = createRng('curtas' + g);
      const m = new PpMatch(g);
      const a = new PpBot(PP_BOT_LEVELS.dificil, rng);
      const b = new PpBot(PP_BOT_LEVELS.facil, rng);
      for (let i = 0; i < 60 * 80 && m.phase !== 'over'; i++) {
        m.step([a.input(m, 0), b.input(m, 1)]);
        m.drain();
      }
      pa += m.score[0];
      pb += m.score[1];
    }
    // o bot também pega na borda de vez em quando (dá a barra do smash ao outro), então não é 3x
    expect(pa).toBeGreaterThan(pb * 2);
  });
});

describe('saque pela altura da bola', () => {
  const serveAt = (y: number, x = 0) => {
    const b = ppNewBall();
    b.x = x;
    b.y = y;
    b.z = 3;
    b.vy = -4;
    const info = ppPaddleHit(b, 0, {
      x,
      y,
      vx: 0,
      vy: 0,
      vz: 3,
      reach: 0.9,
      serve: true,
    } as Parameters<typeof ppPaddleHit>[2]);
    return { b, info };
  };
  it('bater no alto é fraco e no ponto certo é mais forte; os três caem na mesa', () => {
    const alto = serveAt(2.6);
    const bom = serveAt(2.0);
    const certo = serveAt(1.6);
    expect(alto.info.quality).toBe('edge');
    expect(bom.info.quality).toBe('normal');
    expect(certo.info.quality).toBe('sweet');
    expect(certo.info.speed).toBeGreaterThan(bom.info.speed);
    expect(bom.info.speed).toBeGreaterThan(alto.info.speed);
    for (const s of [alto, bom, certo]) expect(ppLanding(s.b, 0, false).ok).toBe(true);
  });
});

describe('smash cronometrado', () => {
  const rates = (tier: number) => {
    const rng = createRng('smash-rate-' + tier);
    let ok = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const b = ppNewBall();
      const side = i % 2;
      const fwd = side === 0 ? -1 : 1;
      b.x = (rng() - 0.5) * 3.6;
      b.y = 1.3 + rng() * 1.2;
      b.z = -fwd * (2.2 + rng() * 1);
      b.vx = (rng() - 0.5) * 4;
      b.vy = -1 - rng() * 4;
      b.vz = -fwd * -(4 + rng() * 6);
      const pad = {
        x: b.x + (rng() - 0.5) * 0.4,
        y: b.y + (rng() - 0.5) * 0.4,
        vx: (rng() - 0.5) * 6,
        vy: (rng() - 0.5) * 4,
        vz: 1 + rng() * 6,
        reach: 0.3,
        smash: tier,
      } as Parameters<typeof ppPaddleHit>[2];
      ppPaddleHit(b, side, pad);
      if (ppLanding(b, side, false).ok) ok++;
    }
    return ok / n;
  };
  it('o verde do meio (nível 3) sempre cai dentro da mesa e vai forte', () => {
    expect(rates(3)).toBe(1);
  });
  it('os outros níveis acertam quase sempre (o erro é raro)', () => {
    expect(rates(2)).toBeGreaterThan(0.9);
    expect(rates(1)).toBeGreaterThan(0.85);
  });
});

describe('saque: qualquer avanço da mão pega a bola', () => {
  it('bater para a frente com a bola na altura da raquete sempre pega, mesmo curto', () => {
    for (const zf of [0.3, 0.5, 0.7, 1.2, 1.6]) {
      for (const px of [-2, 0, 2.2]) {
        const m = new PpMatch(0);
        const ev: PpEvent[] = [];
        let clicked = false;
        let swingFrom = -1;
        for (let i = 0; i < 60 * 4; i++) {
          if (m.phase === 'toss' && swingFrom < 0 && m.ball.vy < 0 && m.ball.y < 2.15)
            swingFrom = i;
          m.step([
            {
              ...ppIdleInput(),
              manual: false,
              x: px,
              y: 1.5,
              z: swingFrom >= 0 ? zf : 0,
              serve: m.phase === 'serve' && !clicked && i > 20,
            },
            ppIdleInput(),
          ]);
          if (m.phase === 'toss') clicked = true;
          ev.push(...m.drain());
          if (ev.some((e) => e.type === 'hit' || e.type === 'fault')) break;
        }
        expect(
          ev.some((e) => e.type === 'hit' && e.serve),
          `z=${zf} x=${px}`,
        ).toBe(true);
      }
    }
  });
});

describe('saque nunca erra a mesa', () => {
  it('qualquer força, direção e altura: a bola do saque cai na mesa do outro lado', () => {
    const rng = createRng('serve-never-misses');
    let bad = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const side = i % 2;
      const b = ppNewBall();
      b.x = (rng() - 0.5) * 6.2;
      b.y = 1.2 + rng() * 1.8;
      b.z = (side === 0 ? 1 : -1) * 3.0;
      b.vx = 0;
      b.vy = -rng() * 5;
      b.vz = 0;
      ppPaddleHit(b, side, {
        x: b.x + (rng() - 0.5) * 0.6,
        y: b.y + (rng() - 0.5) * 0.6,
        vx: (rng() - 0.5) * 18,
        vy: (rng() - 0.5) * 12,
        vz: rng() * 14,
        reach: rng() * 1.5,
        serve: true,
      } as Parameters<typeof ppPaddleHit>[2]);
      if (!ppLanding(b, side, false).ok) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe('saque de ponta a ponta', () => {
  it('com a mão em qualquer lugar e momento a bola batida cai na mesa (sem rede nem falta)', () => {
    const rng = createRng('serve-e2e');
    const res: Record<string, number> = {};
    for (let k = 0; k < 400; k++) {
      const m = new PpMatch(0);
      const px = (rng() - 0.5) * 6;
      const zHand = rng() * 1.6;
      const delay = Math.floor(rng() * 40);
      const swingX = (rng() - 0.5) * 2; // moves x target while swinging
      let clicked = false;
      let tossT = -1;
      const ev: PpEvent[] = [];
      for (let i = 0; i < 60 * 5; i++) {
        if (m.phase === 'toss' && tossT < 0) tossT = i;
        const sw = tossT >= 0 && i - tossT > delay;
        m.step([
          {
            ...ppIdleInput(),
            manual: false,
            x: px + (sw ? swingX : 0),
            y: 1.5,
            z: sw ? zHand : 0,
            serve: m.phase === 'serve' && !clicked && i > 20,
          },
          ppIdleInput(),
        ]);
        if (m.phase === 'toss') clicked = true;
        ev.push(...m.drain());
        if (
          ev.some((e) => e.type === 'point' || e.type === 'fault') ||
          ev.filter((e) => e.type === 'bounce').length >= 2
        )
          break;
      }
      const hit = ev.some((e) => e.type === 'hit');
      const net = ev.some((e) => e.type === 'net');
      const fault = ev.some((e) => e.type === 'fault');
      const b1 = ev.find((e) => e.type === 'bounce') as any;
      const key = !hit
        ? 'sem-batida'
        : net
          ? 'rede'
          : fault
            ? 'falta'
            : b1?.side === 1
              ? 'mesa-ok'
              : 'outro:' + JSON.stringify(b1);
      res[key] = (res[key] ?? 0) + 1;
    }
    // bateu na bola: sempre cai na mesa (nada de rede nem falta); só não bate quem tirou a mão de perto da bola
    expect(Object.keys(res).filter((k) => k !== 'mesa-ok' && k !== 'sem-batida')).toEqual([]);
    expect(res['mesa-ok'] ?? 0).toBeGreaterThan(380);
  });
});

describe('batida forte com efeito: depende da bola que chega', () => {
  const run = (vinTarget: number) => {
    const rng = createRng('forte-' + vinTarget);
    let ok = 0;
    let fast = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      const side = i % 2;
      const fwd = side === 0 ? -1 : 1;
      const b = ppNewBall();
      b.x = (rng() - 0.5) * 3;
      b.y = 1.2 + rng() * 0.6;
      b.z = -fwd * (3 + rng() * 0.4);
      b.vz = -fwd * vinTarget * 0.9;
      b.vy = -1 - rng() * 1.5;
      b.vx = (rng() - 0.5) * 1.5;
      const dir = rng() < 0.5 ? -1 : 1;
      const info = ppPaddleHit(b, side, {
        x: b.x,
        y: b.y,
        vx: dir * (6 + rng() * 5),
        vy: rng() * 3,
        vz: 4 + rng() * 6,
        reach: 0.4,
      } as Parameters<typeof ppPaddleHit>[2]);
      if (ppLanding(b, side, false).ok) ok++;
      if (info.speed > 11) fast++;
    }
    return { ok: ok / n, fast: fast / n };
  };
  it('bola lenta: a batida forte de lado cai na mesa e sai rápida', () => {
    const r = run(3);
    expect(r.ok).toBeGreaterThan(0.95);
    expect(r.fast).toBeGreaterThan(0.6);
  });
  it('bola de velocidade normal: a batida forte de lado sai da mesa na maior parte das vezes', () => {
    expect(run(9).ok).toBeLessThan(0.45);
    expect(run(14).ok).toBeLessThan(0.45);
  });
});

describe('lenta, média e rápida bem separadas', () => {
  const out = (hand: number) => {
    const b = ppNewBall();
    b.x = 0;
    b.y = 1.3;
    b.z = 3.3;
    b.vz = 7;
    b.vy = -1;
    return ppPaddleHit(b, 0, { x: 0, y: 1.3, vx: 0, vy: 0, vz: hand, reach: 0.4 } as never).speed;
  };
  it('a batida forte sai bem mais rápida que a média, e a média mais que a lenta', () => {
    const lenta = out(2.5);
    const media = out(5.5);
    const rapida = out(17);
    expect(media).toBeGreaterThan(lenta + 2);
    expect(rapida).toBeGreaterThan(media + 5);
    expect(rapida).toBeGreaterThan(16);
    expect(media).toBeLessThan(13);
  });
});

describe('bola lenta de verdade', () => {
  it('uma empurrada mansa sai em arco lento (pouca velocidade para a frente) e ainda cai na mesa', () => {
    const rng = createRng('lentas');
    let ok = 0;
    let slow = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const b = ppNewBall();
      b.x = (rng() - 0.5) * 3;
      b.y = 1.2 + rng() * 0.5;
      b.z = 3.3;
      b.vz = 3 + rng() * 7;
      b.vy = -1 - rng();
      const info = ppPaddleHit(b, 0, {
        x: b.x,
        y: b.y,
        vx: (rng() - 0.5) * 2,
        vy: 0,
        vz: 1 + rng() * 1.5,
        reach: 0.3,
      } as never);
      if (ppLanding(b, 0, false).ok) ok++;
      if (Math.hypot(b.vx, b.vz) < 6.5 && info.speed > 0) slow++;
    }
    expect(ok / n).toBeGreaterThan(0.95);
    expect(slow / n).toBeGreaterThan(0.6);
  });
});

describe('o smash nunca quica na própria mesa', () => {
  it('verde claro, verde e vermelho: a bola do smash nunca cai do seu lado (pode sair, mas não volta para a sua mesa)', () => {
    for (const tier of [1, 2, 3]) {
      const rng = createRng('smash-own-' + tier);
      let own = 0;
      const n = 1500;
      for (let i = 0; i < n; i++) {
        const side = i % 2;
        const fwd = side === 0 ? -1 : 1;
        const b = ppNewBall();
        b.x = (rng() - 0.5) * 3.4;
        b.y = 1.05 + rng() * 2.2;
        b.z = -fwd * (0.3 + rng() * 3);
        b.vx = (rng() - 0.5) * 3;
        b.vy = -3 + rng() * 6;
        b.vz = -fwd * -(1 + rng() * 8);
        ppPaddleHit(b, side, {
          x: b.x,
          y: b.y,
          vx: (rng() - 0.5) * 8,
          vy: (rng() - 0.5) * 3,
          vz: rng() * 14,
          reach: rng() * 1.2,
          smash: tier,
        } as Parameters<typeof ppPaddleHit>[2]);
        const L = ppLanding(b, side, false);
        if (!L.ok && L.z * (side === 0 ? 1 : -1) > 0.3) own++;
      }
      expect(own, `nível ${tier}`).toBe(0);
    }
  });
});
