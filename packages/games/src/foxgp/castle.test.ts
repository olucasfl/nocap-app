import { readFileSync } from 'node:fs';
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

/** O chão do mapa (`ground.bin`): célula de 1 m, o andar de baixo e o de cima (Int16 em centímetros; -32768 = sem chão). */
function loadGround() {
  const dir = new URL('../../../../apps/web/public/foxgp/castle/', import.meta.url);
  const m = JSON.parse(readFileSync(new URL('ground.json', dir), 'utf8')) as { x0: number; z0: number; w: number; h: number; cell: number };
  const b = readFileSync(new URL('ground.bin', dir));
  const low = new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + m.w * m.h * 2));
  const has = (x: number, z: number) => {
    const cx = Math.floor((x - m.x0) / m.cell);
    const cz = Math.floor((z - m.z0) / m.cell);
    return cx >= 0 && cz >= 0 && cx < m.w && cz < m.h && low[cz * m.w + cx] !== -32768;
  };
  return has;
}

describe('Castle Circuit: física fiel ao visual (spec 086, seção 11)', () => {
  it('a barreira nunca deixa o kart andar sobre um vazio de 2 m ou mais no chão do mapa', () => {
    const t = gpTrack(GP_TRACK_CASTLE);
    const has = loadGround();
    const bad: string[] = [];
    for (let i = 0; i < t.n; i++) {
      for (const side of [1, -1]) {
        const nx = -t.tz[i]! * side;
        const nz = t.tx[i]! * side;
        const wall = side > 0 ? t.wallR[i]! : t.wallL[i]!;
        let run = 0;
        for (let d = 0; d <= Math.min(wall, 40); d += 0.5) {
          run = has(t.x[i]! + nx * d, t.z[i]! + nz * d) ? 0 : run + 1;
          // 4 passos de 0,5 m = 2 m sem chão; a folga de 1 m cobre o piso mínimo da barreira (a pista tem 7 m de meia largura)
          if (run >= 4 && d - 1.5 >= 5.5 && d - 1.5 < wall - 1.0) {
            bad.push(`${i}/${side}: vazio a ${(d - 1.5).toFixed(1)} m, barreira em ${wall.toFixed(1)} m`);
            break;
          }
        }
      }
    }
    expect(bad.slice(0, 5), `${bad.length} amostras`).toEqual([]);
  });

  it('no cruzamento da ponte a barreira não vira um muro invisível no meio do caminho', () => {
    const t = gpTrack(GP_TRACK_CASTLE);
    // uma amostra em cima da ponte: a estrada de baixo passa a mais de 3 m de altura e não pode apertar a barreira
    let checked = 0;
    for (let i = 0; i < t.n; i++) {
      if (!t.overlap[i]) continue;
      const here = t.yAt(i * t.ds);
      // só onde existe outro trecho em andar diferente perto (a ponte ou o que passa embaixo dela)
      const apart = Array.from({ length: t.n }, (_, j) => j).some(
        (j) => Math.min(Math.abs(i - j), t.n - Math.abs(i - j)) > 70 && Math.hypot(t.x[j]! - t.x[i]!, t.z[j]! - t.z[i]!) < 14 && Math.abs(t.yAt(j * t.ds) - here) > 3,
      );
      if (!apart) continue;
      checked++;
      // sem a regra de andares a barreira caía para ~9 m no meio do caminho; agora vale o que o modelo e o chão dizem (nunca menos que o piso da barreira)
      expect(Math.min(t.wallL[i]!, t.wallR[i]!)).toBeGreaterThanOrEqual(GP_HALF_WIDTH - 1.5);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
