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
import { PP_ASSIST_PITCH, PP_ASSIST_YAW, PP_L, PP_NET_H, PP_R, PP_TOP, PP_W } from './constants';

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

/** Candidatos (variação de inclinação e direção em graus, até o dobro do alcance) do mais perto ao mais longe. */
const candidates: { dp: number; dy: number; cost: number }[] = (() => {
  const list: { dp: number; dy: number; cost: number }[] = [];
  const sp = 1;
  const sy = 1.5;
  for (let p = -2 * PP_ASSIST_PITCH; p <= 2 * PP_ASSIST_PITCH; p += sp) {
    for (let y = -2 * PP_ASSIST_YAW; y <= 2 * PP_ASSIST_YAW; y += sy) {
      const cost = (p / PP_ASSIST_PITCH) ** 2 + (y / PP_ASSIST_YAW) ** 2;
      if (cost <= 4 + 1e-9) list.push({ dp: p, dy: y, cost });
    }
  }
  list.sort((a, b) => a.cost - b.cost);
  return list;
})();

const rad = Math.PI / 180;

/**
 * Ajuda de mira: se a batida física ia dar falta, procura a correção mais próxima de inclinação e direção (mesma
 * velocidade, mesmo efeito) que dê uma bola boa. Só corrige o que está ao alcance de `strength` (0 a 1); erro maior
 * continua sendo falta. Devolve se mudou a bola.
 */
export function ppAssist(b: PpBall, side: number, strength: number): boolean {
  if (strength <= 0) return false;
  if (ppLanding(b, side).ok) return false;
  const forward = side === 0 ? -1 : 1;
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  const fz = b.vz * forward;
  const h = Math.hypot(b.vx, b.vz);
  const yaw0 = Math.atan2(b.vx, fz);
  const pitch0 = Math.atan2(b.vy, h);
  const lim = strength * strength;
  const trial = ppNewBall();
  for (const c of candidates) {
    if (c.cost > lim + 1e-9) break;
    const yaw = yaw0 + c.dy * rad;
    const pitch = pitch0 + c.dp * rad;
    if (Math.abs(yaw) > 80 * rad) continue;
    ppCopyBall(b, trial);
    const hh = speed * Math.cos(pitch);
    trial.vx = hh * Math.sin(yaw);
    trial.vz = forward * hh * Math.cos(yaw);
    trial.vy = speed * Math.sin(pitch);
    if (ppLanding(trial, side).ok) {
      b.vx = trial.vx;
      b.vy = trial.vy;
      b.vz = trial.vz;
      return true;
    }
  }
  return false;
}
