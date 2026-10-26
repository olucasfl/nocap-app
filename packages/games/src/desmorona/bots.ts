import { DSM_HEX_SIZE } from './constants';
import type { DsmInput, DsmPlayer, DsmTile, DsmWorld } from './world';

/** O que cada bot lembra entre um passo e outro. */
export interface DsmBotMemory {
  layer: number;
  q: number;
  r: number;
  has: boolean;
  /** Hora em que desiste do alvo atual (s do jogo). */
  until: number;
  /** Quanto cada bot espera antes de saltar (s): uns são mais nervosos que outros. */
  patience: number;
  /** 0 a 1: a chance de este bot correr atrás de alguém para empurrar (a colisão da fase 3). */
  aggro: number;
}

export const newBotMemory = (patience = 0, aggro = 0): DsmBotMemory => ({
  layer: 0,
  q: 0,
  r: 0,
  has: false,
  until: 0,
  patience,
  aggro,
});

const STOP: DsmInput = { mx: 0, mz: 0, jump: false };

/**
 * Bot do treino: anda sempre para um ladrilho firme perto (andar é o que quebra o chão, então parar é morrer), foge dos
 * que racham e pula os buracos. Usa a mesma regra do mundo que uma pessoa; o `rng` só dá variedade.
 */
export function botInput(
  world: DsmWorld,
  p: DsmPlayer,
  mem: DsmBotMemory,
  rng: () => number,
): DsmInput {
  if (!p.alive) return STOP;
  if (!p.grounded) {
    // no ar: puxa para o meio da arena (as camadas de baixo são menores)
    const d = Math.hypot(p.x, p.z);
    return d > 1.5 ? { mx: -p.x / d, mz: -p.z / d, jump: false } : STOP;
  }
  const here = world.standingTile(p.layer, p.x, p.z);
  const target = mem.has ? world.tile(mem.layer, mem.q, mem.r) : undefined;
  const reached = target ? Math.hypot(target.x - p.x, target.z - p.z) < DSM_HEX_SIZE * 0.45 : true;
  const bad =
    !target ||
    target.status === 'caiu' ||
    (target.status === 'pisado' && target.breakAt - world.t < 0.9) ||
    target.layer !== p.layer;
  // como uma pessoa esperta: fica no ladrilho até ele estar quase quebrando e só então salta para um firme
  const hereLeft = here ? (here.status === 'pisado' ? here.breakAt - world.t : 99) : 0;
  // bot valente: com o chão firme debaixo dos pés, corre contra a raposa mais perto para empurrar
  if (mem.aggro > 0 && hereLeft > 1.2) {
    let foe: DsmPlayer | undefined;
    let foeD = 4.5;
    for (const o of world.players) {
      if (o === p || !o.alive || Math.abs(o.y - p.y) > 1.1) continue;
      const od = Math.hypot(o.x - p.x, o.z - p.z);
      if (od < foeD) {
        foe = o;
        foeD = od;
      }
    }
    if (foe && foeD > 0.5 && rng() < mem.aggro) {
      mem.has = false;
      return { mx: (foe.x - p.x) / foeD, mz: (foe.z - p.z) / foeD, jump: false };
    }
  }
  const waiting = reached && here !== undefined && hereLeft > 0.75 + mem.patience;
  if (waiting) {
    mem.has = false;
    return STOP;
  }
  if (bad || reached || world.t > mem.until) {
    const next = pickTarget(world, p, here, rng);
    if (next) {
      mem.has = true;
      mem.layer = next.layer;
      mem.q = next.q;
      mem.r = next.r;
      mem.until = world.t + 0.9 + rng() * 0.8;
    } else {
      mem.has = false;
    }
  }
  const goal = mem.has ? world.tile(mem.layer, mem.q, mem.r) : undefined;
  if (!goal) return STOP;
  const dx = goal.x - p.x;
  const dz = goal.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  const mx = dx / d;
  const mz = dz / d;
  // pula quando o chão logo à frente já caiu
  const ahead = world.standingTile(p.layer, p.x + mx * 1.1, p.z + mz * 1.1);
  return { mx, mz, jump: !ahead && d > 1.6 };
}

function pickTarget(
  world: DsmWorld,
  p: DsmPlayer,
  here: DsmTile | undefined,
  rng: () => number,
): DsmTile | undefined {
  let best: DsmTile | undefined;
  let bestScore = -Infinity;
  for (const t of world.tiles.values()) {
    if (t.layer !== p.layer || t.status === 'caiu') continue;
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < DSM_HEX_SIZE * 0.8 || d > DSM_HEX_SIZE * 4.4) continue;
    if (t === here) continue;
    let score = rng() * 1.4 - d * 0.18;
    if (t.status === 'firme') score += 2.2;
    else score -= 3 + Math.max(0, 1.2 - (t.breakAt - world.t)) * 6;
    // ladrilhos cercados de buracos são armadilha
    let holes = 0;
    for (const n of world.tiles.values()) {
      if (
        n.layer === t.layer &&
        n.status === 'caiu' &&
        Math.hypot(n.x - t.x, n.z - t.z) < DSM_HEX_SIZE * 2.1
      )
        holes++;
    }
    score -= holes * 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
