import {
  BOL_ACCEL,
  BOL_AIR_ACCEL,
  BOL_AIR_JUMP,
  BOL_CEIL_SPEED,
  BOL_CEILING,
  BOL_FLIP_LIFT,
  BOL_FLIP_SEC,
  BOL_FLIP_SPEED,
  BOL_FOX_GRAVITY,
  BOL_FOX_H,
  BOL_FOX_R,
  BOL_GOAL_DEPTH,
  BOL_JUMP,
  BOL_SPEED,
  BOL_STICK_ENTRY_SPEED,
  BOL_STICK_MAX,
  BOL_STICK_MIN,
  BOL_STICK_REGEN,
  BOL_RUN_ACCEL,
  BOL_RUN_SPEED,
  BOL_STAM_DRAIN,
  BOL_STAM_HOLD,
  BOL_STAM_MAX,
  BOL_STAM_MIN,
  BOL_STAM_REGEN,
  BOL_STAM_TIRED_HOLD,
  BOL_SUBSTEPS,
  BOL_WALL_ACCEL,
  BOL_WALL_JUMP,
  BOL_WALL_SPEED,
} from './constants';
import type { BolField } from './field';
import type { BolInput } from './world';

/** O corpo de uma raposa: o que o movimento (sem a bola) precisa saber. */
export interface BolBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  grounded: boolean;
  airJumped: boolean;
  flipT: number;
  flipDx: number;
  flipDz: number;
  flipHit: boolean;
  /** Onde a raposa está: 0 chão/ar, 1 colada na parede, 2 no teto (de cabeça para baixo). */
  surf: number;
  /** Segundos de grude que ainda tem (gasta na parede e no teto, recarrega no chão). */
  stick: number;
  /** Normal da parede em que está colada (aponta para dentro do campo). */
  wnx: number;
  wnz: number;
  /** A direção pedida no último passo (para decidir se gruda na parede). Não vai pela rede. */
  ix: number;
  iz: number;
  /** Fôlego (0 a 100), segundos que ele ainda fica parado antes de recarregar, e se está esgotado (só volta a correr com BOL_STAM_MIN). */
  stam: number;
  stamHold: number;
  tired: boolean;
  /** Correndo neste passo (vai pela rede só como um bit, para os outros verem). */
  running: boolean;
  /** Estava pedindo para correr no passo anterior (acha o aperto novo, para o "não" de quando falta fôlego). Não vai pela rede. */
  runKey: boolean;
  /** Bot não cola na parede. */
  bot?: boolean;
}

/** O fôlego de quem acabou de nascer. */
export const freshStamina = () => ({
  stam: BOL_STAM_MAX,
  stamHold: 0,
  tired: false,
  running: false,
  runKey: false,
});

/** Fôlego: gasta correndo, congela por um tempo ao parar e só então recarrega. Devolve se está correndo neste passo. */
function updateStamina(
  p: BolBody,
  input: BolInput,
  mag: number,
  dt: number,
  can: boolean,
  emit?: (e: BodyEvent) => void,
): boolean {
  const ask = !!input.run && mag > 0.3;
  // aperto novo sem poder correr (esgotado): o aparelho mostra e toca o "não"
  if (input.run && !p.runKey && can && (p.tired || p.stam <= 0)) emit?.('tired');
  p.runKey = !!input.run;
  if (ask && can && !p.tired && p.stam > 0) {
    p.stam -= BOL_STAM_DRAIN * dt;
    p.stamHold = BOL_STAM_HOLD;
    if (p.stam <= 0) {
      p.stam = 0;
      p.tired = true;
      p.stamHold = BOL_STAM_TIRED_HOLD;
      p.running = false;
      return false;
    }
    p.running = true;
    return true;
  }
  p.running = false;
  if (p.stamHold > 0) p.stamHold = Math.max(0, p.stamHold - dt);
  else {
    p.stam = Math.min(BOL_STAM_MAX, p.stam + BOL_STAM_REGEN * dt);
    if (p.tired && p.stam >= BOL_STAM_MIN) p.tired = false;
  }
  return false;
}

/** Até quanto acima do chão uma raposa que estava no chão ainda "gruda" nele (descendo a rampa), em m. */
const BOL_STICK = 0.3;

export type BodyEvent = 'jump' | 'airjump' | 'flip' | 'land' | 'tired';

/** Aperto de pulo, mortal e aceleração. Vale para o servidor e para o preditor do aparelho. */
export function controlBody(
  p: BolBody,
  input: BolInput,
  dt: number,
  emit?: (e: BodyEvent) => void,
): void {
  const mag = Math.hypot(input.mx, input.mz);
  const ix = mag > 1 ? input.mx / mag : input.mx;
  const iz = mag > 1 ? input.mz / mag : input.mz;
  p.ix = ix;
  p.iz = iz;
  // na parede e no teto não corre; no meio do mortal também não
  const running = updateStamina(p, input, mag, dt, p.surf === 0 && p.flipT <= 0, emit);
  if (p.surf !== 0) {
    controlSurface(p, input, ix, iz, mag, dt, emit);
    return;
  }
  if (p.grounded) p.stick = Math.min(BOL_STICK_MAX, p.stick + BOL_STICK_REGEN * dt);
  if (input.jump) {
    if (p.grounded) {
      p.vy = BOL_JUMP;
      p.grounded = false;
      emit?.('jump');
    } else if (!p.airJumped) {
      p.airJumped = true;
      if (mag > 0.3) {
        p.flipT = BOL_FLIP_SEC;
        p.flipHit = false;
        p.flipDx = input.mx / mag;
        p.flipDz = input.mz / mag;
        p.vx = p.flipDx * BOL_FLIP_SPEED;
        p.vz = p.flipDz * BOL_FLIP_SPEED;
        // nunca abaixo do que já se sobe: o mortal precisa ser notado mesmo logo após o pulo ou na queda
        p.vy = Math.max(p.vy, BOL_FLIP_LIFT);
        p.heading = Math.atan2(p.flipDx, p.flipDz);
        emit?.('flip');
      } else {
        p.vy = BOL_AIR_JUMP;
        emit?.('airjump');
      }
    }
  }
  if (p.flipT > 0) {
    p.flipT = Math.max(0, p.flipT - dt);
    return;
  }
  const top = running ? BOL_RUN_SPEED : BOL_SPEED;
  // correndo a raposa acelera mais devagar (vira e começa a correr com mais "peso"); soltar a corrida freia como andando
  const a = (p.grounded ? (running ? BOL_RUN_ACCEL : BOL_ACCEL) : BOL_AIR_ACCEL) * dt;
  const dx = ix * top - p.vx;
  const dz = iz * top - p.vz;
  const d = Math.hypot(dx, dz);
  if (d <= a) {
    p.vx = ix * top;
    p.vz = iz * top;
  } else {
    p.vx += (dx / d) * a;
    p.vz += (dz / d) * a;
  }
  if (mag > 0.1) p.heading = Math.atan2(ix, iz);
}

const approach = (cur: number, aim: number, a: number): number =>
  cur < aim ? Math.min(aim, cur + a) : Math.max(aim, cur - a);

/** Controle na parede (empurrar para a parede sobe, para o lado anda ao longo dela) e no teto (anda como no chão). */
function controlSurface(
  p: BolBody,
  input: BolInput,
  ix: number,
  iz: number,
  mag: number,
  dt: number,
  emit?: (e: BodyEvent) => void,
): void {
  if (input.jump) {
    // pular solta: da parede vai para longe dela, do teto só cai
    if (p.surf === 1) {
      p.vx = p.wnx * BOL_WALL_JUMP;
      p.vz = p.wnz * BOL_WALL_JUMP;
      p.vy = BOL_JUMP;
    } else {
      p.vx *= 0.5;
      p.vz *= 0.5;
      p.vy = 0;
    }
    p.surf = 0;
    p.grounded = false;
    p.airJumped = false;
    emit?.('jump');
    return;
  }
  if (p.surf === 1) {
    const tx = -p.wnz;
    const tz = p.wnx;
    const into = -(ix * p.wnx + iz * p.wnz);
    const lat = ix * tx + iz * tz;
    const a = BOL_WALL_ACCEL * dt;
    const curLat = p.vx * tx + p.vz * tz;
    const newLat = approach(curLat, lat * BOL_WALL_SPEED, a);
    p.vx = tx * newLat;
    p.vz = tz * newLat;
    p.vy = approach(p.vy, into * BOL_WALL_SPEED, a);
    if (Math.abs(lat) > 0.15) p.heading = Math.atan2(tx * Math.sign(lat), tz * Math.sign(lat));
    return;
  }
  // teto: como andar no chão, um pouco mais devagar
  const a = BOL_ACCEL * dt;
  const dx = ix * BOL_CEIL_SPEED - p.vx;
  const dz = iz * BOL_CEIL_SPEED - p.vz;
  const d = Math.hypot(dx, dz);
  if (d <= a) {
    p.vx = ix * BOL_CEIL_SPEED;
    p.vz = iz * BOL_CEIL_SPEED;
  } else {
    p.vx += (dx / d) * a;
    p.vz += (dz / d) * a;
  }
  if (mag > 0.1) p.heading = Math.atan2(ix, iz);
}

/** Um passo do corpo: gravidade, chão e paredes do campo. */
export function moveBody(
  p: BolBody,
  h: number,
  field: BolField,
  emit?: (e: BodyEvent) => void,
): void {
  if (p.surf === 1) {
    moveWall(p, h, field);
    return;
  }
  if (p.surf === 2) {
    moveCeiling(p, h, field);
    return;
  }
  const wasGrounded = p.grounded;
  p.vy -= BOL_FOX_GRAVITY * h;
  p.x += p.vx * h;
  p.y += p.vy * h;
  p.z += p.vz * h;
  // o chão sobe pela rampa perto das paredes; quem estava no chão e desce a rampa acompanha o chão (não "voa" a cada passo)
  const floor = field.floorAt(p.x, p.z);
  if (p.y <= floor || (wasGrounded && p.vy <= 0 && p.y - floor < BOL_STICK)) {
    p.y = floor;
    p.vy = 0;
    if (!p.grounded) {
      p.grounded = true;
      p.airJumped = false;
      p.flipT = 0;
      emit?.('land');
    }
  } else {
    p.grounded = false;
  }
  clampWalls(p, field, true);
}

/** A boca do gol está aberta (a raposa entra) e o resto das paredes a empurra; correndo contra uma parede ela pode colar. */
function clampWalls(p: BolBody, field: BolField, allowAttach: boolean): void {
  // a boca do gol está aberta: a raposa entra, com as traves dos lados e o fundo da rede como limite
  for (const e of field.edges) {
    if (e.goal < 0) continue;
    const g = field.goals[e.goal];
    if (!g) continue;
    const d = (p.x - e.ax) * e.nx + (p.z - e.az) * e.nz;
    const t = (p.x - e.mx) * e.tx + (p.z - e.mz) * e.tz;
    // só conta como "dentro do gol" quem já está passando da linha (ou chegando nela) pelo meio da boca
    const lim = g.halfW - BOL_FOX_R;
    if (d < BOL_FOX_R && d > -BOL_GOAL_DEPTH && (Math.abs(t) <= lim || d < 0)) {
      if (d < 0) {
        const ct = Math.max(-lim, Math.min(lim, t));
        p.x += e.tx * (ct - t);
        p.z += e.tz * (ct - t);
      }
      const back = -(BOL_GOAL_DEPTH - BOL_FOX_R);
      if (d < back) {
        p.x += e.nx * (back - d);
        p.z += e.nz * (back - d);
        const vn = p.vx * e.nx + p.vz * e.nz;
        if (vn < 0) {
          p.vx -= vn * e.nx;
          p.vz -= vn * e.nz;
        }
      }
      return;
    }
  }
  for (const e of field.edges) {
    const d = (p.x - e.ax) * e.nx + (p.z - e.az) * e.nz;
    if (d >= BOL_FOX_R) continue;
    p.x += e.nx * (BOL_FOX_R - d);
    p.z += e.nz * (BOL_FOX_R - d);
    const vn = p.vx * e.nx + p.vz * e.nz;
    if (vn < 0) {
      // correndo contra a parede, apertando para ela, com grude sobrando: cola e sobe (bot não)
      if (
        allowAttach &&
        !p.bot &&
        p.stick >= BOL_STICK_MIN &&
        p.flipT <= 0 &&
        -vn >= BOL_STICK_ENTRY_SPEED &&
        p.ix * e.nx + p.iz * e.nz < -0.4
      ) {
        const tx = -e.nz;
        const tz = e.nx;
        const lat = p.vx * tx + p.vz * tz;
        p.surf = 1;
        p.wnx = e.nx;
        p.wnz = e.nz;
        p.grounded = false;
        p.airJumped = false;
        p.vx = tx * lat;
        p.vz = tz * lat;
        p.vy = Math.max(p.vy, Math.min(BOL_WALL_SPEED, -vn));
        return;
      }
      p.vx -= vn * e.nx;
      p.vz -= vn * e.nz;
    }
  }
}

/** Largura do trecho de parede em que a raposa colada ainda é segurada (um pouco além das pontas, nos arcos dos cantos). */
const WALL_SLACK = 0.6;

function detach(p: BolBody): void {
  p.surf = 0;
  p.grounded = false;
}

/** Um passo colada na parede: sem gravidade, a distância da parede fixa; ao chegar no chão desce, no teto vira teto. */
function moveWall(p: BolBody, h: number, field: BolField): void {
  p.x += p.vx * h;
  p.z += p.vz * h;
  p.y += p.vy * h;
  // o trecho de parede em que está (nos cantos arredondados muda de um para o outro)
  let best: BolField['edges'][number] | null = null;
  let bestScore = Infinity;
  for (const e of field.edges) {
    if (e.nx * p.wnx + e.nz * p.wnz < 0.5) continue;
    const t = (p.x - e.mx) * e.tx + (p.z - e.mz) * e.tz;
    if (Math.abs(t) > e.len / 2 + WALL_SLACK) continue;
    if (e.goal >= 0) {
      const g = field.goals[e.goal];
      if (g && Math.abs(t) <= g.halfW) continue;
    }
    const d = (p.x - e.ax) * e.nx + (p.z - e.az) * e.nz;
    const score = Math.abs(d - BOL_FOX_R);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  if (!best) {
    detach(p);
    return;
  }
  p.wnx = best.nx;
  p.wnz = best.nz;
  const d = (p.x - best.ax) * best.nx + (p.z - best.az) * best.nz;
  p.x += best.nx * (BOL_FOX_R - d);
  p.z += best.nz * (BOL_FOX_R - d);
  p.stick -= h;
  if (p.stick <= 0) {
    p.stick = 0;
    detach(p);
    return;
  }
  const floor = field.floorAt(p.x, p.z);
  if (p.y <= floor) {
    p.y = floor;
    p.surf = 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.grounded = true;
    p.airJumped = false;
    return;
  }
  const top = BOL_CEILING - field.ceilDrop(p.x, p.z) - BOL_FOX_H;
  if (p.y >= top) {
    p.y = top;
    p.vy = 0;
    p.surf = 2;
  }
}

/** Um passo no teto: pendurada (o corpo segue do mesmo tamanho, para baixo), anda como no chão e gasta o grude. */
function moveCeiling(p: BolBody, h: number, field: BolField): void {
  p.vy = 0;
  p.x += p.vx * h;
  p.z += p.vz * h;
  clampWalls(p, field, false);
  // o teto curva até a parede como o chão: a raposa pendurada sobe e desce a curva
  p.y = BOL_CEILING - field.ceilDrop(p.x, p.z) - BOL_FOX_H;
  p.stick -= h;
  if (p.stick <= 0) {
    p.stick = 0;
    p.surf = 0;
    p.grounded = false;
    p.vx *= 0.5;
    p.vz *= 0.5;
  }
}

/**
 * Preditor da própria raposa no aparelho: roda a mesma conta do servidor (sem a bola nem as outras raposas) para o
 * movimento e o pulo responderem na hora, e é puxado de volta quando o servidor discorda.
 */
export class BolPredictor {
  readonly body: BolBody = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    grounded: true,
    airJumped: false,
    flipT: 0,
    flipDx: 0,
    flipDz: 0,
    flipHit: false,
    surf: 0,
    stick: BOL_STICK_MAX,
    wnx: 0,
    wnz: 0,
    ix: 0,
    iz: 0,
    ...freshStamina(),
  };
  constructor(private readonly field: BolField) {}

  /** Copia o estado inteiro (começo, teletransporte, troca de corpo). */
  reset(src: Partial<BolBody>): void {
    Object.assign(this.body, src);
  }

  step(dt: number, input: BolInput, emit?: (e: BodyEvent) => void): void {
    controlBody(this.body, input, dt, emit);
    const h = dt / BOL_SUBSTEPS;
    for (let i = 0; i < BOL_SUBSTEPS; i++) moveBody(this.body, h, this.field, emit);
  }
}
