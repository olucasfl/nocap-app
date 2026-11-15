import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { golfHit, golfNewBall, golfStep, golfStrokeSpeed, GolfLevel, GOLF_DT, type GolfLevelData } from './physics';

const load = (n: number) =>
  new GolfLevel(JSON.parse(readFileSync(new URL(`./levels/level-${n}.json`, import.meta.url), 'utf8')) as GolfLevelData);

/** Joga uma tacada e devolve o estado final (até 25 s de jogo). */
function shoot(lv: GolfLevel, angle: number, power: number, maxSec = 25) {
  const b = golfNewBall(lv.data);
  golfHit(b, [Math.cos(angle), Math.sin(angle)], power);
  let t = 0;
  let rim = 0;
  for (let i = 0; i < maxSec / GOLF_DT; i++) {
    golfStep(lv, b, t);
    t += GOLF_DT;
    if (b.rim) rim++;
    if (b.holed || b.outOfBounds) break;
    if (!b.moving && i > 60) break;
  }
  return { b, t, rim };
}

describe('Mini Golf: física portada do Open Golf', () => {
  it('a força vira velocidade pelas faixas do Open Golf', () => {
    expect(golfStrokeSpeed(0)).toBe(2);
    expect(golfStrokeSpeed(0.4)).toBe(8);
    expect(golfStrokeSpeed(0.65)).toBe(16);
    expect(golfStrokeSpeed(1)).toBe(20);
  });

  it('a bola parada na saída fica parada (não afunda nem pula)', () => {
    const lv = load(1);
    const b = golfNewBall(lv.data);
    const y0 = b.pos[1];
    for (let i = 0; i < 240; i++) golfStep(lv, b, i * GOLF_DT);
    expect(Math.abs(b.pos[1] - y0)).toBeLessThan(0.05);
    expect(b.moving).toBe(false);
    expect(b.outOfBounds).toBe(false);
  });

  it('é determinística: a mesma tacada dá o mesmo resultado', () => {
    const a = shoot(load(1), 1.2, 0.5);
    const b = shoot(load(1), 1.2, 0.5);
    expect(a.b.pos).toEqual(b.b.pos);
    expect(a.t).toBe(b.t);
  });

  it('a bola para dentro da fase em tacadas suaves (não atravessa a parede)', () => {
    const lv = load(1);
    for (const ang of [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6]) {
      const { b } = shoot(lv, ang, 0.35, 15);
      expect(b.pos[1]).toBeGreaterThan(-3);
    }
  });

  /** Põe a bola a `d` metros do buraco, rolando para ele a `speed` m/s, e simula. */
  function approach(n: number, d: number, speed: number, side = 0) {
    const lv = load(n);
    const h = lv.data.holes[0]!.p;
    const b = golfNewBall(lv.data);
    // vem de trás (-x) e rola até o buraco, na altura do chão do buraco
    b.pos = [h[0] - d, h[1] + 0.12, h[2] + side];
    const dx = h[0] - b.pos[0], dz = h[2] - b.pos[2];
    const l = Math.hypot(dx, dz);
    // com `side`, a bola passa ao lado: segue em linha reta (+x) em vez de mirar o buraco
    b.vel = side === 0 ? [(dx / l) * speed, 0, (dz / l) * speed] : [speed, 0, 0];
    b.moving = true;
    let t = 0;
    let tIn = -1;
    for (let i = 0; i < 12 / GOLF_DT; i++) {
      golfStep(lv, b, t);
      t += GOLF_DT;
      if (b.inHole && tIn < 0) tIn = t;
      if (b.holed || b.outOfBounds) break;
    }
    return { b, t, tIn };
  }

  it('bola devagar rolando para o buraco cai e só conta depois de assentar no fundo', () => {
    const r = approach(3, 1.0, 3.0);
    expect(r.b.inHole).toBe(true);
    expect(r.b.holed).toBe(true);
    // entre cair e valer passa um tempo (a bola cai, quica e assenta)
    expect(r.t - r.tIn).toBeGreaterThan(0.3);
  });

  it('bola rápida passa por cima do buraco sem cair', () => {
    // fase 1: a do Open Golf em que o buraco fica no meio, sem muro logo atrás (a bola não volta e cai)
    const r = approach(1, 1.0, 12);
    expect(r.b.holed).toBe(false);
  });

  it('bola que passa longe do buraco não cai', () => {
    const r = approach(3, 1.0, 3.0, 0.9);
    expect(r.b.holed).toBe(false);
  });
});
