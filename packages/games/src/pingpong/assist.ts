import {
  ppCopyBall,
  ppNewBall,
  ppNewStepOut,
  ppStepBall,
  PP_EV_FLOOR,
  PP_EV_NET,
  PP_EV_TABLE,
  type PpBall,
} from './ball';
import { PP_L, PP_NET_H, PP_R, PP_TOP, PP_W } from './constants';

/** Onde uma jogada vai quicar (se for boa). */
export interface PpLanding {
  ok: boolean;
  x: number;
  z: number;
  /** Folga sobre a rede (m); negativa = bateu ou raspou. */
  clear: number;
}

const scratch = ppNewBall();
const out = ppNewStepOut();

/**
 * Simula a bola até o primeiro quique na mesa. `side` é quem bateu (0 = perto da câmera): a bola tem que passar a rede
 * com folga e quicar primeiro na mesa do outro lado, dentro das linhas.
 */
export function ppLanding(b: PpBall, side: number): PpLanding {
  const s = ppCopyBall(b, scratch);
  const hs = side === 0 ? 1 : -1;
  let clear = 9;
  let crossed = false;
  for (let i = 0; i < 960; i++) {
    const z0 = s.z;
    out.ev = 0;
    ppStepBall(s, out);
    if (!crossed && z0 * hs >= 0 && s.z * hs < 0) {
      crossed = true;
      clear = s.y - PP_R - (PP_TOP + PP_NET_H);
    }
    if (out.ev & PP_EV_NET) return { ok: false, x: s.x, z: s.z, clear: -1 };
    if (out.ev & PP_EV_FLOOR) return { ok: false, x: s.x, z: s.z, clear };
    if (out.ev & PP_EV_TABLE) {
      const onFar = out.side === (side === 0 ? 1 : 0);
      const depth = Math.abs(out.bz);
      const ok =
        onFar &&
        crossed &&
        clear >= 0.03 &&
        Math.abs(out.bx) <= PP_W / 2 - 0.06 &&
        depth >= 0.12 &&
        depth <= PP_L / 2 - 0.04;
      return { ok, x: out.bx, z: out.bz, clear };
    }
  }
  return { ok: false, x: s.x, z: s.z, clear };
}
