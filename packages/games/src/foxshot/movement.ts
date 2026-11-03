import type { FsBox } from './map';

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
}

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
  m.x + r > b.min[0] && m.x - r < b.max[0] && m.z + r > b.min[2] && m.z - r < b.max[2] && m.y + fsBodyHeight(m) > b.min[1] && m.y < b.max[1];

/** Um passo de movimento (use dt fixo, ex. 1/120): pulo, atrito, aceleração (chão ou ar), gravidade e colisão com as caixas. */
export function fsStepMover(m: FsMover, inp: FsMoveInput, dt: number, boxes: readonly FsBox[]): void {
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
  m.vy -= FS_MOVE.gravity * dt;

  // x
  m.x += m.vx * dt;
  for (const b of boxes) {
    if (!overlaps(m, b)) continue;
    if (b.max[1] - m.y <= FS_MOVE.stepUp && m.onGround) m.y = b.max[1];
    else {
      m.x = m.vx > 0 ? b.min[0] - FS_MOVE.radius : b.max[0] + FS_MOVE.radius;
      m.vx = 0;
    }
  }
  // z
  m.z += m.vz * dt;
  for (const b of boxes) {
    if (!overlaps(m, b)) continue;
    if (b.max[1] - m.y <= FS_MOVE.stepUp && m.onGround) m.y = b.max[1];
    else {
      m.z = m.vz > 0 ? b.min[2] - FS_MOVE.radius : b.max[2] + FS_MOVE.radius;
      m.vz = 0;
    }
  }
  // y
  m.y += m.vy * dt;
  m.onGround = false;
  for (const b of boxes) {
    if (!overlaps(m, b)) continue;
    if (m.vy <= 0) {
      m.y = b.max[1];
      m.onGround = true;
    } else m.y = b.min[1] - fsBodyHeight(m);
    m.vy = 0;
  }
  if (m.y <= 0) {
    m.y = 0;
    if (m.vy < 0) m.vy = 0;
    m.onGround = true;
  }
  // um pé no chão por um degrau de caixa: continua "no chão" se estiver em cima de algo
  if (!m.onGround) {
    for (const b of boxes) {
      if (Math.abs(m.y - b.max[1]) < 1e-3 && m.x + FS_MOVE.radius > b.min[0] && m.x - FS_MOVE.radius < b.max[0] && m.z + FS_MOVE.radius > b.min[2] && m.z - FS_MOVE.radius < b.max[2]) m.onGround = true;
    }
  }
}
