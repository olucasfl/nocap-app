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

export const FS_MOVE = { radius: 0.3, height: 1.3, eye: 1.2, crouchHeight: 0.95, crouchEye: 0.85, run: 5.2, walkMul: 0.5, crouchMul: 0.45, accel: 55, friction: 11, airAccel: 14, jump: 5.0, gravity: 15, stepUp: 0.35 };

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

/** Um passo de movimento (use dt fixo, ex. 1/120): aceleração, atrito, pulo, gravidade e colisão com as caixas. */
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
  // agachar é suave; só levanta se não houver teto em cima
  const wantCrouch = !!inp.crouch;
  if (wantCrouch) m.crouchK = Math.min(1, m.crouchK + dt * 9);
  else if (m.crouchK > 0) {
    const test = { ...m, crouchK: Math.max(0, m.crouchK - dt * 9) };
    if (!boxes.some((b) => overlaps(test, b))) m.crouchK = test.crouchK;
  }
  const slow = m.crouchK > 0.5 ? FS_MOVE.crouchMul : inp.walk ? FS_MOVE.walkMul : 1;
  const maxV = FS_MOVE.run * inp.speedMul * slow;
  if (m.onGround) {
    // atrito
    const sp = Math.hypot(m.vx, m.vz);
    if (sp > 0) {
      const drop = Math.min(sp, Math.max(sp, 1) * FS_MOVE.friction * dt);
      m.vx *= (sp - drop) / sp;
      m.vz *= (sp - drop) / sp;
    }
  }
  const accel = m.onGround ? FS_MOVE.accel : FS_MOVE.airAccel;
  const wantX = wx * maxV, wantZ = wz * maxV;
  const dvx = wantX - m.vx, dvz = wantZ - m.vz;
  const dl = Math.hypot(dvx, dvz);
  if (dl > 0) {
    const a = Math.min(dl, accel * dt);
    m.vx += (dvx / dl) * a;
    m.vz += (dvz / dl) * a;
  }
  if (m.onGround && inp.jump) {
    m.vy = FS_MOVE.jump;
    m.onGround = false;
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
