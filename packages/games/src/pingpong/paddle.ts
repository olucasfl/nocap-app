import type { PpBall } from './ball';
import {
  PP_PAD_COUPLE,
  PP_PAD_E,
  PP_PAD_MU,
  PP_PAD_R,
  PP_R,
  PP_SMASH_SPEED,
  PP_SPIN_MAX,
  PP_TILT_BASE,
  PP_TILT_OFF,
  PP_TILT_VX,
  PP_TILT_VY,
  PP_V_MAX,
} from './constants';

/**
 * A raquete na hora da batida: onde está e com que velocidade se mexe. `vz` é a velocidade PARA A FRENTE (em direção à
 * rede), sempre positiva quando a mão avança.
 */
export interface PpPaddleMotion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vz: number;
}

export type PpHitQuality = 'edge' | 'normal' | 'sweet';

export interface PpHitInfo {
  /** Velocidade da bola depois da batida (m/s). */
  speed: number;
  /** Bola rápida e descendo: o "smash" (só para o efeito e o som). */
  smash: boolean;
  quality: PpHitQuality;
  /** Efeito em torno do eixo x depois da batida (rad/s). */
  spin: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Como a face fica pelo movimento da mão: subir abre a face (a bola sobe), descer fecha (a bola desce), e o movimento
 * para o lado vira a face para o lado. Devolve a inclinação para cima (`pitch`) e para o lado (`yaw`), em radianos.
 */
export function ppPaddleTilt(vx: number, vy: number): { pitch: number; yaw: number } {
  return {
    pitch: clamp(PP_TILT_BASE + PP_TILT_VY * clamp(vy, -8, 8), -0.5, 0.75),
    yaw: clamp(PP_TILT_VX * clamp(vx, -8, 8), -0.35, 0.35),
  };
}

/**
 * A batida de verdade: a bola e a raquete (um disco com borracha) se encontram, e o resultado vem só da física. A
 * velocidade da raquete (para a frente, para cima ou para baixo, para o lado) soma com a da bola; a face inclinada
 * decide para onde a bola vai (para cima se a mão sobe, para baixo se desce); a borracha tem restituição e atrito, e o
 * atrito com a mão passando pela bola vira efeito (a mesma conta do quique). Nada corrige a batida: descer demais vai na
 * rede, subir demais sai da mesa. Altera `b` no lugar.
 */
export function ppPaddleHit(b: PpBall, side: number, pad: PpPaddleMotion): PpHitInfo {
  const forward = side === 0 ? -1 : 1;
  const ox = clamp((b.x - pad.x) / PP_PAD_R, -1.25, 1.25);
  const oy = clamp((b.y - pad.y) / PP_PAD_R, -1.25, 1.25);
  const tilt = ppPaddleTilt(pad.vx, pad.vy);
  // normal da face: para a rede, inclinada para cima (abertura) e para o lado, com um pouco de curva pelo contato
  let nx = Math.sin(tilt.yaw) + PP_TILT_OFF * ox;
  let ny = Math.sin(tilt.pitch) + PP_TILT_OFF * 0.5 * oy;
  let nz = forward * Math.cos(tilt.pitch) * Math.cos(tilt.yaw);
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl;
  ny /= nl;
  nz /= nl;

  const pvx = pad.vx * PP_PAD_COUPLE;
  const pvy = pad.vy * PP_PAD_COUPLE;
  const pvz = forward * pad.vz * PP_PAD_COUPLE;

  // velocidade relativa à raquete
  let rx = b.vx - pvx;
  let ry = b.vy - pvy;
  let rz = b.vz - pvz;
  const rn = rx * nx + ry * ny + rz * nz;
  // a bola precisa vir de encontro à face (se a face já a persegue mais rápido, não há batida de verdade)
  const vnEff = Math.min(rn, -0.3);
  const jn = -(1 + PP_PAD_E) * vnEff;
  const away = -PP_PAD_E * vnEff;
  rx += (away - rn) * nx;
  ry += (away - rn) * ny;
  rz += (away - rn) * nz;

  // atrito: velocidade do ponto de contato (v - R w x n), parte tangencial
  const wxn = b.wy * nz - b.wz * ny;
  const wyn = b.wz * nx - b.wx * nz;
  const wzn = b.wx * ny - b.wy * nx;
  let ux = rx - PP_R * wxn;
  let uy = ry - PP_R * wyn;
  let uz = rz - PP_R * wzn;
  const un = ux * nx + uy * ny + uz * nz;
  ux -= un * nx;
  uy -= un * ny;
  uz -= un * nz;
  const us = Math.hypot(ux, uy, uz);
  let wx = b.wx;
  let wy = b.wy;
  let wz = b.wz;
  if (us > 1e-9) {
    const jt = Math.min((2 / 7) * us, PP_PAD_MU * jn);
    const dx = -ux / us;
    const dy = -uy / us;
    const dz = -uz / us;
    rx += jt * dx;
    ry += jt * dy;
    rz += jt * dz;
    const k = jt / (0.4 * PP_R);
    wx += -k * (ny * dz - nz * dy);
    wy += -k * (nz * dx - nx * dz);
    wz += -k * (nx * dy - ny * dx);
  }

  let vx = rx + pvx;
  let vy = ry + pvy;
  let vz = rz + pvz;
  const off = Math.hypot(ox, oy);
  const quality: PpHitQuality = off > 0.85 ? 'edge' : off < 0.15 ? 'sweet' : 'normal';
  const sp = Math.hypot(vx, vy, vz);
  if (sp > PP_V_MAX) {
    const k = PP_V_MAX / sp;
    vx *= k;
    vy *= k;
    vz *= k;
  }
  const ws = Math.hypot(wx, wy, wz);
  if (ws > PP_SPIN_MAX) {
    const k = PP_SPIN_MAX / ws;
    wx *= k;
    wy *= k;
    wz *= k;
  }
  b.vx = vx;
  b.vy = vy;
  b.vz = vz;
  b.wx = wx;
  b.wy = wy;
  b.wz = wz;
  const speed = Math.hypot(vx, vy, vz);
  return { speed, smash: speed >= PP_SMASH_SPEED && vy < -1, quality, spin: wx };
}
