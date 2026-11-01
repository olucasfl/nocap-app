import type { PpBall } from './ball';
import { ppTune } from './tune';
import { ppFixNet, ppGuideHit } from './assist';
import {
  PP_AIM,
  PP_ASSIST_LATERAL_POWER,
  PP_ASSIST_MAX_POWER,
  PP_NET_H,
  PP_PAD_R,
  PP_PAD_Z,
  PP_POPUP_VIN,
  PP_SMASH_V,
  PP_R,
  PP_SMASH_SPEED,
  PP_SPIN_MAX,
  PP_TOP,
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
  /** Alcance da raquete (0 = plano de espera, positivo = rumo à rede, negativo = recuada). */
  reach?: number;
  /** Nível do smash cronometrado (1 a 3) para esta batida; 0 ou ausente = nenhum. */
  smash?: number;
}

export type PpHitQuality = 'edge' | 'normal' | 'sweet';

/** Os golpes: cada um sai de um jeito de jogar a raquete (força do avanço, lado, onde bate, altura da bola). */
export type PpStroke =
  | 'normal'
  | 'drive'
  | 'topspin'
  | 'corte'
  | 'curva'
  | 'curta'
  | 'bloqueio'
  | 'lob'
  | 'smash'
  | 'subida';
export const PP_STROKES: readonly PpStroke[] = [
  'normal',
  'drive',
  'topspin',
  'corte',
  'curva',
  'curta',
  'bloqueio',
  'lob',
  'smash',
  'subida',
];

export interface PpHitInfo {
  /** Velocidade da bola depois da batida (m/s). */
  speed: number;
  /** Bola rápida e descendo: o "smash" (só para o efeito e o som). */
  smash: boolean;
  quality: PpHitQuality;
  /** Efeito em torno do eixo x depois da batida (rad/s). */
  spin: number;
  stroke: PpStroke;
  /** Nível do smash cronometrado desta batida (0 = nenhum). */
  tier: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Como a face fica pelo movimento da mão: subir abre a face (a bola sobe), descer fecha (a bola desce), e o movimento
 * para o lado vira a face para o lado. Devolve a inclinação para cima (`pitch`) e para o lado (`yaw`), em radianos.
 */
export function ppPaddleTilt(vx: number, vy: number, vz = 0): { pitch: number; yaw: number } {
  const t = ppTune;
  return {
    // subir abre a face; descer fecha; bater forte para a frente fecha um pouco (a bola vai mais reta e rápida)
    pitch: clamp(t.tiltBase + t.tiltVy * clamp(vy, -8, 8) - t.tiltVz * clamp(vz, 0, 8), -0.5, 0.75),
    yaw: clamp(t.tiltVx * clamp(vx, -8, 8), -0.35, 0.35),
  };
}

/**
 * A batida de verdade: a bola e a raquete (um disco com borracha) se encontram, e o resultado vem só da física. A
 * velocidade da raquete (para a frente, para cima ou para baixo, para o lado) soma com a da bola; a face inclinada
 * decide para onde a bola vai (para cima se a mão sobe, para baixo se desce); a borracha tem restituição e atrito, e o
 * atrito com a mão passando pela bola vira efeito (a mesma conta do quique). Nada corrige a batida: descer demais vai na
 * rede, subir demais sai da mesa. Altera `b` no lugar.
 */
export function ppPaddleHit(b: PpBall, side: number, pad: PpPaddleMotion, guide = true): PpHitInfo {
  const forward = side === 0 ? -1 : 1;
  const inVx = b.vx;
  const inVy = b.vy;
  const inVz = b.vz;
  const ox = clamp((b.x - pad.x) / PP_PAD_R, -1.25, 1.25);
  const oy = clamp((b.y - pad.y) / PP_PAD_R, -1.25, 1.25);
  const t = ppTune;
  const tilt = ppPaddleTilt(pad.vx, pad.vy, pad.vz);
  const high = b.y > PP_TOP + 0.55 + PP_NET_H;
  // bola alta: a face fecha e a batida rápida vira smash (desce na mesa)
  if (high) tilt.pitch -= 0.3 * Math.min(1, pad.vz / 6);
  // normal da face: para a rede, inclinada para cima (abertura) e para o lado, com um pouco de curva pelo contato
  let nx = Math.sin(tilt.yaw) + t.tiltOff * ox;
  let ny = Math.sin(tilt.pitch) + t.tiltOff * 0.5 * oy;
  let nz = forward * Math.cos(tilt.pitch) * Math.cos(tilt.yaw);
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl;
  ny /= nl;
  nz /= nl;

  const pvx = pad.vx * t.couple;
  const pvy = pad.vy * t.couple;
  const pvz = forward * pad.vz * t.couple;

  // velocidade relativa à raquete
  let rx = b.vx - pvx;
  let ry = b.vy - pvy;
  let rz = b.vz - pvz;
  const rn = rx * nx + ry * ny + rz * nz;
  // a bola precisa vir de encontro à face (se a face já a persegue mais rápido, não há batida de verdade)
  const vnEff = Math.min(rn, -0.3);
  const jn = -(1 + t.padE) * vnEff;
  const away = -t.padE * vnEff;
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
    const jt = Math.min((2 / 7) * us, t.padMu * jn);
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

  // O golpe tem que fazer sentido: a bola sai com a força da que veio mais a da mão. Bola mansa e mão mansa não
  // viram 80 km/h do nada; bola forte devolvida com a mão parada é um bloqueio (sobe em lob); a mão forte e para baixo
  // sobre bola alta é o smash.
  const vin = Math.hypot(inVx, inVy, inVz);
  const hand = Math.hypot(pad.vx, pad.vy, pad.vz);
  const power = Math.max(0, Math.min(1, hand / 9));
  const smashing = high && pad.vz > 6 && power > 0.55;
  // pontaria: o movimento lateral da mão leva a bola para o lado
  vx += pad.vx * PP_AIM * (0.4 + 0.6 * power);
  const fwdPow = pad.vz;
  const lat = Math.abs(pad.vx);
  const reach = pad.reach ?? 0;
  const nearNet = reach > PP_PAD_Z - 1.5; // bateu perto da rede
  const low = b.y < PP_TOP + PP_NET_H + 0.3;
  let stroke: PpStroke = 'normal';
  let drop = false;
  // efeito extra do golpe (rad/s): topspin (+) e backspin (-) em torno do eixo da trajetória, e efeito de lado
  let spinFwd = 0;
  let spinSide = 0;
  const tier = Math.max(0, Math.min(3, Math.round(pad.smash ?? 0)));
  const blocking = power < 0.35 && vin > 6;
  if (tier > 0) {
    // smash cronometrado (barra na hora certa): desce forte e rápido; o nível dá a velocidade
    stroke = 'smash';
    spinFwd = 38;
  } else if (quality === 'edge' && vin >= PP_POPUP_VIN) {
    // bola forte pega na borda da raquete: sobe mal (a câmera lenta e o smash de quem recebe vêm daí)
    stroke = 'subida';
    spinFwd = 10;
  } else if (smashing) {
    stroke = 'smash';
  } else if (blocking) {
    // defesa de bola forte com a mão mansa: sobe em arco; recuado (atrás do plano) o arco é mais alto (lob)
    const back = reach < -0.25;
    const lift = (1 - power / 0.35) * Math.min(1, vin / 11) * (back ? 1.7 : 1);
    vy += 3.4 * lift;
    vx *= 1 - 0.25 * lift;
    vz *= 1 - 0.25 * lift;
    stroke = back ? 'lob' : 'bloqueio';
    spinFwd = back ? 18 : 0;
  } else if (nearNet && fwdPow < 4.6 && !high) {
    // toque curto perto da rede: a bola mal passa e cai logo depois (com corte)
    stroke = 'curta';
    drop = true;
    spinFwd = -34;
  } else if (lat > 4.2 && fwdPow > 2.6) {
    // mão varrendo para o lado: efeito de lado, a bola faz curva
    stroke = 'curva';
    spinSide = Math.sign(pad.vx) * Math.min(52, 10 * lat) * (side === 0 ? 1 : -1);
    spinFwd = 12;
  } else if (fwdPow < 3.4 && !high) {
    // empurrada devagar: corte (backspin), a bola vai baixa e morre na mesa
    stroke = 'corte';
    spinFwd = -(26 + 18 * (1 - fwdPow / 3.4));
    if (low) vy *= 0.6;
  } else if (fwdPow < 8.2) {
    stroke = 'topspin';
    spinFwd = 24 + 6 * (fwdPow - 3.4);
  } else {
    stroke = 'drive';
    spinFwd = 14;
  }
  if (tier > 0) {
    const S = PP_SMASH_V[tier] ?? 11.5;
    const ux = Math.max(-0.55, Math.min(0.55, pad.vx * 0.08));
    vx = ux * S * 0.8;
    vz = forward * Math.sqrt(1 - ux * ux) * S * 0.8;
    vy = -S * 0.5;
  } else if (stroke === 'subida') {
    vx *= 0.5;
    vz *= 0.5;
    vy = Math.max(vy, 0) + 5.6;
  }
  if (drop) {
    vx *= 0.7;
    vz *= 0.45;
  }
  const cap =
    (drop ? 0.3 * vin + 2.4 : 0.5 * vin + 3.6) +
    10.5 * power * (drop ? 0.3 : 1) +
    (smashing ? 4.5 : 0);
  const sp = Math.hypot(vx, vy, vz);
  const lim = tier > 0 ? 30 : Math.min(PP_V_MAX, cap);
  if (sp > lim) {
    const k = lim / sp;
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
  // o efeito do golpe se soma ao do atrito: topspin gira a bola "para a frente" (ela cai mais rápido), corte ao contrário
  const hh = Math.hypot(vx, vz);
  if (hh > 0.2 && (spinFwd || spinSide)) {
    const ux = vx / hh;
    const uz = vz / hh;
    wx += spinFwd * uz;
    wz += -spinFwd * ux;
    wy += spinSide;
  }
  b.vx = vx;
  b.vy = vy;
  b.vz = vz;
  b.wx = wx;
  b.wy = wy;
  b.wz = wz;
  const ws2 = Math.hypot(b.wx, b.wy, b.wz);
  if (ws2 > PP_SPIN_MAX) {
    const k = PP_SPIN_MAX / ws2;
    b.wx *= k;
    b.wy *= k;
    b.wz *= k;
  }
  // A ajuda é para o que sai torto sem querer: batida de força (mão rápida) não é corrigida e pode sair da mesa ou ir
  // na rede; batida média só ganha ajuda na altura; a mansa também no ângulo.
  if (tier > 0) {
    // o smash cronometrado sempre cai na mesa (quem acertou a barra merece o ponto), só que muito rápido
    ppGuideHit(b, side, false, false, { vyLo: -16, hMax: 24 });
  } else if (stroke === 'subida') {
    ppGuideHit(b, side, false, true);
  } else if (guide && (power < PP_ASSIST_MAX_POWER || vin < 0.5)) {
    ppGuideHit(b, side, drop, power < PP_ASSIST_LATERAL_POWER || vin < 0.5);
  } else if (guide) {
    // batida de força: pode sair longa ou aberta, mas a rede não derruba (só a altura sobe o que precisa)
    ppFixNet(b, side);
  }
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  return {
    speed,
    smash: tier > 0 || (speed >= PP_SMASH_SPEED && vy < -1),
    quality,
    spin: wx,
    stroke,
    tier,
  };
}
