import { BOL_BALL_R, BOL_FOX_R } from './constants';
import type { BolInput, BolPlayer, BolWorld } from './world';

/** O que cada bot lembra entre um passo e outro. */
export interface BolBotMemory {
  /** Hora (relógio do mundo) da próxima decisão: o bot reage em ~0,25 s, não a cada quadro. */
  next: number;
  mx: number;
  mz: number;
  /** Depois de pular perto da bola, tenta o mortal no ar. */
  wantFlip: boolean;
  /** Time cujo gol este bot ataca. */
  target: number;
  /** 0 a 1: chance de errar a hora de pular (bot "nada apelão"). */
  miss: number;
}

export const newBolBotMemory = (target = 0, miss = 0.2): BolBotMemory => ({
  next: 0,
  mx: 0,
  mz: 0,
  wantFlip: false,
  target,
  miss,
});

const STOP: BolInput = { mx: 0, mz: 0, jump: false };
/** Relógio próprio dos bots: o do mundo para durante a contagem. */
const botClock = (w: BolWorld): number => w.clock;

/**
 * Bot do treino e dos times incompletos: o mais perto da bola em cada time vai atrás dela por trás e a empurra para o
 * gol que ataca; os outros ficam entre a bola e o gol que defendem. Pula e faz o mortal quando a bola está ao alcance,
 * mas reage devagar e erra de vez em quando. Usa as mesmas regras que uma pessoa.
 */
export function bolBotInput(
  world: BolWorld,
  p: BolPlayer,
  mem: BolBotMemory,
  rng: () => number,
): BolInput {
  if (world.phase === 'goal' && p.team === world.celebrating) {
    // comemora o gol: pula e anda de leve, de vez em quando um mortal
    if (p.grounded && rng() < 0.04)
      return {
        mx: rng() < 0.4 ? Math.cos(rng() * 6.28) : 0,
        mz: rng() < 0.4 ? Math.sin(rng() * 6.28) : 0,
        jump: true,
      };
    if (!p.grounded && !p.airJumped && rng() < 0.05)
      return { mx: Math.cos(rng() * 6.28), mz: Math.sin(rng() * 6.28), jump: true };
    return STOP;
  }
  if (world.phase !== 'play') {
    mem.mx = 0;
    mem.mz = 0;
    return STOP;
  }
  const b = world.ball;
  if (!p.grounded) {
    if (mem.wantFlip && !p.airJumped) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < 2.7 && b.y < p.y + 2.4) {
        mem.wantFlip = false;
        return {
          mx: (b.x - p.x) / Math.max(d, 1e-6),
          mz: (b.z - p.z) / Math.max(d, 1e-6),
          jump: true,
        };
      }
    }
    return { mx: mem.mx, mz: mem.mz, jump: false };
  }
  mem.wantFlip = false;
  const now = botClock(world);
  if (now < mem.next && mem.next - now < 1) return { mx: mem.mx, mz: mem.mz, jump: false };
  mem.next = now + 0.2 + rng() * 0.15;

  let chaser = p;
  let chaseD = Math.hypot(b.x - p.x, b.z - p.z);
  for (const o of world.players) {
    if (o.team !== p.team || o === p) continue;
    const d = Math.hypot(b.x - o.x, b.z - o.z);
    if (d < chaseD - 0.5 || (Math.abs(d - chaseD) <= 0.5 && o.id < chaser.id)) {
      chaser = o;
      chaseD = d;
    }
  }
  const mine = world.field.goals[p.team];
  const goals = world.field.goals;
  let target = mem.target % goals.length;
  if (target === p.team) target = (target + 1) % goals.length;
  const aim = goals[target];
  if (!mine || !aim) return STOP;
  let tx: number;
  let tz: number;
  let jump = false;
  if (chaser === p) {
    const ax = aim.edge.mx - b.x;
    const az = aim.edge.mz - b.z;
    const al = Math.max(Math.hypot(ax, az), 1e-6);
    // ponto atrás da bola, na linha bola-gol
    const bx = b.x - (ax / al) * (BOL_BALL_R + BOL_FOX_R + 0.4);
    const bz = b.z - (az / al) * (BOL_BALL_R + BOL_FOX_R + 0.4);
    const toBehind = Math.hypot(bx - p.x, bz - p.z);
    const toBall = Math.hypot(b.x - p.x, b.z - p.z);
    // já está atrás da bola? então vai nela; senão contorna
    const aligned = ((b.x - p.x) * ax + (b.z - p.z) * az) / (Math.max(toBall, 1e-6) * al) > 0.6;
    if (aligned || toBehind < 0.9) {
      tx = b.x;
      tz = b.z;
    } else {
      tx = bx;
      tz = bz;
    }
    if (toBall < 3.3 && b.y < 1.9 && aligned && rng() > mem.miss) {
      jump = true;
      mem.wantFlip = true;
    }
  } else {
    // defende: fica entre a bola e o próprio gol, mais perto do gol
    tx = mine.edge.mx + (b.x - mine.edge.mx) * 0.4 + mine.edge.nx * 2.5;
    tz = mine.edge.mz + (b.z - mine.edge.mz) * 0.4 + mine.edge.nz * 2.5;
  }
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.6 && !jump) {
    mem.mx = 0;
    mem.mz = 0;
  } else {
    mem.mx = dx / Math.max(d, 1e-6);
    mem.mz = dz / Math.max(d, 1e-6);
  }
  return { mx: mem.mx, mz: mem.mz, jump };
}
