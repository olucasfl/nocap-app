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
export function ppLanding(b: PpBall, side: number, drop = false): PpLanding {
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
        depth >= (drop ? 0.25 : 1.1) &&
        depth <= PP_L / 2 - 0.04;
      res = { ok, x: out.bx, z: out.bz, clear };
      if (!ok) return res;
    }
    // depois do quique a bola ainda tem que chegar até onde a raquete alcança, senão ninguém rebate
    if (res && (drop || Math.abs(s.z) >= PP_L / 2 - 0.02)) return res;
  }
  return { ok: false, x: s.x, z: s.z, clear };
}

const guide = ppNewBall();

/**
 * Ajuda de leitura da batida: se a bola, do jeito que a física a mandou, não passaria a rede ou sairia da mesa, troca
 * só o necessário (a altura da saída e, se preciso, um pouco da força) pela jogada boa mais parecida com a que a mão
 * fez. A direção para os lados e o efeito continuam sendo do jogador. Se a jogada já é boa, não mexe em nada.
 */
export function ppGuideHit(
  b: PpBall,
  side: number,
  drop = false,
  lateral = true,
  opts: { vyLo?: number; hMax?: number } = {},
): void {
  if (ppLanding(b, side, drop).ok) return;
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
  const base = drop
    ? Math.min(4.2, Math.max(1.6, hs))
    : Math.min(opts.hMax ?? 10.5, Math.max(3.6, hs));
  const scales = [1, 1.3, 1.8, 0.8, 0.6];
  // primeiro mantém a direção da mão; se não há jogada boa assim (cantinho demais), fecha o ângulo aos poucos
  // direções a tentar: a da mão, depois fechando o ângulo e, por fim, puxando para o centro da mesa (quem bate de um canto
  // precisa jogar para dentro, senão a bola nunca cai na mesa)
  const inward = -Math.sign(b.x || 1);
  const dirs = lateral ? [ux, ux * 0.5, 0, inward * 0.15, inward * 0.3, inward * 0.5] : [ux];
  const vys: number[] = [];
  for (let vy = opts.vyLo ?? -3; vy <= 6.01; vy += 0.6) vys.push(vy);
  vys.sort((u, v) => Math.abs(u - b.vy) - Math.abs(v - b.vy));
  for (const lx of dirs) {
    const lz = Math.sqrt(Math.max(0, 1 - lx * lx)) * Math.sign(uz || fwd);
    for (const sc of scales) {
      const h = Math.min((opts.hMax ?? 10.5) + 1, base * sc);
      // a primeira jogada boa, olhando as alturas da mais parecida com a da mão para a mais diferente (para na primeira)
      let best = Number.NaN;
      for (const vy of vys) {
        ppCopyBall(b, guide);
        guide.vx = lx * h;
        guide.vz = lz * h;
        guide.vy = vy;
        if (ppLanding(guide, side, drop).ok) {
          best = vy;
          break;
        }
      }
      if (!Number.isNaN(best)) {
        b.vx = lx * h;
        b.vz = lz * h;
        b.vy = best;
        return;
      }
    }
  }
}

/**
 * A rede nunca decide a batida sozinha: se a bola, do jeito que saiu, bate na rede ou cai antes dela, só a altura da
 * saída sobe o necessário para passar (com folga). Fora isso (longa demais, aberta demais) a batida é da pessoa.
 * Vale para as batidas fortes, que não passam pela ajuda completa.
 */
export function ppFixNet(b: PpBall, side: number): void {
  const hs = side === 0 ? 1 : -1;
  const clears = (t: PpBall): boolean => {
    const s = ppCopyBall(t, scratch);
    for (let i = 0; i < 960; i++) {
      const z0 = s.z;
      out.ev = 0;
      ppStepBall(s, out);
      if (out.ev & PP_EV_NET) return false;
      // quicou na própria mesa antes de chegar à rede
      if (out.ev & PP_EV_TABLE && z0 * hs > 0 && s.z * hs > 0) return false;
      if (out.ev & PP_EV_FLOOR) return false;
      if (z0 * hs >= 0 && s.z * hs < 0) return s.y - PP_R - (PP_TOP + PP_NET_H) >= 0.07;
    }
    return false;
  };
  if (clears(b)) return;
  ppCopyBall(b, guide);
  for (let k = 0; k < 20; k++) {
    guide.vy += 0.5;
    if (clears(guide)) {
      b.vy = guide.vy;
      return;
    }
  }
}

/**
 * Garantia do smash perfeito (o verde do meio): a bola cai dentro da mesa, e o mais forte possível. Procura, da maior
 * velocidade para baixo, uma saída que pouse na mesa mantendo a direção da mão; se a direção não dá, fecha o ângulo.
 */
export function ppSmashFix(b: PpBall, side: number, minSpeed = 9): void {
  if (ppLanding(b, side, false).ok) return;
  const fwd = side === 0 ? -1 : 1;
  const hs0 = Math.hypot(b.vx, b.vz);
  const ux0 = hs0 > 0.5 ? b.vx / hs0 : 0;
  const inward = -Math.sign(b.x || 1);
  const dirs = [ux0, ux0 * 0.6, ux0 * 0.3, 0, inward * 0.15, inward * 0.3, inward * 0.5];
  const vys: number[] = [];
  for (let vy = -18; vy <= 8; vy += 0.5) vys.push(vy);
  vys.sort((u, v) => Math.abs(u - b.vy) - Math.abs(v - b.vy));
  for (let h = Math.max(minSpeed, Math.min(24, Math.hypot(b.vx, b.vz) + 4)); h >= 2.5; h -= 1) {
    for (const lx of dirs) {
      const lz = Math.sqrt(Math.max(0, 1 - lx * lx)) * fwd;
      for (const vy of vys) {
        ppCopyBall(b, guide);
        guide.vx = lx * h;
        guide.vz = lz * h;
        guide.vy = vy;
        if (ppLanding(guide, side, false).ok) {
          b.vx = lx * h;
          b.vz = lz * h;
          b.vy = vy;
          return;
        }
      }
    }
  }
}
