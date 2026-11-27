import { describe, expect, it } from 'vitest';
import { GolfLevel, GOLF_BALL_RADIUS, GOLF_DT, GolfHoleSim, golfServerLevel, type V3 } from './index';
import { GolfPredictWorld } from './predict';

/** Uma fase com chão plano perto da largada; duas bolas na mesma linha. */
const data = golfServerLevel(1);
const start = data.ballStart;
const FAR: V3 = [start[0], start[1] + GOLF_BALL_RADIUS, start[2]];

function net(pos: V3, vel: V3 = [0, 0, 0], st = 0, age = 0) {
  return { pos, vel, st, age };
}

describe('mundo previsto no aparelho (Mini Golf online)', () => {
  it('a minha tacada bate na bola parada no ponto certo: nunca uma entra na outra e a outra reage na hora', () => {
    const w = new GolfPredictWorld(new GolfLevel(data), true);
    const target: V3 = [FAR[0] + 0.6, FAR[1], FAR[2]];
    w.apply(0, net(FAR));
    w.apply(1, net(target));
    expect(w.shoot(0, [1, 0], 0.35)).toBe(true);
    let minGap = Infinity;
    let moved = false;
    for (let i = 0; i < 120 * 2; i++) {
      w.advance(GOLF_DT, i * GOLF_DT);
      minGap = Math.min(minGap, w.minGap());
      if (Math.abs(w.pos(1)![0] - target[0]) > 0.05) moved = true;
    }
    expect(moved).toBe(true);
    // as bolas se encostam, mas a sobreposição fica abaixo de 1 cm (a correção de posição do passo)
    expect(minGap).toBeGreaterThan(-0.01);
  });

  it('o quadro do servidor, que ainda não sabe da batida, não desfaz a batida local', () => {
    const w = new GolfPredictWorld(new GolfLevel(data), true);
    const target: V3 = [FAR[0] + 0.6, FAR[1], FAR[2]];
    w.apply(0, net(FAR));
    w.apply(1, net(target));
    w.shoot(0, [1, 0], 0.4);
    for (let i = 0; i < 40; i++) w.advance(GOLF_DT, i * GOLF_DT);
    const x1 = w.pos(1)![0];
    expect(x1).toBeGreaterThan(target[0] + 0.01);
    // o servidor ainda diz "parada no lugar de antes" (quadro velho): a bola atingida não volta
    w.apply(1, net(target));
    expect(w.pos(1)![0]).toBeGreaterThanOrEqual(x1 - 1e-6);
  });

  it('bola de outra pessoa segue o servidor sem pulos e sem ficar para trás', () => {
    const w = new GolfPredictWorld(new GolfLevel(data), false);
    const server = new GolfHoleSim(data, ['a'], { collide: false, seconds: 60 });
    server.shoot('a', [1, 0], 0.3);
    const p = server.players.get('a')!;
    w.apply(0, net([...p.ball.pos] as V3, [...p.ball.vel] as V3, 1));
    let worst = 0;
    let last = w.pos(0)![0];
    let maxJump = 0;
    // o servidor manda um quadro a cada 4 passos (30 por segundo); o aparelho anda a cada passo, com atraso de 2 passos
    for (let i = 1; i <= 120; i++) {
      server.step();
      w.advance(GOLF_DT, i * GOLF_DT);
      if (i % 4 === 0) w.apply(0, net([...p.ball.pos] as V3, [...p.ball.vel] as V3, p.status === 'roll' ? 1 : 0, 0.0));
      const x = w.pos(0)![0];
      maxJump = Math.max(maxJump, Math.abs(x - last));
      last = x;
      worst = Math.max(worst, Math.abs(x - p.ball.pos[0]));
    }
    expect(worst).toBeLessThan(0.12);
    expect(maxJump).toBeLessThan(0.1);
  });

  it('erro grande (volta ao ponto da tacada) salta para o servidor', () => {
    const w = new GolfPredictWorld(new GolfLevel(data), true);
    w.apply(0, net(FAR));
    w.shoot(0, [1, 0], 0.5);
    for (let i = 0; i < 20; i++) w.advance(GOLF_DT, i * GOLF_DT);
    w.apply(0, net([FAR[0] + 9, FAR[1], FAR[2]], [0, 0, 0], 0));
    // dentro do tempo de confiança a previsão mantém; depois dele o servidor vale
    for (let i = 0; i < 120 * 2; i++) w.advance(GOLF_DT, i * GOLF_DT);
    w.apply(0, net([FAR[0] + 9, FAR[1], FAR[2]], [0, 0, 0], 0));
    expect(w.pos(0)![0]).toBeGreaterThan(FAR[0] + 7);
  });

  it('quem está no buraco fica parado onde o servidor diz', () => {
    const w = new GolfPredictWorld(new GolfLevel(data), true);
    w.apply(0, net(FAR, [0, 0, 0], 2));
    for (let i = 0; i < 60; i++) w.advance(GOLF_DT, i * GOLF_DT);
    expect(w.pos(0)).toEqual(FAR);
    expect(w.shoot(0, [1, 0], 1)).toBe(false);
  });
});
