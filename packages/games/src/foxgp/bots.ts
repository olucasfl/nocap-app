import {
  GP_BRAKE,
  GP_BRAKE_MIN,
  GP_GRIP_MIN,
  GP_HALF_WIDTH,
  GP_LAPS,
  GP_LAT_ACC,
  GP_PIT_BOX,
  GP_PIT_IN_START,
  GP_PIT_LIMIT,
  GP_SURFACE,
  GP_VMAX,
} from './constants';
import type { GpCar, GpInput, GpWorld } from './world';

/** O que cada bot lembra entre um passo e outro. */
export interface GpBotMemory {
  /** Quanto da aderência ele usa nas curvas (0,8 a 0,97): o "talento". */
  skill: number;
  /** Faixa preferida (m do centro) e até quando fica nela. */
  lane: number;
  laneUntil: number;
  /** Vai parar no box nesta volta. */
  pit: boolean;
  /** Já decidiu sobre o box nesta corrida. */
  pitDecided: boolean;
  /** Preso (barreira, outro carro): dá ré até esta hora. */
  reverseUntil: number;
  stuckT: number;
  /** Tremida do volante (erro humano). */
  wobble: number;
}

export function newGpBotMemory(skill: number): GpBotMemory {
  return {
    skill: Math.max(0.78, Math.min(0.98, skill)),
    lane: 0,
    laneUntil: 0,
    pit: false,
    pitDecided: false,
    reverseUntil: 0,
    stuckT: 0,
    wobble: 0,
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angleTo = (c: GpCar, x: number, z: number) => {
  const want = Math.atan2(x - c.x, -(z - c.z));
  return Math.atan2(Math.sin(want - c.h), Math.cos(want - c.h));
};

/**
 * Um bot do Fox GP: mira um ponto à frente na pista, calcula a velocidade que cada curva à frente aguenta (com o pneu de
 * agora) e freia a tempo; usa o turbo nas retas, desvia de quem está mais lento na frente e decide se para no box.
 */
export function gpBotInput(world: GpWorld, c: GpCar, mem: GpBotMemory, rng: () => number): GpInput {
  const tr = world.track;
  const t = world.t;
  const v = c.speed;
  const race = world.phase === 'race';

  // ---- preso: ré com o volante virado ----
  if (t < mem.reverseUntil) {
    const p = tr.pointAt(c.s + 6, 0);
    return { throttle: 0, brake: 1, steer: -Math.sign(angleTo(c, p.x, p.z)), turbo: false };
  }
  if (race && t > 1.5 && Math.abs(v) < 1.5 && c.pitHold <= 0 && !c.finished) {
    mem.stuckT += 1 / 60;
    if (mem.stuckT > 1.2) {
      mem.stuckT = 0;
      mem.reverseUntil = t + 0.9;
    }
  } else mem.stuckT = 0;

  // ---- box: decide uma vez, ao entrar na última volta, pelo desgaste ----
  const lapsDone = c.laps.length;
  if (race && !mem.pitDecided && lapsDone === GP_LAPS - 1) {
    mem.pitDecided = true;
    mem.pit = c.wear > 0.45 && rng() < 0.45;
  }
  if (mem.pit && c.pitStops > 0) mem.pit = false;

  // ---- para onde olhar ----
  const ahead = 6 + Math.abs(v) * 0.5;
  const ts = c.s + ahead;
  let lat = mem.lane;
  const rel = tr.rel(ts);
  const pc = tr.pitCenter(rel);
  const goingToPit = mem.pit && pc !== null && tr.rel(c.s) < GP_PIT_BOX + 2;
  if (goingToPit) lat = pc!;
  else {
    // curva à frente: um pouco para dentro
    const k = tr.curv[tr.index(c.s + ahead * 1.5)]!;
    lat = clamp(mem.lane - Math.sign(k) * Math.min(3, Math.abs(k) * 120), -GP_HALF_WIDTH + 1.6, GP_HALF_WIDTH - 1.6);
  }
  const target = tr.pointAt(ts, lat);
  mem.wobble += (rng() - 0.5) * 0.08;
  mem.wobble *= 0.94;
  const steer = clamp(angleTo(c, target.x, target.z) * 2.4 + mem.wobble, -1, 1);

  // ---- quanto correr: a curva mais exigente dentro da distância de frenagem ----
  const grip = GP_SURFACE.asphalt.grip * (1 - c.wear * (1 - GP_GRIP_MIN)) * mem.skill;
  const brakeK = (1 - c.wear * (1 - GP_BRAKE_MIN)) * 0.82;
  let want = GP_VMAX * (c.turbo > 0 ? 1.2 : 1.05);
  const look = (v * v) / (2 * GP_BRAKE * brakeK) + 25;
  for (let dd = 4; dd < look; dd += 4) {
    const k = Math.abs(tr.curv[tr.index(c.s + dd)]!);
    if (k < 1e-4) continue;
    const vc = Math.sqrt((GP_LAT_ACC * grip) / k);
    want = Math.min(want, Math.sqrt(vc * vc + 2 * GP_BRAKE * brakeK * Math.max(0, dd - 3)));
  }
  if (goingToPit || (mem.pit && tr.rel(c.s) > GP_PIT_IN_START - 60 && tr.rel(c.s) < GP_PIT_BOX)) {
    const toPit = Math.max(0, GP_PIT_IN_START - tr.rel(c.s));
    want = Math.min(want, Math.sqrt(GP_PIT_LIMIT ** 2 + 2 * GP_BRAKE * brakeK * toPit));
  }
  // fora da pista: volta para o asfalto sem afundar o pé
  if (c.surface === 'grass' || c.surface === 'gravel') want = Math.min(want, GP_VMAX * 0.5);

  // ---- tráfego: alguém mais lento logo à frente, na mesma faixa ----
  if (race && !goingToPit) {
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    for (const o of world.cars) {
      if (o === c || o.gone || o.ghost) continue;
      const dx = o.x - c.x;
      const dz = o.z - c.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > 14) continue;
      const side = -dx * fz + dz * fx;
      if (Math.abs(side) > 2.6) continue;
      if (o.speed < v - 0.5 && t > mem.laneUntil) {
        mem.lane = clamp(o.d + (o.d > 0 ? -3.6 : 3.6), -GP_HALF_WIDTH + 1.6, GP_HALF_WIDTH - 1.6);
        mem.laneUntil = t + 2.2;
      }
      if (along < 5) want = Math.min(want, o.speed + 1);
    }
    if (t > mem.laneUntil) mem.lane *= 0.98;
  }

  // ---- turbo: na reta ----
  let turbo = false;
  if (c.bar >= 1) {
    let straight = true;
    for (let dd = 0; dd < 70; dd += 7) if (Math.abs(tr.curv[tr.index(c.s + dd)]!) > 1 / 120) straight = false;
    turbo = straight;
  }

  const err = want - v;
  return {
    throttle: err > 0.4 ? 1 : err > -0.5 ? 0.35 : 0,
    brake: err < -1.2 ? clamp(-err / 6, 0.3, 1) : 0,
    steer,
    turbo,
  };
}
