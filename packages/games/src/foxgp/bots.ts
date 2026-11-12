import { createRng } from '../core/rng';
import {
  GP_BRAKE,
  GP_BRAKE_MIN,
  GP_CAR_LEN,
  GP_CAR_SIDE_GAP,
  GP_CAR_WID,
  GP_GRIP_MIN,
  GP_HALF_WIDTH,
  GP_LAPS,
  GP_LAT_ACC,
  GP_PIT_LIMIT,
  GP_REAL_BRAKE0,
  GP_REAL_BRAKE_V2,
  GP_REAL_DOWNFORCE,
  GP_REAL_GRIP0,
  GP_SURFACE,
  gpVmaxOf,
} from './constants';
import type { GpCar, GpInput, GpWorld } from './world';

/** Os jeitos de pilotar (spec 080, Fase 3), distribuídos pelo grid. */
export type GpBotArchetype = 'agressivo' | 'consistente' | 'defensivo' | 'erratico' | 'novato';
export const GP_BOT_ARCHETYPES: readonly GpBotArchetype[] = [
  'agressivo',
  'consistente',
  'defensivo',
  'erratico',
  'novato',
];
export const GP_BOT_ARCHETYPE_NAME: Record<GpBotArchetype, string> = {
  agressivo: 'Agressivo',
  consistente: 'Consistente',
  defensivo: 'Defensivo',
  erratico: 'Rápido e errático',
  novato: 'Novato',
};

/** O perfil de um bot: o que o deixa diferente dos outros. Gerado pela seed da partida (sempre o mesmo). */
export interface GpBotProfile {
  archetype: GpBotArchetype;
  /** Quanto da aderência ele usa nas curvas (0,78 a 0,98): o "talento". */
  skill: number;
  /** Reação na largada (s). */
  react: number;
  /** Deslocamento da linha de corrida (m) e quanto ele abre a curva (0 a 1). */
  lineBias: number;
  lineAmp: number;
  /** Freia antes (abaixo de 1) ou depois (acima de 1) do que o pneu permite. */
  brakeBias: number;
  /** Vontade de passar (0 a 1): quando tenta e quanta diferença de velocidade precisa. */
  aggression: number;
  /** Quanto repete a mesma curva (1 = sempre igual). */
  consistency: number;
  /** Chance de errar a freada numa curva. */
  mistakeRate: number;
  /** Máxima de reta (±2 %). */
  topSpeedFactor: number;
  /** Distância mínima que aceita atrás de outro carro (m). */
  followGap: number;
}

/** O que cada bot lembra entre um passo e outro. */
export interface GpBotMemory {
  profile: GpBotProfile;
  /** Atalho para o talento (testes antigos e o desenho). */
  skill: number;
  /** Faixa de ultrapassagem (m do centro) e até quando fica nela. */
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
  /** Curva de agora: o ruído dela e se vai errar a freada. */
  cornerAt: number;
  cornerNoise: number;
  mistake: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Faixas de cada arquétipo: [mínimo, máximo] de cada número. */
const RANGES: Record<GpBotArchetype, Record<Exclude<keyof GpBotProfile, 'archetype'>, [number, number]>> = {
  agressivo: {
    skill: [0.92, 0.96],
    react: [0.15, 0.3],
    lineBias: [-0.6, 0.6],
    lineAmp: [0.85, 1],
    brakeBias: [1.03, 1.08],
    aggression: [0.8, 1],
    consistency: [0.75, 0.85],
    mistakeRate: [0.03, 0.05],
    topSpeedFactor: [1, 1.02],
    followGap: [1.5, 2.5],
  },
  consistente: {
    skill: [0.91, 0.94],
    react: [0.2, 0.32],
    lineBias: [-0.3, 0.3],
    lineAmp: [0.9, 1],
    brakeBias: [0.98, 1.01],
    aggression: [0.4, 0.6],
    consistency: [0.94, 0.99],
    mistakeRate: [0, 0.01],
    topSpeedFactor: [0.995, 1.01],
    followGap: [3.5, 4.5],
  },
  defensivo: {
    skill: [0.89, 0.93],
    react: [0.25, 0.4],
    lineBias: [-0.8, 0.8],
    lineAmp: [0.6, 0.8],
    brakeBias: [0.94, 0.98],
    aggression: [0.15, 0.35],
    consistency: [0.88, 0.94],
    mistakeRate: [0.005, 0.015],
    topSpeedFactor: [0.99, 1],
    followGap: [5, 7],
  },
  erratico: {
    skill: [0.94, 0.98],
    react: [0.1, 0.5],
    lineBias: [-1, 1],
    lineAmp: [0.7, 1],
    brakeBias: [1.04, 1.1],
    aggression: [0.65, 0.9],
    consistency: [0.55, 0.7],
    mistakeRate: [0.07, 0.1],
    topSpeedFactor: [1.005, 1.02],
    followGap: [2, 3.5],
  },
  novato: {
    skill: [0.82, 0.88],
    react: [0.35, 0.6],
    lineBias: [-1.2, 1.2],
    lineAmp: [0.4, 0.7],
    brakeBias: [0.88, 0.94],
    aggression: [0.15, 0.45],
    consistency: [0.65, 0.78],
    mistakeRate: [0.04, 0.07],
    topSpeedFactor: [0.98, 0.995],
    followGap: [5, 8],
  },
};

/** O perfil do bot da vaga `index`, pela seed da partida: arquétipos alternados pelo grid, números sorteados na faixa. */
export function gpBotProfile(seed: string, index: number): GpBotProfile {
  const rng = createRng(`${seed}:bot:${index}`);
  // a ordem dos arquétipos muda com a seed, e cada 5 vagas seguidas tem um de cada
  const shift = Math.floor(createRng(`${seed}:bots-order`)() * GP_BOT_ARCHETYPES.length);
  const archetype = GP_BOT_ARCHETYPES[(index + shift) % GP_BOT_ARCHETYPES.length]!;
  const R = RANGES[archetype];
  const pick = (k: keyof typeof R) => lerp(R[k][0], R[k][1], rng());
  return {
    archetype,
    skill: clamp(pick('skill'), 0.78, 0.98),
    react: pick('react'),
    lineBias: pick('lineBias'),
    lineAmp: pick('lineAmp'),
    brakeBias: pick('brakeBias'),
    aggression: pick('aggression'),
    consistency: pick('consistency'),
    mistakeRate: pick('mistakeRate'),
    topSpeedFactor: pick('topSpeedFactor'),
    followGap: pick('followGap'),
  };
}

/** Memória nova. Com um número, é um bot "consistente" com esse talento (o jeito antigo, usado nos testes). */
export function newGpBotMemory(p: number | GpBotProfile): GpBotMemory {
  const profile: GpBotProfile =
    typeof p === 'number'
      ? {
          archetype: 'consistente',
          skill: clamp(p, 0.78, 0.98),
          react: 0.25,
          lineBias: 0,
          lineAmp: 1,
          brakeBias: 1,
          aggression: 0.5,
          consistency: 1,
          mistakeRate: 0,
          topSpeedFactor: 1,
          followGap: 4,
        }
      : p;
  return {
    profile,
    skill: profile.skill,
    lane: 0,
    laneUntil: 0,
    pit: false,
    pitDecided: false,
    reverseUntil: 0,
    stuckT: 0,
    wobble: 0,
    cornerAt: -1e9,
    cornerNoise: 0,
    mistake: false,
  };
}

const angleTo = (c: GpCar, x: number, z: number) => {
  const want = Math.atan2(x - c.x, -(z - c.z));
  return Math.atan2(Math.sin(want - c.h), Math.cos(want - c.h));
};

/** Velocidade que a curva de curvatura `k` aguenta com a aderência `g` (pneu × superfície × talento), em cada modo. */
function cornerSpeed(world: GpWorld, k: number, g: number): number {
  if (world.mode === 'real') {
    const df = GP_REAL_DOWNFORCE * g;
    return k <= df ? gpVmaxOf('real') * 1.2 : Math.sqrt((GP_REAL_GRIP0 * g) / (k - df));
  }
  return Math.sqrt((GP_LAT_ACC * g) / k);
}

/**
 * Um bot do Fox GP (base da IA do repositório de referência, `updateAI`, adaptada a carros com física de verdade): mira um
 * ponto à frente na linha de corrida, calcula a velocidade que cada curva à frente aguenta no modo da partida (com o pneu
 * de agora) e freia a tempo; passa por uma faixa livre, reduz ao chegar no carro da frente, usa DRS e vácuo como todo
 * mundo, decide se para no box e dá ré quando fica preso. O perfil (`GpBotProfile`) muda o jeito de cada um.
 */
export function gpBotInput(world: GpWorld, c: GpCar, mem: GpBotMemory, rng: () => number): GpInput {
  const tr = world.track;
  const t = world.t;
  const v = c.speed;
  const race = world.phase === 'race';
  const P = mem.profile;

  // ---- reação na largada ----
  if (race && t < P.react && c.prog < 0) return { throttle: 0, brake: 0, steer: 0 };

  // ---- preso: ré com o volante virado ----
  if (t < mem.reverseUntil) {
    const p = tr.pointAt(c.s + 6, 0);
    return { throttle: 0, brake: 1, steer: -Math.sign(angleTo(c, p.x, p.z)) };
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

  // ---- curva nova à frente: sorteia o ruído dela (consistência) e se vai errar a freada ----
  const kAhead = Math.abs(tr.curv[tr.index(c.s + 25 + Math.abs(v))]!);
  if (kAhead > 1 / 120 && c.prog - mem.cornerAt > 80) {
    mem.cornerAt = c.prog;
    mem.cornerNoise = (rng() - 0.5) * 2 * (1 - P.consistency) * 0.12;
    mem.mistake = rng() < P.mistakeRate;
  }

  // ---- para onde olhar: a linha de corrida (por dentro da curva) mais o jeito dele ----
  const ahead = 6 + Math.abs(v) * 0.5;
  const ts = c.s + ahead;
  const rel = tr.rel(ts);
  const pc = tr.pitCenter(rel);
  const goingToPit = mem.pit && pc !== null && tr.rel(c.s) < tr.pit.box + 2;
  const leavingPit = c.surface === 'pit' && !mem.pit;
  // o carro inteiro no asfalto: o centro fica a meia largura (e um pouco) da borda
  const edge = GP_HALF_WIDTH - GP_CAR_WID / 2 - 0.3;
  let lat: number;
  if (goingToPit) lat = pc!;
  else if (leavingPit && pc !== null) lat = pc;
  else if (t < mem.laneUntil) lat = mem.lane;
  else {
    const k = tr.curv[tr.index(c.s + ahead * 1.5)]!;
    lat = clamp(P.lineBias - Math.sign(k) * Math.min(3, Math.abs(k) * 120) * P.lineAmp, -edge, edge);
  }
  const target = tr.pointAt(ts, lat);
  mem.wobble += (rng() - 0.5) * 0.08 * (1.6 - P.consistency);
  mem.wobble *= 0.94;
  const steer = clamp(angleTo(c, target.x, target.z) * 2.4 + mem.wobble, -1, 1);

  // ---- quanto correr: a curva mais exigente dentro da distância de frenagem ----
  const tyre = GP_SURFACE.asphalt.grip * (1 - c.wear * (1 - GP_GRIP_MIN));
  const g = tyre * P.skill * (1 + mem.cornerNoise);
  const brakeK = 1 - c.wear * (1 - GP_BRAKE_MIN);
  // o freio que ele conta ter (o do Realista sobe um pouco com a velocidade)
  const brakeBase = world.mode === 'real' ? (GP_REAL_BRAKE0 + GP_REAL_BRAKE_V2 * v * v) * 0.92 : GP_BRAKE * 0.82;
  const vmax = gpVmaxOf(world.mode);
  const brake = brakeBase * brakeK * P.brakeBias * (mem.mistake ? 1.3 : 1);
  let want = vmax * 1.05 * P.topSpeedFactor;
  const look = (v * v) / (2 * brake) + 25;
  for (let dd = 4; dd < look; dd += 4) {
    const k = Math.abs(tr.curv[tr.index(c.s + dd)]!);
    if (k < 1e-4) continue;
    const vc = cornerSpeed(world, k, g);
    want = Math.min(want, Math.sqrt(vc * vc + 2 * brake * Math.max(0, dd - 3)));
  }
  if (P.topSpeedFactor < 1) want = Math.min(want, vmax * P.topSpeedFactor);
  if (goingToPit || (mem.pit && tr.rel(c.s) > tr.pit.inStart - 60 && tr.rel(c.s) < tr.pit.box)) {
    const toPit = Math.max(0, tr.pit.inStart - tr.rel(c.s));
    want = Math.min(want, Math.sqrt(GP_PIT_LIMIT ** 2 + 2 * brake * toPit));
  }
  // fora da pista: volta para o asfalto sem afundar o pé
  if (c.surface === 'grass' || c.surface === 'gravel') want = Math.min(want, vmax * 0.5);

  // ---- tráfego: ultrapassa por uma faixa livre ou segue a distância dele ----
  if (race && !goingToPit) {
    const fx = Math.sin(c.h);
    const fz = -Math.cos(c.h);
    for (const o of world.cars) {
      if (o === c || o.gone || o.ghost) continue;
      const dx = o.x - c.x;
      const dz = o.z - c.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > 30 + GP_CAR_LEN) continue;
      const side = -dx * fz + dz * fx;
      if (Math.abs(side) > GP_CAR_WID * 0.7) continue;
      // mais rápido que o da frente: tenta passar (o agressivo tenta com menos diferença)
      if (t > mem.laneUntil && v > o.speed + 1.5 - P.aggression * 1.5 && along < 10 + P.aggression * 12) {
        // faixa ao lado do outro carro: uma largura de carro e a folga
        const opts = [o.d + GP_CAR_WID + GP_CAR_SIDE_GAP, o.d - GP_CAR_WID - GP_CAR_SIDE_GAP]
          .filter((x) => Math.abs(x) < edge)
          .sort((a, b) => Math.abs(a - c.d) - Math.abs(b - c.d));
        for (const lane of opts) {
          if (laneFree(world, c, lane)) {
            mem.lane = lane;
            mem.laneUntil = t + 2.2;
            break;
          }
        }
      }
      const gap = GP_CAR_LEN + P.followGap;
      if (along < gap && Math.abs(side) < GP_CAR_WID * 0.6) want = Math.min(want, o.speed - (gap - along) * 0.7);
    }
  }
  want = Math.max(0, want);

  // ---- DRS: abre quando liberado e não vem curva logo ----
  let drs = false;
  if (c.drsAvail) {
    drs = true;
    for (let dd = 0; dd < 60; dd += 6) if (Math.abs(tr.curv[tr.index(c.s + dd)]!) > 1 / 150) drs = false;
  }

  const err = want - v;
  // classificação: fora do box, já na pista, começa a volta lançada
  const lap =
    world.phase === 'quali' &&
    c.qualiStartT === null &&
    c.qualiMs === null &&
    c.qualiHold <= 0 &&
    c.surface !== 'pit' &&
    c.prog > tr.pit.outEnd;
  return {
    throttle: err > 0.4 ? 1 : err > -0.5 ? 0.35 : 0,
    brake: err < -1.2 ? clamp(-err / 6, 0.3, 1) : 0,
    steer,
    drs,
    lap,
  };
}

/** A faixa `lat` está livre perto deste carro (ninguém ali de um carro e meio atrás a dois à frente)? */
function laneFree(world: GpWorld, c: GpCar, lat: number): boolean {
  for (const o of world.cars) {
    if (o === c || o.gone || o.ghost) continue;
    const ds = world.track.delta(c.s, o.s);
    if (ds > -GP_CAR_LEN * 1.5 && ds < GP_CAR_LEN * 2 && Math.abs(o.d - lat) < GP_CAR_WID + 0.4) return false;
  }
  return true;
}
