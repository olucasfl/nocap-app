import type { PpBall } from './ball';
import { ppTune } from './tune';
import { ppFixNet, ppGuideHit, ppSmashFix } from './assist';
import {
  PP_AIM,
  PP_ASSIST_LATERAL_POWER,
  PP_ASSIST_MAX_POWER,
  PP_NET_H,
  PP_PAD_R,
  PP_PAD_Z,
  PP_POPUP_VIN,
  ppServeTier,
  ppLadderSpeed,
  PP_SLOW_IN,
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
  /** É a raquetada do saque (sempre com a ajuda de leitura, e nunca curtinha). */
  serve?: boolean;
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
  const isServe = pad.serve === true;
  // a altura da bola na batida decide a qualidade do saque (bater lá em cima é fraco; no ponto certo é forte)
  const serveTier = isServe ? ppServeTier(b.y) : 1;
  const inWx = b.wx;
  const inWy = b.wy;
  const inWz = b.wz;
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
  // o efeito que a bola trazia não entra na conta: o que sai da raquete só depende do golpe (nada de desvio "aleatório")
  const wxn = 0;
  const wyn = 0;
  const wzn = 0;
  let ux = rx - PP_R * wxn;
  let uy = ry - PP_R * wyn;
  let uz = rz - PP_R * wzn;
  const un = ux * nx + uy * ny + uz * nz;
  ux -= un * nx;
  uy -= un * ny;
  uz -= un * nz;
  const us = Math.hypot(ux, uy, uz);
  let wx = 0;
  let wy = 0;
  let wz = 0;
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
  let quality: PpHitQuality = off > 0.85 ? 'edge' : off < 0.15 ? 'sweet' : 'normal';
  // no saque a qualidade é a do momento da batida (altura da bola), não a do ponto da raquete
  if (isServe) quality = serveTier === 2 ? 'sweet' : serveTier === 1 ? 'normal' : 'edge';

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
  } else if (!isServe && quality === 'edge' && vin >= PP_POPUP_VIN) {
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
    spinFwd = back ? 22 : 0;
  } else if (
    (nearNet && fwdPow < 4.6 && !high) ||
    (fwdPow < 1.7 && !high && !isServe && reach > 1.2)
  ) {
    // toque curto perto da rede: a bola mal passa e cai logo depois (com corte)
    stroke = 'curta';
    drop = true;
    spinFwd = -46;
  } else if (lat > 5.5 && fwdPow > 3) {
    // mão varrendo para o lado: efeito de lado, a bola faz curva
    stroke = 'curva';
    spinSide = Math.sign(pad.vx) * Math.min(30, 5 * lat) * (side === 0 ? 1 : -1);
    spinFwd = 18;
  } else if (fwdPow < 3.4 && !high) {
    // empurrada devagar: corte (backspin), a bola vai baixa e morre na mesa
    stroke = 'corte';
    spinFwd = -(34 + 22 * (1 - fwdPow / 3.4));
    if (low) vy *= 0.6;
  } else if (fwdPow < 8.2) {
    stroke = 'topspin';
    spinFwd = 30 + 8 * (fwdPow - 3.4);
  } else {
    stroke = 'drive';
    // bater forte = topspin pesado: a bola desce rápido depois de passar a rede
    spinFwd = Math.min(62, 40 + 6 * (fwdPow - 8.2));
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
  // o efeito que a bola traz conta: bola com topspin que chega na raquete sai com menos efeito (ou com corte) e pula mais;
  // bola com corte afunda; efeito de lado desvia um pouco (bloquear bola com efeito exige mão)
  {
    const hs = Math.hypot(vx, vz);
    if (hs > 0.2) {
      const ux = vx / hs;
      const uz = vz / hs;
      const topRel = inWx * uz - inWz * ux; // < 0: veio com topspin (em relação à saída)
      spinFwd += 0.35 * topRel;
      spinSide += -0.3 * inWy;
      if (tier === 0) {
        vy += Math.max(-1.2, Math.min(1.2, -0.02 * topRel));
        vx += Math.max(-0.8, Math.min(0.8, 0.014 * inWy));
      }
    }
  }
  // lenta, média e rápida bem separadas: a rapidez da mão decide a velocidade da bola (bloqueio, lob, subida, saque e smash
  // têm a sua)
  if (
    tier === 0 &&
    !isServe &&
    !drop &&
    stroke !== 'bloqueio' &&
    stroke !== 'lob' &&
    stroke !== 'subida' &&
    stroke !== 'curta'
  ) {
    const sp0 = Math.hypot(vx, vy, vz);
    const want = ppLadderSpeed(hand);
    if (sp0 > 0.5) {
      const k = want / sp0;
      vx *= k;
      vy *= k;
      vz *= k;
    }
  }
  const cap =
    (drop ? 0.3 * vin + 2.4 : 0.6 * vin + 4) +
    13 * power * (drop ? 0.3 : 1) +
    // mão muito rápida (acima de 9 m/s) ainda soma: só o dedo que realmente corre chega à bola mais rápida
    (drop ? 0 : 0.7 * Math.max(0, hand - 9)) +
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
  // o efeito vem só do golpe (corte, topspin, curva): o atrito da borracha não gira a bola para o lado por conta própria
  wx = 0;
  wy = 0;
  wz = 0;
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
  if (isServe && tier === 0) {
    // saque: bola alta sai mansa; no ponto certo sai com mais força (e a ajuda ainda a põe na mesa)
    const hs = Math.hypot(b.vx, b.vz);
    const want = serveTier === 2 ? 8.2 : serveTier === 1 ? 6 : 4.2;
    if (hs > 0.5) {
      const k = serveTier === 0 ? Math.min(1, want / hs) : Math.max(1, want / hs);
      b.vx *= k;
      b.vz *= k;
    } else {
      b.vz = (side === 0 ? -1 : 1) * want;
    }
    if (serveTier === 2) {
      b.wx *= 1.5;
      b.wz *= 1.5;
    }
  }
  // A ajuda é para o que sai torto sem querer: batida de força (mão rápida) não é corrigida e pode sair da mesa ou ir
  // na rede; batida média só ganha ajuda na altura; a mansa também no ângulo.
  if (tier > 0) {
    // o smash cronometrado sempre cai na mesa (quem acertou a barra merece o ponto), só que muito rápido
    ppGuideHit(b, side, false, false, { vyLo: -16, hMax: 24 });
    // o verde do meio nunca erra: se a ajuda normal não achou jogada, procura uma mais larga (cai dentro e forte)
    if (tier >= 3) ppSmashFix(b, side, 10);
  } else if (stroke === 'subida') {
    ppGuideHit(b, side, false, true);
  } else if (guide && (power < PP_ASSIST_MAX_POWER || isServe)) {
    ppGuideHit(b, side, drop, power < PP_ASSIST_LATERAL_POWER || isServe);
  } else if (guide && Math.hypot(inVx, inVz) < PP_SLOW_IN) {
    // bola que chega devagar: dá para bater forte e com efeito (topspin, de lado) e ela desce na mesa rápida
    ppGuideHit(b, side, false, true, { vyLo: -5, hMax: 20 });
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
