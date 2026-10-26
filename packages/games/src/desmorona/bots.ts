import {
  DSM_ACCEL,
  DSM_AIR_JUMP,
  DSM_COYOTE_SEC,
  DSM_EDGE_GRACE,
  DSM_GRACE_SEC,
  DSM_GRAVITY,
  DSM_JUMP,
  DSM_LAVA_DEPTH,
  DSM_LAYERS,
  DSM_MAX_FALL,
  DSM_PUSH_MIN_SPEED,
  DSM_SPEED,
  DSM_TILE_LIFE,
} from './constants';
import { hexKey, layerY, worldToHex } from './hex';
import type { DsmInput, DsmPlayer, DsmTile, DsmWorld } from './world';

/** Como o bot pula: nunca, assim que está no chão, ou na hora de sair da borda do ladrilho. */
type GroundJump = 0 | 1 | 2;
/** Pulo duplo: nunca, no ponto mais alto, ou já caindo (para se salvar). */
type AirJump = 0 | 1 | 2;

/** Um plano curto: uma direção (ou parar) e quando pular. É refeito várias vezes por segundo. */
interface Plan {
  /** Ângulo da direção; `null` = ficar parado. */
  a: number | null;
  j: GroundJump;
  air: AirJump;
}

/** O que cada bot lembra entre um passo e outro. */
export interface DsmBotMemory {
  /** Alvo antigo (mantido por compatibilidade com quem lê a memória). */
  layer: number;
  q: number;
  r: number;
  has: boolean;
  until: number;
  /** Quanto cada bot espera antes de saltar (s): uns são mais nervosos que outros. */
  patience: number;
  /** 0 a 1: a chance de este bot correr atrás de alguém para empurrar (a colisão da fase 3). */
  aggro: number;
  /** 0 a 1: o quanto o bot acerta (erra menos e pensa mais rápido). */
  skill: number;
  plan: Plan | null;
  /** Hora (s do jogo) em que o plano começou e em que o bot volta a pensar. */
  planAt: number;
  thinkAt: number;
  /** Desvio de pontaria deste plano (rad): ninguém corre em linha perfeita. */
  wobble: number;
  /** Já apertou o pulo do chão neste plano. */
  jumped: boolean;
}

export const newBotMemory = (patience = 0, aggro = 0): DsmBotMemory => ({
  layer: 0,
  q: 0,
  r: 0,
  has: false,
  until: 0,
  patience,
  aggro,
  skill: Math.min(0.96, 0.82 + patience * 0.3),
  plan: null,
  planAt: 0,
  thinkAt: 0,
  wobble: 0,
  jumped: false,
});

const STOP: DsmInput = { mx: 0, mz: 0, jump: false };

/** Corpo simulado em miniatura: só o que a física da raposa usa. */
interface Sim {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  layer: number;
  coyote: number;
  airJumped: boolean;
}

const ANGLES = 16;
/** Passo e tamanho do ensaio: ensaia 1 s à frente em passos de 1/30 s. */
const SIM_DT = 1 / 30;
const SIM_STEPS = 30;
const LAVA_Y = layerY(DSM_LAYERS - 1) - DSM_LAVA_DEPTH;

/**
 * O ladrilho de pé no ensaio: o do mundo, menos os que já teriam quebrado até `t`, mais os que o próprio bot pisaria
 * (`stepped` guarda a hora em que cada um quebra).
 */
function standing(
  world: DsmWorld,
  stepped: Map<DsmTile, number>,
  t: number,
  layer: number,
  x: number,
  z: number,
): DsmTile | undefined {
  const h = worldToHex(x, z);
  const tile = world.tiles.get(hexKey(layer, h.q, h.r));
  if (!tile || tile.status === 'caiu') return undefined;
  const own = stepped.get(tile);
  if (own !== undefined) return t >= own ? undefined : tile;
  if (tile.status === 'pisado' && t >= tile.breakAt) return undefined;
  return tile;
}

function support(
  world: DsmWorld,
  stepped: Map<DsmTile, number>,
  t: number,
  layer: number,
  x: number,
  z: number,
): DsmTile | undefined {
  const center = standing(world, stepped, t, layer, x, z);
  if (center) return center;
  const g = DSM_EDGE_GRACE;
  let best: DsmTile | undefined;
  let bestD = Infinity;
  for (const [dx, dz] of [
    [g, 0],
    [-g, 0],
    [0, g],
    [0, -g],
  ] as const) {
    const tile = standing(world, stepped, t, layer, x + dx, z + dz);
    if (!tile) continue;
    const d = Math.hypot(tile.x - x, tile.z - z);
    if (d < bestD) {
      bestD = d;
      best = tile;
    }
  }
  return best;
}

/** O aperto de pulo que o plano pede agora, dado o corpo (o de verdade ou o do ensaio). */
function wantsJump(
  world: DsmWorld,
  stepped: Map<DsmTile, number>,
  t: number,
  s: Sim,
  plan: Plan,
  state: { jumped: boolean },
): boolean {
  if ((s.grounded || s.coyote > 0) && !state.jumped) {
    if (plan.j === 1) return true;
    if (plan.j === 2 && s.grounded) {
      // pula na borda: o ladrilho logo à frente (um passo) já não existe
      const ahead = support(world, stepped, t, s.layer, s.x + s.vx * 0.13, s.z + s.vz * 0.13);
      if (!ahead) return true;
    }
    return false;
  }
  if (!s.grounded && !s.airJumped) {
    if (plan.air === 1) return s.vy <= 0.4 && (state.jumped || s.vy < 0);
    if (plan.air === 2) return s.vy < -5.5;
  }
  return false;
}

/** Um passo da física da raposa (a mesma de `DsmWorld.movePlayer` e do pouso), sem empurrões. */
function stepSim(
  world: DsmWorld,
  stepped: Map<DsmTile, number>,
  t: number,
  s: Sim,
  mx: number,
  mz: number,
  jump: boolean,
): void {
  const dt = SIM_DT;
  const tx = mx * DSM_SPEED;
  const tz = mz * DSM_SPEED;
  const ax = tx - s.vx;
  const az = tz - s.vz;
  const al = Math.hypot(ax, az);
  const maxD = DSM_ACCEL * dt * (s.grounded ? 1 : 0.45);
  if (al <= maxD) {
    s.vx = tx;
    s.vz = tz;
  } else {
    s.vx += (ax / al) * maxD;
    s.vz += (az / al) * maxD;
  }
  if ((s.grounded || s.coyote > 0) && jump) {
    s.vy = DSM_JUMP;
    s.grounded = false;
    s.coyote = 0;
  } else if (!s.grounded && jump && !s.airJumped) {
    s.airJumped = true;
    s.vy = DSM_AIR_JUMP + Math.max(0, s.vy) * 0.5;
  }
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  const before = s.y;
  if (!s.grounded) {
    s.vy = Math.max(-DSM_MAX_FALL, s.vy - DSM_GRAVITY * dt);
    s.y += s.vy * dt;
  } else if (!support(world, stepped, t, s.layer, s.x, s.z)) {
    s.grounded = false;
    s.vy = 0;
    s.coyote = DSM_COYOTE_SEC;
  }
  if (!s.grounded && s.coyote > 0) s.coyote = Math.max(0, s.coyote - dt);
  if (!s.grounded && s.vy <= 0) {
    for (let layer = 0; layer < DSM_LAYERS; layer++) {
      const sy = layerY(layer);
      if (before >= sy - 1e-6 && s.y <= sy && support(world, stepped, t, layer, s.x, s.z)) {
        s.y = sy;
        s.vy = 0;
        s.grounded = true;
        s.airJumped = false;
        s.coyote = 0;
        s.layer = layer;
        break;
      }
    }
  }
  if (s.grounded && t >= DSM_GRACE_SEC) {
    const tile = support(world, stepped, t, s.layer, s.x, s.z);
    if (tile && tile.status === 'firme' && !stepped.has(tile)) {
      stepped.set(tile, t + (DSM_TILE_LIFE[tile.layer] ?? 1));
    }
  }
}

/** Quanto chão firme tem em volta (mais perto vale mais): é a saída para o próximo passo. */
function roomAround(
  world: DsmWorld,
  stepped: Map<DsmTile, number>,
  t: number,
  s: Sim,
  heading: number | null,
): number {
  const c = worldToHex(s.x, s.z);
  let sum = 0;
  for (let dq = -3; dq <= 3; dq++) {
    for (let dr = Math.max(-3, -dq - 3); dr <= Math.min(3, -dq + 3); dr++) {
      const tile = world.tiles.get(hexKey(s.layer, c.q + dq, c.r + dr));
      if (!tile || tile.status === 'caiu') continue;
      const own = stepped.get(tile);
      if (own !== undefined) continue;
      if (tile.status === 'pisado' && tile.breakAt - t < 0.7) continue;
      const d = Math.hypot(tile.x - s.x, tile.z - s.z);
      if (d < 0.6 || d > 6) continue;
      let w = (1 - d / 6.5) * (tile.status === 'firme' ? 1 : 0.35);
      // chão na frente vale um pouco mais que atrás: dá para seguir correndo
      if (heading !== null) {
        const dot = ((tile.x - s.x) * Math.sin(heading) + (tile.z - s.z) * Math.cos(heading)) / d;
        w *= 0.8 + 0.4 * Math.max(0, dot);
      }
      sum += w;
    }
  }
  return sum;
}

interface Foe {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
}

/** Ensaia um plano por ~1 s e dá uma nota: morrer é o pior, pousar com chão em volta é o melhor. */
function rate(
  world: DsmWorld,
  p: DsmPlayer,
  plan: Plan,
  foes: readonly Foe[],
  aggro: number,
): number {
  const stepped = new Map<DsmTile, number>();
  const s: Sim = {
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    grounded: p.grounded,
    layer: p.layer,
    coyote: p.coyote,
    airJumped: p.airJumped,
  };
  const mx = plan.a === null ? 0 : Math.sin(plan.a);
  const mz = plan.a === null ? 0 : Math.cos(plan.a);
  const state = { jumped: false };
  const startLayer = p.grounded ? p.layer : -1;
  let t = world.t;
  let hit = 0;
  // enquanto ensaia, o bot lembra o tempo no ar sem chão
  for (let i = 0; i < SIM_STEPS + 45; i++) {
    const phase = i < SIM_STEPS;
    // depois do 1º segundo só segue o ensaio se ainda está caindo (até pousar ou morrer)
    if (!phase && s.grounded) break;
    const jump = phase && wantsJump(world, stepped, t, s, plan, state);
    if (jump && (s.grounded || s.coyote > 0)) state.jumped = true;
    stepSim(world, stepped, t, s, phase ? mx : 0, phase ? mz : 0, jump);
    t += SIM_DT;
    if (s.y < LAVA_Y) return -500 + (t - world.t) * 40;
    if (aggro > 0 && hit === 0 && phase) {
      for (const f of foes) {
        const fx = f.x + f.vx * (t - world.t);
        const fz = f.z + f.vz * (t - world.t);
        if (Math.abs(f.y - s.y) < 1.1 && Math.hypot(fx - s.x, fz - s.z) < 0.95) {
          if (Math.hypot(s.vx, s.vz) > DSM_PUSH_MIN_SPEED) hit = 1;
        }
      }
    }
  }
  if (!s.grounded) return -300;
  let score = 20;
  // descer de camada é perder chão grande; só vale se não houver saída
  if (startLayer >= 0) score -= (s.layer - startLayer) * 2.2;
  else score -= s.layer * 0.4;
  score += 1.6 * Math.min(9, roomAround(world, stepped, t, s, plan.a));
  // o ladrilho em que termina já está contando: quanto menos vida, pior (vai ter que sair logo)
  const here = support(world, stepped, t, s.layer, s.x, s.z);
  if (here) {
    const left = (stepped.get(here) ?? (here.status === 'pisado' ? here.breakAt : t + 9)) - t;
    score -= Math.max(0, 0.45 - left) * 14;
  }
  // pular sem precisar custa fôlego e é arriscado: só vale quando ajuda
  if (state.jumped) score -= 1.6;
  if (plan.air > 0 && s.airJumped) score -= 2.2;
  score += hit * 2.5 * aggro;
  return score;
}

/** Todos os planos que o bot considera: 16 direções (ou parar) × quando pular. */
function candidates(grounded: boolean): Plan[] {
  const out: Plan[] = [{ a: null, j: 0, air: 0 }];
  const js: GroundJump[] = grounded ? [0, 1, 2] : [0];
  for (let k = 0; k < ANGLES; k++) {
    const a = (k / ANGLES) * Math.PI * 2;
    for (const j of js) {
      for (const air of [0, 1, 2] as const) out.push({ a, j, air });
    }
  }
  return out;
}

/**
 * Bot do Desmorona!: a cada fração de segundo ensaia ~150 planos curtos (direção, quando pular, pulo duplo) na mesma
 * física da raposa, vê qual deixa mais chão firme à frente e não cai na lava, e segue o melhor. Por isso ele pula
 * buracos, usa o pulo duplo para se salvar, e administra o piso: não gasta o chão por onde precisa voltar. Erra um
 * pouco de propósito (reação, pontaria, às vezes a 2ª melhor escolha) para jogar como gente.
 */
export function botInput(
  world: DsmWorld,
  p: DsmPlayer,
  mem: DsmBotMemory,
  rng: () => number,
): DsmInput {
  if (!p.alive) return STOP;
  if (world.t >= mem.thinkAt || !mem.plan) {
    const foes: Foe[] = [];
    if (mem.aggro > 0) {
      for (const o of world.players) {
        if (o === p || !o.alive || Math.abs(o.y - p.y) > 1.1) continue;
        const d = Math.hypot(o.x - p.x, o.z - p.z);
        if (d < 5) foes.push({ x: o.x, y: o.y, z: o.z, vx: o.vx, vz: o.vz });
      }
    }
    const plans = candidates(p.grounded || p.coyote > 0);
    const scored = plans.map((plan) => {
      let sc = rate(world, p, plan, foes, mem.aggro);
      // não fica trocando de ideia a cada instante: o plano atual leva uma folga
      const cur = mem.plan;
      if (cur && cur.a === plan.a) sc += 0.7;
      return { plan, sc };
    });
    scored.sort((a, b) => b.sc - a.sc);
    // quem acerta menos às vezes escolhe a 2ª ou 3ª melhor (se ela não for desastre)
    let pick = scored[0] as { plan: Plan; sc: number };
    const slip = 1 - mem.skill;
    if (rng() < slip * 1.6) {
      const alt = scored[1 + Math.floor(rng() * 2)];
      if (alt && alt.sc > pick.sc - 4 && alt.sc > -100) pick = alt;
    }
    mem.plan = pick.plan;
    mem.planAt = world.t;
    mem.jumped = false;
    mem.wobble = (rng() - 0.5) * 0.3 * (1 - mem.skill) * 2;
    // reação humana: pensa de novo em ~0,1 a 0,3 s (mais devagar quanto pior o bot)
    mem.thinkAt = world.t + 0.1 + rng() * 0.08 + (1 - mem.skill) * 0.9 * rng();
  }
  const plan = mem.plan as Plan;
  const mx = plan.a === null ? 0 : Math.sin(plan.a + mem.wobble);
  const mz = plan.a === null ? 0 : Math.cos(plan.a + mem.wobble);
  const sim: Sim = {
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    grounded: p.grounded,
    layer: p.layer,
    coyote: p.coyote,
    airJumped: p.airJumped,
  };
  const none = new Map<DsmTile, number>();
  const jump = wantsJump(world, none, world.t, sim, plan, mem);
  if (jump && (p.grounded || p.coyote > 0)) mem.jumped = true;
  return { mx, mz, jump };
}
