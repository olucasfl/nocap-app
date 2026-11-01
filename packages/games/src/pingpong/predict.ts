import {
  PP_EV_FLOOR,
  PP_EV_TABLE,
  ppCopyBall,
  ppNewBall,
  ppNewStepOut,
  ppStepBall,
  type PpBall,
} from './ball';
import { PP_PAD_Z } from './constants';

/** Onde (e quando) a bola cruza o plano da raquete de um jogador. */
export interface PpCrossing {
  x: number;
  y: number;
  /** Tempo até cruzar (s). */
  t: number;
  /** A bola nesse instante (posição e velocidade). */
  ball: PpBall;
}

const scratch = ppNewBall();
const out = ppNewStepOut();

/** Prevê onde a bola cruza o plano da raquete de `p` (mesma física do jogo); `null` se ela morre antes. */
export function ppPredictCross(b: PpBall, p: number, reach = 0): PpCrossing | null {
  const s = p === 0 ? 1 : -1;
  const plane = s * (PP_PAD_Z - reach);
  ppCopyBall(b, scratch);
  for (let i = 0; i < 1200; i++) {
    const z0 = scratch.z;
    const x0 = scratch.x;
    const y0 = scratch.y;
    out.ev = 0;
    ppStepBall(scratch, out);
    if (out.ev & PP_EV_FLOOR) return null;
    if ((z0 - plane) * s < 0 && (scratch.z - plane) * s >= 0) {
      const k = (plane - z0) / (scratch.z - z0);
      const c = ppCopyBall(scratch, ppNewBall());
      c.x = x0 + (scratch.x - x0) * k;
      c.y = y0 + (scratch.y - y0) * k;
      c.z = plane;
      return { x: c.x, y: c.y, t: (i + k) / 240, ball: c };
    }
  }
  return null;
}

/** Onde a bola vai quicar na mesa da próxima vez (para o marcador no tampo); `null` se não quica. */
export function ppNextBounce(b: PpBall): { x: number; z: number; t: number } | null {
  ppCopyBall(b, scratch);
  for (let i = 0; i < 960; i++) {
    out.ev = 0;
    ppStepBall(scratch, out);
    if (out.ev & PP_EV_TABLE) return { x: out.bx, z: out.bz, t: (i + 1) / 240 };
    if (out.ev & PP_EV_FLOOR) return null;
  }
  return null;
}
