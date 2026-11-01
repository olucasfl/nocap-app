import type { PpBall } from './ball';
import {
  PP_PAD_E,
  PP_PAD_MU,
  PP_PAD_R,
  PP_PUSH,
  PP_LIFT,
  PP_PUSH_SMASH,
  PP_PUSH_SERVE,
  PP_TILT_SERVE,
  PP_ASSIST_SERVE,
  PP_R,
  PP_TILT_SMASH,
  PP_TILT_UP,
  PP_TILT_X,
  PP_TILT_Y,
  PP_V_MAX,
  PP_ASSIST,
  PP_ASSIST_SMASH,
  PP_SPIN_MAX,
} from './constants';
import { ppAssist } from './assist';

/** Raquete: onde está e com que velocidade se mexe (plano vertical x, y). */
export interface PpPaddleMotion {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type PpHitQuality = 'edge' | 'normal' | 'sweet';

export interface PpHitInfo {
  /** Velocidade da bola depois da batida (m/s). */
  speed: number;
  smash: boolean;
  quality: PpHitQuality;
  /** A ajuda de mira corrigiu a batida. */
  assisted: boolean;
  /** Efeito em torno do eixo x depois da batida (rad/s): negativo = topspin para quem bate de perto da câmera. */
  spin: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * A batida: a face é um disco levemente curvo (o ponto de contato desvia a bola), a borracha tem restituição e atrito
 * (o movimento da raquete vira efeito, a mesma conta do quique) e o empurrão para a frente soma potência. Depois a
 * ajuda de mira conserta o que era falta por pouco. Altera `b` no lugar.
 */
export function ppPaddleHit(
  b: PpBall,
  side: number,
  pad: PpPaddleMotion,
  smash: boolean,
  assistScale = 1,
  serve = false,
): PpHitInfo {
  const forward = side === 0 ? -1 : 1;
  const ox = clamp((b.x - pad.x) / PP_PAD_R, -1.25, 1.25);
  const oy = clamp((b.y - pad.y) / PP_PAD_R, -1.25, 1.25);
  let nx = PP_TILT_X * ox;
  // quem rebate uma bola que desce abre a face para ela subir (a bola que sobe pede a face mais fechada)
  let ny =
    PP_TILT_UP +
    0.07 * clamp(-b.vy / 3, -1, 1.5) +
    PP_TILT_Y * oy +
    0.03 * clamp(pad.vy, -4, 4) +
    (smash ? PP_TILT_SMASH : 0) +
    (serve ? PP_TILT_SERVE : 0);
  let nz = forward;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl;
  ny /= nl;
  nz /= nl;

  const push = serve ? PP_PUSH_SERVE : smash ? PP_PUSH_SMASH : PP_PUSH;
  const pvx = pad.vx;
  const pvy = pad.vy + (smash ? 0 : PP_LIFT);
  const pvz = forward * push;

  // velocidade relativa à raquete
  let rx = b.vx - pvx;
  let ry = b.vy - pvy;
  let rz = b.vz - pvz;
  const rn = rx * nx + ry * ny + rz * nz;
  // a bola vem na raquete: garante um mínimo de aproximação (bola que "foge" mais rápido que a raquete)
  const vnEff = Math.min(rn, -0.8);
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
    // w += -(k) (n x d)
    wx += -k * (ny * dz - nz * dy);
    wy += -k * (nz * dx - nx * dz);
    wz += -k * (nx * dy - ny * dx);
  }

  // de volta ao referencial da mesa
  let vx = rx + pvx;
  let vy = ry + pvy;
  let vz = rz + pvz;

  // qualidade pelo ponto de contato
  const off = Math.hypot(ox, oy);
  let quality: PpHitQuality = 'normal';
  if (off > 0.85) {
    quality = 'edge';
    vx *= 0.78;
    vy *= 0.78;
    vz *= 0.78;
    wx *= 0.6;
    wy *= 0.6;
    wz *= 0.6;
  } else if (off < 0.15) {
    quality = 'sweet';
    vx *= 1.06;
    vy *= 1.06;
    vz *= 1.06;
  }
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

  const assisted = ppAssist(
    b,
    side,
    (serve ? PP_ASSIST_SERVE : smash ? PP_ASSIST_SMASH : PP_ASSIST) * assistScale,
  );
  return {
    speed: Math.hypot(b.vx, b.vy, b.vz),
    smash,
    quality,
    assisted,
    spin: b.wx,
  };
}
