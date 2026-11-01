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
import { PP_L, PP_NET_H, PP_PAD_Z, PP_R, PP_TOP, PP_W } from './constants';

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
  let res: PpLanding | null = null;
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
      if (res) return { ...res, ok: false }; // segundo quique antes de chegar na raquete
      const onFar = out.side === (side === 0 ? 1 : 0);
      const depth = Math.abs(out.bz);
      const ok =
        onFar &&
        crossed &&
        clear >= 0.03 &&
        Math.abs(out.bx) <= PP_W / 2 - 0.06 &&
        depth >= 1.1 &&
        depth <= PP_L / 2 - 0.04;
      res = { ok, x: out.bx, z: out.bz, clear };
      if (!ok) return res;
    }
    // depois do quique a bola ainda tem que chegar até onde a raquete alcança, senão ninguém rebate
    if (res && Math.abs(s.z) >= PP_PAD_Z - 0.55) return res;
  }
  return { ok: false, x: s.x, z: s.z, clear };
}

const guide = ppNewBall();

/**
 * Ajuda de leitura da batida: se a bola, do jeito que a física a mandou, não passaria a rede ou sairia da mesa, troca
 * só o necessário (a altura da saída e, se preciso, um pouco da força) pela jogada boa mais parecida com a que a mão
 * fez. A direção para os lados e o efeito continuam sendo do jogador. Se a jogada já é boa, não mexe em nada.
 */
export function ppGuideHit(b: PpBall, side: number): void {
  if (ppLanding(b, side).ok) return;
  const fwd = side === 0 ? -1 : 1;
  let hs = Math.hypot(b.vx, b.vz);
  let ux = b.vx / hs;
  let uz = b.vz / hs;
  // mão parada (ou a bola voltando): sai reto para a frente
  if (hs < 0.8 || b.vz * fwd <= 0) {
    hs = 0;
    ux = 0;
    uz = fwd;
  }
  const base = Math.min(10.5, Math.max(3.2, hs));
  const scales = [1, 1.15, 0.9, 1.3, 0.8, 0.68, 0.58];
  for (const sc of scales) {
    const h = Math.min(11, base * sc);
    let best = Number.NaN;
    let bestD = 1e9;
    for (let vy = -3; vy <= 6.01; vy += 0.4) {
      ppCopyBall(b, guide);
      guide.vx = ux * h;
      guide.vz = uz * h;
      guide.vy = vy;
      if (!ppLanding(guide, side).ok) continue;
      const d = Math.abs(vy - b.vy);
      if (d < bestD) {
        bestD = d;
        best = vy;
      }
    }
    if (!Number.isNaN(best)) {
      b.vx = ux * h;
      b.vz = uz * h;
      b.vy = best;
      return;
    }
  }
}
