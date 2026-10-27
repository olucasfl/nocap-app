import { BOL_BALL_R, BOL_FOX_R, BOL_RUN_SPEED, BOL_SPEED, BOL_STICK_MIN } from './constants';
import type { BolEdge, BolGoal } from './field';
import type { BolBall, BolInput, BolPlayer, BolWorld } from './world';

/** Papel do bot no time agora: quem vai na bola, quem apoia e quem guarda o gol. */
type Role = 'chase' | 'support' | 'keeper';

/** O que cada bot lembra entre um passo e outro. */
export interface BolBotMemory {
  /** Hora (relógio do mundo) da próxima decisão: o bot reage em ~0,15 a 0,3 s, não a cada quadro. */
  next: number;
  /** Direção que está de fato sendo seguida (suavizada: ninguém vira de repente). */
  mx: number;
  mz: number;
  /** Direção pedida na última decisão. */
  wx: number;
  wz: number;
  /** Depois de pular perto da bola, tenta o mortal no ar. */
  wantFlip: boolean;
  /** Time cujo gol este bot ataca (muda sozinho para o líder em partidas de 3 ou 4 times). */
  target: number;
  /** 0 a 1: chance de errar a hora de pular (bot "nada apelão"). */
  miss: number;
  role: Role;
  /** Lado do gol em que mira (-1/1): troca de vez em quando para não chutar sempre no mesmo canto. */
  side: number;
  /** Atraso de reação ao recomeço (s do relógio): bots não largam todos no mesmo instante. */
  wakeAt: number;
  /** Aperto de pulo agendado para daqui a pouco (hora do relógio); 0 = nenhum. */
  jumpAt: number;
  /** Está segurando correr (com histerese: começa com fôlego de sobra e só para quando ele está no fim ou chegou). */
  run: boolean;
  /** Subida na parede para pegar uma bola alta: onde e a que altura ela vai passar, e até quando o plano vale. */
  plan: { x: number; z: number; y: number; until: number } | null;
  /** Hora a partir da qual pode planejar outra subida (não vive pendurado na parede). */
  planCool: number;
}

export const newBolBotMemory = (target = 0, miss = 0.2): BolBotMemory => ({
  next: 0,
  mx: 0,
  mz: 0,
  wx: 0,
  wz: 0,
  wantFlip: false,
  target,
  miss,
  role: 'chase',
  side: 1,
  wakeAt: 0,
  jumpAt: 0,
  run: false,
  plan: null,
  planCool: 0,
});

const STOP: BolInput = { mx: 0, mz: 0, jump: false };
/** Relógio próprio dos bots: o do mundo para durante a contagem. */
const botClock = (w: BolWorld): number => w.clock;
const REACH = BOL_BALL_R + BOL_FOX_R;

/** A trajetória prevista da bola (andada pela física do mundo), guardada por instante para todos os bots do mundo. */
interface Path {
  at: number;
  /** A cada PATH_DT segundos, por PATH_N pontos. */
  pts: BolBall[];
}
const PATH_DT = 0.05;
const PATH_N = 32;
const paths = new WeakMap<BolWorld, Path>();

function ballPath(world: BolWorld): BolBall[] {
  const hit = paths.get(world);
  if (hit && hit.at === world.clock) return hit.pts;
  const g: BolBall = { ...world.ball };
  const pts: BolBall[] = [{ ...g }];
  for (let i = 0; i < PATH_N; i++) {
    // dois sub-passos de 1/40 s por ponto: bola sem raposas, só a física (chão, paredes, gol)
    world.ghostBall(g, null, PATH_DT / 2);
    world.ghostBall(g, null, PATH_DT / 2);
    pts.push({ ...g });
  }
  paths.set(world, { at: world.clock, pts });
  return pts;
}

/** Em quanto tempo (s) a raposa chega perto da bola, e onde a bola estará: o primeiro ponto da trajetória ao alcance. */
function intercept(p: BolPlayer, pts: BolBall[]): { t: number; at: BolBall } {
  // com fôlego, conta que chega correndo (o papel de cada um sai disto)
  const speed = (p.stam > 30 && !p.tired ? BOL_RUN_SPEED * 0.85 : BOL_SPEED) * 0.92;
  for (let i = 0; i < pts.length; i++) {
    const b = pts[i] as BolBall;
    // bola muito alta não dá para alcançar andando: espera ela descer
    if (b.y > 3.3) continue;
    const need = Math.max(0, Math.hypot(b.x - p.x, b.z - p.z) - REACH * 0.9) / speed;
    if (need <= i * PATH_DT) return { t: i * PATH_DT, at: b };
  }
  const last = pts[pts.length - 1] as BolBall;
  const need = Math.hypot(last.x - p.x, last.z - p.z) / speed;
  return { t: Math.max(PATH_N * PATH_DT, need), at: last };
}

/** O gol que o bot ataca: o líder (com a perda de ponto, vale mirar nele) entre os abertos; senão o da memória. */
function attackGoal(world: BolWorld, p: BolPlayer, mem: BolBotMemory): BolGoal | undefined {
  const goals = world.field.goals;
  const open = goals.filter((g) => g.team !== p.team && !world.out[g.team]);
  if (open.length === 0) return undefined;
  if (open.length === 1 || world.scores.length <= 2) return open[0];
  // 3 ou 4 times: o líder é o alvo preferido; fora isso, cada bot tem o seu favorito (não vão todos no mesmo)
  let best = open[0] as BolGoal;
  let bestScore = -Infinity;
  for (const g of open) {
    const sc = (world.scores[g.team] ?? 0) + (g.team === mem.target % goals.length ? 0.5 : 0);
    if (sc > bestScore) {
      bestScore = sc;
      best = g;
    }
  }
  return best;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A parede (fora a boca do gol) mais perto de um ponto, e o ponto da parede de frente para ele. */
function nearestWall(
  world: BolWorld,
  x: number,
  z: number,
): { e: BolEdge; d: number; fx: number; fz: number } | null {
  let best: { e: BolEdge; d: number; fx: number; fz: number } | null = null;
  for (const e of world.field.edges) {
    if (e.goal >= 0) continue;
    const d = (x - e.ax) * e.nx + (z - e.az) * e.nz;
    if (d < 0) continue;
    const t = (x - e.mx) * e.tx + (z - e.mz) * e.tz;
    if (Math.abs(t) > e.len / 2) continue;
    if (!best || d < best.d) best = { e, d, fx: e.mx + e.tx * t, fz: e.mz + e.tz * t };
  }
  return best;
}

/** Planeja subir na parede para pegar uma bola que vai passar alta junto dela (alta demais para pular). */
function planWall(world: BolWorld, p: BolPlayer, mem: BolBotMemory, pts: BolBall[], now: number) {
  if (mem.plan || now < mem.planCool || p.stick < BOL_STICK_MIN + 1) return;
  for (let i = 8; i < pts.length; i++) {
    const q = pts[i] as BolBall;
    if (q.y < 3.6 || q.y > 7.2) continue;
    const w = nearestWall(world, q.x, q.z);
    if (!w || w.d > 3.2) continue;
    // só vale ir se dá tempo de chegar e subir: ~10 m/s no chão mais ~6 m/s na parede
    const need = Math.hypot(w.fx - p.x, w.fz - p.z) / (BOL_RUN_SPEED * 0.8) + (q.y - 0.5) / 5.5;
    if (need > i * PATH_DT + 0.4 || need < 0.3) continue;
    mem.plan = { x: w.fx, z: w.fz, y: q.y, until: now + Math.max(1.2, i * PATH_DT + 0.8) };
    mem.planCool = now + 4;
    return;
  }
}

/**
 * Bot colado na parede: sobe até a altura da bola, anda ao longo dela até ficar na frente da bola e pula (da parede o
 * pulo lança para longe dela, e a raposa tenta o mortal na bola). Se o plano venceu, solta e cai.
 */
function wallBot(
  world: BolWorld,
  p: BolPlayer,
  mem: BolBotMemory,
  rng: () => number,
  now: number,
): BolInput {
  const plan = mem.plan;
  if (p.surf !== 1 || !plan || now > plan.until) {
    mem.plan = null;
    return { mx: 0, mz: 0, jump: true };
  }
  const tx = -p.wnz;
  const tz = p.wnx;
  const lat = (plan.x - p.x) * tx + (plan.z - p.z) * tz;
  const up = plan.y - 0.8 - p.y;
  const latIn = clamp(lat / 1.5, -1, 1);
  if (up < 0.35 && Math.abs(lat) < 2.4 && world.ball.y > 2.4) {
    // na altura e de frente para a bola: pula e tenta o mortal
    mem.plan = null;
    mem.wantFlip = rng() > mem.miss * 0.5;
    mem.mx = p.wnx;
    mem.mz = p.wnz;
    return { mx: p.wnx, mz: p.wnz, jump: true };
  }
  const into = up > 0.2 ? 1 : 0;
  return {
    mx: -p.wnx * into + tx * latIn,
    mz: -p.wnz * into + tz * latIn,
    jump: false,
    climb: true,
  };
}

/**
 * Bot do treino e dos times incompletos. Prevê para onde a bola vai (a mesma física do jogo), decide um papel por
 * time (quem vai na bola, quem apoia e quem guarda o gol), chega no ponto de encontro por trás da bola para chutar em
 * direção ao gol e vira a direção aos poucos, como uma pessoa no analógico. Usa as mesmas regras que uma pessoa e erra
 * de vez em quando (pulo no tempo errado, mira, reação).
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
    mem.wx = 0;
    mem.wz = 0;
    mem.wakeAt = 0;
    mem.jumpAt = 0;
    mem.run = false;
    mem.plan = null;
    return STOP;
  }
  const now = botClock(world);
  // largada: cada bot demora um pouco diferente para reagir ao apito
  if (mem.wakeAt === 0) mem.wakeAt = now + 0.12 + rng() * 0.4;
  if (now < mem.wakeAt) return STOP;

  const b = world.ball;
  if (p.surf !== 0) return wallBot(world, p, mem, rng, now);
  if (!p.grounded) {
    // no ar: segue para onde ia e tenta o mortal na bola se estiver perto
    if (mem.wantFlip && !p.airJumped) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < 2.7 && b.y < p.y + 2.4 && b.y > p.y - 1.2) {
        mem.wantFlip = false;
        return {
          mx: (b.x - p.x) / Math.max(d, 1e-6),
          mz: (b.z - p.z) / Math.max(d, 1e-6),
          jump: true,
        };
      }
    }
    return { mx: mem.mx, mz: mem.mz, jump: false, run: mem.run };
  }
  mem.wantFlip = false;
  // pulo agendado (para chegar na bola alta no tempo certo)
  if (mem.jumpAt > 0 && now >= mem.jumpAt) {
    mem.jumpAt = 0;
    mem.wantFlip = rng() > mem.miss;
    return { mx: mem.mx, mz: mem.mz, jump: true, run: mem.run };
  }

  if (now >= mem.next) {
    mem.next = now + 0.14 + rng() * 0.14;
    decide(world, p, mem, rng, now);
  }
  // vira a direção aos poucos: sem trancos de robô (e um pouco mais lento para frear do que para arrancar)
  const k = 0.2;
  mem.mx += (mem.wx - mem.mx) * k;
  mem.mz += (mem.wz - mem.mz) * k;
  return { mx: mem.mx, mz: mem.mz, jump: false, run: mem.run, climb: !!mem.plan };
}

function decide(
  world: BolWorld,
  p: BolPlayer,
  mem: BolBotMemory,
  rng: () => number,
  now: number,
): void {
  const pts = ballPath(world);
  const b = world.ball;
  const mine = world.field.goals[p.team];
  const aim = attackGoal(world, p, mem);
  if (!mine || !aim) {
    mem.wx = 0;
    mem.wz = 0;
    return;
  }
  // papéis: o mais rápido a chegar na bola vai nela; o que está mais longe (com 2 ou mais no time) guarda o gol
  const mates = world.players.filter((o) => o.team === p.team);
  const times = mates
    .map((o) => ({ o, t: intercept(o, pts).t + (o.id < p.id ? 0 : 0.001) }))
    .sort((x, y) => x.t - y.t);
  const rank = times.findIndex((x) => x.o === p);
  const ballNearOwn = Math.hypot(b.x - mine.edge.mx, b.z - mine.edge.mz) < 9;
  mem.role =
    rank === 0
      ? 'chase'
      : mates.length >= 2 && rank === times.length - 1 && !ballNearOwn
        ? 'keeper'
        : 'support';
  // quando a bola está na defesa e há 2+ no time, o segundo mais perto também ajuda de perto (não deixa o gol sozinho)
  let tx: number;
  let tz: number;
  let sprint = 1;
  /** Distância a partir da qual vale correr (cada papel gasta o fôlego de um jeito); 0 = nunca. */
  let runFrom = 0;
  /** Ir na bola a toda: a força do toque depende da velocidade com que a raposa chega. */
  let rush = false;

  if (mem.role === 'chase') {
    planWall(world, p, mem, pts, now);
    const hit = intercept(p, pts);
    const at = hit.at;
    // para onde chutar: um canto do gol atacado (troca de lado de vez em quando)
    if (rng() < 0.12) mem.side = rng() < 0.5 ? -1 : 1;
    const cornerX = aim.edge.mx + aim.edge.tx * aim.halfW * 0.55 * mem.side;
    const cornerZ = aim.edge.mz + aim.edge.tz * aim.halfW * 0.55 * mem.side;
    const ax = cornerX - at.x;
    const az = cornerZ - at.z;
    const al = Math.max(Math.hypot(ax, az), 1e-6);
    const ux = ax / al;
    const uz = az / al;
    // ponto atrás da bola, na linha bola-gol
    const gap = REACH + 0.25;
    const bx = at.x - ux * gap;
    const bz = at.z - uz * gap;
    const toBall = Math.hypot(at.x - p.x, at.z - p.z);
    const toBehind = Math.hypot(bx - p.x, bz - p.z);
    // já está de frente para a jogada (atrás da bola, olhando para o gol)? então vai nela; senão contorna por trás
    const cos = ((at.x - p.x) * ux + (at.z - p.z) * uz) / Math.max(toBall, 1e-6);
    const aligned = cos > 0.55;
    if (aligned || toBehind < 0.9) {
      tx = at.x + ux * 0.2;
      tz = at.z + uz * 0.2;
    } else {
      // contorna sem passar por cima da bola: vai a um ponto de lado, entre a raposa e o ponto de trás
      const sx = p.x - at.x;
      const sz = p.z - at.z;
      const cross = sx * uz - sz * ux;
      const side = cross >= 0 ? 1 : -1;
      const wx = at.x - ux * gap * 0.4 - uz * side * (REACH + 0.9);
      const wz = at.z - uz * gap * 0.4 + ux * side * (REACH + 0.9);
      tx = toBehind > 4 ? wx : bx;
      tz = toBehind > 4 ? wz : bz;
    }
    const dBall = Math.hypot(b.x - p.x, b.z - p.z);
    // bola no alto: agenda o pulo para encostar nela no ponto mais alto
    if (b.y > 1.7 && dBall < 4.2 && rng() > mem.miss * 0.6) {
      const eta = Math.max(0.05, hit.t - 0.28);
      mem.jumpAt = now + eta;
    } else if (
      aligned &&
      dBall < 3.3 &&
      b.y < 1.9 &&
      // chute forte (pulo + mortal) só quando vale: perto do gol, ou para tirar a bola da própria área
      (Math.hypot(b.x - aim.edge.mx, b.z - aim.edge.mz) < 24 ||
        Math.hypot(b.x - mine.edge.mx, b.z - mine.edge.mz) < 12) &&
      rng() > mem.miss
    ) {
      mem.jumpAt = now + 0.02;
    }
    rush = aligned || toBehind < 0.9;
    runFrom = 6.5;
    if (mem.plan) {
      // subir: corre de frente para a parede (a corrida e a pressão contra o muro é que colam) no ponto da bola
      const pl = mem.plan;
      const w = nearestWall(world, pl.x, pl.z);
      if (w) {
        tx = pl.x - w.e.nx * 2.5;
        tz = pl.z - w.e.nz * 2.5;
        rush = true;
        runFrom = 2;
      }
    }
  } else if (mem.role === 'keeper') {
    // goleiro: na frente do gol, acompanhando a bola; se vem chute, corre para o ponto onde ela cruza a linha
    const e = mine.edge;
    let cross: BolBall | null = null;
    for (let i = 1; i < pts.length; i++) {
      const q = pts[i] as BolBall;
      const d = (q.x - e.mx) * e.nx + (q.z - e.mz) * e.nz;
      const lat = (q.x - e.mx) * e.tx + (q.z - e.mz) * e.tz;
      if (d < 0.8 && Math.abs(lat) < mine.halfW + 1) {
        cross = q;
        break;
      }
    }
    if (cross) {
      tx = cross.x + e.nx * 0.5;
      tz = cross.z + e.nz * 0.5;
      const dist = Math.hypot(tx - p.x, tz - p.z);
      if (cross.y > 1.4 && dist < 3.5) mem.jumpAt = now + 0.05;
    } else {
      const lat = clamp(
        (b.x - e.mx) * e.tx + (b.z - e.mz) * e.tz,
        -mine.halfW * 0.8,
        mine.halfW * 0.8,
      );
      const out = clamp(Math.hypot(b.x - e.mx, b.z - e.mz) * 0.18, 2.2, 5);
      tx = e.mx + e.tx * lat * 0.8 + e.nx * out;
      tz = e.mz + e.tz * lat * 0.8 + e.nz * out;
    }
    sprint = 1;
    // tiro vindo: corre para a linha; senão guarda andando
    runFrom = cross ? 3.5 : 0;
  } else {
    // apoio: abre um pouco de lado, à frente da bola, pronto para o rebote ou o passe; longe dos colegas
    const ax = aim.edge.mx - b.x;
    const az = aim.edge.mz - b.z;
    const al = Math.max(Math.hypot(ax, az), 1e-6);
    const ux = ax / al;
    const uz = az / al;
    const lateral = mem.side * (4.5 + (p.id.length % 3));
    const ahead = clamp(al * 0.35, 3, 9);
    tx = b.x + ux * ahead - uz * lateral;
    tz = b.z + uz * ahead + ux * lateral;
    for (const o of mates) {
      if (o === p) continue;
      const d = Math.hypot(tx - o.x, tz - o.z);
      if (d < 3) {
        tx += ((tx - o.x) / Math.max(d, 1e-6)) * (3 - d);
        tz += ((tz - o.z) / Math.max(d, 1e-6)) * (3 - d);
      }
    }
    sprint = 0.9;
    runFrom = 11;
  }
  // um pouco de imprecisão: ninguém acerta o ponto exato
  tx += (rng() - 0.5) * 0.5;
  tz += (rng() - 0.5) * 0.5;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  // corre quando está longe do ponto e sobra fôlego; para ao chegar perto (correndo ela freia e vira devagar) ou no fim dele
  const want = runFrom > 0 && d > (mem.run ? runFrom * 0.55 : runFrom);
  const spare = p.tired ? false : mem.run ? p.stam > 6 : p.stam > (mem.role === 'chase' ? 28 : 60);
  mem.run = want && spare;
  if (d < 0.5) {
    mem.wx = 0;
    mem.wz = 0;
  } else {
    // chegando devagar no ponto (não passa direto); longe, corre
    const mag = rush ? 1 : clamp(d / 2.2, 0.35, 1) * sprint;
    mem.wx = (dx / d) * mag;
    mem.wz = (dz / d) * mag;
  }
}
