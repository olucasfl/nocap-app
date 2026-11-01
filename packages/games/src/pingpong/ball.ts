import {
  PP_DRAG,
  PP_DT,
  PP_G,
  PP_L,
  PP_MAGNUS,
  PP_NET_H,
  PP_NET_KEEP,
  PP_NET_OVER,
  PP_R,
  PP_SPIN_MAX,
  PP_TABLE_E,
  PP_TABLE_MU,
  PP_TOP,
  PP_W,
} from './constants';

/** A bola: posição, velocidade e efeito (velocidade angular, rad/s). */
export interface PpBall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  wx: number;
  wy: number;
  wz: number;
}

export const ppNewBall = (): PpBall => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  wx: 0,
  wy: 0,
  wz: 0,
});
export const ppCopyBall = (a: PpBall, b: PpBall): PpBall => {
  b.x = a.x;
  b.y = a.y;
  b.z = a.z;
  b.vx = a.vx;
  b.vy = a.vy;
  b.vz = a.vz;
  b.wx = a.wx;
  b.wy = a.wy;
  b.wz = a.wz;
  return b;
};

/** O que aconteceu num passo (bits). */
export const PP_EV_TABLE = 1;
export const PP_EV_NET = 2;
export const PP_EV_FLOOR = 4;

export interface PpStepOut {
  ev: number;
  /** Lado da mesa onde quicou: 0 = perto da câmera (z > 0), 1 = longe. */
  side: number;
  /** Onde quicou e com que velocidade vertical (m/s). */
  bx: number;
  bz: number;
  impact: number;
}
export const ppNewStepOut = (): PpStepOut => ({ ev: 0, side: 0, bx: 0, bz: 0, impact: 0 });

const ppClampSpin = (b: PpBall) => {
  const s = Math.hypot(b.wx, b.wy, b.wz);
  if (s > PP_SPIN_MAX) {
    const k = PP_SPIN_MAX / s;
    b.wx *= k;
    b.wy *= k;
    b.wz *= k;
  }
};

/**
 * Um subpasso (1/240 s): gravidade, arrasto, Magnus, quique na mesa (com troca de efeito por velocidade), rede e chão.
 * Escreve em `out` o que aconteceu (os bits de `ev` só são ligados, quem chama zera antes).
 */
export function ppStepBall(b: PpBall, out: PpStepOut): void {
  const dt = PP_DT;
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  b.vx += (-PP_DRAG * sp * b.vx + PP_MAGNUS * (b.wy * b.vz - b.wz * b.vy)) * dt;
  b.vy += (-PP_G - PP_DRAG * sp * b.vy + PP_MAGNUS * (b.wz * b.vx - b.wx * b.vz)) * dt;
  b.vz += (-PP_DRAG * sp * b.vz + PP_MAGNUS * (b.wx * b.vy - b.wy * b.vx)) * dt;
  const py = b.y;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;

  // rede: um plano em z = 0 com a espessura da bola
  if (
    Math.abs(b.z) < PP_R &&
    Math.abs(b.x) <= PP_W / 2 + PP_NET_OVER &&
    b.y - PP_R < PP_TOP + PP_NET_H &&
    b.y > PP_TOP - PP_R &&
    ((b.z > 0 && b.vz < 0) || (b.z < 0 && b.vz > 0))
  ) {
    b.z = b.z > 0 ? PP_R : -PP_R;
    b.vz = -b.vz * PP_NET_KEEP;
    b.vx *= 0.6;
    b.vy *= 0.6;
    b.wx *= 0.5;
    b.wy *= 0.5;
    b.wz *= 0.5;
    out.ev |= PP_EV_NET;
  }

  // mesa
  if (
    b.vy < 0 &&
    py - PP_R >= PP_TOP - 1e-9 &&
    b.y - PP_R < PP_TOP &&
    Math.abs(b.x) <= PP_W / 2 + 0.02 &&
    Math.abs(b.z) <= PP_L / 2 + 0.02
  ) {
    b.y = PP_TOP + PP_R;
    const jn = -(1 + PP_TABLE_E) * b.vy;
    // escorregamento do ponto de contato (esfera sólida: o atrito pára no máximo 2/7 do escorregamento)
    const ux = b.vx + PP_R * b.wz;
    const uz = b.vz - PP_R * b.wx;
    const us = Math.hypot(ux, uz);
    out.impact = -b.vy;
    b.vy = -b.vy * PP_TABLE_E;
    if (us > 1e-9) {
      const jt = Math.min((2 / 7) * us, PP_TABLE_MU * jn);
      const dx = -ux / us;
      const dz = -uz / us;
      b.vx += jt * dx;
      b.vz += jt * dz;
      const k = jt / (0.4 * PP_R);
      b.wx += -k * dz;
      b.wz += k * dx;
      ppClampSpin(b);
    }
    out.ev |= PP_EV_TABLE;
    out.side = b.z > 0 ? 0 : 1;
    out.bx = b.x;
    out.bz = b.z;
  }

  // chão (a bola morre aqui; só para não atravessar nada)
  if (b.y - PP_R < 0 && b.vy < 0) {
    b.y = PP_R;
    b.vy = -b.vy * 0.45;
    b.vx *= 0.8;
    b.vz *= 0.8;
    out.ev |= PP_EV_FLOOR;
  }
}

/** Um tick inteiro (4 subpassos); devolve os bits do que aconteceu. */
export function ppStepBallTick(b: PpBall, out: PpStepOut, sub: number): void {
  for (let i = 0; i < sub; i++) ppStepBall(b, out);
}
