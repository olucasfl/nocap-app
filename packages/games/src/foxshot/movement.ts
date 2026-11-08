import { fsBoxesInRect, type FsBox } from './map';

/** Corpo de quem anda: pés em (x, y, z); cápsula aproximada por uma caixa de 0,6 × 1,3 m. */
export interface FsMover {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  /** Agachando: 0 de pé, 1 agachado (muda de forma suave). */
  crouchK: number;
  /** Escada de mão: depois de pular dela, espera este tempo (s) antes de grudar de novo. */
  ladderCool?: number;
}

/** Zona de subir (escada de mão): quem anda para o lado `dir` (o muro) sobe, para o lado oposto desce. */
export interface FsLadder {
  min: [number, number, number];
  max: [number, number, number];
  /** Para onde fica o muro onde a escada está presa (plano xz, unitário). */
  dir: [number, number];
}
/** Velocidade de subida e descida na escada de mão (m/s). */
export const FS_LADDER_SPEED = 2.4;
/** Velocidade de andar de lado pendurado na escada (m/s). */
export const FS_LADDER_SIDE = 2.0;

/**
 * Movimento no desenho do Counter-Strike (motor Source), em metros: atrito no chão (desliza ao soltar), aceleração por
 * "velocidade na direção desejada" (frear apertando o lado oposto é rápido), aceleração no ar com teto de 0,62 m/s na conta
 * (é isso que permite girar a câmera e apertar A/D no ar para ganhar velocidade: strafe e bunny hop) e pulo alto.
 * Valores proporcionais aos do CS (250 u/s de corrida, sv_accelerate 5,5, sv_friction 4 (aqui 6,5: desliza menos), sv_stopspeed 75 u/s, sv_airaccelerate 12,
 * teto aéreo 30 u/s), reduzidos para a raposa (1,3 m).
 */
export const FS_MOVE = {
  radius: 0.3, height: 1.3, eye: 1.2, crouchHeight: 0.95, crouchEye: 0.85,
  run: 5.2, walkMul: 0.52, crouchMul: 0.5,
  accel: 9, friction: 6.5, stopSpeed: 1.9, airAccel: 12, airCap: 0.62,
  jump: 6.0, gravity: 19, stepUp: 0.35, maxSpeed: 15, crouchRate: 14,
};

export interface FsMoveInput {
  /** Para a frente (+1) e para o lado direito (+1). */
  fwd: number;
  strafe: number;
  jump: boolean;
  /** Direção da câmera (graus); yaw positivo gira para a esquerda. */
  yaw: number;
  /** Multiplicador de velocidade (da arma na mão, mirando...). */
  speedMul: number;
  /** Ctrl: agacha. */
  crouch?: boolean;
  /** Shift: anda devagar e sem fazer barulho. */
  walk?: boolean;
}

/** Altura do corpo e dos olhos agora (m). */
export const fsBodyHeight = (m: FsMover) => FS_MOVE.height + (FS_MOVE.crouchHeight - FS_MOVE.height) * m.crouchK;
export const fsEyeHeight = (m: FsMover) => FS_MOVE.eye + (FS_MOVE.crouchEye - FS_MOVE.eye) * m.crouchK;
/** Anda sem fazer barulho (Shift ou agachado)? */
export const fsQuiet = (inp: Pick<FsMoveInput, 'crouch' | 'walk'>) => !!(inp.crouch || inp.walk);

export const fsNewMover = (x: number, z: number): FsMover => ({ x, y: 0, z, vx: 0, vy: 0, vz: 0, onGround: true, crouchK: 0 });

const overlaps = (m: FsMover, b: FsBox, r = FS_MOVE.radius) =>
  m.x + r > b.min[0] + 1e-4 && m.x - r < b.max[0] - 1e-4 && m.z + r > b.min[2] + 1e-4 && m.z - r < b.max[2] - 1e-4 && m.y + fsBodyHeight(m) > b.min[1] + 1e-4 && m.y < b.max[1] - 1e-4;

/** Um passo de movimento (use dt fixo, ex. 1/120): pulo, atrito, aceleração (chão ou ar), gravidade e colisão com as caixas. */
const ladderAt = (m: FsMover, ladders: readonly FsLadder[]) =>
  ladders.find((l) => m.x > l.min[0] && m.x < l.max[0] && m.z > l.min[2] && m.z < l.max[2] && m.y + 0.9 > l.min[1] && m.y < l.max[1]);
/** Raio do corpo enquanto sobe: encosta no muro e passa ao lado dos degraus e vigas que ficam perto da escada. */
const LADDER_RADIUS = 0.12;

export function fsStepMover(m: FsMover, inp: FsMoveInput, dt: number, allBoxes: readonly FsBox[], extra: readonly FsBox[] = [], ladders: readonly FsLadder[] = []): void {
  const zone = ladders.length ? ladderAt(m, ladders) : undefined;
  const cooling = !!(m.ladderCool && m.ladderCool > 0);
  const lad = zone && !cooling && !inp.jump ? zone : undefined;
  if (!lad) {
    // o pulo que solta da escada (e a pausa logo depois) usa o raio fino: com o raio normal o corpo, encostado no muro, ficava enterrado e era jogado para fora do mapa
    if (!zone && !cooling) return stepInner(m, inp, dt, allBoxes, extra, ladders);
    const r1 = FS_MOVE.radius;
    FS_MOVE.radius = LADDER_RADIUS;
    try {
      return stepInner(m, inp, dt, allBoxes, extra, ladders);
    } finally {
      FS_MOVE.radius = r1;
    }
  }
  // grudado na escada: o corpo vai até o muro (ao lado dos degraus) e usa um raio menor
  const rail = lad.dir[0] !== 0 ? (lad.dir[0] < 0 ? lad.min[0] + 0.05 + 0.2 : lad.max[0] - 0.05 - 0.2) : lad.dir[1] < 0 ? lad.min[2] + 0.05 + 0.2 : lad.max[2] - 0.05 - 0.2;
  const axis = lad.dir[0] !== 0 ? 'x' : 'z';
  const diff = rail - m[axis];
  m[axis] += Math.abs(diff) <= 2.5 * dt ? diff : Math.sign(diff) * 2.5 * dt;
  const r0 = FS_MOVE.radius;
  FS_MOVE.radius = LADDER_RADIUS;
  try {
    stepInner(m, inp, dt, allBoxes, extra, ladders);
  } finally {
    FS_MOVE.radius = r0;
  }
}

function stepInner(m: FsMover, inp: FsMoveInput, dt: number, allBoxes: readonly FsBox[], extra: readonly FsBox[], ladders: readonly FsLadder[]): void {
  // mapas grandes: só as caixas perto do corpo (mais as de fora, como os outros jogadores)
  const near = fsBoxesInRect(allBoxes, m.x - 2, m.z - 2, m.x + 2, m.z + 2);
  const boxes: readonly FsBox[] = extra.length ? [...near, ...extra] : near;
  const yaw = (inp.yaw * Math.PI) / 180;
  // frente = (-sin, -cos); direita = (cos, -sin)
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let wx = fx * inp.fwd + rx * inp.strafe;
  let wz = fz * inp.fwd + rz * inp.strafe;
  const len = Math.hypot(wx, wz);
  if (len > 1) {
    wx /= len;
    wz /= len;
  }
  const wl = Math.min(1, len);
  // direção desejada unitária (wx, wz já foram limitados a 1; dividir pelo comprimento ORIGINAL encolhia a diagonal)
  const dl = Math.hypot(wx, wz) || 1;
  const dirX = wx / dl, dirZ = wz / dl;

  // agachar: no chão a cabeça desce; no ar os pés sobem (o corpo encolhe por baixo), como no CS: é o "pulo + Ctrl" que sobe em caixas altas
  const dH = FS_MOVE.height - FS_MOVE.crouchHeight;
  if (inp.crouch) {
    const k = Math.min(1, m.crouchK + dt * FS_MOVE.crouchRate);
    if (!m.onGround) m.y += (k - m.crouchK) * dH;
    m.crouchK = k;
  } else if (m.crouchK > 0) {
    const k = Math.max(0, m.crouchK - dt * FS_MOVE.crouchRate);
    const test = { ...m, crouchK: k, y: m.onGround ? m.y : m.y - (m.crouchK - k) * dH };
    // só levanta se couber (teto no chão; chão ou caixa embaixo no ar)
    if (test.y >= 0 && !boxes.some((b) => overlaps(test, b))) {
      m.crouchK = k;
      m.y = test.y;
    }
  }
  const slow = m.crouchK > 0.5 ? FS_MOVE.crouchMul : inp.walk ? FS_MOVE.walkMul : 1;
  const maxV = FS_MOVE.run * inp.speedMul * slow;
  const wishSpeed = maxV * wl;

  // escada de mão: dentro da zona, andar para o muro sobe, andar para o lado oposto desce, parado ou de lado segura; pular solta
  let ladderVy: number | null = null;
  let ladderVx = 0;
  let ladderVz = 0;
  if (m.ladderCool && m.ladderCool > 0) m.ladderCool = Math.max(0, m.ladderCool - dt);
  else if (ladders.length) {
    const lad = ladderAt(m, ladders);
    if (lad) {
      if (inp.jump) {
        // pula para cima e para o lado do muro: no topo isso sobe na plataforma e sai da escada; embaixo só encosta no muro e cai
        m.ladderCool = 0.4;
        m.vy = 5.2;
        m.vx = lad.dir[0] * 2.2;
        m.vz = lad.dir[1] * 2.2;
        m.onGround = false;
      } else {
        const t = wl > 0.1 ? dirX * lad.dir[0] + dirZ * lad.dir[1] : 0;
        ladderVy = t > 0.35 ? FS_LADDER_SPEED : t < -0.35 ? -FS_LADDER_SPEED : 0;
        // de lado: anda ao longo da escada (sair da zona pela ponta solta o corpo, que cai)
        const side = wl > 0.1 ? dirX * -lad.dir[1] + dirZ * lad.dir[0] : 0;
        ladderVx = -lad.dir[1] * side * FS_LADDER_SIDE * wl;
        ladderVz = lad.dir[0] * side * FS_LADDER_SIDE * wl;
        // no topo da escada para de subir (dá para pular dali)
        if (ladderVy > 0 && m.y >= lad.max[1] - 0.02) ladderVy = 0;
        m.onGround = false;
      }
    }
  }

  // pulo: sai do chão antes do atrito (segurar o pulo no pouso mantém a velocidade: bunny hop)
  if (m.onGround && inp.jump) {
    m.vy = FS_MOVE.jump;
    m.onGround = false;
  }
  if (m.onGround) {
    // atrito: abaixo de stopSpeed a queda é constante (para de vez), acima é proporcional
    const sp = Math.hypot(m.vx, m.vz);
    if (sp > 0) {
      const drop = Math.max(sp, FS_MOVE.stopSpeed) * FS_MOVE.friction * dt;
      const ns = Math.max(0, sp - drop);
      m.vx *= ns / sp;
      m.vz *= ns / sp;
    }
    if (wl > 0) {
      const cur = m.vx * dirX + m.vz * dirZ;
      const add = wishSpeed - cur;
      if (add > 0) {
        const a = Math.min(add, FS_MOVE.accel * dt * wishSpeed);
        m.vx += dirX * a;
        m.vz += dirZ * a;
      }
    }
  } else if (wl > 0) {
    // ar: a conta usa um teto baixo (airCap), então só se ganha velocidade em direções quase perpendiculares ao movimento
    const cur = m.vx * dirX + m.vz * dirZ;
    const add = Math.min(wishSpeed, FS_MOVE.airCap) - cur;
    if (add > 0) {
      const a = Math.min(add, FS_MOVE.airAccel * dt * wishSpeed);
      m.vx += dirX * a;
      m.vz += dirZ * a;
    }
  }
  const hs = Math.hypot(m.vx, m.vz);
  if (hs > FS_MOVE.maxSpeed) {
    m.vx *= FS_MOVE.maxSpeed / hs;
    m.vz *= FS_MOVE.maxSpeed / hs;
  }
  if (ladderVy === null) m.vy -= FS_MOVE.gravity * dt;
  else {
    m.vy = ladderVy;
    m.vx = ladderVx;
    m.vz = ladderVz;
  }

  // integra em passos curtos (<= 8 cm) para nunca atravessar parede ou chão fino, e resolve cada eixo
  // pelo lado de onde o corpo veio (nunca pela velocidade, que pode ser zero: isso jogava o corpo para dentro/através da parede)
  // nasceu ou foi empurrado para dentro de um bloco: sobe até achar espaço (nunca atravessa o chão para baixo)
  const ck0 = m.crouchK;
  m.crouchK = 1; // enterrado mesmo agachado (um teto baixo sobre quem está em pé não conta)
  // encostado fundo de lado (até 4 cm: arredondamento da rede, borda de voxel): sai de lado pelo caminho mais curto; subir levava o corpo para cima do muro
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of near) {
      if (!overlaps(m, b)) continue;
      const r = FS_MOVE.radius;
      const dx0 = m.x + r - b.min[0], dx1 = b.max[0] - (m.x - r), dz0 = m.z + r - b.min[2], dz1 = b.max[2] - (m.z - r);
      const px = Math.min(dx0, dx1), pz = Math.min(dz0, dz1);
      const up = b.max[1] - m.y;
      const pen = Math.min(px, pz);
      if (pen > 0.04 || pen >= up) continue;
      if (px <= pz) m.x += dx0 < dx1 ? -dx0 - 1e-3 : dx1 + 1e-3;
      else m.z += dz0 < dz1 ? -dz0 - 1e-3 : dz1 + 1e-3;
      moved = true;
    }
    if (!moved) break;
  }
  const embedded = near.some((b) => overlaps(m, b));
  m.crouchK = ck0;
  if (embedded) {
    const y0 = m.y;
    // primeiro em passos de 5 mm (até 15 cm): quem só afundou um tiquinho no chão (arredondamento da rede, borda de voxel) sobe o mínimo; subir de 5 em
    // 5 cm jogava o corpo para cima de um teto fino lá em cima (a pele fina da Duna tem tetos de poucos centímetros)
    let free = false;
    for (let up = 0.005; up <= 0.15 && !free; up += 0.005) {
      m.y = y0 + up;
      free = !near.some((b) => overlaps(m, b));
    }
    for (let up = 0.2; up <= 3 && !free; up += 0.05) {
      m.y = y0 + up;
      free = !near.some((b) => overlaps(m, b));
    }
    if (!free) m.y = y0;
    m.vy = Math.max(0, m.vy);
  }
  const wasGround = m.onGround;
  const sub = Math.max(1, Math.ceil((Math.hypot(m.vx, m.vz, m.vy) * dt) / 0.08));
  const h = dt / sub;
  let grounded = false;
  for (let s = 0; s < sub; s++) {
    const px = m.x, py = m.y, pz = m.z;
    const ox = m.x;
    m.x += m.vx * h;
    if (m.x !== ox) {
      for (const b of boxes) {
        if (!overlaps(m, b)) continue;
        if (b.max[1] - m.y <= FS_MOVE.stepUp && (m.onGround || grounded) && m.vy <= 0.01) m.y = b.max[1];
        else {
          m.x = m.x > ox ? b.min[0] - FS_MOVE.radius : b.max[0] + FS_MOVE.radius;
          m.vx = 0;
        }
      }
    }
    const oz = m.z;
    m.z += m.vz * h;
    if (m.z !== oz) {
      for (const b of boxes) {
        if (!overlaps(m, b)) continue;
        if (b.max[1] - m.y <= FS_MOVE.stepUp && (m.onGround || grounded) && m.vy <= 0.01) m.y = b.max[1];
        else {
          m.z = m.z > oz ? b.min[2] - FS_MOVE.radius : b.max[2] + FS_MOVE.radius;
          m.vz = 0;
        }
      }
    }
    const oy = m.y;
    m.y += m.vy * h;
    grounded = false;
    if (m.y !== oy) {
      for (const b of boxes) {
        if (!overlaps(m, b)) continue;
        // quem já estava dentro na altura antiga é obstáculo do lado (tratado em x/z), não chão nem teto
        const ny = m.y;
        m.y = oy;
        const was = overlaps(m, b);
        m.y = ny;
        if (was) continue;
        if (m.y < oy || (m.y === oy && m.vy <= 0)) {
          m.y = b.max[1];
          grounded = true;
        } else m.y = b.min[1] - fsBodyHeight(m);
        m.vy = 0;
      }
    }
    if (m.y <= 0) {
      m.y = 0;
      if (m.vy < 0) m.vy = 0;
      grounded = true;
    }
    if (!grounded && m.vy <= 0) {
      // um pé no chão por um degrau: continua "no chão" se estiver em cima de algo
      for (const b of boxes) {
        if (Math.abs(m.y - b.max[1]) < 1e-3 && m.x + FS_MOVE.radius > b.min[0] && m.x - FS_MOVE.radius < b.max[0] && m.z + FS_MOVE.radius > b.min[2] && m.z - FS_MOVE.radius < b.max[2]) grounded = true;
      }
    }
    // rede de segurança: se ainda sobrou dentro de algum bloco, volta ao ponto anterior (nunca fica preso na parede)
    if (boxes.some((b) => overlaps(m, b)) && !boxes.some((b) => { const x = m.x, y = m.y, z = m.z; m.x = px; m.y = py; m.z = pz; const r = overlaps(m, b); m.x = x; m.y = y; m.z = z; return r; })) {
      m.x = px;
      m.y = py;
      m.z = pz;
      m.vx = m.vz = 0;
      if (m.vy > 0) m.vy = 0;
      grounded = grounded || m.vy <= 0;
    }
    m.onGround = grounded;
  }
  // descendo degrau fino ou rampa de voxels: cola no chão (até 36 cm) em vez de "cair" a cada degrau
  if (wasGround && !m.onGround && m.vy <= 0 && m.vy > -3) {
    let best = -1e9;
    for (const b of boxes) {
      if (b.max[1] > m.y + 1e-4 || m.y - b.max[1] > FS_MOVE.stepUp + 0.01) continue;
      const r = FS_MOVE.radius - 1e-3;
      if (m.x + r > b.min[0] && m.x - r < b.max[0] && m.z + r > b.min[2] && m.z - r < b.max[2] && b.max[1] > best) best = b.max[1];
    }
    if (best > -1e8) {
      m.y = best;
      m.vy = 0;
      m.onGround = true;
    }
  }
}
