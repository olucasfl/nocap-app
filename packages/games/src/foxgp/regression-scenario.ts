import { GP_DT } from './constants';
import { GP_TRACK_MARINA } from './track';
import { GpWorld, type GpInput } from './world';

/**
 * Cenário fixo do teste de regressão do modo Arcade (spec 080, Fase 0): só um carro na pista por vez (sem vácuo nem
 * DRS, que mudam de propósito na v2) e uma batida entre dois carros abaixo da velocidade do vácuo. O piloto é uma
 * função pura do estado, então a mesma física dá exatamente os mesmos números.
 * Só para teste: não é exportado pelo pacote.
 */
export function gpRegressionRun(mode?: unknown) {
  const out: Record<string, number[] | number | null> = { bumpMaxSpeed: 0 };
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const mk = (n: number) => {
    const infos = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26 }));
    // o terceiro argumento é o modo de física a partir da v2; antes dela o construtor ignora o resto
    return new (GpWorld as unknown as new (...a: unknown[]) => GpWorld)('regress', infos, GP_TRACK_MARINA, mode);
  };
  /** Piloto puro: mira um ponto à frente no centro, freia antes das curvas fechadas. */
  const pilot = (w: GpWorld, id: string, k: number): GpInput => {
    const c = w.car(id)!;
    const p = w.track.pointAt(c.s + 8 + Math.abs(c.speed) * 0.45, 0);
    const want = Math.atan2(p.x - c.x, -(p.z - c.z));
    const diff = Math.atan2(Math.sin(want - c.h), Math.cos(want - c.h));
    let curv = 0;
    for (let dd = 5; dd < 60; dd += 5) curv = Math.max(curv, Math.abs(w.track.curv[w.track.index(c.s + dd)]!));
    const vmax = curv > 1e-4 ? Math.sqrt(18 / curv) : 99;
    const brake = c.speed > vmax + 1 ? 1 : 0;
    // um pouco de zigue-zague fixo, para o volante e o escorregão entrarem no resultado
    const wig = Math.sin(k * 0.05) * 0.15;
    return { throttle: brake ? 0 : 1, brake, steer: Math.max(-1, Math.min(1, diff * 2.6 + wig)) };
  };

  // 1) classificação: sai do box e anda 60 s (só a física: como a volta lançada começa muda na v2)
  {
    const w = mk(1);
    const trace: number[] = [];
    for (let k = 0; k < 60 / GP_DT; k++) {
      const c = w.cars[0]!;
      w.step(GP_DT, { p0: pilot(w, 'p0', k) });
      if (k % 60 === 0) trace.push(r6(c.x), r6(c.z), r6(c.h), r6(c.speed), r6(c.wear));
    }
    out.qualiTrace = trace;
  }
  // 2) corrida de um carro só: 3 voltas, tempos de volta e trajeto
  {
    const w = mk(1);
    w.beginRace(['p0']);
    const trace: number[] = [];
    for (let k = 0; k < 260 / GP_DT && !w.ended; k++) {
      const c = w.cars[0]!;
      w.step(GP_DT, { p0: pilot(w, 'p0', k) });
      if (k % 120 === 0) trace.push(r6(c.x), r6(c.z), r6(c.h), r6(c.vx), r6(c.vz), r6(c.skid), r6(c.wear));
    }
    out.raceTrace = trace;
    out.raceLaps = [...w.cars[0]!.laps];
  }
  // 3) barreira: de frente e de raspão
  {
    const w = mk(1);
    w.beginRace(['p0']);
    const c = w.cars[0]!;
    const trace: number[] = [];
    for (let k = 0; k < 6 / GP_DT; k++) {
      w.step(GP_DT, { p0: { throttle: 1, brake: 0, steer: k < 90 ? 0.55 : -0.2 } });
      if (k % 15 === 0) trace.push(r6(c.x), r6(c.z), r6(c.h), r6(c.spin), r6(c.speed));
    }
    out.wallTrace = trace;
  }
  // 4) batida de traseira entre dois carros, abaixo da velocidade do vácuo
  {
    const w = mk(2);
    w.beginRace(['p0', 'p1']);
    const [a, b] = w.cars;
    const pa = w.track.pointAt(200, 0.4);
    const pb = w.track.pointAt(190, 0);
    Object.assign(a!, { x: pa.x, z: pa.z, h: pa.h, vx: Math.sin(pa.h) * 3, vz: -Math.cos(pa.h) * 3, prog: 200 });
    Object.assign(b!, { x: pb.x, z: pb.z, h: pb.h, vx: Math.sin(pb.h) * 9, vz: -Math.cos(pb.h) * 9, prog: 190 });
    const pr = (c: typeof a) => {
      const q = w.track.projectGlobal(c!.x, c!.z);
      c!.idx = q.i;
      c!.s = q.s;
      c!.d = q.d;
    };
    pr(a);
    pr(b);
    const trace: number[] = [];
    for (let k = 0; k < 3 / GP_DT; k++) {
      w.step(GP_DT, {
        p0: { throttle: 0.05, brake: 0, steer: 0 },
        p1: { throttle: 0.12, brake: 0, steer: 0.05 },
      });
      if (k % 10 === 0) for (const c of [a!, b!]) trace.push(r6(c.x), r6(c.z), r6(c.h), r6(c.spin), r6(c.speed));
      out.bumpMaxSpeed = Math.max((out.bumpMaxSpeed as number) ?? 0, a!.speed, b!.speed);
    }
    out.bumpTrace = trace;
  }
  return out;
}
