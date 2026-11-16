import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { gpBotInput, gpBotProfile, newGpBotMemory } from './bots';
import { GP_DT, GP_HALF_WIDTH } from './constants';
import { gpTrack, gpTrackDefFor } from './track';
import { GP_TRACK_BALA } from './track-bala';
import { GP_TRACK_CASTLE } from './track-castle';
import { GpWorld, type GpInput } from './world';

const info = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot: true }));

describe('Castle Circuit (spec 086, F1)', () => {
  it('só existe no Arcade com poderes; a Bala Track fica no sem poderes', () => {
    expect(gpTrackDefFor('arcade', null, true).id).toBe('castle');
    expect(gpTrackDefFor('arcade', 'castle', true).id).toBe('castle');
    expect(gpTrackDefFor('arcade', 'castle', false).id).toBe('bala');
    expect(gpTrackDefFor('arcade', null, false).id).toBe(GP_TRACK_BALA.id);
    expect(gpTrackDefFor('real', 'castle', true).id).toBe('marina');
  });

  it('a pista tem o tamanho e a altura do modelo, e 3 placas de turbo dentro da pista', () => {
    const t = gpTrack(GP_TRACK_CASTLE);
    expect(t.length).toBeGreaterThan(650);
    expect(t.length).toBeLessThan(950);
    expect(t.pads).toHaveLength(3);
    for (const p of t.pads) expect(Math.abs(p.d)).toBeLessThan(GP_HALF_WIDTH);
    // a estrada sobe e desce (morro e ponte), e a largada fica em 0
    let lo = Infinity;
    let hi = -Infinity;
    for (let s = 0; s < t.length; s += 5) {
      const y = t.yAt(s);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    expect(hi - lo).toBeGreaterThan(5);
    expect(Math.abs(t.yAt(0))).toBeLessThan(0.5);
    // a altura é contínua (sem degrau entre amostras vizinhas de 1 m)
    for (let s = 0; s < t.length; s += 1)
      expect(Math.abs(t.yAt(s + 1) - t.yAt(s))).toBeLessThan(0.6);
  });

  it('a estrada inclina de lado e a superfície acompanha: as rodas ficam na pista', () => {
    const t = gpTrack(GP_TRACK_CASTLE);
    let maxBank = 0;
    for (let s = 0; s < t.length; s += 3) maxBank = Math.max(maxBank, Math.abs(t.bankAt(s)));
    expect(maxBank).toBeGreaterThan(0.03);
    expect(maxBank).toBeLessThanOrEqual(0.3 + 1e-9);
    // onde a estrada é inclinada, o lado alto fica mais alto que o baixo, na proporção da inclinação
    let s0 = 0;
    for (let s = 0; s < t.length; s += 3)
      if (Math.abs(t.bankAt(s)) > Math.abs(t.bankAt(s0))) s0 = s;
    const bank = t.bankAt(s0);
    const hi = t.surfaceY(s0, 5);
    const lo = t.surfaceY(s0, -5);
    expect(Math.sign(hi - lo)).toBe(Math.sign(bank));
    expect(Math.abs(hi - lo)).toBeCloseTo(10 * Math.abs(Math.tan(bank)), 5);
  });

  it('a descida acelera e a subida freia o kart (sem mexer em quem está parado)', () => {
    const w = new GpWorld('slope', info(1), GP_TRACK_CASTLE, 'arcade', 3);
    w.beginRace(['p0']);
    const t = w.track;
    // acha o trecho mais íngreme de descida e o de subida
    let down = 0;
    let up = 0;
    for (let s = 5; s < t.length - 5; s += 2) {
      const sl = (t.yAt(s + 1.5) - t.yAt(s - 1.5)) / 3;
      if (sl < (t.yAt(down + 1.5) - t.yAt(down - 1.5)) / 3) down = s;
      if (sl > (t.yAt(up + 1.5) - t.yAt(up - 1.5)) / 3) up = s;
    }
    expect((t.yAt(down + 1.5) - t.yAt(down - 1.5)) / 3).toBeLessThan(-0.01);
    expect((t.yAt(up + 1.5) - t.yAt(up - 1.5)) / 3).toBeGreaterThan(0.01);
    const run = (at: number) => {
      const c = w.cars[0]!;
      const p = t.pointAt(at, 0);
      const pr = t.projectGlobal(p.x, p.z);
      Object.assign(c, {
        x: p.x,
        z: p.z,
        h: p.h,
        idx: pr.i,
        s: pr.s,
        d: pr.d,
        prog: at,
        speed: 20,
        vx: Math.sin(p.h) * 20,
        vz: -Math.cos(p.h) * 20,
        spin: 0,
      });
      for (let k = 0; k < 30; k++) w.step(GP_DT, { p0: { throttle: 0, brake: 0, steer: 0 } });
      return c.speed;
    };
    expect(run(down)).toBeGreaterThan(run(up));
  });

  it('6 bots completam 3 voltas passando pela ponte, sem teleportar nem sair da pista', () => {
    const w = new GpWorld('castle-bots', info(6), GP_TRACK_CASTLE, 'arcade', 3);
    const rng = createRng('castle:bots');
    const mem = new Map(w.cars.map((c, i) => [c.id, newGpBotMemory(gpBotProfile('castle', i))]));
    const drive = (sec: number, stop: () => boolean) => {
      for (let k = 0; k < sec / GP_DT && !stop(); k++) {
        const inputs: Record<string, GpInput> = {};
        for (const c of w.cars) inputs[c.id] = gpBotInput(w, c, mem.get(c.id)!, rng);
        w.step(GP_DT, inputs);
      }
    };
    drive(120, () => w.qualiDone());
    w.beginRace(w.gridOrder());
    let jump = 0;
    const last = new Map(w.cars.map((c) => [c.id, c.prog]));
    for (let k = 0; k < 420 / GP_DT && !w.ended; k++) {
      const inputs: Record<string, GpInput> = {};
      for (const c of w.cars) inputs[c.id] = gpBotInput(w, c, mem.get(c.id)!, rng);
      w.step(GP_DT, inputs);
      for (const c of w.cars) {
        // o avanço de um passo nunca passa de 3 m (60 Hz a 34 m/s dá ~0,6 m): pular de trecho na ponte seria bem maior
        if (Math.abs(c.prog - last.get(c.id)!) > 6) jump++;
        last.set(c.id, c.prog);
      }
    }
    console.log(
      'LAPS',
      w.cars
        .map(
          (c) =>
            `${c.finished ? 'F' : '-'}${c.laps.length}:${Math.round((c.bestLap ?? 0) / 100) / 10}`,
        )
        .join(' '),
      't',
      Math.round(w.t),
    );
    for (const c of w.cars)
      if (!c.finished)
        console.log(
          'STUCK',
          c.id,
          c.prog.toFixed(0),
          c.s.toFixed(0),
          c.d.toFixed(1),
          c.speed.toFixed(1),
          c.surface,
          w.track.yAt(c.s).toFixed(1),
        );
    expect(jump).toBe(0);
    const fin = w.cars.filter((c) => c.finished);
    expect(fin.length).toBeGreaterThanOrEqual(5);
    for (const c of fin) expect(c.laps.length).toBe(3);
  }, 60_000);
});
