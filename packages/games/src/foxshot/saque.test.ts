import { describe, expect, it } from 'vitest';
import { FsLoadout } from './gun';
import { FS_DRAW_S } from './weapons';

const idle = { trigger: false, reload: false, alt: false, inspect: false };
const mv = { moving: false, airborne: false, ads: false, speed: 0 };

describe('saque da arma', () => {
  it('não atira nem guarda clique durante o saque, e atira depois dele', () => {
    const lo = new FsLoadout('ak', 'pistol');
    lo.switchTo(2); // faca
    lo.update(0.5, idle, mv, 'p');
    lo.switchTo(0); // de volta ao fuzil
    expect(lo.drawT).toBeCloseTo(FS_DRAW_S, 3);
    let fired = 0;
    for (let t = 0; t < 20; t++) fired += lo.update(0.016, { ...idle, trigger: true }, mv, 'p').filter((e) => e.type === 'fire').length;
    expect(lo.drawT).toBeGreaterThan(0.1); // ainda sacando: nada saiu
    expect(fired).toBe(0);
    for (let t = 0; t < 30; t++) fired += lo.update(0.016, { ...idle, trigger: true }, mv, 'p').filter((e) => e.type === 'fire').length;
    expect(fired).toBeGreaterThan(0);
  });
  it('clique durante o saque de arma semiautomática não fica guardado', () => {
    const lo = new FsLoadout('sniper', 'pistol');
    lo.switchTo(1);
    lo.update(0.5, idle, mv, 'p');
    lo.switchTo(0);
    let fired = 0;
    fired += lo.update(0.016, { ...idle, trigger: true }, mv, 'p').filter((e) => e.type === 'fire').length;
    for (let t = 0; t < 40; t++) fired += lo.update(0.016, idle, mv, 'p').filter((e) => e.type === 'fire').length;
    expect(fired).toBe(0);
  });
  it('inspecionar vale na hora, durante o saque (arma e faca)', () => {
    const lo = new FsLoadout('ak', 'pistol');
    lo.switchTo(1);
    lo.update(0.5, idle, mv, 'p');
    lo.switchTo(0);
    const ev = lo.update(0.016, { ...idle, inspect: true }, mv, 'p');
    expect(ev.some((e) => e.type === 'inspect')).toBe(true);
    const k = new FsLoadout('ak', 'pistol');
    k.switchTo(2);
    const ke = k.update(0.016, { ...idle, inspect: true }, mv, 'p');
    expect(ke.some((e) => e.type === 'inspect')).toBe(true);
    const ka = new FsLoadout('ak', 'pistol');
    ka.switchTo(2);
    expect(ka.update(0.016, { ...idle, trigger: true }, mv, 'p').some((e) => e.type === 'melee')).toBe(false);
  });
});
